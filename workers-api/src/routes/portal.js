import { Hono } from 'hono';
import { defaultDashboardConfig, assertPortalToken, serializeIndividualForPortal, serializeStoreForPortal, matchAskIntent } from '../services/portal.js';
import { parseStoreInsights } from '../services/goldrushVision.js';

const app = new Hono();

const portalAuthMiddleware = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : c.req.query('access_token');
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);
    const parts = token.split('.');
    if (parts.length !== 3) return c.json({ success: false, message: 'Malformed token' }, 401);
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) return c.json({ success: false, message: 'Server configuration error' }, 500);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signatureBytes = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(parts[0] + '.' + parts[1]));
    if (!valid) return c.json({ success: false, message: 'Invalid token signature' }, 401);
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) return c.json({ success: false, message: 'Token expired' }, 401);
    try { assertPortalToken(payload); } catch { return c.json({ success: false, message: 'Not a portal token' }, 401); }
    c.set('portalUserId', payload.portalUserId);
    c.set('portalTenantId', payload.tenantId);
    c.set('portalCompanyId', payload.companyId);
    await next();
  } catch (e) {
    return c.json({ success: false, message: 'Invalid token' }, 401);
  }
};

// ==================== CUSTOMER PORTAL DATA (Phase F4) ====================
app.get('/portal/overview', portalAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('portalTenantId');
  const companyId = c.get('portalCompanyId');
  try {
    const cfgRow = await db.prepare('SELECT widgets FROM portal_dashboard_config WHERE company_id = ? AND tenant_id = ?').bind(companyId, tenantId).first();
    const widgets = cfgRow ? JSON.parse(cfgRow.widgets) : defaultDashboardConfig(companyId).widgets;
    const ind = await db.prepare(`SELECT COUNT(*) AS n,
        SUM(CASE WHEN ((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') THEN 1 ELSE 0 END) AS converted
      FROM visits v LEFT JOIN visit_individuals vi ON v.id = vi.visit_id
      WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='individual'
        AND v.agent_id NOT LIKE 'agent-test-%'`).bind(tenantId, companyId).first();
    const stores = await db.prepare(`SELECT COUNT(*) AS n,
        AVG((SELECT MAX(vp.ai_share_of_voice) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.ai_share_of_voice IS NOT NULL)) AS avg_sow
      FROM visits v WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='store'
        AND v.agent_id NOT LIKE 'agent-test-%'`).bind(tenantId, companyId).first();
    const totalInd = ind?.n || 0;
    const kpis = {
      total_individuals: totalInd,
      total_stores: stores?.n || 0,
      qualification_rate: totalInd ? Math.round(((ind?.converted || 0) / totalInd) * 1000) / 10 : 0,
      avg_share_of_wall: stores?.avg_sow != null ? Math.round(stores.avg_sow * 10) / 10 : null,
    };
    return c.json({ success: true, data: { widgets, kpis } });
  } catch (e) {
    console.error('portal overview error:', e);
    return c.json({ success: true, data: {
      widgets: defaultDashboardConfig(companyId).widgets,
      kpis: { total_individuals: 0, total_stores: 0, qualification_rate: 0, avg_share_of_wall: null },
    } });
  }
});

app.get('/portal/individuals', portalAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('portalTenantId');
  const companyId = c.get('portalCompanyId');
  const limit = Math.min(parseInt(c.req.query('limit') || '25', 10) || 25, 100);
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0;
  try {
    const result = await db.prepare(`
      SELECT v.id, i.first_name, i.last_name, i.phone, i.email,
        (SELECT vp.r2_url FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.r2_url IS NOT NULL LIMIT 1) AS thumbnail_url,
        (SELECT vp.id FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.r2_url IS NOT NULL LIMIT 1) AS photo_id,
        (CASE WHEN (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') THEN 1 ELSE 0 END) AS converted,
        v.visit_date, v.created_at
      FROM visits v
      LEFT JOIN visit_individuals vi ON v.id = vi.visit_id
      LEFT JOIN individuals i ON vi.individual_id = i.id
      WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='individual'
        AND v.agent_id NOT LIKE 'agent-test-%'
      ORDER BY v.created_at DESC LIMIT ? OFFSET ?
    `).bind(tenantId, companyId, limit, offset).all();
    const data = (result.results || []).map(serializeIndividualForPortal);
    return c.json({ success: true, data });
  } catch (e) {
    console.error('portal individuals error:', e);
    return c.json({ success: true, data: [] });
  }
});

