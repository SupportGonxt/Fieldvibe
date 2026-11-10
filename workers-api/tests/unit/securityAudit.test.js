import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../../src/lib/middleware.js';
import { generateToken } from '../../src/lib/authUtils.js';
import authRoutes from '../../src/routes/auth.js';
import userRoutes from '../../src/routes/coreCrud/users.js';
import platformRoutes from '../../src/routes/platform.js';
import fieldOpsRoutes from '../../src/routes/fieldOps.js';
import { stripServerOnlyKeys } from '../../src/routes/coreCrud/visits.js';

// Regression guards for the October 2026 security audit. Each block pins one hole that let
// an outsider or a low-privilege role escalate: public sign-up as admin, admin -> super_admin,
// cross-tenant super_admin tokens, refresh/portal tokens accepted as staff tokens, agents
// reading credential hashes or editing commission config, and agents marking their own
// signups qualified.

const SECRET = 'test-secret';
const token = (claims) => generateToken({ userId: 'u1', tenantId: 't1', ...claims }, SECRET);

// D1 stub: `rows(sql, binds)` decides what first()/all() return; every write is recorded.
function makeDb(rows = () => null) {
  const writes = [];
  const db = {
    writes,
    prepare: (sql) => ({
      bind: (...binds) => ({
        first: async () => rows(sql, binds),
        all: async () => ({ results: [] }),
        run: async () => { writes.push({ sql, binds }); return {}; },
      }),
    }),
    batch: async () => [],
  };
  return db;
}

function buildApi(...modules) {
  const api = new Hono();
  api.use('*', authMiddleware);
  for (const m of modules) api.route('/', m);
  const app = new Hono();
  app.route('/', authRoutes);
  app.route('/api', api);
  return app;
}

async function call(app, path, { method = 'GET', claims, body, headers = {}, db = makeDb() } = {}) {
  const h = { ...headers };
  if (claims) h.Authorization = `Bearer ${await token(claims)}`;
  if (body) h['Content-Type'] = 'application/json';
  return app.request(path, { method, headers: h, body: body && JSON.stringify(body) }, { JWT_SECRET: SECRET, DB: db });
}

describe('authMiddleware only accepts staff access tokens', () => {
  const app = (() => {
    const api = new Hono();
    api.use('*', authMiddleware);
    api.get('/ping', (c) => c.json({ ok: true }));
    const root = new Hono();
    root.route('/api', api);
    return root;
  })();

  it('accepts a staff access token', async () => {
    expect((await call(app, '/api/ping', { claims: { role: 'agent' } })).status).toBe(200);
  });

  it('rejects a refresh token used as an access token', async () => {
    expect((await call(app, '/api/ping', { claims: { role: 'admin', type: 'refresh' } })).status).toBe(401);
  });

  it('rejects company-portal and customer-portal tokens', async () => {
    expect((await call(app, '/api/ping', { claims: { role: 'company_admin', companyId: 'c1' } })).status).toBe(401);
    expect((await call(app, '/api/ping', { claims: { aud: 'portal', companyId: 'c1' } })).status).toBe(401);
  });

  it('accepts ?access_token= only on a WebSocket upgrade', async () => {
    const t = await token({ role: 'agent' });
    const env = { JWT_SECRET: SECRET, DB: makeDb() };
    expect((await app.request(`/api/ping?access_token=${t}`, {}, env)).status).toBe(401);
    expect((await app.request(`/api/ping?access_token=${t}`, { headers: { Upgrade: 'websocket' } }, env)).status).toBe(200);
  });
});

describe('public registration', () => {
  it('is disabled and writes nothing', async () => {
    const db = makeDb(() => ({ id: 'live-tenant' }));
    const res = await call(buildApi(), '/api/auth/register', {
      method: 'POST', db,
      body: { email: 'x@evil.test', password: 'password123', firstName: 'X', lastName: 'Y', tenantCode: 'DEMO' },
    });
    expect(res.status).toBe(403);
    expect(db.writes).toEqual([]);
  });
});

