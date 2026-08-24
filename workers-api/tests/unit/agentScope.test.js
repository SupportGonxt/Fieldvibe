/**
 * Proves the agent-scope subqueries (lib/agentScope.js) select exactly the same agent
 * set as the inlined `agent_id IN (?,?,?...)` lists they replaced — and that they do it
 * with a constant number of bound parameters.
 *
 * Why it matters: D1 rejects a statement with more than 100 bound parameters. The old
 * form used one parameter per agent, so every company/team report failed outright once
 * the group passed ~97 members. This fixture deliberately uses 150 agents, which is
 * over that line, so a regression back to the inlined form is caught here rather than
 * in production.
 *
 * Runs in the node-env pool (npm run test:pure).
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { companyAgentScope, teamMemberScope } from '../../src/lib/agentScope.js';

const T = 'ten1', COMPANY = 'c1', LEAD = 'tl1';
const D1_MAX_BOUND_PARAMS = 100;
// Over D1's limit on purpose: the old inlined form cannot express this set at all.
const N_AGENTS = 150;

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE users (id TEXT PRIMARY KEY, tenant_id TEXT, team_lead_id TEXT, is_active INTEGER);
  CREATE TABLE agent_company_links (id TEXT PRIMARY KEY, tenant_id TEXT, agent_id TEXT, company_id TEXT, is_active INTEGER);
  CREATE TABLE visits (id TEXT PRIMARY KEY, tenant_id TEXT, agent_id TEXT, company_id TEXT,
    visit_date TEXT, visit_type TEXT, status TEXT);
`);

const companyAgents = [];   // linked to c1 and active
const teamAgents = [];      // team_lead_id = tl1 and active
db.prepare("INSERT INTO users (id,tenant_id,team_lead_id,is_active) VALUES (?,?,NULL,0)").run(LEAD, T);
for (let i = 0; i < N_AGENTS; i++) {
  const id = `a${i}`;
  // A tenth are inactive, and a tenth are linked to a different company: the scope
  // must exclude both, exactly as the original queries did.
  const active = i % 10 !== 0;
  const lead = i % 10 === 5 ? 'tlOther' : LEAD;
  db.prepare('INSERT INTO users (id,tenant_id,team_lead_id,is_active) VALUES (?,?,?,?)').run(id, T, lead, active ? 1 : 0);
  const linkCompany = i % 10 === 7 ? 'c2' : COMPANY;
  const linkActive = i % 10 === 3 ? 0 : 1;
  db.prepare('INSERT INTO agent_company_links (id,tenant_id,agent_id,company_id,is_active) VALUES (?,?,?,?,?)')
    .run(`l${i}`, T, id, linkCompany, linkActive);
  if (linkCompany === COMPANY && linkActive === 1) companyAgents.push(id);
  if (lead === LEAD && active) teamAgents.push(id);
  // a couple of visits each
  for (const [n, type] of [[0, 'individual'], [1, 'Store']]) {
    db.prepare("INSERT INTO visits (id,tenant_id,agent_id,company_id,visit_date,visit_type,status) VALUES (?,?,?,?,?,?, 'completed')")
      .run(`v${i}-${n}`, T, id, COMPANY, '2026-08-10', type);
  }
}
// The lead is included unconditionally by teamMemberScope even though its row is
// inactive — that is what `[leadId, ...activeReports]` did.
db.prepare("INSERT INTO visits (id,tenant_id,agent_id,company_id,visit_date,visit_type,status) VALUES ('vTL',?,?,?, '2026-08-10','individual','completed')").run(T, LEAD, COMPANY);

const ids = (sql, binds) => db.prepare(sql).all(...binds).map(r => r.agent_id ?? r.id).sort();

describe('companyAgentScope', () => {
  it('selects the same agents as the inlined IN list', () => {
    const inlined = ids(
      `SELECT agent_id FROM agent_company_links WHERE tenant_id = ? AND agent_id IN (${companyAgents.map(() => '?').join(',')})`,
      [T, ...companyAgents]);
    const scope = companyAgentScope(T, COMPANY);
    const viaScope = ids(`SELECT agent_id FROM agent_company_links WHERE tenant_id = ? AND agent_id IN ${scope.sql}`, [T, ...scope.binds]);
    expect(viaScope).toEqual(inlined);
    expect(viaScope.length).toBe(companyAgents.length);
  });

  it('filters visits identically to the inlined form', () => {
    const scope = companyAgentScope(T, COMPANY);
    const viaScope = db.prepare(
      `SELECT COUNT(*) c FROM visits v WHERE v.tenant_id = ? AND v.agent_id IN ${scope.sql} AND v.visit_date BETWEEN ? AND ?`
    ).get(T, ...scope.binds, '2026-08-01', '2026-08-31').c;
    const inlined = db.prepare(
      `SELECT COUNT(*) c FROM visits v WHERE v.tenant_id = ? AND v.agent_id IN (${companyAgents.map(() => '?').join(',')}) AND v.visit_date BETWEEN ? AND ?`
    ).get(T, ...companyAgents, '2026-08-01', '2026-08-31').c;
    expect(viaScope).toBe(inlined);
    expect(viaScope).toBeGreaterThan(0);
  });

  it('stays under D1s bound-parameter limit where the inlined form did not', () => {
    expect(companyAgentScope(T, COMPANY).binds.length).toBe(2);
    // The set this replaces cannot be expressed within the limit at all.
    expect(companyAgents.length).toBeGreaterThan(D1_MAX_BOUND_PARAMS);
  });
});

describe('teamMemberScope', () => {
  it('selects the lead plus its active direct reports', () => {
    const expected = [LEAD, ...teamAgents].sort();
    const scope = teamMemberScope(T, LEAD);
    const viaScope = ids(`SELECT id FROM users WHERE id IN ${scope.sql}`, scope.binds);
    expect(viaScope).toEqual(expected);
  });

  it('includes the lead even when the lead row is inactive', () => {
    const scope = teamMemberScope(T, LEAD);
    const rows = ids(`SELECT id FROM users WHERE id IN ${scope.sql}`, scope.binds);
    expect(db.prepare('SELECT is_active FROM users WHERE id = ?').get(LEAD).is_active).toBe(0);
    expect(rows).toContain(LEAD);
  });

  it('excludes inactive reports and other leads reports', () => {
    const scope = teamMemberScope(T, LEAD);
    const rows = ids(`SELECT id FROM users WHERE id IN ${scope.sql}`, scope.binds);
    expect(rows).not.toContain('a0');   // is_active = 0
    expect(rows).not.toContain('a5');   // team_lead_id = tlOther
  });

  it('filters visits identically to the inlined form', () => {
    const all = [LEAD, ...teamAgents];
    const scope = teamMemberScope(T, LEAD);
    const viaScope = db.prepare(
      `SELECT COUNT(*) c FROM visits WHERE tenant_id = ? AND visit_date BETWEEN ? AND ? AND agent_id IN ${scope.sql}`
    ).get(T, '2026-08-01', '2026-08-31', ...scope.binds).c;
    const inlined = db.prepare(
      `SELECT COUNT(*) c FROM visits WHERE tenant_id = ? AND visit_date BETWEEN ? AND ? AND agent_id IN (${all.map(() => '?').join(',')})`
    ).get(T, '2026-08-01', '2026-08-31', ...all).c;
    expect(viaScope).toBe(inlined);
    expect(viaScope).toBeGreaterThan(0);
  });

  it('stays under D1s bound-parameter limit where the inlined form did not', () => {
    expect(teamMemberScope(T, LEAD).binds.length).toBe(3);
    expect([LEAD, ...teamAgents].length).toBeGreaterThan(D1_MAX_BOUND_PARAMS);
  });
});
