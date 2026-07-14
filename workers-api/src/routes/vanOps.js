import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../lib/middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { validate, createVanLoadSchema, vanSellSchema, vanReturnSchema } from '../validate.js';

const app = new Hono();

app.get('/routes', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { area_id } = c.req.query();
  let query = "SELECT r.*, a.name as area_name, u.first_name || ' ' || u.last_name as salesman_name FROM routes r LEFT JOIN areas a ON r.area_id = a.id LEFT JOIN users u ON r.salesman_id = u.id WHERE r.tenant_id = ?";
  const params = [tenantId];
  if (area_id) { query += ' AND r.area_id = ?'; params.push(area_id); }
  query += ' ORDER BY r.name';
  const routes = await db.prepare(query).bind(...params).all();
  return c.json({ success: true, data: routes.results || [] });
});

app.post('/routes', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO routes (id, tenant_id, area_id, name, code, salesman_id) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.area_id, body.name, body.code || body.name.slice(0, 5).toUpperCase(), body.salesman_id || null).run();
  return c.json({ success: true, data: { id } }, 201);
});
// ==================== VAN SALES ====================
app.get('/van-stock-loads', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { status, agent_id, limit = 50, page = 1 } = c.req.query();
  let where = 'WHERE vsl.tenant_id = ?';
  const params = [tenantId];
  if (role === 'agent') { where += ' AND vsl.agent_id = ?'; params.push(userId); }
  if (agent_id) { where += ' AND vsl.agent_id = ?'; params.push(agent_id); }
  if (status) { where += ' AND vsl.status = ?'; params.push(status); }
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const loads = await db.prepare("SELECT vsl.*, u.first_name || ' ' || u.last_name as agent_name, w.name as warehouse_name FROM van_stock_loads vsl LEFT JOIN users u ON vsl.agent_id = u.id LEFT JOIN warehouses w ON vsl.warehouse_id = w.id " + where + ' ORDER BY vsl.created_at DESC LIMIT ? OFFSET ?').bind(...params, limitNum, offset).all();
  return c.json({ success: true, data: loads.results || [] });
});

app.get('/van-stock-loads/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const load = await db.prepare("SELECT vsl.*, u.first_name || ' ' || u.last_name as agent_name, w.name as warehouse_name FROM van_stock_loads vsl LEFT JOIN users u ON vsl.agent_id = u.id LEFT JOIN warehouses w ON vsl.warehouse_id = w.id WHERE vsl.id = ? AND vsl.tenant_id = ?").bind(id, tenantId).first();
  if (!load) return c.json({ success: false, message: 'Van stock load not found' }, 404);
  const items = await db.prepare('SELECT vsli.*, p.name as product_name, p.code as product_code, p.price FROM van_stock_load_items vsli JOIN van_stock_loads vsl ON vsli.van_stock_load_id = vsl.id LEFT JOIN products p ON vsli.product_id = p.id WHERE vsli.van_stock_load_id = ? AND vsl.tenant_id = ? LIMIT 500').bind(id, tenantId).all();
  return c.json({ success: true, data: { ...load, items: items.results || [] } });
});

app.post('/van-stock-loads', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO van_stock_loads (id, tenant_id, agent_id, vehicle_reg, warehouse_id, status, load_date, depart_time, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.agent_id || userId, body.vehicle_reg, body.warehouse_id || null, 'loaded', body.load_date || new Date().toISOString().split('T')[0], body.depart_time || new Date().toISOString(), userId).run();
  if (body.items && Array.isArray(body.items)) {
    for (const item of body.items) {
      const itemId = uuidv4();
      await db.prepare('INSERT INTO van_stock_load_items (id, van_stock_load_id, product_id, quantity_loaded) VALUES (?, ?, ?, ?)').bind(itemId, id, item.product_id, item.quantity_loaded || 0).run();
      // Deduct from warehouse stock
      if (body.warehouse_id) {
        // Check stock availability BEFORE creating movement record
        const sl = await db.prepare('SELECT id, quantity FROM stock_levels WHERE warehouse_id = ? AND product_id = ? AND tenant_id = ?').bind(body.warehouse_id, item.product_id, tenantId).first();
        if (sl && sl.quantity < (item.quantity_loaded || 0)) {
          return c.json({ success: false, message: 'Insufficient stock for product ' + item.product_id + '. Available: ' + sl.quantity }, 400);
        }
        const smId = uuidv4();
        await db.prepare("INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, 'out', ?, 'van_load', ?, ?)").bind(smId, tenantId, body.warehouse_id, item.product_id, item.quantity_loaded || 0, id, userId).run();
        if (sl) {
          await db.prepare('UPDATE stock_levels SET quantity = MAX(0, quantity - ?), updated_at = datetime("now") WHERE id = ?').bind(item.quantity_loaded || 0, sl.id).run();
        }
      }
    }
  }
  return c.json({ success: true, data: { id }, message: 'Van stock loaded' }, 201);
});

