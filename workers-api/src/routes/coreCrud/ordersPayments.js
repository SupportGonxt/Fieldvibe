import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../../lib/middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { validate, createSalesOrderSchema } from '../../validate.js';

const app = new Hono();

// Writes a RECEIPT + APPLICATION pair to payment_ledger to mirror a payments INSERT.
// Best-effort: a ledger failure must NEVER fail the payments write that drives
// existing dashboards. The opt-in /admin/payments/backfill-ledger endpoint can
// repair any gaps after the fact.
async function writePaymentLedgerEntries(db, { tenantId, paymentId, salesOrderId, amount, userId, notes, currency }) {
  try {
    if (!tenantId || !paymentId || amount == null) return;
    const amt = Number(amount) || 0;
    if (!Number.isFinite(amt) || amt === 0) return;
    const cur = currency || 'ZAR';
    const receiptId = uuidv4();
    const stmts = [
      db.prepare(
        'INSERT INTO payment_ledger (id, tenant_id, payment_id, sales_order_id, entry_type, direction, amount, currency, notes, created_by) ' +
        "VALUES (?, ?, ?, NULL, 'RECEIPT', 'CREDIT', ?, ?, ?, ?)"
      ).bind(receiptId, tenantId, paymentId, Math.abs(amt), cur, notes || null, userId || 'system'),
    ];
    if (salesOrderId) {
      stmts.push(
        db.prepare(
          'INSERT INTO payment_ledger (id, tenant_id, payment_id, sales_order_id, entry_type, direction, amount, currency, notes, created_by) ' +
          "VALUES (?, ?, ?, ?, 'APPLICATION', 'CREDIT', ?, ?, ?, ?)"
        ).bind(uuidv4(), tenantId, paymentId, salesOrderId, Math.abs(amt), cur, notes || null, userId || 'system'),
      );
    }
    await db.batch(stmts);
  } catch (err) {
    console.error('payment_ledger write failed for payment', paymentId, err && err.message);
  }
}

// ==================== GOALS ====================
app.get('/goals', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const goals = await db.prepare('SELECT * FROM goals WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 500').bind(tenantId).all();
  return c.json({ success: true, data: goals.results || [] });
});

app.post('/goals', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO goals (id, tenant_id, title, description, goal_type, target_value, start_date, end_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.title, body.description || null, body.goal_type || 'visits', body.target_value, body.start_date || null, body.end_date || null, 'active', userId).run();
  if (body.assigned_users && Array.isArray(body.assigned_users)) {
    for (const uid of body.assigned_users) {
      const gaId = uuidv4();
      await db.prepare('INSERT INTO goal_assignments (id, goal_id, user_id, target_value) VALUES (?, ?, ?, ?)').bind(gaId, id, uid, body.target_value).run();
    }
  }
  return c.json({ success: true, data: { id } }, 201);
});

app.put('/goals/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE goals SET title = COALESCE(?, title), description = COALESCE(?, description), target_value = COALESCE(?, target_value), current_value = COALESCE(?, current_value), status = COALESCE(?, status), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.title || null, body.description || null, body.target_value || null, body.current_value || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'Goal updated' });
});

// ==================== SALES ORDERS ====================
app.get('/sales-orders', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { limit = 50, page = 1, status, agent_id, customer_id, start_date, end_date, search } = c.req.query();
  let where = 'WHERE so.tenant_id = ?';
  const params = [tenantId];
  if (role === 'agent') { where += ' AND so.agent_id = ?'; params.push(userId); }
  if (agent_id) { where += ' AND so.agent_id = ?'; params.push(agent_id); }
  if (customer_id) { where += ' AND so.customer_id = ?'; params.push(customer_id); }
  if (status) { where += ' AND so.status = ?'; params.push(status); }
  if (start_date) { where += ' AND so.created_at >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND so.created_at <= ?'; params.push(end_date); }
  if (search) { where += ' AND (so.order_number LIKE ? OR c.name LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const countR = await db.prepare('SELECT COUNT(*) as total FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id ' + where).bind(...params).first();
  const total = countR ? countR.total : 0;
  const orders = await db.prepare("SELECT so.*, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id LEFT JOIN users u ON so.agent_id = u.id " + where + ' ORDER BY so.created_at DESC LIMIT ? OFFSET ?').bind(...params, limitNum, offset).all();
  return c.json({ success: true, data: { orders: orders.results || [], pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } } });
});