describe('user role changes', () => {
  const app = buildApi(userRoutes);

  it('a tenant admin cannot grant super_admin, including to themselves', async () => {
    const db = makeDb(() => ({ role: 'admin' }));
    const res = await call(app, '/api/users/u1', { method: 'PUT', claims: { role: 'admin' }, body: { role: 'super_admin' }, db });
    expect(res.status).toBe(400);
    expect(db.writes).toEqual([]);
  });

  it('a tenant admin cannot edit or reset a super_admin account', async () => {
    const db = makeDb(() => ({ role: 'super_admin' }));
    expect((await call(app, '/api/users/sa', { method: 'PUT', claims: { role: 'admin' }, body: { email: 'me@evil.test' }, db })).status).toBe(403);
    expect((await call(app, '/api/users/sa/reset-password', { method: 'POST', claims: { role: 'admin' }, db })).status).toBe(403);
    expect((await call(app, '/api/users/sa/quick-edit', { method: 'PATCH', claims: { role: 'admin' }, body: { email: 'me@evil.test' }, db })).status).toBe(403);
    expect(db.writes).toEqual([]);
  });

  it('a tenant admin can still assign tenant roles', async () => {
    const db = makeDb(() => ({ role: 'agent' }));
    const res = await call(app, '/api/users/u2', { method: 'PUT', claims: { role: 'admin' }, body: { role: 'team_lead' }, db });
    expect(res.status).toBe(200);
  });
});

describe('cross-tenant assignments', () => {
  const app = buildApi(platformRoutes);

  it('are managed by super admins only', async () => {
    const body = { user_id: 'u1', tenant_id: 'other-tenant', role_override: 'admin' };
    expect((await call(app, '/api/cross-tenant/assignments', { method: 'POST', claims: { role: 'admin' }, body })).status).toBe(403);
    expect((await call(app, '/api/cross-tenant/assignments', { method: 'GET', claims: { role: 'admin' } })).status).toBe(403);
  });

  it('can never carry super_admin', async () => {
    const body = { user_id: 'u1', tenant_id: 'other-tenant', role_override: 'super_admin' };
    expect((await call(app, '/api/cross-tenant/assignments', { method: 'POST', claims: { role: 'super_admin' }, body })).status).toBe(400);
  });

  it('/switch refuses a legacy super_admin assignment', async () => {
    const db = makeDb((sql) => (sql.includes('agent_company_assignments') ? { role_override: 'super_admin' } : { id: 'u1', role: 'admin' }));
    expect((await call(app, '/api/cross-tenant/switch', { method: 'POST', claims: { role: 'admin' }, body: { tenant_id: 'other-tenant' }, db })).status).toBe(403);
  });
});

describe('field agents', () => {
  const app = buildApi(fieldOpsRoutes);

  it('never receive credential hashes from the agent detail endpoint', async () => {
    const db = makeDb((sql) => (sql.includes('FROM users') ? { id: 'a1', first_name: 'A', password_hash: '$2a$x', pin_hash: '$2a$y' } : { count: 0 }));
    const res = await call(app, '/api/field-operations/agents/a1', { claims: { role: 'agent' }, db });
    const json = await res.json();
    expect(json.first_name).toBe('A');
    expect(json).not.toHaveProperty('password_hash');
    expect(json).not.toHaveProperty('pin_hash');
  });

  it('cannot change commission tiers or field-ops settings', async () => {
    expect((await call(app, '/api/field-ops/commission-tiers', { method: 'POST', claims: { role: 'agent' }, body: { commission_rate: 99 } })).status).toBe(403);
    expect((await call(app, '/api/field-ops/settings', { method: 'PUT', claims: { role: 'field_agent' }, body: {} })).status).toBe(403);
  });

  it("cannot edit another agent's visit", async () => {
    const db = makeDb(() => ({ agent_id: 'someone-else' }));
    const res = await call(app, '/api/field-operations/visits/v1', { method: 'PUT', claims: { role: 'agent' }, body: { status: 'completed' }, db });
    expect(res.status).toBe(404);
    expect(db.writes).toEqual([]);
  });

  it('cannot set verification_status at capture', () => {
    expect(stripServerOnlyKeys({ goldrush_id: '123456789', verification_status: 'qualified', consumer_converted: 'Yes' }))
      .toEqual({ goldrush_id: '123456789', consumer_converted: 'Yes' });
  });
});
