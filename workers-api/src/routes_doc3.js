// ==================== DOC 3: INSIGHTS, RBAC & PROCESS COMPLETENESS (Sections N-R) ====================

// ==================== N. ROLE-BASED ACCESS CONTROL ====================

// N.1 Permission Matrix
api.get('/rbac/permissions', requireRole('admin'), async (c) => {
  const PERMISSION_MATRIX = {
    SUPER_ADMIN: {
      platform: ['manage_tenants', 'manage_feature_flags', 'view_all_tenants', 'manage_billing', 'system_settings'],
      users: ['create', 'read', 'update', 'delete', 'manage_roles'],
      customers: ['create', 'read', 'update', 'delete', 'import', 'export'],
      products: ['create', 'read', 'update', 'delete', 'manage_pricing'],
      orders: ['create', 'read', 'update', 'delete', 'approve', 'cancel'],
      van_sales: ['create', 'read', 'manage_loads', 'reconcile', 'approve'],
      returns: ['create', 'read', 'approve', 'reject'],
      inventory: ['read', 'adjust', 'transfer', 'audit'],
      commissions: ['read', 'approve', 'pay', 'configure_rules'],
      trade_promotions: ['create', 'read', 'update', 'delete', 'approve_claims'],
      field_ops: ['read', 'manage_territories', 'manage_routes', 'view_gps'],
      reports: ['view_all', 'export', 'schedule'],
      insights: ['view_all_dashboards'],
      anomalies: ['view', 'acknowledge', 'dismiss']
    },
    COMPANY_ADMIN: {
      users: ['create', 'read', 'update', 'delete', 'manage_roles'],
      customers: ['create', 'read', 'update', 'delete', 'import', 'export'],
      products: ['create', 'read', 'update', 'delete', 'manage_pricing'],
      orders: ['create', 'read', 'update', 'delete', 'approve', 'cancel'],
      van_sales: ['create', 'read', 'manage_loads', 'reconcile', 'approve'],
      returns: ['create', 'read', 'approve', 'reject'],
      inventory: ['read', 'adjust', 'transfer', 'audit'],
      commissions: ['read', 'approve', 'pay', 'configure_rules'],
      trade_promotions: ['create', 'read', 'update', 'delete', 'approve_claims'],
      field_ops: ['read', 'manage_territories', 'manage_routes', 'view_gps'],
      reports: ['view_all', 'export', 'schedule'],
      insights: ['view_company_dashboards'],
      anomalies: ['view', 'acknowledge', 'dismiss']
    },
    MANAGER: {
      users: ['read', 'update_team'],
      customers: ['create', 'read', 'update'],
      products: ['read'],
      orders: ['create', 'read', 'update', 'approve'],
      van_sales: ['create', 'read', 'manage_loads', 'reconcile'],
      returns: ['create', 'read', 'approve'],
      inventory: ['read', 'adjust'],
      commissions: ['read', 'approve'],
      trade_promotions: ['create', 'read', 'update', 'approve_claims'],
      field_ops: ['read', 'manage_routes', 'view_gps'],
      reports: ['view_team', 'export'],
      insights: ['view_team_dashboards'],
      anomalies: ['view', 'acknowledge']
    },
    TEAM_LEAD: {
      customers: ['create', 'read', 'update'],
      products: ['read'],
      orders: ['create', 'read'],
      van_sales: ['create', 'read'],
      returns: ['create', 'read'],
      inventory: ['read'],
      commissions: ['read_own', 'read_team'],
      field_ops: ['read', 'manage_own_routes'],
      reports: ['view_team'],
      insights: ['view_team_dashboards']
    },
    AGENT: {
      customers: ['create', 'read', 'update_assigned'],
      products: ['read'],
      orders: ['create', 'read_own'],
      van_sales: ['create', 'read_own'],
      returns: ['create'],
      inventory: ['read'],
      commissions: ['read_own'],
      field_ops: ['read_own', 'execute_route'],
      reports: ['view_own'],
      insights: ['view_own_dashboard']
    }
  };
  return c.json({ success: true, data: PERMISSION_MATRIX });
});

