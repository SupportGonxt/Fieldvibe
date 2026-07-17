import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { authMiddleware, requireRole } from '../../lib/middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { validate, createUserSchema } from '../../validate.js';
import { normalizePhone } from '../../lib/authUtils.js';

const app = new Hono();

// ==================== USERS ====================
app.get('/users', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { search, role, page = 1, limit = 50 } = c.req.query();
  let where = 'WHERE u.tenant_id = ?';
  const params = [tenantId];
  if (search) { where += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)'; params.push('%' + search + '%', '%' + search + '%', '%' + search + '%', '%' + search + '%'); }
  if (role) { where += ' AND u.role = ?'; params.push(role); }
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const countR = await db.prepare('SELECT COUNT(*) as total FROM users u ' + where).bind(...params).first();
  // Section 8: Remove admin_viewable_password from SELECT
  const users = await db.prepare("SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.role, u.agent_type, u.status, u.is_active, u.manager_id, u.team_lead_id, u.last_login, u.created_at, m.first_name || ' ' || m.last_name as manager_name FROM users u LEFT JOIN users m ON u.manager_id = m.id " + where + ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?').bind(...params, parseInt(limit), offset).all();
  return c.json({ success: true, data: { users: users.results || [], pagination: { total: countR ? countR.total : 0, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil((countR ? countR.total : 0) / parseInt(limit)) } } });
});

app.post('/users', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const contextTenantId = c.get('tenantId');
  const requesterRole = c.get('role');
  const body = await c.req.json();
  // Super admins can create users for any company by passing tenant_id in the body
  const tenantId = (requesterRole === 'super_admin' && body.tenant_id) ? body.tenant_id : contextTenantId;
  const v = validate(createUserSchema, body);
  if (!v.valid) return c.json({ success: false, message: 'Validation failed', errors: v.errors }, 400);
  const id = uuidv4();
  const role = body.role || 'agent';
  // Agents/team_leads/managers default to password 12345; other roles get random password
  const isAgent = role === 'agent' || role === 'field_agent' || role === 'sales_rep';
  const isMobileRole = isAgent || role === 'team_lead' || role === 'manager';
  const password = body.password || (isMobileRole ? '12345' : Math.random().toString(36).slice(-8));
  const hashedPassword = await bcrypt.hash(password, 10);
  // Set PIN for mobile-login-capable roles: use custom PIN if provided, otherwise default 12345
  let pinHash = null;
  if (isMobileRole) {
    const pinValue = body.pin || '12345';
    if (body.pin && !/^\d{4,6}$/.test(body.pin)) {
      return c.json({ success: false, message: 'PIN must be 4-6 digits' }, 400);
    }
    pinHash = await bcrypt.hash(pinValue, 10);
  }
  // Email is optional for mobile-login roles (agent, team_lead, manager) but required for other roles
  const email = body.email || null;
  if (!email && !isMobileRole) return c.json({ success: false, message: 'Email is required for non-mobile roles' }, 400);
  // For mobile roles without email, generate a placeholder to satisfy NOT NULL constraint
  const emailForDb = email || (isMobileRole ? `user_${id.substring(0, 8)}@placeholder.local` : null);
  try {
    const agentType = body.agent_type || body.agentType || null;
    await db.prepare('INSERT INTO users (id, tenant_id, email, phone, password_hash, pin_hash, first_name, last_name, role, agent_type, manager_id, team_lead_id, gm_id, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').bind(id, tenantId, emailForDb, normalizePhone(body.phone), hashedPassword, pinHash, body.firstName || body.first_name || '', body.lastName || body.last_name || '', role, agentType, body.managerId || body.manager_id || null, body.teamLeadId || body.team_lead_id || null, body.gmId || body.gm_id || null, 'active').run();
    const actualPin = isMobileRole ? (body.pin || '12345') : undefined;
    return c.json({ success: true, data: { id, password, default_pin: actualPin }, message: 'User created' }, 201);
  } catch (err) {
    const msg = err.message || 'Failed to create user';
    if (msg.includes('UNIQUE constraint failed: users.email')) {
      return c.json({ success: false, message: 'A user with this email already exists.' }, 409);
    }
    if (msg.includes('UNIQUE constraint failed: users.phone')) {
      return c.json({ success: false, message: 'A user with this phone number already exists.' }, 409);
    }
    return c.json({ success: false, message: `Failed to create user: ${msg}` }, 500);
  }
});

