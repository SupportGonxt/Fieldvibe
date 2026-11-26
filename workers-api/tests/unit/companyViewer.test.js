import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../../src/lib/middleware.js';
import { generateToken } from '../../src/lib/authUtils.js';

// company_viewer is deny-by-default: only its own company's Stores report reads.

const SECRET = 'test-secret';
const DIPLOMAT = 'co-diplomat';
const GOLDRUSH = 'co-goldrush';

// D1 stub: the viewer link and one Diplomat visit.
const fakeDb = {
  prepare: (sql) => ({
    bind: (...args) => ({
      first: async () => {
        if (sql.includes('company_viewer_links')) return args[0] === 'viewer-1' ? { company_id: DIPLOMAT } : null;
        if (sql.includes('FROM visits')) return args[0] === 'visit-dip' && args[2] === DIPLOMAT ? { id: 'visit-dip' } : null;
        return null;
      },
      all: async () => ({ results: [] }),
      run: async () => ({}),
    }),
  }),
};

function buildApp() {
  const api = new Hono();
  api.use('*', authMiddleware);
  api.all('*', (c) => c.json({ ok: true }));
  const app = new Hono();
  app.route('/api', api);
  return app;
}

const env = { JWT_SECRET: SECRET, DB: fakeDb };
const call = async (path, { role = 'company_viewer', userId = 'viewer-1', method = 'GET' } = {}) => {
  const token = await generateToken({ userId, tenantId: 't1', role }, SECRET);
  return (await buildApp().request(path, { method, headers: { Authorization: `Bearer ${token}` } }, env)).status;
};

describe('company_viewer gate', () => {
  it('reads its own company stores report', async () => {
    expect(await call(`/api/field-ops/reports/goldrush-stores?company_id=${DIPLOMAT}`)).toBe(200);
    expect(await call(`/api/field-ops/reports/goldrush-stores/insights?company_id=${DIPLOMAT}&startDate=2026-11-01`)).toBe(200);
    expect(await call(`/api/field-ops/config?company_id=${DIPLOMAT}`)).toBe(200);
    expect(await call('/api/field-ops/companies')).toBe(200);
    expect(await call('/api/auth/me')).toBe(200);
  });

  it('cannot read another company or omit the company', async () => {
    expect(await call(`/api/field-ops/reports/goldrush-stores?company_id=${GOLDRUSH}`)).toBe(403);
    expect(await call('/api/field-ops/reports/goldrush-stores/insights')).toBe(403);
    expect(await call(`/api/field-ops/config?company_id=${GOLDRUSH}`)).toBe(403);
  });

  it('reads visit detail only for its own company visits', async () => {
    expect(await call('/api/field-ops/reports/visit-answers/visit-dip')).toBe(200);
    expect(await call('/api/visits/visit-dip/photos')).toBe(200);
    expect(await call('/api/field-ops/reports/visit-answers/visit-gold')).toBe(403);
    expect(await call('/api/visits/visit-gold/photos')).toBe(403);
  });

  it('is denied everything else, including writes', async () => {
    expect(await call('/api/users')).toBe(403);
    expect(await call('/api/field-ops/reports/goldrush-individuals')).toBe(403);
    expect(await call(`/api/field-ops/reports/stellr?company_id=${DIPLOMAT}`)).toBe(403);
    expect(await call('/api/visit-photos/ai-backfill', { method: 'POST' })).toBe(403);
    expect(await call('/api/field-ops/reports/goldrush-stores', { method: 'POST' })).toBe(403);
  });

  it('a viewer with no company link is denied', async () => {
    expect(await call(`/api/field-ops/reports/goldrush-stores?company_id=${DIPLOMAT}`, { userId: 'viewer-2' })).toBe(403);
  });

  it('other roles are unaffected', async () => {
    expect(await call('/api/users', { role: 'admin', userId: 'a1' })).toBe(200);
  });
});
