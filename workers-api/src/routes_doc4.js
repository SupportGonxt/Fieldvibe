// ==================== DOC 4: FINAL GAPS & PRODUCTION READINESS (Sections S-Z) ====================

// ==================== S. AUTOMATED EMAIL REPORTS ====================

// S.1 Report Subscriptions
api.get('/report-subscriptions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');
  let q = 'SELECT * FROM report_subscriptions WHERE tenant_id = ?';
  const params = [tenantId];
  if (role === 'agent') { q += ' AND user_id = ?'; params.push(userId); }
  q += ' ORDER BY created_at DESC';
  const subs = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: subs.results || [] });
});

api.post('/report-subscriptions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO report_subscriptions (id, tenant_id, user_id, report_type, frequency, recipients, filters, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.user_id || userId, body.report_type, body.frequency || 'weekly', JSON.stringify(body.recipients || []), body.filters ? JSON.stringify(body.filters) : null, 1).run();
  return c.json({ success: true, data: { id }, message: 'Subscription created' }, 201);
});

api.put('/report-subscriptions/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE report_subscriptions SET frequency = COALESCE(?, frequency), recipients = COALESCE(?, recipients), filters = COALESCE(?, filters), is_active = COALESCE(?, is_active), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.frequency || null, body.recipients ? JSON.stringify(body.recipients) : null, body.filters ? JSON.stringify(body.filters) : null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, id, tenantId).run();
  return c.json({ success: true, message: 'Subscription updated' });
});

api.delete('/report-subscriptions/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare('DELETE FROM report_subscriptions WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Subscription deleted' });
});

// S.2 Report History
api.get('/report-history', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { report_type, limit = 50 } = c.req.query();
  let q = 'SELECT * FROM report_history WHERE tenant_id = ?';
  const params = [tenantId];
  if (report_type) { q += ' AND report_type = ?'; params.push(report_type); }
  q += ' ORDER BY generated_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const history = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: history.results || [] });
});

// S.3 Generate Report On-Demand
api.post('/reports/generate', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const reportId = uuidv4();
  let reportData = {};

  // Generate based on type
  switch (body.report_type) {
    case 'SALES_SUMMARY': {
      const data = await db.prepare("SELECT DATE(created_at) as date, COUNT(*) as orders, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(SUM(discount_amount), 0) as discounts FROM sales_orders WHERE tenant_id = ? AND status != 'CANCELLED' AND created_at >= ? AND created_at <= ? GROUP BY date ORDER BY date").bind(tenantId, body.start_date || '2020-01-01', body.end_date || '2099-12-31').all();
      reportData = { rows: data.results || [], type: 'SALES_SUMMARY' };
      break;
    }
    case 'AGENT_PERFORMANCE': {
      const data = await db.prepare("SELECT u.first_name || ' ' || u.last_name as agent, COUNT(DISTINCT v.id) as visits, COUNT(DISTINCT so.id) as orders, COALESCE(SUM(so.total_amount), 0) as revenue FROM users u LEFT JOIN visits v ON v.agent_id = u.id AND v.tenant_id = ? LEFT JOIN sales_orders so ON so.agent_id = u.id AND so.tenant_id = ? WHERE u.tenant_id = ? AND u.role = 'agent' GROUP BY u.id ORDER BY revenue DESC").bind(tenantId, tenantId, tenantId).all();
      reportData = { rows: data.results || [], type: 'AGENT_PERFORMANCE' };
      break;
    }
    case 'STOCK_REPORT': {
      const data = await db.prepare("SELECT p.name, p.sku, w.name as warehouse, sl.quantity, p.cost_price, (sl.quantity * COALESCE(p.cost_price, 0)) as value FROM stock_levels sl JOIN products p ON sl.product_id = p.id JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ? ORDER BY value DESC").bind(tenantId).all();
      reportData = { rows: data.results || [], type: 'STOCK_REPORT' };
      break;
    }
    case 'COMMISSION_REPORT': {
      const data = await db.prepare("SELECT u.first_name || ' ' || u.last_name as earner, ce.source_type, ce.status, COUNT(*) as entries, SUM(ce.amount) as total FROM commission_earnings ce JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ? GROUP BY ce.earner_id, ce.status ORDER BY total DESC").bind(tenantId).all();
      reportData = { rows: data.results || [], type: 'COMMISSION_REPORT' };
      break;
    }
    case 'VAN_SALES_REPORT': {
      const data = await db.prepare("SELECT vsl.vehicle_reg, u.first_name || ' ' || u.last_name as agent, vsl.status, (SELECT COUNT(*) FROM sales_orders WHERE van_stock_load_id = vsl.id) as orders, (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE van_stock_load_id = vsl.id) as revenue, vr.variance as cash_variance FROM van_stock_loads vsl JOIN users u ON vsl.agent_id = u.id LEFT JOIN van_reconciliations vr ON vr.van_stock_load_id = vsl.id WHERE vsl.tenant_id = ? ORDER BY vsl.load_date DESC").bind(tenantId).all();
      reportData = { rows: data.results || [], type: 'VAN_SALES_REPORT' };
      break;
    }
    default:
      return c.json({ success: false, message: 'Unknown report type' }, 400);
  }

  // Save to history
  await db.prepare('INSERT INTO report_history (id, tenant_id, report_type, generated_by, parameters, row_count, file_url) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(reportId, tenantId, body.report_type, userId, JSON.stringify(body), (reportData.rows || []).length, null).run();

  return c.json({ success: true, data: { id: reportId, ...reportData } });
});

