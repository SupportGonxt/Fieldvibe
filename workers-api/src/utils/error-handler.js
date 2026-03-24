/**
 * Error Handling Utilities for FieldVibe API
 * 
 * Provides standardized error handling, logging, and user-friendly error messages
 * across all API endpoints.
 */

// Error severity levels
const ERROR_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

// Error types for categorization
const ERROR_TYPES = {
  VALIDATION: 'validation',
  DATABASE: 'database',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
  INTERNAL: 'internal',
  EXTERNAL: 'external'
};

/**
 * Log error to database error_logs table
 * @param {Object} env - Cloudflare worker environment
 * @param {string} tenantId - Tenant identifier
 * @param {string} errorType - Error type category
 * @param {string} message - Error message
 * @param {Error} error - Original error object
 * @param {string} path - Request path
 * @param {string} method - HTTP method
 * @param {string} severity - Error severity
 */
export async function logError(env, tenantId, errorType, message, error, path, method, severity = 'error') {
  try {
    if (!env?.DB) {
      console.error('No database available for error logging');
      return;
    }
    
    await env.DB.prepare(
      'INSERT INTO error_logs (id, tenant_id, error_type, message, stack_trace, request_path, request_method, severity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))'
    ).bind(
      crypto.randomUUID(),
      tenantId || 'unknown',
      errorType,
      message,
      error?.stack || 'No stack trace',
      path,
      method,
      severity
    ).run();
  } catch (logErr) {
    console.error('Failed to log error:', logErr.message);
  }
}

/**
 * Create standardized API error response
 * @param {string} message - User-friendly error message
 * @param {string} type - Error type
 * @param {number} status - HTTP status code
 * @param {Object} details - Additional error details
 * @returns {Object} Standardized error response
 */
export function createErrorResponse(message, type = 'internal', status = 500, details = {}) {
  return {
    success: false,
    error: {
      message,
      type,
      status,
      timestamp: new Date().toISOString(),
      ...details
    }
  };
}

/**
 * Handle database query errors gracefully
 * @param {Promise} queryPromise - Database query promise
 * @param {any} defaultValue - Default value to return on error
 * @param {string} context - Context for error logging
 * @returns {Promise<any>} Query result or default value
 */
export async function safeDbQuery(queryPromise, defaultValue, context = 'database query') {
  try {
    return await queryPromise;
  } catch (error) {
    console.error(`${context} failed:`, error.message);
    // Log significant errors (not just empty results)
    if (!defaultValue || (Array.isArray(defaultValue) && defaultValue.length === 0)) {
      console.warn(`${context} returned empty result - this may indicate missing data`);
    }
    return defaultValue;
  }
}

/**
 * Parse and categorize database errors
 * @param {Error} error - Database error
 * @returns {Object} Parsed error information
 */
export function parseDatabaseError(error) {
  const errMsg = error.message || 'Unknown database error';
  
  // UNIQUE constraint violations
  if (errMsg.includes('UNIQUE constraint failed')) {
    const match = errMsg.match(/UNIQUE constraint failed: (\w+)\.(\w+)/);
    const table = match?.[1] || 'table';
    const field = match?.[2] || 'field';
    return {
      type: ERROR_TYPES.VALIDATION,
      message: `A record with this ${field} already exists. Please use a different value.`,
      field,
      table,
      status: 409 // Conflict
    };
  }
  
  // NOT NULL constraint violations
  if (errMsg.includes('NOT NULL constraint failed')) {
    const match = errMsg.match(/NOT NULL constraint failed: (\w+)\.(\w+)/);
    const field = match?.[2] || 'field';
    return {
      type: ERROR_TYPES.VALIDATION,
      message: `Required field '${field}' is missing.`,
      field,
      status: 400 // Bad Request
    };
  }
  
  // Foreign key constraint violations
  if (errMsg.includes('FOREIGN KEY constraint failed')) {
    return {
      type: ERROR_TYPES.VALIDATION,
      message: 'Referenced record does not exist.',
      status: 400
    };
  }
  
  // CHECK constraint violations
  if (errMsg.includes('CHECK constraint failed')) {
    return {
      type: ERROR_TYPES.VALIDATION,
      message: 'Data validation failed. Please check the input values.',
      status: 400
    };
  }
  
  // Default: internal database error
  return {
    type: ERROR_TYPES.DATABASE,
    message: 'Database operation failed. Please try again.',
    status: 500
  };
}

/**
 * Validate request parameters safely
 * @param {Object} params - Request parameters
 * @param {Object} schema - Validation schema
 * @returns {Object} Validation result
 */
export function validateParams(params, schema) {
  const errors = [];
  
  for (const [key, rules] of Object.entries(schema)) {
    const value = params[key];
    
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`);
      continue;
    }
    
    if (rules.type === 'integer' && value !== undefined) {
      const num = parseInt(value, 10);
      if (isNaN(num)) {
        errors.push(`${key} must be an integer`);
        continue;
      }
      if (rules.min !== undefined && num < rules.min) {
        errors.push(`${key} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && num > rules.max) {
        errors.push(`${key} must be at most ${rules.max}`);
      }
    }
    
    if (rules.type === 'string' && value !== undefined) {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${key} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${key} must be at most ${rules.maxLength} characters`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create error response with proper HTTP status
 * @param {Object} c - Hono context
 * @param {Error} error - Error object
 * @param {string} customMessage - Optional custom message
 * @returns {Response} JSON error response
 */
export function handleError(c, error, customMessage = null) {
  const tenantId = c.get?.('tenantId') || 'unknown';
  const path = c.req?.path || 'unknown';
  const method = c.req?.method || 'unknown';
  
  // Parse database errors
  const parsedError = parseDatabaseError(error);
  
  const userMessage = customMessage || parsedError.message || error.message || 'An error occurred';
  
  // Log error
  logError(c.env, tenantId, parsedError.type, userMessage, error, path, method, parsedError.status === 500 ? 'critical' : 'warning');
  
  // Return error response
  return c.json(createErrorResponse(userMessage, parsedError.type, parsedError.status, {
    originalError: error.message
  }), parsedError.status);
}

/**
 * Async wrapper with automatic error handling
 * @param {Function} handler - Async route handler
 * @returns {Function} Wrapped handler
 */
export function asyncHandler(handler) {
  return async (c) => {
    try {
      return await handler(c);
    } catch (error) {
      return handleError(c, error);
    }
  };
}

// Export for use in route handlers
export default {
  logError,
  createErrorResponse,
  safeDbQuery,
  parseDatabaseError,
  validateParams,
  handleError,
  asyncHandler,
  ERROR_SEVERITY,
  ERROR_TYPES
};