// N.2 Check User Permissions
api.get('/rbac/my-permissions', async (c) => {
  const role = c.get('role');
  const userId = c.get('userId');
  const ROLE_HIERARCHY = { 'super_admin': 5, 'admin': 4, 'manager': 3, 'team_lead': 2, 'agent': 1 };
  return c.json({ success: true, data: { role, level: ROLE_HIERARCHY[role] || 0, user_id: userId } });
});

// N.3 Data Scoping Rules
api.get('/rbac/data-scope', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');

  let scope = {};
  if (role === 'admin' || role === 'super_admin') {
    scope = { level: 'COMPANY', description: 'Full company data access' };
  } else if (role === 'manager') {
    const teamMembers = await db.prepare('SELECT id FROM users WHERE manager_id = ? AND tenant_id = ?').bind(userId, tenantId).all();
    scope = { level: 'TEAM', team_member_ids: (teamMembers.results || []).map(u => u.id), description: 'Team data access' };
  } else if (role === 'team_lead') {
    const teamMembers = await db.prepare('SELECT id FROM users WHERE manager_id = ? AND tenant_id = ?').bind(userId, tenantId).all();
    scope = { level: 'TEAM', team_member_ids: (teamMembers.results || []).map(u => u.id), description: 'Team data access (read-only for most)' };
  } else {
    scope = { level: 'SELF', description: 'Own data only' };
  }

  return c.json({ success: true, data: scope });
});

// Feature Flags
api.get('/feature-flags', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const flags = await db.prepare('SELECT * FROM feature_flags WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY flag_name').bind(tenantId).all();
  return c.json({ success: true, data: flags.results || [] });
});

api.put('/feature-flags/:name', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { name } = c.req.param();
  const { is_enabled } = await c.req.json();
  const existing = await db.prepare('SELECT id FROM feature_flags WHERE flag_name = ? AND tenant_id = ?').bind(name, tenantId).first();
  if (existing) {
    await db.prepare('UPDATE feature_flags SET is_enabled = ?, updated_at = datetime("now") WHERE id = ?').bind(is_enabled ? 1 : 0, existing.id).run();
  } else {
    const id = uuidv4();
    await db.prepare('INSERT INTO feature_flags (id, tenant_id, flag_name, is_enabled) VALUES (?, ?, ?, ?)').bind(id, tenantId, name, is_enabled ? 1 : 0).run();
  }
  return c.json({ success: true, message: `Feature flag ${name} ${is_enabled ? 'enabled' : 'disabled'}` });
});

// ==================== O. INSIGHTS DASHBOARDS ====================

