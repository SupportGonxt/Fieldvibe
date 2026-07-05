/**
 * Incentive engine tier logic — the money-critical step function.
 * tierAmount pays the highest tier whose min <= avg; nextTier is the one above.
 */
import { describe, it, expect } from 'vitest';
import { tierAmount, nextTier, extractGoldrushIds, dueEscalation } from '../../src/services/incentiveService.js';

// Default Goldrush scale: avg>=20 -> 3500, >=15 -> 2500, >=10 -> 2000, else 0.
const TIERS = [
  { min: 10, amount: 2000 },
  { min: 15, amount: 2500 },
  { min: 20, amount: 3500 },
];

describe('tierAmount', () => {
  it('pays 0 below the lowest tier', () => {
    expect(tierAmount(TIERS, 0)).toBe(0);
    expect(tierAmount(TIERS, 9.9)).toBe(0);
  });

  it('pays each tier at its exact boundary', () => {
    expect(tierAmount(TIERS, 10)).toBe(2000);
    expect(tierAmount(TIERS, 15)).toBe(2500);
    expect(tierAmount(TIERS, 20)).toBe(3500);
  });

  it('pays the highest tier reached between boundaries', () => {
    expect(tierAmount(TIERS, 14.9)).toBe(2000);
    expect(tierAmount(TIERS, 19.9)).toBe(2500);
    expect(tierAmount(TIERS, 100)).toBe(3500);
  });

  it('handles empty / missing tiers as 0', () => {
    expect(tierAmount([], 50)).toBe(0);
    expect(tierAmount(undefined, 50)).toBe(0);
  });
});

describe('nextTier', () => {
  it('returns the next tier up from the current avg', () => {
    expect(nextTier(TIERS, 0)).toEqual({ min: 10, amount: 2000 });
    expect(nextTier(TIERS, 12)).toEqual({ min: 15, amount: 2500 });
    expect(nextTier(TIERS, 17)).toEqual({ min: 20, amount: 3500 });
  });

  it('returns null once at or above the top tier', () => {
    expect(nextTier(TIERS, 20)).toBeNull();
    expect(nextTier(TIERS, 25)).toBeNull();
  });

  it('at an exact boundary, points to the tier above (not the current one)', () => {
    expect(nextTier(TIERS, 10)).toEqual({ min: 15, amount: 2500 });
  });
});

describe('extractGoldrushIds', () => {
  it('pulls one 9-digit id per array cell', () => {
    expect(extractGoldrushIds({ goldrush_ids: ['123456789', '987654321'] }))
      .toEqual(['123456789', '987654321']);
  });

  it('pulls every 9-digit run from a csv/text blob', () => {
    expect(extractGoldrushIds({ csv: 'id,name\n123456789,Ann\n987654321,Bob\n' }))
      .toEqual(['123456789', '987654321']);
  });

  it('dedups across array and csv', () => {
    expect(extractGoldrushIds({ goldrush_ids: ['123456789'], csv: '123456789\n555555555' }))
      .toEqual(['123456789', '555555555']);
  });

  it('ignores non-9-digit tokens and empty input', () => {
    expect(extractGoldrushIds({ goldrush_ids: ['12345', 'abcdef', ''] })).toEqual([]);
    expect(extractGoldrushIds({})).toEqual([]);
    expect(extractGoldrushIds()).toEqual([]);
  });

  it('does not carve a 9-digit fragment out of a longer number (13-digit SA ID)', () => {
    expect(extractGoldrushIds({ goldrush_ids: ['8001015009087'] })).toEqual([]);
    expect(extractGoldrushIds({ csv: '0821234567,8001015009087' })).toEqual([]);
  });
});

describe('dueEscalation', () => {
  const STEPS = [
    { after_min: 0, to: 'employee' },
    { after_min: 30, to: 'team_lead' },
    { after_min: 60, to: 'manager' },
  ];

  it('nudges the employee at the breach (excess 0)', () => {
    expect(dueEscalation(STEPS, 0).to).toBe('employee');
  });

  it('escalates to team_lead and then manager as idle grows', () => {
    expect(dueEscalation(STEPS, 29).to).toBe('employee');
    expect(dueEscalation(STEPS, 30).to).toBe('team_lead');
    expect(dueEscalation(STEPS, 65).to).toBe('manager');
    expect(dueEscalation(STEPS, 1000).to).toBe('manager');
  });

  it('returns null before the first step and on empty/missing steps', () => {
    expect(dueEscalation(STEPS, -1)).toBeNull();
    expect(dueEscalation([], 100)).toBeNull();
    expect(dueEscalation(undefined, 100)).toBeNull();
  });
});