app.get('/sales-orders/stats', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { start_date, end_date } = c.req.query();
  let dateFilter = '';
  const params = [tenantId];
  if (start_date) { dateFilter += ' AND created_at >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND created_at <= ?'; params.push(end_date); }
  const [totalOrders, totalRevenue, byStatus, byPayment] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ?' + dateFilter).bind(...params).first(),
    db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ?' + dateFilter).bind(...params).first(),
    db.prepare('SELECT status, COUNT(*) as count FROM sales_orders WHERE tenant_id = ?' + dateFilter + ' GROUP BY status').bind(...params).all(),
    db.prepare('SELECT payment_status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ?' + dateFilter + ' GROUP BY payment_status').bind(...params).all(),
  ]);
  return c.json({ success: true, data: { totalOrders: totalOrders ? totalOrders.count : 0, totalRevenue: totalRevenue ? totalRevenue.total : 0, byStatus: byStatus.results || [], byPayment: byPayment.results || [] } });
});

app.get('/sales-orders/dashboard', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [total, revenue, byStatus, recent] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND status != 'CANCELLED' AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare('SELECT status, COUNT(*) as count FROM sales_orders WHERE tenant_id = ? GROUP BY status').bind(tenantId).all(),
    db.prepare('SELECT so.*, c.name as customer_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE so.tenant_id = ? ORDER BY so.created_at DESC LIMIT 10').bind(tenantId).all(),
  ]);
  return c.json({ success: true, data: { total_orders: total?.count || 0, total_revenue: revenue?.total || 0, by_status: byStatus.results || [], recent_orders: recent.results || [] } });
});

app.get('/sales-orders/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const order = await db.prepare("SELECT so.*, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id LEFT JOIN users u ON so.agent_id = u.id WHERE so.id = ? AND so.tenant_id = ?").bind(id, tenantId).first();
  if (!order) return c.json({ success: false, message: 'Order not found' }, 404);
  const items = await db.prepare('SELECT soi.*, p.name as product_name, p.code as product_code FROM sales_order_items soi JOIN sales_orders so ON soi.sales_order_id = so.id LEFT JOIN products p ON soi.product_id = p.id WHERE soi.sales_order_id = ? AND so.tenant_id = ? LIMIT 500').bind(id, tenantId).all();
  const payments = await db.prepare('SELECT * FROM payments WHERE sales_order_id = ? AND tenant_id = ? LIMIT 500').bind(id, tenantId).all();
  return c.json({ success: true, data: { ...order, items: items.results || [], payments: payments.results || [] } });
});

app.post('/sales-orders', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  const orderNumber = 'SO-' + uuidv4().slice(0,8).toUpperCase().toUpperCase();
  let subtotal = 0;
  if (body.items && Array.isArray(body.items)) {
    for (const item of body.items) {
      subtotal += (item.quantity || 0) * (item.unit_price || 0);
    }
  }
  const taxAmount = subtotal * ((body.tax_rate || 15) / 100);
  const discountAmount = body.discount_amount || 0;
  const totalAmount = subtotal + taxAmount - discountAmount;
  await db.prepare('INSERT INTO sales_orders (id, tenant_id, order_number, agent_id, customer_id, visit_id, order_type, status, subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status, notes, gps_latitude, gps_longitude, van_stock_load_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, orderNumber, body.agent_id || userId, body.customer_id || null, body.visit_id || null, body.order_type || 'direct_sale', 'confirmed', subtotal, taxAmount, discountAmount, totalAmount, body.payment_method || null, 'pending', body.notes || null, body.gps_latitude || null, body.gps_longitude || null, body.van_stock_load_id || null).run();
  if (body.items && Array.isArray(body.items)) {
    for (const item of body.items) {
      const itemId = uuidv4();
      const lineTotal = (item.quantity || 0) * (item.unit_price || 0) * (1 - (item.discount_percent || 0) / 100);
      await db.prepare('INSERT INTO sales_order_items (id, sales_order_id, product_id, quantity, unit_price, discount_percent, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(itemId, id, item.product_id, item.quantity || 0, item.unit_price || 0, item.discount_percent || 0, lineTotal).run();
    }
  }
  // Auto-trigger commission calculation
  try {
    const rules = await db.prepare("SELECT * FROM commission_rules WHERE tenant_id = ? AND source_type = 'sales_order' AND is_active = 1").bind(tenantId).all();
    for (const rule of (rules.results || [])) {
      const commAmount = totalAmount * (rule.rate / 100);
      if (commAmount > 0) {
        const ceId = uuidv4();
        await db.prepare("INSERT INTO commission_earnings (id, tenant_id, earner_id, source_type, source_id, rule_id, rate, base_amount, amount, status, created_at) VALUES (?, ?, ?, 'sales_order', ?, ?, ?, ?, ?, 'pending', datetime('now'))").bind(ceId, tenantId, body.agent_id || userId, id, rule.id, rule.rate, totalAmount, commAmount).run();
      }
    }
  } catch(e) { console.error('Commission calc error:', e); }
  return c.json({ success: true, data: { id, order_number: orderNumber, total_amount: totalAmount }, message: 'Order created' }, 201);
});

app.put('/sales-orders/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE sales_orders SET status = COALESCE(?, status), payment_status = COALESCE(?, payment_status), notes = COALESCE(?, notes), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.status || null, body.payment_status || null, body.notes || null, id, tenantId).run();
  return c.json({ success: true, message: 'Order updated' });
});

