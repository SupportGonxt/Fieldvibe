import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { validate, loginSchema, registerSchema } from '../validate.js';
import { rateLimiter, authMiddleware } from '../lib/middleware.js';
import { generateToken, normalizePhone } from '../lib/authUtils.js';
import { ensurePortalTables, inviteTokenExpired } from '../services/portal.js';

const app = new Hono();

// ==================== AUTH ROUTES (with rate limiting + validation) ====================
app.post('/api/auth/login', rateLimiter(5, 900000), async (c) => {
  try {
    const body = await c.req.json();
    const v = validate(loginSchema, body);
    if (!v.valid) return c.json({ success: false, message: 'Validation failed', errors: v.errors }, 400);
    const { email, phone, password } = v.data;
    const db = c.env.DB;
    const loginField = email || normalizePhone(phone);
    const user = await db.prepare('SELECT * FROM users WHERE (email = ? OR phone = ?) AND is_active = 1').bind(loginField, loginField).first();
    if (!user) return c.json({ success: false, message: 'Invalid credentials' }, 401);
    if (user.status === 'archived') return c.json({ success: false, message: 'Your account has been archived. Contact your administrator.' }, 403);
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

// ==================== CUSTOMER PORTAL AUTH (Phase F) ====================
app.post('/portal/auth/accept-invite', rateLimiter(5, 900000), async (c) => {
  try {
    const db = c.env.DB;
    await ensurePortalTables(db);
    const { token, password } = await c.req.json();
    if (!token || !password || String(password).length < 8) {
      return c.json({ success: false, message: 'Token and an 8+ char password are required' }, 400);
    }
    const user = await db.prepare("SELECT * FROM portal_users WHERE invite_token = ? AND status = 'invited'").bind(token).first();
    if (!user) return c.json({ success: false, message: 'Invalid or already-used invite' }, 400);
    if (inviteTokenExpired(user.invite_expires_at, Math.floor(Date.now() / 1000))) {
      return c.json({ success: false, message: 'Invite expired' }, 400);
    }
    const hash = await bcrypt.hash(password, 10);
    await db.prepare("UPDATE portal_users SET password_hash = ?, status = 'active', invite_token = NULL, invite_expires_at = NULL WHERE id = ?").bind(hash, user.id).run();
    const jwtSecret = c.env.JWT_SECRET;
    const accessToken = await generateToken({ portalUserId: user.id, tenantId: user.tenant_id, companyId: user.company_id, aud: 'portal' }, jwtSecret);
    return c.json({ success: true, data: { token: accessToken, access_token: accessToken } });
  } catch (e) {
    return c.json({ success: false, message: 'Could not accept invite' }, 500);
  }
});

app.post('/portal/auth/login', rateLimiter(5, 900000), async (c) => {
  try {
    const db = c.env.DB;
    await ensurePortalTables(db);
    const { email, password } = await c.req.json();
    if (!email || !password) return c.json({ success: false, message: 'Email and password are required' }, 400);
    const user = await db.prepare("SELECT * FROM portal_users WHERE email = ? AND status = 'active'").bind(String(email).toLowerCase().trim()).first();
    if (!user || !user.password_hash) return c.json({ success: false, message: 'Invalid credentials' }, 401);
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return c.json({ success: false, message: 'Invalid credentials' }, 401);
    const jwtSecret = c.env.JWT_SECRET;
    const accessToken = await generateToken({ portalUserId: user.id, tenantId: user.tenant_id, companyId: user.company_id, aud: 'portal' }, jwtSecret);
    return c.json({ success: true, data: { token: accessToken, access_token: accessToken } });
  } catch (e) {
    return c.json({ success: false, message: 'Login failed' }, 500);
  }
});

// ==================== MOBILE AGENT LOGIN (phone + PIN) ====================
app.post('/api/auth/mobile-login', rateLimiter(10, 900000), async (c) => {
  try {
    const body = await c.req.json();
    const { phone, pin, tenant_code } = body;
    if (!phone || !pin) return c.json({ success: false, message: 'Phone number and PIN are required' }, 400);
    if (pin.length < 4 || pin.length > 6) return c.json({ success: false, message: 'PIN must be 4-6 digits' }, 400);
    const db = c.env.DB;
    // Normalize phone number to +27 format (South Africa)
    const normalizedPhone = normalizePhone(phone);
    // Resolve tenant_id from tenant_code (or X-Tenant-Code header) for multi-tenant scoping
    let tenantFilter = '';
    let tenantBinds = [normalizedPhone];
    const tCode = tenant_code || c.req.header('X-Tenant-Code');
    if (tCode) {
      const tenant = await db.prepare('SELECT id FROM tenants WHERE code = ?').bind(tCode).first();
      if (tenant) {
        tenantFilter = ' AND tenant_id = ?';
        tenantBinds.push(tenant.id);
      }
    }
    // Find agent by phone number (scoped to tenant if provided)
    const user = await db.prepare(`SELECT * FROM users WHERE phone = ? AND is_active = 1 AND role IN ('agent', 'team_lead', 'field_agent', 'sales_rep', 'manager')${tenantFilter}`).bind(...tenantBinds).first();
    if (!user) return c.json({ success: false, message: 'Invalid phone number or PIN' }, 401);
    if (user.status === 'archived') return c.json({ success: false, message: 'Your account has been archived. Contact your manager.' }, 403);
    // Verify PIN (stored as pin_hash, fallback to password_hash for backward compat)
    const pinHash = user.pin_hash || user.password_hash;
    if (!pinHash) return c.json({ success: false, message: 'PIN not set. Contact your manager to set a PIN.' }, 401);
    const validPin = await bcrypt.compare(pin, pinHash);
    if (!validPin) return c.json({ success: false, message: 'Invalid phone number or PIN' }, 401);
    // Check if user is still using the default PIN (12345) — force change on first login
    const isDefaultPin = pin === '12345';
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) return c.json({ success: false, message: 'Server configuration error' }, 500);
    const accessToken = await generateToken({ userId: user.id, tenantId: user.tenant_id, role: user.role }, jwtSecret);
    const refreshToken = await generateToken({ userId: user.id, tenantId: user.tenant_id, role: user.role, type: 'refresh' }, jwtSecret, 604800);
    try { await db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?').bind(user.id).run(); } catch(e) {}
    const tenant = await db.prepare('SELECT id, name, code FROM tenants WHERE id = ?').bind(user.tenant_id).first();
    // Get user's assigned companies (role-aware: managers use manager_company_links, agents/TLs use agent_company_links)
    let companies = { results: [] };
    try {
      if (user.role === 'manager') {
        companies = await db.prepare("SELECT fc.id, fc.name, fc.code, fc.revisit_radius_meters FROM manager_company_links mcl JOIN field_companies fc ON mcl.company_id = fc.id WHERE mcl.manager_id = ? AND mcl.tenant_id = ? AND mcl.is_active = 1 AND fc.status = 'active'").bind(user.id, user.tenant_id).all();
      } else {
        companies = await db.prepare("SELECT fc.id, fc.name, fc.code, fc.revisit_radius_meters FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active'").bind(user.id, user.tenant_id).all();
      }
    } catch { /* company links table may not exist */ }
    return c.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, phone: user.phone, firstName: user.first_name, lastName: user.last_name, name: user.first_name + ' ' + user.last_name, role: user.role, status: user.status, tenantId: user.tenant_id, companyName: tenant ? tenant.name : '', managerId: user.manager_id, teamLeadId: user.team_lead_id },
        tokens: { access_token: accessToken, refresh_token: refreshToken, expires_in: 86400, token_type: 'Bearer' },
        token: accessToken,
        access_token: accessToken,
        tenant: tenant || {},
        companies: companies.results || [],
        must_change_pin: isDefaultPin,
      }
    });
  } catch (error) {
    console.error('Mobile login error:', error);
    return c.json({ success: false, message: 'Login failed' }, 500);
  }
});

