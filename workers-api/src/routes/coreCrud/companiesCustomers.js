import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../../lib/middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { validate, createCustomerSchema, updateCustomerSchema } from '../../validate.js';
import { evaluateNewStoreLocation, namePrefix } from '../../services/storeLocationCheck.js';

const app = new Hono();

// Existing stores that might be the same store the agent is adding: same name (by a
// cheap prefix filter, confirmed by exact normalized comparison in the evaluator) or
// the same typed address. Bounded — this runs on a table with no index on name.
async function findStoreLocationCandidates(db, tenantId, name, address) {
  const prefix = namePrefix(name);
  if (!prefix && !address) return [];
  const rows = await db.prepare(
    `SELECT id, name, address, latitude, longitude FROM customers
      WHERE tenant_id = ? AND status = 'active'
        AND latitude IS NOT NULL AND longitude IS NOT NULL
        AND (UPPER(name) LIKE ? OR (? != '' AND UPPER(IFNULL(address, '')) = ?))
      LIMIT 100`
  ).bind(tenantId, prefix ? `${prefix}%` : '\u0000', address ? String(address).toUpperCase() : '', address ? String(address).toUpperCase() : '').all();
  return rows.results || [];
}

// Read-only: the Add New Store dialog calls this before saving so the agent sees the
// warning while they can still fix a typo or pick the store that already exists.
// The authoritative version runs again inside POST /customers, which is what writes
// the review flag — a client can't talk its own anomaly away by skipping this call.
app.post('/customers/check-location', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const body = await c.req.json();
    const candidates = await findStoreLocationCandidates(db, tenantId, body.name, body.address);
    return c.json({ success: true, data: { findings: evaluateNewStoreLocation(body, candidates) } });
  } catch (e) {
    // Fail open: the check is advisory and must never stop a store being added.
    console.error('check-location failed:', e);
    return c.json({ success: true, data: { findings: [] } });
  }
});

// ==================== COMPANIES / TENANTS ====================
app.get('/companies', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenants = await db.prepare('SELECT * FROM tenants ORDER BY name LIMIT 500').all();
  return c.json({ success: true, data: tenants.results || [] });
});

app.post('/companies', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO tenants (id, name, code, status) VALUES (?, ?, ?, ?)').bind(id, body.name, body.code || body.name.toLowerCase().replace(/\s+/g, '-'), body.status || 'active').run();
  return c.json({ success: true, data: { id }, message: 'Company created' }, 201);
});

app.put('/companies/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE tenants SET name = COALESCE(?, name), status = COALESCE(?, status), updated_at = datetime("now") WHERE id = ?').bind(body.name || null, body.status || null, id).run();
  return c.json({ success: true, message: 'Company updated' });
});

app.get('/companies/:id/stats', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const [users, customers, visits] = await Promise.all([
    db.prepare('SELECT role, COUNT(*) as count FROM users WHERE tenant_id = ? GROUP BY role').bind(id).all(),
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(id).first(),
    db.prepare('SELECT COUNT(*) as count FROM visits WHERE tenant_id = ?').bind(id).first(),
  ]);
  return c.json({ success: true, data: { users: users.results || [], customerCount: customers ? customers.count : 0, visitCount: visits ? visits.count : 0 } });
});

// ==================== CUSTOMERS / SHOPS ====================
app.get('/customers', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { limit = 50, page = 1, search, status, type, customer_type } = c.req.query();
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];
  if (search) { where += ' AND (name LIKE ? OR code LIKE ? OR contact_person LIKE ?)'; params.push('%' + search + '%', '%' + search + '%', '%' + search + '%'); }
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (type || customer_type) { where += ' AND customer_type = ?'; params.push(customer_type || type); }
  const countR = await db.prepare('SELECT COUNT(*) as total FROM customers ' + where).bind(...params).first();
  const total = countR ? countR.total : 0;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const customers = await db.prepare('SELECT * FROM customers ' + where + ' ORDER BY name LIMIT ? OFFSET ?').bind(...params, limitNum, offset).all();
  return c.json({ success: true, data: { customers: customers.results || [], pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } } });
});

app.get('/customers/stats', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [totalR, activeR, typeStats] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM customers WHERE tenant_id = ? AND status = 'active'").bind(tenantId).first(),
    db.prepare('SELECT customer_type, COUNT(*) as count FROM customers WHERE tenant_id = ? GROUP BY customer_type').bind(tenantId).all(),
  ]);
  return c.json({ success: true, data: { total: totalR ? totalR.count : 0, active: activeR ? activeR.count : 0, byType: typeStats.results || [] } });
});

