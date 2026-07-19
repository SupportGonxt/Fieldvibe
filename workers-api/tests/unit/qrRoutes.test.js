import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import qrRoutes, { handleScan } from '../../src/routes/field-ops/qr.js';
import { makeD1 } from './helpers/d1sqlite.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION = readFileSync(join(__dirname, '../../../migrations/0022_qr_tracking.sql'), 'utf8');

// Minimal companions the routes touch (real schema is applied via migrations in prod).
const AUX = `
CREATE TABLE process_flow_steps (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, process_flow_id TEXT NOT NULL,
  step_key TEXT NOT NULL, step_label TEXT, step_order INTEGER DEFAULT 0,
  is_required INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, config TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE users (id TEXT PRIMARY KEY, tenant_id TEXT, first_name TEXT, last_name TEXT);
`;

const ENV = (db) => ({ DB: db, SCAN_BASE_URL: 'https://scan.test' });

function buildApp(db) {
  const api = new Hono();
  api.use('*', async (c, next) => {
    c.set('tenantId', c.req.header('x-test-tenant') || 't1');
    c.set('userId', c.req.header('x-test-user') || 'agent-1');
    c.set('role', c.req.header('x-test-role') || 'admin');
    await next();
  });
  api.route('/field-ops', qrRoutes);
  const app = new Hono();
  app.route('/api', api);
  app.get('/s/:token', handleScan);
  return app;
}

function seedStep(db, { pf = 'pf1', tenant = 't1', dest = 'https://promo.example.com/signup' } = {}) {
  db._sdb.exec(
    `INSERT INTO process_flow_steps (id, tenant_id, process_flow_id, step_key, step_label, config)
     VALUES ('${pf}-s', '${tenant}', '${pf}', 'qr', 'QR', '{"destination_url":"${dest}"}')`,
  );
}

const post = (app, db, path, body, headers = {}) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body || {}),
  }, ENV(db));

const get = (app, db, path, headers = {}) => app.request(path, { headers }, ENV(db));

let db;
let app;
beforeEach(() => {
  db = makeD1(MIGRATION + AUX);
  app = buildApp(db);
});

describe('POST /qr/issue', () => {
  it('mints an active code with a scan_url pointing at the destination', async () => {
    seedStep(db);
    const res = await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pf1', visit_id: 'v1' });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.token).toMatch(/^[A-Za-z0-9_-]{22,}$/);
    expect(data.scan_url).toBe(`https://scan.test/s/${data.token}`);
    expect(data.destination_url).toBe('https://promo.example.com/signup');

    const row = await db.prepare('SELECT status, visit_id, agent_id FROM qr_codes WHERE id = ?').bind(data.id).first();
    expect(row.status).toBe('active');
    expect(row.visit_id).toBe('v1');
    expect(row.agent_id).toBe('agent-1');
  });

  it('lets a field agent (not just admin) issue a code', async () => {
    seedStep(db);
    const res = await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pf1' }, { 'x-test-role': 'agent' });
    expect(res.status).toBe(200);
  });

  it('400s when the step has no destination configured', async () => {
    db._sdb.exec(
      `INSERT INTO process_flow_steps (id, tenant_id, process_flow_id, step_key, step_label, config)
       VALUES ('s', 't1', 'pf1', 'qr', 'QR', '{}')`,
    );
    const res = await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pf1' });
    expect(res.status).toBe(400);
  });

  it('400s when the destination is an unsafe scheme', async () => {
    seedStep(db, { dest: 'javascript:alert(1)' });
    const res = await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pf1' });
    expect(res.status).toBe(400);
  });

  it('400s without process_flow_id', async () => {
    const res = await post(app, db, '/api/field-ops/qr/issue', {});
    expect(res.status).toBe(400);
  });
});