app.put('/sales-orders/:id/cancel', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  let reason = 'Order cancelled';
  try { const body = await c.req.json(); if (body && typeof body.reason === 'string' && body.reason.trim()) reason = body.reason.trim(); } catch { /* body optional */ }

  // Idempotency: skip if already cancelled so auto-reversals don't double-fire.
  const order = await db.prepare('SELECT id, status FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!order) return c.json({ success: false, message: 'Order not found' }, 404);
  if (order.status === 'cancelled') return c.json({ success: true, message: 'Order already cancelled' });

  await db.prepare("UPDATE sales_orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();

  // Auto-reverse commissions tied to this order. Only approved/paid earnings need a reversal sibling row;
  // pending/disputed are simply marked rejected so they never become payable.
  try {
    const earnings = await db.prepare("SELECT id, earner_id, source_type, source_id, rule_id, rate, base_amount, amount, status FROM commission_earnings WHERE tenant_id = ? AND source_id = ? AND status IN ('pending', 'disputed', 'approved', 'paid')").bind(tenantId, id).all();
    for (const e of (earnings.results || [])) {
      if (e.status === 'pending' || e.status === 'disputed') {
        await db.prepare("UPDATE commission_earnings SET status = 'rejected', rejection_reason = ?, approved_by = ?, approved_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind('Auto: ' + reason, userId, e.id, tenantId).run();
      } else {
        const reversalId = uuidv4();
        await db.batch([
          db.prepare("INSERT INTO commission_earnings (id, tenant_id, earner_id, source_type, source_id, rule_id, rate, base_amount, amount, status, reversal_of, reversal_reason, reversed_by, reversed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'reversed', ?, ?, ?, datetime('now'), datetime('now'))").bind(
            reversalId, tenantId, e.earner_id, e.source_type, e.source_id, e.rule_id, e.rate, e.base_amount, -Math.abs(e.amount || 0), e.id, 'Auto: ' + reason, userId
          ),
          db.prepare("UPDATE commission_earnings SET status = 'reversed', reversal_reason = ?, reversed_by = ?, reversed_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind('Auto: ' + reason, userId, e.id, tenantId)
        ]);
      }
    }
  } catch (err) {
    // Don't fail the cancel if commission lookup blows up — log and continue.
    console.error('Commission auto-reverse failed for order', id, err && err.message);
  }

  return c.json({ success: true, message: 'Order cancelled' });
});

// ==================== PAYMENTS ====================
app.get('/payments', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { sales_order_id, status, limit = 50, page = 1 } = c.req.query();
  let where = 'WHERE p.tenant_id = ?';
  const params = [tenantId];
  if (sales_order_id) { where += ' AND p.sales_order_id = ?'; params.push(sales_order_id); }
  if (status) { where += ' AND p.status = ?'; params.push(status); }
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const payments = await db.prepare('SELECT p.*, so.order_number FROM payments p LEFT JOIN sales_orders so ON p.sales_order_id = so.id ' + where + ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?').bind(...params, limitNum, offset).all();
  return c.json({ success: true, data: payments.results || [] });
});

app.post('/payments', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare("INSERT INTO payments (id, tenant_id, sales_order_id, amount, method, reference, status) VALUES (?, ?, ?, ?, ?, ?, 'completed')").bind(id, tenantId, body.sales_order_id, body.amount, body.method || 'cash', body.reference || null).run();
  // Mirror to the payment_ledger for the item-#3 ledger view. Best-effort.
  await writePaymentLedgerEntries(db, { tenantId, paymentId: id, salesOrderId: body.sales_order_id, amount: body.amount, userId, notes: body.reference || null });
  // Update order payment status
  const order = await db.prepare('SELECT total_amount FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(body.sales_order_id, tenantId).first();
  const totalPaid = await db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE sales_order_id = ? AND tenant_id = ?').bind(body.sales_order_id, tenantId).first();
  if (order && totalPaid) {
    const newStatus = totalPaid.total >= order.total_amount ? 'paid' : 'partial';
    await db.prepare("UPDATE sales_orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(newStatus, body.sales_order_id, tenantId).run();
  }
  return c.json({ success: true, data: { id }, message: 'Payment recorded' }, 201);
});
app.get('/sales-orders/:id/ledger', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const order = await db.prepare('SELECT total_amount FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!order) return c.json({ success: false, message: 'Order not found' }, 404);
  const rows = await db.prepare('SELECT * FROM payment_ledger WHERE tenant_id = ? AND sales_order_id = ? ORDER BY created_at ASC, id ASC').bind(tenantId, id).all();
  const list = rows.results || [];
  let applied = 0;
  for (const r of list) {
    if (r.entry_type === 'APPLICATION') applied += Number(r.amount || 0);
    if (r.entry_type === 'REVERSAL') applied -= Number(r.amount || 0);
  }
  return c.json({
    success: true,
    data: {
      total_amount: Number(order.total_amount || 0),
      applied,
      outstanding: Math.max(0, Number(order.total_amount || 0) - applied),
      entries: list,
    },
  });
});
// ==================== WAREHOUSES & STOCK ====================
app.get('/warehouses', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const warehouses = await db.prepare('SELECT * FROM warehouses WHERE tenant_id = ? ORDER BY name LIMIT 500').bind(tenantId).all();
  return c.json({ success: true, data: warehouses.results || [] });
});

app.post('/warehouses', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO warehouses (id, tenant_id, name, code, type, address, latitude, longitude, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.code || body.name.slice(0, 5).toUpperCase(), body.type || 'main', body.address || null, body.latitude || null, body.longitude || null, 'active').run();
  return c.json({ success: true, data: { id } }, 201);
});

app.put('/warehouses/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE warehouses SET name = COALESCE(?, name), address = COALESCE(?, address), status = COALESCE(?, status) WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.address || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'Warehouse updated' });
});

// Stock levels
app.get('/stock-levels', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { warehouse_id, product_id, low_stock } = c.req.query();
  let query = 'SELECT sl.*, p.name as product_name, p.code as product_code, p.price, w.name as warehouse_name FROM stock_levels sl LEFT JOIN products p ON sl.product_id = p.id LEFT JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ?';
  const params = [tenantId];
  if (warehouse_id) { query += ' AND sl.warehouse_id = ?'; params.push(warehouse_id); }
  if (product_id) { query += ' AND sl.product_id = ?'; params.push(product_id); }
  if (low_stock === 'true') { query += ' AND sl.quantity <= sl.reorder_level'; }
  query += ' ORDER BY p.name';
  const levels = await db.prepare(query).bind(...params).all();
  return c.json({ success: true, data: levels.results || [] });
});

