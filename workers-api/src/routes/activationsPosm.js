import { Hono } from 'hono';
import { requireRole } from '../lib/middleware.js';
import { v4 as uuidv4 } from 'uuid';

const app = new Hono();

app.post('/activations/:id/start', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();
  const activation = await db.prepare('SELECT * FROM activations WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!activation) return c.json({ success: false, message: 'Activation not found' }, 404);
  await db.prepare(`UPDATE activations SET status = 'in_progress', actual_start = datetime('now'),
    start_latitude = ?, start_longitude = ?, updated_at = datetime('now') WHERE id = ?`).bind(
    body.latitude || null, body.longitude || null, id).run();
  const tasks = await db.prepare('SELECT at2.* FROM activation_tasks at2 JOIN activations a ON at2.activation_id = a.id WHERE at2.activation_id = ? AND a.tenant_id = ? ORDER BY at2.sequence_order').bind(id, tenantId).all();
  return c.json({ success: true, data: { activation_id: id, status: 'in_progress', tasks: tasks.results || [] } });
});

app.post('/activations/:id/tasks/:taskId/complete', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id, taskId } = c.req.param();
  const body = await c.req.json();
  // Verify activation belongs to tenant
  const act = await db.prepare('SELECT id FROM activations WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!act) return c.json({ success: false, message: 'Activation not found' }, 404);
  await db.prepare(`UPDATE activation_tasks SET status = 'completed', completed_at = datetime('now'),
    completed_by = ?, photo_ids = ?, quantity_value = ?, notes = ? WHERE id = ? AND activation_id = ?`).bind(
    userId, body.photo_ids ? JSON.stringify(body.photo_ids) : null,
    body.quantity || null, body.notes || null, taskId, id).run();
  return c.json({ success: true, message: 'Task completed' });
});

app.post('/activations/:id/submit', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const pendingTasks = await db.prepare("SELECT COUNT(*) as count FROM activation_tasks at2 JOIN activations a ON at2.activation_id = a.id WHERE at2.activation_id = ? AND a.tenant_id = ? AND at2.status != 'completed'").bind(id, tenantId).first() || { count: 0 };
  if (pendingTasks?.count > 0) {
    return c.json({ success: false, message: `${pendingTasks.count} task(s) still pending` }, 400);
  }
  await db.prepare(`UPDATE activations SET status = 'submitted', actual_end = datetime('now'), updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).run();
  return c.json({ success: true, message: 'Activation submitted' });
});

app.get('/activations/:id/summary', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const [activation, tasks, photos] = await Promise.all([
    db.prepare('SELECT a.*, c.name as customer_name, camp.name as campaign_name FROM activations a LEFT JOIN customers c ON a.customer_id = c.id LEFT JOIN campaigns camp ON a.campaign_id = camp.id WHERE a.id = ? AND a.tenant_id = ?').bind(id, tenantId).first(),
    db.prepare('SELECT at2.* FROM activation_tasks at2 JOIN activations a ON at2.activation_id = a.id WHERE at2.activation_id = ? AND a.tenant_id = ? ORDER BY at2.sequence_order').bind(id, tenantId).all(),
    db.prepare('SELECT vp.* FROM visit_photos vp WHERE vp.visit_id IN (SELECT visit_id FROM activations WHERE id = ?) AND vp.tenant_id = ? ORDER BY vp.created_at DESC LIMIT 100').bind(id, tenantId).all(),
  ]);
  if (!activation) return c.json({ success: false, message: 'Activation not found' }, 404);
  const completedTasks = (tasks.results || []).filter(t => t.status === 'completed').length;
  const totalTasks = (tasks.results || []).length;
  const avgCompliance = photos.results?.reduce((s, p) => s + (p.ai_compliance_score || 0), 0) / (photos.results?.length || 1);
  return c.json({ success: true, data: { ...activation, tasks: tasks.results || [], photos: photos.results || [], completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0, avg_compliance_score: Math.round(avgCompliance * 10) / 10 } });
});

app.post('/activations/:id/approve', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  await db.prepare(`UPDATE activations SET status = 'approved', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).run();
  const activation = await db.prepare('SELECT agent_id, campaign_id FROM activations WHERE id = ?').bind(id).first();
  if (activation?.agent_id) {
    await db.prepare(`INSERT INTO commission_earnings (id, tenant_id, earner_id, source_type, source_id, rate, base_amount, amount, status, created_at) VALUES (?, ?, ?, 'activation', ?, 1.0, 0, 0, 'pending', datetime('now'))`).bind(
      uuidv4(), tenantId, activation.agent_id, id).run();
  }
  return c.json({ success: true, message: 'Activation approved' });
});

// ==================== POSM MATERIALS ====================

app.get('/posm-materials', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { brand_id, material_type, page = 1, limit = 50 } = c.req.query();
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];
  if (brand_id) { where += ' AND brand_id = ?'; params.push(brand_id); }
  if (material_type) { where += ' AND material_type = ?'; params.push(material_type); }
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const materials = await db.prepare(`SELECT pm.*, b.name as brand_name FROM posm_materials pm LEFT JOIN brands b ON pm.brand_id = b.id ${where.replace('tenant_id', 'pm.tenant_id')} ORDER BY pm.created_at DESC LIMIT ? OFFSET ?`).bind(...params, parseInt(limit), offset).all();
  return c.json({ success: true, data: materials.results || [] });
});

