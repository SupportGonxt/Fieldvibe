// Shared route middleware. Moved verbatim from index.js.
import { roleAllows } from './capabilities.js';
// ==================== SECTION 3: RATE LIMITING (T-18: D1-backed for Cloudflare Workers) ====================
export const rateLimiter = (limit, windowMs) => async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const key = `rl:${ip}:${Math.floor(windowMs / 1000)}`;
  try {
    const db = c.env.DB;
    const row = await db.prepare('SELECT count FROM rate_limits WHERE key = ? AND window_start = ?').bind(key, windowStart).first();
    const current = row ? row.count : 0;
    if (current >= limit) {
      c.header('Retry-After', String(Math.ceil(windowMs / 1000)));
      c.header('X-RateLimit-Limit', String(limit));
      c.header('X-RateLimit-Remaining', '0');
      return c.json({ success: false, message: 'Too many requests. Please try again later.' }, 429);
    }
    if (row) {
      await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ? AND window_start = ?').bind(key, windowStart).run();
    } else {
      await db.prepare('INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)').bind(key, windowStart).run();
    }
    // Cleanup old entries periodically (1 in 100 requests)
    if (Math.random() < 0.01) {
      await db.prepare('DELETE FROM rate_limits WHERE window_start < datetime("now", "-1 hour")').run();
    }
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(limit - current - 1));
  } catch (e) {
    // Fallback: allow request if rate limit check fails
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(limit));
  }
  await next();
};

// Auth middleware with HMAC-SHA256 signature verification (Section 1 fix)
export const authMiddleware = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    // Browser WebSocket can't set headers, so WS upgrades pass the JWT as a
    // query param instead. Signature is still verified below either way.
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : c.req.query('access_token');
    if (!token) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      return c.json({ success: false, message: 'Malformed token' }, 401);
    }

    // VERIFY SIGNATURE using Web Crypto API
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      return c.json({ success: false, message: 'Server configuration error' }, 500);
    }
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const signatureBytes = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      ch => ch.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify(
      'HMAC', key, signatureBytes, encoder.encode(parts[0] + '.' + parts[1])
    );
    if (!valid) {
      return c.json({ success: false, message: 'Invalid token signature' }, 401);
    }

    // NOW safe to decode payload
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return c.json({ success: false, message: 'Token expired' }, 401);
    }
    if (payload.aud === 'portal') {
      return c.json({ success: false, message: 'Portal token not valid for staff API' }, 401);
    }
    c.set('userId', payload.userId);
    c.set('tenantId', payload.tenantId);
    c.set('role', payload.role);
    await next();
  } catch (error) {
    return c.json({ success: false, message: 'Invalid token' }, 401);
  }
};

export const requireRole = (...roles) => {
  return async (c, next) => {
    const role = c.get('role');
    if (roleAllows(role, roles)) {
      await next();
    } else {
      return c.json({ success: false, message: 'Insufficient permissions' }, 403);
    }
  };
};

export const requireSuperAdmin = async (c, next) => {
  const role = c.get('role');
  if (role === 'super_admin') {
    await next();
  } else {
    return c.json({ success: false, message: 'Super admin access required' }, 403);
  }
};
