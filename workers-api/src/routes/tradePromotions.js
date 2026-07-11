import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { requireRole } from '../lib/middleware.js';

const app = new Hono();

// K.1 Trade Promotion CRUD
app.get('/trade-promotions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { status, type, page = 1, limit = 50 } = c.req.query();
  let q = 'SELECT * FROM trade_promotions WHERE tenant_id = ?';
  const params = [tenantId];
  if (status) { q += ' AND status = ?'; params.push(status); }
  if (type) { q += ' AND promotion_type = ?'; params.push(type); }
  q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const promos = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: promos.results || [] });
});

app.get('/trade-promotions/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const promo = await db.prepare('SELECT * FROM trade_promotions WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!promo) return c.json({ success: false, message: 'Trade promotion not found' }, 404);
  const enrollments = await db.prepare("SELECT tpe.*, c.name as customer_name FROM trade_promotion_enrollments tpe LEFT JOIN customers c ON tpe.customer_id = c.id JOIN trade_promotions tp ON tpe.promotion_id = tp.id WHERE tpe.promotion_id = ? AND tp.tenant_id = ?").bind(id, tenantId).all();
  const claims = await db.prepare("SELECT tpc.*, c.name as customer_name FROM trade_promotion_claims tpc LEFT JOIN customers c ON tpc.customer_id = c.id JOIN trade_promotions tp ON tpc.promotion_id = tp.id WHERE tpc.promotion_id = ? AND tp.tenant_id = ?").bind(id, tenantId).all();
  const audits = await db.prepare("SELECT tpa.* FROM trade_promotion_audits tpa JOIN trade_promotions tp ON tpa.promotion_id = tp.id WHERE tpa.promotion_id = ? AND tp.tenant_id = ? ORDER BY tpa.audit_date DESC").bind(id, tenantId).all();
  return c.json({ success: true, data: { ...promo, config: promo.config ? JSON.parse(promo.config) : {}, enrollments: enrollments.results || [], claims: claims.results || [], audits: audits.results || [] } });
});

app.post('/trade-promotions', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();

  // Validate promotion type
  const validTypes = ['VOLUME_REBATE', 'DISPLAY_ALLOWANCE', 'PERFORMANCE_BONUS', 'TRADE_DISCOUNT', 'CO_OP_ADVERTISING', 'SLOTTING_FEE', 'FREE_GOODS', 'MARKDOWN_ALLOWANCE'];
  if (!validTypes.includes(body.promotion_type)) {
    return c.json({ success: false, message: `Invalid promotion type. Must be one of: ${validTypes.join(', ')}` }, 400);
  }

  await db.prepare('INSERT INTO trade_promotions (id, tenant_id, name, promotion_type, description, start_date, end_date, budget, status, config, target_type, target_ids, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.promotion_type, body.description || null, body.start_date, body.end_date, body.budget || 0, 'DRAFT', JSON.stringify(body.config || {}), body.target_type || null, body.target_products ? JSON.stringify(body.target_products) : body.target_ids ? JSON.stringify(body.target_ids) : null, userId).run();

  return c.json({ success: true, data: { id }, message: 'Trade promotion created' }, 201);
});

app.put('/trade-promotions/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE trade_promotions SET name = COALESCE(?, name), description = COALESCE(?, description), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), budget = COALESCE(?, budget), status = COALESCE(?, status), config = COALESCE(?, config), target_type = COALESCE(?, target_type), target_ids = COALESCE(?, target_ids), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.description || null, body.start_date || null, body.end_date || null, body.budget || null, body.status || null, body.config ? JSON.stringify(body.config) : null, body.target_type || null, body.target_ids ? JSON.stringify(body.target_ids) : null, id, tenantId).run();
  return c.json({ success: true, message: 'Trade promotion updated' });
});

app.put('/trade-promotions/:id/activate', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare("UPDATE trade_promotions SET status = 'ACTIVE', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Trade promotion activated' });
});

