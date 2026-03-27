/**
 * Monitoring & Observability Service
 * Application Performance Monitoring, metrics collection, and health checks
 */

/**
 * Metrics collector for performance monitoring
 */
export class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.histograms = new Map();
    this.counters = new Map();
    this.gauges = new Map();
  }

  /**
   * Record a timing metric
   */
  recordTiming(metricName, durationMs, labels = {}) {
    const key = this.buildKey(metricName, labels);
    
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }

    const histogram = this.histograms.get(key);
    histogram.push(durationMs);

    // Keep only last 1000 values
    if (histogram.length > 1000) {
      histogram.shift();
    }
  }

  /**
   * Increment a counter
   */
  increment(metricName, value = 1, labels = {}) {
    const key = this.buildKey(metricName, labels);
    
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Set a gauge value
   */
  setGauge(metricName, value, labels = {}) {
    const key = this.buildKey(metricName, labels);
    this.gauges.set(key, value);
  }

  /**
   * Build metric key from name and labels
   */
  buildKey(name, labels) {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Get histogram percentiles
   */
  getPercentiles(metricName, labels = {}) {
    const key = this.buildKey(metricName, labels);
    const histogram = this.histograms.get(key);

    if (!histogram || histogram.length === 0) {
      return null;
    }

    const sorted = [...histogram].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.50)],
      p75: sorted[Math.floor(len * 0.75)],
      p90: sorted[Math.floor(len * 0.90)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      min: sorted[0],
      max: sorted[len - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / len,
      count: len
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    const result = {};

    // Add histogram percentiles
    for (const [key] of this.histograms) {
      const [name] = key.split('{');
      result[name] = this.getPercentilesFromKey(key);
    }

    // Add counters
    for (const [key, value] of this.counters) {
      const [name] = key.split('{');
      if (!result[name]) {
        result[name] = {};
      }
      result[name].counter = value;
    }

    // Add gauges
    for (const [key, value] of this.gauges) {
      const [name] = key.split('{');
      if (!result[name]) {
        result[name] = {};
      }
      result[name].gauge = value;
    }

    return result;
  }

  getPercentilesFromKey(key) {
    return this.getPercentiles(key);
  }
}

/**
 * Health check service
 */
export class HealthChecker {
  constructor(db, options = {}) {
    this.db = db;
    this.checks = new Map();
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    
    this.registerDefaultChecks();
    this.startPeriodicChecks();
  }

  /**
   * Register default health checks
   */
  registerDefaultChecks() {
    // Database connectivity
    this.registerCheck('database', async () => {
      try {
        const result = await this.db.prepare('SELECT 1 as ok').first();
        return {
          status: result.ok === 1 ? 'healthy' : 'unhealthy',
          latency: Date.now()
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    // Memory usage
    this.registerCheck('memory', () => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const usage = process.memoryUsage();
        return {
          status: 'healthy',
          rss: usage.rss,
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal
        };
      }
      return {
        status: 'healthy',
        note: 'Memory info not available'
      };
    });

    // Uptime
    this.registerCheck('uptime', () => {
      return {
        status: 'healthy',
        uptime: process?.uptime ? process.uptime() : 'unknown'
      };
    });
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFn) {
    this.checks.set(name, checkFn);
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks() {
    setInterval(async () => {
      for (const [name, checkFn] of this.checks) {
        try {
          const result = await checkFn();
          result.timestamp = new Date().toISOString();
          result.name = name;
          console.log('Health check:', JSON.stringify(result));
        } catch (error) {
          console.error(`Health check failed for ${name}:`, error);
        }
      }
    }, this.checkInterval);
  }

  /**
   * Get health status of all checks
   */
  async getHealthStatus() {
    const results = {};
    let allHealthy = true;

    for (const [name, checkFn] of this.checks) {
      try {
        const result = await checkFn();
        results[name] = {
          status: result.status || 'healthy',
          ...result
        };
        
        if (result.status === 'unhealthy') {
          allHealthy = false;
        }
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message
        };
        allHealthy = false;
      }
    }

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: results
    };
  }
}

/**
 * Request logging and tracing
 */
export class RequestTracer {
  constructor(metrics) {
    this.metrics = metrics;
  }

  /**
   * Middleware for request tracing
   */
  trace() {
    return async (c, next) => {
      const requestId = c.get('requestId') || crypto.randomUUID();
      const startTime = Date.now();
      const path = c.req.path;
      const method = c.req.method;

      // Add request context
      c.set('requestId', requestId);
      c.set('startTime', startTime);

      try {
        await next();

        const duration = Date.now() - startTime;
        const status = c.res.status;

        // Record metrics
        this.metrics.recordTiming('http_request_duration', duration, {
          method,
          path: this.sanitizePath(path),
          status: String(status)
        });

        this.metrics.increment('http_requests_total', 1, {
          method,
          status: String(status)
        });

        // Log request
        console.log(JSON.stringify({
          type: 'request',
          requestId,
          method,
          path,
          status,
          duration,
          timestamp: new Date().toISOString()
        }));

      } catch (error) {
        const duration = Date.now() - startTime;

        this.metrics.recordTiming('http_request_duration', duration, {
          method,
          path: this.sanitizePath(path),
          status: '500'
        });

        this.metrics.increment('http_requests_total', 1, {
          method,
          status: '500'
        });

        this.metrics.increment('http_errors_total', 1, {
          method,
          error: error.name
        });

        console.log(JSON.stringify({
          type: 'error',
          requestId,
          method,
          path,
          error: error.message,
          duration,
          timestamp: new Date().toISOString()
        }));

        throw error;
      }
    };
  }

  /**
   * Sanitize path for metrics (remove IDs)
   */
  sanitizePath(path) {
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }
}

/**
 * Error tracking service (Sentry-like)
 */
export class ErrorTracker {
  constructor(options = {}) {
    this.dsn = options.dsn;
    this.environment = options.environment || 'development';
    this.release = options.release || 'unknown';
    this.beforeSend = options.beforeSend;
    this.errorQueue = [];
  }

  /**
   * Capture an exception
   */
  async captureException(error, context = {}) {
    const errorEvent = {
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      environment: this.environment,
      release: this.release,
      exception: {
        values: [{
          type: error.name,
          value: error.message,
          stacktrace: {
            frames: this.parseStack(error.stack)
          }
        }]
      },
      contexts: {
        ...context,
        runtime: {
          name: 'Cloudflare Workers',
          version: 'unknown'
        }
      }
    };

    // Apply beforeSend hook if provided
    if (this.beforeSend) {
      const processed = await this.beforeSend(errorEvent, { originalException: error });
      if (!processed) return null; // Drop the event
      Object.assign(errorEvent, processed);
    }

    // Queue for sending
    this.errorQueue.push(errorEvent);

    // Log immediately
    console.error('Error captured:', {
      eventId: errorEvent.event_id,
      error: error.message,
      context
    });

    return errorEvent.event_id;
  }

  /**
   * Capture a message
   */
  async captureMessage(message, level = 'info', context = {}) {
    const messageEvent = {
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      environment: this.environment,
      release: this.release,
      message,
      level,
      contexts: context
    };

    this.errorQueue.push(messageEvent);
    console.log(`[${level.toUpperCase()}] ${message}`);

    return messageEvent.event_id;
  }

  /**
   * Parse stack trace
   */
  parseStack(stack) {
    if (!stack) return [];

    return stack.split('\n').slice(1).map(line => {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        return {
          function: match[1],
          filename: match[2],
          lineno: parseInt(match[3]),
          colno: parseInt(match[4])
        };
      }
      return { raw: line.trim() };
    }).slice(0, 50); // Limit to 50 frames
  }

  /**
   * Flush error queue
   */
  async flush() {
    if (this.errorQueue.length === 0 || !this.dsn) {
      return;
    }

    const events = [...this.errorQueue];
    this.errorQueue = [];

    // In production, send to Sentry or similar service
    // For now, just log
    console.log(`Flushing ${events.length} error events`);
  }
}

/**
 * Create monitoring service instance
 */
export function createMonitoringService(options = {}) {
  const metrics = new MetricsCollector();
  const tracer = new RequestTracer(metrics);
  const errorTracker = new ErrorTracker(options.errorTracking);
  
  return {
    metrics,
    tracer,
    errorTracker,
    
    /**
     * Get monitoring middleware
     */
    middleware() {
      return tracer.trace();
    },
    
    /**
     * Get health check endpoint handler
     */
    healthEndpoint(healthChecker) {
      return async (c) => {
        const health = await healthChecker.getHealthStatus();
        const status = health.status === 'healthy' ? 200 : 503;
        return c.json(health, status);
      };
    },
    
    /**
     * Get metrics endpoint handler
     */
    metricsEndpoint() {
      return async (c) => {
        const allMetrics = metrics.getAllMetrics();
        return c.json({
          timestamp: new Date().toISOString(),
          metrics: allMetrics
        });
      };
    }
  };
}