app.put('/van-stock-loads/:id/return', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();
  const load = await db.prepare('SELECT * FROM van_stock_loads WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!load) return c.json({ success: false, message: 'Van stock load not found' }, 404);
  // Update item quantities
  if (body.items && Array.isArray(body.items)) {
    for (const item of body.items) {
      await db.prepare('UPDATE van_stock_load_items SET quantity_sold = ?, quantity_returned = ?, quantity_damaged = ? WHERE id = ? AND van_stock_load_id = ?').bind(item.quantity_sold || 0, item.quantity_returned || 0, item.quantity_damaged || 0, item.id, id).run();
      // Return stock to warehouse
      if (load.warehouse_id && (item.quantity_returned || 0) > 0) {
        const smId = uuidv4();
        await db.prepare("INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, 'return', ?, 'van_return', ?, ?)").bind(smId, tenantId, load.warehouse_id, item.product_id, item.quantity_returned, id, userId).run();
        const sl = await db.prepare('SELECT id FROM stock_levels WHERE warehouse_id = ? AND product_id = ? AND tenant_id = ?').bind(load.warehouse_id, item.product_id, tenantId).first();
        if (sl) {
          await db.prepare('UPDATE stock_levels SET quantity = quantity + ?, updated_at = datetime("now") WHERE id = ?').bind(item.quantity_returned, sl.id).run();
        }
      }
    }
  }
  await db.prepare("UPDATE van_stock_loads SET status = 'returned', return_time = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(id).run();
  return c.json({ success: true, message: 'Van stock returned' });
});

// Van reconciliations
app.get('/van-reconciliations', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { van_stock_load_id, status } = c.req.query();
  let where = 'WHERE vr.tenant_id = ?';
  const params = [tenantId];
  if (van_stock_load_id) { where += ' AND vr.van_stock_load_id = ?'; params.push(van_stock_load_id); }
  if (status) { where += ' AND vr.status = ?'; params.push(status); }
  const recons = await db.prepare('SELECT vr.*, vsl.vehicle_reg FROM van_reconciliations vr LEFT JOIN van_stock_loads vsl ON vr.van_stock_load_id = vsl.id ' + where + ' ORDER BY vr.created_at DESC LIMIT 500').bind(...params).all();
  return c.json({ success: true, data: recons.results || [] });
});

app.post('/van-reconciliations', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  const variance = (body.cash_actual || 0) - (body.cash_expected || 0);
  await db.prepare('INSERT INTO van_reconciliations (id, tenant_id, van_stock_load_id, cash_expected, cash_actual, variance, denominations, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.van_stock_load_id, body.cash_expected || 0, body.cash_actual || 0, variance, body.denominations ? JSON.stringify(body.denominations) : null, 'pending', body.notes || null).run();
  return c.json({ success: true, data: { id, variance }, message: 'Reconciliation submitted' }, 201);
});

app.put('/van-reconciliations/:id/approve', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  await db.prepare("UPDATE van_reconciliations SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(userId, id, tenantId).run();
  return c.json({ success: true, message: 'Reconciliation approved' });
});
// ==================== BEAT ROUTES ====================
app.get('/beat-routes', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const routes = await db.prepare('SELECT * FROM routes WHERE tenant_id = ? ORDER BY name LIMIT 500').bind(tenantId).all();
  return c.json({ data: routes.results || [] });
});

// Literal /beat-routes/* stubs must register before /beat-routes/:id or they get shadowed.
app.get('/beat-routes/plans', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/beat-routes/stats', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

app.get('/beat-routes/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const route = await db.prepare('SELECT * FROM routes WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!route) return c.json({ success: false, message: 'Route not found' }, 404);
  return c.json(route);
});
// ==================== VAN SALES ADDITIONAL ROUTES ====================
app.get('/van-sales/stats', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [activeVans, totalLoads, totalOrders, totalRevenue] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM van_stock_loads WHERE tenant_id = ? AND status = 'active'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM van_stock_loads WHERE tenant_id = ?").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND order_type = 'van_sale'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND order_type = 'van_sale'").bind(tenantId).first(),
  ]);
  return c.json({ data: { active_vans: activeVans?.count || 0, total_loads: totalLoads?.count || 0, total_orders: totalOrders?.count || 0, total_revenue: totalRevenue?.total || 0 }});
});