// ==================== T. API DOCUMENTATION & WEBHOOKS ====================

// T.1 API Documentation endpoint
api.get('/docs', (c) => {
  const docs = {
    openapi: '3.0.0',
    info: { title: 'FieldVibe API', version: '2.0.0', description: 'Complete FieldVibe platform API' },
    servers: [{ url: '/api', description: 'Main API' }],
    paths: {
      '/auth/login': { post: { summary: 'Login', tags: ['Auth'] } },
      '/auth/register': { post: { summary: 'Register', tags: ['Auth'] } },
      '/customers': { get: { summary: 'List customers', tags: ['Customers'] }, post: { summary: 'Create customer', tags: ['Customers'] } },
      '/products': { get: { summary: 'List products', tags: ['Products'] }, post: { summary: 'Create product', tags: ['Products'] } },
      '/sales/orders': { get: { summary: 'List orders', tags: ['Sales'] } },
      '/sales/orders/create': { post: { summary: 'Create order (atomic)', tags: ['Sales'] } },
      '/price-lists': { get: { summary: 'List price lists', tags: ['Pricing'] }, post: { summary: 'Create price list', tags: ['Pricing'] } },
      '/van-sales/loads/create': { post: { summary: 'Create van load', tags: ['Van Sales'] } },
      '/van-sales/sell': { post: { summary: 'Van sale', tags: ['Van Sales'] } },
      '/returns': { get: { summary: 'List returns', tags: ['Returns'] }, post: { summary: 'Create return', tags: ['Returns'] } },
      '/inventory/movements': { post: { summary: 'Create stock movement', tags: ['Inventory'] } },
      '/inventory/transfers': { post: { summary: 'Transfer stock', tags: ['Inventory'] } },
      '/commission-rules': { get: { summary: 'List rules', tags: ['Commissions'] } },
      '/commission-earnings': { get: { summary: 'List earnings', tags: ['Commissions'] } },
      '/trade-promotions': { get: { summary: 'List promotions', tags: ['Trade Promotions'] }, post: { summary: 'Create promotion', tags: ['Trade Promotions'] } },
      '/territories': { get: { summary: 'List territories', tags: ['Field Ops'] }, post: { summary: 'Create territory', tags: ['Field Ops'] } },
      '/route-plans': { get: { summary: 'List route plans', tags: ['Field Ops'] }, post: { summary: 'Create route plan', tags: ['Field Ops'] } },
      '/anomaly-flags': { get: { summary: 'List anomalies', tags: ['Anomaly Detection'] } },
      '/anomaly-detection/run': { post: { summary: 'Run anomaly detection', tags: ['Anomaly Detection'] } },
      '/insights/executive': { get: { summary: 'Executive dashboard', tags: ['Insights'] } },
      '/insights/sales': { get: { summary: 'Sales dashboard', tags: ['Insights'] } },
      '/insights/van-sales': { get: { summary: 'Van sales dashboard', tags: ['Insights'] } },
      '/insights/field-ops': { get: { summary: 'Field ops dashboard', tags: ['Insights'] } },
      '/insights/trade-promotions': { get: { summary: 'Trade promo dashboard', tags: ['Insights'] } },
      '/insights/stock': { get: { summary: 'Stock dashboard', tags: ['Insights'] } },
      '/insights/commissions': { get: { summary: 'Commission dashboard', tags: ['Insights'] } },
      '/insights/goals': { get: { summary: 'Goals dashboard', tags: ['Insights'] } },
      '/insights/anomalies': { get: { summary: 'Anomaly dashboard', tags: ['Insights'] } },
      '/webhooks': { get: { summary: 'List webhooks', tags: ['Webhooks'] }, post: { summary: 'Create webhook', tags: ['Webhooks'] } },
      '/api-keys': { get: { summary: 'List API keys', tags: ['API Keys'] } },
    },
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }
    },
    security: [{ bearerAuth: [] }]
  };
  return c.json(docs);
});