describe('GET /s/:token (public scan)', () => {
  async function issue() {
    seedStep(db);
    const { data } = await (await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pf1' })).json();
    return data;
  }

  it('first scan redirects, records a redemption, and marks the code redeemed', async () => {
    const { id, token } = await issue();
    const res = await get(app, db, `/s/${token}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://promo.example.com/signup');

    const code = await db.prepare('SELECT status FROM qr_codes WHERE id = ?').bind(id).first();
    expect(code.status).toBe('redeemed');
    const ev = await db.prepare('SELECT COUNT(*) n, COALESCE(SUM(is_redemption),0) r FROM qr_scan_events WHERE qr_code_id = ?').bind(id).first();
    expect(ev.n).toBe(1);
    expect(ev.r).toBe(1);
  });

  it('second scan still redirects but is not a redemption', async () => {
    const { id, token } = await issue();
    await get(app, db, `/s/${token}`);
    const res2 = await get(app, db, `/s/${token}`);
    expect(res2.status).toBe(302);
    const ev = await db.prepare('SELECT COUNT(*) n, COALESCE(SUM(is_redemption),0) r FROM qr_scan_events WHERE qr_code_id = ?').bind(id).first();
    expect(ev.n).toBe(2);
    expect(ev.r).toBe(1); // still just one person
  });

  it('unknown token returns 404', async () => {
    const res = await get(app, db, '/s/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('revoked code returns 410 and does not redirect', async () => {
    const { id, token } = await issue();
    db._sdb.exec(`UPDATE qr_codes SET status = 'revoked' WHERE id = '${id}'`);
    const res = await get(app, db, `/s/${token}`);
    expect(res.status).toBe(410);
  });
});

describe('POST /qr/:id/reroll', () => {
  it('issues a fresh code and revokes the old active one (old token then 410s)', async () => {
    seedStep(db);
    const { data: first } = await (await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pf1' })).json();
    const res = await post(app, db, `/api/field-ops/qr/${first.id}/reroll`, {});
    expect(res.status).toBe(200);
    const { data: second } = await res.json();
    expect(second.id).not.toBe(first.id);
    expect(second.token).not.toBe(first.token);

    const old = await db.prepare('SELECT status, superseded_by FROM qr_codes WHERE id = ?').bind(first.id).first();
    expect(old.status).toBe('revoked');
    expect(old.superseded_by).toBe(second.id);

    const scanOld = await get(app, db, `/s/${first.token}`);
    expect(scanOld.status).toBe(410);
    const scanNew = await get(app, db, `/s/${second.token}`);
    expect(scanNew.status).toBe(302);
  });

  it('404s for an unknown code', async () => {
    const res = await post(app, db, '/api/field-ops/qr/nope/reroll', {});
    expect(res.status).toBe(404);
  });
});

describe('GET /qr/step-stats', () => {
  it('reports codes_generated, people_reached, and total_scans, scoped to the tenant', async () => {
    seedStep(db, { tenant: 't1' });
    seedStep(db, { pf: 'pf2', tenant: 't2' });

    // t1: two codes, one scanned twice (1 person, 2 scans)
    const a = (await (await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pf1' })).json()).data;
    await (await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pf1' })).json();
    await get(app, db, `/s/${a.token}`);
    await get(app, db, `/s/${a.token}`);

    // t2: one code, scanned once — must NOT leak into t1 stats
    const other = (await (await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pf2' }, { 'x-test-tenant': 't2' })).json()).data;
    await get(app, db, `/s/${other.token}`);

    const res = await get(app, db, '/api/field-ops/qr/step-stats?process_flow_id=pf1');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.codes_generated).toBe(2);
    expect(data.people_reached).toBe(1);
    expect(data.total_scans).toBe(2);
    expect(data.recent.length).toBe(2);
  });

  it('403s for a field agent', async () => {
    const res = await get(app, db, '/api/field-ops/qr/step-stats?process_flow_id=pf1', { 'x-test-role': 'agent' });
    expect(res.status).toBe(403);
  });
});

describe('GET /qr/by-agent', () => {
  it('groups redemptions and scans per agent with a display name', async () => {
    seedStep(db);
    db._sdb.exec(`INSERT INTO users (id, tenant_id, first_name, last_name) VALUES ('agent-1', 't1', 'Ada', 'Agent')`);
    const c1 = (await (await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pf1' }, { 'x-test-user': 'agent-1' })).json()).data;
    await get(app, db, `/s/${c1.token}`);
    await get(app, db, `/s/${c1.token}`);

    const res = await get(app, db, '/api/field-ops/qr/by-agent');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    const row = data.agents.find((r) => r.agent_id === 'agent-1');
    expect(row.agent_name).toBe('Ada Agent');
    expect(row.total_scans).toBe(2);
    expect(row.people_reached).toBe(1);
  });

  it('scopes to a process_flow_id when given', async () => {
    seedStep(db, { pf: 'pfA' });
    seedStep(db, { pf: 'pfB' });
    const a = (await (await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pfA' })).json()).data;
    const b = (await (await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pfB' })).json()).data;
    await get(app, db, `/s/${a.token}`);
    await get(app, db, `/s/${b.token}`);

    const res = await get(app, db, '/api/field-ops/qr/by-agent?process_flow_id=pfA');
    const { data } = await res.json();
    const total = data.agents.reduce((n, r) => n + r.total_scans, 0);
    expect(total).toBe(1); // only pfA's scan, not pfB's
  });
});

describe('GET /qr/summary', () => {
  it('returns totals and a daily series scoped to the tenant', async () => {
    seedStep(db);
    const c1 = (await (await post(app, db, '/api/field-ops/qr/issue', { process_flow_id: 'pf1' })).json()).data;
    await get(app, db, `/s/${c1.token}`);
    const res = await get(app, db, '/api/field-ops/qr/summary');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.codes_generated).toBe(1);
    expect(data.people_reached).toBe(1);
    expect(data.total_scans).toBe(1);
    expect(data.series.length).toBe(1);
  });
});
