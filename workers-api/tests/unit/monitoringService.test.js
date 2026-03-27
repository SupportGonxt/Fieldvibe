/**
 * Tests for Monitoring Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  MetricsCollector, 
  HealthChecker, 
  RequestTracer,
  createMonitoringService 
} from '../src/services/monitoringService.js';

describe('MetricsCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('recordTiming', () => {
    it('should record timing metrics', () => {
      collector.recordTiming('api_latency', 150);
      collector.recordTiming('api_latency', 200);
      collector.recordTiming('api_latency', 100);

      const percentiles = collector.getPercentiles('api_latency');

      expect(percentiles).toBeDefined();
      expect(percentiles.count).toBe(3);
      expect(percentiles.avg).toBe(150);
    });

    it('should calculate percentiles correctly', () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordTiming('response_time', i);
      }

      const percentiles = collector.getPercentiles('response_time');

      expect(percentiles.p50).toBeCloseTo(50, 0);
      expect(percentiles.p95).toBeCloseTo(95, 0);
      expect(percentiles.p99).toBeCloseTo(99, 0);
    });

    it('should limit histogram size', () => {
      for (let i = 0; i < 1500; i++) {
        collector.recordTiming('test_metric', i);
      }

      const percentiles = collector.getPercentiles('test_metric');
      expect(percentiles.count).toBe(1000);
    });
  });

  describe('increment', () => {
    it('should increment counter', () => {
      collector.increment('requests_total');
      collector.increment('requests_total');
      collector.increment('requests_total', 5);

      const metrics = collector.getAllMetrics();
      expect(metrics.requests_total.counter).toBe(7);
    });

    it('should handle labels', () => {
      collector.increment('requests_total', 1, { method: 'GET', status: '200' });
      collector.increment('requests_total', 1, { method: 'POST', status: '201' });

      const metrics = collector.getAllMetrics();
      expect(metrics.requests_total).toBeDefined();
    });
  });

  describe('setGauge', () => {
    it('should set gauge value', () => {
      collector.setGauge('active_users', 150);

      const metrics = collector.getAllMetrics();
      expect(metrics.active_users.gauge).toBe(150);
    });

    it('should update gauge value', () => {
      collector.setGauge('memory_usage', 512);
      collector.setGauge('memory_usage', 768);

      const metrics = collector.getAllMetrics();
      expect(metrics.memory_usage.gauge).toBe(768);
    });
  });
});

describe('HealthChecker', () => {
  let db;
  let healthChecker;

  beforeEach(() => {
    db = {
      prepare: vi.fn((sql) => ({
        first: vi.fn(async () => ({ ok: 1 }))
      }))
    };
    healthChecker = new HealthChecker(db);
  });

  describe('getHealthStatus', () => {
    it('should return healthy status', async () => {
      const health = await healthChecker.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
      expect(health.checks).toBeDefined();
    });

    it('should include database check', async () => {
      const health = await healthChecker.getHealthStatus();

      expect(health.checks.database).toBeDefined();
      expect(health.checks.database.status).toBe('healthy');
    });

    it('should return unhealthy if check fails', async () => {
      healthChecker.registerCheck('failing_check', () => {
        throw new Error('Check failed');
      });

      const health = await healthChecker.getHealthStatus();
      expect(health.checks.failing_check.status).toBe('unhealthy');
    });
  });

  describe('registerCheck', () => {
    it('should register custom health check', async () => {
      healthChecker.registerCheck('custom_check', () => ({
        status: 'healthy',
        custom: 'data'
      }));

      const health = await healthChecker.getHealthStatus();
      expect(health.checks.custom_check).toBeDefined();
      expect(health.checks.custom_check.custom).toBe('data');
    });
  });
});

describe('RequestTracer', () => {
  let metrics;
  let tracer;

  beforeEach(() => {
    metrics = new MetricsCollector();
    tracer = new RequestTracer(metrics);
  });

  describe('sanitizePath', () => {
    it('should replace UUIDs with :id', () => {
      const path = '/api/users/550e8400-e29b-41d4-a716-446655440000';
      const sanitized = tracer.sanitizePath(path);
      expect(sanitized).toBe('/api/users/:id');
    });

    it('should replace numeric IDs with :id', () => {
      const path = '/api/orders/12345/items/67890';
      const sanitized = tracer.sanitizePath(path);
      expect(sanitized).toBe('/api/orders/:id/items/:id');
    });
  });
});

describe('createMonitoringService', () => {
  it('should create monitoring service with all components', () => {
    const monitoring = createMonitoringService();

    expect(monitoring.metrics).toBeDefined();
    expect(monitoring.tracer).toBeDefined();
    expect(monitoring.errorTracker).toBeDefined();
    expect(monitoring.middleware).toBeDefined();
    expect(monitoring.healthEndpoint).toBeDefined();
    expect(monitoring.metricsEndpoint).toBeDefined();
  });
});
