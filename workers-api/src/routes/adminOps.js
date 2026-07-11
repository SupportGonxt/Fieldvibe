import { Hono } from 'hono';
import { requireRole } from '../lib/middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { computeGoldrushIndividualInsights, computeGoldrushStoreInsights, buildGoldrushWeeklyHtml } from '../cron/jobs.js';
import { sendEmailViaMailChannels } from '../cron/email.js';

const app = new Hono();

app.get('/admin/report-email-subscriptions', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { report_key } = c.req.query();
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];
  if (report_key) { where += ' AND report_key = ?'; params.push(report_key); }
  const rows = await db.prepare(
    'SELECT id, report_key, recipient_email, recipient_name, is_active, last_sent_at, last_sent_status, last_sent_error, created_at ' +
    'FROM report_email_subscriptions ' + where + ' ORDER BY report_key, recipient_email'
  ).bind(...params).all();
  return c.json({ success: true, data: rows.results || [] });
});

app.post('/admin/report-email-subscriptions', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  if (!body.recipient_email || typeof body.recipient_email !== 'string') {
    return c.json({ success: false, message: 'recipient_email is required' }, 400);
  }
  const reportKey = body.report_key || 'goldrush-weekly';
  const id = uuidv4();
  try {
    await db.prepare(
      'INSERT INTO report_email_subscriptions (id, tenant_id, report_key, recipient_email, recipient_name, is_active, created_by) ' +
      'VALUES (?, ?, ?, ?, ?, COALESCE(?, 1), ?)'
    ).bind(id, tenantId, reportKey, body.recipient_email.trim().toLowerCase(), body.recipient_name || null, body.is_active != null ? (body.is_active ? 1 : 0) : null, userId).run();
    return c.json({ success: true, data: { id } }, 201);
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) {
      return c.json({ success: false, message: 'This email is already subscribed to that report' }, 409);
    }
    return c.json({ success: false, message: e.message }, 500);
  }
});

app.put('/admin/report-email-subscriptions/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  await db.prepare(
    'UPDATE report_email_subscriptions SET ' +
    'recipient_name = COALESCE(?, recipient_name), is_active = COALESCE(?, is_active), updated_at = datetime("now") ' +
    'WHERE id = ? AND tenant_id = ?'
  ).bind(body.recipient_name || null, body.is_active != null ? (body.is_active ? 1 : 0) : null, id, tenantId).run();
  return c.json({ success: true, message: 'Subscription updated' });
});

app.delete('/admin/report-email-subscriptions/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM report_email_subscriptions WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Subscription removed' });
});

// Manual trigger: useful for verifying the full email pipeline without
// waiting for Monday 5am. Runs the same code path the cron uses but ONLY
// for subscriptions belonging to the requesting tenant.
app.post('/admin/report-email-subscriptions/send-weekly-now', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const subs = await db.prepare(
    "SELECT s.id, s.tenant_id, s.recipient_email, s.recipient_name, t.name as tenant_name " +
    "FROM report_email_subscriptions s LEFT JOIN tenants t ON s.tenant_id = t.id " +
    "WHERE s.is_active = 1 AND s.report_key = 'goldrush-weekly' AND s.tenant_id = ?"
  ).bind(tenantId).all();
  const list = subs.results || [];
  const results = [];
  for (const sub of list) {
    try {
      const [individuals, stores] = await Promise.all([
        computeGoldrushIndividualInsights(db, sub.tenant_id, startStr, endStr),
        computeGoldrushStoreInsights(db, sub.tenant_id, startStr, endStr),
      ]);
      if (!individuals && !stores) {
        await db.prepare("UPDATE report_email_subscriptions SET last_sent_at = datetime('now'), last_sent_status = 'skipped', last_sent_error = 'No Goldrush company configured' WHERE id = ?").bind(sub.id).run();
        results.push({ id: sub.id, email: sub.recipient_email, status: 'skipped' });
        continue;
      }
      const html = buildGoldrushWeeklyHtml({
        tenantName: sub.tenant_name, startDate: startStr, endDate: endStr,
        individuals, stores, recipientName: sub.recipient_name,
      });
      await sendEmailViaMailChannels(c.env, {
        to: sub.recipient_email, toName: sub.recipient_name,
        subject: `Goldrush weekly — ${startStr} to ${endStr}`, html,
      });
      await db.prepare("UPDATE report_email_subscriptions SET last_sent_at = datetime('now'), last_sent_status = 'sent', last_sent_error = NULL WHERE id = ?").bind(sub.id).run();
      results.push({ id: sub.id, email: sub.recipient_email, status: 'sent' });
    } catch (e) {
      const msg = (e && e.message) ? String(e.message).slice(0, 300) : 'send failed';
      await db.prepare("UPDATE report_email_subscriptions SET last_sent_at = datetime('now'), last_sent_status = 'failed', last_sent_error = ? WHERE id = ?").bind(msg, sub.id).run();
      results.push({ id: sub.id, email: sub.recipient_email, status: 'failed', error: msg });
    }
  }
  return c.json({ success: true, data: { sent: results.filter(r => r.status === 'sent').length, total: results.length, results } });
});