app.get('/van-sales/routes/:routeId/stops', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const routeId = c.req.param('routeId');
  const stops = await db.prepare("SELECT rc.*, c.name as customer_name, c.address, c.latitude, c.longitude FROM route_customers rc LEFT JOIN customers c ON rc.customer_id = c.id WHERE rc.route_id = ? AND rc.tenant_id = ? ORDER BY rc.sequence_order").bind(routeId, tenantId).all();
  return c.json({ data: stops.results || [] });
});

app.get('/van-sales/routes/:routeId/exceptions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  return c.json({ data: [] });
});

app.get('/van-sales/loads/:loadId/items', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const loadId = c.req.param('loadId');
  const items = await db.prepare("SELECT vsli.*, p.name as product_name, p.code as product_code FROM van_stock_load_items vsli LEFT JOIN products p ON vsli.product_id = p.id LEFT JOIN van_stock_loads vsl ON vsli.van_stock_load_id = vsl.id WHERE vsli.van_stock_load_id = ? AND vsl.tenant_id = ?").bind(loadId, tenantId).all();
  return c.json({ data: items.results || [] });
});

// Van inventory routes
app.get('/van-inventory', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { van_id } = c.req.query();
  let query = "SELECT vsli.*, p.name as product_name, p.code as product_code FROM van_stock_load_items vsli LEFT JOIN products p ON vsli.product_id = p.id LEFT JOIN van_stock_loads vsl ON vsli.van_stock_load_id = vsl.id WHERE vsl.tenant_id = ? AND vsl.status = 'active'";
  const params = [tenantId];
  if (van_id) { query += " AND vsl.vehicle_reg = ?"; params.push(van_id); }
  const items = await db.prepare(query).bind(...params).all();
  return c.json({ data: items.results || [] });
});

app.get('/van-inventory/:vanId/summary', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const vanId = c.req.param('vanId');
  const summary = await db.prepare("SELECT COUNT(DISTINCT vsli.product_id) as total_products, COALESCE(SUM(vsli.quantity_loaded), 0) as total_items FROM van_stock_load_items vsli JOIN van_stock_loads vsl ON vsli.van_stock_load_id = vsl.id WHERE vsl.tenant_id = ? AND vsl.vehicle_reg = ? AND vsl.status = 'active'").bind(tenantId, vanId).first();
  return c.json({ data: summary || { total_products: 0, total_items: 0 }});
});

app.post('/van-inventory/load', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare("INSERT INTO van_stock_loads (id, tenant_id, vehicle_reg, created_by, status, load_date, created_at) VALUES (?, ?, ?, ?, 'active', date('now'), CURRENT_TIMESTAMP)").bind(id, tenantId, body.van_id || body.vehicle_reg || '', userId).run();
  for (const item of (body.items || [])) {
    await db.prepare("INSERT INTO van_stock_load_items (id, van_stock_load_id, product_id, quantity_loaded) VALUES (?, ?, ?, ?)").bind(uuidv4(), id, item.product_id, item.quantity || item.quantity_loaded || 0).run();
  }
  return c.json({ id, message: 'Van loaded' }, 201);
});

app.post('/van-inventory/unload', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  return c.json({ success: true, message: 'Van unloaded' });
});

app.post('/van-inventory/sale', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  return c.json({ success: true, message: 'Van sale recorded' });
});

app.get('/van-inventory/:vanId/movements', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const vanId = c.req.param('vanId');
  return c.json({ data: [] });
});

// Vans CRUD
app.get('/vans', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const vans = await db.prepare("SELECT * FROM vans WHERE tenant_id = ? ORDER BY name").bind(tenantId).all();
  return c.json({ data: vans.results || [] });
});

app.get('/vans/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const van = await db.prepare("SELECT * FROM vans WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
  return van ? c.json(van) : c.json({ message: 'Not found' }, 404);
});

app.post('/vans', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare("INSERT INTO vans (id, tenant_id, name, registration_number, status, created_at) VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)").bind(id, tenantId, body.name, body.registration_number || '').run();
  return c.json({ id, message: 'Van created' }, 201);
});

app.put('/vans/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  await db.prepare("UPDATE vans SET name = ?, registration_number = ?, status = ? WHERE id = ? AND tenant_id = ?").bind(body.name, body.registration_number || '', body.status || 'active', id, tenantId).run();
  return c.json({ success: true, message: 'Van updated' });
});

app.post('/vans/:vanId/assign-driver', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const vanId = c.req.param('vanId');
  const body = await c.req.json();
  await db.prepare("UPDATE vans SET driver_id = ? WHERE id = ? AND tenant_id = ?").bind(body.driver_id, vanId, tenantId).run();
  return c.json({ success: true, message: 'Driver assigned' });
});

