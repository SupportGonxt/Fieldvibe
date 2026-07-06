import { describe, it, expect } from 'vitest';
import { assertEqual, canonicalizeAnswer } from '../../scripts/migrate-goldrush-convergence.mjs';

describe('canonicalizeAnswer', () => {
  it('prefers goldrush_id_entry, falls back to goldrush_id, collapses to one key', () => {
    expect(canonicalizeAnswer({ goldrush_id_entry: '123456789', goldrush_id: '999' }))
      .toEqual({ goldrush_id: '123456789' });
    expect(canonicalizeAnswer({ goldrush_id: '555' }))
      .toEqual({ goldrush_id: '555' });
    expect(canonicalizeAnswer({ other: 'x' }))
      .toEqual({ other: 'x' });
  });
});

describe('assertEqual', () => {
  it('passes when all four totals match', () => {
    const t = { signups: 10, distinctIdentifiers: 8, qualified: 5, commissionSum: 750 };
    expect(assertEqual(t, { ...t })).toBe(true);
  });
  it('throws naming the field that drifted (money first-class)', () => {
    const before = { signups: 10, distinctIdentifiers: 8, qualified: 5, commissionSum: 750 };
    const after = { ...before, commissionSum: 675 };
    expect(() => assertEqual(before, after)).toThrow(/commissionSum/);
  });
});
