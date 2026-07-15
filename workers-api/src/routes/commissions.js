import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../lib/middleware.js';
import { canSeeMoney } from '../lib/capabilities.js';
import { v4 as uuidv4 } from 'uuid';

const app = new Hono();

// ==================== COMMISSIONS ALIASES ====================
app.get('/commissions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { page = '1', limit = '20', status } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE ce.tenant_id = ?';
  const params = [tenantId];
  // Money rule: all field roles see only their OWN earnings, not just role === 'agent'.
  if (!canSeeMoney(role)) { where += ' AND ce.earner_id = ?'; params.push(userId); }
  if (status) { where += ' AND ce.status = ?'; params.push(status); }
  const total = await db.prepare('SELECT COUNT(*) as count FROM commission_earnings ce ' + where).bind(...params).first();
  const commissions = await db.prepare("SELECT ce.*, u.first_name || ' ' || u.last_name as earner_name, cr.name as rule_name FROM commission_earnings ce LEFT JOIN users u ON ce.earner_id = u.id LEFT JOIN commission_rules cr ON ce.rule_id = cr.id " + where + " ORDER BY ce.created_at DESC LIMIT ? OFFSET ?").bind(...params, parseInt(limit), offset).all();
  return c.json({ data: commissions.results || [], total: total?.count || 0, page: parseInt(page), limit: parseInt(limit) });
});

app.get('/commissions/stats', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { start, end } = c.req.query();
  let dateFilter = '';
  let joinedDateFilter = '';
  const baseParams = [tenantId];
  if (start && end) { dateFilter = ' AND created_at >= ? AND created_at <= ?'; joinedDateFilter = ' AND ce.created_at >= ? AND ce.created_at <= ?'; baseParams.push(start, end + 'T23:59:59'); }
  const [totalAmt, pendingAmt, approvedAmt, paidAmt, totalCount, pendingCount, approvedCount, paidCount, topEarners, byType] = await Promise.all([
    db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ?' + dateFilter).bind(...baseParams).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'pending'" + dateFilter).bind(...baseParams).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'approved'" + dateFilter).bind(...baseParams).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'paid'" + dateFilter).bind(...baseParams).first(),
    db.prepare('SELECT COUNT(*) as total FROM commission_earnings WHERE tenant_id = ?' + dateFilter).bind(...baseParams).first(),
    db.prepare("SELECT COUNT(*) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'pending'" + dateFilter).bind(...baseParams).first(),
    db.prepare("SELECT COUNT(*) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'approved'" + dateFilter).bind(...baseParams).first(),
    db.prepare("SELECT COUNT(*) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'paid'" + dateFilter).bind(...baseParams).first(),
    db.prepare("SELECT u.first_name || ' ' || u.last_name as name, u.role, COALESCE(SUM(ce.amount), 0) as total_commission, COUNT(*) as transaction_count FROM commission_earnings ce JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ?" + joinedDateFilter + " GROUP BY ce.earner_id ORDER BY total_commission DESC LIMIT 10").bind(...baseParams).all(),
    db.prepare("SELECT source_type as type, COALESCE(SUM(amount), 0) as amount, COUNT(*) as count FROM commission_earnings WHERE tenant_id = ?" + dateFilter + " GROUP BY source_type ORDER BY amount DESC").bind(...baseParams).all(),
  ]);
  return c.json({ success: true, data: {
    total_commissions: totalCount?.total || 0, pending_commissions: pendingCount?.total || 0,
    approved_commissions: approvedCount?.total || 0, paid_commissions: paidCount?.total || 0,
    total_amount: totalAmt?.total || 0, pending_amount: pendingAmt?.total || 0,
    approved_amount: approvedAmt?.total || 0, paid_amount: paidAmt?.total || 0,
    top_earners: topEarners.results || [], commissions_by_type: byType.results || [],
  }});
});

app.get('/commissions/rules', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const rules = await db.prepare('SELECT * FROM commission_rules WHERE tenant_id = ? ORDER BY name LIMIT 500').bind(tenantId).all();
  return c.json({ success: true, data: rules.results || [] });
});

app.post('/commissions/rules', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  // Accept both frontend format (rule_type, value) and backend format (source_type, rate)
  const name = body.name;
  const sourceType = body.source_type || body.rule_type || 'percentage';
  const rate = body.rate !== undefined ? body.rate : body.value || 0;
  const isActive = body.status === 'inactive' ? 0 : 1;
  await db.prepare('INSERT INTO commission_rules (id, tenant_id, name, source_type, rate, min_threshold, max_cap, product_filter, effective_from, effective_to, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, name, sourceType, rate, body.min_threshold || 0, body.max_cap || null, body.product_filter || null, body.effective_from || null, body.effective_to || null, isActive).run();
  return c.json({ success: true, data: { id, name, source_type: sourceType, rate, is_active: isActive } }, 201);
});