app.put('/trade-promotions/:id/close', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare("UPDATE trade_promotions SET status = 'CLOSED', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Trade promotion closed' });
});

// K.2 Enrollment
app.post('/trade-promotions/:id/enroll', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();

  const promo = await db.prepare("SELECT * FROM trade_promotions WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE'").bind(id, tenantId).first();
  if (!promo) return c.json({ success: false, message: 'Active promotion not found' }, 404);

  // Check if already enrolled
  const existing = await db.prepare('SELECT id FROM trade_promotion_enrollments WHERE promotion_id = ? AND customer_id = ?').bind(id, body.customer_id).first();
  if (existing) return c.json({ success: false, message: 'Customer already enrolled' }, 400);

  const enrollId = uuidv4();
  await db.prepare('INSERT INTO trade_promotion_enrollments (id, promotion_id, customer_id, enrolled_by, status, target_value, achieved_value) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(enrollId, id, body.customer_id, userId, 'ACTIVE', body.target_value || 0, 0).run();

  return c.json({ success: true, data: { id: enrollId }, message: 'Customer enrolled' }, 201);
});

app.get('/trade-promotions/:id/enrollments', async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const tenantId = c.get('tenantId');
  const enrollments = await db.prepare("SELECT tpe.*, c.name as customer_name FROM trade_promotion_enrollments tpe LEFT JOIN customers c ON tpe.customer_id = c.id JOIN trade_promotions tp ON tpe.promotion_id = tp.id WHERE tpe.promotion_id = ? AND tp.tenant_id = ? ORDER BY tpe.created_at DESC").bind(id, tenantId).all();
  return c.json({ success: true, data: enrollments.results || [] });
});

// K.3 Claims Processing
app.post('/trade-promotions/:id/claims', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();

  const promo = await db.prepare('SELECT * FROM trade_promotions WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!promo) return c.json({ success: false, message: 'Promotion not found' }, 404);

  // Check budget
  if (promo.budget > 0 && ((promo.actual_spend || 0) + (body.claim_amount || body.amount || 0)) > promo.budget) {
    return c.json({ success: false, message: `Claim exceeds budget. Budget: R${promo.budget}, Spent: R${(promo.actual_spend || 0)}, Remaining: R${promo.budget - (promo.actual_spend || 0)}` }, 400);
  }

  const claimId = uuidv4();
  const claimNumber = 'CLM-' + Date.now().toString(36).toUpperCase();
  await db.prepare('INSERT INTO trade_promotion_claims (id, tenant_id, promotion_id, customer_id, claim_type, amount, status, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(claimId, tenantId, id, body.customer_id, body.claim_type || 'general', body.claim_amount || body.amount || 0, 'PENDING', body.supporting_data ? JSON.stringify(body.supporting_data) : body.evidence || null).run();

  return c.json({ success: true, data: { id: claimId, claim_number: claimNumber }, message: 'Claim submitted' }, 201);
});

app.put('/trade-promotion-claims/:id/approve', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const claim = await db.prepare('SELECT tpc.* FROM trade_promotion_claims tpc JOIN trade_promotions tp ON tpc.promotion_id = tp.id WHERE tpc.id = ? AND tp.tenant_id = ?').bind(id, tenantId).first();
  if (!claim) return c.json({ success: false, message: 'Claim not found' }, 404);

  await db.prepare("UPDATE trade_promotion_claims SET status = 'APPROVED', approved_by = ?, approved_at = datetime('now') WHERE id = ?").bind(userId, id).run();

  // Update promotion spent
  await db.prepare('UPDATE trade_promotions SET actual_spend = COALESCE(actual_spend, 0) + ? WHERE id = ?').bind((claim.amount || 0), claim.promotion_id).run();

  // Update enrollment achieved value
  await db.prepare('UPDATE trade_promotion_enrollments SET achieved_value = achieved_value + ? WHERE promotion_id = ? AND customer_id = ?').bind((claim.amount || 0), claim.promotion_id, claim.customer_id).run();

  return c.json({ success: true, message: 'Claim approved' });
});

