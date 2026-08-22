/**
 * Equivalence test for resolveAgentTargetMapBatch (lib/calendar.js).
 *
 * /field-ops/performance used to resolve monthly targets one user at a time:
 * a monthly_targets lookup, then generateTargetsFromRules (~4 + 2*companies
 * queries) on the fallback path. For an admin viewing every team that fanned
 * out to 1000+ D1 queries in a single request and was the dominant cost of the
 * slow admin report load. resolveAgentTargetMapBatch does the same work in one
 * batched round trip.
 *
 * This test pins the thing that matters: the batched result must be identical
 * to the per-user code it replaced, for every fixture shape (explicit targets,
 * zero-valued targets that must fall through, role_type fallback, agent+company
 * working-days overrides, agents with no active company).
 *
 * Runs in the node-env pool (npm run test:pure) — no Workers pool or live API needed.
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { generateTargetsFromRules, resolveAgentTargetMapBatch } from '../../src/lib/calendar.js';

const T = 'ten1', MONTH = '2026-08', MONTH_START = '2026-08-01';
const AGENTS = [...Array(60)].map((_, i) => `a${i}`);

// ── in-memory fixture ────────────────────────────────────────────────────────
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`
  CREATE TABLE field_companies (id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, code TEXT, status TEXT);
  CREATE TABLE agent_company_links (id TEXT PRIMARY KEY, tenant_id TEXT, agent_id TEXT, company_id TEXT, is_active INTEGER);
  CREATE TABLE monthly_targets (id TEXT PRIMARY KEY, tenant_id TEXT, agent_id TEXT, company_id TEXT,
    target_month TEXT, target_visits INTEGER, target_registrations INTEGER);
  CREATE TABLE company_target_rules (id TEXT PRIMARY KEY, tenant_id TEXT, company_id TEXT, role_type TEXT,
    individual_target_per_day INTEGER, individual_target_per_month INTEGER, store_target_per_day INTEGER,
    store_target_per_month INTEGER, target_visits_per_day INTEGER, target_registrations_per_day INTEGER,
    target_conversions_per_day INTEGER, store_target_per_month_tl INTEGER, store_target_per_month_agent INTEGER);
  CREATE TABLE working_days_config (id TEXT PRIMARY KEY, tenant_id TEXT, company_id TEXT, agent_id TEXT,
    monday INTEGER, tuesday INTEGER, wednesday INTEGER, thursday INTEGER, friday INTEGER,
    saturday INTEGER, sunday INTEGER, public_holidays TEXT, created_at TEXT DEFAULT '2026-01-01');

  INSERT INTO field_companies (id,tenant_id,name,code,status) VALUES
    ('c1','ten1','Co1','C1','active'), ('c2','ten1','Co2','C2','active'), ('c3','ten1','Co3','C3','inactive');

  -- c1 has an 'agent' rule driven by per-day x working days (NULL per-month).
  -- c2 has only a legacy 'team_lead' rule, exercising "no role rules -> any rules".
  INSERT INTO company_target_rules (id,tenant_id,company_id,role_type,individual_target_per_day,individual_target_per_month,store_target_per_month) VALUES
    ('r1','ten1','c1','agent',3,NULL,9);
  INSERT INTO company_target_rules (id,tenant_id,company_id,role_type,individual_target_per_month,store_target_per_month_agent) VALUES
    ('r2','ten1','c2','team_lead',77,4);

  -- Global calendar (Sat/Sun off, one public holiday) + an agent+company override
  -- for a3 on c1 (Saturdays on, no holidays) so the per-(agent,company) priority
  -- and the batched version's working-days memoisation are both exercised.
  INSERT INTO working_days_config (id,tenant_id,company_id,agent_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,public_holidays) VALUES
    ('w0','ten1',NULL,NULL,1,1,1,1,1,0,0,'["2026-08-10"]'),
    ('w1','ten1','c1','a3',1,1,1,1,1,1,0,'[]');

  -- a1 has an explicit but all-zero target row: must fall through to the rules.
  INSERT INTO monthly_targets (id,tenant_id,agent_id,company_id,target_month,target_visits,target_registrations)
    VALUES ('mz','ten1','a1','c1','2026-08',0,0);
`);
let n = 0;
for (const a of AGENTS) {
  const i = +a.slice(1);
  // i%3==0 -> c1 ; i%3==1 -> c1+c2 ; i%3==2 -> c3 only (inactive => no companies)
  for (const c of i % 3 === 0 ? ['c1'] : i % 3 === 1 ? ['c1', 'c2'] : ['c3']) {
    sqlite.prepare('INSERT INTO agent_company_links (id,tenant_id,agent_id,company_id,is_active) VALUES (?,?,?,?,1)').run(`l${n++}`, T, a, c);
  }
  // Every 5th agent gets two explicit target rows, to exercise the SUM().
  if (i % 5 === 0) {
    sqlite.prepare("INSERT INTO monthly_targets (id,tenant_id,agent_id,company_id,target_month,target_visits,target_registrations) VALUES (?,?,?,'c1','2026-08',40,7)").run(`m${a}a`, T, a);
    sqlite.prepare("INSERT INTO monthly_targets (id,tenant_id,agent_id,company_id,target_month,target_visits,target_registrations) VALUES (?,?,?,'c2','2026-08',11,2)").run(`m${a}b`, T, a);
  }
}

// ── minimal D1 shim (prepare/bind/first/all/batch) with a query counter ──────
let queries = 0;
const db = {
  prepare(sql) {
    const st = { binds: [] };
    st.bind = (...a) => { st.binds = a; return st; };
    st._raw = () => sqlite.prepare(sql).all(...st.binds);
    st.first = async () => { queries++; return st._raw()[0] ?? null; };
    st.all = async () => { queries++; return { results: st._raw() }; };
    return st;
  },
  // A D1 batch is one round trip regardless of statement count.
  async batch(stmts) { queries++; return stmts.map(s => ({ results: s._raw() })); },
};

// ── the per-user block this replaced, copied verbatim ────────────────────────
async function legacyPerUser(company_id) {
  const map = {};
  await Promise.all(AGENTS.map(async (aid) => {
    try {
      const mt = company_id
        ? await db.prepare('SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ? AND company_id = ?').bind(T, aid, MONTH, company_id).first()
        : await db.prepare('SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?').bind(T, aid, MONTH).first();
      if (mt && (mt.target_visits > 0 || mt.target_registrations > 0)) {
        map[aid] = { target_visits: mt.target_visits || 0, target_stores: mt.target_registrations || 0 };
      } else {
        const targets = await generateTargetsFromRules(db, T, aid, MONTH_START, 'agent');
        map[aid] = {
          target_visits: targets.reduce((s, t) => s + (t.target_visits || 0), 0),
          target_stores: targets.reduce((s, t) => s + (t.target_registrations || 0), 0),
        };
      }
    } catch { map[aid] = { target_visits: 0, target_stores: 0 }; }
  }));
  return map;
}

// ── assertions ──────────────────────────────────────────────────────────────
describe('resolveAgentTargetMapBatch', () => {
  for (const company_id of [null, 'c1']) {
    it(`matches the per-user path it replaced (company_id=${company_id ?? 'null'})`, async () => {
      queries = 0;
      const before = await legacyPerUser(company_id);
      const legacyQ = queries;
      queries = 0;
      const after = await resolveAgentTargetMapBatch(db, T, AGENTS, MONTH, company_id, 'agent');
      const batchQ = queries;

      for (const a of AGENTS) expect(after[a], `${a} diverged`).toEqual(before[a]);
      // The whole point: one round trip, and a fixture that really does make the
      // old path fan out (so an all-zeros result cannot silently pass).
      expect(batchQ).toBe(1);
      expect(legacyQ).toBeGreaterThan(100);
    });
  }

  it('pins the explicit / fallback / calendar-override / no-company paths', async () => {
    const m = await resolveAgentTargetMapBatch(db, T, AGENTS, MONTH, null, 'agent');
    // explicit monthly targets, summed across two rows: 40+11 visits, 7+2 stores
    expect(m.a0).toEqual({ target_visits: 51, target_stores: 9 });
    // all-zero target row falls through to rules: 3/day x 20 working days
    expect(m.a1).toEqual({ target_visits: 60, target_stores: 9 });
    // agent+company calendar override turns Saturdays on: 3/day x 26 working days
    expect(m.a3).toEqual({ target_visits: 78, target_stores: 9 });
    // linked only to an inactive company
    expect(m.a2).toEqual({ target_visits: 0, target_stores: 0 });
  });
});