app.get('/admin/settings', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first();
  let parsedSettings = {};
  try { if (tenant?.features) parsedSettings = JSON.parse(tenant.features); } catch (e) { parsedSettings = {}; }
  return c.json({ success: true, data: { tenant, settings: parsedSettings } });
});

app.get('/admin/roles', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const roles = await db.prepare('SELECT role, COUNT(*) as count FROM users WHERE tenant_id = ? GROUP BY role ORDER BY count DESC').bind(tenantId).all();
  return c.json({ success: true, data: roles.results || [] });
});

app.get('/admin/audit-log', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { page = '1', limit = '50' } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const logs = await db.prepare("SELECT al.*, u.first_name || ' ' || u.last_name as user_name FROM audit_log al LEFT JOIN users u ON al.user_id = u.id WHERE al.tenant_id = ? ORDER BY al.created_at DESC LIMIT ? OFFSET ?").bind(tenantId, parseInt(limit), offset).all();
  return c.json({ success: true, data: logs.results || [] });
});


// ==================== MISSING ROUTE FIXES (404 elimination) ====================

// --- Admin CRUD routes (frontend calls /admin/territories, /admin/campaigns, etc.) ---

app.get('/admin/territories', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const territories = await db.prepare("SELECT t.*, (SELECT COUNT(*) FROM territory_assignments ta WHERE ta.territory_id = t.id) as agents FROM territories t WHERE t.tenant_id = ? ORDER BY t.name").bind(tenantId).all();
  return c.json({ success: true, territories: territories.results || [] });
});

app.post('/admin/territories', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO territories (id, tenant_id, name, code, boundary, manager_id, parent_id, status, target_visits_per_week, target_revenue_per_month, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))').bind(id, tenantId, body.name, body.code || null, body.coordinates || body.boundary || null, body.manager_id || null, body.parent_id || null, body.status || 'active', body.target_visits_per_week || 0, body.target_revenue_per_month || 0).run();
  return c.json({ success: true, data: { id, ...body } }, 201);
});

app.put('/admin/territories/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  await db.prepare('UPDATE territories SET name = COALESCE(?, name), code = COALESCE(?, code), boundary = COALESCE(?, boundary), manager_id = COALESCE(?, manager_id), status = COALESCE(?, status) WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.code || null, body.coordinates || body.boundary || null, body.manager_id || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'Territory updated' });
});

app.delete('/admin/territories/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const existing = await db.prepare('SELECT id FROM territories WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!existing) return c.json({ success: false, message: 'Territory not found' }, 404);
  await db.prepare('DELETE FROM territory_assignments WHERE territory_id = ?').bind(id).run();
  await db.prepare('DELETE FROM territories WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Territory deleted' });
});

app.get('/admin/campaigns', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const campaigns = await db.prepare('SELECT * FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ success: true, campaigns: campaigns.results || [] });
});

app.post('/admin/campaigns', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO campaigns (id, tenant_id, name, description, campaign_type, start_date, end_date, budget, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))').bind(id, tenantId, body.name, body.description || null, body.campaign_type || 'general', body.startDate || body.start_date || null, body.endDate || body.end_date || null, body.budget || 0, body.status || 'planned', userId).run();
  return c.json({ success: true, data: { id, ...body } }, 201);
});

app.put('/admin/campaigns/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  await db.prepare('UPDATE campaigns SET name = COALESCE(?, name), description = COALESCE(?, description), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), budget = COALESCE(?, budget), status = COALESCE(?, status), updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.description || null, body.startDate || body.start_date || null, body.endDate || body.end_date || null, body.budget || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'Campaign updated' });
});

app.delete('/admin/campaigns/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM campaigns WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Campaign deleted' });
});

app.get('/admin/commission-rules', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const rules = await db.prepare('SELECT * FROM commission_rules WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: rules.results || [] });
});

app.get('/admin/boards', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const boards = await db.prepare('SELECT * FROM boards WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: boards.results || [] });
});

app.get('/admin/audit-logs', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { page = '1', limit = '50' } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const logs = await db.prepare("SELECT al.*, u.first_name || ' ' || u.last_name as user_name FROM audit_log al LEFT JOIN users u ON al.user_id = u.id WHERE al.tenant_id = ? ORDER BY al.created_at DESC LIMIT ? OFFSET ?").bind(tenantId, parseInt(limit), offset).all();
  const total = await db.prepare('SELECT COUNT(*) as count FROM audit_log WHERE tenant_id = ?').bind(tenantId).first();
  return c.json({ success: true, data: logs.results || [], total: total?.count || 0 });
});

app.get('/admin/backups', requireRole('admin'), async (c) => {
  return c.json({ success: true, data: [], message: 'Backup management is handled via Cloudflare D1 automatic backups' });
});

app.get('/admin/integrations', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const webhooks = await db.prepare('SELECT * FROM webhooks WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  const apiKeys = await db.prepare('SELECT id, tenant_id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_by, created_at FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: { webhooks: webhooks.results || [], api_keys: apiKeys.results || [] } });
});

app.get('/admin/pos-library', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const materials = await db.prepare('SELECT * FROM posm_materials WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: materials.results || [] });
});

export default app;