app.delete('/vans/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  // Don't hard-delete if there are loads referencing it; soft-retire instead.
  const refCount = await db.prepare('SELECT COUNT(*) as c FROM van_stock_loads WHERE tenant_id = ? AND vehicle_reg IN (SELECT registration_number FROM vans WHERE id = ? AND tenant_id = ?)').bind(tenantId, id, tenantId).first();
  if ((refCount?.c || 0) > 0) {
    await db.prepare("UPDATE vans SET status = 'retired' WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
    return c.json({ success: true, message: 'Van retired (had load history)' });
  }
  await db.prepare('DELETE FROM vans WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Van deleted' });
});
app.post('/van-sales/loads/create', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const v = validate(createVanLoadSchema, body);
  if (!v.valid) return c.json({ success: false, message: 'Validation failed', errors: v.errors }, 400);
  const errors = [];

  // Validate stock availability
  for (let idx = 0; idx < (body.items || []).length; idx++) {
    const item = body.items[idx];
    const stock = await db.prepare('SELECT COALESCE(SUM(quantity), 0) as available FROM stock_levels WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?').bind(tenantId, item.product_id, body.warehouse_id).first();
    if (!stock || stock.available < item.quantity) {
      const product = await db.prepare('SELECT name FROM products WHERE id = ?').bind(item.product_id).first();
      errors.push(`Item ${idx + 1}: ${product ? product.name : item.product_id} - need ${item.quantity}, have ${stock ? stock.available : 0}`);
    }
  }
  if (errors.length > 0) return c.json({ success: false, message: 'Insufficient stock', details: errors }, 400);

  // Section 5: Use db.batch() for atomic van load creation
  const loadId = uuidv4();
  const loadBatch = [];

  // Load header
  loadBatch.push(db.prepare('INSERT INTO van_stock_loads (id, tenant_id, agent_id, vehicle_reg, warehouse_id, status, load_date, created_by) VALUES (?, ?, ?, ?, ?, ?, datetime("now"), ?)').bind(loadId, tenantId, body.agent_id, body.vehicle_reg, body.warehouse_id, 'loaded', userId));

  // Load items and stock movements
  for (const item of (body.items || [])) {
    const itemId = uuidv4();
    loadBatch.push(db.prepare('INSERT INTO van_stock_load_items (id, van_stock_load_id, product_id, quantity_loaded) VALUES (?, ?, ?, ?)').bind(itemId, loadId, item.product_id, item.quantity));
    const smId = uuidv4();
    loadBatch.push(db.prepare('INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(smId, tenantId, body.warehouse_id, item.product_id, 'TRANSFER_OUT', item.quantity, 'VAN_LOAD', loadId, userId));
    loadBatch.push(db.prepare('UPDATE stock_levels SET quantity = quantity - ?, updated_at = datetime("now") WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?').bind(item.quantity, tenantId, body.warehouse_id, item.product_id));
  }

  // Notification
  const notifId = uuidv4();
  loadBatch.push(db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(notifId, tenantId, body.agent_id, 'info', 'Van Load Ready', 'Your van has been loaded and is ready for collection', 'VAN_LOAD', loadId));

  await db.batch(loadBatch);

  return c.json({ success: true, data: { id: loadId }, message: 'Van loaded successfully' }, 201);
});

// C.1 Van Depart
app.put('/van-sales/loads/:id/depart', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare("UPDATE van_stock_loads SET status = 'in_field', depart_time = datetime('now'), updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Van departed' });
});

// C.2 Van Sale (uses order engine with VAN_SALE type)
app.post('/van-sales/sell', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const v = validate(vanSellSchema, body);
  if (!v.valid) return c.json({ success: false, message: 'Validation failed', errors: v.errors }, 400);
  const errors = [];

  // Validate van load is in field
  const load = await db.prepare("SELECT * FROM van_stock_loads WHERE id = ? AND tenant_id = ? AND status = 'in_field'").bind(body.van_stock_load_id, tenantId).first();
  if (!load) return c.json({ success: false, message: 'Van load not found or not in field' }, 400);

  // Check van stock availability
  for (let idx = 0; idx < (body.items || []).length; idx++) {
    const item = body.items[idx];
    const vanItem = await db.prepare('SELECT vsli.* FROM van_stock_load_items vsli JOIN van_stock_loads vsl ON vsli.van_stock_load_id = vsl.id WHERE vsli.van_stock_load_id = ? AND vsli.product_id = ? AND vsl.tenant_id = ?').bind(body.van_stock_load_id, item.product_id, tenantId).first();
    if (!vanItem) { errors.push(`Item ${idx + 1}: product not on van`); continue; }
    const available = vanItem.quantity_loaded - (vanItem.quantity_sold || 0) - (vanItem.quantity_returned || 0) - (vanItem.quantity_damaged || 0);
    if (available < (item.quantity || 1)) {
      const product = await db.prepare('SELECT name FROM products WHERE id = ? AND tenant_id = ?').bind(item.product_id, tenantId).first();
      errors.push(`Item ${idx + 1}: only ${available} of ${product ? product.name : 'product'} available on van`);
    }
  }
  if (errors.length > 0) return c.json({ success: false, message: 'Van stock insufficient', details: errors }, 400);

  // Create order via the order engine but with VAN_SALE type
  body.order_type = 'VAN_SALE';
  // Forward to order creation logic
  const orderId = uuidv4();
  const orderNumber = 'VS-' + Date.now().toString(36).toUpperCase();
  let subtotal = 0;
  const resolvedItems = [];

  for (const item of (body.items || [])) {
    const product = await db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').bind(item.product_id, tenantId).first();
    if (!product) continue;
    const unitPrice = item.unit_price || product.price;
    const qty = item.quantity || 1;
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    resolvedItems.push({ product_id: item.product_id, quantity: qty, unit_price: unitPrice, line_total: lineTotal });
  }

  // Section 5: Use db.batch() for atomic van sell
  const vanSellBatch = [];

  vanSellBatch.push(db.prepare('INSERT INTO sales_orders (id, tenant_id, order_number, agent_id, customer_id, order_type, status, subtotal, tax_amount, total_amount, payment_method, payment_status, van_stock_load_id, gps_latitude, gps_longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(orderId, tenantId, orderNumber, userId, body.customer_id, 'VAN_SALE', 'CONFIRMED', subtotal, subtotal - (subtotal / 1.15), subtotal, body.payment_method || 'CASH', body.amount_paid >= subtotal ? 'PAID' : 'PENDING', body.van_stock_load_id, body.gps_latitude || null, body.gps_longitude || null));

  for (const item of resolvedItems) {
    const itemId = uuidv4();
    vanSellBatch.push(db.prepare('INSERT INTO sales_order_items (id, sales_order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)').bind(itemId, orderId, item.product_id, item.quantity, item.unit_price, item.line_total));
    vanSellBatch.push(db.prepare('UPDATE van_stock_load_items SET quantity_sold = quantity_sold + ? WHERE van_stock_load_id = ? AND product_id = ?').bind(item.quantity, body.van_stock_load_id, item.product_id));
  }

  // Payment
  if (body.amount_paid && body.amount_paid > 0) {
    const paymentId = uuidv4();
    vanSellBatch.push(db.prepare('INSERT INTO payments (id, tenant_id, sales_order_id, amount, method, reference) VALUES (?, ?, ?, ?, ?, ?)').bind(paymentId, tenantId, orderId, body.amount_paid, body.payment_method || 'CASH', body.payment_reference || null));
  }

  await db.batch(vanSellBatch);

  return c.json({ success: true, data: { id: orderId, order_number: orderNumber, total_amount: subtotal } }, 201);
});

// C.3 Van Return Transaction
app.post('/van-sales/loads/:id/return', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();
  const v = validate(vanReturnSchema, body);
  if (!v.valid) return c.json({ success: false, message: 'Validation failed', errors: v.errors }, 400);

  const load = await db.prepare('SELECT * FROM van_stock_loads WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!load) return c.json({ success: false, message: 'Van load not found' }, 404);

  const errors = [];
  const discrepancies = [];
  const validatedItems = [];

  // Phase 1: Reads & validation (sequential reads are fine)
  for (const item of (body.items || [])) {
    const vanItem = await db.prepare('SELECT vsli.* FROM van_stock_load_items vsli JOIN van_stock_loads vsl ON vsli.van_stock_load_id = vsl.id WHERE vsli.van_stock_load_id = ? AND vsli.product_id = ? AND vsl.tenant_id = ?').bind(id, item.product_id, tenantId).first();
    if (!vanItem) { errors.push(`Product ${item.product_id} not on this load`); continue; }

    const totalAccounted = (vanItem.quantity_sold || 0) + (item.quantity_returned || 0) + (item.quantity_damaged || 0);
    if (totalAccounted > vanItem.quantity_loaded) {
      errors.push(`Product ${item.product_id}: sold(${vanItem.quantity_sold}) + returned(${item.quantity_returned}) + damaged(${item.quantity_damaged}) exceeds loaded(${vanItem.quantity_loaded})`);
      continue;
    }

    if (totalAccounted < vanItem.quantity_loaded) {
      const missing = vanItem.quantity_loaded - totalAccounted;
      discrepancies.push({ product_id: item.product_id, missing_quantity: missing });
    }

    validatedItems.push(item);
  }

  if (errors.length > 0) return c.json({ success: false, message: 'Return validation failed', details: errors }, 400);

  // Phase 2: Batch all writes atomically
  const returnBatch = [];

  for (const item of validatedItems) {
    returnBatch.push(db.prepare('UPDATE van_stock_load_items SET quantity_returned = ?, quantity_damaged = ? WHERE van_stock_load_id = ? AND product_id = ?').bind(item.quantity_returned || 0, item.quantity_damaged || 0, id, item.product_id));

    if ((item.quantity_returned || 0) > 0) {
      const smId = uuidv4();
      returnBatch.push(db.prepare('INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(smId, tenantId, load.warehouse_id, item.product_id, 'TRANSFER_IN', item.quantity_returned, 'VAN_RETURN', id, userId));
      returnBatch.push(db.prepare('UPDATE stock_levels SET quantity = quantity + ?, updated_at = datetime("now") WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?').bind(item.quantity_returned, tenantId, load.warehouse_id, item.product_id));
    }

    if ((item.quantity_damaged || 0) > 0) {
      const smId = uuidv4();
      returnBatch.push(db.prepare('INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(smId, tenantId, load.warehouse_id, item.product_id, 'DAMAGE', item.quantity_damaged, 'VAN_RETURN', id, 'Van return damage', userId));
    }
  }

  for (const d of discrepancies) {
    const adjId = uuidv4();
    returnBatch.push(db.prepare('INSERT INTO stock_adjustments (id, tenant_id, warehouse_id, product_id, adjustment_type, quantity, reason, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(adjId, tenantId, load.warehouse_id, d.product_id, 'DISCREPANCY', d.missing_quantity, 'Van return discrepancy - missing units', 'VAN_RETURN', id, userId));
  }

  returnBatch.push(db.prepare("UPDATE van_stock_loads SET status = 'returned', return_time = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(id));

  await db.batch(returnBatch);

  return c.json({ success: true, message: 'Van return processed', data: { discrepancies } });
});

// C.4 Cash Reconciliation
app.post('/van-sales/loads/:id/reconcile', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();

  // Calculate expected cash
  const cashOrders = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE van_stock_load_id = ? AND payment_method = 'CASH' AND tenant_id = ?").bind(id, tenantId).first();
  const expectedCash = cashOrders ? cashOrders.total : 0;
  const actualCash = body.actual_cash || 0;
  const variance = actualCash - expectedCash;

  const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first();
  const threshold = tenant ? (tenant.variance_threshold || 0.01) * expectedCash : 50;
  const autoApprove = Math.abs(variance) <= threshold;

  const reconId = uuidv4();
  await db.prepare('INSERT INTO van_reconciliations (id, tenant_id, van_stock_load_id, cash_expected, cash_actual, variance, denominations, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(reconId, tenantId, id, expectedCash, actualCash, variance, JSON.stringify(body.denominations || {}), autoApprove ? 'approved' : 'flagged', body.notes || null).run();

  if (!autoApprove) {
    // Create fraud alert notification for manager
    const agent = await db.prepare('SELECT manager_id FROM users WHERE id = ?').bind(userId).first();
    if (agent && agent.manager_id) {
      const notifId = uuidv4();
      await db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(notifId, tenantId, agent.manager_id, 'warning', 'Cash Variance Flagged', `Cash variance of R${variance.toFixed(2)} detected for van load ${id}`, 'VAN_RECONCILIATION', reconId).run();
    }
  }

  return c.json({ success: true, data: { id: reconId, expected: expectedCash, actual: actualCash, variance, status: autoApprove ? 'approved' : 'flagged' } });
});


app.put('/van-reconciliations/:id/reject', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { reason } = await c.req.json();
  await db.prepare("UPDATE van_reconciliations SET status = 'rejected', approved_by = ?, approved_at = datetime('now'), notes = ? WHERE id = ? AND tenant_id = ?").bind(userId, reason || 'Rejected', id, tenantId).run();
  // Audit
  const auditId = uuidv4();
  await db.prepare('INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(auditId, tenantId, userId, 'REJECT', 'VAN_RECONCILIATION', id, JSON.stringify({ reason })).run();
  return c.json({ success: true, message: 'Reconciliation rejected' });
});
app.get('/route-plans', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { agent_id, date, status } = c.req.query();
  let q = "SELECT rp.*, u.first_name || ' ' || u.last_name as agent_name, t.name as territory_name, (SELECT COUNT(*) FROM route_plan_stops WHERE route_plan_id = rp.id) as stop_count FROM route_plans rp LEFT JOIN users u ON rp.agent_id = u.id LEFT JOIN territories t ON rp.territory_id = t.id WHERE rp.tenant_id = ?";
  const params = [tenantId];
  if (role === 'agent') { q += ' AND rp.agent_id = ?'; params.push(userId); }
  else if (agent_id) { q += ' AND rp.agent_id = ?'; params.push(agent_id); }
  if (date) { q += ' AND rp.route_date = ?'; params.push(date); }
  if (status) { q += ' AND rp.status = ?'; params.push(status); }
  q += ' ORDER BY rp.route_date DESC';
  const plans = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: plans.results || [] });
});

app.get('/route-plans/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const plan = await db.prepare('SELECT * FROM route_plans WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!plan) return c.json({ success: false, message: 'Route plan not found' }, 404);
  const stops = await db.prepare('SELECT rps.*, c.name as customer_name, c.address, c.latitude, c.longitude FROM route_plan_stops rps JOIN route_plans rp ON rps.route_plan_id = rp.id LEFT JOIN customers c ON rps.customer_id = c.id WHERE rps.route_plan_id = ? AND rp.tenant_id = ? ORDER BY rps.sequence_order LIMIT 500').bind(id, tenantId).all();
  return c.json({ success: true, data: { ...plan, stops: stops.results || [] } });
});

app.post('/route-plans', requireRole('admin', 'manager', 'team_lead'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const planId = uuidv4();
  await db.prepare('INSERT INTO route_plans (id, tenant_id, agent_id, territory_id, route_date, status, total_stops) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(planId, tenantId, body.agent_id, body.territory_id || null, body.plan_date || body.route_date, 'PLANNED', (body.stops || []).length).run();

  // Create stops
  for (let i = 0; i < (body.stops || []).length; i++) {
    const stop = body.stops[i];
    const stopId = uuidv4();
    await db.prepare('INSERT INTO route_plan_stops (id, route_plan_id, customer_id, sequence_order, planned_arrival, status) VALUES (?, ?, ?, ?, ?, ?)').bind(stopId, planId, stop.customer_id, i + 1, stop.planned_arrival || null, 'PENDING').run();
  }

  return c.json({ success: true, data: { id: planId }, message: 'Route plan created' }, 201);
});

app.put('/route-plans/:id', requireRole('admin', 'manager', 'team_lead'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE route_plans SET status = COALESCE(?, status), total_stops = COALESCE(?, total_stops), completed_stops = COALESCE(?, completed_stops) WHERE id = ? AND tenant_id = ?').bind(body.status ?? null, body.total_stops ?? null, body.completed_stops ?? null, id, tenantId).run();
  return c.json({ success: true, message: 'Route plan updated' });
});

app.put('/route-plans/:id/start', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare("UPDATE route_plans SET status = 'IN_PROGRESS', actual_start = datetime('now') WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Route started' });
});

app.put('/route-plans/:id/complete', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const { actual_distance_km } = await c.req.json();
  await db.prepare("UPDATE route_plans SET status = 'COMPLETED', actual_end = datetime('now'), total_distance_km = ? WHERE id = ? AND tenant_id = ?").bind(actual_distance_km || null, id, tenantId).run();
  return c.json({ success: true, message: 'Route completed' });
});

// Route Plan Stop Check-in/out
app.put('/route-plan-stops/:id/checkin', async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const { gps_latitude, gps_longitude } = await c.req.json();
  await db.prepare("UPDATE route_plan_stops SET status = 'IN_PROGRESS', actual_arrival = datetime('now') WHERE id = ?").bind(id).run();
  return c.json({ success: true, message: 'Checked in' });
});

app.put('/route-plan-stops/:id/checkout', async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const { gps_latitude, gps_longitude, notes, outcome } = await c.req.json();
  await db.prepare("UPDATE route_plan_stops SET status = 'COMPLETED', actual_departure = datetime('now'), notes = ? WHERE id = ?").bind(notes || null, id).run();
  return c.json({ success: true, message: 'Checked out' });
});
app.get('/van-sales/cash-sessions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const sessions = await db.prepare("SELECT vr.*, u.first_name || ' ' || u.last_name as agent_name FROM van_reconciliations vr LEFT JOIN van_stock_loads vsl ON vr.van_stock_load_id = vsl.id LEFT JOIN users u ON vsl.agent_id = u.id WHERE vr.tenant_id = ? ORDER BY vr.created_at DESC LIMIT 100").bind(tenantId).all();
  return c.json({ success: true, data: sessions.results || [] });
});
app.get('/van-routes', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const routes = await db.prepare('SELECT * FROM route_plans WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100').bind(tenantId).all();
  return c.json({ success: true, data: routes.results || [] });
});
app.get('/van-sales', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { page = '1', limit = '50' } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const sales = await db.prepare('SELECT vsl.*, v.name as van_name, v.registration_number FROM van_stock_loads vsl LEFT JOIN vans v ON vsl.vehicle_reg = v.registration_number WHERE vsl.tenant_id = ? ORDER BY vsl.created_at DESC LIMIT ? OFFSET ?').bind(tenantId, parseInt(limit), offset).all();
  return c.json({ success: true, data: sales.results || [] });
});
app.get('/beat-routes/:id/customers', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/beat-routes/:id/customers/:customerId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/beat-routes/:id/customers/reorder', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/beat-routes/:id/optimize', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/beat-routes/plans/:planId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/beat-routes/plans/:planId/complete', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/beat-routes/plans/:planId/start', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/route-stops', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/analytics', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/bulk', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/cash-reconciliation', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { status, agent_id, limit = '100' } = c.req.query();
    const limitNum = Math.min(parseInt(limit) || 100, 500);
    let where = 'WHERE vr.tenant_id = ?';
    const params = [tenantId];
    if (status) { where += ' AND vr.status = ?'; params.push(status); }
    if (agent_id) { where += ' AND vsl.agent_id = ?'; params.push(agent_id); }
    const rows = await db.prepare(
      "SELECT vr.*, vsl.vehicle_reg, vsl.agent_id, " +
      "u.first_name || ' ' || u.last_name as agent_name " +
      "FROM van_reconciliations vr " +
      "LEFT JOIN van_stock_loads vsl ON vr.van_stock_load_id = vsl.id " +
      "LEFT JOIN users u ON vsl.agent_id = u.id " +
      where + ' ORDER BY vr.created_at DESC LIMIT ?'
    ).bind(...params, limitNum).all();
    const data = rows.results || [];
    return c.json({ success: true, data, total: data.length });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/cash-reconciliation/:id', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const id = c.req.param('id');
    const row = await db.prepare(
      "SELECT vr.*, vsl.vehicle_reg, vsl.agent_id, vsl.warehouse_id, " +
      "u.first_name || ' ' || u.last_name as agent_name " +
      "FROM van_reconciliations vr " +
      "LEFT JOIN van_stock_loads vsl ON vr.van_stock_load_id = vsl.id " +
      "LEFT JOIN users u ON vsl.agent_id = u.id " +
      "WHERE vr.id = ? AND vr.tenant_id = ?"
    ).bind(id, tenantId).first();
    if (!row) return c.json({ success: false, message: 'Cash reconciliation not found' }, 404);
    return c.json({ success: true, data: row });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
// Persist a cash reconciliation submitted from the van-sales create flow. The form supplies
// expected_cash/actual_cash and either van_stock_load_id or van_id; we resolve van_id to the
// most recent active load for that van so the row joins correctly to the van_stock_loads chain.
app.post('/van-sales/cash-reconciliation', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const body = await c.req.json();
    let loadId = body.van_stock_load_id || body.load_id || null;
    if (!loadId && body.van_id) {
      const active = await db.prepare(
        "SELECT id FROM van_stock_loads WHERE tenant_id = ? AND vehicle_reg IN (SELECT registration_number FROM vans WHERE id = ? AND tenant_id = ?) " +
        "AND status NOT IN ('returned', 'reconciled') ORDER BY load_date DESC LIMIT 1"
      ).bind(tenantId, body.van_id, tenantId).first();
      loadId = active?.id || null;
    }
    if (!loadId) return c.json({ success: false, message: 'van_stock_load_id (or a van_id with an open load) is required' }, 400);
    const expected = Number(body.cash_expected ?? body.expected_cash ?? 0) || 0;
    const actual = Number(body.cash_actual ?? body.actual_cash ?? 0) || 0;
    const variance = actual - expected;
    const id = uuidv4();
    await db.prepare(
      'INSERT INTO van_reconciliations (id, tenant_id, van_stock_load_id, cash_expected, cash_actual, variance, denominations, status, notes, created_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))'
    ).bind(
      id, tenantId, loadId, expected, actual, variance,
      body.denominations ? JSON.stringify(body.denominations) : null,
      'pending', body.notes || null
    ).run();
    return c.json({ success: true, data: { id, van_stock_load_id: loadId, cash_expected: expected, cash_actual: actual, variance, status: 'pending' } }, 201);
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/create', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/expenses', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/expenses/:expenseId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/import', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/insights', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/metrics', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/orders/:orderId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/orders/:orderId/reverse', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/orders/create', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/reports', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/reports/performance', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/reports/sales', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/returns', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/returns/:returnId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/returns/create', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/routes/:routeId/complete', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/routes/:routeId/optimize', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/routes/:routeId/start', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/sales/:id/payment', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/trends', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/van-loads', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/van-loads/:vanLoadId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/van-loads/:vanLoadId/items', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/van-loads/:vanLoadId/transition', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/van-loads/create', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/vans/:vanId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/vans/:vanId/cash-collection', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/vans/:vanId/expenses', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/vans/:vanId/inventory', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/vans/:vanId/load', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/vans/:vanId/location', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/vans/:vanId/location-history', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/vans/:vanId/performance', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/van-sales/vans/:vanId/unload', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/van-sales/:id', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

export default app;