app.put('/users/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  const agentType = body.agent_type !== undefined ? body.agent_type : (body.agentType !== undefined ? body.agentType : undefined);
  // Keep is_active in sync with status: the admin UI edits status only, while
  // most list/roster queries filter on is_active = 1 — letting them drift left
  // "inactive" users visible in dashboards and pickers everywhere.
  const isActive = body.is_active !== undefined
    ? (body.is_active ? 1 : 0)
    : (body.status ? (body.status === 'active' ? 1 : 0) : null);
  let sql = 'UPDATE users SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), role = COALESCE(?, role), phone = COALESCE(?, phone), email = COALESCE(?, email), manager_id = ?, team_lead_id = ?, gm_id = ?, status = COALESCE(?, status), is_active = COALESCE(?, is_active)';
  const binds = [body.firstName || body.first_name || null, body.lastName || body.last_name || null, body.role || null, normalizePhone(body.phone), body.email || null, body.managerId || body.manager_id || null, body.teamLeadId || body.team_lead_id || null, body.gmId || body.gm_id || null, body.status || null, isActive];
  if (agentType !== undefined) {
    sql += ', agent_type = ?';
    binds.push(agentType);
  }
  sql += ', updated_at = datetime("now") WHERE id = ? AND tenant_id = ?';
  binds.push(id, tenantId);
  await db.prepare(sql).bind(...binds).run();
  return c.json({ success: true, message: 'User updated' });
});

// Quick-edit user details (email, PIN, phone) from hierarchy page
app.patch('/users/:id/quick-edit', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  const user = await db.prepare('SELECT id, role, email FROM users WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!user) return c.json({ success: false, message: 'User not found' }, 404);

  const updates = [];
  const binds = [];

  if (body.email !== undefined) {
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return c.json({ success: false, message: 'Invalid email format' }, 400);
    }
    updates.push('email = ?');
    binds.push(body.email || null);
  }

  if (body.phone !== undefined) {
    updates.push('phone = ?');
    binds.push(normalizePhone(body.phone));
  }

  if (body.pin !== undefined) {
    if (!/^\d{4,6}$/.test(body.pin)) {
      return c.json({ success: false, message: 'PIN must be 4-6 digits' }, 400);
    }
    const pinHash = await bcrypt.hash(body.pin, 10);
    updates.push('pin_hash = ?');
    binds.push(pinHash);
  }

  if (updates.length === 0) {
    return c.json({ success: false, message: 'No fields to update' }, 400);
  }

  updates.push('updated_at = datetime("now")');
  binds.push(id, tenantId);

  try {
    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...binds).run();
    return c.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('UNIQUE constraint failed: users.email')) {
      return c.json({ success: false, message: 'A user with this email already exists' }, 409);
    }
    return c.json({ success: false, message: 'Failed to update user' }, 500);
  }
});

app.delete('/users/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  // Unassign subordinates so they appear as "unassigned" instead of becoming invisible
  await db.batch([
    db.prepare('UPDATE users SET manager_id = NULL WHERE manager_id = ? AND tenant_id = ?').bind(id, tenantId),
    db.prepare('UPDATE users SET team_lead_id = NULL WHERE team_lead_id = ? AND tenant_id = ?').bind(id, tenantId),
    db.prepare('UPDATE users SET is_active = 0, status = ? WHERE id = ? AND tenant_id = ?').bind('inactive', id, tenantId),
  ]);
  return c.json({ success: true, message: 'User deactivated' });
});

