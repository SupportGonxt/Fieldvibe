import { Hono } from 'hono';
import { authMiddleware } from '../lib/middleware.js';

const app = new Hono();

// ==================== VAN SALES ROUTES ====================
app.get('/van-sales/vans', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  // Returns rows from the `vans` table (vehicles), joined with assigned driver name.
  // Was previously returning USERS filtered by role — confusing the UI which expected
  // van_number / registration / driver_name fields.
  const vans = await db.prepare(
    "SELECT v.id, v.name, v.registration_number, v.driver_id, v.status, v.created_at, " +
    "u.first_name || ' ' || u.last_name as driver_name " +
    "FROM vans v LEFT JOIN users u ON v.driver_id = u.id " +
    "WHERE v.tenant_id = ? ORDER BY v.name"
  ).bind(tenantId).all();
  return c.json({ success: true, data: vans.results || [] });
});

app.get('/van-sales/routes', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const routes = await db.prepare('SELECT * FROM routes WHERE tenant_id = ? ORDER BY name LIMIT 500').bind(tenantId).all();
  return c.json({ data: routes.results || [] });
});

app.get('/van-sales/routes/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const route = await db.prepare('SELECT * FROM routes WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!route) return c.json({ success: false, message: 'Route not found' }, 404);
  return c.json(route);
});

app.get('/van-sales/orders', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { page = '1', limit = '20', status } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = "WHERE so.tenant_id = ? AND so.order_type = 'van_sale'";
  const params = [tenantId];
  if (status) { where += ' AND so.status = ?'; params.push(status); }
  const total = await db.prepare('SELECT COUNT(*) as count FROM sales_orders so ' + where).bind(...params).first();
  const orders = await db.prepare('SELECT so.*, c.name as customer_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id ' + where + ' ORDER BY so.created_at DESC LIMIT ? OFFSET ?').bind(...params, parseInt(limit), offset).all();
  return c.json({ data: orders.results || [], total: total?.count || 0 });
});

app.get('/van-sales/loads', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const loads = await db.prepare("SELECT vsl.*, u.first_name || ' ' || u.last_name as agent_name, w.name as warehouse_name FROM van_stock_loads vsl LEFT JOIN users u ON vsl.agent_id = u.id LEFT JOIN warehouses w ON vsl.warehouse_id = w.id WHERE vsl.tenant_id = ? ORDER BY vsl.created_at DESC").bind(tenantId).all();
  return c.json({ data: loads.results || [] });
});

app.get('/van-sales/reconciliations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const recons = await db.prepare("SELECT vr.*, u.first_name || ' ' || u.last_name as agent_name FROM van_reconciliations vr LEFT JOIN van_stock_loads vsl ON vr.van_stock_load_id = vsl.id LEFT JOIN users u ON vsl.agent_id = u.id WHERE vr.tenant_id = ? ORDER BY vr.created_at DESC").bind(tenantId).all();
  return c.json({ data: recons.results || [] });
});

app.get('/van-sales/dashboard', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [activeLoads, pendingRecons, todayOrders, todayRevenue] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM van_stock_loads WHERE tenant_id = ? AND status = 'loaded'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM van_reconciliations WHERE tenant_id = ? AND status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND order_type = 'van_sale' AND date(created_at) = date('now')").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND order_type = 'van_sale' AND date(created_at) = date('now')").bind(tenantId).first(),
  ]);
  return c.json({ active_loads: activeLoads?.count || 0, pending_reconciliations: pendingRecons?.count || 0, today_orders: todayOrders?.count || 0, today_revenue: todayRevenue?.total || 0 });
});

export default app;