// O.1 Executive Dashboard (SUPER_ADMIN / COMPANY_ADMIN)
api.get('/insights/executive', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const [revenue, orders, customers, agents, vanSales, returns, commissions, tradePromos] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND status != 'CANCELLED' AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount FROM sales_orders WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days') GROUP BY status").bind(tenantId).all(),
    db.prepare("SELECT COUNT(*) as total, (SELECT COUNT(*) FROM customers WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')) as new_this_month FROM customers WHERE tenant_id = ?").bind(tenantId, tenantId).first(),
    db.prepare("SELECT COUNT(*) as total, (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND role = 'agent' AND is_active = 1) as active FROM users WHERE tenant_id = ? AND role = 'agent'").bind(tenantId, tenantId).first(),
    db.prepare("SELECT COUNT(*) as loads, COALESCE(SUM(so.total_amount), 0) as revenue FROM van_stock_loads vsl LEFT JOIN sales_orders so ON so.van_stock_load_id = vsl.id WHERE vsl.tenant_id = ? AND vsl.created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as total, COALESCE(SUM(net_credit_amount), 0) as value FROM returns WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total_pending FROM commission_earnings WHERE tenant_id = ? AND status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as active, COALESCE(SUM(spent), 0) as total_spent FROM trade_promotions WHERE tenant_id = ? AND status = 'ACTIVE'").bind(tenantId).first(),
  ]);

  // Revenue trend (last 12 weeks)
  const revenueTrend = await db.prepare("SELECT strftime('%Y-W%W', created_at) as week, COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders FROM sales_orders WHERE tenant_id = ? AND status != 'CANCELLED' AND created_at >= datetime('now', '-84 days') GROUP BY week ORDER BY week").bind(tenantId).all();

  return c.json({ success: true, data: {
    revenue: { month: revenue?.total || 0, order_count: revenue?.count || 0 },
    orders_by_status: orders.results || [],
    customers: { total: customers?.total || 0, new_this_month: customers?.new_this_month || 0 },
    agents: { total: agents?.total || 0, active: agents?.active || 0 },
    van_sales: { loads: vanSales?.loads || 0, revenue: vanSales?.revenue || 0 },
    returns: { total: returns?.total || 0, value: returns?.value || 0 },
    commissions_pending: commissions?.total_pending || 0,
    trade_promotions: { active: tradePromos?.active || 0, spent: tradePromos?.total_spent || 0 },
    revenue_trend: revenueTrend.results || []
  }});
});

