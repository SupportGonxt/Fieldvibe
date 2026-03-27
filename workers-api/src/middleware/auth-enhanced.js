/**
 * Enhanced Authentication Middleware
 * Multi-factor authentication, session management, secure token handling
 */

import { jwtUtils } from './security.js';

/**
 * MFA Types
 */
export const MFA_TYPES = {
  TOTP: 'totp',      // Time-based One-Time Password
  SMS: 'sms',        // SMS verification
  EMAIL: 'email',    // Email verification
  BACKUP: 'backup'   // Backup codes
};

/**
 * Session management
 */
export class SessionManager {
  constructor(kvStore) {
    this.kv = kvStore;
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Create a new session
   */
  async createSession(userId, tenantId, metadata = {}) {
    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      userId,
      tenantId,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.sessionTimeout,
      lastActivity: Date.now(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      deviceId: metadata.deviceId,
      mfaVerified: false,
      mfaMethod: null
    };

    await this.kv.put(`session:${sessionId}`, JSON.stringify(session), {
      expirationTtl: Math.floor(this.sessionTimeout / 1000)
    });

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    const sessionStr = await this.kv.get(`session:${sessionId}`);
    if (!sessionStr) return null;

    const session = JSON.parse(sessionStr);
    
    // Check expiration
    if (session.expiresAt < Date.now()) {
      await this.deleteSession(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = Date.now();
    await this.kv.put(`session:${sessionId}`, JSON.stringify(session), {
      expirationTtl: Math.floor(this.sessionTimeout / 1000)
    });

    return session;
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId) {
    await this.kv.delete(`session:${sessionId}`);
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId) {
    // List all sessions and filter by userId
    const sessions = await this.kv.list({ prefix: 'session:' });
    
    for (const key of sessions.keys) {
      const sessionStr = await this.kv.get(key.name);
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session.userId === userId) {
          await this.kv.delete(key.name);
        }
      }
    }
  }

  /**
   * Mark session as MFA verified
   */
  async markMfaVerified(sessionId, mfaMethod) {
    const session = await this.getSession(sessionId);
    if (session) {
      session.mfaVerified = true;
      session.mfaMethod = mfaMethod;
      await this.kv.put(`session:${sessionId}`, JSON.stringify(session), {
        expirationTtl: Math.floor(this.sessionTimeout / 1000)
      });
    }
    return session;
  }
}

/**
 * TOTP (Time-based One-Time Password) utilities
 */
export const totpUtils = {
  /**
   * Generate a secret key for TOTP
   */
  generateSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // Base32
    let secret = '';
    const randomValues = crypto.getRandomValues(new Uint8Array(20));
    
    for (let i = 0; i < 20; i++) {
      secret += chars[randomValues[i] % chars.length];
    }
    
    return secret;
  },

  /**
   * Generate TOTP code from secret
   */
  async generateCode(secret, timeStep = 30) {
    const epoch = Math.floor(Date.now() / 1000);
    const timeCounter = Math.floor(epoch / timeStep);
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const timeBuffer = new ArrayBuffer(8);
    const view = new DataView(timeBuffer);
    view.setBigUint64(0, BigInt(timeCounter));

    const signature = await crypto.subtle.sign('HMAC', key, timeBuffer);
    const signatureArray = new Uint8Array(signature);

    // Dynamic truncation
    const offset = signatureArray[signatureArray.length - 1] & 0xf;
    const binary = ((signatureArray[offset] & 0x7f) << 24) |
                   ((signatureArray[offset + 1] & 0xff) << 16) |
                   ((signatureArray[offset + 2] & 0xff) << 8) |
                   (signatureArray[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  },

  /**
   * Verify TOTP code
   */
  async verifyCode(secret, code, window = 1) {
    const currentCode = await this.generateCode(secret);
    
    if (code === currentCode) {
      return true;
    }

    // Check adjacent time steps (for clock skew)
    for (let i = 1; i <= window; i++) {
      const prevCode = await this.generateCode(secret, 30, -i);
      const nextCode = await this.generateCode(secret, 30, i);
      
      if (code === prevCode || code === nextCode) {
        return true;
      }
    }

    return false;
  },

  /**
   * Generate QR code data URI for authenticator apps
   */
  generateQRCodeDataURI(secret, issuer, accountName) {
    const otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    return otpauth;
  }
};

/**
 * Backup code utilities
 */
export const backupCodeUtils = {
  /**
   * Generate backup codes
   */
  generateCodes(count = 10) {
    const codes = [];
    
    for (let i = 0; i < count; i++) {
      const randomBytes = crypto.getRandomValues(new Uint8Array(8));
      const code = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('-')
        .match(/.{1,4}/g)
        .join('-');
      codes.push(code);
    }

    return codes;
  },

  /**
   * Hash backup codes for storage
   */
  async hashCodes(codes) {
    const hashed = [];
    
    for (const code of codes) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(code));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      hashed.push(hashHex);
    }

    return hashed;
  },