app.post('/stock-levels', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO stock_levels (id, tenant_id, warehouse_id, product_id, quantity, reserved_quantity, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.warehouse_id, body.product_id, body.quantity || 0, body.reserved_quantity || 0, body.reorder_level || 10).run();
  return c.json({ success: true, data: { id } }, 201);
});

app.put('/stock-levels/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE stock_levels SET quantity = COALESCE(?, quantity), reserved_quantity = COALESCE(?, reserved_quantity), reorder_level = COALESCE(?, reorder_level), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.quantity !== undefined ? body.quantity : null, body.reserved_quantity !== undefined ? body.reserved_quantity : null, body.reorder_level !== undefined ? body.reorder_level : null, id, tenantId).run();
  return c.json({ success: true, message: 'Stock level updated' });
});

// Stock movements
app.get('/stock-movements', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { warehouse_id, product_id, movement_type, limit = 50, page = 1 } = c.req.query();
  let where = 'WHERE sm.tenant_id = ?';
  const params = [tenantId];
  if (warehouse_id) { where += ' AND sm.warehouse_id = ?'; params.push(warehouse_id); }
  if (product_id) { where += ' AND sm.product_id = ?'; params.push(product_id); }
  if (movement_type) { where += ' AND sm.movement_type = ?'; params.push(movement_type); }
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const movements = await db.prepare('SELECT sm.*, p.name as product_name, w.name as warehouse_name FROM stock_movements sm LEFT JOIN products p ON sm.product_id = p.id LEFT JOIN warehouses w ON sm.warehouse_id = w.id ' + where + ' ORDER BY sm.created_at DESC LIMIT ? OFFSET ?').bind(...params, limitNum, offset).all();
  return c.json({ success: true, data: movements.results || [] });
});