app.get('/portal/stores', portalAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('portalTenantId');
  const companyId = c.get('portalCompanyId');
  const limit = Math.min(parseInt(c.req.query('limit') || '25', 10) || 25, 100);
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0;
  try {
    const result = await db.prepare(`
      SELECT v.id, v.store_name, v.visit_date, v.created_at,
        (SELECT vp.id FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.r2_url IS NOT NULL LIMIT 1) AS photo_id,
        (SELECT MAX(vp.ai_share_of_voice) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.ai_share_of_voice IS NOT NULL) AS share_of_wall
      FROM visits v
      WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='store'
        AND v.agent_id NOT LIKE 'agent-test-%'
      ORDER BY v.created_at DESC LIMIT ? OFFSET ?
    `).bind(tenantId, companyId, limit, offset).all();
    const data = (result.results || []).map(serializeStoreForPortal);
    return c.json({ success: true, data });
  } catch (e) {
    console.error('portal stores error:', e);
    return c.json({ success: true, data: [] });
  }
});

app.get('/portal/insights', portalAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('portalTenantId');
  const companyId = c.get('portalCompanyId');
  try {
    const rows = await db.prepare(`
      SELECT v.id AS visit_id, v.store_name, vp.ai_share_of_voice AS share_of_wall, vp.ai_raw_response
      FROM visits v JOIN visit_photos vp ON vp.visit_id = v.id
      WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='store'
        AND vp.ai_raw_response IS NOT NULL
      ORDER BY v.created_at DESC LIMIT 200
    `).bind(tenantId, companyId).all();
    const data = (rows.results || []).map(r => ({
      visit_id: r.visit_id,
      store_name: r.store_name,
      share_of_wall: r.share_of_wall,
      insights: parseStoreInsights(r.ai_raw_response),
    }));
    return c.json({ success: true, data });
  } catch (e) {
    console.error('portal insights error:', e);
    return c.json({ success: true, data: [] });
  }
});

app.get('/portal/media/:id', portalAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('portalTenantId');
  const companyId = c.get('portalCompanyId');
  const photoId = c.req.param('id');
  const row = await db.prepare(`
    SELECT vp.r2_key, vp.r2_url FROM visit_photos vp
    JOIN visits v ON v.id = vp.visit_id
    WHERE vp.id = ? AND vp.tenant_id = ? AND v.company_id = ?
  `).bind(photoId, tenantId, companyId).first();
  if (!row) return c.json({ success: false, message: 'Not found' }, 404);
  // Path A: real R2 object.
  if (row.r2_key && c.env.UPLOADS) {
    const obj = await c.env.UPLOADS.get(row.r2_key);
    if (obj) {
      return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'private, max-age=300' } });
    }
  }
  // Path B: base64 data URL stored directly in r2_url (Goldrush store/individual photos).
  if (row.r2_url && String(row.r2_url).startsWith('data:')) {
    const m = String(row.r2_url).match(/^data:([^;]+);base64,(.*)$/);
    if (m) {
      const bytes = Uint8Array.from(atob(m[2]), ch => ch.charCodeAt(0));
      return new Response(bytes, { headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=300' } });
    }
  }
  // Path C: r2_url is a plain remote URL — redirect.
  if (row.r2_url) return c.redirect(row.r2_url, 302);
  return c.json({ success: false, message: 'No image' }, 404);
});

