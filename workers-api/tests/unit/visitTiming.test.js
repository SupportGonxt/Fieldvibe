import { describe, it, expect } from 'vitest';
import { resolveVisitTimes, visitDurationMinutes, MAX_VISIT_HOURS } from '../../src/services/visitTiming.js';

const NOW = '2026-09-21T10:30:00.000Z';

describe('resolveVisitTimes', () => {
  it('uses the client check-in and stamps check-out at submit', () => {
    const t = resolveVisitTimes({ check_in_time: '2026-09-21T10:05:00.000Z' }, NOW);
    expect(t).toEqual({ check_in_time: '2026-09-21T10:05:00.000Z', check_out_time: NOW });
  });

  it('normalises a non-UTC check-in to ISO', () => {
    const t = resolveVisitTimes({ check_in_time: '2026-09-21T12:05:00+02:00' }, NOW);
    expect(t.check_in_time).toBe('2026-09-21T10:05:00.000Z');
  });

  it('falls back to the submit time when no check-in is sent', () => {
    expect(resolveVisitTimes({}, NOW)).toEqual({ check_in_time: NOW, check_out_time: NOW });
    expect(resolveVisitTimes(null, NOW)).toEqual({ check_in_time: NOW, check_out_time: NOW });
  });

  it('rejects garbage, future and stale check-ins', () => {
    expect(resolveVisitTimes({ check_in_time: 'yesterday-ish' }, NOW).check_in_time).toBe(NOW);
    expect(resolveVisitTimes({ check_in_time: 42 }, NOW).check_in_time).toBe(NOW);
    expect(resolveVisitTimes({ check_in_time: '2026-09-21T10:31:00.000Z' }, NOW).check_in_time).toBe(NOW);
    const stale = new Date(new Date(NOW).getTime() - (MAX_VISIT_HOURS * 3600 * 1000 + 1)).toISOString();
    expect(resolveVisitTimes({ check_in_time: stale }, NOW).check_in_time).toBe(NOW);
  });

  it('keeps a check-in right at the age ceiling', () => {
    const edge = new Date(new Date(NOW).getTime() - MAX_VISIT_HOURS * 3600 * 1000).toISOString();
    expect(resolveVisitTimes({ check_in_time: edge }, NOW).check_in_time).toBe(edge);
  });
});

describe('visitDurationMinutes', () => {
  it('rounds to whole minutes', () => {
    expect(visitDurationMinutes('2026-09-21T10:05:00Z', '2026-09-21T10:30:29Z')).toBe(25);
    expect(visitDurationMinutes('2026-09-21T10:05:00Z', '2026-09-21T10:30:31Z')).toBe(26);
  });

  it('is null when a side is missing, unparseable, or reversed', () => {
    expect(visitDurationMinutes(null, NOW)).toBeNull();
    expect(visitDurationMinutes(NOW, undefined)).toBeNull();
    expect(visitDurationMinutes('x', NOW)).toBeNull();
    expect(visitDurationMinutes(NOW, '2026-09-21T10:00:00Z')).toBeNull();
  });
});