// T.2 Webhooks
api.get('/webhooks', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const webhooks = await db.prepare('SELECT * FROM webhooks WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: webhooks.results || [] });
});

api.post('/webhooks', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  const secret = 'whsec_' + uuidv4().replace(/-/g, '');
  await db.prepare('INSERT INTO webhooks (id, tenant_id, url, events, secret, is_active) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.url, JSON.stringify(body.events || []), secret, 1).run();
  return c.json({ success: true, data: { id, secret }, message: 'Webhook created' }, 201);
});

api.put('/webhooks/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE webhooks SET url = COALESCE(?, url), events = COALESCE(?, events), is_active = COALESCE(?, is_active), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.url || null, body.events ? JSON.stringify(body.events) : null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, id, tenantId).run();
  return c.json({ success: true, message: 'Webhook updated' });
});

api.delete('/webhooks/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare('DELETE FROM webhooks WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Webhook deleted' });
});

api.get('/webhooks/:id/deliveries', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const deliveries = await db.prepare('SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT 50').bind(id).all();
  return c.json({ success: true, data: deliveries.results || [] });
});

// T.3 API Keys
api.get('/api-keys', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const keys = await db.prepare('SELECT id, tenant_id, name, key_prefix, scopes, is_active, last_used_at, created_at FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: keys.results || [] });
});

api.post('/api-keys', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  const keyValue = 'fv_' + uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').substring(0, 16);
  const keyPrefix = keyValue.substring(0, 10);
  await db.prepare('INSERT INTO api_keys (id, tenant_id, name, key_hash, key_prefix, scopes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, keyValue, keyPrefix, JSON.stringify(body.scopes || ['read']), 1).run();
  return c.json({ success: true, data: { id, api_key: keyValue, prefix: keyPrefix }, message: 'API key created. Store the key securely - it cannot be retrieved later.' }, 201);
});

api.delete('/api-keys/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare('DELETE FROM api_keys WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'API key revoked' });
});

// ==================== U. DATA EXPORT & IMPORT ====================

// U.1 Export
api.post('/export', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();

  const validEntities = ['customers', 'products', 'sales_orders', 'visits', 'commission_earnings', 'stock_levels'];
  if (!validEntities.includes(body.entity)) {
    return c.json({ success: false, message: `Invalid entity. Must be one of: ${validEntities.join(', ')}` }, 400);
  }

  let q = '';
  switch (body.entity) {
    case 'customers': q = 'SELECT * FROM customers WHERE tenant_id = ?'; break;
    case 'products': q = 'SELECT * FROM products WHERE tenant_id = ?'; break;
    case 'sales_orders': q = "SELECT so.*, (SELECT GROUP_CONCAT(p.name || ' x' || soi.quantity) FROM sales_order_items soi JOIN products p ON soi.product_id = p.id WHERE soi.sales_order_id = so.id) as items_summary FROM sales_orders so WHERE so.tenant_id = ?"; break;
    case 'visits': q = "SELECT v.*, c.name as customer_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id WHERE v.tenant_id = ?"; break;
    case 'commission_earnings': q = "SELECT ce.*, u.first_name || ' ' || u.last_name as earner_name FROM commission_earnings ce LEFT JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ?"; break;
    case 'stock_levels': q = "SELECT sl.*, p.name as product_name, p.sku, w.name as warehouse_name FROM stock_levels sl JOIN products p ON sl.product_id = p.id JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ?"; break;
  }

  if (body.date_from) q += ` AND created_at >= '${body.date_from}'`;
  if (body.date_to) q += ` AND created_at <= '${body.date_to}'`;

  const data = await db.prepare(q).bind(tenantId).all();
  return c.json({ success: true, data: { entity: body.entity, count: (data.results || []).length, rows: data.results || [] } });
});