// Ask-panel (Phase F7). Bounded NL query: matchAskIntent maps the question onto
// ONE of a fixed set of metric intents (never free SQL from the question text),
// we compute that single scoped aggregate ourselves, then ask Workers AI to
// phrase a short sentence over ONLY that number. company/tenant come ONLY from
// the portal token context set by portalAuthMiddleware — never from the body.
app.post('/portal/ask', portalAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('portalTenantId');
  const companyId = c.get('portalCompanyId');
  let question = '';
  try {
    const body = await c.req.json();
    question = typeof body?.question === 'string' ? body.question.trim().slice(0, 500) : '';
  } catch {
    question = '';
  }
  const intent = matchAskIntent(question);
  if (!intent) {
    return c.json({ success: true, data: {
      answer: 'I can answer questions about registrations, qualification, and store share-of-wall.',
      intent: null,
      data: null,
    } });
  }

  let data;
  try {
    if (intent === 'total_individuals') {
      const row = await db.prepare(`SELECT COUNT(*) AS n FROM visits v
        WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='individual'
          AND v.agent_id NOT LIKE 'agent-test-%'`).bind(tenantId, companyId).first();
      data = { total_individuals: row?.n || 0 };
    } else if (intent === 'qualification_rate') {
      const row = await db.prepare(`SELECT COUNT(*) AS n,
          SUM(CASE WHEN ((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') THEN 1 ELSE 0 END) AS converted
        FROM visits v LEFT JOIN visit_individuals vi ON v.id = vi.visit_id
        WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='individual'
          AND v.agent_id NOT LIKE 'agent-test-%'`).bind(tenantId, companyId).first();
      const total = row?.n || 0;
      data = { qualification_rate: total ? Math.round(((row?.converted || 0) / total) * 1000) / 10 : 0 };
    } else if (intent === 'share_of_wall') {
      const row = await db.prepare(`SELECT
          AVG((SELECT MAX(vp.ai_share_of_voice) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.ai_share_of_voice IS NOT NULL)) AS avg_sow
        FROM visits v WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='store'
          AND v.agent_id NOT LIKE 'agent-test-%'`).bind(tenantId, companyId).first();
      data = { avg_share_of_wall: row?.avg_sow != null ? Math.round(row.avg_sow * 10) / 10 : null };
    } else if (intent === 'store_coverage') {
      const row = await db.prepare(`SELECT COUNT(*) AS n FROM visits v
        WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='store'
          AND v.agent_id NOT LIKE 'agent-test-%'`).bind(tenantId, companyId).first();
      data = { store_coverage: row?.n || 0 };
    } else if (intent === 'trend_over_time') {
      const rows = await db.prepare(`SELECT DATE(v.created_at) AS day, COUNT(*) AS n
        FROM visits v
        WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='individual'
          AND v.agent_id NOT LIKE 'agent-test-%'
          AND v.created_at >= datetime('now', '-30 days')
        GROUP BY day ORDER BY day`).bind(tenantId, companyId).all();
      data = { trend: (rows.results || []).map(r => ({ day: r.day, n: r.n })) };
    }
  } catch (e) {
    console.error('portal ask query error:', e);
    return c.json({ success: true, data: { answer: 'Sorry, I could not compute that right now.', intent, data: null } });
  }

  let answer = '';
  try {
    const aiResponse = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'You answer questions about a retail field-marketing dashboard using ONLY the numbers given to you. Never invent, estimate, or assume any data not present in the JSON provided. Reply in one or two short sentences.' },
        { role: 'user', content: `Question: ${question}\nComputed data: ${JSON.stringify(data)}` },
      ],
    });
    answer = (aiResponse?.response || aiResponse?.result?.response || '').trim();
  } catch (aiErr) {
    console.error('portal ask AI error:', aiErr);
  }
  if (!answer) {
    answer = `Here is the data for your question: ${JSON.stringify(data)}`;
  }

  return c.json({ success: true, data: { answer, intent, data } });
});


export default app;