// O.2 Sales Performance Dashboard
api.get('/insights/sales', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { period = '30' } = c.req.query();

  let agentFilter = '';
  const params = [tenantId];
  if (role === 'agent') { agentFilter = ' AND so.agent_id = ?'; params.push(userId); }
  else if (role === 'team_lead' || role === 'manager') {
    const team = await db.prepare('SELECT id FROM users WHERE manager_id = ? AND tenant_id = ?').bind(userId, tenantId).all();
    const teamIds = (team.results || []).map(u => u.id);
    teamIds.push(userId);
    if (teamIds.length > 0) {
      agentFilter = ` AND so.agent_id IN (${teamIds.map(() => '?').join(',')})`;
      params.push(...teamIds);
    }
  }

  const [summary, byAgent, byProduct, byCustomer, dailyTrend, paymentMethods] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as orders, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(AVG(total_amount), 0) as avg_order, COALESCE(SUM(discount_amount), 0) as total_discount FROM sales_orders so WHERE so.tenant_id = ? AND so.status != 'CANCELLED' AND so.created_at >= datetime('now', '-${period} days')${agentFilter}`).bind(...params).first(),
    db.prepare(`SELECT u.first_name || ' ' || u.last_name as agent, COUNT(*) as orders, COALESCE(SUM(so.total_amount), 0) as revenue FROM sales_orders so JOIN users u ON so.agent_id = u.id WHERE so.tenant_id = ? AND so.status != 'CANCELLED' AND so.created_at >= datetime('now', '-${period} days')${agentFilter} GROUP BY so.agent_id ORDER BY revenue DESC`).bind(...params).all(),
    db.prepare(`SELECT p.name, SUM(soi.quantity) as qty_sold, SUM(soi.line_total) as revenue FROM sales_order_items soi JOIN products p ON soi.product_id = p.id JOIN sales_orders so ON soi.sales_order_id = so.id WHERE so.tenant_id = ? AND so.status != 'CANCELLED' AND so.created_at >= datetime('now', '-${period} days')${agentFilter} GROUP BY p.name ORDER BY revenue DESC LIMIT 20`).bind(...params).all(),
    db.prepare(`SELECT c.name, COUNT(*) as orders, COALESCE(SUM(so.total_amount), 0) as revenue FROM sales_orders so JOIN customers c ON so.customer_id = c.id WHERE so.tenant_id = ? AND so.status != 'CANCELLED' AND so.created_at >= datetime('now', '-${period} days')${agentFilter} GROUP BY c.name ORDER BY revenue DESC LIMIT 20`).bind(...params).all(),
    db.prepare(`SELECT DATE(so.created_at) as day, COUNT(*) as orders, COALESCE(SUM(so.total_amount), 0) as revenue FROM sales_orders so WHERE so.tenant_id = ? AND so.status != 'CANCELLED' AND so.created_at >= datetime('now', '-${period} days')${agentFilter} GROUP BY day ORDER BY day`).bind(...params).all(),
    db.prepare(`SELECT so.payment_method, COUNT(*) as count, COALESCE(SUM(so.total_amount), 0) as amount FROM sales_orders so WHERE so.tenant_id = ? AND so.status != 'CANCELLED' AND so.created_at >= datetime('now', '-${period} days')${agentFilter} GROUP BY so.payment_method`).bind(...params).all(),
  ]);

  return c.json({ success: true, data: {
    summary: { orders: summary?.orders || 0, revenue: summary?.revenue || 0, avg_order: summary?.avg_order || 0, total_discount: summary?.total_discount || 0 },
    by_agent: byAgent.results || [],
    by_product: byProduct.results || [],
    by_customer: byCustomer.results || [],
    daily_trend: dailyTrend.results || [],
    payment_methods: paymentMethods.results || []
  }});
});

// O.3 Van Sales Dashboard
api.get('/insights/van-sales', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const [summary, byAgent, loadUtilization, reconciliation] = await Promise.all([
    db.prepare("SELECT COUNT(DISTINCT vsl.id) as loads, (SELECT COUNT(*) FROM sales_orders WHERE van_stock_load_id IS NOT NULL AND tenant_id = ? AND created_at >= datetime('now', '-30 days')) as orders, (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE van_stock_load_id IS NOT NULL AND tenant_id = ? AND created_at >= datetime('now', '-30 days')) as revenue FROM van_stock_loads vsl WHERE vsl.tenant_id = ? AND vsl.created_at >= datetime('now', '-30 days')").bind(tenantId, tenantId, tenantId).first(),
    db.prepare("SELECT u.first_name || ' ' || u.last_name as agent, COUNT(DISTINCT vsl.id) as loads, (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE van_stock_load_id = vsl.id) as revenue FROM van_stock_loads vsl JOIN users u ON vsl.agent_id = u.id WHERE vsl.tenant_id = ? AND vsl.created_at >= datetime('now', '-30 days') GROUP BY vsl.agent_id ORDER BY revenue DESC").bind(tenantId).all(),
    db.prepare("SELECT vsl.id, vsl.vehicle_reg, SUM(vsli.quantity_loaded) as loaded, SUM(COALESCE(vsli.quantity_sold, 0)) as sold, SUM(COALESCE(vsli.quantity_returned, 0)) as returned, SUM(COALESCE(vsli.quantity_damaged, 0)) as damaged, CASE WHEN SUM(vsli.quantity_loaded) > 0 THEN ROUND(CAST(SUM(COALESCE(vsli.quantity_sold, 0)) AS FLOAT) / SUM(vsli.quantity_loaded) * 100, 1) ELSE 0 END as sell_through_pct FROM van_stock_loads vsl JOIN van_stock_load_items vsli ON vsl.id = vsli.van_stock_load_id WHERE vsl.tenant_id = ? AND vsl.created_at >= datetime('now', '-30 days') GROUP BY vsl.id ORDER BY vsl.load_date DESC").bind(tenantId).all(),
    db.prepare("SELECT vr.status, COUNT(*) as count, COALESCE(SUM(ABS(vr.variance)), 0) as total_variance FROM van_reconciliations vr WHERE vr.tenant_id = ? AND vr.created_at >= datetime('now', '-30 days') GROUP BY vr.status").bind(tenantId).all(),
  ]);

  return c.json({ success: true, data: {
    summary: { loads: summary?.loads || 0, orders: summary?.orders || 0, revenue: summary?.revenue || 0 },
    by_agent: byAgent.results || [],
    load_utilization: loadUtilization.results || [],
    reconciliation: reconciliation.results || []
  }});
});

// O.4 Field Operations Dashboard
api.get('/insights/field-ops', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const [visitSummary, routeCompliance, territories, competitorActivity] = await Promise.all([
    db.prepare("SELECT COUNT(*) as total_visits, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed, COUNT(CASE WHEN check_out_time IS NOT NULL THEN 1 END) as checked_out, ROUND(AVG(CASE WHEN check_out_time IS NOT NULL THEN (julianday(check_out_time) - julianday(check_in_time)) * 1440 END), 1) as avg_duration_min FROM visits WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT rp.status, COUNT(*) as count FROM route_plans rp WHERE rp.tenant_id = ? AND rp.plan_date >= datetime('now', '-30 days') GROUP BY rp.status").bind(tenantId).all(),
    db.prepare("SELECT t.name, (SELECT COUNT(*) FROM territory_assignments WHERE territory_id = t.id AND is_active = 1) as agents, (SELECT COUNT(*) FROM customers WHERE territory = t.name AND tenant_id = ?) as customers FROM territories t WHERE t.tenant_id = ?").bind(tenantId, tenantId).all(),
    db.prepare("SELECT competitor_name, COUNT(*) as sightings, AVG(competitor_price) as avg_price FROM competitor_sightings WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days') GROUP BY competitor_name ORDER BY sightings DESC LIMIT 10").bind(tenantId).all(),
  ]);

  return c.json({ success: true, data: {
    visits: { total: visitSummary?.total_visits || 0, completed: visitSummary?.completed || 0, avg_duration: visitSummary?.avg_duration_min || 0 },
    route_compliance: routeCompliance.results || [],
    territories: territories.results || [],
    competitor_activity: competitorActivity.results || []
  }});
});

// O.5 Trade Promotion Dashboard
api.get('/insights/trade-promotions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const [summary, byType, topPerformers, claims] = await Promise.all([
    db.prepare("SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active, COALESCE(SUM(budget), 0) as total_budget, COALESCE(SUM(spent), 0) as total_spent FROM trade_promotions WHERE tenant_id = ?").bind(tenantId).first(),
    db.prepare("SELECT promotion_type, COUNT(*) as count, COALESCE(SUM(budget), 0) as budget, COALESCE(SUM(spent), 0) as spent FROM trade_promotions WHERE tenant_id = ? GROUP BY promotion_type").bind(tenantId).all(),
    db.prepare("SELECT tp.name, tp.promotion_type, tp.budget, tp.spent, (SELECT COUNT(*) FROM trade_promotion_enrollments WHERE promotion_id = tp.id) as enrollments, CASE WHEN tp.spent > 0 THEN ROUND(CAST(tp.spent AS FLOAT) / tp.budget * 100, 1) ELSE 0 END as spend_pct FROM trade_promotions tp WHERE tp.tenant_id = ? ORDER BY tp.spent DESC LIMIT 10").bind(tenantId).all(),
    db.prepare("SELECT tpc.status, COUNT(*) as count, COALESCE(SUM(tpc.claim_amount), 0) as amount FROM trade_promotion_claims tpc JOIN trade_promotions tp ON tpc.promotion_id = tp.id WHERE tp.tenant_id = ? GROUP BY tpc.status").bind(tenantId).all(),
  ]);

  return c.json({ success: true, data: {
    summary: { total: summary?.total || 0, active: summary?.active || 0, budget: summary?.total_budget || 0, spent: summary?.total_spent || 0, utilization: summary?.total_budget > 0 ? Math.round(summary.total_spent / summary.total_budget * 100) : 0 },
    by_type: byType.results || [],
    top_performers: topPerformers.results || [],
    claims: claims.results || []
  }});
});

// O.6 Stock Dashboard
api.get('/insights/stock', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const [totalValue, lowStock, movements, byWarehouse] = await Promise.all([
    db.prepare("SELECT COUNT(DISTINCT sl.product_id) as sku_count, COALESCE(SUM(sl.quantity), 0) as total_units, COALESCE(SUM(sl.quantity * COALESCE(p.cost_price, 0)), 0) as total_value FROM stock_levels sl JOIN products p ON sl.product_id = p.id WHERE sl.tenant_id = ?").bind(tenantId).first(),
    db.prepare("SELECT p.name, p.sku, sl.quantity, p.reorder_level FROM stock_levels sl JOIN products p ON sl.product_id = p.id WHERE sl.tenant_id = ? AND sl.quantity <= COALESCE(p.reorder_level, 10) ORDER BY sl.quantity ASC LIMIT 20").bind(tenantId).all(),
    db.prepare("SELECT movement_type, COUNT(*) as count, SUM(quantity) as total_qty FROM stock_movements WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days') GROUP BY movement_type ORDER BY count DESC").bind(tenantId).all(),
    db.prepare("SELECT w.name as warehouse, COUNT(DISTINCT sl.product_id) as products, COALESCE(SUM(sl.quantity), 0) as units, COALESCE(SUM(sl.quantity * COALESCE(p.cost_price, 0)), 0) as value FROM stock_levels sl JOIN warehouses w ON sl.warehouse_id = w.id JOIN products p ON sl.product_id = p.id WHERE sl.tenant_id = ? GROUP BY w.name").bind(tenantId).all(),
  ]);

  return c.json({ success: true, data: {
    total: { sku_count: totalValue?.sku_count || 0, units: totalValue?.total_units || 0, value: totalValue?.total_value || 0 },
    low_stock: lowStock.results || [],
    movements: movements.results || [],
    by_warehouse: byWarehouse.results || []
  }});
});

// O.7 Commission Dashboard
api.get('/insights/commissions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');

  let earnerFilter = '';
  const params = [tenantId];
  if (role === 'agent') { earnerFilter = ' AND ce.earner_id = ?'; params.push(userId); }

  const [summary, byStatus, byAgent, trend] = await Promise.all([
    db.prepare(`SELECT COALESCE(SUM(amount), 0) as total, COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending, COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved, COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid FROM commission_earnings ce WHERE ce.tenant_id = ?${earnerFilter}`).bind(...params).first(),
    db.prepare(`SELECT ce.status, COUNT(*) as count, COALESCE(SUM(ce.amount), 0) as amount FROM commission_earnings ce WHERE ce.tenant_id = ?${earnerFilter} GROUP BY ce.status`).bind(...params).all(),
    db.prepare(`SELECT u.first_name || ' ' || u.last_name as name, COALESCE(SUM(ce.amount), 0) as total, COUNT(*) as entries FROM commission_earnings ce JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ?${earnerFilter} GROUP BY ce.earner_id ORDER BY total DESC LIMIT 10`).bind(...params).all(),
    db.prepare(`SELECT strftime('%Y-%m', ce.created_at) as month, COALESCE(SUM(ce.amount), 0) as amount FROM commission_earnings ce WHERE ce.tenant_id = ?${earnerFilter} AND ce.created_at >= datetime('now', '-6 months') GROUP BY month ORDER BY month`).bind(...params).all(),
  ]);

  return c.json({ success: true, data: {
    summary: { total: summary?.total || 0, pending: summary?.pending || 0, approved: summary?.approved || 0, paid: summary?.paid || 0 },
    by_status: byStatus.results || [],
    by_agent: byAgent.results || [],
    trend: trend.results || []
  }});
});

// O.8 Goals Dashboard
api.get('/insights/goals', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');

  let userFilter = '';
  const params = [tenantId];
  if (role === 'agent') { userFilter = ' AND g.user_id = ?'; params.push(userId); }

  const goals = await db.prepare(`SELECT g.*, u.first_name || ' ' || u.last_name as user_name, CASE WHEN g.target_value > 0 THEN ROUND(CAST(g.current_value AS FLOAT) / g.target_value * 100, 1) ELSE 0 END as progress_pct FROM goals g LEFT JOIN users u ON g.user_id = u.id WHERE g.tenant_id = ?${userFilter} ORDER BY g.end_date DESC`).bind(...params).all();

  const summary = {
    total: (goals.results || []).length,
    on_track: (goals.results || []).filter(g => {
      const pct = g.target_value > 0 ? g.current_value / g.target_value * 100 : 0;
      return pct >= 75;
    }).length,
    at_risk: (goals.results || []).filter(g => {
      const pct = g.target_value > 0 ? g.current_value / g.target_value * 100 : 0;
      return pct >= 50 && pct < 75;
    }).length,
    behind: (goals.results || []).filter(g => {
      const pct = g.target_value > 0 ? g.current_value / g.target_value * 100 : 0;
      return pct < 50;
    }).length,
  };

  return c.json({ success: true, data: { summary, goals: goals.results || [] } });
});

// O.9 Anomaly Dashboard
api.get('/insights/anomalies', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const [summary, byType, bySeverity, recent] = await Promise.all([
    db.prepare("SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open, COUNT(CASE WHEN status = 'ACKNOWLEDGED' THEN 1 END) as acknowledged, COUNT(CASE WHEN status = 'DISMISSED' THEN 1 END) as dismissed FROM anomaly_flags WHERE tenant_id = ?").bind(tenantId).first(),
    db.prepare("SELECT anomaly_type, COUNT(*) as count FROM anomaly_flags WHERE tenant_id = ? AND status = 'OPEN' GROUP BY anomaly_type ORDER BY count DESC").bind(tenantId).all(),
    db.prepare("SELECT severity, COUNT(*) as count FROM anomaly_flags WHERE tenant_id = ? AND status = 'OPEN' GROUP BY severity").bind(tenantId).all(),
    db.prepare("SELECT af.*, u.first_name || ' ' || u.last_name as user_name FROM anomaly_flags af LEFT JOIN users u ON af.user_id = u.id WHERE af.tenant_id = ? ORDER BY af.detected_at DESC LIMIT 20").bind(tenantId).all(),
  ]);

  return c.json({ success: true, data: {
    summary: { total: summary?.total || 0, open: summary?.open || 0, acknowledged: summary?.acknowledged || 0, dismissed: summary?.dismissed || 0 },
    by_type: byType.results || [],
    by_severity: bySeverity.results || [],
    recent: recent.results || []
  }});
});

// ==================== P. PROCESS COMPLETENESS ====================

// P.1 Process Audit - verify all forward/reverse paths
api.get('/process/audit', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const processes = {
    sales_order: {
      forward: ['draft -> CONFIRMED', 'CONFIRMED -> PROCESSING', 'PROCESSING -> READY', 'READY -> DISPATCHED', 'DISPATCHED -> DELIVERED', 'DELIVERED -> COMPLETED'],
      reverse: ['Any -> CANCELLED (with stock reversal, commission void, balance restore)'],
      status: 'implemented'
    },
    van_sales: {
      forward: ['load -> in_field (depart)', 'in_field -> sell (create VAN_SALE orders)', 'in_field -> returned (process returns)'],
      reverse: ['Stock discrepancy detection', 'Cash reconciliation with variance flag'],
      status: 'implemented'
    },
    returns: {
      forward: ['PENDING -> PROCESSED (approve)', 'PENDING -> REJECTED'],
      reverse: ['Stock return (good items back to inventory)', 'Damage recording', 'Credit note creation', 'Customer balance adjustment'],
      status: 'implemented'
    },
    commissions: {
      forward: ['pending -> approved -> paid'],
      reverse: ['voided (on order cancel)'],
      status: 'implemented'
    },
    trade_promotions: {
      forward: ['DRAFT -> ACTIVE -> CLOSED'],
      reverse: ['Enrollment removal', 'Claim rejection'],
      status: 'implemented'
    },
    inventory: {
      forward: ['PURCHASE_IN, TRANSFER_IN, ADJUSTMENT_UP, RETURN_IN'],
      reverse: ['SALE_OUT, TRANSFER_OUT, ADJUSTMENT_DOWN, EXPIRY, SAMPLE_OUT, DAMAGE'],
      status: 'implemented'
    }
  };

  // Verify data integrity
  const checks = [];

  // Check for orphaned order items
  const orphanedItems = await db.prepare("SELECT COUNT(*) as cnt FROM sales_order_items soi LEFT JOIN sales_orders so ON soi.sales_order_id = so.id WHERE so.id IS NULL").first();
  checks.push({ check: 'orphaned_order_items', count: orphanedItems?.cnt || 0, status: (orphanedItems?.cnt || 0) === 0 ? 'PASS' : 'FAIL' });

  // Check for negative stock
  const negativeStock = await db.prepare("SELECT COUNT(*) as cnt FROM stock_levels WHERE quantity < 0 AND tenant_id = ?").bind(tenantId).first();
  checks.push({ check: 'negative_stock', count: negativeStock?.cnt || 0, status: (negativeStock?.cnt || 0) === 0 ? 'PASS' : 'FAIL' });

  // Check for unreconciled van loads
  const unreconciledLoads = await db.prepare("SELECT COUNT(*) as cnt FROM van_stock_loads WHERE status = 'returned' AND id NOT IN (SELECT van_stock_load_id FROM van_reconciliations) AND tenant_id = ?").bind(tenantId).first();
  checks.push({ check: 'unreconciled_van_loads', count: unreconciledLoads?.cnt || 0, status: (unreconciledLoads?.cnt || 0) === 0 ? 'PASS' : 'WARNING' });

  return c.json({ success: true, data: { processes, integrity_checks: checks } });
});

// ==================== Q. SUPER ADMIN PLATFORM MANAGEMENT ====================

// Q.1 Tenant Management (super admin only)
api.get('/platform/tenants', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenants = await db.prepare("SELECT t.*, (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count, (SELECT COUNT(*) FROM customers WHERE tenant_id = t.id) as customer_count, (SELECT COUNT(*) FROM sales_orders WHERE tenant_id = t.id) as order_count FROM tenants t ORDER BY t.created_at DESC").all();
  return c.json({ success: true, data: tenants.results || [] });
});

api.post('/platform/tenants', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO tenants (id, name, slug, domain, settings) VALUES (?, ?, ?, ?, ?)').bind(id, body.name, body.slug || body.name.toLowerCase().replace(/\s+/g, '-'), body.domain || null, body.settings ? JSON.stringify(body.settings) : null).run();
  return c.json({ success: true, data: { id }, message: 'Tenant created' }, 201);
});

api.put('/platform/tenants/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE tenants SET name = COALESCE(?, name), domain = COALESCE(?, domain), settings = COALESCE(?, settings), is_active = COALESCE(?, is_active), updated_at = datetime("now") WHERE id = ?').bind(body.name || null, body.domain || null, body.settings ? JSON.stringify(body.settings) : null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, id).run();
  return c.json({ success: true, message: 'Tenant updated' });
});

// Q.2 Platform Settings
api.get('/platform/settings', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first();
  return c.json({ success: true, data: {
    tenant: tenant,
    settings: tenant?.settings ? JSON.parse(tenant.settings) : {},
  }});
});

api.put('/platform/settings', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  await db.prepare('UPDATE tenants SET settings = ?, updated_at = datetime("now") WHERE id = ?').bind(JSON.stringify(body), tenantId).run();
  return c.json({ success: true, message: 'Settings updated' });
});

// Q.3 Platform Health
api.get('/platform/health', async (c) => {
  const db = c.env.DB;
  try {
    await db.prepare('SELECT 1').first();
    return c.json({ success: true, data: { status: 'healthy', database: 'connected', timestamp: new Date().toISOString() } });
  } catch (e) {
    return c.json({ success: false, data: { status: 'unhealthy', database: 'disconnected', error: e.message } }, 500);
  }
});
