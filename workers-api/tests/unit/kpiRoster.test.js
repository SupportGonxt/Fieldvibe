// workers-api/tests/unit/kpiRoster.test.js
import { describe, it, expect } from 'vitest';
import { resolveRoleKpiKey, rankRoster } from '../../src/routes/field-ops/kpi.js';

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
