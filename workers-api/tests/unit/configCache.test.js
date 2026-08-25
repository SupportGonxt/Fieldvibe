import { describe, it, expect, beforeEach } from 'vitest';
import { getConfig, getScale, invalidateConfigCache } from '../../src/routes/field-ops/config.js';

// Counts D1 round trips. The GM overview's per-agent incentive fan-out called
// getConfig/getScale once per agent for rows that are identical across agents;
// these tests fail if that de-duplication regresses.
function countingDb(rows) {
  const db = {
    queries: [],
    prepare(sql) {
      db.queries.push(sql);
      return {
        bind(...args) {
          return {
            async first() {
              return rows(sql, args);
            },
          };
        },
      };
    },
  };
  return db;
}

const configRow = () => ({ value_json: JSON.stringify({ agent: 0, team_lead: 0 }) });
const scaleRow = () => ({
  tiers_json: JSON.stringify([{ amount: 1500, targets: { signups: 8 } }]),
  metric: 'signups_deposits',
  basis: 'working_days',
  period: 'month',
});

beforeEach(() => invalidateConfigCache());

describe('config resolver cache', () => {
  it('reads program_config once for repeated identical lookups', async () => {
    const db = countingDb(configRow);
    for (let i = 0; i < 20; i++) {
      expect(await getConfig(db, 't1', 'c1', 'role_base_salary')).toEqual({ agent: 0, team_lead: 0 });
    }
    expect(db.queries.length).toBe(1);
  });

  it('reads incentive_scales once per role, not once per caller', async () => {
    const db = countingDb(scaleRow);
    for (let i = 0; i < 20; i++) await getScale(db, 't1', 'c1', 'agent');
    for (let i = 0; i < 20; i++) await getScale(db, 't1', 'c1', 'team_lead');
    expect(db.queries.length).toBe(2);
  });

  it('never serves one tenant/company/key from another cache slot', async () => {
    const db = countingDb((sql, args) => ({ value_json: JSON.stringify(args.join('|')) }));
    const a = await getConfig(db, 't1', 'c1', 'k');
    const b = await getConfig(db, 't2', 'c1', 'k');
    const c = await getConfig(db, 't1', 'c2', 'k');
    const d = await getConfig(db, 't1', 'c1', 'other');
    expect(new Set([a, b, c, d]).size).toBe(4);
    expect(db.queries.length).toBe(4);
  });

  it('caches raw column text, so a caller mutating its result cannot poison the next read', async () => {
    const db = countingDb(configRow);
    const first = await getConfig(db, 't1', 'c1', 'role_base_salary');
    first.agent = 99999;
    delete first.team_lead;
    expect(await getConfig(db, 't1', 'c1', 'role_base_salary')).toEqual({ agent: 0, team_lead: 0 });
    expect(db.queries.length).toBe(1);
  });

  it('re-reads after invalidateConfigCache so an admin write is visible', async () => {
    let value = 22;
    const db = countingDb(() => ({ value_json: JSON.stringify(value) }));
    expect(await getConfig(db, 't1', 'c1', 'working_days_in_month')).toBe(22);
    value = 18;
    expect(await getConfig(db, 't1', 'c1', 'working_days_in_month')).toBe(22); // still cached
    invalidateConfigCache();
    expect(await getConfig(db, 't1', 'c1', 'working_days_in_month')).toBe(18);
    expect(db.queries.length).toBe(2);
  });

  it('caches a missing row as null without re-querying', async () => {
    const db = countingDb(() => null);
    expect(await getConfig(db, 't1', 'c1', 'absent')).toBe(null);
    expect(await getConfig(db, 't1', 'c1', 'absent')).toBe(null);
    expect(db.queries.length).toBe(1);
  });
});
