/**
 * Incentive engine tier logic — the money-critical step function.
 * tierAmount pays the highest tier whose min <= avg; nextTier is the one above.
 */
import { describe, it, expect } from 'vitest';
import { tierAmount, nextTier } from '../../src/services/incentiveService.js';

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
