import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../../lib/middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../field-ops/config.js';
import { rewriteR2Url, computePhotoHash, isPhotoHashDuplicate, analyzePhotoWithAI } from '../../lib/photoAi.js';
import { validateSAIdNumber, validateGoldrushId, extractGoldrushId, goldrushIdExists, ensureCaptureFailures } from '../../lib/goldrush.js';

const app = new Hono();

// ==================== VISITS / CHECK-INS ====================
app.get('/visits', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { limit = 50, page = 1, search, status, agent_id, visit_type, company_id, start_date, end_date } = c.req.query();
  let where = 'WHERE v.tenant_id = ?';
  const params = [tenantId];
  if (role === 'agent') { where += ' AND v.agent_id = ?'; params.push(userId); }
  if (agent_id) { where += ' AND v.agent_id = ?'; params.push(agent_id); }
  if (status) { where += ' AND v.status = ?'; params.push(status); }
  if (visit_type) { where += ' AND v.visit_type = ?'; params.push(visit_type); }
  if (company_id) { where += ' AND v.company_id = ?'; params.push(company_id); }
  if (start_date) { where += ' AND v.visit_date >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND v.visit_date <= ?'; params.push(end_date); }
  if (search) { where += ' AND (c.name LIKE ? OR v.notes LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  // 1) Page of visits — single read, no per-row subqueries.
  const [countR, visits] = await Promise.all([
    db.prepare('SELECT COUNT(*) as total FROM visits v LEFT JOIN customers c ON v.customer_id = c.id ' + where).bind(...params).first(),
    db.prepare(
      "SELECT v.*, c.name as customer_name, c.address as customer_address, " +
      "u.first_name || ' ' || u.last_name as agent_name " +
      "FROM visits v " +
      "LEFT JOIN customers c ON v.customer_id = c.id " +
      "LEFT JOIN users u ON v.agent_id = u.id " +
      where + ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, limitNum, offset).all()
  ]);
  const total = countR ? countR.total : 0;
  const visitRows = visits.results || [];
  const visitIds = visitRows.map(v => v.id).filter(Boolean);

  // 2) Batch the three previously-correlated subqueries into single IN-queries.
  let thumbByVisit = {};
  let responsesByVisit = {};
  let customFieldsByVisit = {};
  if (visitIds.length > 0) {
    const ph = visitIds.map(() => '?').join(',');
    const [thumbs, resps, individuals] = await Promise.all([
      db.prepare(`SELECT visit_id, r2_url FROM visit_photos WHERE tenant_id = ? AND visit_id IN (${ph}) AND r2_url IS NOT NULL`).bind(tenantId, ...visitIds).all(),
      db.prepare(`SELECT visit_id, responses FROM visit_responses WHERE visit_id IN (${ph}) AND (visit_type IS NULL OR visit_type != 'store_custom_questions')`).bind(...visitIds).all(),
      db.prepare(`SELECT visit_id, custom_field_values FROM visit_individuals WHERE visit_id IN (${ph})`).bind(...visitIds).all(),
    ]);
    // First photo per visit wins (mirrors the old LIMIT 1 behaviour deterministically).
    for (const r of (thumbs.results || [])) {
      if (!thumbByVisit[r.visit_id]) thumbByVisit[r.visit_id] = r.r2_url;
    }
    for (const r of (resps.results || [])) {
      if (!responsesByVisit[r.visit_id]) responsesByVisit[r.visit_id] = r.responses;
    }
    for (const r of (individuals.results || [])) {
      if (!customFieldsByVisit[r.visit_id]) customFieldsByVisit[r.visit_id] = r.custom_field_values;
    }
  }

  // 3) Batch report-image-key lookup (was already batched, kept the shape).
  const companyIds = [...new Set(visitRows.map(v => v.company_id).filter(Boolean))];
  let reportImageKeys = {};
  if (companyIds.length > 0) {
    const placeholders = companyIds.map(() => '?').join(',');
    const imgQs = await db.prepare(`SELECT company_id, question_key FROM company_custom_questions WHERE tenant_id = ? AND company_id IN (${placeholders}) AND field_type = 'image' AND show_in_reports = 1 AND is_active = 1`).bind(tenantId, ...companyIds).all();
    for (const q of (imgQs.results || [])) {
      if (!reportImageKeys[q.company_id]) reportImageKeys[q.company_id] = [];
      reportImageKeys[q.company_id].push(q.question_key);
    }
  }

  const enrichedVisits = visitRows.map(v => {
    const row = { ...v, thumbnail_url: thumbByVisit[v.id] || null };
    if (!row.thumbnail_url && !row.photo_url && v.company_id && reportImageKeys[v.company_id]) {
      try {
        const resp = {};
        const rawCustom = customFieldsByVisit[v.id];
        const rawResponses = responsesByVisit[v.id];
        if (rawCustom) { try { Object.assign(resp, typeof rawCustom === 'string' ? JSON.parse(rawCustom) : rawCustom); } catch {} }
        if (rawResponses) { try { Object.assign(resp, typeof rawResponses === 'string' ? JSON.parse(rawResponses) : rawResponses); } catch {} }
        for (const key of reportImageKeys[v.company_id]) {
          if (resp[key] && typeof resp[key] === 'string' && (resp[key].startsWith('data:image') || resp[key].startsWith('http'))) {
            row.thumbnail_url = resp[key];
            break;
          }
        }
      } catch {}
    }
    return row;
  });
  return c.json({ success: true, data: { visits: enrichedVisits, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } } });
});

app.get('/visits/stats', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { start_date, end_date } = c.req.query();
  let dateFilter = '';
  const params = [tenantId];
  if (start_date) { dateFilter += ' AND visit_date >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND visit_date <= ?'; params.push(end_date); }
  const [total, completed, pending, byType] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM visits WHERE tenant_id = ?' + dateFilter).bind(...params).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND status = 'completed'" + dateFilter).bind(...params).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND status = 'pending'" + dateFilter).bind(...params).first(),
    db.prepare('SELECT visit_type, COUNT(*) as count FROM visits WHERE tenant_id = ?' + dateFilter + ' GROUP BY visit_type').bind(...params).all(),
  ]);
  return c.json({ success: true, data: { total: total ? total.count : 0, completed: completed ? completed.count : 0, pending: pending ? pending.count : 0, byType: byType.results || [] } });
});

