/**
 * Drives the real report handlers over a real SQLite database and fails on any
 * statement whose bound-parameter count does not match its placeholder count.
 *
 * This is the check the unit tests around lib/agentScope.js cannot make. Swapping an
 * inlined `agent_id IN (?,?,?...)` list for a subquery changes how many parameters a
 * statement takes, and every one of those call sites splices the change into the middle
 * of an existing bind list. A miscount there does not throw at import time and often
 * does not throw at all — it silently binds the wrong value to the wrong slot and
 * returns plausible, wrong numbers. So the shim asserts arity on every prepare/bind,
 * and the tests dispatch actual HTTP requests through the actual Hono routers.
 *
 * The fixture uses 150 company agents and a 135-member team, both over D1's
 * 100-bound-parameter ceiling, so the pre-fix inlined form could not even run here.
 *
 * Runs in the node-env pool (npm run test:pure).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import reportRoutes from '../../src/routes/reports.js';
import fieldOpsPerformanceRoutes from '../../src/routes/fieldOpsPerformance.js';

const TENANT = 'ten1', COMPANY = 'c1', LEAD = 'tl1', ADMIN = 'admin1';
const JWT_SECRET = 'test-secret-not-a-real-key';
const N_AGENTS = 150;

// ── D1 shim with strict arity checking ──────────────────────────────────────
const violations = [];
let sqlite;

function countPlaceholders(sql) {
  // Strip single-quoted literals first so a '?' inside a string is not counted.
  return (sql.replace(/'(?:[^']|'')*'/g, "''").match(/\?/g) || []).length;
}

function makeD1() {
  const check = (sql, binds) => {
    const want = countPlaceholders(sql), got = binds.length;
    if (want !== got) violations.push(`expected ${want} params, got ${got}: ${sql.replace(/\s+/g, ' ').trim().slice(0, 150)}`);
  };
  const exec = (sql, binds) => {
    check(sql, binds);
    try {
      const st = sqlite.prepare(sql);
      return /^\s*(select|with)/i.test(sql) ? st.all(...binds) : (st.run(...binds), []);
    } catch (e) {
      violations.push(`SQL error: ${e.message} :: ${sql.replace(/\s+/g, ' ').trim().slice(0, 150)}`);
      return [];
    }
  };
  return {
    prepare(sql) {
      const st = { binds: [] };
      st.bind = (...a) => { st.binds = a; return st; };
      st._raw = () => exec(sql, st.binds);
      st.first = async () => st._raw()[0] ?? null;
      st.all = async () => ({ results: st._raw() });
      st.run = async () => { st._raw(); return { success: true }; };
      return st;
    },
    async batch(stmts) { return stmts.map(s => ({ results: s._raw() })); },
  };
}

function forgeToken(role, userId) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ userId, tenantId: TENANT, role, exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

async function call(routes, path, role = 'admin', userId = ADMIN) {
  const env = { DB: makeD1(), JWT_SECRET, ENVIRONMENT: 'test' };
  const res = await routes.fetch(
    new Request(`https://test.local${path}`, { headers: { Authorization: `Bearer ${forgeToken(role, userId)}` } }),
    env,
  );
  return { status: res.status, body: await res.json().catch(() => null) };
}

beforeAll(() => {
  sqlite = new DatabaseSync(':memory:');
  // node:sqlite enables foreign keys by default (the sqlite3 CLI does not), so the
  // schema's REFERENCES clauses would demand tables this fixture deliberately omits.
  sqlite.exec('PRAGMA foreign_keys = OFF');
  // Real schema for the tables these handlers touch.
  const schema = readFileSync(new URL('../../src/schema.sql', import.meta.url), 'utf8');
  const want = ['visits', 'visit_individuals', 'visit_photos', 'visit_responses', 'users', 'individuals',
    'customers', 'agent_company_links', 'company_custom_questions', 'monthly_targets', 'daily_targets',
    'company_target_rules', 'working_days_config', 'field_companies', 'survey_responses'];
  // With foreign keys off the REFERENCES clauses are inert and the DDL is usable verbatim. Creation failures are surfaced, not swallowed —
  // a silently missing table makes every assertion below meaningless.
  const missing = [];
  for (const t of want) {
    const m = schema.match(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? "?${t}"?\\s*\\([\\s\\S]*?\\n\\);`));
    if (!m) { missing.push(`${t}: not found in schema.sql`); continue; }
    try { sqlite.exec(m[0]); } catch (e) { missing.push(`${t}: ${e.message}`); }
  }
  // survey_responses is read by a route not under test and is not in schema.sql.
  sqlite.exec('CREATE TABLE IF NOT EXISTS survey_responses (id TEXT PRIMARY KEY, visit_id TEXT)');
  expect(missing.filter(m => !m.startsWith('survey_responses'))).toEqual([]);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS capture_failures (id TEXT PRIMARY KEY, tenant_id TEXT, visit_id TEXT,
      identifier_value TEXT, visit_date TEXT, agent_id TEXT);
    CREATE VIEW IF NOT EXISTS goldrush_upload_failures AS SELECT *, identifier_value AS goldrush_id FROM capture_failures;
  `);

  const cols = (t) => sqlite.prepare(`PRAGMA table_info(${t})`).all();
  const insert = (t, obj) => {
    const info = cols(t);
    for (const c of info) if (c.notnull && c.dflt_value === null && obj[c.name] === undefined) {
      obj[c.name] = /INT|REAL|NUM/i.test(c.type) ? 0 : 'x';
    }
    const keys = Object.keys(obj).filter(k => info.some(c => c.name === k));
    if (keys.length === 0) throw new Error(`no matching columns for ${t} — table missing?`);
    sqlite.prepare(`INSERT OR IGNORE INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
      .run(...keys.map(k => obj[k]));
  };

  insert('field_companies', { id: COMPANY, tenant_id: TENANT, name: 'Co1', code: 'C1', status: 'active' });
  insert('users', { id: ADMIN, tenant_id: TENANT, email: 'admin@real.co', first_name: 'Ad', last_name: 'Min', role: 'admin', is_active: 1, status: 'active', password_hash: 'x' });
  insert('users', { id: LEAD, tenant_id: TENANT, email: 'tl@real.co', first_name: 'Team', last_name: 'Lead', role: 'team_lead', is_active: 1, status: 'active', password_hash: 'x' });

  let teamCount = 0, companyCount = 0;
  for (let i = 0; i < N_AGENTS; i++) {
    const id = `a${i}`;
    const active = i % 10 !== 0;
    const lead = i % 10 === 5 ? 'tlOther' : LEAD;
    insert('users', { id, tenant_id: TENANT, email: `a${i}@real.co`, first_name: `A${i}`, last_name: 'L', role: 'field_agent', is_active: active ? 1 : 0, status: active ? 'active' : 'inactive', team_lead_id: lead, password_hash: 'x' });
    if (lead === LEAD && active) teamCount++;
    insert('agent_company_links', { id: `l${i}`, tenant_id: TENANT, agent_id: id, company_id: COMPANY, is_active: 1 });
    companyCount++;
    for (const [n, type] of [[0, 'individual'], [1, 'Store']]) {
      const vid = `v${i}-${n}`;
      insert('visits', { id: vid, tenant_id: TENANT, agent_id: id, company_id: COMPANY, customer_id: `cust${i % 20}`, visit_date: '2026-08-10', created_at: '2026-08-10 09:00:00', visit_type: type, status: 'completed', latitude: -26, longitude: 28 });
      if (type === 'individual') {
        insert('individuals', { id: `i${i}`, tenant_id: TENANT, company_id: COMPANY, first_name: `F${i}`, last_name: 'S', id_number: `900000000${i}`, phone: `07${i}` });
        insert('visit_individuals', { id: `vi${i}`, tenant_id: TENANT, visit_id: vid, individual_id: `i${i}`, custom_field_values: JSON.stringify({ goldrush_id: `10000000${i}`, consumer_converted: i % 3 === 0 ? 'Yes' : 'No', converted: i % 3 === 0 ? 1 : 0 }) });
      }
    }
  }
  insert('customers', { id: 'cust0', tenant_id: TENANT, name: 'Store 0', address: '1 Main' });
  insert('company_target_rules', { id: 'r1', tenant_id: TENANT, company_id: COMPANY, role_type: 'agent', individual_target_per_day: 3, individual_target_per_month: null, store_target_per_month: 9 });
  // Both groups must exceed D1's ceiling or this fixture proves nothing.
  expect(companyCount).toBeGreaterThan(100);
  expect(teamCount).toBeGreaterThan(100);
});

// Every rewritten call site, reached through its route.
const REPORT_ROUTES = [
  ['/field-ops/reports/kpis?company_id=c1&startDate=2026-08-01&endDate=2026-08-31', 'kpis'],
  ['/field-ops/reports/agent-performance?company_id=c1&startDate=2026-08-01&endDate=2026-08-31', 'agent-performance (rewritten IN)'],
  ['/field-ops/reports/conversion-stats?company_id=c1&startDate=2026-08-01&endDate=2026-08-31', 'conversion-stats (rewritten IN)'],
  ['/field-ops/reports/export/checkins?company_id=c1&startDate=2026-08-01&endDate=2026-08-31', 'export/checkins (rewritten IN)'],
  ['/field-ops/reports/checkins?company_id=c1&page=1&limit=20', 'checkins'],
  ['/field-ops/reports/checkins-by-hour?company_id=c1', 'checkins-by-hour'],
  ['/field-ops/reports/checkins-by-day?company_id=c1', 'checkins-by-day'],
];

describe('report routes: bound-parameter arity and execution', () => {
  for (const [path, label] of REPORT_ROUTES) {
    it(`${label} responds 200 with matched bind arity`, async () => {
      violations.length = 0;
      const { status, body } = await call(reportRoutes, path);
      expect(violations, `arity/SQL problems on ${path}`).toEqual([]);
      expect(status).toBe(200);
      expect(body?.success).toBe(true);
    });
  }

  it('agent-performance actually returns the company\'s agents', async () => {
    violations.length = 0;
    const { body } = await call(reportRoutes, '/field-ops/reports/agent-performance?company_id=c1');
    expect(violations).toEqual([]);
    // Scoped to c1 and capped at 50 by the handler; the point is it is non-empty,
    // i.e. the subquery really did resolve the 150-agent set.
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every(r => r.agent_id?.startsWith('a'))).toBe(true);
  });

  it('checkins returns a page and a total from one batch', async () => {
    violations.length = 0;
    const { body } = await call(reportRoutes, '/field-ops/reports/checkins?company_id=c1&page=1&limit=20');
    expect(violations).toEqual([]);
    expect(body.checkins.length).toBe(20);
    // total must be the full filtered count, not the page size
    expect(body.total).toBeGreaterThan(20);
  });

  it('export/checkins returns rows for a company with more agents than D1 allows params', async () => {
    violations.length = 0;
    const { body } = await call(reportRoutes, '/field-ops/reports/export/checkins?company_id=c1');
    expect(violations).toEqual([]);
    expect(body.data.length).toBeGreaterThan(100);
  });
});

describe('field-ops performance: bound-parameter arity and execution', () => {
  for (const [role, userId, label] of [
    ['team_lead', LEAD, 'team_lead branch (rewritten IN)'],
    ['admin', ADMIN, 'manager branch'],
    ['field_agent', 'a1', 'agent branch'],
  ]) {
    it(`${label} responds 200 with matched bind arity`, async () => {
      violations.length = 0;
      const { status, body } = await call(fieldOpsPerformanceRoutes, '/field-ops/performance?period=month', role, userId);
      expect(violations, `arity/SQL problems for role=${role}`).toEqual([]);
      expect(status).toBe(200);
      expect(body?.error).toBeUndefined();
    });
  }

  it('manager drill-down into a team lead (rewritten IN) responds 200', async () => {
    violations.length = 0;
    const { status, body } = await call(fieldOpsPerformanceRoutes, `/field-ops/performance?period=month&team_lead_id=${LEAD}`, 'admin', ADMIN);
    expect(violations).toEqual([]);
    expect(status).toBe(200);
    // The 135-member team is over D1's parameter ceiling; the old inlined form
    // could not have produced this at all.
    expect(body.agents.length).toBeGreaterThan(100);
  });

  it('team_lead excel export (rewritten IN) responds 200', async () => {
    violations.length = 0;
    const { status, body } = await call(fieldOpsPerformanceRoutes, '/field-ops/performance/export?period=month', 'team_lead', LEAD);
    expect(violations).toEqual([]);
    expect(status, `body: ${JSON.stringify(body)?.slice(0, 400)}`).toBe(200);
  });
});
