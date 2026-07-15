import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../lib/middleware.js';
import { canSeeMoney } from '../lib/capabilities.js';
import { v4 as uuidv4 } from 'uuid';
import { resolveReportCompanyId } from '../lib/aggregates.js';
import { extractGoldrushId, goldrushIdExists } from '../lib/goldrush.js';
import { rewriteR2Url, computePhotoHash, isPhotoHashDuplicate, analyzePhotoWithAI, materializeQuestionnairPhoto } from '../lib/photoAi.js';
import { validate } from '../validate.js';
import { defaultDashboardConfig, ensurePortalTables } from '../services/portal.js';
import { agentCount } from '../services/incentiveService.js';
import { scoreAgentDay } from '../services/presenceScore.js';

const app = new Hono();

// admin-equivalent roles (mirrors middleware requireRole): general_manager and
// backoffice_admin inherit every admin-gated route. Inline photo-review guards
// below hardcoded only admin/manager/super_admin, 403'ing GM/BO admin — which
// the global 403 handler bounced to /auth/login and on to the /choose screen.
const isAdminLike = (role) => role === 'admin' || role === 'super_admin' || role === 'general_manager' || role === 'backoffice_admin';

app.get('/areas', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { region_id } = c.req.query();
  let query = 'SELECT a.*, r.name as region_name FROM areas a LEFT JOIN regions r ON a.region_id = r.id WHERE a.tenant_id = ?';
  const params = [tenantId];
  if (region_id) { query += ' AND a.region_id = ?'; params.push(region_id); }
  query += ' ORDER BY a.name';
  const areas = await db.prepare(query).bind(...params).all();
  return c.json({ success: true, data: areas.results || [] });
});

app.post('/areas', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO areas (id, tenant_id, region_id, name, code) VALUES (?, ?, ?, ?, ?)').bind(id, tenantId, body.region_id, body.name, body.code || body.name.slice(0, 5).toUpperCase()).run();
  return c.json({ success: true, data: { id } }, 201);
});
// ==================== FIELD OPERATIONS ROUTES ====================
app.get('/field-operations/agents', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { status, search } = c.req.query();
  let where = "WHERE u.tenant_id = ? AND u.role IN ('agent', 'field_agent', 'sales_rep')";
  const params = [tenantId];
  if (status === 'active') { where += ' AND u.is_active = 1'; }
  if (search) { where += " AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)"; params.push('%' + search + '%', '%' + search + '%', '%' + search + '%'); }
  const agents = await db.prepare("SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.is_active, u.last_login, u.created_at FROM users u " + where + " ORDER BY u.first_name").bind(...params).all();
  return c.json(agents.results || []);
});

app.get('/field-operations/agents/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const agent = await db.prepare("SELECT u.* FROM users u WHERE u.id = ? AND u.tenant_id = ? AND u.role IN ('agent', 'field_agent', 'sales_rep')").bind(id, tenantId).first();
  if (!agent) return c.json({ success: false, message: 'Agent not found' }, 404);
  const visitCount = await db.prepare('SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ?').bind(id, tenantId).first();
  return c.json({ ...agent, total_visits: visitCount?.count || 0 });
});

app.get('/field-operations/visits', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { page = '1', limit = '20', status, agent_id, date, visit_type, company_id } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE v.tenant_id = ?';
  const params = [tenantId];
  if (role === 'agent' || role === 'field_agent' || role === 'sales_rep') {
    // Agents always see only their own visits
    where += ' AND v.agent_id = ?'; params.push(userId);
  } else if (role === 'team_lead') {
    if (agent_id && agent_id !== 'me') {
      // Team lead drilling into a specific agent's visits
      where += ' AND v.agent_id = ?'; params.push(agent_id);
    } else {
      // Team lead overview (agent_id absent or "me"): show all agents assigned to this team lead
      where += ' AND v.agent_id IN (SELECT id FROM users WHERE tenant_id = ? AND team_lead_id = ? AND is_active = 1)';
      params.push(tenantId, userId);
    }
  } else if (agent_id && agent_id !== 'me') {
    // Manager/admin viewing a specific agent
    where += ' AND v.agent_id = ?'; params.push(agent_id);
  }
  if (status) { where += ' AND v.status = ?'; params.push(status); }
  if (date) { where += ' AND v.visit_date = ?'; params.push(date); }
  if (visit_type) { where += ' AND v.visit_type = ?'; params.push(visit_type); }
  if (company_id) { where += ' AND v.company_id = ?'; params.push(company_id); }
  const total = await db.prepare('SELECT COUNT(*) as count FROM visits v ' + where).bind(...params).first();
  let visits;
  try {
    visits = await db.prepare(`
      SELECT v.*,
             c.name as customer_name,
             u.first_name || ' ' || u.last_name as agent_name,
             vp.r2_url as thumbnail_url,
             (
               SELECT COUNT(*)
               FROM visit_photos rp
               WHERE rp.visit_id = v.id
                 AND rp.tenant_id = v.tenant_id
                 AND rp.review_status = 'rejected'
                 AND NOT EXISTS (
                   SELECT 1
                   FROM visit_photos newer
                   WHERE newer.visit_id = rp.visit_id
                     AND newer.tenant_id = rp.tenant_id
                     AND newer.photo_type = rp.photo_type
                     AND newer.review_status = 'pending'
                     AND datetime(newer.created_at) > datetime(rp.created_at)
                 )
             ) as rejected_photo_count
      FROM (SELECT * FROM visits v ${where} ORDER BY v.created_at DESC LIMIT ? OFFSET ?) v
      LEFT JOIN customers c ON v.customer_id = c.id
      LEFT JOIN users u ON v.agent_id = u.id
      LEFT JOIN visit_photos vp ON vp.id = (
        SELECT vp2.id
        FROM visit_photos vp2
        WHERE vp2.visit_id = v.id AND vp2.tenant_id = v.tenant_id AND vp2.r2_url IS NOT NULL
        LIMIT 1
      )
      ORDER BY v.created_at DESC
    `).bind(...params, parseInt(limit), offset).all();
  } catch {
    // Fallback for tenants that have not yet added photo review columns.
    visits = await db.prepare(
      "SELECT v.*, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name, vp.r2_url as thumbnail_url, 0 as rejected_photo_count FROM (SELECT * FROM visits v " + where + " ORDER BY v.created_at DESC LIMIT ? OFFSET ?) v LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id LEFT JOIN visit_photos vp ON vp.id = (SELECT vp2.id FROM visit_photos vp2 WHERE vp2.visit_id = v.id AND vp2.tenant_id = v.tenant_id AND vp2.r2_url IS NOT NULL LIMIT 1) ORDER BY v.created_at DESC"
    ).bind(...params, parseInt(limit), offset).all();
  }
  return c.json({ data: visits.results || [], total: total?.count || 0, page: parseInt(page), limit: parseInt(limit) });
});

app.post('/field-operations/visits/:id/check-in', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const { location } = await c.req.json();
  await db.prepare("UPDATE visits SET status = 'in_progress', check_in_time = CURRENT_TIMESTAMP, latitude = ?, longitude = ? WHERE id = ? AND tenant_id = ?").bind(location?.lat || 0, location?.lng || 0, id, tenantId).run();
  return c.json({ success: true, message: 'Checked in successfully' });
});

app.post('/field-operations/visits/:id/check-out', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const { location, notes } = await c.req.json();
  await db.prepare("UPDATE visits SET status = 'completed', check_out_time = CURRENT_TIMESTAMP, notes = COALESCE(?, notes) WHERE id = ? AND tenant_id = ?").bind(notes || null, id, tenantId).run();
  return c.json({ success: true, message: 'Checked out successfully' });
});

// PUT /field-operations/visits/:id - update visit (mirrors /visits/:id PUT for field-operations namespace)
app.put('/field-operations/visits/:id', authMiddleware, async (c) => {
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
  if (body.custom_field_values && typeof body.custom_field_values === 'object') {
    // Goldrush uniqueness + length on edit/resubmit (exclude this visit's own rows).
    const incomingGoldrush = extractGoldrushId(body.custom_field_values);
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
      const merged = { ...existing, ...body.custom_field_values };
      await db.prepare('UPDATE visit_individuals SET custom_field_values = ? WHERE id = ? AND tenant_id = ?').bind(JSON.stringify(merged), vi.id, tenantId).run();
    }
    // Also update store_custom_questions in visit_responses for store visits (e.g. Goldrush ID on store visits)
    const storeResp = await db.prepare("SELECT id, responses FROM visit_responses WHERE visit_id = ? AND tenant_id = ? AND visit_type = 'store_custom_questions'").bind(id, tenantId).first();
    if (storeResp) {
      let existingStore = {};
      try { existingStore = JSON.parse(storeResp.responses || '{}'); } catch(e) {}
      const mergedStore = { ...existingStore, ...body.custom_field_values };
      await db.prepare("UPDATE visit_responses SET responses = ? WHERE id = ? AND tenant_id = ?").bind(JSON.stringify(mergedStore), storeResp.id, tenantId).run();
    }
  }
  return c.json({ success: true, message: 'Visit updated' });
});

app.get('/field-operations/routes', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const routes = await db.prepare('SELECT * FROM routes WHERE tenant_id = ? ORDER BY name LIMIT 500').bind(tenantId).all();
  return c.json(routes.results || []);
});

app.get('/field-operations/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const today = new Date().toISOString().split('T')[0];
  const [totalAgents, todayVisits, completedVisits, activeAgents] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent')").bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date = ?').bind(tenantId, today).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date = ? AND status = 'completed'").bind(tenantId, today).first(),
    db.prepare("SELECT COUNT(DISTINCT agent_id) as count FROM visits WHERE tenant_id = ? AND visit_date = ?").bind(tenantId, today).first(),
  ]);
  return c.json({ total_agents: totalAgents?.count || 0, today_visits: todayVisits?.count || 0, completed_visits: completedVisits?.count || 0, active_agents: activeAgents?.count || 0 });
});

// ==================== FIELD OPERATIONS: VISITS EXPORT ====================
app.get('/field-operations/visits/export', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { status, agent_id, visit_type, date_from, date_to } = c.req.query();
  
  let where = 'WHERE v.tenant_id = ?';
  const params = [tenantId];
  
  if (status) { where += ' AND v.status = ?'; params.push(status); }
  if (agent_id) { where += ' AND v.agent_id = ?'; params.push(agent_id === 'me' ? c.get('userId') : agent_id); }
  if (visit_type) { where += ' AND v.visit_type = ?'; params.push(visit_type); }
  if (date_from) { where += ' AND v.visit_date >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND v.visit_date <= ?'; params.push(date_to); }
  
  const visits = await db.prepare("SELECT v.id, v.visit_date, v.visit_type, v.status, v.check_in_time, v.check_out_time, v.notes, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name, v.latitude, v.longitude FROM visits v LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id " + where + " ORDER BY v.visit_date DESC").bind(...params).all();
  
  const headers = ['Visit ID', 'Date', 'Type', 'Status', 'Agent', 'Customer', 'Check-in', 'Check-out', 'Notes'];
  const data = (visits.results || []).map(v => [
    v.id,
    v.visit_date,
    v.visit_type || 'N/A',
    v.status,
    v.agent_name || 'N/A',
    v.customer_name || 'N/A',
    v.check_in_time || '-',
    v.check_out_time || '-',
    v.notes || '-'
  ]);
  
  // Build CSV with BOM for Excel compatibility
  const escapeCsv = (val) => { const s = String(val ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
  const csvLines = [
    headers.map(escapeCsv).join(','),
    ...data.map(row => row.map(escapeCsv).join(','))
  ];
  const BOM = '\uFEFF';
  return new Response(BOM + csvLines.join('\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="visits-export-${new Date().toISOString().slice(0, 10)}.csv"` }
  });
});
// ==================== FIELD OPERATIONS ADDITIONAL ROUTES ====================
app.get('/field-operations/live-locations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const locations = await db.prepare("SELECT al.*, u.first_name || ' ' || u.last_name as agent_name FROM agent_locations al JOIN users u ON al.agent_id = u.id WHERE al.tenant_id = ? AND al.recorded_at >= datetime('now', '-1 hour') ORDER BY al.recorded_at DESC").bind(tenantId).all();
  return c.json({ data: locations.results || [] });
});

app.get('/field-operations/beats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const beats = await db.prepare("SELECT * FROM beats WHERE tenant_id = ? ORDER BY name").bind(tenantId).all();
  return c.json({ data: beats.results || [] });
});

app.post('/field-operations/beats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare("INSERT INTO beats (id, tenant_id, name, description, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(id, tenantId, body.name, body.description || '').run();
  return c.json({ id, message: 'Beat created' }, 201);
});

// ==================== FIELD OPERATIONS: COMPANIES ====================
app.get('/field-ops/companies', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');
  try {
    // Scope to companies the user is assigned to. Managers/agents see only their
    // linked companies; admins + GM see all active (org-wide oversight). Mirrors
    // /api/agent/my-companies so pills reflect who-can-manage-what per user.
    let companies;
    if (role === 'admin' || role === 'super_admin' || role === 'general_manager') {
      companies = await db.prepare("SELECT * FROM field_companies WHERE tenant_id = ? AND status = 'active' ORDER BY name").bind(tenantId).all();
    } else if (role === 'manager') {
      companies = await db.prepare("SELECT fc.* FROM manager_company_links mcl JOIN field_companies fc ON mcl.company_id = fc.id WHERE mcl.manager_id = ? AND mcl.tenant_id = ? AND mcl.is_active = 1 AND fc.status = 'active' ORDER BY fc.name").bind(userId, tenantId).all();
    } else if (role === 'team_lead') {
      companies = await db.prepare("SELECT fc.* FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active' ORDER BY fc.name").bind(userId, tenantId).all();
      if (!companies.results || companies.results.length === 0) {
        companies = await db.prepare("SELECT DISTINCT fc.* FROM users u JOIN agent_company_links acl ON acl.agent_id = u.id JOIN field_companies fc ON acl.company_id = fc.id WHERE u.team_lead_id = ? AND u.tenant_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active' ORDER BY fc.name").bind(userId, tenantId, tenantId).all();
      }
    } else {
      companies = await db.prepare("SELECT fc.* FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active' ORDER BY fc.name").bind(userId, tenantId).all();
    }
    return c.json({ data: companies.results || [] });
  } catch {
    return c.json({ data: [] });
  }
});

app.get('/field-ops/companies/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const company = await db.prepare('SELECT * FROM field_companies WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!company) return c.json({ success: false, message: 'Company not found' }, 404);
  const agentCount = await db.prepare('SELECT COUNT(*) as count FROM agent_company_links WHERE company_id = ? AND tenant_id = ? AND is_active = 1').bind(id, tenantId).first();
  return c.json({ ...company, agent_count: agentCount?.count || 0 });
});

app.post('/field-ops/companies', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO field_companies (id, tenant_id, name, code, logo_url, description, contact_email, contact_phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.code || body.name.toUpperCase().replace(/\s+/g, '_'), body.logo_url || null, body.description || null, body.contact_email || null, body.contact_phone || null, 'active').run();
  return c.json({ id, message: 'Company created' }, 201);
});

