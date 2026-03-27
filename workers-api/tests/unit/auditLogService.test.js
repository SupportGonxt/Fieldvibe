/**
 * Tests for Audit Log Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogService, AuditLog, AuditActions } from '../src/services/auditLogService.js';

// Mock database
const createMockDb = () => {
  const data = new Map();
  
  return {
    prepare: vi.fn((sql) => ({
      bind: vi.fn((...params) => ({
        run: vi.fn(() => ({})),
        all: vi.fn(async () => ({ results: Array.from(data.values()) })),
        first: vi.fn(async () => {
          const key = params[0];
          return data.get(key) || null;
        })
      })),
      run: vi.fn(() => ({})),
      all: vi.fn(async () => ({ results: Array.from(data.values()) })),
      first: vi.fn(async () => null)
    })),
    batch: vi.fn(async (statements) => {
      for (const stmt of statements) {
        await stmt.run();
      }
    }),
    data
  };
};

describe('AuditLogService', () => {
  let db;
  let auditService;

  beforeEach(() => {
    db = createMockDb();
    auditService = new AuditLogService(db);
  });

  describe('AuditLog class', () => {
    it('should create audit log with all fields', () => {
      const data = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        userEmail: 'user@example.com',
        action: AuditActions.CREATE,
        resource: 'visits',
        resourceId: 'visit-789',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        requestId: 'req-abc',
        status: 'SUCCESS'
      };

      const log = new AuditLog(data);

      expect(log.tenantId).toBe('tenant-123');
      expect(log.userId).toBe('user-456');
      expect(log.action).toBe('CREATE');
      expect(log.resource).toBe('visits');
      expect(log.status).toBe('SUCCESS');
      expect(log.id).toBeDefined();
      expect(log.timestamp).toBeDefined();
    });

    it('should generate UUID if not provided', () => {
      const log = new AuditLog({ tenantId: 't1', userId: 'u1', action: 'CREATE', resource: 'test' });
      expect(log.id).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    });
  });

  describe('log method', () => {
    it('should add log to buffer', async () => {
      const logData = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        action: 'CREATE',
        resource: 'visits'
      };

      const log = await auditService.log(logData);

      expect(log).toBeDefined();
      expect(auditService.buffer.length).toBe(1);
    });

    it('should flush buffer when full', async () => {
      auditService.bufferSize = 5;

      for (let i = 0; i < 5; i++) {
        await auditService.log({
          tenantId: 'tenant-123',
          userId: 'user-456',
          action: 'CREATE',
          resource: 'visits'
        });
      }

      expect(auditService.buffer.length).toBe(0);
      expect(db.batch).toHaveBeenCalled();
    });
  });

  describe('trackChanges static method', () => {
    it('should detect changed fields', () => {
      const oldValue = { name: 'John', age: 30, city: 'NYC' };
      const newValue = { name: 'John', age: 31, city: 'NYC' };

      const changes = AuditLogService.trackChanges(oldValue, newValue);

      expect(changes.changed).toEqual(['age']);
      expect(changes.before.age).toBe(30);
      expect(changes.after.age).toBe(31);
    });

    it('should return null if no changes', () => {
      const oldValue = { name: 'John', age: 30 };
      const newValue = { name: 'John', age: 30 };

      const changes = AuditLogService.trackChanges(oldValue, newValue);

      expect(changes).toBeNull();
    });

    it('should only track specified fields', () => {
      const oldValue = { name: 'John', age: 30, city: 'NYC' };
      const newValue = { name: 'Jane', age: 30, city: 'LA' };

      const changes = AuditLogService.trackChanges(oldValue, newValue, ['name']);

      expect(changes.changed).toEqual(['name']);
    });
  });
});

describe('AuditActions', () => {
  it('should have all action types defined', () => {
    expect(AuditActions.LOGIN).toBe('LOGIN');
    expect(AuditActions.LOGOUT).toBe('LOGOUT');
    expect(AuditActions.CREATE).toBe('CREATE');
    expect(AuditActions.UPDATE).toBe('UPDATE');
    expect(AuditActions.DELETE).toBe('DELETE');
  });
});