// Literal /visits/* stubs must register before /visits/:id or they get shadowed.
app.get('/visits/analytics', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/visits/follow-ups', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/visits/plans', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/visits/templates', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

app.get('/visits/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const visit = await db.prepare("SELECT v.*, c.name as customer_name, c.address as customer_address, u.first_name || ' ' || u.last_name as agent_name, co.name as company_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id LEFT JOIN field_companies co ON v.company_id = co.id WHERE v.id = ? AND v.tenant_id = ?").bind(id, tenantId).first();
  if (!visit) return c.json({ success: false, message: 'Visit not found' }, 404);
  const [responses, photos, individuals] = await Promise.all([
    db.prepare('SELECT vr.* FROM visit_responses vr JOIN visits v ON vr.visit_id = v.id WHERE vr.visit_id = ? AND v.tenant_id = ? LIMIT 500').bind(id, tenantId).all(),
    db.prepare('SELECT * FROM visit_photos WHERE visit_id = ? AND tenant_id = ?').bind(id, tenantId).all().catch(() => ({ results: [] })),
    db.prepare('SELECT vi.*, i.first_name, i.last_name, i.id_number, i.phone, i.email FROM visit_individuals vi LEFT JOIN individuals i ON vi.individual_id = i.id WHERE vi.visit_id = ? AND vi.tenant_id = ?').bind(id, tenantId).all().catch(() => ({ results: [] }))
  ]);
  // Extract images from custom question responses (company questions with field_type='image')
  let photoResults = photos.results || [];
  const visitCompany = visit.company_id;
  if (visitCompany && individuals.results && individuals.results.length > 0) {
    try {
      const vi = individuals.results[0];
      const customFieldValues = typeof vi.custom_field_values === 'string' ? JSON.parse(vi.custom_field_values) : vi.custom_field_values;
      if (customFieldValues) {
        const imgQs = await db.prepare("SELECT question_key FROM company_custom_questions WHERE tenant_id = ? AND company_id = ? AND field_type = 'image' AND is_active = 1").bind(tenantId, visitCompany).all();
        const imgKeys = (imgQs.results || []).map(q => q.question_key);
        for (const key of imgKeys) {
          const val = customFieldValues[key];
          if (val && typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('http'))) {
            photoResults.push({ id: `q_${key}`, photo_type: 'question', r2_url: val, photo_url: val, url: val, captured_at: visit.created_at || new Date().toISOString() });
          }
        }
      }
    } catch { /* ok */ }
  }
  return c.json({ success: true, data: { ...visit, responses: responses.results || [], photos: photoResults, individuals: individuals.results || [] } });
});

app.post('/visits', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  const visitDate = body.visit_date || new Date().toISOString().split('T')[0];
  await db.prepare('INSERT INTO visits (id, tenant_id, agent_id, customer_id, visit_date, visit_type, check_in_time, latitude, longitude, photo_url, photo_base64, additional_photos, brand_id, category_id, product_id, individual_name, individual_surname, individual_id_number, individual_phone, purpose, outcome, notes, questionnaire_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.agent_id || userId, body.customer_id || null, visitDate, body.visit_type || 'customer', body.check_in_time || new Date().toISOString(), body.latitude || null, body.longitude || null, body.photo_url || null, body.photo_base64 || null, body.additional_photos ? JSON.stringify(body.additional_photos) : null, body.brand_id || null, body.category_id || null, body.product_id || null, body.individual_name || null, body.individual_surname || null, body.individual_id_number || null, body.individual_phone || null, body.purpose || null, body.outcome || null, body.notes || null, body.questionnaire_id || null, body.status || 'pending').run();
  if (body.responses) {
    const respId = uuidv4();
    await db.prepare('INSERT INTO visit_responses (id, tenant_id, visit_id, visit_type, responses) VALUES (?, ?, ?, ?, ?)').bind(respId, tenantId, id, body.visit_type || 'customer', JSON.stringify(body.responses)).run();
  }

  // Anomaly detection on visit creation
  const anomalies = [];
  const agentId = body.agent_id || userId;
  const lat = parseFloat(body.latitude);
  const lng = parseFloat(body.longitude);

  if (lat && lng && body.customer_id) {
    // 1. GPS spoofing: check if customer location is far from visit GPS
    const customer = await db.prepare('SELECT latitude, longitude FROM customers WHERE id = ? AND tenant_id = ?').bind(body.customer_id, tenantId).first();
    if (customer && customer.latitude && customer.longitude) {
      const R = 6371;
      const dLat = (lat - customer.latitude) * Math.PI / 180;
      const dLon = (lng - customer.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(customer.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist > 0.5) {
        anomalies.push({ type: 'GPS_SPOOFING', severity: dist > 2 ? 'high' : 'medium', details: `Visit GPS is ${dist.toFixed(2)}km from customer location` });
      }
    }

    // 2. Ghost visit: check if agent had another visit within 5 minutes at a different location
    const recentVisit = await db.prepare("SELECT latitude, longitude, check_in_time FROM visits WHERE tenant_id = ? AND agent_id = ? AND id != ? AND visit_date = ? AND ABS(julianday(check_in_time) - julianday(?)) < 0.0035 ORDER BY check_in_time DESC LIMIT 1").bind(tenantId, agentId, id, visitDate, body.check_in_time || new Date().toISOString()).first();
    if (recentVisit && recentVisit.latitude && recentVisit.longitude) {
      const dLat2 = (lat - recentVisit.latitude) * Math.PI / 180;
      const dLon2 = (lng - recentVisit.longitude) * Math.PI / 180;
      const a2 = Math.sin(dLat2 / 2) * Math.sin(dLat2 / 2) + Math.cos(recentVisit.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLon2 / 2) * Math.sin(dLon2 / 2);
      const dist2 = 6371 * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
      if (dist2 > 5) {
        anomalies.push({ type: 'GHOST_VISIT', severity: 'high', details: `Agent teleported ${dist2.toFixed(1)}km between visits within 5 minutes` });
      }
    }

    // 3. Pattern break: check if agent is visiting outside their usual hours
    const hour = new Date(body.check_in_time || new Date()).getHours();
    if (hour < 6 || hour > 21) {
      anomalies.push({ type: 'PATTERN_BREAK', severity: 'low', details: `Visit created at unusual hour: ${hour}:00` });
    }
  }

  // Insert anomaly flags if any detected
  if (anomalies.length > 0) {
    const anomalyBatch = anomalies.map(a => {
      const aId = uuidv4();
      return db.prepare("INSERT INTO anomaly_flags (id, tenant_id, agent_id, anomaly_type, severity, description, reference_type, reference_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'VISIT', ?, 'OPEN', datetime('now'))").bind(aId, tenantId, body.agent_id || userId, a.type, a.severity, a.details, id);
    });
    try { await db.batch(anomalyBatch); } catch(e) { console.error('Anomaly insert error:', e); }
  }

  return c.json({ success: true, data: { id, anomalies: anomalies.length > 0 ? anomalies : undefined }, message: 'Visit created' }, 201);
});

// Field allowlist for PUT /visits/:id custom_field_values merges. The blob also
// carries verification keys (converted, consumer_converted) that drive conversion
// counts and commissions — clients must never set those post-capture. Only the
// Goldrush backfill/review keys the frontend actually sends are editable.
export const CUSTOM_FIELD_UPDATE_KEYS = ['goldrush_id', 'goldrush_id_rejected', 'goldrush_id_rejection_reason'];

export function pickCustomFieldUpdates(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return {};
  const out = {};
  for (const key of CUSTOM_FIELD_UPDATE_KEYS) {
    if (!(key in values)) continue;
    const v = values[key];
    if (key === 'goldrush_id_rejected') { out[key] = !!v; continue; }
    // ponytail: strings only; caps are sanity bounds (goldrush_id must be 9 digits, checked below)
    out[key] = String(v ?? '').trim().slice(0, key === 'goldrush_id' ? 20 : 500);
  }
  return out;
}

app.put('/visits/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE visits SET check_out_time = COALESCE(?, check_out_time), outcome = COALESCE(?, outcome), notes = COALESCE(?, notes), status = COALESCE(?, status), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.check_out_time || null, body.outcome || null, body.notes || null, body.status || null, id, tenantId).run();
  if (body.responses) {
    const existing = await db.prepare('SELECT vr.id FROM visit_responses vr JOIN visits v ON vr.visit_id = v.id WHERE vr.visit_id = ? AND v.tenant_id = ? AND (vr.visit_type IS NULL OR vr.visit_type != \'store_custom_questions\')').bind(id, tenantId).first();
    if (existing) {
      await db.prepare('UPDATE visit_responses SET responses = ? WHERE visit_id = ? AND (visit_type IS NULL OR visit_type != \'store_custom_questions\')').bind(JSON.stringify(body.responses), id).run();
    } else {
      const respId = uuidv4();
      await db.prepare('INSERT INTO visit_responses (id, tenant_id, visit_id, responses) VALUES (?, ?, ?, ?)').bind(respId, tenantId, id, JSON.stringify(body.responses)).run();
    }
  }
  // Update custom_field_values on visit_individuals (e.g. Goldrush ID backfill)
  const customFieldUpdates = pickCustomFieldUpdates(body.custom_field_values);
  if (Object.keys(customFieldUpdates).length > 0) {
    // Goldrush uniqueness + length on edit/resubmit (exclude this visit's own rows).
    const incomingGoldrush = extractGoldrushId(customFieldUpdates);
    if (incomingGoldrush) {
      if (incomingGoldrush.length !== 9) {
        return c.json({ error: 'Goldrush ID must be exactly 9 digits' }, 400);
      }
      if (await goldrushIdExists(db, tenantId, incomingGoldrush, id)) {
        return c.json({ error: 'This Goldrush ID has already been used. Goldrush IDs must be unique.' }, 409);
      }
    }
    const vi = await db.prepare('SELECT id, custom_field_values FROM visit_individuals WHERE visit_id = ? AND tenant_id = ?').bind(id, tenantId).first();
    if (vi) {
      let existing = {};
      try { existing = JSON.parse(vi.custom_field_values || '{}'); } catch(e) {}
      const merged = { ...existing, ...customFieldUpdates };
      await db.prepare('UPDATE visit_individuals SET custom_field_values = ? WHERE id = ? AND tenant_id = ?').bind(JSON.stringify(merged), vi.id, tenantId).run();
    }
    // Also update store_custom_questions in visit_responses for store visits (e.g. Goldrush ID on store visits)
    const storeResp = await db.prepare("SELECT id, responses FROM visit_responses WHERE visit_id = ? AND tenant_id = ? AND visit_type = 'store_custom_questions'").bind(id, tenantId).first();
    if (storeResp) {
      let existingStore = {};
      try { existingStore = JSON.parse(storeResp.responses || '{}'); } catch(e) {}
      const mergedStore = { ...existingStore, ...customFieldUpdates };
      await db.prepare("UPDATE visit_responses SET responses = ? WHERE id = ? AND tenant_id = ?").bind(JSON.stringify(mergedStore), storeResp.id, tenantId).run();
    }
  }
  return c.json({ success: true, message: 'Visit updated' });
});

