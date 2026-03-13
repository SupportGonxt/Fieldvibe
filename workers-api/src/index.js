import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Tenant-Code', 'x-tenant-code'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({ status: 'ok', service: 'FieldVibe API', version: '1.0.0' }));
app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));

// ==================== JWT HELPERS ====================
async function generateToken(payload, secret, expiresIn = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp: now + expiresIn };
  const base64Header = btoa(JSON.stringify(header));
  const base64Payload = btoa(JSON.stringify(tokenPayload));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(base64Header + '.' + base64Payload));
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64Header + '.' + base64Payload + '.' + base64Signature;
}

// Auth middleware
const authMiddleware = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }
    const token = authHeader.substring(7);
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return c.json({ success: false, message: 'Token expired' }, 401);
    }
    c.set('userId', payload.userId);
    c.set('tenantId', payload.tenantId);
    c.set('role', payload.role);
    await next();
  } catch (error) {
    return c.json({ success: false, message: 'Invalid token' }, 401);
  }
};

const requireRole = (...roles) => {
  return async (c, next) => {
    const role = c.get('role');
    if (role === 'admin' || roles.includes(role)) {
      await next();
    } else {
      return c.json({ success: false, message: 'Insufficient permissions' }, 403);
    }
  };
};

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', async (c) => {
  try {
    const { email, phone, password } = await c.req.json();
    const db = c.env.DB;
    const loginField = email || phone;
    const user = await db.prepare('SELECT * FROM users WHERE (email = ? OR phone = ?) AND is_active = 1').bind(loginField, loginField).first();
    if (!user) return c.json({ success: false, message: 'Invalid credentials' }, 401);
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return c.json({ success: false, message: 'Invalid credentials' }, 401);
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) return c.json({ success: false, message: 'Server configuration error' }, 500);
    const accessToken = await generateToken({ userId: user.id, tenantId: user.tenant_id, role: user.role }, jwtSecret);
    const refreshToken = await generateToken({ userId: user.id, tenantId: user.tenant_id, role: user.role, type: 'refresh' }, jwtSecret, 604800);
    try { await db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?').bind(user.id).run(); } catch(e) {}
    const tenant = await db.prepare('SELECT name FROM tenants WHERE id = ?').bind(user.tenant_id).first();
    return c.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, phone: user.phone, firstName: user.first_name, lastName: user.last_name, name: user.first_name + ' ' + user.last_name, role: user.role, status: user.status, tenantId: user.tenant_id, companyName: tenant ? tenant.name : '' },
        tokens: { access_token: accessToken, refresh_token: refreshToken, expires_in: 86400, token_type: 'Bearer' },
        token: accessToken,
        access_token: accessToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ success: false, message: 'Login failed' }, 500);
  }
});

app.post('/api/auth/register', async (c) => {
  try {
    const db = c.env.DB;
    const { email, phone, password, firstName, lastName, tenantCode } = await c.req.json();
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return c.json({ success: false, message: 'Email already exists' }, 400);
    let tenantId;
    if (tenantCode) {
      const tenant = await db.prepare('SELECT id FROM tenants WHERE code = ?').bind(tenantCode).first();
      if (!tenant) return c.json({ success: false, message: 'Invalid tenant code' }, 400);
      tenantId = tenant.id;
    } else {
      tenantId = uuidv4();
      const companyName = firstName + "'s Company";
      const code = email.split('@')[0];
      await db.prepare('INSERT INTO tenants (id, name, code, status) VALUES (?, ?, ?, ?)').bind(tenantId, companyName, code, 'active').run();
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    await db.prepare('INSERT INTO users (id, tenant_id, email, phone, password_hash, first_name, last_name, role, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').bind(userId, tenantId, email, phone || null, hashedPassword, firstName, lastName, 'admin', 'active').run();
    const jwtSecret = c.env.JWT_SECRET;
    const accessToken = await generateToken({ userId, tenantId, role: 'admin' }, jwtSecret);
    return c.json({ success: true, data: { user: { id: userId, email, role: 'admin', tenantId }, token: accessToken } }, 201);
  } catch (error) {
    console.error('Register error:', error);
    return c.json({ success: false, message: 'Registration failed' }, 500);
  }
});

app.get('/api/auth/me', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const user = await db.prepare('SELECT id, tenant_id, email, phone, first_name, last_name, role, status FROM users WHERE id = ?').bind(userId).first();
  if (!user) return c.json({ success: false, message: 'User not found' }, 404);
  const tenant = await db.prepare('SELECT name FROM tenants WHERE id = ?').bind(user.tenant_id).first();
  return c.json({ success: true, data: { ...user, name: user.first_name + ' ' + user.last_name, companyName: tenant ? tenant.name : '' } });
});

// ==================== PROTECTED API ROUTES ====================
const api = new Hono();
api.use('*', authMiddleware);

// ==================== USERS ====================
api.get('/users', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { search, role, page = 1, limit = 50 } = c.req.query();
  let where = 'WHERE u.tenant_id = ?';
  const params = [tenantId];
  if (search) { where += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)'; params.push('%' + search + '%', '%' + search + '%', '%' + search + '%', '%' + search + '%'); }
  if (role) { where += ' AND u.role = ?'; params.push(role); }
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const countR = await db.prepare('SELECT COUNT(*) as total FROM users u ' + where).bind(...params).first();
  const users = await db.prepare("SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.role, u.status, u.is_active, u.manager_id, u.team_lead_id, u.last_login, u.created_at, u.admin_viewable_password, m.first_name || ' ' || m.last_name as manager_name FROM users u LEFT JOIN users m ON u.manager_id = m.id " + where + ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?').bind(...params, parseInt(limit), offset).all();
  return c.json({ success: true, data: { users: users.results || [], pagination: { total: countR ? countR.total : 0, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil((countR ? countR.total : 0) / parseInt(limit)) } } });
});

api.post('/users', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  const password = body.password || Math.random().toString(36).slice(-8);
  const hashedPassword = await bcrypt.hash(password, 10);
  await db.prepare('INSERT INTO users (id, tenant_id, email, phone, password_hash, first_name, last_name, role, manager_id, team_lead_id, status, is_active, admin_viewable_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)').bind(id, tenantId, body.email, body.phone || null, hashedPassword, body.firstName || body.first_name || '', body.lastName || body.last_name || '', body.role || 'agent', body.managerId || body.manager_id || null, body.teamLeadId || body.team_lead_id || null, 'active', password).run();
  return c.json({ success: true, data: { id, password }, message: 'User created' }, 201);
});

api.put('/users/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE users SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), role = COALESCE(?, role), phone = COALESCE(?, phone), email = COALESCE(?, email), manager_id = ?, team_lead_id = ?, status = COALESCE(?, status), is_active = COALESCE(?, is_active), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.firstName || body.first_name || null, body.lastName || body.last_name || null, body.role || null, body.phone || null, body.email || null, body.managerId || body.manager_id || null, body.teamLeadId || body.team_lead_id || null, body.status || null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, id, tenantId).run();
  return c.json({ success: true, message: 'User updated' });
});

api.delete('/users/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare('UPDATE users SET is_active = 0, status = ? WHERE id = ? AND tenant_id = ?').bind('inactive', id, tenantId).run();
  return c.json({ success: true, message: 'User deactivated' });
});

api.post('/users/:id/reset-password', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const newPassword = Math.random().toString(36).slice(-8);
  const hashed = await bcrypt.hash(newPassword, 10);
  await db.prepare('UPDATE users SET password_hash = ?, admin_viewable_password = ? WHERE id = ? AND tenant_id = ?').bind(hashed, newPassword, id, tenantId).run();
  return c.json({ success: true, data: { password: newPassword } });
});

// ==================== COMPANIES / TENANTS ====================
api.get('/companies', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenants = await db.prepare('SELECT * FROM tenants ORDER BY name').all();
  return c.json({ success: true, data: tenants.results || [] });
});

api.post('/companies', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO tenants (id, name, code, status) VALUES (?, ?, ?, ?)').bind(id, body.name, body.code || body.name.toLowerCase().replace(/\s+/g, '-'), body.status || 'active').run();
  return c.json({ success: true, data: { id }, message: 'Company created' }, 201);
});

api.put('/companies/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE tenants SET name = COALESCE(?, name), status = COALESCE(?, status), updated_at = datetime("now") WHERE id = ?').bind(body.name || null, body.status || null, id).run();
  return c.json({ success: true, message: 'Company updated' });
});

api.get('/companies/:id/stats', requireRole('admin'), async (c) => {
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
api.get('/customers', async (c) => {
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

api.get('/customers/stats', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [totalR, activeR, typeStats] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM customers WHERE tenant_id = ? AND status = 'active'").bind(tenantId).first(),
    db.prepare('SELECT customer_type, COUNT(*) as count FROM customers WHERE tenant_id = ? GROUP BY customer_type').bind(tenantId).all(),
  ]);
  return c.json({ success: true, data: { total: totalR ? totalR.count : 0, active: activeR ? activeR.count : 0, byType: typeStats.results || [] } });
});

api.get('/customers/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!customer) return c.json({ success: false, message: 'Customer not found' }, 404);
  return c.json({ success: true, data: customer });
});

api.post('/customers', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO customers (id, tenant_id, name, code, type, customer_type, contact_person, contact_phone, contact_email, phone, email, address, latitude, longitude, route_id, credit_limit, outstanding_balance, payment_terms, category, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.code || id.slice(0, 8), body.type || 'retail', body.customer_type || body.customerType || 'SHOP', body.contact_person || body.contactPerson || null, body.contact_phone || body.contactPhone || null, body.contact_email || body.contactEmail || null, body.phone || null, body.email || null, body.address || null, body.latitude || null, body.longitude || null, body.route_id || null, body.credit_limit || body.creditLimit || 0, 0, body.payment_terms || 0, body.category || 'B', body.notes || null, 'active').run();
  return c.json({ success: true, data: { id }, message: 'Customer created' }, 201);
});

api.put('/customers/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE customers SET name = COALESCE(?, name), code = COALESCE(?, code), customer_type = COALESCE(?, customer_type), contact_person = COALESCE(?, contact_person), contact_phone = COALESCE(?, contact_phone), phone = COALESCE(?, phone), email = COALESCE(?, email), address = COALESCE(?, address), latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude), credit_limit = COALESCE(?, credit_limit), category = COALESCE(?, category), notes = COALESCE(?, notes), status = COALESCE(?, status), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.code || null, body.customer_type || body.customerType || null, body.contact_person || body.contactPerson || null, body.contact_phone || body.contactPhone || null, body.phone || null, body.email || null, body.address || null, body.latitude || null, body.longitude || null, body.credit_limit || body.creditLimit || null, body.category || null, body.notes || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'Customer updated' });
});

api.delete('/customers/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare("UPDATE customers SET status = 'inactive' WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Customer deactivated' });
});