app.put('/trade-promotion-claims/:id/reject', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { reason } = await c.req.json();
  await db.prepare("UPDATE trade_promotion_claims SET status = 'REJECTED', approved_by = ?, approved_at = datetime('now') WHERE id = ?").bind(userId, id).run();
  return c.json({ success: true, message: 'Claim rejected' });
});

// K.4 Compliance Audits
app.post('/trade-promotions/:id/audits', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();

  const auditId = uuidv4();
  await db.prepare('INSERT INTO trade_promotion_audits (id, promotion_id, customer_id, audited_by, audit_date, compliance_score, findings, photo_urls) VALUES (?, ?, ?, ?, datetime("now"), ?, ?, ?)').bind(auditId, id, body.customer_id, userId, body.compliance_score || 0, body.findings || null, body.photo_urls ? JSON.stringify(body.photo_urls) : null).run();

  return c.json({ success: true, data: { id: auditId }, message: 'Audit recorded' }, 201);
});

// K.5 ROI Calculation
app.get('/trade-promotions/:id/roi', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();

  const promo = await db.prepare('SELECT * FROM trade_promotions WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!promo) return c.json({ success: false, message: 'Promotion not found' }, 404);

  // Calculate incremental revenue from enrolled customers during promo period
  const enrolledCustomers = await db.prepare('SELECT customer_id FROM trade_promotion_enrollments WHERE promotion_id = ? LIMIT 500').bind(id).all();
  const customerIds = (enrolledCustomers.results || []).map(e => e.customer_id);

  let incrementalRevenue = 0;
  let baselineRevenue = 0;
  if (customerIds.length > 0) {
    for (const cid of customerIds) {
      // Revenue during promo
      const duringPromo = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as rev FROM sales_orders WHERE tenant_id = ? AND customer_id = ? AND created_at >= ? AND created_at <= ? AND status != 'CANCELLED'").bind(tenantId, cid, promo.start_date, promo.end_date).first();
      // Baseline (same period before promo)
      const daysDiff = Math.ceil((new Date(promo.end_date) - new Date(promo.start_date)) / 86400000);
      const baseStart = new Date(new Date(promo.start_date).getTime() - daysDiff * 86400000).toISOString();
      const baseEnd = promo.start_date;
      const beforePromo = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as rev FROM sales_orders WHERE tenant_id = ? AND customer_id = ? AND created_at >= ? AND created_at <= ? AND status != 'CANCELLED'").bind(tenantId, cid, baseStart, baseEnd).first();
      incrementalRevenue += (duringPromo?.rev || 0);
      baselineRevenue += (beforePromo?.rev || 0);
    }
  }

  const lift = baselineRevenue > 0 ? ((incrementalRevenue - baselineRevenue) / baselineRevenue * 100) : 0;
  const roi = (promo.actual_spend || 0) > 0 ? ((incrementalRevenue - baselineRevenue - (promo.actual_spend || 0)) / (promo.actual_spend || 0) * 100) : 0;

  return c.json({ success: true, data: {
    promotion_id: id,
    budget: promo.budget,
    spent: (promo.actual_spend || 0),
    enrolled_customers: customerIds.length,
    baseline_revenue: baselineRevenue,
    promo_revenue: incrementalRevenue,
    incremental_revenue: incrementalRevenue - baselineRevenue,
    revenue_lift_pct: Math.round(lift * 100) / 100,
    roi_pct: Math.round(roi * 100) / 100,
    cost_per_incremental_sale: (incrementalRevenue - baselineRevenue) > 0 ? Math.round((promo.actual_spend || 0) / (incrementalRevenue - baselineRevenue) * 100) / 100 : 0
  }});
});

export default app;