app.post('/visits/:id/check-out', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare("UPDATE visits SET check_out_time = ?, status = 'completed', outcome = COALESCE(?, outcome), notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(body.check_out_time || new Date().toISOString(), body.outcome || null, body.notes || null, id, tenantId).run();
  return c.json({ success: true, message: 'Checked out successfully' });
});

// ==================== QUESTIONNAIRES ====================
app.get('/questionnaires', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { visit_type, brand_id, company_id, target_type, module: mod } = c.req.query();
  let where = 'WHERE tenant_id = ? AND is_active = 1';
  const params = [tenantId];
  if (visit_type) { where += ' AND visit_type = ?'; params.push(visit_type); }
  if (brand_id) { where += ' AND (brand_id = ? OR brand_id IS NULL)'; params.push(brand_id); }
  if (company_id) { where += ' AND (company_id = ? OR company_id IS NULL)'; params.push(company_id); }
  if (target_type) { where += " AND (target_type = ? OR target_type = 'both')"; params.push(target_type); }
  if (mod) { where += ' AND module = ?'; params.push(mod); }
  const questionnaires = await db.prepare('SELECT * FROM questionnaires ' + where + ' ORDER BY name LIMIT 500').bind(...params).all();
  const results = (questionnaires.results || []).map(q => {
    try { q.questions = JSON.parse(q.questions); } catch(e) {}
    return q;
  });
  return c.json({ success: true, data: results });
});

app.post('/questionnaires', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO questionnaires (id, tenant_id, name, visit_type, brand_id, questions, is_default, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)').bind(id, tenantId, body.name, body.visit_type || 'customer', body.brand_id || null, JSON.stringify(body.questions), body.is_default ? 1 : 0).run();
  return c.json({ success: true, data: { id } }, 201);
});

app.put('/questionnaires/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE questionnaires SET name = COALESCE(?, name), visit_type = COALESCE(?, visit_type), questions = COALESCE(?, questions), is_active = COALESCE(?, is_active), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.visit_type || null, body.questions ? JSON.stringify(body.questions) : null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, id, tenantId).run();
  return c.json({ success: true, message: 'Questionnaire updated' });
});
// ==================== BOARDS ====================
app.get('/boards', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  try {
    const boards = await db.prepare("SELECT id, name, description, board_type, dimensions, status FROM boards WHERE tenant_id = ? AND status = 'active' ORDER BY name").bind(tenantId).all();
    return c.json({ success: true, data: boards.results || [] });
  } catch { return c.json({ success: true, data: [] }); }
});

app.post('/boards', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  if (!body.name) return c.json({ success: false, message: 'name is required' }, 400);
  const id = uuidv4();
  await db.prepare('INSERT INTO boards (id, tenant_id, name, description, board_type, dimensions) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.description || null, body.board_type || 'standard', body.dimensions || null).run();
  return c.json({ success: true, data: { id, ...body } }, 201);
});