app.post('/stock-movements', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.warehouse_id || null, body.product_id, body.movement_type, body.quantity, body.reference_type || null, body.reference_id || null, body.notes || null, userId).run();
  // Update stock level
  if (body.warehouse_id) {
    const existing = await db.prepare('SELECT id, quantity FROM stock_levels WHERE warehouse_id = ? AND product_id = ? AND tenant_id = ?').bind(body.warehouse_id, body.product_id, tenantId).first();
    const delta = ['in', 'received', 'return'].includes(body.movement_type) ? body.quantity : -body.quantity;
    if (existing) {
      if (delta < 0 && existing.quantity + delta < 0) return c.json({ success: false, message: 'Insufficient stock. Available: ' + existing.quantity }, 400);
      await db.prepare('UPDATE stock_levels SET quantity = MAX(0, quantity + ?), updated_at = datetime("now") WHERE id = ?').bind(delta, existing.id).run();
    } else {
      const slId = uuidv4();
      await db.prepare('INSERT INTO stock_levels (id, tenant_id, warehouse_id, product_id, quantity) VALUES (?, ?, ?, ?, ?)').bind(slId, tenantId, body.warehouse_id, body.product_id, Math.max(0, delta)).run();
    }
  }
  return c.json({ success: true, data: { id }, message: 'Stock movement recorded' }, 201);
});
// ==================== ORDERS ALIASES (frontend uses /orders, API has /sales-orders) ====================
app.get('/orders', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { page = '1', limit = '20', status, customer_id, search } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE so.tenant_id = ?';
  const params = [tenantId];
  if (role === 'agent') { where += ' AND so.agent_id = ?'; params.push(userId); }
  if (status) { where += ' AND so.status = ?'; params.push(status); }
  if (customer_id) { where += ' AND so.customer_id = ?'; params.push(customer_id); }
  if (search) { where += ' AND (so.order_number LIKE ? OR c.name LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  const total = await db.prepare('SELECT COUNT(*) as count FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id ' + where).bind(...params).first();
  const orders = await db.prepare('SELECT so.*, c.name as customer_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id ' + where + ' ORDER BY so.created_at DESC LIMIT ? OFFSET ?').bind(...params, parseInt(limit), offset).all();
  return c.json({ success: true, data: orders.results || [], total: total?.count || 0, page: parseInt(page), limit: parseInt(limit) });
});

app.get('/orders/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [total, pending, completed, revenue] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND status = 'completed'").bind(tenantId).first(),
    db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ?').bind(tenantId).first(),
  ]);
  return c.json({ total: total?.count || 0, pending: pending?.count || 0, completed: completed?.count || 0, total_revenue: revenue?.total || 0 });
});

app.get('/orders/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const order = await db.prepare('SELECT so.*, c.name as customer_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE so.id = ? AND so.tenant_id = ?').bind(id, tenantId).first();
  if (!order) return c.json({ success: false, message: 'Order not found' }, 404);
  const items = await db.prepare('SELECT soi.*, p.name as product_name FROM sales_order_items soi JOIN sales_orders so ON soi.sales_order_id = so.id LEFT JOIN products p ON soi.product_id = p.id WHERE soi.sales_order_id = ? AND so.tenant_id = ? LIMIT 500').bind(id, tenantId).all();
  return c.json({ success: true, data: { ...order, items: items.results || [] } });
});

app.post('/orders', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  const orderNum = 'ORD-' + Date.now();
  await db.prepare('INSERT INTO sales_orders (id, tenant_id, order_number, customer_id, agent_id, status, total_amount, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(id, tenantId, orderNum, body.customer_id, userId, 'pending', body.total_amount || 0, body.notes || '').run();
  if (body.items && Array.isArray(body.items)) {
    for (const item of body.items) {
      await db.prepare('INSERT INTO sales_order_items (id, sales_order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)').bind(uuidv4(), id, item.product_id, item.quantity || 0, item.unit_price || 0, (item.quantity || 0) * (item.unit_price || 0)).run();
    }
  }
  return c.json({ success: true, data: { id, order_number: orderNum }, message: 'Order created' }, 201);
});

app.put('/orders/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(body)) {
    if (['status', 'notes', 'total_amount', 'payment_status', 'payment_method', 'delivery_date', 'customer_id'].includes(k)) { sets.push(k + ' = ?'); vals.push(v); }
  }
  if (sets.length === 0) return c.json({ success: false, message: 'No valid fields' }, 400);
  await db.prepare('UPDATE sales_orders SET ' + sets.join(', ') + ', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?').bind(...vals, id, tenantId).run();
  return c.json({ success: true, message: 'Order updated' });
});

app.delete('/orders/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM sales_order_items WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE id = ? AND tenant_id = ?)').bind(id, tenantId).run();
  await db.prepare('DELETE FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Order deleted' });
});

app.get('/orders/:id/items', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const items = await db.prepare('SELECT soi.*, p.name as product_name, p.code as product_code FROM sales_order_items soi JOIN sales_orders so ON soi.sales_order_id = so.id LEFT JOIN products p ON soi.product_id = p.id WHERE soi.sales_order_id = ? AND so.tenant_id = ? LIMIT 500').bind(id, tenantId).all();
  return c.json(items.results || []);
});

app.put('/orders/:id/status', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const { status } = await c.req.json();
  await db.prepare('UPDATE sales_orders SET status = ? WHERE id = ? AND tenant_id = ?').bind(status, id, tenantId).run();
  return c.json({ success: true, message: 'Status updated' });
});