app.post('/api/auth/register', rateLimiter(3, 3600000), async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json();
    const v = validate(registerSchema, body);
    if (!v.valid) return c.json({ success: false, message: 'Validation failed', errors: v.errors }, 400);
    const { email, phone, password, firstName, lastName, tenantCode } = v.data;
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
    // Section 5: Batch user creation + audit log
    await db.batch([
      db.prepare('INSERT INTO users (id, tenant_id, email, phone, password_hash, first_name, last_name, role, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').bind(userId, tenantId, email, phone || null, hashedPassword, firstName, lastName, 'admin', 'active'),
      db.prepare('INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(uuidv4(), tenantId, userId, 'CREATE', 'user', userId, JSON.stringify({ email, role: 'admin' })),
    ]);
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

// ==================== PASSWORD RESET & EMAIL QUEUE (SECTION 9) ====================
app.post('/api/auth/forgot-password', rateLimiter(3, 900000), async (c) => {
  try {
    const db = c.env.DB;
    const { email } = await c.req.json();
    if (!email) return c.json({ success: false, message: 'Email is required' }, 400);
    const user = await db.prepare('SELECT id, tenant_id, email, first_name FROM users WHERE email = ? AND is_active = 1').bind(email).first();
    if (!user) return c.json({ success: true, message: 'If an account exists, a reset link will be sent' });
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    await db.prepare("INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)").bind(uuidv4(), user.id, resetToken, expiresAt).run();
    const resetLink = (c.env.FRONTEND_URL || 'https://fieldvibe.app') + '/reset-password?token=' + resetToken;
    try {
      await db.prepare("INSERT INTO email_queue (id, tenant_id, to_email, subject, body_html, status) VALUES (?, ?, ?, ?, ?, 'pending')").bind(
        uuidv4(), user.tenant_id, email, 'Password Reset - FieldVibe',
        '<h2>Password Reset</h2><p>Hi ' + (user.first_name || '') + ',</p><p>Click below to reset your password:</p><p><a href="' + resetLink + '">Reset Password</a></p><p>This link expires in 1 hour.</p>'
      ).run();
    } catch(e) { console.error('Email queue error:', e); }
    return c.json({ success: true, message: 'If an account exists, a reset link will be sent' });
  } catch(e) {
    console.error('Forgot password error:', e);
    return c.json({ success: false, message: 'An error occurred' }, 500);
  }
});

app.post('/api/auth/reset-password', rateLimiter(5, 900000), async (c) => {
  try {
    const db = c.env.DB;
    const { token, password } = await c.req.json();
    if (!token || !password) return c.json({ success: false, message: 'Token and password are required' }, 400);
    if (password.length < 8) return c.json({ success: false, message: 'Password must be at least 8 characters' }, 400);
    const reset = await db.prepare("SELECT * FROM password_resets WHERE token = ? AND used_at IS NULL AND expires_at > datetime('now')").bind(token).first();
    if (!reset) return c.json({ success: false, message: 'Invalid or expired reset token' }, 400);
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?').bind(hashedPassword, reset.user_id).run();
    await db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE id = ?").bind(reset.id).run();
    return c.json({ success: true, message: 'Password reset successfully' });
  } catch(e) {
    console.error('Reset password error:', e);
    return c.json({ success: false, message: 'An error occurred' }, 500);
  }
});

// ==================== T-02: AUTH REFRESH, LOGOUT, VERIFY, CHANGE-PASSWORD ====================
app.post('/api/auth/refresh', rateLimiter(10, 60000), async (c) => {
  try {
    const db = c.env.DB;
    const { refresh_token } = await c.req.json();
    if (!refresh_token) return c.json({ success: false, message: 'Refresh token required' }, 400);
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) return c.json({ success: false, message: 'Server configuration error' }, 500);
    // Verify the refresh token JWT
    try {
      const [headerB64, payloadB64, signatureB64] = refresh_token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      if (!payload.userId || !payload.tenantId || payload.type !== 'refresh') return c.json({ success: false, message: 'Invalid refresh token' }, 401);
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return c.json({ success: false, message: 'Refresh token expired' }, 401);
      // Verify signature
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const signatureBytes = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
      const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(headerB64 + '.' + payloadB64));
      if (!valid) return c.json({ success: false, message: 'Invalid refresh token' }, 401);
      // Check user still exists and is active
      const user = await db.prepare('SELECT id, tenant_id, role, email, first_name, last_name, is_active, status FROM users WHERE id = ? AND is_active = 1').bind(payload.userId).first();
      if (!user) return c.json({ success: false, message: 'User not found or inactive' }, 401);
      if (user.status === 'archived') return c.json({ success: false, message: 'Your account has been archived. Contact your administrator.' }, 403);
      // Generate new tokens
      const newAccessToken = await generateToken({ userId: user.id, tenantId: user.tenant_id, role: user.role }, jwtSecret);
      const newRefreshToken = await generateToken({ userId: user.id, tenantId: user.tenant_id, role: user.role, type: 'refresh' }, jwtSecret, 604800);
      return c.json({ success: true, data: { tokens: { access_token: newAccessToken, refresh_token: newRefreshToken, expires_in: 86400, token_type: 'Bearer' }, token: newAccessToken, access_token: newAccessToken } });
    } catch (e) {
      return c.json({ success: false, message: 'Invalid refresh token' }, 401);
    }
  } catch (e) {
    console.error('Token refresh error:', e);
    return c.json({ success: false, message: 'Token refresh failed' }, 500);
  }
});