app.put('/field-ops/companies/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(body)) {
    if (['name', 'code', 'logo_url', 'description', 'contact_email', 'contact_phone', 'status', 'revisit_radius_meters'].includes(k)) { sets.push(k + ' = ?'); vals.push(v); }
  }
  if (sets.length === 0) return c.json({ success: false, message: 'No valid fields' }, 400);
  sets.push('updated_at = CURRENT_TIMESTAMP');
  await db.prepare('UPDATE field_companies SET ' + sets.join(', ') + ' WHERE id = ? AND tenant_id = ?').bind(...vals, id, tenantId).run();
  return c.json({ success: true, message: 'Company updated' });
});

app.delete('/field-ops/companies/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare("UPDATE field_companies SET status = 'inactive' WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Company deactivated' });
});

// ==================== FIELD OPERATIONS: AGENT-COMPANY LINKS ====================
app.get('/field-ops/agent-companies/:agentId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const agentId = c.req.param('agentId');
  try {
    const links = await db.prepare('SELECT acl.*, fc.name as company_name, fc.code as company_code, fc.logo_url FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1').bind(agentId, tenantId).all();
    return c.json({ data: links.results || [] });
  } catch {
    return c.json({ data: [] });
  }
});

app.post('/field-ops/agent-companies', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO agent_company_links (id, agent_id, company_id, tenant_id, is_active) VALUES (?, ?, ?, ?, 1)').bind(id, body.agent_id, body.company_id, tenantId).run();
  return c.json({ id, message: 'Agent linked to company' }, 201);
});

app.delete('/field-ops/agent-companies/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('UPDATE agent_company_links SET is_active = 0 WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Link removed' });
});

// ==================== FIELD OPERATIONS: DAILY TARGETS ====================
app.get('/field-ops/daily-targets', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { agent_id, company_id, date, start_date, end_date } = c.req.query();
  try {
    let where = 'WHERE dt.tenant_id = ?';
    const params = [tenantId];
    if (role === 'agent' || role === 'field_agent') { where += ' AND dt.agent_id = ?'; params.push(userId); }
    else if (agent_id) { where += ' AND dt.agent_id = ?'; params.push(agent_id); }
    if (company_id) { where += ' AND dt.company_id = ?'; params.push(company_id); }
    if (date) { where += ' AND dt.target_date = ?'; params.push(date); }
    if (start_date) { where += ' AND dt.target_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND dt.target_date <= ?'; params.push(end_date); }
    const targets = await db.prepare("SELECT dt.*, u.first_name || ' ' || u.last_name as agent_name, fc.name as company_name FROM daily_targets dt LEFT JOIN users u ON dt.agent_id = u.id LEFT JOIN field_companies fc ON dt.company_id = fc.id " + where + " ORDER BY dt.target_date DESC LIMIT 200").bind(...params).all();
    return c.json({ data: targets.results || [] });
  } catch {
    return c.json({ data: [] });
  }
});

// Targets are set by GM/admin only (admin-equivalents via roleAllows); field roles read-only.
app.post('/field-ops/daily-targets', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO daily_targets (id, tenant_id, agent_id, company_id, target_visits, target_conversions, target_registrations, target_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.agent_id, body.company_id || null, body.target_visits || 20, body.target_conversions || 5, body.target_registrations || body.target_stores || 10, body.target_date, userId).run();
  return c.json({ id, message: 'Daily target created' }, 201);
});

app.put('/field-ops/daily-targets/:id', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(body)) {
    if (['target_visits', 'target_conversions', 'target_registrations', 'target_date', 'agent_id', 'company_id'].includes(k)) { sets.push(k + ' = ?'); vals.push(v); }
  }
  if (sets.length === 0) return c.json({ success: false, message: 'No valid fields' }, 400);
  sets.push('updated_at = CURRENT_TIMESTAMP');
  await db.prepare('UPDATE daily_targets SET ' + sets.join(', ') + ' WHERE id = ? AND tenant_id = ?').bind(...vals, id, tenantId).run();
  return c.json({ success: true, message: 'Target updated' });
});

app.delete('/field-ops/daily-targets/:id', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM daily_targets WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Target deleted' });
});

// Bulk create daily targets for multiple agents
app.post('/field-ops/daily-targets/bulk', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const { agent_ids, company_id, target_visits, target_conversions, target_registrations, target_date } = body;
  if (!agent_ids || !Array.isArray(agent_ids) || agent_ids.length === 0) return c.json({ success: false, message: 'agent_ids required' }, 400);
  const stmts = agent_ids.map(agentId => db.prepare('INSERT INTO daily_targets (id, tenant_id, agent_id, company_id, target_visits, target_conversions, target_registrations, target_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(uuidv4(), tenantId, agentId, company_id || null, target_visits || 20, target_conversions || 5, target_registrations || 10, target_date, userId));
  await db.batch(stmts);
  return c.json({ message: `Created targets for ${agent_ids.length} agents` }, 201);
});

// ==================== FIELD OPERATIONS: COMPANY TARGET RULES ====================
app.get('/field-ops/company-target-rules', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id, role_type } = c.req.query();
  try {
    let query = "SELECT ctr.*, fc.name as company_name, fc.code as company_code FROM company_target_rules ctr JOIN field_companies fc ON ctr.company_id = fc.id WHERE ctr.tenant_id = ?";
    const params = [tenantId];
    if (company_id) { query += ' AND ctr.company_id = ?'; params.push(company_id); }
    if (role_type) { query += ' AND ctr.role_type = ?'; params.push(role_type); }
    query += ' ORDER BY fc.name, ctr.role_type';
    const rules = await db.prepare(query).bind(...params).all();
    return c.json({ data: rules.results || [] });
  } catch {
    return c.json({ data: [] });
  }
});

app.get('/field-ops/company-target-rules/:companyId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.req.param('companyId');
  try {
    const rules = await db.prepare("SELECT ctr.*, fc.name as company_name FROM company_target_rules ctr JOIN field_companies fc ON ctr.company_id = fc.id WHERE ctr.company_id = ? AND ctr.tenant_id = ? ORDER BY ctr.role_type").bind(companyId, tenantId).all();
    // Return all role rules for this company
    return c.json({ data: rules.results || [] });
  } catch {
    return c.json({ data: [] });
  }
});

