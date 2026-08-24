import { describe, it, expect } from 'vitest';
import { isCacheableReportPath } from '../../src/lib/cache.js';

// This predicate now gates two things at once: the 60s edge cache AND whether a
// request may read from a D1 replica instead of the primary. A false positive on a
// write path would hand a replica session to a write, so the negative cases matter
// more than the positive ones.
describe('isCacheableReportPath', () => {
  it.each([
    '/api/field-ops/reports/agent-performance',
    '/api/field-ops/performance',
    '/api/field-ops/kpi/roster',
    '/api/field-ops/gm/overview',
    '/api/field-ops/incentives/leaderboard',
    '/api/analytics/summary',
    '/api/team-lead/dashboard',
    '/api/manager/dashboard',
    '/api/manager/team/tl-1/agents',
  ])('replica-safe: GET %s', (p) => {
    expect(isCacheableReportPath('GET', p)).toBe(true);
  });

  it.each([
    ['POST', '/api/field-ops/reports/agent-performance'], // any mutation
    ['PUT', '/api/field-ops/kpi/roster'],
    ['DELETE', '/api/analytics/summary'],
    ['GET', '/api/field-ops/live-locations'],              // live map feed
    ['GET', '/api/field-ops/reports/export'],              // user-triggered download
    ['GET', '/api/agent/dashboard'],                       // read-your-own-checkin
    ['GET', '/api/visits'],                                // write-then-read path
    ['GET', '/api/auth/me'],
  ])('primary-only: %s %s', (m, p) => {
    expect(isCacheableReportPath(m, p)).toBe(false);
  });
});
