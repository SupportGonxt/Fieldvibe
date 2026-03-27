# FieldVibe Testing Guide

**Best-in-World Testing Strategy**  
**Last Updated:** 2026-03-27

---

## Overview

This guide outlines the comprehensive testing strategy for FieldVibe, ensuring best-in-world quality across all components.

### Test Pyramid

```
        /\
       /  \      E2E Tests (10%)
      /____\    
     /      \   Integration Tests (20%)
    /________\  
   /          \ Unit Tests (70%)
  /____________\
```

---

## Testing Infrastructure

### Tools & Frameworks

| Component | Tool | Purpose |
|-----------|------|---------|
| Unit Tests | Vitest | Fast, parallel unit testing |
| Integration Tests | Vitest + wrangler | API integration testing |
| E2E Tests | Playwright | Browser automation |
| Visual Tests | Percy | Visual regression |
| Performance | k6 | Load testing |
| Security | OWASP ZAP | Security scanning |
| Coverage | c8/v8 | Code coverage |

### Test Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:performance": "k6 run tests/performance",
    "test:security": "zap-cli quick-scan http://localhost:8787"
  }
}
```

---

## Unit Testing

### Guidelines

1. **Test one thing per test**
2. **Use descriptive test names**
3. **Arrange-Act-Assert pattern**
4. **Mock external dependencies**
5. **Test edge cases**

### Example: Service Test

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VisitService } from '../src/services/visitService.js';

describe('VisitService', () => {
  let mockDb;
  let visitService;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(),
      batch: vi.fn()
    };
    visitService = new VisitService(mockDb);
  });

  describe('createVisit', () => {
    it('should create a visit with valid data', async () => {
      const visitData = {
        tenantId: 'tenant-123',
        agentId: 'agent-456',
        customerId: 'customer-789',
        visitType: 'store',
        scheduledAt: '2026-03-28T10:00:00Z'
      };

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ success: true })
        })
      });

      const result = await visitService.createVisit(visitData);

      expect(result.success).toBe(true);
      expect(result.visit).toBeDefined();
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should fail with invalid visit type', async () => {
      const visitData = {
        ...validData,
        visitType: 'invalid'
      };

      const result = await visitService.createVisit(visitData);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should include individual registration for individual visits', async () => {
      const visitData = {
        ...validData,
        visitType: 'individual',
        individualData: {
          name: 'John Doe',
          phone: '+1234567890'
        }
      };

      const result = await visitService.createVisit(visitData);

      expect(result.success).toBe(true);
      expect(result.individualRegistration).toBeDefined();
    });
  });
});
```

### Coverage Requirements

| Component | Minimum Coverage |
|-----------|-----------------|
| Services | 90% |
| Middleware | 95% |
| Utils | 85% |
| Routes | 80% |
| **Overall** | **85%** |

---

## Integration Testing

### API Integration Tests

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/index.js';

