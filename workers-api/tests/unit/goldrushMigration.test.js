import { describe, it, expect } from 'vitest';
import { assertEqual, canonicalizeAnswer, computeTotals } from '../../scripts/migrate-goldrush-convergence.mjs';

describe('canonicalizeAnswer', () => {
  it('prefers goldrush_id_entry, falls back to goldrush_id, collapses to one key', () => {
    expect(canonicalizeAnswer({ goldrush_id_entry: '123456789', goldrush_id: '999' }))
      .toEqual({ goldrush_id: '123456789' });
    expect(canonicalizeAnswer({ goldrush_id: '555' }))
      .toEqual({ goldrush_id: '555' });
    expect(canonicalizeAnswer({ other: 'x' }))
      .toEqual({ other: 'x' });
  });
  it('valid-9-digit wins the tiebreak; both/neither valid → entry', () => {
    // only id is a valid 9-digit → rescue it over a malformed entry
    expect(canonicalizeAnswer({ goldrush_id_entry: '3625147', goldrush_id: '392536147' }))
      .toEqual({ goldrush_id: '392536147' });
    // both valid but differ → entry wins
    expect(canonicalizeAnswer({ goldrush_id_entry: '403840274', goldrush_id: '404138391' }))
      .toEqual({ goldrush_id: '403840274' });
    // neither valid → entry wins
    expect(canonicalizeAnswer({ goldrush_id_entry: '12', goldrush_id: '34' }))
      .toEqual({ goldrush_id: '12' });
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

describe('computeTotals', () => {
  // Mock D1: prepare(sql).bind(...).first() dispatches on a distinctive SQL
  // substring per gate query. Verifies the money-gate SQL maps to the right
  // field (esp. commissionSum reading `s`, the count queries reading `n`).
  const mockDb = {
    prepare(sql) {
      let row;
      if (sql.includes('COUNT(DISTINCT')) row = { n: 3900 };
      else if (sql.includes("'$.converted'")) row = { n: 42 };
      else if (sql.includes('FROM visits v')) row = { n: 4409 };
      else if (sql.includes('commission_earnings')) row = { s: 750 };
      return { bind: () => ({ first: async () => row }) };
    },
  };

  it('maps each gate query to its field (n for counts, s for money sum)', async () => {
    expect(await computeTotals(mockDb, 't1', 'c1'))
      .toEqual({ signups: 4409, distinctIdentifiers: 3900, qualified: 42, commissionSum: 750 });
  });

  it('null row → 0 (empty table, no NaN)', async () => {
    const emptyDb = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
    expect(await computeTotals(emptyDb, 't1', 'c1'))
      .toEqual({ signups: 0, distinctIdentifiers: 0, qualified: 0, commissionSum: 0 });
  });
});