// ==================== MISSING ROUTE ALIASES (frontend compatibility) ====================

// POST /orders/create → delegates to the enhanced sales order engine (POST /sales/orders/create uses createSalesOrderSchema)
app.post('/orders/create', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const v = validate(createSalesOrderSchema, body);
  if (!v.valid) {
    return c.json({ success: false, message: 'Validation failed', errors: v.errors }, 400);
  }

  try {
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND tenant_id = ?').bind(body.customer_id, tenantId).first();
    if (!customer) return c.json({ success: false, message: 'Customer not found' }, 404);

    const resolvedItems = [];
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    const errors = [];

    for (let idx = 0; idx < (body.items || []).length; idx++) {
      const item = body.items[idx];
      const product = await db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').bind(item.product_id, tenantId).first();
      if (!product) { errors.push(`Item ${idx + 1}: product not found`); continue; }

      let unitPrice = item.unit_price || product.price || 0;
      const discountPct = Math.min(100, Math.max(0, item.discount ?? item.discount_percent ?? 0));
      const finalPrice = unitPrice * (1 - discountPct / 100);
      const qty = item.quantity || 1;
      const lineTotal = finalPrice * qty;
      const taxRate = product.tax_rate != null ? product.tax_rate : 15;
      const lineTax = lineTotal - (lineTotal / (1 + taxRate / 100));

      subtotal += lineTotal;
      totalTax += lineTax;
      totalDiscount += unitPrice * qty * (discountPct / 100);
      resolvedItems.push({ product_id: item.product_id, quantity: qty, unit_price: unitPrice, discount_percent: discountPct, line_total: lineTotal, product_name: product.name });
    }

    if (errors.length > 0) return c.json({ success: false, message: 'Validation failed', details: errors }, 400);
    if (resolvedItems.length === 0) return c.json({ success: false, message: 'No valid items' }, 400);

    const orderId = uuidv4();
    const orderNumber = 'SO-' + uuidv4().slice(0,8).toUpperCase();
    const paymentMethod = body.payment_method || 'CASH';
    const paymentStatus = paymentMethod === 'CREDIT' || paymentMethod === 'credit' ? 'PENDING' : 'PAID';

    const batchStatements = [];
    batchStatements.push(db.prepare('INSERT INTO sales_orders (id, tenant_id, order_number, agent_id, customer_id, order_type, status, subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))').bind(orderId, tenantId, orderNumber, userId, body.customer_id, body.order_type || 'direct_sale', 'CONFIRMED', subtotal, totalTax, totalDiscount, subtotal, paymentMethod, paymentStatus, body.notes || null));

    for (const item of resolvedItems) {
      batchStatements.push(db.prepare('INSERT INTO sales_order_items (id, sales_order_id, product_id, quantity, unit_price, discount_percent, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(uuidv4(), orderId, item.product_id, item.quantity, item.unit_price, item.discount_percent, item.line_total));
    }

    const auditId = uuidv4();
    batchStatements.push(db.prepare('INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(auditId, tenantId, userId, 'CREATE', 'SALES_ORDER', orderId, JSON.stringify({ order_number: orderNumber, total: subtotal, items: resolvedItems.length })));

    await db.batch(batchStatements);

    return c.json({ success: true, data: { id: orderId, order_number: orderNumber, total_amount: subtotal, payment_status: paymentStatus, items: resolvedItems } }, 201);
  } catch (error) {
    console.error('Order creation error:', error);
    return c.json({ success: false, message: 'Order creation failed: ' + error.message }, 500);
  }
});
app.post('/orders/:id/transition', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { new_status, notes } = await c.req.json();
  const order = await db.prepare('SELECT * FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!order) return c.json({ success: false, message: 'Order not found' }, 404);
  await db.prepare('UPDATE sales_orders SET status = ?, notes = COALESCE(?, notes), updated_at = datetime("now") WHERE id = ?').bind(new_status, notes || null, id).run();
  const auditId = uuidv4();
  await db.prepare('INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(auditId, tenantId, userId, 'STATUS_CHANGE', 'SALES_ORDER', id, JSON.stringify({ status: order.status }), JSON.stringify({ status: new_status, notes })).run();
  return c.json({ success: true, message: `Order transitioned to ${new_status}` });
});

// Order transitions history (frontend calls /orders/:id/transitions)
app.get('/orders/:id/transitions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const logs = await db.prepare("SELECT * FROM audit_log WHERE resource_type = 'SALES_ORDER' AND resource_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 100").bind(id, tenantId).all();
  return c.json({ success: true, data: logs.results || [] });
});

// Order history (frontend calls /orders/:id/history)
app.get('/orders/:id/history', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const logs = await db.prepare("SELECT * FROM audit_log WHERE resource_type = 'SALES_ORDER' AND resource_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 100").bind(id, tenantId).all();
  return c.json({ success: true, data: logs.results || [] });
});

// Order recalculate (frontend calls /orders/:id/recalculate)
app.post('/orders/:id/recalculate', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const { items } = await c.req.json();
  let subtotal = 0;
  let totalTax = 0;
  for (const item of (items || [])) {
    const product = await db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').bind(item.product_id, tenantId).first();
    const unitPrice = item.unit_price || (product ? product.price : 0) || 0;
    const qty = item.quantity || 1;
    const lineTotal = unitPrice * qty;
    const taxRate = product && product.tax_rate != null ? product.tax_rate : 15;
    totalTax += lineTotal - (lineTotal / (1 + taxRate / 100));
    subtotal += lineTotal;
  }
  return c.json({ success: true, data: { subtotal, tax: totalTax, total: subtotal } });
});

// ==================== INVOICES ====================

app.get('/invoices', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const invoices = await db.prepare('SELECT so.*, c.name as customer_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE so.tenant_id = ? AND so.order_type IN (?, ?) ORDER BY so.created_at DESC LIMIT 500').bind(tenantId, 'invoice', 'direct_sale').all();
  return c.json({ success: true, data: invoices.results || [] });
});

