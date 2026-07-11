import { describe, it, expect } from 'vitest';
import { aggregateKpis, evaluateSignals, signalBelowGate } from './kpiSignals.js';

// Pins the invariants reactToIssues' resolve-gate relies on: a dark or thin window
// yields no rate/volume signals (too little to judge, so the cron holds the issue),
// gone_quiet is exempt from the min_days floor, and a full clean window is a real recovery.
describe('evaluateSignals min_days floor', () => {
  const th = { visits_per_day: 5, signups_per_day: 2, drop_pct: 30, quiet_days: 3, conversion_floor_pct: 10, min_days: 3 };
  const poorDay = { visits: 1, signups: 0, qualified: 0 };
  const goodDay = { visits: 8, signups: 4, qualified: 3 };
  const evalWith = (rows, daysSinceLastVisit, baseline = rows) =>
    evaluateSignals({ actual: aggregateKpis(rows), baseline: aggregateKpis(baseline), daysSinceLastVisit, thresholds: th });

  it('dark window (days 0) flags nothing', () => {
    expect(evalWith([], 1)).toEqual([]);
  });

  it('thin window under min_days flags no rate signals', () => {
    expect(evalWith([poorDay, poorDay], 0)).toEqual([]);
  });

  it('gone_quiet fires even on a thin window (recency, not sample size)', () => {
    expect(evalWith([poorDay, poorDay], 10).map((s) => s.type)).toEqual(['gone_quiet']);
  });

  it('full poor window fires below_target', () => {
    const types = evalWith([poorDay, poorDay, poorDay], 0, [goodDay, goodDay, goodDay]).map((s) => s.type);
    expect(types).toContain('below_target');
  });

  it('full clean window is a real recovery (empty)', () => {
    expect(evalWith([goodDay, goodDay, goodDay], 0)).toEqual([]);
  });
});

describe('signalBelowGate', () => {
  it('below_gate fires one signal per trailing gate metric', () => {
    const ng = { amount: 2500, targets: { signups: 10, deposits: 8 }, shortfall: { signups: 1, deposits: 0 } };
    const out = signalBelowGate({ avgByMetric: { signups: 9, deposits: 8 }, nextGate: ng });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ type: 'below_gate', detail: { metric: 'signups', shortfall: 1, target: 10 } });
  });

  it('below_gate is silent when nothing trails or no next tier', () => {
    expect(signalBelowGate({ avgByMetric: { signups: 99 }, nextGate: null })).toEqual([]);
    const met = { amount: 2500, targets: { signups: 10 }, shortfall: { signups: 0 } };
    expect(signalBelowGate({ avgByMetric: { signups: 10 }, nextGate: met })).toEqual([]);
  });
});