describe('API Integration', () => {
  let app;
  let mockEnv;

  beforeEach(() => {
    mockEnv = {
      DB: createMockDB(),
      JWT_SECRET: 'test-secret'
    };
    app = createApp(mockEnv);
  });

  describe('GET /api/v1/field-ops/visits', () => {
    it('should return visits with valid auth', async () => {
      const token = generateTestToken({ role: 'agent' });
      
      const response = await app.request('/api/v1/field-ops/visits', {
        headers: { Authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should reject requests without auth', async () => {
      const response = await app.request('/api/v1/field-ops/visits');

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should filter visits by status', async () => {
      const token = generateTestToken({ role: 'agent' });
      
      const response = await app.request('/api/v1/field-ops/visits?status=completed', {
        headers: { Authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      data.data.forEach(visit => {
        expect(visit.status).toBe('completed');
      });
    });
  });

  describe('POST /api/v1/field-ops/visits', () => {
    it('should create visit with valid data', async () => {
      const token = generateTestToken({ role: 'agent' });
      
      const response = await app.request('/api/v1/field-ops/visits', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: 'agent-123',
          customerId: 'customer-456',
          visitType: 'store',
          scheduledAt: '2026-03-28T10:00:00Z'
        })
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.visit).toBeDefined();
    });

    it('should validate required fields', async () => {
      const token = generateTestToken({ role: 'agent' });
      
      const response = await app.request('/api/v1/field-ops/visits', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing required fields
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

### Database Integration Tests

```javascript
describe('Database Integration', () => {
  it('should persist visits to database', async () => {
    const visitService = new VisitService(testDB);
    
    const visit = await visitService.createVisit({
      tenantId: 'tenant-123',
      agentId: 'agent-456',
      visitType: 'store'
    });

    // Verify in database
    const retrieved = await testDB
      .prepare('SELECT * FROM visits WHERE id = ?')
      .bind(visit.visit.id)
      .first();

    expect(retrieved).toBeDefined();
    expect(retrieved.agent_id).toBe('agent-456');
  });

  it('should maintain data integrity with transactions', async () => {
    // Test transactional behavior
  });
});
```

---

## End-to-End (E2E) Testing

### Critical User Journeys

1. **Authentication Flow**
   - Login with valid credentials
   - Login with invalid credentials
   - Password reset
   - MFA verification

2. **Visit Management**
   - Create visit
   - Complete visit with survey
   - Upload photos
   - View visit history

3. **Van Sales**
   - Create order
   - Process payment
   - Generate invoice
   - Update inventory

4. **Commission Calculation**
   - View commission dashboard
   - Calculate monthly commission
   - Request payout
   - View payment history

### Playwright Example

```javascript
import { test, expect } from '@playwright/test';

test.describe('Visit Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'agent@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create and complete a visit', async ({ page }) => {
    // Navigate to visits
    await page.click('[data-testid="nav-visits"]');
    await page.waitForURL('/visits');

    // Create new visit
    await page.click('[data-testid="create-visit"]');
    await page.fill('[data-testid="customer"]', 'Test Customer');
    await page.selectOption('[data-testid="visit-type"]', 'store');
    await page.click('[data-testid="submit"]');

    // Verify visit created
    await page.waitForSelector('[data-testid="visit-success"]');
    
    // Complete visit
    await page.click('[data-testid="complete-visit"]');
    await page.fill('[data-testid="notes"]', 'Visit completed successfully');
    await page.click('[data-testid="submit-completion"]');

    // Verify completion
    await expect(page.locator('[data-testid="status"]')).toContainText('Completed');
  });

  test('should upload photos during visit', async ({ page }) => {
    // Navigate to visit
    await page.goto('/visits/visit-123');
    
    // Upload photo
    const fileInput = page.locator('[data-testid="photo-upload"]');
    await fileInput.setInputFiles('test-photo.jpg');
    
    // Verify upload
    await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible();
  });
});
```

---

## Performance Testing

### k6 Load Test

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
    errors: ['rate<0.1'],              // Custom error rate < 10%
  },
};

export default function () {
  const token = authenticate();
  
  // Test visits endpoint
  const res = http.get('https://fieldvibe.vantax.co.za/api/v1/field-ops/visits', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has data': (r) => JSON.parse(r.body).data !== undefined,
  });
  
  errorRate.add(!success);
  sleep(1);
}

function authenticate() {
  const res = http.post('https://fieldvibe.vantax.co.za/api/v1/auth/login', {
    email: 'test@example.com',
    password: 'password123'
  });
  
  check(res, {
    'auth status is 200': (r) => r.status === 200,
  });
  
  return JSON.parse(res.body).data.access_token;
}
```

### Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| API Response Time (p50) | <100ms | <200ms |
| API Response Time (p95) | <200ms | <500ms |
| API Response Time (p99) | <500ms | <1000ms |
| Page Load Time | <2s | <5s |
| Time to Interactive | <3s | <8s |
| Error Rate | <0.1% | <1% |
| Throughput | 1000 req/s | 100 req/s |

---

## Security Testing

### OWASP Top 10 Tests

```javascript
describe('Security Tests', () => {
  describe('SQL Injection', () => {
    it('should reject SQL injection in login', async () => {
      const response = await app.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: "admin' OR '1'='1",
          password: "password"
        })
      });

      expect(response.status).toBe(401);
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize user input', async () => {
      const maliciousInput = '<script>alert("xss")</script>';
      
      const response = await app.request('/api/v1/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: maliciousInput })
      });

      const data = await response.json();
      expect(data.data.notes).not.toContain('<script>');
    });
  });

  describe('Authentication', () => {
    it('should enforce rate limiting', async () => {
      // Make 100 requests rapidly
      const promises = Array(100).fill().map(() => 
        app.request('/auth/login', { method: 'POST' })
      );
      
      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);
      
      expect(rateLimited).toBe(true);
    });

    it('should lock account after failed attempts', async () => {
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await app.request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'wrong'
          })
        });
      }

      // Next attempt should be locked
      const response = await app.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'correct'
        })
      });

      expect(response.status).toBe(423); // Locked
    });
  });
});
```

---

## Accessibility Testing

### axe-core Integration

```javascript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('should not have accessibility violations on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/visits');
    
    // Tab through all interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Check focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement);
    expect(focusedElement).toBeDefined();
  });
});
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
      
      - name: Run E2E tests
        uses: playwright-actio
