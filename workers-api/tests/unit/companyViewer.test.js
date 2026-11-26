import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../../src/lib/middleware.js';
import { generateToken } from '../../src/lib/authUtils.js';

// company_viewer is deny-by-default: only its own company's visit photo review.

const SECRET = 'test-secret';
const DIPLOMAT = 'co-diplomat';
const GOLDRUSH = 'co-goldrush';

// D1 stub: only the viewer link matters to the gate.
const fakeDb = {
  prepare: (sql) => ({
    bind: (...args) => ({
      first: async () => (sql.includes('company_viewer_links') && args[0] === 'viewer-1' ? { company_id: DIPLOMAT } : null),
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
  it('reads its own company photo review', async () => {
    expect(await call(`/api/field-ops/reports/visit-photos?company_id=${DIPLOMAT}`)).toBe(200);
    expect(await call(`/api/field-ops/reports/visit-photos?company_id=${DIPLOMAT}&startDate=2026-11-01&page=2`)).toBe(200);
    expect(await call('/api/field-ops/companies')).toBe(200);
    expect(await call('/api/auth/me')).toBe(200);
  });

  it('cannot read another company or omit the company', async () => {
    expect(await call(`/api/field-ops/reports/visit-photos?company_id=${GOLDRUSH}`)).toBe(403);
    expect(await call('/api/field-ops/reports/visit-photos')).toBe(403);
  });

  it('is denied everything else, including writes and the old stores report', async () => {
    expect(await call('/api/users')).toBe(403);
    expect(await call(`/api/field-ops/reports/goldrush-stores?company_id=${DIPLOMAT}`)).toBe(403);
    expect(await call('/api/visit-photos/admin-review')).toBe(403);
    expect(await call('/api/visit-photos/p1/approve', { method: 'POST' })).toBe(403);
    expect(await call(`/api/field-ops/reports/visit-photos?company_id=${DIPLOMAT}`, { method: 'POST' })).toBe(403);
  });

  it('a viewer with no company link is denied', async () => {
    expect(await call(`/api/field-ops/reports/visit-photos?company_id=${DIPLOMAT}`, { userId: 'viewer-2' })).toBe(403);
  });

  it('other roles are unaffected', async () => {
    expect(await call('/api/users', { role: 'admin', userId: 'a1' })).toBe(200);
  });
});