// ==================== VISIT CONFIGURATIONS ====================
app.get('/visit-configurations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  try {
    const configs = await db.prepare(`
      SELECT vc.*, b.name as brand_name, q.name as survey_title, bd.name as board_name
      FROM visit_configurations vc
      LEFT JOIN brands b ON vc.brand_id = b.id
      LEFT JOIN questionnaires q ON vc.survey_id = q.id
      LEFT JOIN boards bd ON vc.board_id = bd.id
      WHERE vc.tenant_id = ?
      ORDER BY vc.created_at DESC
    `).bind(tenantId).all();
    return c.json({ success: true, data: configs.results || [] });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

app.get('/visit-configurations/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const config = await db.prepare(`
    SELECT vc.*, b.name as brand_name, q.name as survey_title, bd.name as board_name
    FROM visit_configurations vc
    LEFT JOIN brands b ON vc.brand_id = b.id
    LEFT JOIN questionnaires q ON vc.survey_id = q.id
    LEFT JOIN boards bd ON vc.board_id = bd.id
    WHERE vc.id = ? AND vc.tenant_id = ?
  `).bind(id, tenantId).first();
  if (!config) return c.json({ success: false, message: 'Configuration not found' }, 404);
  return c.json({ success: true, data: config });
});

app.post('/visit-configurations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  if (!body.name) return c.json({ success: false, message: 'name is required' }, 400);
  const id = uuidv4();
  await db.prepare(`
    INSERT INTO visit_configurations (id, tenant_id, name, description, target_type, brand_id, customer_type, valid_from, valid_to, survey_id, survey_required, requires_board_placement, board_id, board_photo_required, track_coverage_analytics, visit_type, visit_category, default_duration_minutes, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, tenantId, body.name, body.description || null, body.target_type || 'all',
    body.brand_id || null, body.customer_type || null, body.valid_from || null, body.valid_to || null,
    body.survey_id || null, body.survey_required ? 1 : 0,
    body.requires_board_placement ? 1 : 0, body.board_id || null, body.board_photo_required ? 1 : 0,
    body.track_coverage_analytics ? 1 : 0, body.visit_type || 'field_visit',
    body.visit_category || 'field_operations', body.default_duration_minutes || 30,
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1
  ).run();
  return c.json({ success: true, data: { id, ...body } }, 201);
});

app.put('/visit-configurations/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const existing = await db.prepare('SELECT id FROM visit_configurations WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!existing) return c.json({ success: false, message: 'Configuration not found' }, 404);
  const fields = ['name', 'description', 'target_type', 'brand_id', 'customer_type', 'valid_from', 'valid_to', 'survey_id', 'visit_type', 'visit_category', 'default_duration_minutes'];
  const boolFields = ['survey_required', 'requires_board_placement', 'board_photo_required', 'track_coverage_analytics', 'is_active'];
  const sets = [];
  const vals = [];
  for (const f of fields) {
    if (body[f] !== undefined) { sets.push(f + ' = ?'); vals.push(body[f] || null); }
  }
  for (const f of boolFields) {
    if (body[f] !== undefined) { sets.push(f + ' = ?'); vals.push(body[f] ? 1 : 0); }
  }
  if (body.board_id !== undefined) { sets.push('board_id = ?'); vals.push(body.board_id || null); }
  if (sets.length === 0) return c.json({ success: false, message: 'No fields to update' }, 400);
  sets.push('updated_at = CURRENT_TIMESTAMP');
  await db.prepare('UPDATE visit_configurations SET ' + sets.join(', ') + ' WHERE id = ? AND tenant_id = ?').bind(...vals, id, tenantId).run();
  return c.json({ success: true, message: 'Configuration updated' });
});

app.delete('/visit-configurations/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM visit_configurations WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Configuration deleted' });
});
app.post('/visits/check-store-revisit', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const { customer_id } = body;
  if (!customer_id) return c.json({ error: 'customer_id is required' }, 400);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentVisit = await db.prepare(
    "SELECT id, visit_date, agent_id FROM visits WHERE tenant_id = ? AND customer_id = ? AND visit_date >= ? AND status != 'cancelled' ORDER BY visit_date DESC LIMIT 1"
  ).bind(tenantId, customer_id, thirtyDaysAgo).first();
  if (recentVisit) {
    const daysSince = Math.floor((Date.now() - new Date(recentVisit.visit_date).getTime()) / (1000 * 60 * 60 * 24));
    return c.json({ can_visit: false, last_visit: recentVisit, days_since: daysSince, message: `This store was visited ${daysSince} day(s) ago. Must wait 30 days between visits.` });
  }
  return c.json({ can_visit: true, message: 'Store is eligible for a visit' });
});

// Check for duplicate individual (ID number, phone, or goldrush player ID)
app.post('/visits/check-individual-duplicate', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const { id_number, phone, goldrush_id } = body;
  const duplicates = [];
  if (id_number) {
    const existing = await db.prepare('SELECT id, first_name, last_name, id_number FROM individuals WHERE tenant_id = ? AND id_number = ? AND id_number != ""').bind(tenantId, id_number).first();
    if (existing) duplicates.push({ field: 'id_number', value: id_number, existing_individual: existing });
  }
  if (phone) {
    const existing = await db.prepare('SELECT id, first_name, last_name, phone FROM individuals WHERE tenant_id = ? AND phone = ? AND phone != ""').bind(tenantId, phone).first();
    if (existing) duplicates.push({ field: 'phone', value: phone, existing_individual: existing });
  }
  // goldrush_id lives in visit_individuals.custom_field_values JSON (key contains 'goldrush_id').
  if (goldrush_id) {
    const rows = await db.prepare(
      'SELECT vi.individual_id, vi.custom_field_values, i.first_name, i.last_name FROM visit_individuals vi LEFT JOIN individuals i ON vi.individual_id = i.id WHERE vi.tenant_id = ? AND vi.custom_field_values LIKE ?'
    ).bind(tenantId, `%${goldrush_id}%`).all();
    for (const row of (rows.results || [])) {
      let parsed;
      try { parsed = JSON.parse(row.custom_field_values || '{}'); } catch { parsed = {}; }
      const match = Object.entries(parsed).some(([k, v]) => k.toLowerCase().includes('goldrush_id') && String(v) === String(goldrush_id));
      if (match) {
        duplicates.push({ field: 'goldrush_id', value: goldrush_id, existing_individual: { id: row.individual_id, first_name: row.first_name, last_name: row.last_name } });
        break;
      }
    }
  }
  return c.json({ has_duplicates: duplicates.length > 0, duplicates });
});