app.patch('/users/:id/archive', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const user = await db.prepare('SELECT status FROM users WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!user) return c.json({ success: false, message: 'User not found' }, 404);
  const newStatus = user.status === 'archived' ? 'active' : 'archived';
  // is_active follows status so archived users drop out of roster queries
  await db.prepare('UPDATE users SET status = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?').bind(newStatus, newStatus === 'active' ? 1 : 0, id, tenantId).run();
  return c.json({ success: true, message: newStatus === 'archived' ? 'User archived' : 'User unarchived', status: newStatus });
});

app.post('/users/:id/reset-password', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const newPassword = Math.random().toString(36).slice(-8);
  const hashed = await bcrypt.hash(newPassword, 10);
  // Section 8: No longer storing plaintext password
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ? AND tenant_id = ?').bind(hashed, id, tenantId).run();
  return c.json({ success: true, data: { password: newPassword } });
});
app.get('/rbac/permissions', requireRole('admin'), async (c) => {
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
app.get('/rbac/my-permissions', async (c) => {
  const role = c.get('role');
  const userId = c.get('userId');
  const ROLE_HIERARCHY = { 'super_admin': 5, 'admin': 4, 'manager': 3, 'team_lead': 2, 'agent': 1 };
  return c.json({ success: true, data: { role, level: ROLE_HIERARCHY[role] || 0, user_id: userId } });
});

// N.3 Data Scoping Rules
app.get('/rbac/data-scope', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');

  let scope = {};
  if (role === 'admin' || role === 'super_admin') {
    scope = { level: 'COMPANY', description: 'Full company data access' };
  } else if (role === 'manager') {
    const teamMembers = await db.prepare('SELECT id FROM users WHERE manager_id = ? AND tenant_id = ? LIMIT 500').bind(userId, tenantId).all();
    scope = { level: 'TEAM', team_member_ids: (teamMembers.results || []).map(u => u.id), description: 'Team data access' };
  } else if (role === 'team_lead') {
    const teamMembers = await db.prepare('SELECT id FROM users WHERE manager_id = ? AND tenant_id = ? LIMIT 500').bind(userId, tenantId).all();
    scope = { level: 'TEAM', team_member_ids: (teamMembers.results || []).map(u => u.id), description: 'Team data access (read-only for most)' };
  } else {
    scope = { level: 'SELF', description: 'Own data only' };
  }

  return c.json({ success: true, data: scope });
});
app.get('/roles', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const roles = await db.prepare('SELECT * FROM roles WHERE tenant_id = ? OR is_system = 1 ORDER BY name').bind(tenantId).all();
  return c.json({ success: true, data: roles.results || [] });
});
// ==================== v2 T-19: RBAC ROLES CRUD ====================
app.get('/rbac/roles', requireRole('admin'), async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const roles = await db.prepare('SELECT * FROM roles WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY name').bind(tenantId).all();
    const rolesWithPermissions = [];
    for (const role of (roles.results || [])) {
      const perms = await db.prepare('SELECT p.* FROM permissions p JOIN role_permissions rp ON p.id = rp.permission_id WHERE rp.role_id = ?').bind(role.id).all();
      rolesWithPermissions.push({ ...role, permissions: perms.results || [] });
    }
    return c.json({ success: true, data: rolesWithPermissions });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

app.post('/rbac/roles', requireRole('admin'), async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const body = await c.req.json();
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO roles (id, tenant_id, name, description, created_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)').bind(id, tenantId, body.name, body.description || null).run();
    // Accept permission_ids (UUIDs) or permissions (names)
    const permissionIds = body.permission_ids || [];
    const permissionNames = body.permissions || [];
    if (permissionIds.length > 0) {
      for (const pid of permissionIds) {
        await db.prepare('INSERT INTO role_permissions (id, role_id, permission_id) VALUES (?,?,?)').bind(crypto.randomUUID(), id, pid).run();
      }
    } else if (permissionNames.length > 0) {
      for (const pName of permissionNames) {
        const perm = await db.prepare('SELECT id FROM permissions WHERE name = ?').bind(pName).first();
        if (perm) {
          await db.prepare('INSERT INTO role_permissions (id, role_id, permission_id) VALUES (?,?,?)').bind(crypto.randomUUID(), id, perm.id).run();
        }
      }
    }
    return c.json({ success: true, data: { id, name: body.name } }, 201);
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

app.put('/rbac/roles/:id', requireRole('admin'), async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const body = await c.req.json();
    const id = c.req.param('id');
    await db.prepare('UPDATE roles SET name=?, description=? WHERE id=? AND (tenant_id=? OR tenant_id IS NULL)').bind(body.name, body.description || null, id, tenantId).run();
    // Accept permission_ids (UUIDs) or permissions (names)
    const permissionIds = body.permission_ids || [];
    const permissionNames = body.permissions || [];
    if (body.permissions !== undefined || body.permission_ids !== undefined) {
      await db.prepare('DELETE FROM role_permissions WHERE role_id = ?').bind(id).run();
      if (permissionIds.length > 0) {
        for (const pid of permissionIds) {
          await db.prepare('INSERT INTO role_permissions (id, role_id, permission_id) VALUES (?,?,?)').bind(crypto.randomUUID(), id, pid).run();
        }
      } else {
        for (const pName of permissionNames) {
          const perm = await db.prepare('SELECT id FROM permissions WHERE name = ?').bind(pName).first();
          if (perm) {
            await db.prepare('INSERT INTO role_permissions (id, role_id, permission_id) VALUES (?,?,?)').bind(crypto.randomUUID(), id, perm.id).run();
          }
        }
      }
    }
    return c.json({ success: true, data: { id, ...body } });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

app.delete('/rbac/roles/:id', requireRole('admin'), async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    await db.prepare('DELETE FROM role_permissions WHERE role_id = ?').bind(c.req.param('id')).run();
    await db.prepare('DELETE FROM roles WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenantId).run();
    return c.json({ success: true, message: 'Role deleted' });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// ==================== RBAC: ENHANCED PERMISSIONS & PRESET ROLES ====================

// All available permissions grouped by module
const RBAC_PERMISSIONS = [
  // User Management
  { name: 'view_users', description: 'View user list', module: 'users', action: 'read' },
  { name: 'create_users', description: 'Create new users', module: 'users', action: 'create' },
  { name: 'edit_users', description: 'Edit existing users', module: 'users', action: 'update' },
  { name: 'delete_users', description: 'Delete users', module: 'users', action: 'delete' },
  { name: 'manage_roles', description: 'Manage roles and permissions', module: 'users', action: 'manage' },
  // Customers
  { name: 'view_customers', description: 'View customer list', module: 'customers', action: 'read' },
  { name: 'create_customers', description: 'Create new customers', module: 'customers', action: 'create' },
  { name: 'edit_customers', description: 'Edit existing customers', module: 'customers', action: 'update' },
  { name: 'delete_customers', description: 'Delete customers', module: 'customers', action: 'delete' },
  // Orders
  { name: 'view_orders', description: 'View orders', module: 'orders', action: 'read' },
  { name: 'create_orders', description: 'Create new orders', module: 'orders', action: 'create' },
  { name: 'edit_orders', description: 'Edit orders', module: 'orders', action: 'update' },
  { name: 'delete_orders', description: 'Delete orders', module: 'orders', action: 'delete' },
  { name: 'process_orders', description: 'Process and approve orders', module: 'orders', action: 'process' },
  // Products
  { name: 'view_products', description: 'View product catalog', module: 'products', action: 'read' },
  { name: 'create_products', description: 'Create new products', module: 'products', action: 'create' },
  { name: 'edit_products', description: 'Edit products', module: 'products', action: 'update' },
  { name: 'delete_products', description: 'Delete products', module: 'products', action: 'delete' },
  { name: 'manage_inventory', description: 'Manage inventory levels', module: 'products', action: 'manage' },
  // Van Sales
  { name: 'view_van_sales', description: 'View van sales data', module: 'van_sales', action: 'read' },
  { name: 'manage_van_sales', description: 'Manage van sales operations', module: 'van_sales', action: 'manage' },
  { name: 'manage_routes', description: 'Manage delivery routes', module: 'van_sales', action: 'routes' },
  { name: 'view_inventory', description: 'View van inventory', module: 'van_sales', action: 'inventory' },
  { name: 'manage_transactions', description: 'Manage van transactions', module: 'van_sales', action: 'transactions' },
  { name: 'manage_deliveries', description: 'Manage deliveries', module: 'van_sales', action: 'deliveries' },
  // Trade Marketing
  { name: 'view_trade_marketing', description: 'View trade marketing', module: 'trade_marketing', action: 'read' },
  { name: 'view_promotions', description: 'View promotions', module: 'trade_marketing', action: 'promotions' },
  { name: 'manage_promotions', description: 'Manage promotions', module: 'trade_marketing', action: 'manage_promos' },
  { name: 'manage_incentives', description: 'Manage incentives', module: 'trade_marketing', action: 'incentives' },
  { name: 'view_market_analysis', description: 'View market analysis', module: 'trade_marketing', action: 'analysis' },
  { name: 'manage_trade_spend', description: 'Manage trade spend', module: 'trade_marketing', action: 'spend' },
  // Campaigns
  { name: 'view_campaigns', description: 'View campaigns', module: 'campaigns', action: 'read' },
  { name: 'manage_campaigns', description: 'Manage campaigns', module: 'campaigns', action: 'manage' },
  { name: 'manage_audiences', description: 'Manage campaign audiences', module: 'campaigns', action: 'audiences' },
  { name: 'view_campaign_performance', description: 'View campaign performance', module: 'campaigns', action: 'performance' },
  { name: 'manage_ab_testing', description: 'Manage A/B testing', module: 'campaigns', action: 'ab_testing' },
  // Field Operations
  { name: 'view_field_operations', description: 'View field operations', module: 'field_ops', action: 'read' },
  { name: 'manage_field_agents', description: 'Manage field agents', module: 'field_ops', action: 'agents' },
  { name: 'manage_board_placements', description: 'Manage board placements', module: 'field_ops', action: 'boards' },
  { name: 'manage_product_distribution', description: 'Manage product distribution', module: 'field_ops', action: 'distribution' },
  { name: 'view_agent_locations', description: 'View agent GPS locations', module: 'field_ops', action: 'gps' },
  { name: 'view_field_reports', description: 'View field operations reports', module: 'field_ops', action: 'reports' },
  // KYC
  { name: 'view_kyc', description: 'View KYC records', module: 'kyc', action: 'read' },
  { name: 'manage_kyc', description: 'Manage KYC verification', module: 'kyc', action: 'manage' },
  { name: 'view_kyc_reports', description: 'View KYC reports', module: 'kyc', action: 'reports' },
  // Surveys
  { name: 'view_surveys', description: 'View surveys', module: 'surveys', action: 'read' },
  { name: 'manage_surveys', description: 'Create and manage surveys', module: 'surveys', action: 'manage' },
  // Inventory Reports
  { name: 'view_inventory_reports', description: 'View inventory reports', module: 'inventory', action: 'reports' },
  // Analytics & Reports
  { name: 'view_analytics', description: 'View analytics dashboards', module: 'analytics', action: 'read' },
  { name: 'view_reports', description: 'View reports', module: 'analytics', action: 'reports' },
  { name: 'export_data', description: 'Export data to Excel/PDF', module: 'analytics', action: 'export' },
  // System Admin
  { name: 'manage_system_settings', description: 'Manage system settings', module: 'system', action: 'settings' },
  { name: 'view_audit_logs', description: 'View audit logs', module: 'system', action: 'audit' },
  { name: 'manage_integrations', description: 'Manage integrations', module: 'system', action: 'integrations' },
  // Commissions
  { name: 'view_commissions', description: 'View commissions', module: 'commissions', action: 'read' },
  { name: 'manage_commissions', description: 'Manage commission rules', module: 'commissions', action: 'manage' },
  { name: 'process_payments', description: 'Process commission payments', module: 'commissions', action: 'payments' },
  // Finance
  { name: 'view_finance', description: 'View financial data', module: 'finance', action: 'read' },
  { name: 'manage_finance', description: 'Manage financial records', module: 'finance', action: 'manage' },
  // Super Admin
  { name: 'manage_tenants', description: 'Manage tenants', module: 'platform', action: 'tenants' },
  { name: 'view_all_tenants', description: 'View all tenants', module: 'platform', action: 'view_tenants' },
];

// Preset role definitions
const PRESET_ROLES = {
  super_admin: {
    name: 'Super Admin',
    description: 'Full platform access including tenant management',
    permissions: RBAC_PERMISSIONS.map(p => p.name),
  },
  admin: {
    name: 'Admin',
    description: 'Full company access excluding tenant management',
    permissions: RBAC_PERMISSIONS.filter(p => p.module !== 'platform').map(p => p.name),
  },
  manager: {
    name: 'Manager',
    description: 'Team management, reporting, and operational oversight',
    permissions: [
      'view_users', 'view_customers', 'create_customers', 'edit_customers',
      'view_orders', 'create_orders', 'edit_orders', 'process_orders',
      'view_products', 'view_van_sales', 'view_inventory',
      'view_field_operations', 'view_agent_locations', 'view_field_reports',
      'view_trade_marketing', 'view_promotions', 'view_campaigns', 'view_campaign_performance',
      'view_surveys', 'view_analytics', 'view_reports', 'export_data',
      'view_commissions', 'manage_commissions', 'view_finance',
      'view_kyc', 'view_kyc_reports', 'view_inventory_reports',
    ],
  },
  field_agent: {
    name: 'Field Agent',
    description: 'Field operations - visits, boards, distribution',
    permissions: [
      'view_customers', 'view_products',
      'view_field_operations', 'manage_board_placements', 'manage_product_distribution',
      'view_surveys', 'view_commissions',
    ],
  },
  sales_rep: {
    name: 'Sales Rep',
    description: 'Sales operations - orders, customers, basic reporting',
    permissions: [
      'view_customers', 'create_customers', 'edit_customers',
      'view_orders', 'create_orders', 'edit_orders',
      'view_products', 'view_van_sales', 'manage_van_sales',
      'view_analytics', 'view_commissions',
    ],
  },
  company: {
    name: 'Company',
    description: 'Company portal - reports only access for field operations',
    permissions: [
      'view_field_operations', 'view_field_reports',
      'view_analytics', 'view_reports', 'export_data',
    ],
  },
};

// List all available permissions (grouped by module)
app.get('/rbac/permissions/all', requireRole('admin'), async (c) => {
  try {
    const grouped = {};
    for (const p of RBAC_PERMISSIONS) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }
    return c.json({ success: true, data: { permissions: RBAC_PERMISSIONS, grouped } });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// List preset role templates
app.get('/rbac/preset-roles', requireRole('admin'), async (c) => {
  try {
    const presets = Object.entries(PRESET_ROLES).map(([key, val]) => ({
      key,
      name: val.name,
      description: val.description,
      permission_count: val.permissions.length,
      permissions: val.permissions,
    }));
    return c.json({ success: true, data: presets });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Seed permissions into DB
app.post('/rbac/seed-permissions', requireRole('admin'), async (c) => {
  try {
    const db = c.env.DB;
    let seeded = 0;
    for (const p of RBAC_PERMISSIONS) {
      const existing = await db.prepare('SELECT id FROM permissions WHERE name = ?').bind(p.name).first();
      if (!existing) {
        await db.prepare('INSERT INTO permissions (id, name, description, category, created_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)')
          .bind(crypto.randomUUID(), p.name, p.description, p.module).run();
        seeded++;
      }
    }
    return c.json({ success: true, message: `Seeded ${seeded} new permissions`, total: RBAC_PERMISSIONS.length });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Seed preset roles for a tenant
app.post('/rbac/seed-roles', requireRole('admin'), async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    let seeded = 0;
    for (const [key, preset] of Object.entries(PRESET_ROLES)) {
      const existing = await db.prepare('SELECT id FROM roles WHERE tenant_id = ? AND name = ?').bind(tenantId, preset.name).first();
      if (!existing) {
        const roleId = crypto.randomUUID();
        await db.prepare('INSERT INTO roles (id, tenant_id, name, description, is_system, created_at) VALUES (?,?,?,?,1,CURRENT_TIMESTAMP)')
          .bind(roleId, tenantId, preset.name, preset.description).run();
        // Assign permissions
        for (const permName of preset.permissions) {
          const perm = await db.prepare('SELECT id FROM permissions WHERE name = ?').bind(permName).first();
          if (perm) {
            await db.prepare('INSERT INTO role_permissions (id, role_id, permission_id) VALUES (?,?,?)')
              .bind(crypto.randomUUID(), roleId, perm.id).run();
          }
        }
        seeded++;
      }
    }
    return c.json({ success: true, message: `Seeded ${seeded} preset roles`, total: Object.keys(PRESET_ROLES).length });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Apply a preset role template to an existing role
app.post('/rbac/roles/:id/apply-preset', requireRole('admin'), async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const roleId = c.req.param('id');
    const { preset_key } = await c.req.json();
    const preset = PRESET_ROLES[preset_key];
    if (!preset) return c.json({ success: false, message: 'Invalid preset key' }, 400);
    // Verify role belongs to this tenant
    const role = await db.prepare('SELECT id FROM roles WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)').bind(roleId, tenantId).first();
    if (!role) return c.json({ success: false, message: 'Role not found' }, 404);
    // Clear existing permissions
    await db.prepare('DELETE FROM role_permissions WHERE role_id = ?').bind(roleId).run();
    // Apply preset permissions
    let assigned = 0;
    for (const permName of preset.permissions) {
      const perm = await db.prepare('SELECT id FROM permissions WHERE name = ?').bind(permName).first();
      if (perm) {
        await db.prepare('INSERT INTO role_permissions (id, role_id, permission_id) VALUES (?,?,?)')
          .bind(crypto.randomUUID(), roleId, perm.id).run();
        assigned++;
      }
    }
    return c.json({ success: true, message: `Applied preset "${preset.name}" with ${assigned} permissions` });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Get user's effective permissions (from their role in user_roles table)
app.get('/rbac/users/:userId/permissions', requireRole('admin'), async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.req.param('userId');
    const userRoles = await db.prepare('SELECT ur.role_id, r.name as role_name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ? AND ur.is_active = 1').bind(userId).all();
    const permissions = new Set();
    for (const ur of (userRoles.results || [])) {
      const perms = await db.prepare('SELECT p.name FROM permissions p JOIN role_permissions rp ON p.id = rp.permission_id WHERE rp.role_id = ?').bind(ur.role_id).all();
      for (const p of (perms.results || [])) permissions.add(p.name);
    }
    return c.json({ success: true, data: { user_id: userId, roles: userRoles.results || [], permissions: [...permissions] } });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Assign role to user
app.post('/rbac/users/:userId/roles', requireRole('admin'), async (c) => {
  try {
    const db = c.env.DB;
    const userId = c.req.param('userId');
    const { role_id } = await c.req.json();
    // Check if already assigned
    const existing = await db.prepare('SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?').bind(userId, role_id).first();
    if (existing) {
      await db.prepare('UPDATE user_roles SET is_active = 1 WHERE id = ?').bind(existing.id).run();
    } else {
      await db.prepare('INSERT INTO user_roles (id, user_id, role_id, is_active, created_at) VALUES (?,?,?,1,CURRENT_TIMESTAMP)')
        .bind(crypto.randomUUID(), userId, role_id).run();
    }
    return c.json({ success: true, message: 'Role assigned to user' });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Remove role from user
app.delete('/rbac/users/:userId/roles/:roleId', requireRole('admin'), async (c) => {
  try {
    const db = c.env.DB;
    await db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?').bind(c.req.param('userId'), c.req.param('roleId')).run();
    return c.json({ success: true, message: 'Role removed from user' });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

export default app;