// ==================== BRANDS ====================
api.get('/brands', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const brands = await db.prepare("SELECT b.*, (SELECT COUNT(*) FROM categories WHERE brand_id = b.id) as category_count, (SELECT COUNT(*) FROM products WHERE brand_id = b.id) as product_count FROM brands b WHERE b.tenant_id = ? ORDER BY b.name").bind(tenantId).all();
  return c.json({ success: true, data: brands.results || [] });
});

api.post('/brands', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  const code = (body.code || body.name.toLowerCase().replace(/\s+/g, '-'));
  await db.prepare('INSERT INTO brands (id, tenant_id, name, code, description, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, code, body.description || null, 'active').run();
  return c.json({ success: true, data: { id }, message: 'Brand created' }, 201);
});

api.put('/brands/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE brands SET name = COALESCE(?, name), description = COALESCE(?, description), status = COALESCE(?, status) WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.description || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'Brand updated' });
});

api.delete('/brands/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare('DELETE FROM products WHERE brand_id = ? AND tenant_id = ?').bind(id, tenantId).run();
  await db.prepare('DELETE FROM categories WHERE brand_id = ? AND tenant_id = ?').bind(id, tenantId).run();
  await db.prepare('DELETE FROM brands WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Brand deleted' });
});

api.get('/brands/:brandId/categories', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { brandId } = c.req.param();
  const cats = await db.prepare('SELECT * FROM categories WHERE brand_id = ? AND tenant_id = ? ORDER BY name').bind(brandId, tenantId).all();
  return c.json({ success: true, data: cats.results || [] });
});

api.post('/brands/:brandId/categories', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { brandId } = c.req.param();
  const body = await c.req.json();
  const id = uuidv4();
  const code = (body.code || body.name.toLowerCase().replace(/\s+/g, '-'));
  await db.prepare('INSERT INTO categories (id, tenant_id, brand_id, name, code, description) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, brandId, body.name, code, body.description || null).run();
  return c.json({ success: true, data: { id } }, 201);
});

// ==================== CATEGORIES ====================
api.get('/categories', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const cats = await db.prepare('SELECT c.*, b.name as brand_name FROM categories c LEFT JOIN brands b ON c.brand_id = b.id WHERE c.tenant_id = ? ORDER BY c.name').bind(tenantId).all();
  return c.json({ success: true, data: cats.results || [] });
});

api.get('/categories/:id/products', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const prods = await db.prepare('SELECT * FROM products WHERE category_id = ? AND tenant_id = ? ORDER BY name').bind(id, tenantId).all();
  return c.json({ success: true, data: prods.results || [] });
});

// ==================== PRODUCTS ====================
api.get('/products', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { limit = 100, offset = 0, search, category_id, brand_id, status } = c.req.query();
  let query = 'SELECT p.*, c.name as category_name, b.name as brand_name FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN brands b ON p.brand_id = b.id WHERE p.tenant_id = ?';
  const params = [tenantId];
  if (search) { query += ' AND (p.name LIKE ? OR p.code LIKE ? OR p.sku LIKE ?)'; params.push('%' + search + '%', '%' + search + '%', '%' + search + '%'); }
  if (category_id) { query += ' AND p.category_id = ?'; params.push(category_id); }
  if (brand_id) { query += ' AND p.brand_id = ?'; params.push(brand_id); }
  if (status) { query += ' AND p.status = ?'; params.push(status); }
  query += ' ORDER BY p.name LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const products = await db.prepare(query).bind(...params).all();
  return c.json({ success: true, data: (products.results || []).map(p => ({ ...p, selling_price: p.price })) });
});

api.get('/products/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const product = await db.prepare('SELECT p.*, c.name as category_name, b.name as brand_name FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN brands b ON p.brand_id = b.id WHERE p.id = ? AND p.tenant_id = ?').bind(id, tenantId).first();
  if (!product) return c.json({ success: false, message: 'Product not found' }, 404);
  return c.json({ success: true, data: { ...product, selling_price: product.price } });
});

api.post('/products', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO products (id, tenant_id, name, code, sku, barcode, category_id, brand_id, unit_of_measure, price, cost_price, tax_rate, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.code || id.slice(0, 8), body.sku || null, body.barcode || null, body.category_id || body.categoryId || null, body.brand_id || body.brandId || null, body.unit_of_measure || body.unitOfMeasure || 'each', body.price || 0, body.cost_price || body.costPrice || 0, body.tax_rate || body.taxRate || 15, 'active').run();
  return c.json({ success: true, data: { id }, message: 'Product created' }, 201);
});

api.put('/products/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE products SET name = COALESCE(?, name), code = COALESCE(?, code), sku = COALESCE(?, sku), category_id = COALESCE(?, category_id), brand_id = COALESCE(?, brand_id), price = COALESCE(?, price), cost_price = COALESCE(?, cost_price), tax_rate = COALESCE(?, tax_rate), status = COALESCE(?, status) WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.code || null, body.sku || null, body.category_id || null, body.brand_id || null, body.price || null, body.cost_price || null, body.tax_rate || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'Product updated' });
});

api.delete('/products/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare('DELETE FROM products WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Product deleted' });
});

// ==================== VISITS / CHECK-INS ====================
api.get('/visits', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { limit = 50, page = 1, search, status, agent_id, visit_type, start_date, end_date } = c.req.query();
  let where = 'WHERE v.tenant_id = ?';
  const params = [tenantId];
  if (role === 'agent') { where += ' AND v.agent_id = ?'; params.push(userId); }
  if (agent_id) { where += ' AND v.agent_id = ?'; params.push(agent_id); }
  if (status) { where += ' AND v.status = ?'; params.push(status); }
  if (visit_type) { where += ' AND v.visit_type = ?'; params.push(visit_type); }
  if (start_date) { where += ' AND v.visit_date >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND v.visit_date <= ?'; params.push(end_date); }
  if (search) { where += ' AND (c.name LIKE ? OR v.notes LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const countR = await db.prepare('SELECT COUNT(*) as total FROM visits v LEFT JOIN customers c ON v.customer_id = c.id ' + where).bind(...params).first();
  const total = countR ? countR.total : 0;
  const visits = await db.prepare("SELECT v.*, c.name as customer_name, c.address as customer_address, u.first_name || ' ' || u.last_name as agent_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id " + where + ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?').bind(...params, limitNum, offset).all();
  return c.json({ success: true, data: { visits: visits.results || [], pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } } });
});

api.get('/visits/stats', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { start_date, end_date } = c.req.query();
  let dateFilter = '';
  const params = [tenantId];
  if (start_date) { dateFilter += ' AND visit_date >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND visit_date <= ?'; params.push(end_date); }
  const [total, completed, pending, byType] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM visits WHERE tenant_id = ?' + dateFilter).bind(...params).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND status = 'completed'" + dateFilter).bind(...params).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND status = 'pending'" + dateFilter).bind(...params).first(),
    db.prepare('SELECT visit_type, COUNT(*) as count FROM visits WHERE tenant_id = ?' + dateFilter + ' GROUP BY visit_type').bind(...params).all(),
  ]);
  return c.json({ success: true, data: { total: total ? total.count : 0, completed: completed ? completed.count : 0, pending: pending ? pending.count : 0, byType: byType.results || [] } });
});

api.get('/visits/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const visit = await db.prepare("SELECT v.*, c.name as customer_name, c.address as customer_address, u.first_name || ' ' || u.last_name as agent_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id WHERE v.id = ? AND v.tenant_id = ?").bind(id, tenantId).first();
  if (!visit) return c.json({ success: false, message: 'Visit not found' }, 404);
  const responses = await db.prepare('SELECT * FROM visit_responses WHERE visit_id = ?').bind(id).all();
  return c.json({ success: true, data: { ...visit, responses: responses.results || [] } });
});

api.post('/visits', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  const visitDate = body.visit_date || new Date().toISOString().split('T')[0];
  await db.prepare('INSERT INTO visits (id, tenant_id, agent_id, customer_id, visit_date, visit_type, check_in_time, latitude, longitude, photo_url, photo_base64, additional_photos, brand_id, category_id, product_id, individual_name, individual_surname, individual_id_number, individual_phone, purpose, outcome, notes, questionnaire_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.agent_id || userId, body.customer_id || null, visitDate, body.visit_type || 'customer', body.check_in_time || new Date().toISOString(), body.latitude || null, body.longitude || null, body.photo_url || null, body.photo_base64 || null, body.additional_photos ? JSON.stringify(body.additional_photos) : null, body.brand_id || null, body.category_id || null, body.product_id || null, body.individual_name || null, body.individual_surname || null, body.individual_id_number || null, body.individual_phone || null, body.purpose || null, body.outcome || null, body.notes || null, body.questionnaire_id || null, body.status || 'pending').run();
  if (body.responses) {
    const respId = uuidv4();
    await db.prepare('INSERT INTO visit_responses (id, tenant_id, visit_id, visit_type, responses) VALUES (?, ?, ?, ?, ?)').bind(respId, tenantId, id, body.visit_type || 'customer', JSON.stringify(body.responses)).run();
  }
  return c.json({ success: true, data: { id }, message: 'Visit created' }, 201);
});

api.put('/visits/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE visits SET check_out_time = COALESCE(?, check_out_time), outcome = COALESCE(?, outcome), notes = COALESCE(?, notes), status = COALESCE(?, status), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.check_out_time || null, body.outcome || null, body.notes || null, body.status || null, id, tenantId).run();
  if (body.responses) {
    const existing = await db.prepare('SELECT id FROM visit_responses WHERE visit_id = ?').bind(id).first();
    if (existing) {
      await db.prepare('UPDATE visit_responses SET responses = ? WHERE visit_id = ?').bind(JSON.stringify(body.responses), id).run();
    } else {
      const respId = uuidv4();
      await db.prepare('INSERT INTO visit_responses (id, tenant_id, visit_id, responses) VALUES (?, ?, ?, ?)').bind(respId, tenantId, id, JSON.stringify(body.responses)).run();
    }
  }
  return c.json({ success: true, message: 'Visit updated' });
});

api.post('/visits/:id/check-out', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare("UPDATE visits SET check_out_time = ?, status = 'completed', outcome = COALESCE(?, outcome), notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(body.check_out_time || new Date().toISOString(), body.outcome || null, body.notes || null, id, tenantId).run();
  return c.json({ success: true, message: 'Checked out successfully' });
});

// ==================== QUESTIONNAIRES ====================
api.get('/questionnaires', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { visit_type, brand_id } = c.req.query();
  let where = 'WHERE tenant_id = ? AND is_active = 1';
  const params = [tenantId];
  if (visit_type) { where += ' AND visit_type = ?'; params.push(visit_type); }
  if (brand_id) { where += ' AND (brand_id = ? OR brand_id IS NULL)'; params.push(brand_id); }
  const questionnaires = await db.prepare('SELECT * FROM questionnaires ' + where + ' ORDER BY name').bind(...params).all();
  const results = (questionnaires.results || []).map(q => {
    try { q.questions = JSON.parse(q.questions); } catch(e) {}
    return q;
  });
  return c.json({ success: true, data: results });
});