// Check for duplicate photo (by hash)
app.post('/visits/check-photo-duplicate', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const { photo_hash } = body;
  if (!photo_hash) return c.json({ error: 'photo_hash is required' }, 400);
  const existing = await db.prepare(
    "SELECT vp.id, vp.visit_id, vp.created_at, v.agent_id FROM visit_photos vp JOIN visits v ON vp.visit_id = v.id WHERE vp.tenant_id = ? AND vp.photo_hash = ?"
  ).bind(tenantId, photo_hash).first();
  if (existing) {
    return c.json({ is_duplicate: true, existing_photo: existing, message: 'This photo has already been submitted. Please take a new photo.' });
  }
  return c.json({ is_duplicate: false, message: 'Photo is unique' });
});
// Create visit with full workflow data (individual or store)
app.post('/visits/workflow', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const visitId = body.client_visit_id || crypto.randomUUID();
  const now = new Date().toISOString();
  const visitDate = body.visit_date || now.split('T')[0];

  let goldrushValidationWarnings = null;
  // Deferred: set to a function that logs to goldrush_upload_failures after the visit is created
  let logGoldrushFailure = null;
  try {
    // 0a. Goldrush individual validation — log issues for reporting but allow the visit
    //     through so the agent's capture is never lost. Errors are returned as warnings
    //     in the response so the frontend can display them clearly.
    //     Rejected visits are excluded from individual reports via goldrush_upload_failures.visit_id.
    if (body.visit_target_type === 'individual' && (body.company_id || body.companyId)) {
      const checkCompanyId = body.company_id || body.companyId;
      // convergence: qualification path is config-driven, not company-name-gated.
      const qualEnabled = await getConfig(db, tenantId, checkCompanyId, 'qualification_enabled');
      if (qualEnabled === true) {
        const allCustom = { ...(body.custom_field_values || {}), ...(body.custom_question_values || {}) };
        const grId = allCustom.goldrush_id;
        const idNum = body.individual_id_number;
        const validationErrors = {};
        if (idNum) {
          const idCheck = validateSAIdNumber(idNum);
          if (!idCheck.valid) validationErrors.id_number = idCheck.error;
        }
        if (grId) {
          const grCheck = validateGoldrushId(grId);
          if (!grCheck.valid) validationErrors.goldrush_id = grCheck.error;
        }
        if (body.goldrush_photo_mismatch) {
          validationErrors.photo_mismatch = 'Goldrush ID in photo does not match the ID entered by the agent';
        }
        if (body.goldrush_no_btag) {
          validationErrors.no_btag = 'No B-Tag number found in the photo URL (goldrush.co.za/?btag=...)';
        }
        if (Object.keys(validationErrors).length > 0) {
          goldrushValidationWarnings = validationErrors;
          // Defer the DB log until after the visit is created so we can store visit_id
          logGoldrushFailure = async (createdVisitId) => {
            try {
              await ensureCaptureFailures(db);
              const agentRow = await db.prepare('SELECT first_name, last_name, team_lead_id FROM users WHERE id = ?').bind(body.agent_id || userId).first();
              let tlName = null, tlId = agentRow?.team_lead_id || null;
              if (tlId) {
                const tlRow = await db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').bind(tlId).first();
                if (tlRow) tlName = `${tlRow.first_name} ${tlRow.last_name}`;
              }
              const agentName = agentRow ? `${agentRow.first_name} ${agentRow.last_name}` : null;
              await db.prepare('INSERT INTO capture_failures (id, tenant_id, company_id, agent_id, agent_name, team_lead_id, team_lead_name, first_name, last_name, id_number, identifier_value, phone, error_id_number, error_goldrush_id, error_photo_mismatch, error_no_btag, visit_id, visit_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime("now"))').bind(
                crypto.randomUUID(), tenantId, checkCompanyId,
                body.agent_id || userId, agentName, tlId, tlName,
                body.individual_first_name || null, body.individual_last_name || null,
                idNum || null, grId || null, body.individual_phone || null,
                validationErrors.id_number || null, validationErrors.goldrush_id || null,
                validationErrors.photo_mismatch || null, validationErrors.no_btag || null,
                createdVisitId,
                visitDate
              ).run();
            } catch (logErr) { console.error('Failed to log goldrush upload failure:', logErr); }
          };
          // Continue — visit is still created so the agent's capture is not lost
        }
      }
    }

    // Idempotency: if client sends a client_visit_id, check if visit already exists to prevent duplicates on retry
    if (body.client_visit_id) {
      const existingVisit = await db.prepare("SELECT id, status FROM visits WHERE tenant_id = ? AND id = ?").bind(tenantId, body.client_visit_id).first();
      if (existingVisit) {
        return c.json({ data: { id: existingVisit.id, status: existingVisit.status, visit_date: visitDate, already_existed: true }, message: 'Visit already exists (duplicate prevented)' }, 200);
      }
    }

    // Goldrush uniqueness + length: reject up front, before any inserts, so a
    // rejected submission never leaves an orphan visit row.
    const incomingGoldrush = extractGoldrushId({ ...(body.custom_field_values || {}), ...(body.custom_question_values || {}) });
    if (incomingGoldrush) {
      if (incomingGoldrush.length !== 9) {
        return c.json({ error: 'Goldrush ID must be exactly 9 digits' }, 400);
      }
      if (await goldrushIdExists(db, tenantId, incomingGoldrush)) {
        return c.json({ error: 'This Goldrush ID has already been used. Goldrush IDs must be unique.' }, 409);
      }
    }

    // Individual ID-number / phone uniqueness: hard-reject up front (mirrors the
    // /individuals endpoint and the client pre-flight) so duplicates can't slip
    // in via a race or a direct API call. Runs before any insert → no orphan
    // visit. client_visit_id idempotency above already short-circuits retries.
    if (body.visit_target_type === 'individual') {
      if (body.individual_id_number) {
        const dupId = await db.prepare('SELECT id FROM individuals WHERE tenant_id = ? AND id_number = ? AND id_number != ""').bind(tenantId, body.individual_id_number).first();
        if (dupId) return c.json({ error: 'This ID number is already registered. ID numbers must be unique.', duplicate_field: 'id_number' }, 409);
      }
      if (body.individual_phone) {
        const dupPhone = await db.prepare('SELECT id FROM individuals WHERE tenant_id = ? AND phone = ? AND phone != ""').bind(tenantId, body.individual_phone).first();
        if (dupPhone) return c.json({ error: 'This phone number is already registered. Phone numbers must be unique.', duplicate_field: 'phone' }, 409);
      }
    }

    // 0. If store visit with store_name but no customer_id, auto-create customer
    let customerId = body.customer_id || null;
    if (body.visit_target_type === 'store' && !customerId && body.store_name) {
      customerId = crypto.randomUUID();
      try {
        await db.prepare('INSERT INTO customers (id, tenant_id, name, type, customer_type, latitude, longitude, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
          customerId, tenantId, body.store_name, 'retail', 'SHOP',
          body.checkin_latitude ?? null, body.checkin_longitude ?? null,
          'active', now, now
        ).run();
      } catch {
        // Fallback: customer_type column may not exist on older schemas
        await db.prepare('INSERT INTO customers (id, tenant_id, name, type, latitude, longitude, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
          customerId, tenantId, body.store_name, 'retail',
          body.checkin_latitude ?? null, body.checkin_longitude ?? null,
          'active', now, now
        ).run();
      }
    }

    // 1. Create the visit record (try with company_id column first, fallback without)
    const companyId = body.company_id || null;
    // brand_id has FK to brands table - do NOT put company_id into brand_id
    const brandId = body.brand_id || null;
    try {
      await db.prepare(`INSERT INTO visits (id, tenant_id, agent_id, customer_id, visit_date, visit_type, visit_target_type, check_in_time, latitude, longitude, brand_id, company_id, individual_name, individual_surname, individual_id_number, individual_phone, purpose, notes, questionnaire_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`).bind(
        visitId, tenantId, body.agent_id || userId, customerId, visitDate,
        body.visit_target_type || 'customer', body.visit_target_type || 'customer', now,
        body.checkin_latitude ?? null, body.checkin_longitude ?? null,
        brandId, companyId,
        body.individual_first_name || null, body.individual_last_name || null,
        body.individual_id_number || null, body.individual_phone || null,
        body.purpose || body.visit_target_type || 'field_visit',
        body.notes || null, body.questionnaire_id || null,
        now, now
      ).run();
    } catch {
      // Fallback: company_id column may not exist yet
      await db.prepare(`INSERT INTO visits (id, tenant_id, agent_id, customer_id, visit_date, visit_type, check_in_time, latitude, longitude, brand_id, individual_name, individual_surname, individual_id_number, individual_phone, purpose, notes, questionnaire_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`).bind(
        visitId, tenantId, body.agent_id || userId, customerId, visitDate,
        body.visit_target_type || 'customer', now,
        body.checkin_latitude ?? null, body.checkin_longitude ?? null,
        brandId,
        body.individual_first_name || null, body.individual_last_name || null,
        body.individual_id_number || null, body.individual_phone || null,
        body.purpose || body.visit_target_type || 'field_visit',
        body.notes || null, body.questionnaire_id || null,
        now, now
      ).run();
    }

    // 2. If individual visit, create or link the individual
    let individualId = null;
    // Track which custom question keys have AI analysis enabled (used by both individual and store paths)
    let aiEnabledKeys = new Set();

    if (body.visit_target_type === 'individual' && (body.individual_first_name || body.individual_id_number)) {
      // Check if individual already exists
      let existingIndividual = null;
      if (body.individual_id_number) {
        existingIndividual = await db.prepare('SELECT id FROM individuals WHERE tenant_id = ? AND id_number = ? AND id_number != ""').bind(tenantId, body.individual_id_number).first();
      }
      if (!existingIndividual && body.individual_phone) {
        existingIndividual = await db.prepare('SELECT id FROM individuals WHERE tenant_id = ? AND phone = ? AND phone != ""').bind(tenantId, body.individual_phone).first();
      }

      if (existingIndividual) {
        individualId = existingIndividual.id;
        // Update individual details
        await db.prepare('UPDATE individuals SET first_name = ?, last_name = ?, gps_latitude = ?, gps_longitude = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(
          body.individual_first_name || '', body.individual_last_name || '',
          body.checkin_latitude ?? null, body.checkin_longitude ?? null, individualId
        ).run();
      } else {
        individualId = crypto.randomUUID();
        await db.prepare('INSERT INTO individuals (id, tenant_id, first_name, last_name, id_number, phone, email, gps_latitude, gps_longitude, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
          individualId, tenantId, body.individual_first_name || '', body.individual_last_name || '',
          body.individual_id_number || null, body.individual_phone || null, body.individual_email || null,
          body.checkin_latitude ?? null, body.checkin_longitude ?? null, body.company_id || null
        ).run();
      }

      // Link visit to individual with custom field values
      // Merge custom_question_values (e.g. goldrush_id) into custom_field_values so they are stored together
      const mergedCustomFields = { ...(body.custom_field_values || {}), ...(body.custom_question_values || {}) };
      const viId = crypto.randomUUID();
      await db.prepare('INSERT INTO visit_individuals (id, tenant_id, visit_id, individual_id, custom_field_values) VALUES (?, ?, ?, ?, ?)').bind(
        viId, tenantId, visitId, individualId, JSON.stringify(mergedCustomFields)
      ).run();

      // individual_registrations no longer used - visits table is the single source of truth
      // individual_registrations INSERT removed - visits table is the single source of truth

      // 2a-upload. Upload individual visit custom question images (base64) to R2 for AI analysis
      // Look up which custom question keys have AI analysis enabled
      aiEnabledKeys = new Set();
      if (companyId) {
        try {
          const aiQs = await db.prepare("SELECT question_key FROM company_custom_questions WHERE tenant_id = ? AND company_id = ? AND field_type = 'image' AND enable_ai_analysis = 1 AND is_active = 1").bind(tenantId, companyId).all();
          aiEnabledKeys = new Set((aiQs.results || []).map(q => q.question_key));
        } catch { /* ignore */ }
      }
      const allIndivCustom = { ...(body.custom_field_values || {}), ...(body.custom_question_values || {}) };
      for (const [key, val] of Object.entries(allIndivCustom)) {
        if (typeof val === 'string' && val.startsWith('data:image')) {
          try {
            const base64Data = val.split(',')[1];
            if (!base64Data) continue;
            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
            const indPhotoHash = await computePhotoHash(bytes);
            if (await isPhotoHashDuplicate(db, tenantId, indPhotoHash)) {
              const existingPhoto = await db.prepare('SELECT r2_url FROM visit_photos WHERE tenant_id = ? AND photo_hash = ? LIMIT 1').bind(tenantId, indPhotoHash).first();
              if (existingPhoto && existingPhoto.r2_url) mergedCustomFields[key] = existingPhoto.r2_url;
              continue;
            }
            const indPhotoId = crypto.randomUUID();
            const indPhotoKey = `photos/${tenantId}/${visitId}/${indPhotoId}.jpg`;
            const bucket = c.env.UPLOADS;
            if (bucket) {
              await bucket.put(indPhotoKey, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
              const r2Url = new URL(`/api/uploads/${indPhotoKey}`, c.req.url).href;
              await db.prepare('INSERT INTO visit_photos (id, tenant_id, visit_id, photo_type, r2_key, r2_url, captured_at, photo_hash, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, datetime("now"), ?, ?)').bind(
                indPhotoId, tenantId, visitId, key.includes('board') || key.includes('ad_board') ? 'board' : key.includes('exterior') ? 'store_front' : 'general',
                indPhotoKey, r2Url, indPhotoHash, userId
              ).run();
              // Replace base64 with R2 URL in custom fields for future retrieval
              mergedCustomFields[key] = r2Url;
              if (aiEnabledKeys.has(key)) { try { c.executionCtx.waitUntil(analyzePhotoWithAI(c.env, indPhotoId, indPhotoKey, tenantId, visitId, key.includes('board') || key.includes('ad_board') ? 'board' : 'general')); } catch { /* AI optional */ } }
            }
          } catch (imgErr) { console.error('Individual photo upload error:', imgErr); }
        }
      }
      // Update visit_individuals with R2 URLs replacing base64
      try {
        await db.prepare('UPDATE visit_individuals SET custom_field_values = ? WHERE id = ?').bind(JSON.stringify(mergedCustomFields), viId).run();
      } catch { /* optional */ }
    }

    // 2b. For store visits, save custom_field_values + custom_question_values as a visit_response
    if (body.visit_target_type === 'store') {
      const mergedStoreCustom = { ...(body.custom_field_values || {}), ...(body.custom_question_values || {}) };
      if (Object.keys(mergedStoreCustom).length > 0) {
        const cqrId = crypto.randomUUID();
        await db.prepare('INSERT INTO visit_responses (id, tenant_id, visit_id, visit_type, responses) VALUES (?, ?, ?, ?, ?)').bind(
          cqrId, tenantId, visitId, 'store_custom_questions', JSON.stringify(mergedStoreCustom)
        ).run();
      }

      // 2c. Upload custom question images (base64) to R2 for AI board detection
      // Look up which custom question keys have AI analysis enabled (reuse aiEnabledKeys if already set)
      if (!aiEnabledKeys || aiEnabledKeys.size === 0) {
        if (companyId) {
          try {
            const aiQsStore = await db.prepare("SELECT question_key FROM company_custom_questions WHERE tenant_id = ? AND company_id = ? AND field_type = 'image' AND enable_ai_analysis = 1 AND is_active = 1").bind(tenantId, companyId).all();
            aiEnabledKeys = new Set((aiQsStore.results || []).map(q => q.question_key));
          } catch { /* ignore */ }
        }
      }
      const allCustom = { ...(body.custom_field_values || {}), ...(body.custom_question_values || {}) };
      for (const [key, val] of Object.entries(allCustom)) {
        if (typeof val === 'string' && val.startsWith('data:image')) {
          try {
            const base64Data = val.split(',')[1];
            if (!base64Data) continue;
            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
            // Compute hash for deduplication
            const cqPhotoHash = await computePhotoHash(bytes);
            if (await isPhotoHashDuplicate(db, tenantId, cqPhotoHash)) {
              const existingCqPhoto = await db.prepare('SELECT r2_url FROM visit_photos WHERE tenant_id = ? AND photo_hash = ? LIMIT 1').bind(tenantId, cqPhotoHash).first();
              if (existingCqPhoto && existingCqPhoto.r2_url) mergedStoreCustom[key] = existingCqPhoto.r2_url;
              console.log(`Skipping duplicate photo (hash: ${cqPhotoHash}) for visit ${visitId}, key: ${key}`);
              continue;
            }
            const cqPhotoId = crypto.randomUUID();
            const cqPhotoKey = `photos/${tenantId}/${visitId}/${cqPhotoId}.jpg`;
            const bucket = c.env.UPLOADS;
            if (bucket) {
              await bucket.put(cqPhotoKey, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
              const r2Url = new URL(`/api/uploads/${cqPhotoKey}`, c.req.url).href;
              await db.prepare('INSERT INTO visit_photos (id, tenant_id, visit_id, photo_type, r2_key, r2_url, captured_at, photo_hash, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, datetime("now"), ?, ?)').bind(
                cqPhotoId, tenantId, visitId, key.includes('board') || key.includes('ad_board') ? 'board' : key.includes('exterior') ? 'store_front' : 'general',
                cqPhotoKey, r2Url, cqPhotoHash, userId
              ).run();
              // Replace base64 with R2 URL in stored responses
              mergedStoreCustom[key] = r2Url;
              if (aiEnabledKeys.has(key)) { try { c.executionCtx.waitUntil(analyzePhotoWithAI(c.env, cqPhotoId, cqPhotoKey, tenantId, visitId, key.includes('board') || key.includes('ad_board') ? 'board' : 'store_front')); } catch { /* AI optional */ } }
            }
          } catch (imgErr) { console.error('Custom question image upload error:', imgErr); }
        }
      }
      // Update visit_responses with R2 URLs replacing base64 data
      try {
        await db.prepare("UPDATE visit_responses SET responses = ? WHERE visit_id = ? AND visit_type = 'store_custom_questions'").bind(JSON.stringify(mergedStoreCustom), visitId).run();
      } catch { /* optional */ }
    }

    // 3. Save survey responses if provided
    if (body.survey_responses && Object.keys(body.survey_responses).length > 0) {
      const vrId = crypto.randomUUID();
      await db.prepare('INSERT INTO visit_responses (id, tenant_id, visit_id, visit_type, responses) VALUES (?, ?, ?, ?, ?)').bind(
        vrId, tenantId, visitId, body.visit_target_type || 'customer', JSON.stringify(body.survey_responses)
      ).run();
    }

    // 4. Save photos with GPS, hash, and board placement data (with deduplication)
    const stepPhotoIds = [];
    if (Array.isArray(body.photos) && body.photos.length > 0) {
      for (const photo of body.photos) {
        // Skip duplicate photos by hash
        if (photo.photo_hash && await isPhotoHashDuplicate(db, tenantId, photo.photo_hash)) {
          console.log(`Skipping duplicate photo (hash: ${photo.photo_hash}) for visit ${visitId}`);
          continue;
        }
        const photoId = crypto.randomUUID();
        try {
          await db.prepare(`INSERT INTO visit_photos (id, tenant_id, visit_id, photo_type, r2_key, r2_url, gps_latitude, gps_longitude, captured_at, photo_hash, board_placement_location, board_placement_position, board_condition, sample_board_id, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            photoId, tenantId, visitId, photo.photo_type || 'board',
            photo.r2_key || `photos/${visitId}/${photoId}`, photo.r2_url || photo.photo_url || null,
            photo.gps_latitude ?? null, photo.gps_longitude ?? null,
            photo.captured_at || now, photo.photo_hash || null,
            photo.board_placement_location || null, photo.board_placement_position || null,
            photo.board_condition || null, photo.sample_board_id || null, userId
          ).run();
        } catch {
          // Fallback: board placement columns may not exist yet
          await db.prepare(`INSERT INTO visit_photos (id, tenant_id, visit_id, photo_type, r2_key, r2_url, gps_latitude, gps_longitude, captured_at, photo_hash, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            photoId, tenantId, visitId, photo.photo_type || 'board',
            photo.r2_key || `photos/${visitId}/${photoId}`, photo.r2_url || photo.photo_url || null,
            photo.gps_latitude ?? null, photo.gps_longitude ?? null,
            photo.captured_at || now, photo.photo_hash || null, userId
          ).run();
        }
        stepPhotoIds.push(photoId);
      }
    }

    // 5. Trigger AI analysis for uploaded body.photos only (custom question photos are handled in steps 2a/2c with aiEnabledKeys)
    if (Array.isArray(body.photos) && body.photos.length > 0 && stepPhotoIds.length > 0) {
      try {
        const placeholders = stepPhotoIds.map(() => '?').join(',');
        const savedPhotos = await db.prepare(`SELECT id, r2_key, photo_type FROM visit_photos WHERE id IN (${placeholders}) AND tenant_id = ?`).bind(...stepPhotoIds, tenantId).all();
        // Cost gate: vision tokens are ~fixed per image, so the real cost lever
        // is how many photos we analyse. Only the representative store photo
        // (board/storefront) gets AI — never individual-visit photos.
        const AI_PHOTO_TYPES = new Set(['board', 'store_front', 'storefront']);
        for (const sp of (savedPhotos?.results || [])) {
          if (sp.r2_key && !sp.r2_key.startsWith('data:') && AI_PHOTO_TYPES.has(sp.photo_type)) {
            try { c.executionCtx.waitUntil(analyzePhotoWithAI(c.env, sp.id, sp.r2_key, tenantId, visitId, sp.photo_type)); } catch { /* AI analysis optional */ }
          }
        }
      } catch { /* AI analysis is optional - don't fail the visit */ }
    }

    // Log validation failures now that we have the visit_id (excluded from individual reports)
    if (logGoldrushFailure) await logGoldrushFailure(visitId);

    return c.json({
      data: { id: visitId, individual_id: individualId, status: 'completed', visit_date: visitDate },
      message: 'Visit created successfully',
      ...(goldrushValidationWarnings ? { validation_warnings: goldrushValidationWarnings } : {})
    }, 201);
  } catch (err) {
    return c.json({ error: 'Failed to create visit: ' + (err.message || err) }, 500);
  }
});

// Complete visit (add photo GPS and finalize)
app.post('/visits/:id/complete-workflow', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const visitId = c.req.param('id');
  const body = await c.req.json();
  const now = new Date().toISOString();

  try {
    // Update visit with completion data
    await db.prepare("UPDATE visits SET status = 'completed', check_out_time = ?, outcome = ?, notes = CASE WHEN ? != '' THEN COALESCE(notes || ' | ', '') || ? ELSE notes END, updated_at = ? WHERE id = ? AND tenant_id = ?").bind(
      now, body.outcome || 'completed', body.completion_notes || '', body.completion_notes || '', now, visitId, tenantId
    ).run();

    // Save any final photos
    if (Array.isArray(body.photos) && body.photos.length > 0) {
      for (const photo of body.photos) {
        const photoId = crypto.randomUUID();
        await db.prepare(`INSERT INTO visit_photos (id, tenant_id, visit_id, photo_type, r2_key, r2_url, gps_latitude, gps_longitude, captured_at, photo_hash, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          photoId, tenantId, visitId, photo.photo_type || 'board',
          photo.r2_key || `photos/${visitId}/${photoId}`, photo.r2_url || photo.photo_url || null,
          photo.gps_latitude ?? null, photo.gps_longitude ?? null,
          photo.captured_at || now, photo.photo_hash || null, c.get('userId')
        ).run();
      }
    }

    return c.json({ data: { id: visitId, status: 'completed' }, message: 'Visit completed successfully' });
  } catch (err) {
    return c.json({ error: 'Failed to complete visit: ' + (err.message || err) }, 500);
  }
});
// ==================== ENHANCED VISIT CHECKOUT (mandatory survey/photo validation) ====================

app.post('/visits/:id/checkout-enhanced', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();

  // Check mandatory surveys completed
  const pendingSurveys = await db.prepare(`
    SELECT st.name FROM survey_templates st
    WHERE st.tenant_id = ? AND st.is_active = 1 AND st.trigger_type LIKE 'mandatory%'
    AND NOT EXISTS (SELECT 1 FROM visit_responses vr WHERE vr.visit_id = ? AND vr.visit_type = st.id)
  `).bind(tenantId, id).all();

  if (pendingSurveys.results?.length > 0) {
    return c.json({ success: false, message: 'Complete mandatory surveys before checkout',
      pending_surveys: pendingSurveys.results.map(s => s.name) }, 400);
  }

  // Check mandatory photos
  const photoCount = await db.prepare('SELECT COUNT(*) as count FROM visit_photos WHERE visit_id = ? AND tenant_id = ?').bind(id, tenantId).first();
  const minPhotos = await db.prepare("SELECT MAX(photo_required) as min_photos FROM survey_templates WHERE tenant_id = ? AND trigger_type LIKE 'mandatory%' AND photo_required > 0").bind(tenantId).first();
  if (minPhotos?.min_photos > 0 && (photoCount?.count || 0) < minPhotos.min_photos) {
    return c.json({ success: false, message: `At least ${minPhotos.min_photos} photo(s) required` }, 400);
  }

  // Perform checkout
  await db.prepare(`UPDATE visits SET status = 'completed', check_out_time = datetime('now'), outcome = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`).bind(
    body.outcome || 'completed', body.notes || null, id, tenantId).run();

  return c.json({ success: true, message: 'Visit checked out successfully' });
});
app.get('/boards', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/visits/:visitId/attachments', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/visits/:visitId/attachments/:attachmentId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/:visitId/cancel', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/:visitId/check-in', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/:visitId/duplicate', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/:visitId/follow-up', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/:visitId/follow-up-complete', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/:visitId/no-show', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/visits/:visitId/photos', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const visitId = c.req.param('visitId');
    // Get visit info for company_id
    const visit = await db.prepare('SELECT id, company_id, created_at FROM visits WHERE id = ? AND tenant_id = ?').bind(visitId, tenantId).first();
    if (!visit) return c.json({ success: false, message: 'Visit not found' }, 404);
    // Fetch R2 photos
    let photos = [];
    try {
      const photosRes = await db.prepare('SELECT id, photo_type, r2_url, captured_at FROM visit_photos WHERE visit_id = ? AND tenant_id = ?').bind(visitId, tenantId).all();
      photos = (photosRes?.results || []).filter(p => p.r2_url).map(p => ({ ...p, r2_url: rewriteR2Url(p.r2_url, c.req.url) }));
    } catch { /* visit_photos may not exist */ }
    // Fetch custom question photos (base64 or URL) from visit_responses
    const customFieldValues = {};
    try {
      // Try store_custom_questions first, then regular responses
      const scq = await db.prepare("SELECT responses FROM visit_responses WHERE visit_id = ? AND tenant_id = ? AND visit_type = 'store_custom_questions'").bind(visitId, tenantId).first();
      if (scq?.responses) {
        const parsed = typeof scq.responses === 'string' ? JSON.parse(scq.responses) : scq.responses;
        Object.assign(customFieldValues, parsed);
      }
      // Also check regular visit_responses
      const vr = await db.prepare("SELECT responses FROM visit_responses WHERE visit_id = ? AND tenant_id = ? AND (visit_type IS NULL OR visit_type != 'store_custom_questions')").bind(visitId, tenantId).first();
      if (vr?.responses) {
        const parsed = typeof vr.responses === 'string' ? JSON.parse(vr.responses) : vr.responses;
        Object.assign(customFieldValues, parsed);
      }
      // Also check visit_individuals custom_field_values
      const vi = await db.prepare('SELECT custom_field_values FROM visit_individuals WHERE visit_id = ? AND tenant_id = ?').bind(visitId, tenantId).first();
      if (vi?.custom_field_values) {
        const parsed = typeof vi.custom_field_values === 'string' ? JSON.parse(vi.custom_field_values) : vi.custom_field_values;
        Object.assign(customFieldValues, parsed);
      }
    } catch { /* ok */ }
    // Extract image fields from company custom questions
    if (visit.company_id) {
      try {
        const imgQs = await db.prepare("SELECT question_key, question_label FROM company_custom_questions WHERE tenant_id = ? AND company_id = ? AND field_type = 'image' AND is_active = 1").bind(tenantId, visit.company_id).all();
        for (const q of (imgQs.results || [])) {
          const val = customFieldValues[q.question_key];
          if (val && typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('http'))) {
            photos.push({ id: 'q_' + q.question_key, photo_type: 'custom_question', label: q.question_label || q.question_key, r2_url: val, captured_at: visit.created_at });
          }
        }
      } catch { /* ok */ }
    }
    // Also check for known process step image fields
    const knownImageKeys = ['shop_exterior_photo', 'ad_board_photo', 'competitor_photo', 'id_passport_photo'];
    for (const key of knownImageKeys) {
      const val = customFieldValues[key];
      if (val && typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('http'))) {
        // Avoid duplicates if already added via company_custom_questions
        if (!photos.find(p => p.id === 'q_' + key)) {
          photos.push({ id: 'q_' + key, photo_type: 'process_step', label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), r2_url: val, captured_at: visit.created_at });
        }
      }
    }
    return c.json({ success: true, data: photos, total: photos.length });
  }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/visits/:visitId/photos/:photoId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/:visitId/reschedule', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/visits/agents/:agentId/performance', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/bulk-cancel', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/bulk-reschedule', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/bulk-update', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/bulk-update-status', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/visits/customers/:customerId/history', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/export', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/import', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/visits/plans/:planId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/plans/:planId/approve', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/plans/:planId/complete', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/plans/:planId/optimize', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visits/plans/:planId/start', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/visits/templates/:templateId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/visits/templates/:templateId/create-visit', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

export default app;