app.post('/field-ops/company-target-rules', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const { company_id, role_type } = body;
  if (!company_id) return c.json({ success: false, message: 'company_id required' }, 400);
  const rt = role_type || 'agent';
  // Upsert: check if rule already exists for this company + role_type
  const existing = await db.prepare('SELECT id FROM company_target_rules WHERE company_id = ? AND tenant_id = ? AND role_type = ?').bind(company_id, tenantId, rt).first();
  if (existing) {
    await db.prepare(`UPDATE company_target_rules SET 
      individual_target_per_day = ?, individual_target_per_month = ?,
      store_target_per_day = ?, store_target_per_month = ?,
      target_visits_per_day = ?, target_registrations_per_day = ?, target_conversions_per_day = ?,
      team_lead_own_target_visits = ?, team_lead_own_target_registrations = ?, team_lead_own_target_conversions = ?,
      store_target_per_month_tl = ?, store_target_per_month_agent = ?,
      individual_target_per_week_agent = ?, individual_target_per_month_agent = ?,
      tl_target_is_agent_sum = ?, mgr_target_is_tl_sum = ?,
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`).bind(
      body.individual_target_per_day ?? 0, body.individual_target_per_month ?? 0,
      body.store_target_per_day ?? 0, body.store_target_per_month ?? 0,
      body.target_visits_per_day ?? body.individual_target_per_day ?? 0, body.target_registrations_per_day ?? 0, body.target_conversions_per_day ?? 0,
      body.team_lead_own_target_visits ?? 0, body.team_lead_own_target_registrations ?? 0, body.team_lead_own_target_conversions ?? 0,
      body.store_target_per_month_tl ?? body.store_target_per_month ?? null, body.store_target_per_month_agent ?? body.store_target_per_month ?? null,
      body.individual_target_per_week_agent ?? null, body.individual_target_per_month_agent ?? body.individual_target_per_month ?? null,
      body.tl_target_is_agent_sum ?? 1, body.mgr_target_is_tl_sum ?? 1,
      existing.id, tenantId
    ).run();
    return c.json({ success: true, data: { id: existing.id }, message: 'Target rules updated' });
  }
  const id = uuidv4();
  await db.prepare(`INSERT INTO company_target_rules (id, tenant_id, company_id, role_type,
    individual_target_per_day, individual_target_per_month,
    store_target_per_day, store_target_per_month,
    target_visits_per_day, target_registrations_per_day, target_conversions_per_day,
    team_lead_own_target_visits, team_lead_own_target_registrations, team_lead_own_target_conversions,
    store_target_per_month_tl, store_target_per_month_agent,
    individual_target_per_week_agent, individual_target_per_month_agent,
    tl_target_is_agent_sum, mgr_target_is_tl_sum,
    created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, tenantId, company_id, rt,
    body.individual_target_per_day ?? 0, body.individual_target_per_month ?? 0,
    body.store_target_per_day ?? 0, body.store_target_per_month ?? 0,
    body.target_visits_per_day ?? body.individual_target_per_day ?? 0, body.target_registrations_per_day ?? 0, body.target_conversions_per_day ?? 0,
    body.team_lead_own_target_visits ?? 0, body.team_lead_own_target_registrations ?? 0, body.team_lead_own_target_conversions ?? 0,
    body.store_target_per_month_tl ?? body.store_target_per_month ?? null, body.store_target_per_month_agent ?? body.store_target_per_month ?? null,
    body.individual_target_per_week_agent ?? null, body.individual_target_per_month_agent ?? body.individual_target_per_month ?? null,
    body.tl_target_is_agent_sum ?? 1, body.mgr_target_is_tl_sum ?? 1,
    userId
  ).run();
  return c.json({ success: true, data: { id }, message: 'Target rules created' }, 201);
});

app.delete('/field-ops/company-target-rules/:id', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM company_target_rules WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Target rules deleted' });
});

// ── Commission Eligibility Check ──
// Returns whether all levels (agent, team_lead, manager) hit targets for a given date
app.get('/field-ops/commission-eligibility', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { date, company_id, agent_id } = c.req.query();
  const checkDate = date || new Date().toISOString().slice(0, 10);
  try {
    // Get company target rules
    let rulesQuery = "SELECT ctr.*, fc.name as company_name FROM company_target_rules ctr JOIN field_companies fc ON ctr.company_id = fc.id WHERE ctr.tenant_id = ?";
    const rulesParams = [tenantId];
    if (company_id) { rulesQuery += ' AND ctr.company_id = ?'; rulesParams.push(company_id); }
    const rules = await db.prepare(rulesQuery).bind(...rulesParams).all();
    const targetRules = rules.results || [];
    if (targetRules.length === 0) return c.json({ data: { eligible: false, reason: 'No target rules configured', details: [] } });

    const results = [];
    for (const rule of targetRules) {
      // Get agents linked to this company
      let agentsQuery = "SELECT acl.agent_id, u.first_name || ' ' || u.last_name as agent_name, u.role, u.team_lead_id, u.manager_id FROM agent_company_links acl JOIN users u ON acl.agent_id = u.id WHERE acl.company_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND u.is_active = 1";
      const agentsParams = [rule.company_id, tenantId];
      if (agent_id) { agentsQuery += ' AND acl.agent_id = ?'; agentsParams.push(agent_id); }
      const agentsResult = await db.prepare(agentsQuery).bind(...agentsParams).all();
      const agents = agentsResult.results || [];

      for (const agent of agents) {
        // Count agent's visits and registrations for the date
        const [visitCount, regCount, convCount] = await Promise.all([
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date = ?").bind(agent.agent_id, tenantId, checkDate).first(),
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND LOWER(visit_type) = 'store' AND visit_date = ?").bind(agent.agent_id, tenantId, checkDate).first(),
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND LOWER(visit_type) = 'store' AND visit_date = ? AND converted = 1").bind(agent.agent_id, tenantId, checkDate).first(),
        ]);

        const agentHit = (visitCount?.count || 0) >= rule.target_visits_per_day &&
                          (regCount?.count || 0) >= rule.target_registrations_per_day &&
                          (convCount?.count || 0) >= rule.target_conversions_per_day;

        results.push({
          company_id: rule.company_id,
          company_name: rule.company_name,
          agent_id: agent.agent_id,
          agent_name: agent.agent_name,
          role: agent.role,
          targets: {
            visits: { target: rule.target_visits_per_day, actual: visitCount?.count || 0, hit: (visitCount?.count || 0) >= rule.target_visits_per_day },
            registrations: { target: rule.target_registrations_per_day, actual: regCount?.count || 0, hit: (regCount?.count || 0) >= rule.target_registrations_per_day },
            conversions: { target: rule.target_conversions_per_day, actual: convCount?.count || 0, hit: (convCount?.count || 0) >= rule.target_conversions_per_day },
          },
          hit_all: agentHit,
        });
      }
    }

    const allHit = results.length > 0 && results.every(r => r.hit_all);
    return c.json({ data: { eligible: allHit, date: checkDate, details: results } });
  } catch (err) {
    return c.json({ data: { eligible: false, reason: 'Error checking eligibility', error: err.message, details: [] } });
  }
});

// ==================== FIELD OPERATIONS: INDIVIDUAL REGISTRATIONS ====================
app.get('/field-ops/individuals', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { agent_id, company_id, converted, search, page = '1', limit = '50' } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    let where = 'WHERE ir.tenant_id = ?';
    const params = [tenantId];
    if (role === 'agent' || role === 'field_agent') { where += ' AND ir.agent_id = ?'; params.push(userId); }
    else if (agent_id) { where += ' AND ir.agent_id = ?'; params.push(agent_id); }
    if (company_id) { where += ' AND ir.company_id = ?'; params.push(company_id); }
    if (converted === '1' || converted === 'true') { where += ' AND ir.converted = 1'; }
    if (converted === '0' || converted === 'false') { where += ' AND ir.converted = 0'; }
    if (search) { where += " AND (ir.first_name LIKE ? OR ir.last_name LIKE ? OR ir.phone LIKE ? OR ir.id_number LIKE ?)"; params.push('%' + search + '%', '%' + search + '%', '%' + search + '%', '%' + search + '%'); }
    const total = await db.prepare('SELECT COUNT(*) as count FROM visits ir ' + where).bind(...params).first();
    const individuals = await db.prepare("SELECT ir.*, u.first_name || ' ' || u.last_name as agent_name, fc.name as company_name FROM visits ir LEFT JOIN users u ON ir.agent_id = u.id LEFT JOIN field_companies fc ON ir.company_id = fc.id " + where + " ORDER BY ir.created_at DESC LIMIT ? OFFSET ?").bind(...params, parseInt(limit), offset).all();
    return c.json({ data: individuals.results || [], total: total?.count || 0, page: parseInt(page), limit: parseInt(limit) });
  } catch {
    return c.json({ data: [], total: 0, page: 1, limit: 50 });
  }
});

app.get('/field-ops/individuals/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const individual = await db.prepare("SELECT ir.*, u.first_name || ' ' || u.last_name as agent_name, fc.name as company_name FROM visits ir LEFT JOIN users u ON ir.agent_id = u.id LEFT JOIN field_companies fc ON ir.company_id = fc.id WHERE ir.id = ? AND ir.tenant_id = ?").bind(id, tenantId).first();
  if (!individual) return c.json({ success: false, message: 'Individual not found' }, 404);
  return c.json(individual);
});

app.post('/field-ops/individuals/register', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  if (!body.first_name || !body.last_name) return c.json({ success: false, message: 'first_name and last_name required' }, 400);
  const id = uuidv4();
  await db.prepare('INSERT INTO visits (id, tenant_id, agent_id, company_id, visit_type, visit_date, individual_name, individual_surname, individual_id_number, individual_phone, notes, latitude, longitude, status) VALUES (?, ?, ?, ?, \'individual\', date(\'now\'), ?, ?, ?, ?, ?, ?, ?, \'completed\')').bind(id, tenantId, body.agent_id || userId, body.company_id || null, body.first_name, body.last_name, body.id_number || null, body.phone || null, body.notes || null, body.gps_latitude || null, body.gps_longitude || null).run();
  return c.json({ id, message: 'Individual registered' }, 201);
});

app.put('/field-ops/individuals/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(body)) {
    if (['first_name', 'last_name', 'id_number', 'phone', 'email', 'product_app_player_id', 'converted', 'conversion_date', 'notes', 'company_id'].includes(k)) { sets.push(k + ' = ?'); vals.push(k === 'converted' ? (v ? 1 : 0) : v); }
  }
  if (sets.length === 0) return c.json({ success: false, message: 'No valid fields' }, 400);
  sets.push('updated_at = CURRENT_TIMESTAMP');
  await db.prepare('UPDATE visits SET ' + sets.join(', ') + ' WHERE id = ? AND tenant_id = ?').bind(...vals, id, tenantId).run();
  return c.json({ success: true, message: 'Individual updated' });
});

app.post('/field-ops/individuals/:id/convert', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  await db.prepare('UPDATE visits SET outcome = \'converted\', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Individual marked as converted' });
});

// ==================== FIELD OPERATIONS: HIERARCHY ====================
app.get('/field-ops/hierarchy', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  try {
    // Core user queries - filter by agent_type IN ('field_ops', 'both') or NULL (backward compat)
    const [managers, teamLeads, agents] = await Promise.all([
      db.prepare("SELECT id, first_name, last_name, email, phone, role, agent_type, status FROM users WHERE tenant_id = ? AND role = 'manager' AND is_active = 1 AND (agent_type IS NULL OR agent_type IN ('field_ops', 'both')) ORDER BY first_name").bind(tenantId).all(),
      db.prepare("SELECT id, first_name, last_name, email, phone, role, agent_type, manager_id, status FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND (agent_type IS NULL OR agent_type IN ('field_ops', 'both')) ORDER BY first_name").bind(tenantId).all(),
      db.prepare("SELECT id, first_name, last_name, email, phone, role, agent_type, team_lead_id, manager_id, status FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent') AND is_active = 1 AND (agent_type IS NULL OR agent_type IN ('field_ops', 'both')) ORDER BY first_name").bind(tenantId).all(),
    ]);
    // Optional queries - query each separately so one missing table doesn't break the rest
    let mcLinks = [];
    let acLinks = [];
    let companiesList = [];
    // Always fetch companies first (field_companies should always exist)
    try {
      const companies = await db.prepare("SELECT id, name, code FROM field_companies WHERE tenant_id = ? AND status = 'active' ORDER BY name").bind(tenantId).all();
      companiesList = companies.results || [];
    } catch { /* field_companies table may not exist yet */ }
    // Fetch manager company links (table may not exist)
    try {
      const managerCompanyLinks = await db.prepare("SELECT mcl.id, mcl.manager_id, mcl.company_id, fc.name as company_name, fc.code as company_code FROM manager_company_links mcl JOIN field_companies fc ON mcl.company_id = fc.id WHERE mcl.tenant_id = ? AND mcl.is_active = 1").bind(tenantId).all();
      mcLinks = managerCompanyLinks.results || [];
    } catch { /* manager_company_links table may not exist yet */ }
    // Fetch agent company links (table may not exist)
    try {
      const agentCompanyLinks = await db.prepare("SELECT acl.id, acl.agent_id, acl.company_id, fc.name as company_name, fc.code as company_code FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.tenant_id = ? AND acl.is_active = 1").bind(tenantId).all();
      acLinks = agentCompanyLinks.results || [];
    } catch { /* agent_company_links table may not exist yet */ }
    // Helper to get agent/team_lead company links
    const getPersonCompanies = (personId) => acLinks.filter(l => l.agent_id === personId).map(l => ({ id: l.company_id, name: l.company_name, code: l.company_code, link_id: l.id }));
    const hierarchy = (managers.results || []).map(m => ({
      ...m,
      companies: mcLinks.filter(l => l.manager_id === m.id).map(l => ({ id: l.company_id, name: l.company_name, code: l.company_code, link_id: l.id })),
      team_leads: (teamLeads.results || []).filter(tl => tl.manager_id === m.id).map(tl => ({
        ...tl,
        companies: getPersonCompanies(tl.id),
        agents: (agents.results || []).filter(a => a.team_lead_id === tl.id).map(a => ({ ...a, companies: getPersonCompanies(a.id) }))
      }))
    }));
    const unassignedTeamLeads = (teamLeads.results || []).filter(tl => !tl.manager_id).map(tl => ({ ...tl, companies: getPersonCompanies(tl.id) }));
    const unassignedAgents = (agents.results || []).filter(a => !a.team_lead_id).map(a => ({ ...a, companies: getPersonCompanies(a.id) }));
    return c.json({ hierarchy, unassigned_team_leads: unassignedTeamLeads, unassigned_agents: unassignedAgents, all_companies: companiesList, total_managers: (managers.results || []).length, total_team_leads: (teamLeads.results || []).length, total_agents: (agents.results || []).length });
  } catch {
    return c.json({ hierarchy: [], unassigned_team_leads: [], unassigned_agents: [], all_companies: [], total_managers: 0, total_team_leads: 0, total_agents: 0 });
  }
});

app.put('/field-ops/hierarchy/assign', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const { user_id, manager_id, team_lead_id } = body;
  if (!user_id) return c.json({ success: false, message: 'user_id required' }, 400);
  const sets = [];
  const vals = [];
  if (manager_id !== undefined) { sets.push('manager_id = ?'); vals.push(manager_id || null); }
  if (team_lead_id !== undefined) { sets.push('team_lead_id = ?'); vals.push(team_lead_id || null); }
  if (sets.length === 0) return c.json({ success: false, message: 'manager_id or team_lead_id required' }, 400);
  sets.push('updated_at = CURRENT_TIMESTAMP');
  await db.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ? AND tenant_id = ?').bind(...vals, user_id, tenantId).run();
  return c.json({ success: true, message: 'Hierarchy updated' });
});

// ── Manager-Company Links ──
app.get('/field-ops/hierarchy/manager-companies/:managerId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const managerId = c.req.param('managerId');
  const links = await db.prepare("SELECT mcl.id, mcl.company_id, fc.name as company_name, fc.code as company_code, mcl.assigned_at FROM manager_company_links mcl JOIN field_companies fc ON mcl.company_id = fc.id WHERE mcl.manager_id = ? AND mcl.tenant_id = ? AND mcl.is_active = 1 ORDER BY fc.name").bind(managerId, tenantId).all();
  return c.json({ success: true, data: links.results || [] });
});

app.post('/field-ops/hierarchy/manager-companies', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const { manager_id, company_id } = body;
  if (!manager_id || !company_id) return c.json({ success: false, message: 'manager_id and company_id required' }, 400);
  const existing = await db.prepare('SELECT id, is_active FROM manager_company_links WHERE manager_id = ? AND company_id = ? AND tenant_id = ?').bind(manager_id, company_id, tenantId).first();
  if (existing) {
    if (existing.is_active) return c.json({ success: false, message: 'Manager already assigned to this company' }, 409);
    await db.prepare('UPDATE manager_company_links SET is_active = 1, assigned_at = CURRENT_TIMESTAMP WHERE id = ?').bind(existing.id).run();
    return c.json({ success: true, message: 'Manager re-assigned to company' });
  }
  const id = uuidv4();
  await db.prepare('INSERT INTO manager_company_links (id, manager_id, company_id, tenant_id) VALUES (?, ?, ?, ?)').bind(id, manager_id, company_id, tenantId).run();
  return c.json({ success: true, data: { id }, message: 'Manager assigned to company' }, 201);
});

app.delete('/field-ops/hierarchy/manager-companies/:linkId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const linkId = c.req.param('linkId');
  await db.prepare('UPDATE manager_company_links SET is_active = 0 WHERE id = ? AND tenant_id = ?').bind(linkId, tenantId).run();
  return c.json({ success: true, message: 'Manager unassigned from company' });
});


// ==================== FIELD OPS: SETTINGS ====================
app.get('/field-ops/settings', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  try {
    const settings = await db.prepare('SELECT * FROM field_ops_settings WHERE tenant_id = ? ORDER BY setting_key').bind(tenantId).all();
    return c.json({ data: settings.results || [] });
  } catch { return c.json({ data: [] }); }
});

app.put('/field-ops/settings', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const { setting_key, setting_value, description } = body;
  if (!setting_key || setting_value === undefined) return c.json({ success: false, message: 'setting_key and setting_value required' }, 400);
  const existing = await db.prepare('SELECT id FROM field_ops_settings WHERE tenant_id = ? AND setting_key = ?').bind(tenantId, setting_key).first();
  if (existing) {
    await db.prepare('UPDATE field_ops_settings SET setting_value = ?, description = COALESCE(?, description), updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND setting_key = ?').bind(setting_value, description || null, tenantId, setting_key).run();
  } else {
    await db.prepare('INSERT INTO field_ops_settings (id, tenant_id, setting_key, setting_value, description) VALUES (?, ?, ?, ?, ?)').bind(uuidv4(), tenantId, setting_key, setting_value, description || null).run();
  }
  return c.json({ success: true, message: 'Setting saved' });
});

app.post('/field-ops/settings/bulk', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const { settings } = body;
  if (!settings || !Array.isArray(settings)) return c.json({ success: false, message: 'settings array required' }, 400);
  for (const s of settings) {
    const existing = await db.prepare('SELECT id FROM field_ops_settings WHERE tenant_id = ? AND setting_key = ?').bind(tenantId, s.setting_key).first();
    if (existing) {
      await db.prepare('UPDATE field_ops_settings SET setting_value = ?, description = COALESCE(?, description), updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND setting_key = ?').bind(s.setting_value, s.description || null, tenantId, s.setting_key).run();
    } else {
      await db.prepare('INSERT INTO field_ops_settings (id, tenant_id, setting_key, setting_value, description) VALUES (?, ?, ?, ?, ?)').bind(uuidv4(), tenantId, s.setting_key, s.setting_value, s.description || null).run();
    }
  }
  return c.json({ success: true, message: `${settings.length} settings saved` });
});

// ==================== FIELD OPS: WORKING DAYS CONFIG ====================
app.get('/field-ops/working-days', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id, agent_id } = c.req.query();
  try {
    let where = 'WHERE wdc.tenant_id = ?';
    const params = [tenantId];
    if (company_id) { where += ' AND wdc.company_id = ?'; params.push(company_id); }
    if (agent_id) { where += ' AND wdc.agent_id = ?'; params.push(agent_id); }
    const configs = await db.prepare("SELECT wdc.*, fc.name as company_name, u.first_name || ' ' || u.last_name as agent_name FROM working_days_config wdc LEFT JOIN field_companies fc ON wdc.company_id = fc.id LEFT JOIN users u ON wdc.agent_id = u.id " + where + " ORDER BY wdc.created_at DESC").bind(...params).all();
    return c.json({ data: configs.results || [] });
  } catch { return c.json({ data: [] }); }
});

app.post('/field-ops/working-days', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO working_days_config (id, tenant_id, company_id, agent_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, public_holidays, effective_from, effective_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.company_id || null, body.agent_id || null, body.monday ?? 1, body.tuesday ?? 1, body.wednesday ?? 1, body.thursday ?? 1, body.friday ?? 1, body.saturday ?? 0, body.sunday ?? 0, typeof body.public_holidays === 'string' ? body.public_holidays : JSON.stringify(body.public_holidays || []), body.effective_from || null, body.effective_to || null).run();
  return c.json({ id, message: 'Working days config created' }, 201);
});

app.put('/field-ops/working-days/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(body)) {
    if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'company_id', 'agent_id', 'effective_from', 'effective_to'].includes(k)) { sets.push(k + ' = ?'); vals.push(v); }
    if (k === 'public_holidays') { sets.push('public_holidays = ?'); vals.push(typeof v === 'string' ? v : JSON.stringify(v)); }
  }
  if (sets.length === 0) return c.json({ success: false, message: 'No valid fields' }, 400);
  sets.push('updated_at = CURRENT_TIMESTAMP');
  await db.prepare('UPDATE working_days_config SET ' + sets.join(', ') + ' WHERE id = ? AND tenant_id = ?').bind(...vals, id, tenantId).run();
  return c.json({ success: true, message: 'Working days config updated' });
});

app.delete('/field-ops/working-days/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM working_days_config WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Working days config deleted' });
});

// Get effective working days for an agent (resolves: agent override > company config > global default)
app.get('/field-ops/working-days/effective', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { agent_id, company_id, month } = c.req.query();
  try {
    // 1. Check agent-level override
    let config = null;
    if (agent_id) {
      config = await db.prepare('SELECT * FROM working_days_config WHERE tenant_id = ? AND agent_id = ? AND company_id IS NULL ORDER BY created_at DESC LIMIT 1').bind(tenantId, agent_id).first();
      if (!config && company_id) {
        config = await db.prepare('SELECT * FROM working_days_config WHERE tenant_id = ? AND agent_id = ? AND company_id = ? ORDER BY created_at DESC LIMIT 1').bind(tenantId, agent_id, company_id).first();
      }
    }
    // 2. Check company-level config
    if (!config && company_id) {
      config = await db.prepare('SELECT * FROM working_days_config WHERE tenant_id = ? AND company_id = ? AND agent_id IS NULL ORDER BY created_at DESC LIMIT 1').bind(tenantId, company_id).first();
    }
    // 3. Fall back to global default (no company, no agent)
    if (!config) {
      config = await db.prepare('SELECT * FROM working_days_config WHERE tenant_id = ? AND company_id IS NULL AND agent_id IS NULL ORDER BY created_at DESC LIMIT 1').bind(tenantId).first();
    }
    // 4. Hard default
    if (!config) {
      config = { monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 0, sunday: 0, public_holidays: '[]' };
    }
    // Calculate working days count for the given month
    let workingDaysCount = 0;
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const daysInMonth = new Date(year, mon, 0).getDate();
      const holidays = JSON.parse(config.public_holidays || '[]');
      const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, mon - 1, d);
        const dayName = dayMap[date.getDay()];
        const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (config[dayName] && !holidays.includes(dateStr)) workingDaysCount++;
      }
    }
    return c.json({ data: { config, working_days_count: workingDaysCount } });
  } catch { return c.json({ data: { config: { monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 0, sunday: 0 }, working_days_count: 22 } }); }
});

// ==================== FIELD OPS: MONTHLY TARGETS ====================
app.get('/field-ops/monthly-targets', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { agent_id, company_id, target_month } = c.req.query();
  try {
    let where = 'WHERE mt.tenant_id = ?';
    const params = [tenantId];
    if (role === 'agent' || role === 'field_agent' || role === 'sales_rep') { where += ' AND mt.agent_id = ?'; params.push(userId); }
    else if (agent_id) { where += ' AND mt.agent_id = ?'; params.push(agent_id); }
    if (company_id) { where += ' AND mt.company_id = ?'; params.push(company_id); }
    if (target_month) { where += ' AND mt.target_month = ?'; params.push(target_month); }
    const targets = await db.prepare("SELECT mt.*, u.first_name || ' ' || u.last_name as agent_name, fc.name as company_name FROM monthly_targets mt LEFT JOIN users u ON mt.agent_id = u.id LEFT JOIN field_companies fc ON mt.company_id = fc.id " + where + " ORDER BY mt.target_month DESC, u.first_name LIMIT 200").bind(...params).all();
    let rows = targets.results || [];
    // Field roles: other agents' rows are counts only (own row keeps own pay)
    if (!canSeeMoney(role)) {
      rows = rows.map(t => {
        if (t.agent_id === userId) return t;
        const { commission_amount, commission_rate, ...rest } = t;
        return rest;
      });
    }
    return c.json({ data: rows });
  } catch { return c.json({ data: [] }); }
});

app.post('/field-ops/monthly-targets', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  if (!body.agent_id || !body.target_month) return c.json({ success: false, message: 'agent_id and target_month required' }, 400);
  const id = uuidv4();
  await db.prepare('INSERT INTO monthly_targets (id, tenant_id, agent_id, company_id, target_month, target_visits, target_conversions, target_registrations, working_days, commission_rate, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.agent_id, body.company_id || null, body.target_month, body.target_visits || 0, body.target_conversions || 0, body.target_registrations || body.target_stores || 0, body.working_days || 22, body.commission_rate || 0, userId).run();
  return c.json({ id, message: 'Monthly target created' }, 201);
});

app.put('/field-ops/monthly-targets/:id', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(body)) {
    if (['target_visits', 'target_conversions', 'target_registrations', 'working_days', 'actual_visits', 'actual_conversions', 'actual_registrations', 'commission_rate', 'commission_amount', 'status', 'agent_id', 'company_id', 'target_month'].includes(k)) { sets.push(k + ' = ?'); vals.push(v); }
  }
  if (sets.length === 0) return c.json({ success: false, message: 'No valid fields' }, 400);
  sets.push('updated_at = CURRENT_TIMESTAMP');
  await db.prepare('UPDATE monthly_targets SET ' + sets.join(', ') + ' WHERE id = ? AND tenant_id = ?').bind(...vals, id, tenantId).run();
  return c.json({ success: true, message: 'Monthly target updated' });
});

app.delete('/field-ops/monthly-targets/:id', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM monthly_targets WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Monthly target deleted' });
});

// Recalculate actuals for a monthly target (counts visits/regs/conversions for the month)
app.post('/field-ops/monthly-targets/:id/recalculate', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  try {
    const target = await db.prepare('SELECT * FROM monthly_targets WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
    if (!target) return c.json({ success: false, message: 'Target not found' }, 404);
    const startDate = target.target_month + '-01';
    const [year, mon] = target.target_month.split('-').map(Number);
    const endDate = `${year}-${String(mon).padStart(2, '0')}-${new Date(year, mon, 0).getDate()}`;
    let companyFilter = '';
    const baseParams = [target.agent_id, tenantId, startDate, endDate];
    if (target.company_id) { companyFilter = ' AND company_id = ?'; }
    const visits = await db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date >= ? AND visit_date <= ?" + (target.company_id ? " AND v.company_id = ?" : '')).bind(...baseParams, ...(target.company_id ? [target.company_id] : [])).first();
    const regs = await db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND LOWER(visit_type) = 'store' AND visit_date >= ? AND created_at <= ?" + (target.company_id ? " AND v.company_id = ?" : '')).bind(target.agent_id, tenantId, startDate, endDate, ...(target.company_id ? [target.company_id] : [])).first();
    const convs = await db.prepare("SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.agent_id = ? AND v.tenant_id = ? AND (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') AND v.visit_date >= ? AND v.visit_date <= ?" + (target.company_id ? " AND v.company_id = ?" : '')).bind(target.agent_id, tenantId, startDate, endDate, ...(target.company_id ? [target.company_id] : [])).first();
    await db.prepare('UPDATE monthly_targets SET actual_visits = ?, actual_conversions = ?, actual_registrations = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(visits?.count || 0, convs?.count || 0, regs?.count || 0, id).run();
    // Calculate commission based on achievement
    const achievementPct = target.target_visits > 0 ? ((visits?.count || 0) / target.target_visits) * 100 : 0;
    const tier = await db.prepare('SELECT * FROM target_commission_tiers WHERE tenant_id = ? AND is_active = 1 AND min_achievement_pct <= ? AND (max_achievement_pct IS NULL OR max_achievement_pct >= ?) AND (company_id IS NULL OR company_id = ?) AND metric_type = ? ORDER BY min_achievement_pct DESC LIMIT 1').bind(tenantId, achievementPct, achievementPct, target.company_id || '', 'visits').first();
    let commissionAmount = 0;
    if (tier) {
      commissionAmount = ((visits?.count || 0) * tier.commission_rate) + (tier.bonus_amount || 0);
      await db.prepare('UPDATE monthly_targets SET commission_rate = ?, commission_amount = ? WHERE id = ?').bind(tier.commission_rate, commissionAmount, id).run();
    }
    return c.json({ success: true, actual_visits: visits?.count || 0, actual_registrations: regs?.count || 0, actual_conversions: convs?.count || 0, achievement_pct: achievementPct, commission_amount: commissionAmount });
  } catch (e) { return c.json({ success: false, message: e.message || 'Recalculation failed' }, 500); }
});

// ==================== FIELD OPS: TARGET COMMISSION TIERS ====================
app.get('/field-ops/commission-tiers', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id } = c.req.query();
  try {
    let where = 'WHERE tct.tenant_id = ?';
    const params = [tenantId];
    if (company_id) { where += ' AND (tct.company_id = ? OR tct.company_id IS NULL)'; params.push(company_id); }
    const tiers = await db.prepare("SELECT tct.*, fc.name as company_name FROM target_commission_tiers tct LEFT JOIN field_companies fc ON tct.company_id = fc.id " + where + " ORDER BY tct.metric_type, tct.min_achievement_pct ASC").bind(...params).all();
    return c.json({ data: tiers.results || [] });
  } catch { return c.json({ data: [] }); }
});

app.post('/field-ops/commission-tiers', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  if (!body.tier_name || body.min_achievement_pct === undefined || body.commission_rate === undefined) return c.json({ success: false, message: 'tier_name, min_achievement_pct, commission_rate required' }, 400);
  const id = uuidv4();
  await db.prepare('INSERT INTO target_commission_tiers (id, tenant_id, company_id, tier_name, min_achievement_pct, max_achievement_pct, commission_rate, bonus_amount, metric_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.company_id || null, body.tier_name, body.min_achievement_pct, body.max_achievement_pct || null, body.commission_rate, body.bonus_amount || 0, body.metric_type || 'visits').run();
  return c.json({ id, message: 'Commission tier created' }, 201);
});

app.put('/field-ops/commission-tiers/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(body)) {
    if (['tier_name', 'min_achievement_pct', 'max_achievement_pct', 'commission_rate', 'bonus_amount', 'metric_type', 'company_id', 'is_active'].includes(k)) { sets.push(k + ' = ?'); vals.push(v); }
  }
  if (sets.length === 0) return c.json({ success: false, message: 'No valid fields' }, 400);
  sets.push('updated_at = CURRENT_TIMESTAMP');
  await db.prepare('UPDATE target_commission_tiers SET ' + sets.join(', ') + ' WHERE id = ? AND tenant_id = ?').bind(...vals, id, tenantId).run();
  return c.json({ success: true, message: 'Commission tier updated' });
});

app.delete('/field-ops/commission-tiers/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM target_commission_tiers WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Commission tier deleted' });
});
app.get('/visit-survey-config', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id } = c.req.query();
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];
  if (company_id) { where += ' AND company_id = ?'; params.push(company_id); }
  const rows = await db.prepare(`SELECT * FROM visit_survey_config ${where}`).bind(...params).all();
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({ data: rows?.results || [] });
});

app.post('/visit-survey-config', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO visit_survey_config (id, tenant_id, company_id, visit_target_type, survey_required, questionnaire_id) VALUES (?, ?, ?, ?, ?, ?)').bind(
    id, tenantId, body.company_id, body.visit_target_type || 'store', body.survey_required ? 1 : 0, body.questionnaire_id || null
  ).run();
  return c.json({ data: { id, ...body }, message: 'Survey config created' }, 201);
});

app.put('/visit-survey-config/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const existing = await db.prepare('SELECT id FROM visit_survey_config WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!existing) return c.json({ success: false, message: 'Config not found' }, 404);
  await db.prepare('UPDATE visit_survey_config SET visit_target_type = COALESCE(?, visit_target_type), survey_required = COALESCE(?, survey_required), questionnaire_id = COALESCE(?, questionnaire_id), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?').bind(
    body.visit_target_type || null, body.survey_required !== undefined ? (body.survey_required ? 1 : 0) : null, body.questionnaire_id || null, id, tenantId
  ).run();
  return c.json({ success: true, message: 'Survey config updated' });
});

app.delete('/visit-survey-config/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM visit_survey_config WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Survey config deleted' });
});
app.get('/visit-process-flow', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id, visit_target_type } = c.req.query();
  try {
    let flow = null;
    // 1. Check if company has a specific process flow assigned
    if (company_id) {
      const cpf = await db.prepare(
        "SELECT cpf.process_flow_id FROM company_process_flows cpf WHERE cpf.tenant_id = ? AND cpf.company_id = ? AND (cpf.visit_target_type = ? OR cpf.visit_target_type = 'both') LIMIT 1"
      ).bind(tenantId, company_id, visit_target_type || 'both').first();
      if (cpf) {
        flow = await db.prepare("SELECT * FROM process_flows WHERE id = ? AND is_active = 1").bind(cpf.process_flow_id).first();
      }
    }
    // 2. Fall back to tenant default
    if (!flow) {
      flow = await db.prepare("SELECT * FROM process_flows WHERE tenant_id = ? AND is_default = 1 AND is_active = 1 LIMIT 1").bind(tenantId).first();
    }
    // 3. Fall back to system default based on visit type
    if (!flow) {
      const defaultId = visit_target_type === 'store' ? 'pf-store-default' : 'pf-individual-default';
      flow = await db.prepare("SELECT * FROM process_flows WHERE id = ? AND is_active = 1").bind(defaultId).first();
    }
    if (!flow) return c.json({ data: null, steps: [] });
    const steps = await db.prepare("SELECT * FROM process_flow_steps WHERE process_flow_id = ? AND tenant_id IN (?, 'default') AND is_active = 1 ORDER BY step_order").bind(flow.id, tenantId).all();
    // Deduplicate steps by step_key (prefer tenant-specific over default, keep lowest step_order per key)
    const allSteps = steps?.results || [];
    const seen = new Map();
    for (const s of allSteps) {
      if (!seen.has(s.step_key) || (s.tenant_id !== 'default' && seen.get(s.step_key).tenant_id === 'default')) {
        seen.set(s.step_key, s);
      }
    }
    const dedupedSteps = Array.from(seen.values()).sort((a, b) => a.step_order - b.step_order);
    return c.json({ data: { ...flow, steps: dedupedSteps } });
  } catch (err) { return c.json({ error: 'Failed to get visit process flow: ' + (err.message || err) }, 500); }
});
app.get('/field-ops/survey-insights', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id, start_date, end_date } = c.req.query();
  let dateFilter = '';
  const params = [tenantId];
  if (start_date) { dateFilter += ' AND vr.created_at >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND vr.created_at <= ?'; params.push(end_date + 'T23:59:59'); }

  // Total surveys and responses
  const [totalSurveys, totalResponses, surveyConfigs] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM questionnaires WHERE tenant_id = ? AND is_active = 1').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM visit_responses WHERE tenant_id = ?' + dateFilter.replace(/vr\./g, '')).bind(...params).first(),
    db.prepare('SELECT vsc.*, fc.name as company_name, q.name as survey_name FROM visit_survey_config vsc LEFT JOIN field_companies fc ON vsc.company_id = fc.id LEFT JOIN questionnaires q ON vsc.questionnaire_id = q.id WHERE vsc.tenant_id = ?' + (company_id ? ' AND vsc.company_id = ?' : '')).bind(...(company_id ? [tenantId, company_id] : [tenantId])).all()
  ]);

  // Responses per survey
  const responsesPerSurvey = await db.prepare('SELECT vr.visit_type, q.name as survey_name, COUNT(*) as response_count FROM visit_responses vr LEFT JOIN questionnaires q ON vr.visit_type = q.id WHERE vr.tenant_id = ?' + dateFilter + ' GROUP BY vr.visit_type ORDER BY response_count DESC LIMIT 20').bind(...params).all();

  // Responses per agent
  const responsesPerAgent = await db.prepare("SELECT v.agent_id, u.first_name || ' ' || u.last_name as agent_name, COUNT(*) as response_count FROM visit_responses vr LEFT JOIN visits v ON vr.visit_id = v.id LEFT JOIN users u ON v.agent_id = u.id WHERE vr.tenant_id = ?" + dateFilter + ' GROUP BY v.agent_id ORDER BY response_count DESC LIMIT 20').bind(...params).all();

  // Monthly trend
  const monthlyTrend = await db.prepare("SELECT strftime('%Y-%m', vr.created_at) as month, COUNT(*) as count FROM visit_responses vr WHERE vr.tenant_id = ? GROUP BY month ORDER BY month DESC LIMIT 12").bind(tenantId).all();

  return c.json({
    success: true,
    data: {
      total_active_surveys: totalSurveys?.count || 0,
      total_responses: totalResponses?.count || 0,
      survey_configs: surveyConfigs.results || [],
      responses_per_survey: responsesPerSurvey.results || [],
      responses_per_agent: responsesPerAgent.results || [],
      monthly_trend: monthlyTrend.results || [],
      companies_with_mandatory_surveys: (surveyConfigs.results || []).filter(c => c.survey_required).length
    }
  });
});
// ==================== FIELD AGENTS ROUTE ====================
app.get('/field-agents', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const agents = await db.prepare("SELECT id, first_name, last_name, email, phone, role, is_active FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent', 'sales_rep') ORDER BY first_name").bind(tenantId).all();
  return c.json({ data: agents.results || [] });
});
app.get('/territories', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const territories = await db.prepare("SELECT t.*, (SELECT COUNT(*) FROM territory_assignments WHERE territory_id = t.id) as assigned_agents FROM territories t WHERE t.tenant_id = ? ORDER BY t.name").bind(tenantId).all();
  return c.json({ success: true, data: territories.results || [] });
});

app.post('/territories', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO territories (id, tenant_id, name, code, boundary, parent_id) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.code || body.name?.substring(0, 10)?.toUpperCase() || '', body.boundary_geojson ? JSON.stringify(body.boundary_geojson) : body.boundary || null, body.parent_territory_id || body.parent_id || null).run();
  return c.json({ success: true, data: { id }, message: 'Territory created' }, 201);
});

app.put('/territories/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE territories SET name = COALESCE(?, name), boundary = COALESCE(?, boundary), parent_id = COALESCE(?, parent_id) WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.boundary_geojson ? JSON.stringify(body.boundary_geojson) : body.boundary || null, body.parent_territory_id || body.parent_id || null, id, tenantId).run();
  return c.json({ success: true, message: 'Territory updated' });
});

// Territory Assignment
app.post('/territories/:id/assign', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  const aId = uuidv4();
  await db.prepare('INSERT INTO territory_assignments (id, territory_id, agent_id, is_primary, is_active) VALUES (?, ?, ?, ?, ?)').bind(aId, id, body.agent_id, body.is_primary ? 1 : 0, 1).run();
  return c.json({ success: true, data: { id: aId }, message: 'Agent assigned to territory' }, 201);
});

app.delete('/territories/:id/unassign/:agentId', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const { id, agentId } = c.req.param();
  await db.prepare('DELETE FROM territory_assignments WHERE territory_id = ? AND agent_id = ?').bind(id, agentId).run();
  return c.json({ success: true, message: 'Agent unassigned' });
});

// L.2 Route Planning

// L.3 Visit Activities
app.post('/visit-activities', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const id = uuidv4();
  await db.prepare('INSERT INTO visit_activities (id, tenant_id, visit_id, activity_type, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.visit_id, body.activity_type, body.reference_type || null, body.reference_id || null, body.description || body.notes || null).run();

  return c.json({ success: true, data: { id }, message: 'Activity recorded' }, 201);
});

app.get('/visit-activities', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { visit_id } = c.req.query();
  let q = 'SELECT * FROM visit_activities WHERE tenant_id = ?';
  const params = [tenantId];
  if (visit_id) { q += ' AND visit_id = ?'; params.push(visit_id); }
  q += ' ORDER BY created_at DESC';
  const activities = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: activities.results || [] });
});

// L.4 Competitor Sightings

// L.5 GPS Compliance
app.post('/gps/validate', async (c) => {
  const body = await c.req.json();
  const { agent_lat, agent_lng, customer_lat, customer_lng, max_distance_meters = 200 } = body;

  // Haversine formula
  const R = 6371e3; // Earth radius in meters
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(customer_lat - agent_lat);
  const dLng = toRad(customer_lng - agent_lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(agent_lat)) * Math.cos(toRad(customer_lat)) * Math.sin(dLng / 2) ** 2;
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return c.json({ success: true, data: { distance_meters: Math.round(distance), within_range: distance <= max_distance_meters, max_allowed: max_distance_meters } });
});
app.post('/visit-photos/upload', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const formData = await c.req.formData();
    const photo = formData.get('photo');
    const thumbnail = formData.get('thumbnail');
    const visitId = formData.get('visit_id');
    const photoType = formData.get('photo_type') || 'general';
    const replacePhotoId = formData.get('replace_photo_id');
    const latitude = formData.get('latitude');
    const longitude = formData.get('longitude');
    const boardPlacementLocation = formData.get('board_placement_location') || null;
    const boardPlacementPosition = formData.get('board_placement_position') || null;
    const boardCondition = formData.get('board_condition') || null;
    const sampleBoardId = formData.get('sample_board_id') || null;
    const photoHash = formData.get('photo_hash') || null;

    if (!photo || !visitId) return c.json({ success: false, message: 'photo and visit_id required' }, 400);

    // Check for duplicate photo by hash BEFORE uploading to R2 (avoids orphaned R2 objects)
    if (photoHash) {
      const isDup = await isPhotoHashDuplicate(db, tenantId, photoHash);
      if (isDup) {
        return c.json({ success: false, message: 'Duplicate photo detected. This photo has already been uploaded.', is_duplicate: true }, 409);
      }
    }

    const bucket = c.env.UPLOADS;

    // On re-upload for a specific rejected photo id, delete exactly that rejected photo first
    if (replacePhotoId && typeof replacePhotoId === 'string') {
      try {
        const targetRejected = await db.prepare(
          "SELECT id, r2_key, thumbnail_r2_key FROM visit_photos WHERE id = ? AND visit_id = ? AND tenant_id = ? AND review_status = 'rejected' LIMIT 1"
        ).bind(replacePhotoId, visitId, tenantId).first();
        if (targetRejected) {
          if (bucket) {
            if (targetRejected.r2_key) bucket.delete(targetRejected.r2_key).catch(() => {});
            if (targetRejected.thumbnail_r2_key) bucket.delete(targetRejected.thumbnail_r2_key).catch(() => {});
          }
          await db.prepare('DELETE FROM visit_photos WHERE id = ? AND tenant_id = ?').bind(targetRejected.id, tenantId).run();
        }
      } catch { /* non-fatal */ }
    }

    // On generic re-upload: delete all existing rejected photos of the same type so only the new one remains
    try {
      const rejectedRows = await db.prepare(
        "SELECT id, r2_key, thumbnail_r2_key FROM visit_photos WHERE visit_id = ? AND tenant_id = ? AND photo_type = ? AND review_status = 'rejected'"
      ).bind(visitId, tenantId, photoType).all();
      const rejectedPhotos = rejectedRows.results || [];
      for (const rejected of rejectedPhotos) {
        if (bucket) {
          if (rejected.r2_key) bucket.delete(rejected.r2_key).catch(() => {});
          if (rejected.thumbnail_r2_key) bucket.delete(rejected.thumbnail_r2_key).catch(() => {});
        }
        await db.prepare('DELETE FROM visit_photos WHERE id = ? AND tenant_id = ?').bind(rejected.id, tenantId).run();
      }
    } catch { /* non-fatal */ }

    const id = crypto.randomUUID();
    const photoKey = `photos/${tenantId}/${visitId}/${id}.jpg`;
    const thumbKey = `thumbnails/${tenantId}/${visitId}/${id}_thumb.jpg`;
    const reqUrl = new URL(c.req.url);
    const photoUrl = `${reqUrl.protocol}//${reqUrl.host}/api/uploads/${photoKey}`;
    const thumbnailUrl = thumbnail ? `${reqUrl.protocol}//${reqUrl.host}/api/uploads/${thumbKey}` : null;

    // Upload to R2 if bucket is available
    if (bucket) {
      try {
        await bucket.put(photoKey, photo.stream(), { httpMetadata: { contentType: 'image/jpeg' } });
        if (thumbnail) await bucket.put(thumbKey, thumbnail.stream(), { httpMetadata: { contentType: 'image/jpeg' } });
      } catch (uploadErr) {
        console.error('R2 upload error (continuing with DB record):', uploadErr);
      }
    }

    // Insert into visit_photos - try with all columns including board placement, fallback to minimal
    try {
      await db.prepare(`INSERT INTO visit_photos (id, tenant_id, visit_id, photo_type, r2_key, thumbnail_r2_key, r2_url, thumbnail_url,
        original_size_bytes, compressed_size_bytes, gps_latitude, gps_longitude, captured_at, uploaded_by,
        ai_analysis_status, photo_hash, board_placement_location, board_placement_position, board_condition, sample_board_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 'pending', ?, ?, ?, ?, ?)`).bind(
        id, tenantId, visitId, photoType, photoKey, thumbnail ? thumbKey : null, photoUrl, thumbnailUrl,
        parseInt(formData.get('original_size') || '0'), photo.size,
        latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, userId,
        photoHash, boardPlacementLocation, boardPlacementPosition, boardCondition, sampleBoardId
      ).run();
    } catch {
      // Fallback: minimal columns if some don't exist in the schema yet
      await db.prepare(`INSERT INTO visit_photos (id, tenant_id, visit_id, photo_type, r2_key, r2_url, gps_latitude, gps_longitude, captured_at, photo_hash, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)`).bind(
        id, tenantId, visitId, photoType, photoKey, photoUrl,
        latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, photoHash, userId
      ).run();
    }

    if (bucket) {
      try { c.executionCtx.waitUntil(analyzePhotoWithAI(c.env, id, photoKey, tenantId, visitId, photoType)); } catch { /* AI analysis optional */ }
    }

    return c.json({ success: true, data: { id, r2_key: photoKey, thumbnail_key: thumbKey, r2_url: photoUrl, thumbnail_url: thumbnailUrl, review_status: 'pending' } }, 201);
  } catch (e) { console.error('Photo upload error:', e); return c.json({ success: false, message: 'Upload failed: ' + (e.message || e) }, 500); }
});