app.delete('/commissions/rules/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM commission_rules WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Commission rule deleted' });
});

app.get('/commissions/user/:userId', authMiddleware, async (c) => {
  const requesterId = c.get('userId');
  const role = c.get('role');
  const targetUserId = c.req.param('userId');
  // Money rule: manager is a field role — own pay only. Admin-equivalents see anyone's.
  const managerial = ['admin', 'super_admin', 'backoffice_admin', 'general_manager'].includes(role);
  if (targetUserId !== requesterId && !managerial) {
    return c.json({ success: false, message: 'Insufficient permissions' }, 403);
  }
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const commissions = await db.prepare("SELECT ce.*, cr.name as rule_name FROM commission_earnings ce LEFT JOIN commission_rules cr ON ce.rule_id = cr.id WHERE ce.tenant_id = ? AND ce.earner_id = ? ORDER BY ce.created_at DESC").bind(tenantId, targetUserId).all();
  return c.json(commissions.results || []);
});

app.get('/commissions/dashboard', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [total, pending, approved, paid, topEarners] = await Promise.all([
    db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'approved'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'paid'").bind(tenantId).first(),
    db.prepare("SELECT u.first_name || ' ' || u.last_name as name, COALESCE(SUM(ce.amount), 0) as total FROM commission_earnings ce JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ? GROUP BY ce.earner_id ORDER BY total DESC LIMIT 10").bind(tenantId).all(),
  ]);
  return c.json({ success: true, data: { total: total?.total || 0, pending: pending?.total || 0, approved: approved?.total || 0, paid: paid?.total || 0, top_earners: topEarners.results || [] } });
});

app.get('/commissions/payouts', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  // Money rule: field roles get only their OWN payout history.
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];
  if (!canSeeMoney(c.get('role'))) { where += ' AND earner_id = ?'; params.push(c.get('userId')); }
  const payouts = await db.prepare('SELECT * FROM commission_payouts ' + where + ' ORDER BY created_at DESC LIMIT 100').bind(...params).all();
  return c.json({ success: true, data: payouts.results || [] });
});

app.get('/commissions/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const commission = await db.prepare("SELECT ce.*, u.first_name || ' ' || u.last_name as earner_name, cr.name as rule_name FROM commission_earnings ce LEFT JOIN users u ON ce.earner_id = u.id LEFT JOIN commission_rules cr ON ce.rule_id = cr.id WHERE ce.id = ? AND ce.tenant_id = ?").bind(id, tenantId).first();
  if (!commission) return c.json({ success: false, message: 'Commission not found' }, 404);
  // Money rule: field roles may only read their own earning rows.
  if (!canSeeMoney(c.get('role')) && commission.earner_id !== c.get('userId')) {
    return c.json({ success: false, message: 'Insufficient permissions' }, 403);
  }
  return c.json(commission);
});

app.post('/commissions/calculate', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { order_id } = await c.req.json();
  const order = await db.prepare('SELECT * FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(order_id, tenantId).first();
  if (!order) return c.json({ success: false, message: 'Order not found' }, 404);
  const rules = await db.prepare("SELECT * FROM commission_rules WHERE tenant_id = ? AND is_active = 1").bind(tenantId).all();
  let totalCommission = 0;
  for (const rule of (rules.results || [])) {
    let amount = 0;
    const ruleType = rule.source_type || rule.calculation_type || 'percentage';
    if (ruleType === 'percentage') amount = (order.total_amount * rule.rate) / 100;
    else if (ruleType === 'flat') amount = rule.rate;
    else amount = (order.total_amount * rule.rate) / 100;
    if (amount > 0) {
      const id = uuidv4();
      await db.prepare("INSERT INTO commission_earnings (id, tenant_id, earner_id, rule_id, source_type, source_id, amount, status, created_at) VALUES (?, ?, ?, ?, 'order', ?, ?, 'pending', CURRENT_TIMESTAMP)").bind(id, tenantId, order.agent_id, rule.id, order_id, amount).run();
      totalCommission += amount;
    }
  }
  return c.json({ success: true, message: 'Commission calculated', total: totalCommission });
});

app.post('/commissions/pay', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { commission_ids } = await c.req.json();
  if (!commission_ids || !Array.isArray(commission_ids)) return c.json({ success: false, message: 'commission_ids required' }, 400);
  for (const cid of commission_ids) {
    await db.prepare("UPDATE commission_earnings SET status = 'paid', approved_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").bind(cid, tenantId).run();
  }
  return c.json({ message: 'Commissions marked as paid', count: commission_ids.length });
});

export default app;
