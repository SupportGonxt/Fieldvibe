import { describe, it, expect } from 'vitest';
import { shapeBoPerformance, ageDays } from './gm.js';

describe('shapeBoPerformance', () => {
  const admins = [
    { id: 'u1', name: 'Amy Adams', last_activity_at: '2026-07-14 08:00:00', last_login: null },
    { id: 'u2', name: 'Bob Brown', last_activity_at: null, last_login: '2026-06-01 09:00:00' },
  ];

  it('merges photo/call/issue rows per admin and totals each window', () => {
    const out = shapeBoPerformance(admins, {
      photos: [{ uid: 'u1', approved30: 10, rejected30: 2, approved7: 4, rejected7: 1 }],
      calls: [{ uid: 'u1', calls30: 20, answered30: 15, calls7: 5, answered7: 4 }],
      issues: [{ uid: 'u1', acted30: 3, acted7: 1 }],
    });
    const amy = out.find((a) => a.id === 'u1');
    expect(amy.d7).toEqual({ photosApproved: 4, photosRejected: 1, calls: 5, answered: 4, issuesActed: 1, total: 11 });
    expect(amy.d30).toEqual({ photosApproved: 10, photosRejected: 2, calls: 20, answered: 15, issuesActed: 3, total: 35 });
    expect(amy.lastSeen).toBe('2026-07-14 08:00:00');
  });

  it('zero-fills admins with no activity and falls back to last_login', () => {
    const out = shapeBoPerformance(admins, {});
    const bob = out.find((a) => a.id === 'u2');
    expect(bob.d7.total).toBe(0);
    expect(bob.d30.total).toBe(0);
    expect(bob.lastSeen).toBe('2026-06-01 09:00:00');
  });

  it('sorts busiest-first by 30d total, then name', () => {
    const out = shapeBoPerformance(admins, { calls: [{ uid: 'u2', calls30: 9 }] });
    expect(out.map((a) => a.id)).toEqual(['u2', 'u1']);
  });

  it('tolerates missing inputs', () => {
    expect(shapeBoPerformance(null)).toEqual([]);
    expect(shapeBoPerformance([], undefined)).toEqual([]);
  });
});

describe('ageDays', () => {
  const now = Date.parse('2026-07-15T12:00:00Z');
  it('parses D1 space-separated UTC timestamps', () => {
    expect(ageDays('2026-07-08 11:00:00', now)).toBe(7);
    expect(ageDays('2026-07-15 09:00:00', now)).toBe(0);
  });
  it('returns null for null/garbage', () => {
    expect(ageDays(null, now)).toBeNull();
    expect(ageDays('not-a-date', now)).toBeNull();
  });
});
