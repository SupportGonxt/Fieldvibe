/**
 * Incentive engine two-gate tier logic — the money-critical step function.
 * A tier pays only when BOTH gates clear: avgSignups >= t.signups AND avgDeposits >= t.deposits.
 * The tier reached is min(signup_tier, deposit_tier) — the lower gate governs.
 */
import { describe, it, expect } from 'vitest';
import { tierFor, nextGate, extractGoldrushIds, dueEscalation } from '../../src/services/incentiveService.js';

// Governing Goldrush agent/team-lead scale (per working day).
const TIERS = [
  { signups: 8,  deposits: 5,  amount: 1500 },
  { signups: 10, deposits: 8,  amount: 2500 },
  { signups: 15, deposits: 10, amount: 3500 },
  { signups: 20, deposits: 15, amount: 4500 },
];

describe('tierFor', () => {
  it('pays 0 below the lowest gate', () => {
    expect(tierFor(TIERS, { signups: 0, deposits: 0 })).toBe(0);
    expect(tierFor(TIERS, { signups: 7.9, deposits: 5 })).toBe(0);   // signups short
    expect(tierFor(TIERS, { signups: 8, deposits: 4.9 })).toBe(0);   // deposits short
  });

  it('pays the tier where both gates clear at the exact boundary', () => {
    expect(tierFor(TIERS, { signups: 8, deposits: 5 })).toBe(1500);
    expect(tierFor(TIERS, { signups: 10, deposits: 8 })).toBe(2500);
    expect(tierFor(TIERS, { signups: 15, deposits: 10 })).toBe(3500);
    expect(tierFor(TIERS, { signups: 20, deposits: 15 })).toBe(4500);
  });

  it('the lower gate governs: min(signup_tier, deposit_tier)', () => {
    // Signups reach R4500 but deposits only clear the R1500 gate -> R1500.
    expect(tierFor(TIERS, { signups: 20, deposits: 5 })).toBe(1500);
    // Signups clear R3500 gate, deposits clear R2500 gate -> R2500.
    expect(tierFor(TIERS, { signups: 15, deposits: 8 })).toBe(2500);
    // Deposits reach top but signups only clear R1500 -> R1500.
    expect(tierFor(TIERS, { signups: 8, deposits: 15 })).toBe(1500);
  });

  it('handles empty / missing tiers as 0', () => {
    expect(tierFor([], { signups: 50, deposits: 50 })).toBe(0);
    expect(tierFor(undefined, { signups: 50, deposits: 50 })).toBe(0);
  });
});

describe('nextGate', () => {
  it('returns the next unreached tier with the shortfall on each gate', () => {
    expect(nextGate(TIERS, { signups: 0, deposits: 0 })).toMatchObject({ amount: 1500, shortfall: { signups: 8, deposits: 5 } });
    expect(nextGate(TIERS, { signups: 8, deposits: 5 })).toMatchObject({ amount: 2500, shortfall: { signups: 2, deposits: 3 } });
  });

  it('a met gate reports 0 shortfall on that axis', () => {
    // Already at R1500; next is R2500 (needs 10/8). Signups 12 covers it, deposits 6 short by 2.
    expect(nextGate(TIERS, { signups: 12, deposits: 6 })).toMatchObject({ amount: 2500, shortfall: { signups: 0, deposits: 2 } });
  });

  it('returns null once the top tier is reached', () => {
    expect(nextGate(TIERS, { signups: 20, deposits: 15 })).toBeNull();
    expect(nextGate(TIERS, { signups: 25, deposits: 20 })).toBeNull();
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

import { flatTier } from '../../src/routes/field-ops/config.js';

describe('flatTier', () => {
  it('flattens {amount, targets:{…}} rows to wire shape', () => {
    expect(flatTier({ amount: 1500, targets: { signups: 8, deposits: 5 } }))
      .toEqual({ amount: 1500, signups: 8, deposits: 5 });
  });
  it('passes legacy flat rows through unchanged', () => {
    const t = { amount: 2500, signups: 10, deposits: 8 };
    expect(flatTier(t)).toBe(t);
  });
});