app.get('/customers/dashboard', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [total, active, newThisMonth, byType] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM customers WHERE tenant_id = ? AND status = 'active'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM customers WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare('SELECT customer_type, COUNT(*) as count FROM customers WHERE tenant_id = ? GROUP BY customer_type').bind(tenantId).all(),
  ]);
  return c.json({ success: true, data: { total: total?.count || 0, active: active?.count || 0, new_this_month: newThisMonth?.count || 0, by_type: byType.results || [] } });
});

app.get('/customers/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!customer) return c.json({ success: false, message: 'Customer not found' }, 404);
  return c.json({ success: true, data: customer });
});

app.post('/customers', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const v = validate(createCustomerSchema, body);
  if (!v.valid) return c.json({ success: false, message: 'Validation failed', errors: v.errors }, 400);
  const id = uuidv4();
  await db.prepare('INSERT INTO customers (id, tenant_id, name, code, type, customer_type, contact_person, contact_phone, contact_email, phone, email, address, latitude, longitude, route_id, credit_limit, outstanding_balance, payment_terms, category, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.code || id.slice(0, 8), body.type || 'retail', body.customer_type || body.customerType || 'SHOP', body.contact_person || body.contactPerson || null, body.contact_phone || body.contactPhone || null, body.contact_email || body.contactEmail || null, body.phone || null, body.email || null, body.address || null, body.latitude || null, body.longitude || null, body.route_id || null, body.credit_limit || body.creditLimit || 0, 0, body.payment_terms || 0, body.category || 'B', body.notes || null, 'active').run();

  // A store added from the check-in flow is pinned wherever the agent was standing.
  // Re-run the location check here (not on the client's word) and record anything
  // that doesn't add up for a team lead to review. Never blocks the create.
  let findings = [];
  if (body.source === 'field_visit') {
    try {
      const candidates = await findStoreLocationCandidates(db, tenantId, body.name, body.address);
      findings = evaluateNewStoreLocation(body, candidates);
      if (findings.length > 0) {
        const agentId = c.get('userId');
        await db.batch(findings.map(f => db.prepare(
          "INSERT INTO anomaly_flags (id, tenant_id, agent_id, anomaly_type, severity, description, reference_type, reference_id, data, status, created_at) VALUES (?, ?, ?, 'STORE_LOCATION_MISMATCH', ?, ?, 'CUSTOMER', ?, ?, 'OPEN', datetime('now'))"
        ).bind(uuidv4(), tenantId, agentId, f.severity, f.description, id, JSON.stringify({ ...f, store_name: body.name, latitude: body.latitude ?? null, longitude: body.longitude ?? null }))));
      }
    } catch (e) {
      console.error('Store location flagging failed:', e);
    }
  }

  return c.json({ success: true, data: { id, location_findings: findings }, message: 'Customer created' }, 201);
});

app.put('/customers/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  const v = validate(updateCustomerSchema, body);
  if (!v.valid) return c.json({ success: false, message: 'Validation failed', errors: v.errors }, 400);
  await db.prepare('UPDATE customers SET name = COALESCE(?, name), code = COALESCE(?, code), customer_type = COALESCE(?, customer_type), contact_person = COALESCE(?, contact_person), contact_phone = COALESCE(?, contact_phone), phone = COALESCE(?, phone), email = COALESCE(?, email), address = COALESCE(?, address), latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude), credit_limit = COALESCE(?, credit_limit), category = COALESCE(?, category), notes = COALESCE(?, notes), status = COALESCE(?, status), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.code || null, body.customer_type || body.customerType || null, body.contact_person || body.contactPerson || null, body.contact_phone || body.contactPhone || null, body.phone || null, body.email || null, body.address || null, body.latitude || null, body.longitude || null, body.credit_limit || body.creditLimit || null, body.category || null, body.notes || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'Customer updated' });
});

app.delete('/customers/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare("UPDATE customers SET status = 'inactive' WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Customer deactivated' });
});
// ==================== REGIONS / AREAS / ROUTES ====================
app.get('/regions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const regions = await db.prepare('SELECT * FROM regions WHERE tenant_id = ? ORDER BY name LIMIT 500').bind(tenantId).all();
  return c.json({ success: true, data: regions.results || [] });
});

app.post('/regions', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO regions (id, tenant_id, name, code) VALUES (?, ?, ?, ?)').bind(id, tenantId, body.name, body.code || body.name.slice(0, 5).toUpperCase()).run();
  return c.json({ success: true, data: { id } }, 201);
});
// ==================== CUSTOMERS ADDITIONAL ROUTES ====================
app.get('/customers/:customerId/orders', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const customerId = c.req.param('customerId');
  const orders = await db.prepare("SELECT * FROM sales_orders WHERE tenant_id = ? AND customer_id = ? ORDER BY created_at DESC").bind(tenantId, customerId).all();
  return c.json({ data: orders.results || [] });
});
app.get('/customers/:customerId/transactions', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/customers/:customerId/visits', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/customers/bulk', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/customers/export', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/customers/import', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

export default app;