api.post('/questionnaires', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO questionnaires (id, tenant_id, name, visit_type, brand_id, questions, is_default, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)').bind(id, tenantId, body.name, body.visit_type || 'customer', body.brand_id || null, JSON.stringify(body.questions), body.is_default ? 1 : 0).run();
  return c.json({ success: true, data: { id } }, 201);
});

api.put('/questionnaires/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE questionnaires SET name = COALESCE(?, name), visit_type = COALESCE(?, visit_type), questions = COALESCE(?, questions), is_active = COALESCE(?, is_active), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.visit_type || null, body.questions ? JSON.stringify(body.questions) : null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, id, tenantId).run();
  return c.json({ success: true, message: 'Questionnaire updated' });
});

// ==================== REGIONS / AREAS / ROUTES ====================
api.get('/regions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const regions = await db.prepare('SELECT * FROM regions WHERE tenant_id = ? ORDER BY name').bind(tenantId).all();
  return c.json({ success: true, data: regions.results || [] });
});

api.post('/regions', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO regions (id, tenant_id, name, code) VALUES (?, ?, ?, ?)').bind(id, tenantId, body.name, body.code || body.name.slice(0, 5).toUpperCase()).run();
  return c.json({ success: true, data: { id } }, 201);
});

api.get('/areas', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { region_id } = c.req.query();
  let query = 'SELECT a.*, r.name as region_name FROM areas a LEFT JOIN regions r ON a.region_id = r.id WHERE a.tenant_id = ?';
  const params = [tenantId];
  if (region_id) { query += ' AND a.region_id = ?'; params.push(region_id); }
  query += ' ORDER BY a.name';
  const areas = await db.prepare(query).bind(...params).all();
  return c.json({ success: true, data: areas.results || [] });
});

api.post('/areas', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO areas (id, tenant_id, region_id, name, code) VALUES (?, ?, ?, ?, ?)').bind(id, tenantId, body.region_id, body.name, body.code || body.name.slice(0, 5).toUpperCase()).run();
  return c.json({ success: true, data: { id } }, 201);
});

api.get('/routes', async (c) => {
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

api.post('/routes', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO routes (id, tenant_id, area_id, name, code, salesman_id) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.area_id, body.name, body.code || body.name.slice(0, 5).toUpperCase(), body.salesman_id || null).run();
  return c.json({ success: true, data: { id } }, 201);
});

// ==================== GOALS ====================
api.get('/goals', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const goals = await db.prepare('SELECT * FROM goals WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: goals.results || [] });
});

api.post('/goals', requireRole('admin', 'manager'), async (c) => {
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

api.put('/goals/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE goals SET title = COALESCE(?, title), description = COALESCE(?, description), target_value = COALESCE(?, target_value), current_value = COALESCE(?, current_value), status = COALESCE(?, status), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.title || null, body.description || null, body.target_value || null, body.current_value || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'Goal updated' });
});

// ==================== SALES ORDERS ====================
api.get('/sales-orders', async (c) => {
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

api.get('/sales-orders/stats', async (c) => {
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

api.get('/sales-orders/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const order = await db.prepare("SELECT so.*, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id LEFT JOIN users u ON so.agent_id = u.id WHERE so.id = ? AND so.tenant_id = ?").bind(id, tenantId).first();
  if (!order) return c.json({ success: false, message: 'Order not found' }, 404);
  const items = await db.prepare('SELECT soi.*, p.name as product_name, p.code as product_code FROM sales_order_items soi LEFT JOIN products p ON soi.product_id = p.id WHERE soi.sales_order_id = ?').bind(id).all();
  const payments = await db.prepare('SELECT * FROM payments WHERE sales_order_id = ?').bind(id).all();
  return c.json({ success: true, data: { ...order, items: items.results || [], payments: payments.results || [] } });
});

api.post('/sales-orders', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  const orderNumber = 'SO-' + Date.now().toString(36).toUpperCase();
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

api.put('/sales-orders/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE sales_orders SET status = COALESCE(?, status), payment_status = COALESCE(?, payment_status), notes = COALESCE(?, notes), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.status || null, body.payment_status || null, body.notes || null, id, tenantId).run();
  return c.json({ success: true, message: 'Order updated' });
});

api.put('/sales-orders/:id/cancel', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare("UPDATE sales_orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Order cancelled' });
});

// ==================== PAYMENTS ====================
api.get('/payments', async (c) => {
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

api.post('/payments', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare("INSERT INTO payments (id, tenant_id, sales_order_id, amount, method, reference, status) VALUES (?, ?, ?, ?, ?, ?, 'completed')").bind(id, tenantId, body.sales_order_id, body.amount, body.method || 'cash', body.reference || null).run();
  // Update order payment status
  const order = await db.prepare('SELECT total_amount FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(body.sales_order_id, tenantId).first();
  const totalPaid = await db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE sales_order_id = ? AND tenant_id = ?').bind(body.sales_order_id, tenantId).first();
  if (order && totalPaid) {
    const newStatus = totalPaid.total >= order.total_amount ? 'paid' : 'partial';
    await db.prepare("UPDATE sales_orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(newStatus, body.sales_order_id, tenantId).run();
  }
  return c.json({ success: true, data: { id }, message: 'Payment recorded' }, 201);
});

// ==================== WAREHOUSES & STOCK ====================
api.get('/warehouses', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const warehouses = await db.prepare('SELECT * FROM warehouses WHERE tenant_id = ? ORDER BY name').bind(tenantId).all();
  return c.json({ success: true, data: warehouses.results || [] });
});

api.post('/warehouses', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO warehouses (id, tenant_id, name, code, type, address, latitude, longitude, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.code || body.name.slice(0, 5).toUpperCase(), body.type || 'main', body.address || null, body.latitude || null, body.longitude || null, 'active').run();
  return c.json({ success: true, data: { id } }, 201);
});

api.put('/warehouses/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE warehouses SET name = COALESCE(?, name), address = COALESCE(?, address), status = COALESCE(?, status) WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.address || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'Warehouse updated' });
});

// Stock levels
api.get('/stock-levels', async (c) => {
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

api.post('/stock-levels', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO stock_levels (id, tenant_id, warehouse_id, product_id, quantity, reserved_quantity, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.warehouse_id, body.product_id, body.quantity || 0, body.reserved_quantity || 0, body.reorder_level || 10).run();
  return c.json({ success: true, data: { id } }, 201);
});

api.put('/stock-levels/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE stock_levels SET quantity = COALESCE(?, quantity), reserved_quantity = COALESCE(?, reserved_quantity), reorder_level = COALESCE(?, reorder_level), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.quantity !== undefined ? body.quantity : null, body.reserved_quantity !== undefined ? body.reserved_quantity : null, body.reorder_level !== undefined ? body.reorder_level : null, id, tenantId).run();
  return c.json({ success: true, message: 'Stock level updated' });
});

// Stock movements
api.get('/stock-movements', async (c) => {
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

api.post('/stock-movements', requireRole('admin', 'manager'), async (c) => {
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
      await db.prepare('UPDATE stock_levels SET quantity = quantity + ?, updated_at = datetime("now") WHERE id = ?').bind(delta, existing.id).run();
    } else {
      const slId = uuidv4();
      await db.prepare('INSERT INTO stock_levels (id, tenant_id, warehouse_id, product_id, quantity) VALUES (?, ?, ?, ?, ?)').bind(slId, tenantId, body.warehouse_id, body.product_id, Math.max(0, delta)).run();
    }
  }
  return c.json({ success: true, data: { id }, message: 'Stock movement recorded' }, 201);
});

// Purchase orders
api.get('/purchase-orders', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { status, warehouse_id } = c.req.query();
  let where = 'WHERE po.tenant_id = ?';
  const params = [tenantId];
  if (status) { where += ' AND po.status = ?'; params.push(status); }
  if (warehouse_id) { where += ' AND po.warehouse_id = ?'; params.push(warehouse_id); }
  const orders = await db.prepare('SELECT po.*, w.name as warehouse_name FROM purchase_orders po LEFT JOIN warehouses w ON po.warehouse_id = w.id ' + where + ' ORDER BY po.created_at DESC').bind(...params).all();
  return c.json({ success: true, data: orders.results || [] });
});

api.get('/purchase-orders/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const po = await db.prepare('SELECT po.*, w.name as warehouse_name FROM purchase_orders po LEFT JOIN warehouses w ON po.warehouse_id = w.id WHERE po.id = ? AND po.tenant_id = ?').bind(id, tenantId).first();
  if (!po) return c.json({ success: false, message: 'Purchase order not found' }, 404);
  const items = await db.prepare('SELECT poi.*, p.name as product_name FROM purchase_order_items poi LEFT JOIN products p ON poi.product_id = p.id WHERE poi.purchase_order_id = ?').bind(id).all();
  return c.json({ success: true, data: { ...po, items: items.results || [] } });
});

api.post('/purchase-orders', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  const poNumber = 'PO-' + Date.now().toString(36).toUpperCase();
  let totalAmount = 0;
  if (body.items && Array.isArray(body.items)) {
    for (const item of body.items) {
      totalAmount += (item.quantity_ordered || 0) * (item.unit_cost || 0);
    }
  }
  await db.prepare('INSERT INTO purchase_orders (id, tenant_id, po_number, supplier_name, warehouse_id, total_amount, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, poNumber, body.supplier_name || null, body.warehouse_id, totalAmount, 'draft', userId).run();
  if (body.items && Array.isArray(body.items)) {
    for (const item of body.items) {
      const itemId = uuidv4();
      const lineTotal = (item.quantity_ordered || 0) * (item.unit_cost || 0);
      await db.prepare('INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity_ordered, unit_cost, line_total) VALUES (?, ?, ?, ?, ?, ?)').bind(itemId, id, item.product_id, item.quantity_ordered || 0, item.unit_cost || 0, lineTotal).run();
    }
  }
  return c.json({ success: true, data: { id, po_number: poNumber } }, 201);
});

api.put('/purchase-orders/:id/receive', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();
  const po = await db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!po) return c.json({ success: false, message: 'PO not found' }, 404);
  // Update received quantities and create stock movements
  if (body.items && Array.isArray(body.items)) {
    for (const item of body.items) {
      await db.prepare('UPDATE purchase_order_items SET quantity_received = ? WHERE id = ?').bind(item.quantity_received || 0, item.id).run();
      if (item.quantity_received > 0) {
        const smId = uuidv4();
        await db.prepare("INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, 'received', ?, 'purchase_order', ?, ?)").bind(smId, tenantId, po.warehouse_id, item.product_id, item.quantity_received, id, userId).run();
        // Update stock level
        const existing = await db.prepare('SELECT id FROM stock_levels WHERE warehouse_id = ? AND product_id = ? AND tenant_id = ?').bind(po.warehouse_id, item.product_id, tenantId).first();
        if (existing) {
          await db.prepare('UPDATE stock_levels SET quantity = quantity + ?, updated_at = datetime("now") WHERE id = ?').bind(item.quantity_received, existing.id).run();
        } else {
          const slId = uuidv4();
          await db.prepare('INSERT INTO stock_levels (id, tenant_id, warehouse_id, product_id, quantity) VALUES (?, ?, ?, ?, ?)').bind(slId, tenantId, po.warehouse_id, item.product_id, item.quantity_received).run();
        }
      }
    }
  }
  await db.prepare("UPDATE purchase_orders SET status = 'received', received_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(id).run();
  return c.json({ success: true, message: 'Purchase order received' });
});

// ==================== VAN SALES ====================
api.get('/van-stock-loads', async (c) => {
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

api.get('/van-stock-loads/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const load = await db.prepare("SELECT vsl.*, u.first_name || ' ' || u.last_name as agent_name, w.name as warehouse_name FROM van_stock_loads vsl LEFT JOIN users u ON vsl.agent_id = u.id LEFT JOIN warehouses w ON vsl.warehouse_id = w.id WHERE vsl.id = ? AND vsl.tenant_id = ?").bind(id, tenantId).first();
  if (!load) return c.json({ success: false, message: 'Van stock load not found' }, 404);
  const items = await db.prepare('SELECT vsli.*, p.name as product_name, p.code as product_code, p.price FROM van_stock_load_items vsli LEFT JOIN products p ON vsli.product_id = p.id WHERE vsli.van_stock_load_id = ?').bind(id).all();
  return c.json({ success: true, data: { ...load, items: items.results || [] } });
});

api.post('/van-stock-loads', async (c) => {
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
        const smId = uuidv4();
        await db.prepare("INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, 'out', ?, 'van_load', ?, ?)").bind(smId, tenantId, body.warehouse_id, item.product_id, item.quantity_loaded || 0, id, userId).run();
        const sl = await db.prepare('SELECT id FROM stock_levels WHERE warehouse_id = ? AND product_id = ? AND tenant_id = ?').bind(body.warehouse_id, item.product_id, tenantId).first();
        if (sl) {
          await db.prepare('UPDATE stock_levels SET quantity = MAX(0, quantity - ?), updated_at = datetime("now") WHERE id = ?').bind(item.quantity_loaded || 0, sl.id).run();
        }
      }
    }
  }
  return c.json({ success: true, data: { id }, message: 'Van stock loaded' }, 201);
});

