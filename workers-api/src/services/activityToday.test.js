import { describe, it, expect } from 'vitest';
import {
  workStartUtc,
  notTestUserSql,
  mapActivityRow,
  summarize,
  buildActivitySql,
  computeActiveToday,
} from './activityToday.js';

describe('workStartUtc', () => {
  it('floors to 06:00 UTC (08:00 SAST) of the current UTC date', () => {
    expect(workStartUtc(new Date('2026-07-28T09:30:00Z'))).toBe('2026-07-28 06:00:00');
    expect(workStartUtc(new Date('2026-07-28T00:05:00Z'))).toBe('2026-07-28 06:00:00');
  });
});

describe('mapActivityRow — the active-today definition', () => {
  it('signup only -> active, lastActivity = signup', () => {
    const r = mapActivityRow({ id: 'a', name: 'Ann A', role: 'agent', signup_last: '2026-07-28 09:00:00', gps_last: null });
    expect(r.active).toBe(true);
    expect(r.lastActivity).toBe('2026-07-28 09:00:00');
  });

  it('GPS only -> active, lastActivity = gps', () => {
    const r = mapActivityRow({ id: 'b', name: 'Ben B', role: 'agent', signup_last: null, gps_last: '2026-07-28 08:15:00' });
    expect(r.active).toBe(true);
    expect(r.lastActivity).toBe('2026-07-28 08:15:00');
  });

  it('neither signal -> inactive, lastActivity null', () => {
    const r = mapActivityRow({ id: 'c', name: 'Cid C', role: 'agent', signup_last: null, gps_last: null });
    expect(r.active).toBe(false);
    expect(r.lastActivity).toBeNull();
  });

  it('both signals -> lastActivity is the later timestamp', () => {
    const r = mapActivityRow({ id: 'd', name: 'Deb D', role: 'agent', signup_last: '2026-07-28 09:00:00', gps_last: '2026-07-28 14:30:00' });
    expect(r.active).toBe(true);
    expect(r.lastActivity).toBe('2026-07-28 14:30:00');
  });

  it('trims the composed name', () => {
    expect(mapActivityRow({ id: 'e', name: 'Solo  ', role: 'agent' }).name).toBe('Solo');
  });
});

describe('summarize', () => {
  it('counts active vs total and floats inactive to the top', () => {
    const rows = [
      { id: '1', name: 'Zoe Active', role: 'agent', signup_last: '2026-07-28 09:00:00' },
      { id: '2', name: 'Bob Inactive', role: 'agent' },
      { id: '3', name: 'Amy Inactive', role: 'agent' },
    ];
    const out = summarize(rows);
    expect(out.total).toBe(3);
    expect(out.active).toBe(1);
    // inactive first, alphabetical within group
    expect(out.roster.map((r) => r.name)).toEqual(['Amy Inactive', 'Bob Inactive', 'Zoe Active']);
  });

  it('handles empty input', () => {
    expect(summarize([])).toEqual({ active: 0, total: 0, roster: [] });
    expect(summarize(null)).toEqual({ active: 0, total: 0, roster: [] });
  });
});

describe('buildActivitySql', () => {
  it('includes the GPS correlated subquery and standard test exclusion', () => {
    const sql = buildActivitySql({ roles: ['agent'] });
    expect(sql).toContain('FROM agent_locations al');
    expect(sql).toContain("u.id NOT LIKE 'agent-test-%'");
    expect(sql).toContain('agent_type');
  });

  it('omits the field-ops agent_type filter for team leads', () => {
    const sql = buildActivitySql({ roles: ['team_lead'], fieldOpsOnly: false });
    expect(sql).not.toContain('agent_type');
  });

  it('injects the caller scope clause verbatim', () => {
    const sql = buildActivitySql({ roles: ['agent'], scopeSql: 'AND u.team_lead_id = ?' });
    expect(sql).toContain('AND u.team_lead_id = ?');
  });
});

describe('computeActiveToday (bind order)', () => {
  it('binds gps floor, signup floor, tenant, roles, then scope binds in order', async () => {
    let captured;
    const fakeDb = {
      prepare: (sql) => ({
        bind: (...binds) => {
          captured = { sql, binds };
          return { all: async () => ({ results: [] }) };
        },
      }),
    };
    await computeActiveToday(fakeDb, {
      tenantId: 'T1',
      roles: ['agent', 'field_agent'],
      workStart: '2026-07-28 06:00:00',
      scopeSql: 'AND u.team_lead_id = ?',
      scopeBinds: ['tl-1'],
    });
    expect(captured.binds).toEqual([
      '2026-07-28 06:00:00', // gps subquery floor
      '2026-07-28 06:00:00', // signup join floor
      'T1',                  // tenant
      'agent', 'field_agent', // roles
      'tl-1',                // scope bind
    ]);
  });
});

describe('notTestUserSql', () => {
  it('targets the given alias', () => {
    expect(notTestUserSql('x')).toContain("x.id NOT LIKE 'agent-test-%'");
  });
});