// U.2 Import
api.post('/import', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const validEntities = ['customers', 'products'];
  if (!validEntities.includes(body.entity)) {
    return c.json({ success: false, message: 'Import only supported for: customers, products' }, 400);
  }

  const jobId = uuidv4();
  const rows = body.rows || [];
  let imported = 0;
  let failed = 0;
  const errors = [];

  await db.prepare('INSERT INTO import_jobs (id, tenant_id, entity_type, total_rows, status, created_by) VALUES (?, ?, ?, ?, ?, ?)').bind(jobId, tenantId, body.entity, rows.length, 'PROCESSING', userId).run();

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      const id = uuidv4();
      if (body.entity === 'customers') {
        if (!row.name) { errors.push({ row: i + 1, error: 'Name required' }); failed++; continue; }
        await db.prepare('INSERT INTO customers (id, tenant_id, name, email, phone, address, territory, customer_type, credit_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, row.name, row.email || null, row.phone || null, row.address || null, row.territory || null, row.customer_type || 'retail', row.credit_limit || 0).run();
        imported++;
      } else if (body.entity === 'products') {
        if (!row.name || !row.sku) { errors.push({ row: i + 1, error: 'Name and SKU required' }); failed++; continue; }
        await db.prepare('INSERT INTO products (id, tenant_id, name, sku, category, price, cost_price, tax_rate, unit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, row.name, row.sku, row.category || 'general', row.price || 0, row.cost_price || 0, row.tax_rate || 15, row.unit || 'each', 'active').run();
        imported++;
      }
    } catch (e) {
      errors.push({ row: i + 1, error: e.message });
      failed++;
    }
  }

  await db.prepare('UPDATE import_jobs SET imported_rows = ?, failed_rows = ?, status = ?, error_details = ?, completed_at = datetime("now") WHERE id = ?').bind(imported, failed, failed > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', errors.length > 0 ? JSON.stringify(errors) : null, jobId).run();

  return c.json({ success: true, data: { job_id: jobId, total: rows.length, imported, failed, errors: errors.slice(0, 10) } });
});

api.get('/import-jobs', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const jobs = await db.prepare('SELECT * FROM import_jobs WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: jobs.results || [] });
});

// ==================== W. ERROR HANDLING & LOGGING ====================

// W.1 Error Logs
api.get('/error-logs', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { severity, limit = 100 } = c.req.query();
  let q = 'SELECT * FROM error_logs WHERE tenant_id = ?';
  const params = [tenantId];
  if (severity) { q += ' AND severity = ?'; params.push(severity); }
  q += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const logs = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: logs.results || [] });
});

api.post('/error-logs', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO error_logs (id, tenant_id, user_id, severity, error_code, message, stack_trace, context) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, userId, body.severity || 'ERROR', body.error_code || null, body.message, body.stack_trace || null, body.context ? JSON.stringify(body.context) : null).run();
  return c.json({ success: true, data: { id } }, 201);
});

// W.2 Audit Log
api.get('/audit-log', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { resource_type, user_id, limit = 100 } = c.req.query();
  let q = "SELECT al.*, u.first_name || ' ' || u.last_name as user_name FROM audit_log al LEFT JOIN users u ON al.user_id = u.id WHERE al.tenant_id = ?";
  const params = [tenantId];
  if (resource_type) { q += ' AND al.resource_type = ?'; params.push(resource_type); }
  if (user_id) { q += ' AND al.user_id = ?'; params.push(user_id); }
  q += ' ORDER BY al.created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const logs = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: logs.results || [] });
});

// ==================== X. DATA SEEDING & TESTING ====================