api.put('/van-stock-loads/:id/return', async (c) => {
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
      await db.prepare('UPDATE van_stock_load_items SET quantity_sold = ?, quantity_returned = ?, quantity_damaged = ? WHERE id = ?').bind(item.quantity_sold || 0, item.quantity_returned || 0, item.quantity_damaged || 0, item.id).run();
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
api.get('/van-reconciliations', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { van_stock_load_id, status } = c.req.query();
  let where = 'WHERE vr.tenant_id = ?';
  const params = [tenantId];
  if (van_stock_load_id) { where += ' AND vr.van_stock_load_id = ?'; params.push(van_stock_load_id); }
  if (status) { where += ' AND vr.status = ?'; params.push(status); }
  const recons = await db.prepare('SELECT vr.*, vsl.vehicle_reg FROM van_reconciliations vr LEFT JOIN van_stock_loads vsl ON vr.van_stock_load_id = vsl.id ' + where + ' ORDER BY vr.created_at DESC').bind(...params).all();
  return c.json({ success: true, data: recons.results || [] });
});

api.post('/van-reconciliations', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  const variance = (body.cash_actual || 0) - (body.cash_expected || 0);
  await db.prepare('INSERT INTO van_reconciliations (id, tenant_id, van_stock_load_id, cash_expected, cash_actual, variance, denominations, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.van_stock_load_id, body.cash_expected || 0, body.cash_actual || 0, variance, body.denominations ? JSON.stringify(body.denominations) : null, 'pending', body.notes || null).run();
  return c.json({ success: true, data: { id, variance }, message: 'Reconciliation submitted' }, 201);
});

api.put('/van-reconciliations/:id/approve', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  await db.prepare("UPDATE van_reconciliations SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(userId, id, tenantId).run();
  return c.json({ success: true, message: 'Reconciliation approved' });
});

// ==================== CAMPAIGNS & PROMOTIONS ====================
api.get('/campaigns', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { status, campaign_type } = c.req.query();
  let where = 'WHERE c.tenant_id = ?';
  const params = [tenantId];
  if (status) { where += ' AND c.status = ?'; params.push(status); }
  if (campaign_type) { where += ' AND c.campaign_type = ?'; params.push(campaign_type); }
  const campaigns = await db.prepare('SELECT c.*, (SELECT COUNT(*) FROM campaign_assignments WHERE campaign_id = c.id) as assigned_count, (SELECT COUNT(*) FROM activations WHERE campaign_id = c.id) as activation_count FROM campaigns c ' + where + ' ORDER BY c.created_at DESC').bind(...params).all();
  return c.json({ success: true, data: campaigns.results || [] });
});

api.get('/campaigns/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const campaign = await db.prepare('SELECT * FROM campaigns WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!campaign) return c.json({ success: false, message: 'Campaign not found' }, 404);
  const assignments = await db.prepare("SELECT ca.*, u.first_name || ' ' || u.last_name as user_name FROM campaign_assignments ca LEFT JOIN users u ON ca.user_id = u.id WHERE ca.campaign_id = ?").bind(id).all();
  const activations = await db.prepare('SELECT * FROM activations WHERE campaign_id = ? AND tenant_id = ?').bind(id, tenantId).all();
  return c.json({ success: true, data: { ...campaign, assignments: assignments.results || [], activations: activations.results || [] } });
});

api.post('/campaigns', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO campaigns (id, tenant_id, name, description, campaign_type, start_date, end_date, budget, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.description || null, body.campaign_type || 'field_marketing', body.start_date || null, body.end_date || null, body.budget || 0, body.status || 'draft', userId).run();
  if (body.assigned_users && Array.isArray(body.assigned_users)) {
    for (const uid of body.assigned_users) {
      const caId = uuidv4();
      await db.prepare('INSERT INTO campaign_assignments (id, campaign_id, user_id, territory_notes) VALUES (?, ?, ?, ?)').bind(caId, id, uid, null).run();
    }
  }
  return c.json({ success: true, data: { id }, message: 'Campaign created' }, 201);
});

api.put('/campaigns/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE campaigns SET name = COALESCE(?, name), description = COALESCE(?, description), campaign_type = COALESCE(?, campaign_type), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), budget = COALESCE(?, budget), status = COALESCE(?, status), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.description || null, body.campaign_type || null, body.start_date || null, body.end_date || null, body.budget || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'Campaign updated' });
});

api.delete('/campaigns/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare('DELETE FROM campaign_assignments WHERE campaign_id = ?').bind(id).run();
  await db.prepare('DELETE FROM campaigns WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Campaign deleted' });
});

// Activations
api.get('/activations', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { campaign_id, agent_id, status } = c.req.query();
  let where = 'WHERE a.tenant_id = ?';
  const params = [tenantId];
  if (campaign_id) { where += ' AND a.campaign_id = ?'; params.push(campaign_id); }
  if (agent_id) { where += ' AND a.agent_id = ?'; params.push(agent_id); }
  if (status) { where += ' AND a.status = ?'; params.push(status); }
  const activations = await db.prepare("SELECT a.*, camp.name as campaign_name, u.first_name || ' ' || u.last_name as agent_name, c.name as customer_name FROM activations a LEFT JOIN campaigns camp ON a.campaign_id = camp.id LEFT JOIN users u ON a.agent_id = u.id LEFT JOIN customers c ON a.customer_id = c.id " + where + ' ORDER BY a.created_at DESC').bind(...params).all();
  return c.json({ success: true, data: activations.results || [] });
});

api.post('/activations', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO activations (id, tenant_id, campaign_id, name, location_description, customer_id, agent_id, scheduled_start, scheduled_end, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.campaign_id, body.name, body.location_description || null, body.customer_id || null, body.agent_id || userId, body.scheduled_start || null, body.scheduled_end || null, 'scheduled').run();
  return c.json({ success: true, data: { id } }, 201);
});

api.put('/activations/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE activations SET actual_start = COALESCE(?, actual_start), actual_end = COALESCE(?, actual_end), start_latitude = COALESCE(?, start_latitude), start_longitude = COALESCE(?, start_longitude), end_latitude = COALESCE(?, end_latitude), end_longitude = COALESCE(?, end_longitude), status = COALESCE(?, status), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.actual_start || null, body.actual_end || null, body.start_latitude || null, body.start_longitude || null, body.end_latitude || null, body.end_longitude || null, body.status || null, id, tenantId).run();
  return c.json({ success: true, message: 'Activation updated' });
});

api.post('/activations/:id/performance', async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const body = await c.req.json();
  const perfId = uuidv4();
  await db.prepare('INSERT INTO activation_performances (id, activation_id, interactions_count, samples_distributed, sales_generated, photos, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(perfId, id, body.interactions_count || 0, body.samples_distributed || 0, body.sales_generated || 0, body.photos ? JSON.stringify(body.photos) : null, body.notes || null).run();
  return c.json({ success: true, data: { id: perfId } }, 201);
});

// Promotion rules
api.get('/promotion-rules', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const rules = await db.prepare('SELECT * FROM promotion_rules WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  const results = (rules.results || []).map(r => {
    try { r.config = JSON.parse(r.config); } catch(e) {}
    return r;
  });
  return c.json({ success: true, data: results });
});

api.post('/promotion-rules', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO promotion_rules (id, tenant_id, name, rule_type, config, product_filter, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)').bind(id, tenantId, body.name, body.rule_type || 'discount', body.config ? JSON.stringify(body.config) : null, body.product_filter || null, body.start_date || null, body.end_date || null).run();
  return c.json({ success: true, data: { id } }, 201);
});

// ==================== COMMISSIONS ====================
api.get('/commission-rules', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const rules = await db.prepare('SELECT * FROM commission_rules WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: rules.results || [] });
});

api.post('/commission-rules', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO commission_rules (id, tenant_id, name, source_type, rate, min_threshold, max_cap, product_filter, effective_from, effective_to, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').bind(id, tenantId, body.name, body.source_type, body.rate, body.min_threshold || 0, body.max_cap || null, body.product_filter || null, body.effective_from || null, body.effective_to || null).run();
  return c.json({ success: true, data: { id } }, 201);
});

api.put('/commission-rules/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE commission_rules SET name = COALESCE(?, name), rate = COALESCE(?, rate), min_threshold = COALESCE(?, min_threshold), max_cap = COALESCE(?, max_cap), is_active = COALESCE(?, is_active) WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.rate || null, body.min_threshold !== undefined ? body.min_threshold : null, body.max_cap !== undefined ? body.max_cap : null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, id, tenantId).run();
  return c.json({ success: true, message: 'Commission rule updated' });
});