  /**
   * Verify backup code
   */
  async verifyCode(codes, code) {
    const encoder = new TextEncoder();
    const codeHash = await crypto.subtle.digest('SHA-256', encoder.encode(code));
    const codeHashArray = Array.from(new Uint8Array(codeHash));
    const codeHashHex = codeHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return codes.includes(codeHashHex);
  }
};

/**
 * Enhanced authentication middleware with MFA support
 */
export function enhancedAuthMiddleware(options = {}) {
  const {
    sessionManager,
    requireMfa = false,
    mfaMethods = [MFA_TYPES.TOTP]
  } = options;

  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    const sessionId = c.req.header('X-Session-ID');

    if (!authHeader && !sessionId) {
      return c.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, 401);
    }

    try {
      let userContext;

      // Session-based auth
      if (sessionId && sessionManager) {
        const session = await sessionManager.getSession(sessionId);
        
        if (!session) {
          return c.json({
            success: false,
            error: {
              code: 'SESSION_INVALID',
              message: 'Invalid or expired session'
            }
          }, 401);
        }

        if (requireMfa && !session.mfaVerified) {
          return c.json({
            success: false,
            error: {
              code: 'MFA_REQUIRED',
              message: 'Multi-factor authentication required',
              mfaMethods
            }
          }, 403);
        }

        userContext = {
          userId: session.userId,
          tenantId: session.tenantId,
          sessionId: session.id,
          mfaVerified: session.mfaVerified
        };

      // Token-based auth
      } else if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const verification = jwtUtils.verifyToken(token, c.env.JWT_SECRET);

        if (!verification.valid) {
          return c.json({
            success: false,
            error: {
              code: 'TOKEN_INVALID',
              message: verification.error
            }
          }, 401);
        }

        userContext = {
          userId: verification.payload.sub,
          tenantId: verification.payload.tenantId,
          email: verification.payload.email,
          role: verification.payload.role
        };
      }

      // Set user context
      c.set('userId', userContext.userId);
      c.set('tenantId', userContext.tenantId);
      c.set('sessionId', userContext.sessionId);
      c.set('mfaVerified', userContext.mfaVerified);

      await next();

    } catch (error) {
      return c.json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed'
        }
      }, 401);
    }
  };
}

/**
 * Password policy enforcement
 */
export const passwordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
  historySize: 5,

  /**
   * Validate password strength
   */
  validate(password) {
    const errors = [];

    if (password.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters`);
    }

    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Calculate password strength score
   */
  calculateStrength(password) {
    let score = 0;

    // Length score
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    // Bonus for length + variety
    if (password.length >= 12 && score >= 6) score += 1;
    if (password.length >= 16 && score >= 7) score += 1;

    return Math.min(score, 10);
  }
};

/**
 * Account lockout management
 */
export class AccountLockoutManager {
  constructor(kvStore, options = {}) {
    this.kv = kvStore;
    this.maxAttempts = options.maxAttempts || 5;
    this.lockoutDuration = options.lockoutDuration || 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Record failed login attempt
   */
  async recordFailedAttempt(identifier) {
    const key = `lockout:${identifier}`;
    const attempts = await this.kv.get(key, 'json') || { count: 0, firstAttempt: Date.now() };

    attempts.count++;
    attempts.lastAttempt = Date.now();

    await this.kv.put(key, JSON.stringify(attempts), {
      expirationTtl: Math.floor(this.lockoutDuration / 1000) + 60
    });

    return attempts.count >= this.maxAttempts;
  }

  /**
   * Check if account is locked
   */
  async isLocked(identifier) {
    const key = `lockout:${identifier}`;
    const attempts = await this.kv.get(key, 'json');

    if (!attempts || attempts.count < this.maxAttempts) {
      return { locked: false };
    }

    const timeSinceFirstAttempt = Date.now() - attempts.firstAttempt;
    
    if (timeSinceFirstAttempt < this.lockoutDuration) {
      const remainingTime = this.lockoutDuration - timeSinceFirstAttempt;
      return {
        locked: true,
        remainingTime,
        unlockAt: new Date(Date.now() + remainingTime).toISOString()
      };
    }

    // Reset after lockout period
    await this.kv.delete(key);
    return { locked: false };
  }

  /**
   * Reset failed attempts (on successful login)
   */
  async resetAttempts(identifier) {
    await this.kv.delete(`lockout:${identifier}`);
  }
}