app.post('/posm-materials', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare(`INSERT INTO posm_materials (id, tenant_id, name, material_type, brand_id, description, quantity_available, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, tenantId, body.name, body.material_type, body.brand_id || null, body.description || null, body.quantity_available || 0, body.unit_cost || 0).run();
  return c.json({ success: true, data: { id }, message: 'POSM material created' }, 201);
});

app.put('/posm-materials/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare(`UPDATE posm_materials SET name = COALESCE(?, name), material_type = COALESCE(?, material_type),
    brand_id = ?, description = COALESCE(?, description), quantity_available = COALESCE(?, quantity_available),
    unit_cost = COALESCE(?, unit_cost), status = COALESCE(?, status) WHERE id = ? AND tenant_id = ?`).bind(
    body.name || null, body.material_type || null, body.brand_id || null, body.description || null,
    body.quantity_available || null, body.unit_cost || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'POSM material updated' });
});

// POSM Installations
app.get('/posm-installations', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { customer_id, material_id, status } = c.req.query();
  let where = 'WHERE pi.tenant_id = ?';
  const params = [tenantId];
  if (customer_id) { where += ' AND pi.customer_id = ?'; params.push(customer_id); }
  if (material_id) { where += ' AND pi.material_id = ?'; params.push(material_id); }
  if (status) { where += ' AND pi.status = ?'; params.push(status); }
  const installations = await db.prepare(`SELECT pi.*, pm.name as material_name, pm.material_type, c.name as customer_name FROM posm_installations pi LEFT JOIN posm_materials pm ON pi.material_id = pm.id LEFT JOIN customers c ON pi.customer_id = c.id ${where} ORDER BY pi.installed_at DESC LIMIT 200`).bind(...params).all();
  return c.json({ success: true, data: installations.results || [] });
});

app.post('/posm-installations', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare(`INSERT INTO posm_installations (id, tenant_id, material_id, customer_id, visit_id, photo_id, installed_by, condition, gps_latitude, gps_longitude, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, tenantId, body.material_id, body.customer_id, body.visit_id || null, body.photo_id || null,
    userId, body.condition || 'good', body.latitude || null, body.longitude || null, body.notes || null).run();
  return c.json({ success: true, data: { id }, message: 'POSM installation recorded' }, 201);
});

// POSM Audits
app.get('/posm-audits', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { installation_id } = c.req.query();
  let where = 'WHERE pa.tenant_id = ?';
  const params = [tenantId];
  if (installation_id) { where += ' AND pa.installation_id = ?'; params.push(installation_id); }
  const audits = await db.prepare(`SELECT pa.*, pi.customer_id, c.name as customer_name, pm.name as material_name FROM posm_audits pa LEFT JOIN posm_installations pi ON pa.installation_id = pi.id LEFT JOIN customers c ON pi.customer_id = c.id LEFT JOIN posm_materials pm ON pi.material_id = pm.id ${where} ORDER BY pa.created_at DESC LIMIT 200`).bind(...params).all();
  return c.json({ success: true, data: audits.results || [] });
});

app.post('/posm-audits', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare(`INSERT INTO posm_audits (id, tenant_id, installation_id, audited_by, visit_id, photo_id, condition, visibility_score, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, tenantId, body.installation_id, userId, body.visit_id || null, body.photo_id || null,
    body.condition, body.visibility_score || null, body.notes || null).run();
  if (body.photo_id && body.condition) {
    await db.prepare(`UPDATE posm_installations SET condition = ?, status = ? WHERE id = ? AND tenant_id = ?`).bind(
      body.condition, body.condition === 'missing' ? 'removed' : 'active', body.installation_id, tenantId).run();
  }
  return c.json({ success: true, data: { id }, message: 'POSM audit recorded' }, 201);
});

// POSM Dashboard summary
app.get('/posm-materials/dashboard', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [totalMaterials, byCondition, needsReplacement] = await Promise.all([
    db.prepare("SELECT COUNT(*) as total, SUM(quantity_available) as total_qty FROM posm_materials WHERE tenant_id = ? AND status = 'active'").bind(tenantId).first(),
    db.prepare("SELECT pi.condition, COUNT(*) as count FROM posm_installations pi WHERE pi.tenant_id = ? AND pi.status = 'active' GROUP BY pi.condition").bind(tenantId).all(),
    db.prepare("SELECT pi.id, pm.name as material_name, c.name as customer_name, pi.condition FROM posm_installations pi JOIN posm_materials pm ON pi.material_id = pm.id JOIN customers c ON pi.customer_id = c.id WHERE pi.tenant_id = ? AND pi.condition IN ('damaged', 'faded', 'missing') AND pi.status = 'active' LIMIT 50").bind(tenantId).all(),
  ]);
  return c.json({ success: true, data: { total_materials: totalMaterials?.total || 0, total_quantity: totalMaterials?.total_qty || 0, by_condition: byCondition.results || [], needs_replacement: needsReplacement.results || [] } });
});

export default app;