api.get('/commission-earnings', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { earner_id, status, source_type, period_start, period_end, limit = 50, page = 1 } = c.req.query();
  let where = 'WHERE ce.tenant_id = ?';
  const params = [tenantId];
  if (role === 'agent') { where += ' AND ce.earner_id = ?'; params.push(userId); }
  if (earner_id) { where += ' AND ce.earner_id = ?'; params.push(earner_id); }
  if (status) { where += ' AND ce.status = ?'; params.push(status); }
  if (source_type) { where += ' AND ce.source_type = ?'; params.push(source_type); }
  if (period_start) { where += ' AND ce.created_at >= ?'; params.push(period_start); }
  if (period_end) { where += ' AND ce.created_at <= ?'; params.push(period_end); }
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const countR = await db.prepare('SELECT COUNT(*) as total FROM commission_earnings ce ' + where).bind(...params).first();
  const earnings = await db.prepare("SELECT ce.*, u.first_name || ' ' || u.last_name as earner_name, cr.name as rule_name FROM commission_earnings ce LEFT JOIN users u ON ce.earner_id = u.id LEFT JOIN commission_rules cr ON ce.rule_id = cr.id " + where + ' ORDER BY ce.created_at DESC LIMIT ? OFFSET ?').bind(...params, limitNum, offset).all();
  const totalAmount = await db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings ce ' + where).bind(...params).first();
  return c.json({ success: true, data: { earnings: earnings.results || [], totalAmount: totalAmount ? totalAmount.total : 0, pagination: { total: countR ? countR.total : 0, page: pageNum, limit: limitNum, totalPages: Math.ceil((countR ? countR.total : 0) / limitNum) } } });
});

api.get('/commission-earnings/summary', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { period_start, period_end } = c.req.query();
  let dateFilter = '';
  const params = [tenantId];
  if (period_start) { dateFilter += ' AND created_at >= ?'; params.push(period_start); }
  if (period_end) { dateFilter += ' AND created_at <= ?'; params.push(period_end); }
  const [byStatus, bySource, byEarner] = await Promise.all([
    db.prepare('SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ?' + dateFilter + ' GROUP BY status').bind(...params).all(),
    db.prepare('SELECT source_type, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ?' + dateFilter + ' GROUP BY source_type').bind(...params).all(),
    db.prepare("SELECT earner_id, u.first_name || ' ' || u.last_name as earner_name, COUNT(*) as count, COALESCE(SUM(ce.amount), 0) as total FROM commission_earnings ce LEFT JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ?" + dateFilter + ' GROUP BY ce.earner_id ORDER BY total DESC LIMIT 20').bind(...params).all(),
  ]);
  return c.json({ success: true, data: { byStatus: byStatus.results || [], bySource: bySource.results || [], byEarner: byEarner.results || [] } });
});

api.put('/commission-earnings/:id/approve', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  await db.prepare("UPDATE commission_earnings SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(userId, id, tenantId).run();
  return c.json({ success: true, message: 'Commission approved' });
});

api.put('/commission-earnings/:id/reject', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  await db.prepare("UPDATE commission_earnings SET status = 'rejected', approved_by = ?, approved_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(userId, id, tenantId).run();
  return c.json({ success: true, message: 'Commission rejected' });
});

api.post('/commission-earnings/bulk-approve', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  if (body.ids && Array.isArray(body.ids)) {
    for (const ceId of body.ids) {
      await db.prepare("UPDATE commission_earnings SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(userId, ceId, tenantId).run();
    }
  }
  return c.json({ success: true, message: 'Commissions approved' });
});

// ==================== NOTIFICATIONS ====================
api.get('/notifications', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { is_read, limit = 50, page = 1 } = c.req.query();
  let where = 'WHERE tenant_id = ? AND user_id = ?';
  const params = [tenantId, userId];
  if (is_read !== undefined) { where += ' AND is_read = ?'; params.push(is_read === 'true' ? 1 : 0); }
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const countR = await db.prepare('SELECT COUNT(*) as total FROM notifications ' + where).bind(...params).first();
  const unreadR = await db.prepare('SELECT COUNT(*) as count FROM notifications WHERE tenant_id = ? AND user_id = ? AND is_read = 0').bind(tenantId, userId).first();
  const notifications = await db.prepare('SELECT * FROM notifications ' + where + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(...params, limitNum, offset).all();
  return c.json({ success: true, data: { notifications: notifications.results || [], unread_count: unreadR ? unreadR.count : 0, pagination: { total: countR ? countR.total : 0, page: pageNum, limit: limitNum } } });
});

api.put('/notifications/:id/read', async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const { id } = c.req.param();
  await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return c.json({ success: true, message: 'Notification marked as read' });
});

api.put('/notifications/read-all', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  await db.prepare('UPDATE notifications SET is_read = 1 WHERE tenant_id = ? AND user_id = ? AND is_read = 0').bind(tenantId, userId).run();
  return c.json({ success: true, message: 'All notifications marked as read' });
});

api.post('/notifications', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.user_id, body.type || 'info', body.title, body.message || null, body.related_type || null, body.related_id || null).run();
  return c.json({ success: true, data: { id } }, 201);
});

api.post('/notifications/broadcast', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const users = await db.prepare('SELECT id FROM users WHERE tenant_id = ? AND is_active = 1').bind(tenantId).all();
  for (const user of (users.results || [])) {
    const id = uuidv4();
    await db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, user.id, body.type || 'info', body.title, body.message || null).run();
  }
  return c.json({ success: true, message: 'Notification broadcast sent' });
});

// ==================== CROSS-TENANT ====================
api.get('/cross-tenant/assignments', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const assignments = await db.prepare("SELECT aca.*, u.first_name || ' ' || u.last_name as user_name, u.email as user_email, t.name as tenant_name FROM agent_company_assignments aca LEFT JOIN users u ON aca.user_id = u.id LEFT JOIN tenants t ON aca.tenant_id = t.id WHERE aca.revoked_at IS NULL ORDER BY aca.granted_at DESC").all();
  return c.json({ success: true, data: assignments.results || [] });
});

api.post('/cross-tenant/assignments', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const id = uuidv4();
  const userId = c.get('userId');
  await db.prepare('INSERT INTO agent_company_assignments (id, user_id, tenant_id, role_override, granted_by) VALUES (?, ?, ?, ?, ?)').bind(id, body.user_id, body.tenant_id, body.role_override || null, userId).run();
  return c.json({ success: true, data: { id } }, 201);
});

api.delete('/cross-tenant/assignments/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  await db.prepare("UPDATE agent_company_assignments SET revoked_at = datetime('now') WHERE id = ?").bind(id).run();
  return c.json({ success: true, message: 'Assignment revoked' });
});

api.post('/cross-tenant/switch', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const body = await c.req.json();
  const assignment = await db.prepare('SELECT * FROM agent_company_assignments WHERE user_id = ? AND tenant_id = ? AND revoked_at IS NULL').bind(userId, body.tenant_id).first();
  if (!assignment) return c.json({ success: false, message: 'No access to this tenant' }, 403);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  const role = assignment.role_override || user.role;
  const jwtSecret = c.env.JWT_SECRET;
  const accessToken = await generateToken({ userId, tenantId: body.tenant_id, role }, jwtSecret);
  const tenant = await db.prepare('SELECT name FROM tenants WHERE id = ?').bind(body.tenant_id).first();
  return c.json({ success: true, data: { token: accessToken, tenantId: body.tenant_id, tenantName: tenant ? tenant.name : '', role } });
});

// ==================== AUDIT LOG ====================
api.get('/audit-log', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { action, resource_type, user_id, limit = 50, page = 1 } = c.req.query();
  let where = 'WHERE al.tenant_id = ?';
  const params = [tenantId];
  if (action) { where += ' AND al.action = ?'; params.push(action); }
  if (resource_type) { where += ' AND al.resource_type = ?'; params.push(resource_type); }
  if (user_id) { where += ' AND al.user_id = ?'; params.push(user_id); }
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const logs = await db.prepare("SELECT al.*, u.first_name || ' ' || u.last_name as user_name FROM audit_log al LEFT JOIN users u ON al.user_id = u.id " + where + ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?').bind(...params, limitNum, offset).all();
  return c.json({ success: true, data: logs.results || [] });
});

// ==================== SETTINGS ====================
api.get('/settings', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { category } = c.req.query();
  let query = 'SELECT * FROM settings WHERE tenant_id = ?';
  const params = [tenantId];
  if (category) { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY key';
  const settings = await db.prepare(query).bind(...params).all();
  return c.json({ success: true, data: settings.results || [] });
});

api.put('/settings', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  if (body.settings && Array.isArray(body.settings)) {
    for (const s of body.settings) {
      const existing = await db.prepare('SELECT id FROM settings WHERE tenant_id = ? AND key = ?').bind(tenantId, s.key).first();
      if (existing) {
        await db.prepare('UPDATE settings SET value = ?, updated_at = datetime("now") WHERE id = ?').bind(s.value, existing.id).run();
      } else {
        const id = uuidv4();
        await db.prepare('INSERT INTO settings (id, tenant_id, key, value, category) VALUES (?, ?, ?, ?, ?)').bind(id, tenantId, s.key, s.value, s.category || 'general').run();
      }
    }
  }
  return c.json({ success: true, message: 'Settings updated' });
});

// ==================== FILE UPLOAD (R2) ====================
api.post('/uploads', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file) return c.json({ success: false, message: 'No file provided' }, 400);
    const bucket = c.env.UPLOADS;
    if (!bucket) return c.json({ success: false, message: 'Storage not configured' }, 500);
    const key = 'uploads/' + Date.now() + '-' + (file.name || 'file');
    await bucket.put(key, file.stream || file, { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
    return c.json({ success: true, data: { key, url: '/api/uploads/' + key } });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ success: false, message: 'Upload failed' }, 500);
  }
});