// X.1 Seed Demo Data
api.post('/seed/demo', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const seedId = uuidv4();

  try {
    // Seed territories
    const territories = ['Johannesburg North', 'Johannesburg South', 'Pretoria', 'Cape Town', 'Durban'];
    for (const name of territories) {
      const existing = await db.prepare('SELECT id FROM territories WHERE name = ? AND tenant_id = ?').bind(name, tenantId).first();
      if (!existing) {
        const id = uuidv4();
        await db.prepare('INSERT INTO territories (id, tenant_id, name, description) VALUES (?, ?, ?, ?)').bind(id, tenantId, name, `${name} territory`).run();
      }
    }

    // Seed warehouses
    const warehouses = [{ name: 'Main Warehouse', code: 'WH-MAIN' }, { name: 'Gauteng Hub', code: 'WH-GP' }, { name: 'Cape Town Hub', code: 'WH-CT' }];
    for (const wh of warehouses) {
      const existing = await db.prepare('SELECT id FROM warehouses WHERE name = ? AND tenant_id = ?').bind(wh.name, tenantId).first();
      if (!existing) {
        const id = uuidv4();
        await db.prepare('INSERT INTO warehouses (id, tenant_id, name, code, address) VALUES (?, ?, ?, ?, ?)').bind(id, tenantId, wh.name, wh.code, `${wh.name} Address`).run();
      }
    }

    // Seed price list
    const existingPL = await db.prepare('SELECT id FROM price_lists WHERE is_default = 1 AND tenant_id = ?').bind(tenantId).first();
    if (!existingPL) {
      const plId = uuidv4();
      await db.prepare('INSERT INTO price_lists (id, tenant_id, name, description, is_default, is_active, currency) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(plId, tenantId, 'Standard Price List', 'Default pricing for all customers', 1, 1, 'ZAR').run();
      
      // Add items from products
      const products = await db.prepare('SELECT id, price FROM products WHERE tenant_id = ?').bind(tenantId).all();
      for (const p of (products.results || [])) {
        const pliId = uuidv4();
        await db.prepare('INSERT INTO price_list_items (id, price_list_id, product_id, unit_price, min_qty) VALUES (?, ?, ?, ?, ?)').bind(pliId, plId, p.id, p.price, 1).run();
      }
    }

    // Seed commission rules
    const existingCR = await db.prepare('SELECT id FROM commission_rules WHERE tenant_id = ? LIMIT 1').bind(tenantId).first();
    if (!existingCR) {
      const rules = [
        { name: 'Standard Sales Commission', source_type: 'SALE', rate: 0.05 },
        { name: 'Van Sales Bonus', source_type: 'VAN_SALE', rate: 0.07 },
        { name: 'New Customer Bonus', source_type: 'NEW_CUSTOMER', rate: 0.10 }
      ];
      for (const rule of rules) {
        const id = uuidv4();
        await db.prepare('INSERT INTO commission_rules (id, tenant_id, name, source_type, rate, is_active) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, rule.name, rule.source_type, rule.rate, 1).run();
      }
    }

    // Seed trade promotion
    const existingTP = await db.prepare('SELECT id FROM trade_promotions WHERE tenant_id = ? LIMIT 1').bind(tenantId).first();
    if (!existingTP) {
      const tpId = uuidv4();
      await db.prepare("INSERT INTO trade_promotions (id, tenant_id, name, promotion_type, description, start_date, end_date, budget, spent, status, config, created_by) VALUES (?, ?, ?, ?, ?, date('now'), date('now', '+30 days'), ?, ?, ?, ?, ?)").bind(tpId, tenantId, 'Q1 Volume Rebate', 'VOLUME_REBATE', 'Buy more, save more', 50000, 0, 'ACTIVE', JSON.stringify({ tiers: [{ min_qty: 100, rebate_pct: 5 }, { min_qty: 500, rebate_pct: 10 }] }), userId).run();
    }

    // Seed feature flags
    const defaultFlags = ['van_sales', 'trade_promotions', 'anomaly_detection', 'commissions', 'route_planning', 'gps_tracking', 'email_reports', 'api_keys'];
    for (const flag of defaultFlags) {
      const existing = await db.prepare('SELECT id FROM feature_flags WHERE flag_name = ? AND tenant_id = ?').bind(flag, tenantId).first();
      if (!existing) {
        const id = uuidv4();
        await db.prepare('INSERT INTO feature_flags (id, tenant_id, flag_name, is_enabled, description) VALUES (?, ?, ?, ?, ?)').bind(id, tenantId, flag, 1, `Enable ${flag.replace(/_/g, ' ')}`).run();
      }
    }

    // Record seed run
    await db.prepare('INSERT INTO seed_runs (id, tenant_id, seed_type, status, created_by) VALUES (?, ?, ?, ?, ?)').bind(seedId, tenantId, 'DEMO', 'COMPLETED', userId).run();

    return c.json({ success: true, message: 'Demo data seeded successfully', data: { seed_id: seedId } });
  } catch (error) {
    await db.prepare('INSERT INTO seed_runs (id, tenant_id, seed_type, status, error_message, created_by) VALUES (?, ?, ?, ?, ?, ?)').bind(seedId, tenantId, 'DEMO', 'FAILED', error.message, userId).run();
    return c.json({ success: false, message: 'Seed failed: ' + error.message }, 500);
  }
});

api.get('/seed/runs', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const runs = await db.prepare('SELECT * FROM seed_runs WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: runs.results || [] });
});

// ==================== Y. DEPLOYMENT & HEALTH ====================

api.get('/health', async (c) => {
  const db = c.env.DB;
  try {
    const result = await db.prepare('SELECT COUNT(*) as tables FROM sqlite_master WHERE type = "table"').first();
    return c.json({
      status: 'healthy',
      version: '2.0.0',
      database: { connected: true, tables: result?.tables || 0 },
      timestamp: new Date().toISOString(),
      environment: 'production'
    });
  } catch (e) {
    return c.json({ status: 'unhealthy', database: { connected: false, error: e.message }, timestamp: new Date().toISOString() }, 500);
  }
});

// ==================== Z. COMPLETE DOCUMENT INDEX ====================
api.get('/docs/index', (c) => {
  return c.json({
    success: true,
    data: {
      platform: 'FieldVibe',
      version: '2.0.0',
      modules: {
        A: { name: 'Product & Pricing Engine', endpoints: ['/price-lists', '/pricing/resolve', '/promotion-rules', '/promotions/apply'] },
        B: { name: 'Sales Order Engine', endpoints: ['/sales/orders/create', '/sales/orders/:id/status', '/sales/orders/:id/payments'] },
        C: { name: 'Van Sales', endpoints: ['/van-sales/loads/create', '/van-sales/sell', '/van-sales/loads/:id/return', '/van-sales/loads/:id/reconcile'] },
        D: { name: 'Returns & Credit Notes', endpoints: ['/returns', '/credit-notes'] },
        E: { name: 'Inventory', endpoints: ['/inventory/movements', '/inventory/transfers', '/inventory/adjustments', '/inventory/valuation'] },
        F: { name: 'Commission Engine', endpoints: ['/commission-rules', '/commission-earnings', '/commission-payouts'] },
        G: { name: 'Scheduling', endpoints: ['Automated via cron triggers'] },
        H: { name: 'Reporting', endpoints: ['/reports/sales-dashboard', '/reports/agent-performance', '/reports/stock-valuation', '/reports/commissions', '/reports/van-sales'] },
        I: { name: 'Frontend', endpoints: ['React SPA at fieldvibe.vantax.co.za'] },
        J: { name: 'Data Integrity', endpoints: ['/audit-log', '/process/audit'] },
        K: { name: 'Trade Promotions', endpoints: ['/trade-promotions', '/trade-promotion-claims', '/trade-promotions/:id/roi'] },
        L: { name: 'Field Operations', endpoints: ['/territories', '/route-plans', '/visit-activities', '/competitor-sightings', '/gps/validate'] },
        M: { name: 'Anomaly Detection', endpoints: ['/anomaly-flags', '/anomaly-detection/run'] },
        N: { name: 'RBAC', endpoints: ['/rbac/permissions', '/rbac/my-permissions', '/rbac/data-scope', '/feature-flags'] },
        O: { name: 'Insights Dashboards', endpoints: ['/insights/executive', '/insights/sales', '/insights/van-sales', '/insights/field-ops', '/insights/trade-promotions', '/insights/stock', '/insights/commissions', '/insights/goals', '/insights/anomalies'] },
        P: { name: 'Process Completeness', endpoints: ['/process/audit'] },
        Q: { name: 'Super Admin', endpoints: ['/platform/tenants', '/platform/settings', '/platform/health'] },
        R: { name: 'Verification', endpoints: ['Covered by /process/audit'] },
        S: { name: 'Email Reports', endpoints: ['/report-subscriptions', '/report-history', '/reports/generate'] },
        T: { name: 'API Docs & Webhooks', endpoints: ['/docs', '/webhooks', '/api-keys'] },
        U: { name: 'Data Export/Import', endpoints: ['/export', '/import', '/import-jobs'] },
        V: { name: 'Mobile', endpoints: ['React PWA support'] },
        W: { name: 'Error Handling', endpoints: ['/error-logs', '/audit-log'] },
        X: { name: 'Data Seeding', endpoints: ['/seed/demo', '/seed/runs'] },
        Y: { name: 'Deployment', endpoints: ['/health'] },
        Z: { name: 'Document Index', endpoints: ['/docs/index'] }
      }
    }
  });
});
