/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user context
 */

export function authMiddleware(c, next) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } 
      }, 401);
    }

    const token = authHeader.split(' ')[1];
    
    // Decode JWT (simplified - in production use proper JWT library)
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    // Validate expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return c.json({ 
        success: false, 
        error: { code: 'TOKEN_EXPIRED', message: 'Token has expired' } 
      }, 401);
    }

    // Set user context
    c.set('userId', payload.sub || payload.userId);
    c.set('tenantId', payload.tenantId);
    c.set('role', payload.role);
    c.set('email', payload.email);
    
    return next();
  } catch (error) {
    return c.json({ 
      success: false, 
      error: { code: 'AUTH_ERROR', message: 'Invalid token format' } 
    }, 401);
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles) {
  return async (c, next) => {
    const userRole = c.get('role');
    // general_manager inherits every admin-gated route
    const allowed = roles.includes('admin') ? [...roles, 'general_manager'] : roles;

    if (!allowed.includes(userRole)) {
      return c.json({ 
        success: false, 
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } 
      }, 403);
    }
    
    await next();
  };
}

/**
 * Tenant isolation middleware
 * Ensures users can only access their tenant's data
 */
export function requireTenant() {
  return async (c, next) => {
    const tenantId = c.get('tenantId');
    
    if (!tenantId) {
      return c.json({ 
        success: false, 
        error: { code: 'TENANT_REQUIRED', message: 'Tenant context required' } 
      }, 400);
    }
    
    await next();
  };
}