api.get('/uploads/:key{.+}', async (c) => {
  try {
    const bucket = c.env.UPLOADS;
    if (!bucket) return c.json({ success: false, message: 'Storage not configured' }, 500);
    const key = c.req.param('key');
    const object = await bucket.get(key);
    if (!object) return c.json({ success: false, message: 'File not found' }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    return new Response(object.body, { headers });
  } catch (error) {
    return c.json({ success: false, message: 'File retrieval failed' }, 500);
  }
});

// ==================== DASHBOARD ====================
api.get('/dashboard', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  let agentFilter = '';
  const agentParams = [];
  if (role === 'agent') { agentFilter = ' AND agent_id = ?'; agentParams.push(userId); }

  const [
    totalCustomers, totalUsers, totalProducts,
    todayVisits, monthVisits, completedVisits,
    monthOrders, monthRevenue,
    pendingCommissions, approvedCommissions,
    activeLoads, pendingRecons,
    activeCampaigns
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND is_active = 1').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date = ?' + agentFilter).bind(tenantId, today, ...agentParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date LIKE ?" + agentFilter).bind(tenantId, thisMonth + '%', ...agentParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND status = 'completed' AND visit_date LIKE ?" + agentFilter).bind(tenantId, thisMonth + '%', ...agentParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND created_at LIKE ?" + agentFilter).bind(tenantId, thisMonth + '%', ...agentParams).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND created_at LIKE ?" + agentFilter).bind(tenantId, thisMonth + '%', ...agentParams).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'pending'" + (role === 'agent' ? ' AND earner_id = ?' : '')).bind(tenantId, ...(role === 'agent' ? [userId] : [])).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'approved'" + (role === 'agent' ? ' AND earner_id = ?' : '')).bind(tenantId, ...(role === 'agent' ? [userId] : [])).first(),
    db.prepare("SELECT COUNT(*) as count FROM van_stock_loads WHERE tenant_id = ? AND status = 'loaded'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM van_reconciliations WHERE tenant_id = ? AND status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM campaigns WHERE tenant_id = ? AND status = 'active'").bind(tenantId).first(),
  ]);

  // Recent activity
  const recentVisits = await db.prepare("SELECT v.id, v.visit_type, v.status, v.created_at, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id WHERE v.tenant_id = ?" + agentFilter + " ORDER BY v.created_at DESC LIMIT 10").bind(tenantId, ...agentParams).all();
  const recentOrders = await db.prepare("SELECT so.id, so.order_number, so.total_amount, so.status, so.created_at, c.name as customer_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE so.tenant_id = ?" + agentFilter + " ORDER BY so.created_at DESC LIMIT 10").bind(tenantId, ...agentParams).all();

  return c.json({
    success: true,
    data: {
      stats: {
        customers: totalCustomers ? totalCustomers.count : 0,
        users: totalUsers ? totalUsers.count : 0,
        products: totalProducts ? totalProducts.count : 0,
        todayVisits: todayVisits ? todayVisits.count : 0,
        monthVisits: monthVisits ? monthVisits.count : 0,
        completedVisits: completedVisits ? completedVisits.count : 0,
        monthOrders: monthOrders ? monthOrders.count : 0,
        monthRevenue: monthRevenue ? monthRevenue.total : 0,
        pendingCommissions: pendingCommissions ? pendingCommissions.total : 0,
        approvedCommissions: approvedCommissions ? approvedCommissions.total : 0,
        activeVanLoads: activeLoads ? activeLoads.count : 0,
        pendingReconciliations: pendingRecons ? pendingRecons.count : 0,
        activeCampaigns: activeCampaigns ? activeCampaigns.count : 0,
      },
      recentVisits: recentVisits.results || [],
      recentOrders: recentOrders.results || [],
    }
  });
});

// ==================== REPORTS ====================
api.get('/reports/sales', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { start_date, end_date, group_by = 'day' } = c.req.query();
  let dateFilter = '';
  const params = [tenantId];
  if (start_date) { dateFilter += ' AND created_at >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND created_at <= ?'; params.push(end_date); }

  let groupExpr = "date(created_at)";
  if (group_by === 'month') groupExpr = "strftime('%Y-%m', created_at)";
  if (group_by === 'week') groupExpr = "strftime('%Y-W%W', created_at)";

  const data = await db.prepare('SELECT ' + groupExpr + ' as period, COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(AVG(total_amount), 0) as avg_order_value FROM sales_orders WHERE tenant_id = ?' + dateFilter + ' GROUP BY period ORDER BY period').bind(...params).all();
  return c.json({ success: true, data: data.results || [] });
});

api.get('/reports/visits', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { start_date, end_date } = c.req.query();
  let dateFilter = '';
  const params = [tenantId];
  if (start_date) { dateFilter += ' AND v.visit_date >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND v.visit_date <= ?'; params.push(end_date); }

  const byAgent = await db.prepare("SELECT v.agent_id, u.first_name || ' ' || u.last_name as agent_name, COUNT(*) as total_visits, SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END) as completed_visits FROM visits v LEFT JOIN users u ON v.agent_id = u.id WHERE v.tenant_id = ?" + dateFilter + ' GROUP BY v.agent_id ORDER BY total_visits DESC').bind(...params).all();
  const byType = await db.prepare('SELECT visit_type, COUNT(*) as count FROM visits WHERE tenant_id = ?' + dateFilter.replace(/v\.visit_date/g, 'visit_date') + ' GROUP BY visit_type').bind(...params).all();
  const byDay = await db.prepare('SELECT visit_date as period, COUNT(*) as count FROM visits WHERE tenant_id = ?' + dateFilter.replace(/v\.visit_date/g, 'visit_date') + ' GROUP BY visit_date ORDER BY visit_date').bind(...params).all();

  return c.json({ success: true, data: { byAgent: byAgent.results || [], byType: byType.results || [], byDay: byDay.results || [] } });
});

api.get('/reports/commissions', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { period_start, period_end } = c.req.query();
  let dateFilter = '';
  const params = [tenantId];
  if (period_start) { dateFilter += ' AND ce.created_at >= ?'; params.push(period_start); }
  if (period_end) { dateFilter += ' AND ce.created_at <= ?'; params.push(period_end); }

  const byEarner = await db.prepare("SELECT ce.earner_id, u.first_name || ' ' || u.last_name as earner_name, ce.status, COUNT(*) as count, COALESCE(SUM(ce.amount), 0) as total FROM commission_earnings ce LEFT JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ?" + dateFilter + ' GROUP BY ce.earner_id, ce.status ORDER BY total DESC').bind(...params).all();
  return c.json({ success: true, data: { byEarner: byEarner.results || [] } });
});

api.get('/reports/stock', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const lowStock = await db.prepare('SELECT sl.*, p.name as product_name, p.code as product_code, w.name as warehouse_name FROM stock_levels sl LEFT JOIN products p ON sl.product_id = p.id LEFT JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ? AND sl.quantity <= sl.reorder_level ORDER BY sl.quantity ASC').bind(tenantId).all();
  const totalValue = await db.prepare('SELECT COALESCE(SUM(sl.quantity * p.cost_price), 0) as total FROM stock_levels sl LEFT JOIN products p ON sl.product_id = p.id WHERE sl.tenant_id = ?').bind(tenantId).first();
  return c.json({ success: true, data: { lowStock: lowStock.results || [], totalStockValue: totalValue ? totalValue.total : 0 } });
});

// ==================== DASHBOARD SUB-ROUTES ====================
api.get('/dashboard/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);
  const agentFilter = role === 'agent' ? ' AND agent_id = ?' : '';
  const agentParams = role === 'agent' ? [userId] : [];
  const soAgentFilter = role === 'agent' ? ' AND created_by = ?' : '';
  const soAgentParams = role === 'agent' ? [userId] : [];

  const [totalCustomers, totalProducts, todayVisits, monthOrders, monthRevenue, pendingCommissions] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date = ?' + agentFilter).bind(tenantId, today, ...agentParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND created_at LIKE ?" + soAgentFilter).bind(tenantId, thisMonth + '%', ...soAgentParams).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND created_at LIKE ?" + soAgentFilter).bind(tenantId, thisMonth + '%', ...soAgentParams).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'pending'" + (role === 'agent' ? ' AND earner_id = ?' : '')).bind(tenantId, ...(role === 'agent' ? [userId] : [])).first(),
  ]);

  return c.json({
    total_customers: totalCustomers?.count || 0,
    total_products: totalProducts?.count || 0,
    today_visits: todayVisits?.count || 0,
    month_orders: monthOrders?.count || 0,
    month_revenue: monthRevenue?.total || 0,
    pending_commissions: pendingCommissions?.total || 0,
  });
});

api.get('/dashboard/revenue-trends', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { period = '30' } = c.req.query();
  const data = await db.prepare("SELECT date(created_at) as date, COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders FROM sales_orders WHERE tenant_id = ? AND created_at >= date('now', '-' || ? || ' days') GROUP BY date(created_at) ORDER BY date").bind(tenantId, period).all();
  return c.json(data.results || []);
});

api.get('/dashboard/sales-by-category', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT COALESCE(p.category, 'Uncategorized') as category, COUNT(DISTINCT so.id) as orders, COALESCE(SUM(soi.quantity * soi.unit_price), 0) as revenue FROM sales_orders so JOIN sales_order_items soi ON so.id = soi.order_id JOIN products p ON soi.product_id = p.id WHERE so.tenant_id = ? GROUP BY p.category ORDER BY revenue DESC LIMIT 10").bind(tenantId).all();
  return c.json(data.results || []);
});

api.get('/dashboard/top-products', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT p.id, p.name, SUM(soi.quantity) as total_quantity, SUM(soi.quantity * soi.unit_price) as total_revenue FROM sales_order_items soi JOIN products p ON soi.product_id = p.id JOIN sales_orders so ON soi.order_id = so.id WHERE so.tenant_id = ? GROUP BY p.id ORDER BY total_revenue DESC LIMIT 10").bind(tenantId).all();
  return c.json(data.results || []);
});

api.get('/dashboard/top-customers', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT c.id, c.name, COUNT(so.id) as total_orders, COALESCE(SUM(so.total_amount), 0) as total_spent FROM customers c LEFT JOIN sales_orders so ON c.id = so.customer_id WHERE c.tenant_id = ? GROUP BY c.id ORDER BY total_spent DESC LIMIT 10").bind(tenantId).all();
  return c.json(data.results || []);
});

api.get('/dashboard/order-status', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT status, COUNT(*) as count FROM sales_orders WHERE tenant_id = ? GROUP BY status").bind(tenantId).all();
  return c.json(data.results || []);
});

api.get('/dashboard/recent-activity', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const visits = await db.prepare("SELECT v.id, 'visit' as type, v.status, v.created_at, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id WHERE v.tenant_id = ? ORDER BY v.created_at DESC LIMIT 10").bind(tenantId).all();
  const orders = await db.prepare("SELECT so.id, 'order' as type, so.status, so.created_at, c.name as customer_name, so.total_amount FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE so.tenant_id = ? ORDER BY so.created_at DESC LIMIT 10").bind(tenantId).all();
  return c.json({ visits: visits.results || [], orders: orders.results || [] });
});

api.get('/dashboard/sales-performance', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT u.id, u.first_name || ' ' || u.last_name as name, COUNT(so.id) as orders, COALESCE(SUM(so.total_amount), 0) as revenue FROM users u LEFT JOIN sales_orders so ON u.id = so.created_by AND so.tenant_id = ? WHERE u.tenant_id = ? AND u.role IN ('agent', 'sales_rep') GROUP BY u.id ORDER BY revenue DESC").bind(tenantId, tenantId).all();
  return c.json(data.results || []);
});

api.get('/dashboard/inventory-overview', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const total = await db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(quantity), 0) as total_qty FROM stock_levels WHERE tenant_id = ?').bind(tenantId).first();
  const lowStock = await db.prepare('SELECT COUNT(*) as count FROM stock_levels WHERE tenant_id = ? AND quantity <= reorder_level').bind(tenantId).first();
  return c.json({ total_items: total?.count || 0, total_quantity: total?.total_qty || 0, low_stock_items: lowStock?.count || 0 });
});