app.get('/invoices/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const invoice = await db.prepare('SELECT so.*, c.name as customer_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE so.id = ? AND so.tenant_id = ?').bind(id, tenantId).first();
  if (!invoice) return c.json({ success: false, message: 'Invoice not found' }, 404);
  const items = await db.prepare('SELECT soi.*, p.name as product_name FROM sales_order_items soi JOIN sales_orders so ON soi.sales_order_id = so.id LEFT JOIN products p ON soi.product_id = p.id WHERE soi.sales_order_id = ? AND so.tenant_id = ? LIMIT 500').bind(id, tenantId).all();
  return c.json({ success: true, data: { ...invoice, items: items.results || [] } });
});

app.post('/invoices/create', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  const invoiceNum = 'INV-' + Date.now().toString(36).toUpperCase();

  try {
    const batchStatements = [];
    let subtotal = 0;
    let taxTotal = 0;

    // Resolve items — unit_price is treated as tax-exclusive; tax derived from products.tax_rate
    const resolvedItems = [];
    for (const item of (body.items || [])) {
      const product = await db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').bind(item.product_id, tenantId).first();
      const unitPrice = item.unit_price || (product ? product.price : 0) || 0;
      const qty = item.quantity || 1;
      const lineTotal = unitPrice * qty;
      const taxRate = (item.tax_rate != null) ? item.tax_rate : (product && product.tax_rate != null ? product.tax_rate : 0);
      const lineTax = lineTotal * (taxRate / 100);
      subtotal += lineTotal;
      taxTotal += lineTax;
      resolvedItems.push({ product_id: item.product_id, quantity: qty, unit_price: unitPrice, line_total: lineTotal });
    }

    const discountAmount = Number(body.discount_amount) || 0;
    const totalAmount = subtotal + taxTotal - discountAmount;

    batchStatements.push(db.prepare('INSERT INTO sales_orders (id, tenant_id, order_number, agent_id, customer_id, order_type, status, subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))').bind(id, tenantId, invoiceNum, userId, body.customer_id, 'invoice', 'CONFIRMED', subtotal, taxTotal, discountAmount, totalAmount, body.payment_method || 'CASH', 'PENDING', body.notes || null));

    for (const item of resolvedItems) {
      batchStatements.push(db.prepare('INSERT INTO sales_order_items (id, sales_order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)').bind(uuidv4(), id, item.product_id, item.quantity, item.unit_price, item.line_total));
    }

    await db.batch(batchStatements);
    return c.json({ success: true, data: { id, invoice_number: invoiceNum, subtotal, tax_amount: taxTotal, discount_amount: discountAmount, total_amount: totalAmount } }, 201);
  } catch (error) {
    return c.json({ success: false, message: 'Invoice creation failed: ' + error.message }, 500);
  }
});

app.post('/invoices/:id/transition', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const { new_status, notes } = await c.req.json();
  const invoice = await db.prepare('SELECT * FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!invoice) return c.json({ success: false, message: 'Invoice not found' }, 404);
  await db.prepare('UPDATE sales_orders SET status = ?, notes = COALESCE(?, notes), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(new_status, notes || null, id, tenantId).run();
  return c.json({ success: true, message: `Invoice transitioned to ${new_status}` });
});

app.get('/invoices/:id/transitions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const logs = await db.prepare("SELECT * FROM audit_log WHERE resource_type = 'SALES_ORDER' AND resource_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 100").bind(id, tenantId).all();
  return c.json({ success: true, data: logs.results || [] });
});
// ==================== WAREHOUSE ADDITIONAL ROUTES ====================
app.get('/warehouses/:warehouseId/stock', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const warehouseId = c.req.param('warehouseId');
  const stock = await db.prepare("SELECT sl.*, p.name as product_name, p.code as product_code FROM stock_levels sl LEFT JOIN products p ON sl.product_id = p.id WHERE sl.tenant_id = ? AND sl.warehouse_id = ?").bind(tenantId, warehouseId).all();
  return c.json({ data: stock.results || [] });
});