// Get visit photos
app.get('/visit-photos', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { visit_id, photo_type, ai_status, page = 1, limit = 50 } = c.req.query();
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];
  if (visit_id) { where += ' AND visit_id = ?'; params.push(visit_id); }
  if (photo_type) { where += ' AND photo_type = ?'; params.push(photo_type); }
  if (ai_status) { where += ' AND ai_analysis_status = ?'; params.push(ai_status); }
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const photos = await db.prepare(`SELECT * FROM visit_photos ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...params, parseInt(limit), offset).all();
  const countR = await db.prepare(`SELECT COUNT(*) as total FROM visit_photos ${where}`).bind(...params).first();
  return c.json({ success: true, data: { photos: photos.results || [], pagination: { total: countR?.total || 0, page: parseInt(page), limit: parseInt(limit) } } });
});

// Re-trigger AI analysis
app.post('/visit-photos/:id/reanalyze', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const photo = await db.prepare('SELECT * FROM visit_photos WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!photo) return c.json({ success: false, message: 'Photo not found' }, 404);
  await db.prepare("UPDATE visit_photos SET ai_analysis_status = 'processing' WHERE id = ?").bind(id).run();
  c.executionCtx.waitUntil(analyzePhotoWithAI(c.env, id, photo.r2_key, tenantId, photo.visit_id, photo.photo_type));
  return c.json({ success: true, message: 'Re-analysis triggered' });
});




// ── Admin Photo Review: list all visits with photos for review ──
app.get('/visit-photos/admin-review', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const role = c.get('role');
    if (!isAdminLike(role) && role !== 'manager') {
      return c.json({ success: false, message: 'Admin or manager access required' }, 403);
    }
    const { agent_id, store_name, review_status, page = '1', limit = '50' } = c.req.query();
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const reqUrl = c.req.url;

    // Ensure required columns exist (idempotent — silently skips if already present)
    await Promise.all([
      db.prepare("ALTER TABLE visit_photos ADD COLUMN review_status TEXT DEFAULT 'pending'").run().catch(() => {}),
      db.prepare("ALTER TABLE visit_photos ADD COLUMN rejection_reason TEXT").run().catch(() => {}),
      db.prepare("ALTER TABLE visit_photos ADD COLUMN reviewed_by TEXT").run().catch(() => {}),
      db.prepare("ALTER TABLE visit_photos ADD COLUMN reviewed_at TEXT").run().catch(() => {}),
      db.prepare("ALTER TABLE visits ADD COLUMN visit_target_type TEXT").run().catch(() => {}),
    ]);

    // ── Query 1: proper visit_photos records ──
    let where = 'WHERE vp.tenant_id = ?';
    const params = [tenantId];
    if (agent_id) { where += ' AND v.agent_id = ?'; params.push(agent_id); }
    if (store_name) { where += ' AND (c.name LIKE ? OR v.individual_name LIKE ?)'; params.push('%' + store_name + '%', '%' + store_name + '%'); }
    if (review_status) { where += ' AND vp.review_status = ?'; params.push(review_status); }
    const vpRows = await db.prepare(`
      SELECT vp.id, vp.visit_id, vp.photo_type, vp.r2_key, vp.r2_url, vp.review_status, vp.rejection_reason, vp.reviewed_by, vp.reviewed_at,
             vp.ai_analysis_status, vp.ai_labels, vp.created_at as photo_uploaded_at,
             v.visit_date, v.visit_type, COALESCE(v.visit_target_type, 'store') as visit_target_type, v.status as visit_status,
             u.first_name || ' ' || u.last_name as agent_name, v.agent_id,
             c.name as store_name, v.individual_name, v.individual_surname
      FROM visit_photos vp
      CROSS JOIN visits v ON vp.visit_id = v.id AND vp.tenant_id = v.tenant_id
      LEFT JOIN users u ON v.agent_id = u.id
      LEFT JOIN customers c ON v.customer_id = c.id
      ${where}
      ORDER BY vp.created_at DESC
      LIMIT 2000
    `).bind(...params).all();

    // ── Query 2: questionnaire photos from visit_responses not yet in visit_photos ──
    // Only pull visits that have no visit_photos records at all (avoids duplicates after migration)
    let vrWhere = 'WHERE vr.tenant_id = ?';
    const vrParams = [tenantId];
    if (agent_id) { vrWhere += ' AND v.agent_id = ?'; vrParams.push(agent_id); }
    if (store_name) { vrWhere += ' AND (c.name LIKE ? OR v.individual_name LIKE ?)'; vrParams.push('%' + store_name + '%', '%' + store_name + '%'); }
    // review_status filter: questionnaire photos are always 'pending' — skip if filtering for approved/rejected
    // CROSS JOIN pins visit_responses as the outer table — letting the planner scan
    // 43k visits (fat photo_base64 blobs) outer kills the D1 CPU budget. Q2 is
    // best-effort legacy backfill; if it still exceeds CPU, return Q1 results alone.
    let vrRows = { results: [] };
    if (!review_status || review_status === 'pending') {
      try {
        vrRows = await db.prepare(`
      SELECT vr.id, vr.visit_id, vr.responses, vr.created_at,
             v.visit_date, v.visit_type, COALESCE(v.visit_target_type, 'store') as visit_target_type, v.status as visit_status,
             u.first_name || ' ' || u.last_name as agent_name, v.agent_id,
             c.name as store_name, v.individual_name, v.individual_surname
      FROM visit_responses vr
      CROSS JOIN visits v ON vr.visit_id = v.id AND vr.tenant_id = v.tenant_id
      LEFT JOIN users u ON v.agent_id = u.id
      LEFT JOIN customers c ON v.customer_id = c.id
      ${vrWhere}
      AND NOT EXISTS (SELECT 1 FROM visit_photos vp2 WHERE vp2.visit_id = vr.visit_id AND vp2.tenant_id = vr.tenant_id)
      AND (
        (vr.responses LIKE '%shop_exterior_photo%' AND vr.responses NOT LIKE '%shop_exterior_photo":""%' AND vr.responses NOT LIKE '%shop_exterior_photo":null%')
        OR (vr.responses LIKE '%ad_board_photo%' AND vr.responses NOT LIKE '%ad_board_photo":""%' AND vr.responses NOT LIKE '%ad_board_photo":null%')
        OR (vr.responses LIKE '%competitor_photo%' AND vr.responses NOT LIKE '%competitor_photo":""%' AND vr.responses NOT LIKE '%competitor_photo":null%')
      )
      ORDER BY vr.created_at DESC
      LIMIT 500
    `).bind(...vrParams).all();
      } catch { vrRows = { results: [] }; }
    }

    // Expand visit_responses rows into individual photo records
    const vrPhotoRows = [];
    const photoTypeMap = {
      shop_exterior_photo: 'store_front',
      ad_board_photo: 'board',
      competitor_photo: 'competitor',
    };
    for (const row of (vrRows.results || [])) {
      let responses = {};
      try { responses = typeof row.responses === 'string' ? JSON.parse(row.responses) : (row.responses || {}); } catch { continue; }
      for (const [field, photoType] of Object.entries(photoTypeMap)) {
        const url = responses[field];
        if (url && typeof url === 'string' && url.startsWith('http')) {
          vrPhotoRows.push({
            id: row.id + '_' + field,
            visit_id: row.visit_id,
            photo_type: photoType,
            r2_key: null,
            r2_url: rewriteR2Url(url, reqUrl),
            review_status: 'pending',
            rejection_reason: null,
            reviewed_by: null,
            reviewed_at: null,
            ai_analysis_status: null,
            ai_labels: null,
            photo_uploaded_at: row.created_at,
            visit_date: row.visit_date,
            visit_type: row.visit_type,
            visit_target_type: row.visit_target_type,
            visit_status: row.visit_status,
            agent_name: row.agent_name,
            agent_id: row.agent_id,
            store_name: row.store_name,
            individual_name: row.individual_name,
            individual_surname: row.individual_surname,
          });
        }
      }
    }

    // Merge, sort by date desc, paginate
    const vpMapped = (vpRows.results || []).map(p => ({ ...p, r2_url: p.r2_url ? rewriteR2Url(p.r2_url, reqUrl) : null }));
    const allPhotos = [...vpMapped, ...vrPhotoRows].sort((a, b) => (b.photo_uploaded_at || '').localeCompare(a.photo_uploaded_at || ''));
    const total = allPhotos.length;
    const paginated = allPhotos.slice(offset, offset + limitNum);

    // Attach goldrush_id per photo. Lives in visit_individuals.custom_field_values
    // (dynamic custom-field key), so no fixed JSON_EXTRACT path works — pull the raw
    // JSON and extract JS-side. Look up only the paginated visit_ids (≤ limit rows),
    // not a JOIN on the full set — a JOIN fans out multi-individual visits into
    // duplicate photo rows. ponytail: first non-empty id per visit; a multi-individual
    // store visit shows one — fine for a review label, revisit if per-individual needed.
    const visitIds = [...new Set(paginated.map(p => p.visit_id).filter(Boolean))];
    const goldrushByVisit = {};
    if (visitIds.length) {
      const placeholders = visitIds.map(() => '?').join(',');
      const giRows = await db.prepare(
        `SELECT visit_id, custom_field_values FROM visit_individuals WHERE tenant_id = ? AND visit_id IN (${placeholders})`
      ).bind(tenantId, ...visitIds).all();
      for (const row of (giRows.results || [])) {
        if (goldrushByVisit[row.visit_id]) continue;
        let parsed = {};
        try { parsed = JSON.parse(row.custom_field_values || '{}'); } catch { parsed = {}; }
        const gid = extractGoldrushId(parsed);
        if (gid) goldrushByVisit[row.visit_id] = gid;
      }
    }
    for (const p of paginated) { p.goldrush_id = goldrushByVisit[p.visit_id] || null; }

    // Agents dropdown: union of agents from both sources
    const agentMap = new Map();
    for (const p of allPhotos) {
      if (p.agent_id && p.agent_name) agentMap.set(p.agent_id, p.agent_name);
    }
    const agents = [...agentMap.entries()].map(([agent_id, agent_name]) => ({ agent_id, agent_name })).sort((a, b) => a.agent_name.localeCompare(b.agent_name));

    return c.json({
      success: true,
      data: { photos: paginated, agents, pagination: { total, page: pageNum, limit: limitNum } }
    });
  } catch (e) { console.error('Admin photo review error:', e); return c.json({ success: false, message: e.message }, 500); }
});

// ── Reject a photo (admin) ──
app.post('/visit-photos/:id/reject', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const role = c.get('role');
    if (!isAdminLike(role) && role !== 'manager') {
      return c.json({ success: false, message: 'Admin or manager access required' }, 403);
    }
    let { id } = c.req.param();
    const body = await c.req.json().catch(() => ({}));
    const reason = body.reason || 'Photo rejected by admin';
    // If synthetic id, materialise into visit_photos first
    if (!await db.prepare('SELECT id FROM visit_photos WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first()) {
      const realId = await materializeQuestionnairPhoto(db, id, tenantId, userId);
      if (!realId) return c.json({ success: false, message: 'Photo not found' }, 404);
      id = realId;
    }
    await db.prepare("UPDATE visit_photos SET review_status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? AND tenant_id = ?")
      .bind(reason, userId, id, tenantId).run();
    return c.json({ success: true, message: 'Photo rejected', data: { id, review_status: 'rejected', rejection_reason: reason } });
  } catch (e) { console.error('Photo reject error:', e); return c.json({ success: false, message: e.message }, 500); }
});

// ── Approve a photo (admin) ──
app.post('/visit-photos/:id/approve', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const role = c.get('role');
    if (!isAdminLike(role) && role !== 'manager') {
      return c.json({ success: false, message: 'Admin or manager access required' }, 403);
    }
    let { id } = c.req.param();
    // If synthetic id, materialise into visit_photos first
    if (!await db.prepare('SELECT id FROM visit_photos WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first()) {
      const realId = await materializeQuestionnairPhoto(db, id, tenantId, userId);
      if (!realId) return c.json({ success: false, message: 'Photo not found' }, 404);
      id = realId;
    }
    await db.prepare("UPDATE visit_photos SET review_status = 'approved', rejection_reason = NULL, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? AND tenant_id = ?")
      .bind(userId, id, tenantId).run();
    return c.json({ success: true, message: 'Photo approved', data: { id, review_status: 'approved' } });
  } catch (e) { console.error('Photo approve error:', e); return c.json({ success: false, message: e.message }, 500); }
});

// ── Get visits with missing/rejected photos (for agent re-upload) ──
app.get('/visit-photos/needs-reupload', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const role = c.get('role');
    let agentFilter = '';
    const params = [tenantId];
    if (role === 'agent' || role === 'field_agent') {
      agentFilter = ' AND v.agent_id = ?';
      params.push(userId);
    }
    let rejectedVisits = [];
    try {
      // Drive from visit_photos (small table) instead of scanning all visits per run.
      const res = await db.prepare(`
        SELECT v.id, v.visit_date, v.visit_type, v.visit_target_type, v.status,
               c.name as store_name, v.individual_name, v.individual_surname,
               u.first_name || ' ' || u.last_name as agent_name,
               rej.rejected_count
        FROM (
          SELECT vp.visit_id, COUNT(*) as rejected_count
          FROM visit_photos vp
          WHERE vp.tenant_id = ?
            AND vp.review_status = 'rejected'
            AND NOT EXISTS (
              SELECT 1
              FROM visit_photos newer
              WHERE newer.visit_id = vp.visit_id
                AND newer.tenant_id = vp.tenant_id
                AND newer.photo_type = vp.photo_type
                AND newer.review_status = 'pending'
                AND datetime(newer.created_at) > datetime(vp.created_at)
            )
          GROUP BY vp.visit_id
        ) rej
        CROSS JOIN visits v ON v.id = rej.visit_id
        LEFT JOIN customers c ON v.customer_id = c.id
        LEFT JOIN users u ON v.agent_id = u.id
        WHERE v.tenant_id = ? ${agentFilter}
        ORDER BY v.visit_date DESC
        LIMIT 100
      `).bind(tenantId, ...params).all();
      rejectedVisits = res.results || [];
    } catch { /* review_status column may not exist */ }
    return c.json({ success: true, data: rejectedVisits });
  } catch (e) { console.error('Needs reupload error:', e); return c.json({ success: false, message: e.message }, 500); }
});

// ── Delete a rejected photo (allows agent to re-upload) ──
app.delete('/visit-photos/:id', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const role = c.get('role');
    const { id } = c.req.param();
    let photo;
    try {
      photo = await db.prepare('SELECT id, visit_id, r2_key, thumbnail_r2_key, review_status FROM visit_photos WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
    } catch {
      photo = await db.prepare('SELECT id, visit_id, r2_key, NULL as thumbnail_r2_key, review_status FROM visit_photos WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
    }
    if (!photo) return c.json({ success: false, message: 'Photo not found' }, 404);
    if (role === 'agent' || role === 'field_agent') {
      const visit = await db.prepare('SELECT agent_id FROM visits WHERE id = ? AND tenant_id = ?').bind(photo.visit_id, tenantId).first();
      if (!visit || visit.agent_id !== userId) return c.json({ success: false, message: 'Not authorized' }, 403);
      if (photo.review_status !== 'rejected') return c.json({ success: false, message: 'Only rejected photos can be deleted for re-upload' }, 403);
    }
    if (c.env.UPLOADS && photo.r2_key) {
      try { await c.env.UPLOADS.delete(photo.r2_key); } catch { /* ok */ }
    }
    if (c.env.UPLOADS && photo.thumbnail_r2_key) {
      try { await c.env.UPLOADS.delete(photo.thumbnail_r2_key); } catch { /* ok */ }
    }
    await db.prepare('DELETE FROM visit_photos WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
    return c.json({ success: true, message: 'Photo deleted' });
  } catch (e) { console.error('Photo delete error:', e); return c.json({ success: false, message: e.message }, 500); }
});

// ── Run migration to add review columns to visit_photos ──
app.post('/visit-photos/add-review-columns', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const role = c.get('role');
    if (!isAdminLike(role)) return c.json({ success: false, message: 'Admin access required' }, 403);
    const results = [];
    for (const col of [
      "ALTER TABLE visit_photos ADD COLUMN review_status TEXT DEFAULT 'pending'",
      "ALTER TABLE visit_photos ADD COLUMN rejection_reason TEXT",
      "ALTER TABLE visit_photos ADD COLUMN reviewed_by TEXT",
      "ALTER TABLE visit_photos ADD COLUMN reviewed_at TEXT"
    ]) {
      try { await db.prepare(col).run(); results.push(col.split('ADD COLUMN ')[1].split(' ')[0] + ' added'); } catch { results.push(col.split('ADD COLUMN ')[1].split(' ')[0] + ' already exists'); }
    }
    try { await db.prepare("CREATE INDEX IF NOT EXISTS idx_photos_review ON visit_photos(review_status)").run(); results.push('index created'); } catch { results.push('index already exists'); }
    return c.json({ success: true, data: results });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
// Migrate historical base64 photos from visit_responses to R2
app.post('/visit-photos/migrate-base64', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const role = c.get('role');
    if (!isAdminLike(role) && role !== 'manager') return c.json({ success: false, message: 'Admin or manager access required' }, 403);
    const bucket = c.env.UPLOADS;
    if (!bucket) return c.json({ success: false, message: 'R2 bucket not configured' }, 500);

    const { limit: batchLimit } = c.req.query();
    const maxBatch = Math.min(parseInt(batchLimit) || 5, 10);
    let migrated = 0;
    let skipped = 0;
    const errors = [];

    // Step 1: Fetch only IDs of rows with base64 images (lightweight query — avoids D1 size limits)
    const responseIds = await db.prepare(
      "SELECT id, visit_id, visit_type FROM visit_responses WHERE tenant_id = ? AND responses LIKE '%data:image%' ORDER BY id LIMIT ?"
    ).bind(tenantId, maxBatch).all();

    const indivIds = await db.prepare(
      "SELECT id, visit_id, 'individual_custom' as visit_type FROM visit_individuals WHERE tenant_id = ? AND custom_field_values LIKE '%data:image%' ORDER BY id LIMIT ?"
    ).bind(tenantId, maxBatch).all();

    const allIds = [...(responseIds.results || []), ...(indivIds.results || [])];

    // Step 2: Process each row individually (fetch full data one at a time)
    for (const rowMeta of allIds) {
      try {
        let fullRow;
        if (rowMeta.visit_type === 'individual_custom') {
          fullRow = await db.prepare("SELECT id, visit_id, custom_field_values as responses FROM visit_individuals WHERE id = ?").bind(rowMeta.id).first();
        } else {
          fullRow = await db.prepare("SELECT id, visit_id, visit_type, responses FROM visit_responses WHERE id = ?").bind(rowMeta.id).first();
        }
        if (!fullRow || !fullRow.responses) { errors.push('Row ' + rowMeta.id + ': no data'); continue; }

        // Look up the visit's agent_id to use as uploaded_by (FK constraint requires valid user ID)
        const visitRow = await db.prepare("SELECT agent_id FROM visits WHERE id = ?").bind(rowMeta.visit_id).first();
        const uploadedBy = (visitRow && visitRow.agent_id) || c.get('userId');

        const data = typeof fullRow.responses === 'string' ? JSON.parse(fullRow.responses) : fullRow.responses;
        let updated = false;

        for (const [key, val] of Object.entries(data)) {
          if (typeof val === 'string' && val.startsWith('data:image')) {
            try {
              const base64Data = val.split(',')[1];
              if (!base64Data) { errors.push('Row ' + rowMeta.id + ' key ' + key + ': no base64 after comma'); continue; }

              const binaryStr = atob(base64Data);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

              const photoHash = await computePhotoHash(bytes);
              if (await isPhotoHashDuplicate(db, tenantId, photoHash)) {
                const existing = await db.prepare("SELECT r2_url FROM visit_photos WHERE tenant_id = ? AND photo_hash = ? LIMIT 1").bind(tenantId, photoHash).first();
                if (existing && existing.r2_url) {
                  data[key] = existing.r2_url;
                  updated = true;
                }
                skipped++;
                continue;
              }

              const photoId = crypto.randomUUID();
              const photoKey = 'photos/' + tenantId + '/' + rowMeta.visit_id + '/' + photoId + '.jpg';
              await bucket.put(photoKey, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
              const r2Url = new URL('/api/uploads/' + photoKey, c.req.url).href;

              await db.prepare('INSERT INTO visit_photos (id, tenant_id, visit_id, photo_type, r2_key, r2_url, captured_at, photo_hash, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, datetime("now"), ?, ?)').bind(
                photoId, tenantId, rowMeta.visit_id,
                key.includes('board') || key.includes('ad_board') ? 'board' : key.includes('exterior') ? 'store_front' : 'general',
                photoKey, r2Url, photoHash, uploadedBy
              ).run();

              data[key] = r2Url;
              updated = true;
              migrated++;

              try { c.executionCtx.waitUntil(analyzePhotoWithAI(c.env, photoId, photoKey, tenantId, rowMeta.visit_id, key.includes('board') || key.includes('ad_board') ? 'board' : 'general')); } catch { /* AI optional */ }
            } catch (imgErr) { errors.push('Row ' + rowMeta.id + ' key ' + key + ': ' + (imgErr.message || imgErr)); }
          }
        }

        if (updated) {
          if (rowMeta.visit_type === 'individual_custom') {
            await db.prepare('UPDATE visit_individuals SET custom_field_values = ? WHERE id = ?').bind(JSON.stringify(data), rowMeta.id).run();
          } else {
            await db.prepare('UPDATE visit_responses SET responses = ? WHERE id = ?').bind(JSON.stringify(data), rowMeta.id).run();
          }
        }
      } catch (rowErr) { errors.push('Row ' + rowMeta.id + ': ' + (rowErr.message || rowErr)); }
    }

    const remaining = await db.prepare(
      "SELECT COUNT(*) as count FROM visit_responses WHERE tenant_id = ? AND responses LIKE '%data:image%'"
    ).bind(tenantId).first();
    const remainingIndiv = await db.prepare(
      "SELECT COUNT(*) as count FROM visit_individuals WHERE tenant_id = ? AND custom_field_values LIKE '%data:image%'"
    ).bind(tenantId).first();

    return c.json({
      success: true,
      message: 'Migrated ' + migrated + ' photos to R2 (' + skipped + ' duplicates skipped)',
      migrated,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      total_remaining: (remaining?.count || 0) + (remainingIndiv?.count || 0)
    });
  } catch (e) {
    console.error('Base64 migration error:', e);
    return c.json({ success: false, message: 'Migration failed: ' + (e.message || e) }, 500);
  }
});

// Fix old bad R2 URLs in visit_photos table (one-time migration)
app.post('/visit-photos/fix-urls', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const role = c.get('role');
    if (!isAdminLike(role) && role !== 'manager') return c.json({ success: false, message: 'Admin or manager access required' }, 403);
    const reqUrl = c.req.url;
    // Fix visit_photos.r2_url entries with old format
    const badPhotos = await db.prepare("SELECT id, r2_url, r2_key FROM visit_photos WHERE tenant_id = ? AND r2_url LIKE '%fieldvibe-uploads%r2.dev%' LIMIT 200").bind(tenantId).all();
    let fixed = 0;
    for (const p of (badPhotos.results || [])) {
      const newUrl = rewriteR2Url(p.r2_url, reqUrl);
      if (newUrl !== p.r2_url) {
        await db.prepare("UPDATE visit_photos SET r2_url = ? WHERE id = ? AND tenant_id = ?").bind(newUrl, p.id, tenantId).run();
        fixed++;
      }
    }
    // Also fix visit_responses that have old R2 URLs embedded in JSON
    const badResponses = await db.prepare("SELECT id, responses FROM visit_responses WHERE tenant_id = ? AND responses LIKE '%fieldvibe-uploads%r2.dev%' LIMIT 200").bind(tenantId).all();
    let fixedResponses = 0;
    for (const r of (badResponses.results || [])) {
      try {
        let resp = r.responses;
        if (typeof resp === 'string' && resp.includes('fieldvibe-uploads')) {
          resp = resp.replace(/https?:\/\/fieldvibe-uploads\.[^/]+\.r2\.dev\//g, (match) => {
            return new URL('/api/uploads/', reqUrl).href;
          });
          await db.prepare("UPDATE visit_responses SET responses = ? WHERE id = ?").bind(resp, r.id).run();
          fixedResponses++;
        }
      } catch {}
    }
    // Also fix visit_individuals.custom_field_values
    const badIndiv = await db.prepare("SELECT id, custom_field_values FROM visit_individuals WHERE tenant_id = ? AND custom_field_values LIKE '%fieldvibe-uploads%r2.dev%' LIMIT 200").bind(tenantId).all();
    let fixedIndiv = 0;
    for (const vi of (badIndiv.results || [])) {
      try {
        let vals = vi.custom_field_values;
        if (typeof vals === 'string' && vals.includes('fieldvibe-uploads')) {
          vals = vals.replace(/https?:\/\/fieldvibe-uploads\.[^/]+\.r2\.dev\//g, (match) => {
            return new URL('/api/uploads/', reqUrl).href;
          });
          await db.prepare("UPDATE visit_individuals SET custom_field_values = ? WHERE id = ?").bind(vals, vi.id).run();
          fixedIndiv++;
        }
      } catch {}
    }
    const remaining = await db.prepare("SELECT COUNT(*) as cnt FROM visit_photos WHERE tenant_id = ? AND r2_url LIKE '%fieldvibe-uploads%r2.dev%'").bind(tenantId).first();
    return c.json({ success: true, message: 'Fixed ' + fixed + ' photo URLs, ' + fixedResponses + ' response URLs, ' + fixedIndiv + ' individual URLs', fixed, fixedResponses, fixedIndiv, remaining: remaining?.cnt || 0 });
  } catch (e) {
    return c.json({ success: false, message: 'Fix failed: ' + (e.message || e) }, 500);
  }
});

// Batch AI analysis for historical/unanalyzed photos
app.post('/visit-photos/ai-backfill', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const role = c.get('role');
    if (!isAdminLike(role) && role !== 'manager') return c.json({ success: false, message: 'Admin or manager access required' }, 403);

    const { limit: batchLimit, photo_type: filterPhotoType, visit_id: filterVisitId } = c.req.query();
    const maxBatch = Math.min(parseInt(batchLimit) || 20, 50); // Max 50 per batch to avoid Worker timeout

    let query = `SELECT vp.id, vp.r2_key, vp.tenant_id, vp.visit_id, vp.photo_type, vp.photo_hash
      FROM visit_photos vp
      WHERE vp.tenant_id = ?
        AND vp.r2_key IS NOT NULL
        AND (vp.ai_analysis_status IS NULL OR vp.ai_analysis_status = '' OR vp.ai_analysis_status = 'pending' OR vp.ai_analysis_status = 'skipped')
        AND NOT EXISTS (
          SELECT 1 FROM visit_photos vp2
          WHERE vp2.tenant_id = vp.tenant_id
            AND vp2.photo_hash = vp.photo_hash
            AND vp2.photo_hash IS NOT NULL
            AND vp2.photo_hash != ''
            AND vp2.ai_analysis_status = 'completed'
            AND vp2.id != vp.id
        )`;
    const params = [tenantId];

    if (filterPhotoType) { query += ' AND vp.photo_type = ?'; params.push(filterPhotoType); }
    if (filterVisitId) { query += ' AND vp.visit_id = ?'; params.push(filterVisitId); }
    query += ' ORDER BY vp.created_at DESC LIMIT ?';
    params.push(maxBatch);

    const photos = await db.prepare(query).bind(...params).all();
    const toProcess = photos.results || [];

    if (toProcess.length === 0) {
      return c.json({ success: true, message: 'No unanalyzed photos found', processed: 0, total_pending: 0 });
    }

    // Count total pending for progress info
    const pendingCount = await db.prepare(
      `SELECT COUNT(*) as count FROM visit_photos WHERE tenant_id = ? AND r2_key IS NOT NULL AND (ai_analysis_status IS NULL OR ai_analysis_status = '' OR ai_analysis_status = 'pending' OR ai_analysis_status = 'skipped')`
    ).bind(tenantId).first();

    // Mark all as processing
    for (const photo of toProcess) {
      await db.prepare("UPDATE visit_photos SET ai_analysis_status = 'processing' WHERE id = ?").bind(photo.id).run();
    }

    // Trigger AI analysis for each photo using waitUntil (non-blocking)
    for (const photo of toProcess) {
      try {
        c.executionCtx.waitUntil(analyzePhotoWithAI(c.env, photo.id, photo.r2_key, photo.tenant_id, photo.visit_id, photo.photo_type || 'general'));
      } catch { /* AI analysis optional */ }
    }

    return c.json({
      success: true,
      message: `AI analysis triggered for ${toProcess.length} photos`,
      processed: toProcess.length,
      total_pending: (pendingCount?.count || 0) - toProcess.length,
      photo_ids: toProcess.map(p => p.id)
    });
  } catch (e) {
    console.error('AI backfill error:', e);
    return c.json({ success: false, message: 'Backfill failed: ' + (e.message || e) }, 500);
  }
});

// Get AI analysis status/progress
app.get('/visit-photos/ai-status', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');

    const [total, completed, processing, failed, pending] = await Promise.all([
      db.prepare("SELECT COUNT(*) as count FROM visit_photos WHERE tenant_id = ? AND r2_key IS NOT NULL").bind(tenantId).first(),
      db.prepare("SELECT COUNT(*) as count FROM visit_photos WHERE tenant_id = ? AND ai_analysis_status = 'completed'").bind(tenantId).first(),
      db.prepare("SELECT COUNT(*) as count FROM visit_photos WHERE tenant_id = ? AND ai_analysis_status = 'processing'").bind(tenantId).first(),
      db.prepare("SELECT COUNT(*) as count FROM visit_photos WHERE tenant_id = ? AND ai_analysis_status = 'failed'").bind(tenantId).first(),
      db.prepare("SELECT COUNT(*) as count FROM visit_photos WHERE tenant_id = ? AND r2_key IS NOT NULL AND (ai_analysis_status IS NULL OR ai_analysis_status = '' OR ai_analysis_status = 'pending' OR ai_analysis_status = 'skipped')").bind(tenantId).first(),
    ]);

    return c.json({
      success: true,
      data: {
        total_photos: total?.count || 0,
        completed: completed?.count || 0,
        processing: processing?.count || 0,
        failed: failed?.count || 0,
        pending: pending?.count || 0,
        progress_pct: total?.count > 0 ? Math.round(((completed?.count || 0) / total.count) * 1000) / 10 : 0
      }
    });
  } catch (e) {
    return c.json({ success: false, message: e.message }, 500);
  }
});

// Get single photo — must be after all static /visit-photos/* routes to avoid /:id swallowing them
app.get('/visit-photos/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const photo = await db.prepare('SELECT * FROM visit_photos WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!photo) return c.json({ success: false, message: 'Photo not found' }, 404);
  return c.json({ success: true, data: photo });
});
app.get('/field-operations/dashboard', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [totalAgents, todayVisits, completedVisits, activeRoutes] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role = 'agent'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND date(created_at) = date('now')").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND date(created_at) = date('now') AND status = 'completed'").bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM routes WHERE tenant_id = ?').bind(tenantId).first(),
  ]);
  return c.json({ success: true, data: { total_agents: totalAgents?.count || 0, today_visits: todayVisits?.count || 0, completed_visits: completedVisits?.count || 0, active_routes: activeRoutes?.count || 0 } });
});

// Field ops visits, dashboard, team-performance, agent-performance
app.get('/field-ops/visits', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { page = '1', limit = '50', status, agent_id } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE v.tenant_id = ?';
  const params = [tenantId];
  if (status) { where += ' AND v.status = ?'; params.push(status); }
  if (agent_id) { where += ' AND v.agent_id = ?'; params.push(agent_id); }
  const visits = await db.prepare("SELECT v.*, u.first_name || ' ' || u.last_name as agent_name, c.name as customer_name FROM visits v LEFT JOIN users u ON v.agent_id = u.id LEFT JOIN customers c ON v.customer_id = c.id " + where + ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?').bind(...params, parseInt(limit), offset).all();
  return c.json({ success: true, data: visits.results || [] });
});

app.get('/field-ops/dashboard', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [agents, todayVisits, monthVisits, completionRate] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role = 'agent'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND date(created_at) = date('now')").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(CAST(COUNT(CASE WHEN status = 'completed' THEN 1 END) AS FLOAT) / COUNT(*) * 100, 1) ELSE 0 END as rate FROM visits WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
  ]);
  return c.json({ success: true, data: { agents: agents?.count || 0, today_visits: todayVisits?.count || 0, month_visits: monthVisits?.count || 0, completion_rate: completionRate?.rate || 0 } });
});

app.get('/field-ops/team-performance', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const teams = await db.prepare("SELECT m.id as manager_id, m.first_name || ' ' || m.last_name as manager_name, COUNT(DISTINCT u.id) as team_size, (SELECT COUNT(*) FROM visits WHERE agent_id IN (SELECT id FROM users WHERE manager_id = m.id AND tenant_id = ?) AND created_at >= datetime('now', '-30 days')) as total_visits, (SELECT COUNT(*) FROM sales_orders WHERE agent_id IN (SELECT id FROM users WHERE manager_id = m.id AND tenant_id = ?) AND created_at >= datetime('now', '-30 days')) as total_orders FROM users m JOIN users u ON u.manager_id = m.id WHERE m.tenant_id = ? AND m.role IN ('manager', 'team_lead') GROUP BY m.id ORDER BY total_visits DESC").bind(tenantId, tenantId, tenantId).all();
  return c.json({ success: true, data: teams.results || [] });
});

app.get('/field-ops/agent-performance', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const agents = await db.prepare("SELECT u.id, u.first_name || ' ' || u.last_name as name, u.role, (SELECT COUNT(*) FROM visits WHERE agent_id = u.id AND created_at >= datetime('now', '-30 days')) as visits, (SELECT COUNT(*) FROM visits WHERE agent_id = u.id AND status = 'completed' AND created_at >= datetime('now', '-30 days')) as completed_visits, (SELECT COUNT(*) FROM sales_orders WHERE agent_id = u.id AND created_at >= datetime('now', '-30 days')) as orders, (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE agent_id = u.id AND status != 'CANCELLED' AND created_at >= datetime('now', '-30 days')) as revenue FROM users u WHERE u.tenant_id = ? AND u.role = 'agent' ORDER BY revenue DESC").bind(tenantId).all();
  let rows = agents.results || [];
  // Field roles see counts only — per-agent rand revenue is admin/GM data
  if (!canSeeMoney(c.get('role'))) rows = rows.map(({ revenue, ...rest }) => rest);
  return c.json({ success: true, data: rows });
});
app.get('/agents', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const agents = await db.prepare("SELECT id, first_name, last_name, email, phone, role, status, created_at FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent') ORDER BY first_name").bind(tenantId).all();
  return c.json({ success: true, data: agents.results || [] });
});


app.get('/team-hierarchy', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [managers, teamLeads, agents] = await Promise.all([
    db.prepare("SELECT id, first_name, last_name, email, role FROM users WHERE tenant_id = ? AND role = 'manager' ORDER BY first_name").bind(tenantId).all(),
    db.prepare("SELECT id, first_name, last_name, email, role, manager_id FROM users WHERE tenant_id = ? AND role = 'team_lead' ORDER BY first_name").bind(tenantId).all(),
    db.prepare("SELECT id, first_name, last_name, email, role, manager_id FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent') ORDER BY first_name").bind(tenantId).all(),
  ]);
  return c.json({ success: true, data: { managers: managers.results || [], team_leads: teamLeads.results || [], agents: agents.results || [] } });
});




app.post('/gps-location/log', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO agent_locations (id, tenant_id, agent_id, latitude, longitude, accuracy, recorded_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))').bind(id, tenantId, userId, body.latitude || 0, body.longitude || 0, body.accuracy || 0).run();
  return c.json({ success: true, data: { id } });
});

// GPS presence-anomaly scoring for a SAST calendar day. See presenceScore.js +
// docs/superpowers/specs/2026-07-12-presence-validation-design.md
const PRESENCE_VIEWER_ROLES = ['manager', 'general_manager', 'backoffice_admin', 'admin', 'super_admin'];
const STATUS_ORDER = { off_zone: 0, no_show: 1, low_coverage: 2, ok: 3 };
app.get('/field-ops/presence/anomalies', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  if (!PRESENCE_VIEWER_ROLES.includes(role)) return c.json({ success: false, error: 'Forbidden' }, 403);

  // Default to today in SAST (UTC+2).
  const sastNow = new Date(Date.now() + 2 * 3600000);
  const date = c.req.query('date') || sastNow.toISOString().slice(0, 10);

  // SAST calendar day [date 00:00, date 24:00) == UTC [date-1 22:00, date 22:00).
  const dayMs = Date.parse(date + 'T00:00:00Z');
  if (Number.isNaN(dayMs)) return c.json({ success: false, error: 'Invalid date' }, 400);
  const toUtcStr = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
  const startUtc = toUtcStr(dayMs - 2 * 3600000); // date-1 22:00 UTC
  const endUtc = toUtcStr(dayMs + 22 * 3600000);  // date   22:00 UTC
  const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(dayMs).getUTCDay()];

  const [agentsRes, custRes, wdRes] = await Promise.all([
    db.prepare("SELECT id, first_name, last_name, role FROM users WHERE tenant_id = ? AND role IN ('field_agent','sales_rep','agent','team_lead')").bind(tenantId).all(),
    db.prepare('SELECT latitude, longitude FROM customers WHERE tenant_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL').bind(tenantId).all(),
    db.prepare('SELECT agent_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, effective_from, effective_to FROM working_days_config WHERE tenant_id = ?').bind(tenantId).all(),
  ]);
  const customers = custRes.results || [];
  const wdRows = wdRes.results || [];

  // Is `date` inside a config row's effective window? Null bounds = open-ended.
  const covers = (r) => (!r.effective_from || r.effective_from <= date) && (!r.effective_to || r.effective_to >= date);
  // Most-specific applicable row: agent override first, else tenant default (agent_id NULL).
  const isOff = (agentId) => {
    const applicable = wdRows.filter(covers);
    const row = applicable.find((r) => r.agent_id === agentId) || applicable.find((r) => !r.agent_id);
    if (!row) return false; // no config -> default to expected (do not skip)
    return row[weekday] === 0;
  };

  const agents = [];
  for (const a of (agentsRes.results || [])) {
    if (isOff(a.id)) continue; // not expected to work this day
    const ptsRes = await db.prepare('SELECT latitude, longitude, recorded_at FROM agent_locations WHERE tenant_id = ? AND agent_id = ? AND recorded_at >= ? AND recorded_at < ?').bind(tenantId, a.id, startUtc, endUtc).all();
    const score = scoreAgentDay(ptsRes.results || [], customers, {});
    agents.push({
      agent_id: a.id,
      agent_name: `${a.first_name} ${a.last_name}`,
      role: a.role,
      status: score.status,
      offZonePct: score.offZonePct,
      sampleCount: score.sampleCount,
      dominantCluster: score.dominantCluster,
      lastSeenAt: score.lastSeenAt,
    });
  }
  agents.sort((x, y) => (STATUS_ORDER[x.status] ?? 9) - (STATUS_ORDER[y.status] ?? 9));
  const flaggedCount = agents.filter((a) => a.status !== 'ok').length;
  return c.json({ success: true, date, flaggedCount, agents });
});
app.post('/field-ops/verify-goldrush-photo', authMiddleware, async (c) => {
  try {
    const { photo_data } = await c.req.json();
    // The OCR pass extracts only the 9-digit Goldrush ID + the btag from the URL bar.
    // Name is captured manually on the Details step; the caller derives btag-present from
    // extracted_btag and checks the ID match itself once the agent types the ID.
    if (!photo_data) {
      return c.json({ success: false, error: 'Missing photo_data' }, 400);
    }
    const base64Match = photo_data.match(/^data:image\/[^;]+;base64,(.+)$/s);
    if (!base64Match) return c.json({ success: false, error: 'Invalid photo format' }, 400);
    const imageBytes = Uint8Array.from(atob(base64Match[1]), ch => ch.charCodeAt(0));
    if (imageBytes.length > 4_000_000) {
      return c.json({ success: true, extracted_id: null, extracted_btag: null, confidence: 'unreadable', reason: 'Image too large' });
    }
    const prompt = `This is a photo taken with a phone camera of a screen showing the Goldrush gaming/betting system opened in a browser.

Task 1 — Player ID: Find the 9-digit Goldrush player ID number visible in the image (printed on a card or shown on screen).

Task 2 — B-Tag URL: Look at the browser address bar in the photographed screen. Check if the URL contains "goldrush.co.za" AND has a "btag=" query parameter (e.g. goldrush.co.za/?btag=123456789). Extract the btag number if present.

Return ONLY a JSON object, no prose, no markdown:
{"extracted_id": "123456789", "extracted_btag": "123456789", "confidence": "high"}

Rules:
- extracted_id: the 9-digit player ID, or null if not found
- extracted_btag: the btag number string from the URL bar, or null if not present/visible
- NEVER guess: if a value is not clearly readable in the image, return null for it
- confidence: "high", "medium", or "low"

Output JSON only.`;
    let extractedId = null, confidence = 'low', extractedBtag = null;
    try {
      const aiResponse = await c.env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
        prompt,
        image: [...imageBytes],
      });
      const text = (aiResponse?.response || aiResponse?.result?.response || '').trim();
      const clean = text.replace(/```json|```/gi, '').trim();
      const jsonStart = clean.indexOf('{');
      const jsonEnd = clean.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(clean.slice(jsonStart, jsonEnd + 1));
        // Goldrush player IDs are exactly 9 digits. Reject any other length so an OCR
        // misread (e.g. a 10-digit run) can't autofill and slip a bad-length ID into
        // capture — the camera is the only capture path, so this is the length gate.
        const rawId = parsed.extracted_id ? String(parsed.extracted_id).replace(/\D/g, '') : '';
        extractedId = rawId.length === 9 ? rawId : null;
        confidence = parsed.confidence || 'low';
        // B-Tags are long numeric strings; a short digit run is an OCR misread or a
        // hallucinated value — reject it so a missing B-Tag is flagged, not masked.
        const rawBtag = parsed.extracted_btag ? String(parsed.extracted_btag).replace(/\D/g, '') : '';
        extractedBtag = rawBtag.length >= 6 ? rawBtag : null;
      }
    } catch (aiErr) {
      console.error('Goldrush photo AI error:', aiErr);
    }
    return c.json({ success: true, extracted_id: extractedId, extracted_btag: extractedBtag, confidence });
  } catch (e) {
    console.error('verify-goldrush-photo error:', e);
    return c.json({ success: true, extracted_id: null, extracted_btag: null, confidence: 'unreadable', reason: 'Verification failed' });
  }
});

// Goldrush Upload Failures Report — captures rejected due to invalid SA ID or Goldrush ID

app.post('/field-ops/portal/users', authMiddleware, requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  await ensurePortalTables(db);
  const tenantId = c.get('tenantId');
  const staffId = c.get('userId');
  const { email, company_id } = await c.req.json();
  if (!email || !company_id) return c.json({ success: false, message: 'email and company_id are required' }, 400);
  const companyId = await resolveReportCompanyId(db, tenantId, company_id);
  if (!companyId) return c.json({ success: false, message: 'Company not found' }, 404);
  const normEmail = String(email).toLowerCase().trim();
  const existing = await db.prepare('SELECT id, status FROM portal_users WHERE tenant_id = ? AND email = ?').bind(tenantId, normEmail).first();
  const id = existing ? existing.id : crypto.randomUUID();
  const inviteToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  if (existing) {
    await db.prepare("UPDATE portal_users SET company_id = ?, invite_token = ?, invite_expires_at = ?, status = 'invited' WHERE id = ?").bind(companyId, inviteToken, expires, id).run();
  } else {
    await db.prepare("INSERT INTO portal_users (id, tenant_id, company_id, email, invite_token, invite_expires_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?, 'invited', ?)").bind(id, tenantId, companyId, normEmail, inviteToken, expires, staffId).run();
  }
  const portalBase = (c.env.PORTAL_URL || c.env.FRONTEND_URL || '').replace(/\/$/, '');
  return c.json({ success: true, data: { id, invite_token: inviteToken, invite_url: `${portalBase}/accept-invite?token=${inviteToken}` } });
});

app.get('/field-ops/portal/users', authMiddleware, requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  await ensurePortalTables(db);
  const tenantId = c.get('tenantId');
  const { company_id } = c.req.query();
  let sql = 'SELECT id, tenant_id, company_id, email, status, invite_expires_at, created_by, created_at FROM portal_users WHERE tenant_id = ?';
  const binds = [tenantId];
  if (company_id) { sql += ' AND company_id = ?'; binds.push(company_id); }
  const rows = await db.prepare(sql + ' ORDER BY created_at DESC').bind(...binds).all();
  return c.json({ success: true, data: rows.results || [] });
});

app.delete('/field-ops/portal/users/:id', authMiddleware, requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  await ensurePortalTables(db);
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare("UPDATE portal_users SET status = 'disabled' WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true });
});

app.get('/field-ops/portal/dashboard-config', authMiddleware, requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  await ensurePortalTables(db);
  const tenantId = c.get('tenantId');
  const { company_id } = c.req.query();
  const companyId = await resolveReportCompanyId(db, tenantId, company_id || null);
  if (!companyId) return c.json({ success: false, message: 'Company not found' }, 404);
  const row = await db.prepare('SELECT widgets FROM portal_dashboard_config WHERE company_id = ? AND tenant_id = ?').bind(companyId, tenantId).first();
  const widgets = row ? JSON.parse(row.widgets) : defaultDashboardConfig(companyId).widgets;
  return c.json({ success: true, data: { company_id: companyId, widgets } });
});

app.put('/field-ops/portal/dashboard-config', authMiddleware, requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  await ensurePortalTables(db);
  const tenantId = c.get('tenantId');
  const staffId = c.get('userId');
  const { company_id, widgets } = await c.req.json();
  const companyId = await resolveReportCompanyId(db, tenantId, company_id || null);
  if (!companyId) return c.json({ success: false, message: 'Company not found' }, 404);
  if (!Array.isArray(widgets)) return c.json({ success: false, message: 'widgets must be an array' }, 400);
  await db.prepare(`INSERT INTO portal_dashboard_config (company_id, tenant_id, widgets, updated_by, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(company_id) DO UPDATE SET widgets = excluded.widgets, updated_by = excluded.updated_by, updated_at = datetime('now')`)
    .bind(companyId, tenantId, JSON.stringify(widgets), staffId).run();
  return c.json({ success: true, data: { company_id: companyId, widgets } });
});
app.post('/field-operations/agents/:agentId/location', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/field-operations/beats/:id', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/field-operations/beats/:id/reverse', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/field-operations/visits/:visitId', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const visitId = c.req.param('visitId');
    const visit = await db.prepare("SELECT v.*, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name, fc.name as company_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id LEFT JOIN field_companies fc ON fc.id = COALESCE(v.company_id, v.brand_id) WHERE v.id = ? AND v.tenant_id = ?").bind(visitId, tenantId).first();
    if (!visit) return c.json({ success: false, message: 'Visit not found' }, 404);
    // Fetch photos for this visit - include all fields needed by frontend
    let photos = [];
    try { const photosRes = await db.prepare("SELECT * FROM visit_photos WHERE visit_id = ? AND tenant_id = ?").bind(visitId, tenantId).all(); photos = photosRes?.results || []; } catch { /* visit_photos may not exist */ }
    // Fetch survey responses
    let surveyResponses = null;
    try { const sr = await db.prepare("SELECT responses FROM visit_responses WHERE visit_id = ? AND tenant_id = ? AND (visit_type IS NULL OR visit_type != 'store_custom_questions')").bind(visitId, tenantId).first(); if (sr?.responses) surveyResponses = typeof sr.responses === 'string' ? JSON.parse(sr.responses) : sr.responses; } catch { /* ok */ }
    // Fetch individual link + custom field values
    let customFieldValues = null;
    let individuals = [];
    try {
      const viRes = await db.prepare("SELECT vi.*, i.first_name, i.last_name, i.phone, i.id_number FROM visit_individuals vi LEFT JOIN individuals i ON vi.individual_id = i.id WHERE vi.visit_id = ? AND vi.tenant_id = ?").bind(visitId, tenantId).all();
      individuals = viRes?.results || [];
      if (individuals.length > 0 && individuals[0].custom_field_values) {
        customFieldValues = typeof individuals[0].custom_field_values === 'string' ? JSON.parse(individuals[0].custom_field_values) : individuals[0].custom_field_values;
      }
    } catch { /* ok */ }
    // Fallback: for store visits, read custom_field_values from visit_responses (store_custom_questions)
    if (!customFieldValues) {
      try {
        const scq = await db.prepare("SELECT responses FROM visit_responses WHERE visit_id = ? AND tenant_id = ? AND visit_type = 'store_custom_questions'").bind(visitId, tenantId).first();
        if (scq?.responses) customFieldValues = typeof scq.responses === 'string' ? JSON.parse(scq.responses) : scq.responses;
      } catch { /* ok */ }
    }
    // Extract images from custom question responses (company questions with field_type='image')
    if (visit.company_id && customFieldValues) {
      try {
        const imgQs = await db.prepare("SELECT question_key FROM company_custom_questions WHERE tenant_id = ? AND company_id = ? AND field_type = 'image' AND is_active = 1").bind(tenantId, visit.company_id).all();
        const imgKeys = (imgQs.results || []).map(q => q.question_key);
        for (const key of imgKeys) {
          const val = customFieldValues[key];
          if (val && typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('http'))) {
            photos.push({ id: `q_${key}`, photo_type: 'question', r2_url: val, photo_url: val, url: val, captured_at: visit.created_at || new Date().toISOString() });
          }
        }
      } catch { /* ok */ }
    }
    return c.json({ success: true, data: { ...visit, photos, survey_responses: surveyResponses, custom_field_values: customFieldValues, individuals } });
  }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/gps-tracking/agents/:agentId/location', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/gps-tracking/dashboard', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/gps-tracking/location', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/gps-tracking/validate-proximity', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/visit-surveys/assign', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const { visit_id, surveys } = body;
  if (!visit_id || !surveys || !Array.isArray(surveys)) return c.json({ success: false, message: 'visit_id and surveys array required' }, 400);
  const ids = [];
  for (const s of surveys) {
    const id = uuidv4();
    await db.prepare('INSERT INTO visit_responses (id, tenant_id, visit_id, visit_type, responses, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))').bind(id, tenantId, visit_id, s.survey_id, JSON.stringify([])).run();
    ids.push(id);
  }
  return c.json({ success: true, data: { ids }, message: 'Surveys assigned to visit' });
});
app.get('/visit-surveys/available', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId');
  const { target_type, brand_id } = c.req.query();
  let where = 'WHERE tenant_id = ? AND is_active = 1';
  const params = [tenantId];
  if (brand_id) { where += ' AND (brand_id = ? OR brand_id IS NULL)'; params.push(brand_id); }
  const surveys = await db.prepare('SELECT * FROM questionnaires ' + where + ' ORDER BY name').bind(...params).all();
  const results = (surveys.results || []).map(q => {
    try { q.questions = JSON.parse(q.questions); } catch(e) {}
    return { ...q, title: q.name, survey_type: q.visit_type || 'adhoc', target_type: target_type || 'both' };
  });
  return c.json({ success: true, data: { surveys: results } });
});

export default app;