app.post('/api/auth/logout', async (c) => {
  // Stateless logout - client should discard tokens
  return c.json({ success: true, message: 'Logged out successfully' });
});

app.post('/api/auth/verify-token', async (c) => {
  try {
    const { token } = await c.req.json();
    if (!token) return c.json({ success: false, message: 'Token required' }, 400);
    const jwtSecret = c.env.JWT_SECRET;
    try {
      const [headerB64, payloadB64, signatureB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return c.json({ success: false, message: 'Token expired' }, 401);
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const signatureBytes = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
      const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(headerB64 + '.' + payloadB64));
      if (!valid) return c.json({ success: false, message: 'Invalid token' }, 401);
      return c.json({ success: true, data: { userId: payload.userId, tenantId: payload.tenantId, role: payload.role } });
    } catch (e) {
      return c.json({ success: false, message: 'Invalid token' }, 401);
    }
  } catch (e) {
    return c.json({ success: false, message: 'Verification failed' }, 500);
  }
});

app.post('/api/auth/change-password', authMiddleware, rateLimiter(5, 900000), async (c) => {
  try {
    const db = c.env.DB;
    const userId = c.get('userId');
    const { currentPassword, newPassword } = await c.req.json();
    if (!currentPassword || !newPassword) return c.json({ success: false, message: 'Current and new password required' }, 400);
    if (newPassword.length < 8) return c.json({ success: false, message: 'New password must be at least 8 characters' }, 400);
    const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(userId).first();
    if (!user) return c.json({ success: false, message: 'User not found' }, 404);
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) return c.json({ success: false, message: 'Current password is incorrect' }, 400);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?').bind(hashedPassword, userId).run();
    return c.json({ success: true, message: 'Password changed successfully' });
  } catch (e) {
    console.error('Change password error:', e);
    return c.json({ success: false, message: 'Password change failed' }, 500);
  }
});

export default app;
