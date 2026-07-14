// workers-api/tests/unit/kpiRoster.test.js
import { describe, it, expect } from 'vitest';
import { resolveRoleKpiKey, rankRoster, coachingNoteRow } from '../../src/routes/field-ops/kpi.js';
import { doNudge } from '../../src/routes/field-ops/issues.js';

describe('resolveRoleKpiKey', () => {
  it('maps agent-tier roles to kpi.agent', () => {
    expect(resolveRoleKpiKey('agent')).toBe('kpi.agent');
    expect(resolveRoleKpiKey('field_agent')).toBe('kpi.agent');
    expect(resolveRoleKpiKey('sales_rep')).toBe('kpi.agent');
  });
  it('maps leadership roles to their own keys', () => {
    expect(resolveRoleKpiKey('team_lead')).toBe('kpi.team_lead');
    expect(resolveRoleKpiKey('manager')).toBe('kpi.manager');
    expect(resolveRoleKpiKey('general_manager')).toBe('kpi.general_manager');
  });
  it('falls back to kpi.agent for unknown roles', () => {
    expect(resolveRoleKpiKey('whatever')).toBe('kpi.agent');
    expect(resolveRoleKpiKey(undefined)).toBe('kpi.agent');
  });
});

describe('rankRoster', () => {
  it('worst performers first: more signals, then fewer signups', () => {
    const out = rankRoster([
      { agentId: 'a', name: 'A', actual: { signups_per_day: 9 }, signals: [{ type: 'below_target' }] },
      { agentId: 'b', name: 'B', actual: { signups_per_day: 3 }, signals: [{ type: 'below_target' }, { type: 'gone_quiet' }] },
      { agentId: 'c', name: 'C', actual: { signups_per_day: 12 }, signals: [] },
    ]);
    expect(out.map(a => a.agentId)).toEqual(['b', 'a', 'c']);
  });
});

describe('coachingNoteRow', () => {
  it('maps camelCase args to snake_case row, defaulting optionals to null', () => {
    expect(coachingNoteRow({
      id: 'cn-1', tenantId: 't', companyId: 'c', managerId: 'm', agentId: 'a',
      signalType: 'below_target', action: 'note', note: 'follow up Monday',
    })).toEqual({
      id: 'cn-1', tenant_id: 't', company_id: 'c', manager_id: 'm', agent_id: 'a',
      signal_type: 'below_target', action: 'note', note: 'follow up Monday',
    });
  });
  it('nulls missing companyId/signalType/note', () => {
    expect(coachingNoteRow({ id: 'x', tenantId: 't', managerId: 'm', agentId: 'a', action: 'note' }))
      .toEqual({ id: 'x', tenant_id: 't', company_id: null, manager_id: 'm', agent_id: 'a', signal_type: null, action: 'note', note: null });
  });
});

describe('doNudge message sanitization', () => {
  // Minimal D1 stub: targetExists .first() hits, notification INSERT binds captured, no push subs.
  const stubDb = (captured) => ({
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => ({ id: 'a' }),
        run: async () => { if (sql.includes('INSERT INTO notifications')) captured.push(args); },
        all: async () => ({ results: [] }),
      }),
    }),
  });
  async function sentMessage(message) {
    const captured = [];
    await doNudge({ db: stubDb(captured), env: {}, tenantId: 't', userId: 'm', body: { agentId: 'a', message }, issue: null });
    return captured[0][5]; // message column of the notifications INSERT
  }
  it('trims and caps at 300 chars', async () => {
    expect(await sentMessage('  hi there  ')).toBe('hi there');
    expect((await sentMessage('x'.repeat(500))).length).toBe(300);
  });
  it('falls back to default when absent, blank, or non-string', async () => {
    expect(await sentMessage(undefined)).toBe('Check in with your manager.');
    expect(await sentMessage('   ')).toBe('Check in with your manager.');
    expect(await sentMessage(42)).toBe('Check in with your manager.');
  });
});