// ==================== ORDERS ALIASES (frontend uses /orders, API has /sales-orders) ====================
api.get('/orders', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { page = '1', limit = '20', status, customer_id, search } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE so.tenant_id = ?';
  const params = [tenantId];
  if (role === 'agent') { where += ' AND so.created_by = ?'; params.push(userId); }
  if (status) { where += ' AND so.status = ?'; params.push(status); }
  if (customer_id) { where += ' AND so.customer_id = ?'; params.push(customer_id); }
  if (search) { where += ' AND (so.order_number LIKE ? OR c.name LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  const total = await db.prepare('SELECT COUNT(*) as count FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id ' + where).bind(...params).first();
  const orders = await db.prepare('SELECT so.*, c.name as customer_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id ' + where + ' ORDER BY so.created_at DESC LIMIT ? OFFSET ?').bind(...params, parseInt(limit), offset).all();
  return c.json({ data: orders.results || [], total: total?.count || 0, page: parseInt(page), limit: parseInt(limit) });
});

api.get('/orders/stats', authMiddleware, async (c) => {
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

api.get('/orders/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const order = await db.prepare('SELECT so.*, c.name as customer_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE so.id = ? AND so.tenant_id = ?').bind(id, tenantId).first();
  if (!order) return c.json({ message: 'Order not found' }, 404);
  const items = await db.prepare('SELECT soi.*, p.name as product_name FROM sales_order_items soi LEFT JOIN products p ON soi.product_id = p.id WHERE soi.order_id = ?').bind(id).all();
  return c.json({ ...order, items: items.results || [] });
});

api.post('/orders', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  const orderNum = 'ORD-' + Date.now();
  await db.prepare('INSERT INTO sales_orders (id, tenant_id, order_number, customer_id, status, total_amount, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(id, tenantId, orderNum, body.customer_id, 'pending', body.total_amount || 0, body.notes || '', userId).run();
  if (body.items && Array.isArray(body.items)) {
    for (const item of body.items) {
      await db.prepare('INSERT INTO sales_order_items (id, order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)').bind(uuidv4(), id, item.product_id, item.quantity, item.unit_price).run();
    }
  }
  return c.json({ id, order_number: orderNum, message: 'Order created' }, 201);
});

api.put('/orders/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(body)) {
    if (['status', 'notes', 'total_amount', 'payment_status', 'delivery_date'].includes(k)) { sets.push(k + ' = ?'); vals.push(v); }
  }
  if (sets.length === 0) return c.json({ message: 'No valid fields' }, 400);
  await db.prepare('UPDATE sales_orders SET ' + sets.join(', ') + ' WHERE id = ? AND tenant_id = ?').bind(...vals, id, tenantId).run();
  return c.json({ message: 'Order updated' });
});

api.delete('/orders/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM sales_order_items WHERE order_id = ?').bind(id).run();
  await db.prepare('DELETE FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ message: 'Order deleted' });
});

api.get('/orders/:id/items', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const items = await db.prepare('SELECT soi.*, p.name as product_name, p.code as product_code FROM sales_order_items soi LEFT JOIN products p ON soi.product_id = p.id WHERE soi.order_id = ?').bind(id).all();
  return c.json(items.results || []);
});

api.put('/orders/:id/status', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const { status } = await c.req.json();
  await db.prepare('UPDATE sales_orders SET status = ? WHERE id = ? AND tenant_id = ?').bind(status, id, tenantId).run();
  return c.json({ message: 'Status updated' });
});

// ==================== FIELD OPERATIONS ROUTES ====================
api.get('/field-operations/agents', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { status, search } = c.req.query();
  let where = "WHERE u.tenant_id = ? AND u.role IN ('agent', 'field_agent', 'sales_rep')";
  const params = [tenantId];
  if (status === 'active') { where += ' AND u.is_active = 1'; }
  if (search) { where += " AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)"; params.push('%' + search + '%', '%' + search + '%', '%' + search + '%'); }
  const agents = await db.prepare("SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.is_active, u.last_login, u.created_at FROM users u " + where + " ORDER BY u.first_name").bind(...params).all();
  return c.json(agents.results || []);
});

api.get('/field-operations/agents/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const agent = await db.prepare("SELECT u.* FROM users u WHERE u.id = ? AND u.tenant_id = ? AND u.role IN ('agent', 'field_agent', 'sales_rep')").bind(id, tenantId).first();
  if (!agent) return c.json({ message: 'Agent not found' }, 404);
  const visitCount = await db.prepare('SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ?').bind(id, tenantId).first();
  return c.json({ ...agent, total_visits: visitCount?.count || 0 });
});

api.get('/field-operations/visits', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { page = '1', limit = '20', status, agent_id, date } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE v.tenant_id = ?';
  const params = [tenantId];
  if (role === 'agent') { where += ' AND v.agent_id = ?'; params.push(userId); }
  if (status) { where += ' AND v.status = ?'; params.push(status); }
  if (agent_id) { where += ' AND v.agent_id = ?'; params.push(agent_id); }
  if (date) { where += ' AND v.visit_date = ?'; params.push(date); }
  const total = await db.prepare('SELECT COUNT(*) as count FROM visits v ' + where).bind(...params).first();
  const visits = await db.prepare("SELECT v.*, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id " + where + " ORDER BY v.created_at DESC LIMIT ? OFFSET ?").bind(...params, parseInt(limit), offset).all();
  return c.json({ data: visits.results || [], total: total?.count || 0, page: parseInt(page), limit: parseInt(limit) });
});

api.post('/field-operations/visits/:id/check-in', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const { location } = await c.req.json();
  await db.prepare("UPDATE visits SET status = 'in_progress', check_in_time = CURRENT_TIMESTAMP, check_in_lat = ?, check_in_lng = ? WHERE id = ? AND tenant_id = ?").bind(location?.lat || 0, location?.lng || 0, id, tenantId).run();
  return c.json({ message: 'Checked in successfully' });
});

api.post('/field-operations/visits/:id/check-out', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const { location, notes } = await c.req.json();
  await db.prepare("UPDATE visits SET status = 'completed', check_out_time = CURRENT_TIMESTAMP, check_out_lat = ?, check_out_lng = ?, notes = COALESCE(?, notes) WHERE id = ? AND tenant_id = ?").bind(location?.lat || 0, location?.lng || 0, notes || null, id, tenantId).run();
  return c.json({ message: 'Checked out successfully' });
});

api.get('/field-operations/routes', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const routes = await db.prepare('SELECT * FROM routes WHERE tenant_id = ? ORDER BY name').bind(tenantId).all();
  return c.json(routes.results || []);
});

api.get('/field-operations/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const today = new Date().toISOString().split('T')[0];
  const [totalAgents, todayVisits, completedVisits, activeAgents] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent')").bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date = ?').bind(tenantId, today).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date = ? AND status = 'completed'").bind(tenantId, today).first(),
    db.prepare("SELECT COUNT(DISTINCT agent_id) as count FROM visits WHERE tenant_id = ? AND visit_date = ?").bind(tenantId, today).first(),
  ]);
  return c.json({ total_agents: totalAgents?.count || 0, today_visits: todayVisits?.count || 0, completed_visits: completedVisits?.count || 0, active_agents: activeAgents?.count || 0 });
});

// ==================== VAN SALES ROUTES ====================
api.get('/van-sales/vans', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const vans = await db.prepare("SELECT u.id, u.first_name || ' ' || u.last_name as name, u.email, u.phone FROM users u WHERE u.tenant_id = ? AND u.role IN ('van_sales', 'agent') AND u.is_active = 1").bind(tenantId).all();
  return c.json(vans.results || []);
});

api.get('/van-sales/routes', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const routes = await db.prepare('SELECT * FROM routes WHERE tenant_id = ? ORDER BY name').bind(tenantId).all();
  return c.json({ data: routes.results || [] });
});

api.get('/van-sales/routes/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const route = await db.prepare('SELECT * FROM routes WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!route) return c.json({ message: 'Route not found' }, 404);
  return c.json(route);
});

api.get('/van-sales/orders', authMiddleware, async (c) => {
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

api.get('/van-sales/loads', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const loads = await db.prepare("SELECT vsl.*, u.first_name || ' ' || u.last_name as agent_name, w.name as warehouse_name FROM van_stock_loads vsl LEFT JOIN users u ON vsl.agent_id = u.id LEFT JOIN warehouses w ON vsl.warehouse_id = w.id WHERE vsl.tenant_id = ? ORDER BY vsl.created_at DESC").bind(tenantId).all();
  return c.json({ data: loads.results || [] });
});

api.get('/van-sales/reconciliations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const recons = await db.prepare("SELECT vr.*, u.first_name || ' ' || u.last_name as agent_name FROM van_reconciliations vr LEFT JOIN users u ON vr.agent_id = u.id WHERE vr.tenant_id = ? ORDER BY vr.created_at DESC").bind(tenantId).all();
  return c.json({ data: recons.results || [] });
});

api.get('/van-sales/dashboard', authMiddleware, async (c) => {
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

// ==================== INVENTORY ROUTES ====================
api.get('/inventory', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { warehouse_id, search, page = '1', limit = '50' } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE sl.tenant_id = ?';
  const params = [tenantId];
  if (warehouse_id) { where += ' AND sl.warehouse_id = ?'; params.push(warehouse_id); }
  if (search) { where += ' AND (p.name LIKE ? OR p.code LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  const items = await db.prepare('SELECT sl.*, p.name as product_name, p.code as product_code, p.category, w.name as warehouse_name FROM stock_levels sl LEFT JOIN products p ON sl.product_id = p.id LEFT JOIN warehouses w ON sl.warehouse_id = w.id ' + where + ' ORDER BY p.name LIMIT ? OFFSET ?').bind(...params, parseInt(limit), offset).all();
  return c.json({ data: items.results || [] });
});

api.get('/inventory/product/:productId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const productId = c.req.param('productId');
  const levels = await db.prepare('SELECT sl.*, w.name as warehouse_name FROM stock_levels sl LEFT JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ? AND sl.product_id = ?').bind(tenantId, productId).all();
  return c.json(levels.results || []);
});

api.get('/inventory/low-stock', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const items = await db.prepare('SELECT sl.*, p.name as product_name, p.code as product_code, w.name as warehouse_name FROM stock_levels sl LEFT JOIN products p ON sl.product_id = p.id LEFT JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ? AND sl.quantity <= sl.reorder_level ORDER BY sl.quantity ASC').bind(tenantId).all();
  return c.json(items.results || []);
});

api.get('/inventory/stock-counts', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const counts = await db.prepare("SELECT sm.*, w.name as warehouse_name FROM stock_movements sm LEFT JOIN warehouses w ON sm.warehouse_id = w.id WHERE sm.tenant_id = ? AND sm.movement_type = 'count' ORDER BY sm.created_at DESC").bind(tenantId).all();
  return c.json({ data: counts.results || [] });
});

