import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import financeRoutes from '../../src/routes/finance.js';
import { authMiddleware } from '../../src/lib/middleware.js';
import { generateToken } from '../../src/lib/authUtils.js';

// Guards the finance-gate scoping fix: finance.js used app.use('*', requireRole('admin')),
// which Hono merges into the parent when mounted via api.route('/', financeRoutes) —
// 403'ing every sibling route registered after finance (/notifications, /field-ops/*)
// for non-admin roles. The gate must apply only to finance's own path prefixes.

const SECRET = 'test-secret';
const tokenFor = (role) => generateToken({ userId: 'u1', tenantId: 't1', role }, SECRET);

// Minimal D1 stub so admin requests can reach finance handlers.
const fakeDb = {
  prepare: () => ({
    bind: () => ({
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => ({}),
    }),
  }),
};

// Mirrors index.js wiring: api-level auth, finance mounted before its siblings.
function buildApp() {
  const api = new Hono();
  api.use('*', authMiddleware);
  api.route('/', financeRoutes);
  api.get('/notifications', (c) => c.json({ ok: true }));
  const fieldOps = new Hono();
  fieldOps.get('/issues/mine', (c) => c.json({ ok: true }));
  api.route('/field-ops', fieldOps);
  const app = new Hono();
  app.route('/api', api);
  return app;
}

const env = { JWT_SECRET: SECRET, DB: fakeDb };
const get = async (app, path, role) =>
  app.request(path, { headers: { Authorization: `Bearer ${await tokenFor(role)}` } }, env);

describe('finance gate scope', () => {
  it('field roles reach sibling routes mounted after finance', async () => {
    const app = buildApp();
    for (const role of ['field_agent', 'team_lead', 'manager']) {
      expect((await get(app, '/api/notifications', role)).status).toBe(200);
      expect((await get(app, '/api/field-ops/issues/mine', role)).status).toBe(200);
    }
  });

  it('field roles still 403 on finance routes', async () => {
    const app = buildApp();
    for (const path of ['/api/finance/dashboard', '/api/payment-ledger', '/api/currency-system/dashboard']) {
      expect((await get(app, path, 'field_agent')).status).toBe(403);
    }
    expect((await get(app, '/api/finance', 'team_lead')).status).toBe(403);
  });

  it('admin-equivalents pass the finance gate', async () => {
    const app = buildApp();
    expect((await get(app, '/api/finance/invoices', 'admin')).status).toBe(200);
    expect((await get(app, '/api/finance/invoices', 'general_manager')).status).toBe(200);
  });
});
