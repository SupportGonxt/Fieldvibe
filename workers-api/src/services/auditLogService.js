/**
 * Audit Logging Service
 * Comprehensive audit trail for all user actions and system events
 * SOC 2 compliance ready
 */

/**
 * Audit log entry structure
 */
export class AuditLog {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.timestamp = data.timestamp || new Date().toISOString();
    this.tenantId = data.tenantId;
    this.userId = data.userId;
    this.userEmail = data.userEmail;
    this.action = data.action; // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
    this.resource = data.resource; // users, visits, orders, etc.
    this.resourceId = data.resourceId;
    this.ipAddress = data.ipAddress;
    this.userAgent = data.userAgent;
    this.requestId = data.requestId;
    this.changes = data.changes || null; // Before/after values
    this.metadata = data.metadata || {}; // Additional context
    this.status = data.status || 'SUCCESS'; // SUCCESS, FAILURE, DENIED
    this.errorMessage = data.errorMessage || null;
  }
}

/**
 * Audit logging service
 */
export class AuditLogService {
  constructor(db) {
    this.db = db;
    this.buffer = [];
    this.bufferSize = 100;
    this.flushInterval = 5000; // 5 seconds
    
    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Start periodic buffer flush
   */
  startPeriodicFlush() {
    setInterval(() => {
      this.flushBuffer();
    }, this.flushInterval);
  }

  /**
   * Log an audit event
   */
  async log(auditData) {
    const log = new AuditLog(auditData);
    
    // Add to buffer
    this.buffer.push(log);
    
    // Flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
    
    return log;
  }

  /**
   * Flush buffer to database
   */
  async flushBuffer() {
    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer = [];

    try {
      const stmt = this.db.prepare(`
        INSERT INTO audit_logs (
          id, timestamp, tenant_id, user_id, user_email,
          action, resource, resource_id, ip_address, user_agent,
          request_id, changes, metadata, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const batch = logs.map(log => 
        stmt.bind(
          log.id,
          log.timestamp,
          log.tenantId,
          log.userId,
          log.userEmail,
          log.action,
          log.resource,
          log.resourceId,
          log.ipAddress,
          log.userAgent,
          log.requestId,
          log.changes ? JSON.stringify(log.changes) : null,
          JSON.stringify(log.metadata),
          log.status,
          log.errorMessage
        )
      );

      await this.db.batch(batch);
    } catch (error) {
      console.error('Failed to flush audit logs:', error);
      // Re-add to buffer for retry
      this.buffer = [...logs, ...this.buffer];
    }
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getLogs(filters, pagination) {
    const {
      tenantId,
      userId,
      action,
      resource,
      startDate,
      endDate,
      status
    } = filters;

    const { page = 1, limit = 50 } = pagination;
    const offset = (page - 1) * limit;

    let whereClauses = ['1=1'];
    const params = [];

    if (tenantId) {
      whereClauses.push('tenant_id = ?');
      params.push(tenantId);
    }

    if (userId) {
      whereClauses.push('user_id = ?');
      params.push(userId);
    }

    if (action) {
      whereClauses.push('action = ?');
      params.push(action);
    }

    if (resource) {
      whereClauses.push('resource = ?');
      params.push(resource);
    }

    if (startDate) {
      whereClauses.push('timestamp >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push('timestamp <= ?');
      params.push(endDate);
    }

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    const whereClause = whereClauses.join(' AND ');

    const query = `
      SELECT * FROM audit_logs
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const logs = await this.db.prepare(query).bind(...params, limit, offset).all();

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM audit_logs
      WHERE ${whereClause}
    `;
    const { total } = await this.db.prepare(countQuery).bind(...params).first();

    return {
      logs: logs.results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceHistory(resource, resourceId, tenantId) {
    return this.getLogs(
      { resource, resourceId, tenantId },
      { page: 1, limit: 100 }
    );
  }

  /**
   * Track changes between old and new values
   */
  static trackChanges(oldValue, newValue, fields = null) {
    const changes = {
      before: {},
      after: {},
      changed: []
    };

    const allFields = fields || Object.keys({ ...oldValue, ...newValue });

    for (const field of allFields) {
      const oldVal = oldValue?.[field];
      const newVal = newValue?.[field];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.before[field] = oldVal;
        changes.after[field] = newVal;
        changes.changed.push(field);
      }
    }

    return changes.changed.length > 0 ? changes : null;
  }
}

/**
 * Audit logging middleware
 */
export function auditLogger(options = {}) {
  const {
    resource,
    getIdFromRequest = (c) => c.get('userId'),
    getChanges = null
  } = options;

  return async (c, next) => {
    const auditService = c.get('auditService');
    
    if (!auditService) {
      return next();
    }

    const startTime = Date.now();
    
    try {
      await next();

      // Log successful action
      await auditService.log({
        tenantId: c.get('tenantId'),
        userId: c.get('userId'),
        userEmail: c.get('email'),
        action: c.req.method,
        resource,
        resourceId: getIdFromRequest(c),
        ipAddress: c.req.header('CF-Connecting-IP'),
        userAgent: c.req.header('User-Agent'),
        requestId: c.get('requestId'),
        changes: getChanges ? getChanges(c) : null,
        metadata: {
          path: c.req.path,
          duration: Date.now() - startTime
        },
        status: 'SUCCESS'
      });
    } catch (error) {
      // Log failed action
      await auditService.log({
        tenantId: c.get('tenantId'),
        userId: c.get('userId'),
        userEmail: c.get('email'),
        action: c.req.method,
        resource,
        ipAddress: c.req.header('CF-Connecting-IP'),
        userAgent: c.req.header('User-Agent'),
        requestId: c.get('requestId'),
        errorMessage: error.message,
        status: 'FAILURE'
      });

      throw error;
    }
  };
}

/**
 * Action types for audit logging
 */
export const AuditActions = {
  // Authentication
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  MFA_ENABLE: 'MFA_ENABLE',
  MFA_DISABLE: 'MFA_DISABLE',
  
  // User Management
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  USER_ACTIVATE: 'USER_ACTIVATE',
  USER_DEACTIVATE: 'USER_DEACTIVATE',
  
  // Data Operations
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  BULK_IMPORT: 'BULK_IMPORT',
  BULK_EXPORT: 'BULK_EXPORT',
  
  // System
  CONFIG_CHANGE: 'CONFIG_CHANGE',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
  ROLE_ASSIGN: 'ROLE_ASSIGN',
  ROLE_REVOKE: 'ROLE_REVOKE',
  
  // Security
  FAILED_LOGIN: 'FAILED_LOGIN',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  SESSION_TERMINATED: 'SESSION_TERMINATED',
  API_KEY_CREATED: 'API_KEY_CREATED',
  API_KEY_REVOKED: 'API_KEY_REVOKED
};