api.post('/inventory/adjustments/create', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare("INSERT INTO stock_movements (id, tenant_id, product_id, warehouse_id, movement_type, quantity, reference_number, notes, created_by, created_at) VALUES (?, ?, ?, ?, 'adjustment', ?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(id, tenantId, body.product_id, body.warehouse_id, body.quantity, body.reference_number || 'ADJ-' + Date.now(), body.notes || '', userId).run();
  if (body.quantity > 0) {
    await db.prepare('UPDATE stock_levels SET quantity = quantity + ? WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?').bind(body.quantity, tenantId, body.product_id, body.warehouse_id).run();
  } else {
    await db.prepare('UPDATE stock_levels SET quantity = MAX(0, quantity + ?) WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?').bind(body.quantity, tenantId, body.product_id, body.warehouse_id).run();
  }
  return c.json({ id, message: 'Adjustment created' }, 201);
});

api.post('/inventory/transfers/create', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare("INSERT INTO stock_movements (id, tenant_id, product_id, warehouse_id, to_warehouse_id, movement_type, quantity, reference_number, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'transfer', ?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(id, tenantId, body.product_id, body.from_warehouse_id, body.to_warehouse_id, body.quantity, 'TRF-' + Date.now(), body.notes || '', userId).run();
  await db.prepare('UPDATE stock_levels SET quantity = MAX(0, quantity - ?) WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?').bind(body.quantity, tenantId, body.product_id, body.from_warehouse_id).run();
  const existing = await db.prepare('SELECT id FROM stock_levels WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?').bind(tenantId, body.product_id, body.to_warehouse_id).first();
  if (existing) {
    await db.prepare('UPDATE stock_levels SET quantity = quantity + ? WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?').bind(body.quantity, tenantId, body.product_id, body.to_warehouse_id).run();
  } else {
    await db.prepare('INSERT INTO stock_levels (id, tenant_id, product_id, warehouse_id, quantity, reorder_level) VALUES (?, ?, ?, ?, ?, 10)').bind(uuidv4(), tenantId, body.product_id, body.to_warehouse_id, body.quantity).run();
  }
  return c.json({ id, message: 'Transfer created' }, 201);
});

api.post('/inventory/stock-counts/create', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare("INSERT INTO stock_movements (id, tenant_id, product_id, warehouse_id, movement_type, quantity, reference_number, notes, created_by, created_at) VALUES (?, ?, ?, ?, 'count', ?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(id, tenantId, body.product_id, body.warehouse_id, body.counted_quantity, 'CNT-' + Date.now(), body.notes || '', userId).run();
  await db.prepare('UPDATE stock_levels SET quantity = ? WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?').bind(body.counted_quantity, tenantId, body.product_id, body.warehouse_id).run();
  return c.json({ id, message: 'Stock count recorded' }, 201);
});

// ==================== INVOICES & FINANCE ROUTES ====================
api.get('/finance/invoices', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { page = '1', limit = '20', status } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE so.tenant_id = ?';
  const params = [tenantId];
  if (status) { where += ' AND so.payment_status = ?'; params.push(status); }
  const orders = await db.prepare('SELECT so.id, so.order_number as invoice_number, so.customer_id, c.name as customer_name, so.total_amount, so.payment_status as status, so.created_at FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id ' + where + ' ORDER BY so.created_at DESC LIMIT ? OFFSET ?').bind(...params, parseInt(limit), offset).all();
  return c.json({ data: orders.results || [] });
});

api.get('/finance/payments', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const payments = await db.prepare("SELECT p.*, c.name as customer_name FROM payments p LEFT JOIN customers c ON p.customer_id = c.id WHERE p.tenant_id = ? ORDER BY p.created_at DESC LIMIT 50").bind(tenantId).all();
  return c.json({ data: payments.results || [] });
});

api.get('/finance/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [totalRevenue, totalPaid, totalPending, totalOverdue] = await Promise.all([
    db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE tenant_id = ? AND status = 'completed'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND payment_status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND payment_status = 'overdue'").bind(tenantId).first(),
  ]);
  return c.json({ total_revenue: totalRevenue?.total || 0, total_paid: totalPaid?.total || 0, total_pending: totalPending?.total || 0, total_overdue: totalOverdue?.total || 0 });
});

// ==================== COMMISSIONS ALIASES ====================
api.get('/commissions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { page = '1', limit = '20', status } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE ce.tenant_id = ?';
  const params = [tenantId];
  if (role === 'agent') { where += ' AND ce.earner_id = ?'; params.push(userId); }
  if (status) { where += ' AND ce.status = ?'; params.push(status); }
  const total = await db.prepare('SELECT COUNT(*) as count FROM commission_earnings ce ' + where).bind(...params).first();
  const commissions = await db.prepare("SELECT ce.*, u.first_name || ' ' || u.last_name as earner_name, cr.name as rule_name FROM commission_earnings ce LEFT JOIN users u ON ce.earner_id = u.id LEFT JOIN commission_rules cr ON ce.rule_id = cr.id " + where + " ORDER BY ce.created_at DESC LIMIT ? OFFSET ?").bind(...params, parseInt(limit), offset).all();
  return c.json({ data: commissions.results || [], total: total?.count || 0, page: parseInt(page), limit: parseInt(limit) });
});

api.get('/commissions/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [total, pending, approved, paid] = await Promise.all([
    db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'approved'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'paid'").bind(tenantId).first(),
  ]);
  return c.json({ total: total?.total || 0, pending: pending?.total || 0, approved: approved?.total || 0, paid: paid?.total || 0 });
});

api.get('/commissions/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const commission = await db.prepare("SELECT ce.*, u.first_name || ' ' || u.last_name as earner_name, cr.name as rule_name FROM commission_earnings ce LEFT JOIN users u ON ce.earner_id = u.id LEFT JOIN commission_rules cr ON ce.rule_id = cr.id WHERE ce.id = ? AND ce.tenant_id = ?").bind(id, tenantId).first();
  if (!commission) return c.json({ message: 'Commission not found' }, 404);
  return c.json(commission);
});

api.get('/commissions/user/:userId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const targetUserId = c.req.param('userId');
  const commissions = await db.prepare("SELECT ce.*, cr.name as rule_name FROM commission_earnings ce LEFT JOIN commission_rules cr ON ce.rule_id = cr.id WHERE ce.tenant_id = ? AND ce.earner_id = ? ORDER BY ce.created_at DESC").bind(tenantId, targetUserId).all();
  return c.json(commissions.results || []);
});

api.get('/commissions/rules', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const rules = await db.prepare('SELECT * FROM commission_rules WHERE tenant_id = ? ORDER BY name').bind(tenantId).all();
  return c.json(rules.results || []);
});

api.post('/commissions/calculate', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { order_id } = await c.req.json();
  const order = await db.prepare('SELECT * FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(order_id, tenantId).first();
  if (!order) return c.json({ message: 'Order not found' }, 404);
  const rules = await db.prepare("SELECT * FROM commission_rules WHERE tenant_id = ? AND is_active = 1").bind(tenantId).all();
  let totalCommission = 0;
  for (const rule of (rules.results || [])) {
    let amount = 0;
    if (rule.calculation_type === 'percentage') amount = (order.total_amount * rule.rate) / 100;
    else if (rule.calculation_type === 'flat') amount = rule.rate;
    else amount = (order.total_amount * rule.rate) / 100;
    if (amount > 0) {
      const id = uuidv4();
      await db.prepare("INSERT INTO commission_earnings (id, tenant_id, earner_id, rule_id, source_type, source_id, amount, status, created_at) VALUES (?, ?, ?, ?, 'order', ?, ?, 'pending', CURRENT_TIMESTAMP)").bind(id, tenantId, order.created_by, rule.id, order_id, amount).run();
      totalCommission += amount;
    }
  }
  return c.json({ message: 'Commission calculated', total: totalCommission });
});

api.post('/commissions/pay', authMiddleware, requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { commission_ids } = await c.req.json();
  if (!commission_ids || !Array.isArray(commission_ids)) return c.json({ message: 'commission_ids required' }, 400);
  for (const cid of commission_ids) {
    await db.prepare("UPDATE commission_earnings SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").bind(cid, tenantId).run();
  }
  return c.json({ message: 'Commissions marked as paid', count: commission_ids.length });
});

// ==================== BEAT ROUTES ====================
api.get('/beat-routes', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const routes = await db.prepare('SELECT * FROM routes WHERE tenant_id = ? ORDER BY name').bind(tenantId).all();
  return c.json({ data: routes.results || [] });
});

api.get('/beat-routes/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const route = await db.prepare('SELECT * FROM routes WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!route) return c.json({ message: 'Route not found' }, 404);
  return c.json(route);
});

// ==================== SURVEYS / KYC ====================
api.get('/surveys', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const surveys = await db.prepare('SELECT * FROM questionnaires WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ data: surveys.results || [] });
});

api.get('/surveys/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const survey = await db.prepare('SELECT * FROM questionnaires WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!survey) return c.json({ message: 'Survey not found' }, 404);
  return c.json(survey);
});

api.get('/kyc', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const kyc = await db.prepare('SELECT c.id, c.name, c.kyc_status, c.kyc_verified_at, c.created_at FROM customers c WHERE c.tenant_id = ? ORDER BY c.created_at DESC').bind(tenantId).all();
  return c.json({ data: kyc.results || [] });
});

// ==================== ANALYTICS ROUTES ====================
api.get('/analytics/overview', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const thisMonth = new Date().toISOString().substring(0, 7);
  const [revenue, orders, visits, customers] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND created_at LIKE ?").bind(tenantId, thisMonth + '%').first(),
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND created_at LIKE ?").bind(tenantId, thisMonth + '%').first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date LIKE ?").bind(tenantId, thisMonth + '%').first(),
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
  ]);
  return c.json({ month_revenue: revenue?.total || 0, month_orders: orders?.count || 0, month_visits: visits?.count || 0, total_customers: customers?.count || 0 });
});

api.get('/analytics/sales', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { period = '30' } = c.req.query();
  const data = await db.prepare("SELECT date(created_at) as date, COUNT(*) as orders, COALESCE(SUM(total_amount), 0) as revenue FROM sales_orders WHERE tenant_id = ? AND created_at >= date('now', '-' || ? || ' days') GROUP BY date(created_at) ORDER BY date").bind(tenantId, period).all();
  return c.json(data.results || []);
});

api.get('/analytics/field-operations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT visit_date as date, COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM visits WHERE tenant_id = ? AND visit_date >= date('now', '-30 days') GROUP BY visit_date ORDER BY visit_date").bind(tenantId).all();
  return c.json(data.results || []);
});

api.get('/analytics/commissions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT date(created_at) as date, status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND created_at >= date('now', '-30 days') GROUP BY date(created_at), status ORDER BY date").bind(tenantId).all();
  return c.json(data.results || []);
});

// ==================== SALES REPS ====================
api.get('/sales-reps', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const reps = await db.prepare("SELECT id, first_name, last_name, email, phone, role FROM users WHERE tenant_id = ? AND role IN ('agent', 'sales_rep', 'van_sales') AND is_active = 1 ORDER BY first_name").bind(tenantId).all();
  return c.json(reps.results || []);
});

// ==================== MOUNT AND EXPORT ====================
app.route('/api', api);

// Catch-all for unmatched routes
app.all('*', (c) => c.json({ success: false, message: 'Not found' }, 404));

export default app;