app.get('/warehouses/stock/product/:productId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const productId = c.req.param('productId');
  const stock = await db.prepare("SELECT sl.*, w.name as warehouse_name FROM stock_levels sl LEFT JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ? AND sl.product_id = ?").bind(tenantId, productId).all();
  return c.json({ data: stock.results || [] });
});

app.post('/warehouses/:warehouseId/stock', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const warehouseId = c.req.param('warehouseId');
  const body = await c.req.json();
  const id = uuidv4();
  const existing = await db.prepare("SELECT id FROM stock_levels WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?").bind(tenantId, body.product_id, warehouseId).first();
  if (existing) {
    await db.prepare("UPDATE stock_levels SET quantity = ? WHERE id = ?").bind(body.quantity, existing.id).run();
    return c.json({ id: existing.id, message: 'Stock updated' });
  }
  await db.prepare("INSERT INTO stock_levels (id, tenant_id, product_id, warehouse_id, quantity, reorder_level) VALUES (?, ?, ?, ?, ?, ?)").bind(id, tenantId, body.product_id, warehouseId, body.quantity || 0, body.reorder_level || 10).run();
  return c.json({ id, message: 'Stock added' }, 201);
});

app.get('/warehouses/transfers', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const transfers = await db.prepare("SELECT * FROM stock_movements WHERE tenant_id = ? AND movement_type = 'transfer' ORDER BY created_at DESC").bind(tenantId).all();
  return c.json({ data: transfers.results || [] });
});

app.get('/warehouses/transfers/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const transfer = await db.prepare("SELECT * FROM stock_movements WHERE id = ? AND tenant_id = ? AND movement_type = 'transfer'").bind(id, tenantId).first();
  return transfer ? c.json(transfer) : c.json({ message: 'Not found' }, 404);
});

app.post('/warehouses/transfers', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare("INSERT INTO stock_movements (id, tenant_id, product_id, warehouse_id, movement_type, quantity, reference_id, reference_type, notes, created_by, created_at) VALUES (?, ?, ?, ?, 'transfer', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(id, tenantId, body.product_id, body.from_warehouse_id, body.quantity, 'TRF-' + Date.now(), 'transfer_to_' + (body.to_warehouse_id || ''), body.notes || '', userId).run();
  return c.json({ id, message: 'Transfer created' }, 201);
});

app.put('/warehouses/transfers/:id/status', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  await db.prepare("UPDATE stock_movements SET status = ? WHERE id = ? AND tenant_id = ?").bind(body.status, id, tenantId).run();
  return c.json({ success: true, message: 'Transfer status updated' });
});

app.get('/warehouses/:warehouseId/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const warehouseId = c.req.param('warehouseId');
  const [totalProducts, totalStock, lowStock] = await Promise.all([
    db.prepare("SELECT COUNT(DISTINCT product_id) as count FROM stock_levels WHERE tenant_id = ? AND warehouse_id = ?").bind(tenantId, warehouseId).first(),
    db.prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM stock_levels WHERE tenant_id = ? AND warehouse_id = ?").bind(tenantId, warehouseId).first(),
    db.prepare("SELECT COUNT(*) as count FROM stock_levels WHERE tenant_id = ? AND warehouse_id = ? AND quantity <= reorder_level").bind(tenantId, warehouseId).first(),
  ]);
  return c.json({ data: { total_products: totalProducts?.count || 0, total_stock: totalStock?.total || 0, low_stock: lowStock?.count || 0 }});
});
app.get('/payments/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [total, totalAmount] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM payments WHERE tenant_id = ?").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE tenant_id = ?").bind(tenantId).first(),
  ]);
  return c.json({ data: { total_payments: total?.count || 0, total_amount: totalAmount?.total || 0 }});
});

app.get('/payments/:paymentId/allocations', authMiddleware, async (c) => {
  return c.json({ data: [] });
});
app.get('/orders/:orderId/deliveries', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/orders/:orderId/deliveries/:deliveryId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/orders/:orderId/items/:itemId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/orders/:orderId/returns', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// orders-enhanced routes
app.get('/orders-enhanced/quotations', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/orders-enhanced/refunds', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/orders-enhanced/returns', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/orders/customer/:id', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/orders/salesman/:id', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/warehouses/:warehouseId/inventory', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/warehouses/:warehouseId/stock-movements', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

export default app;
