// workers-api/tests/unit/kpiSignals.test.js
import { describe, it, expect } from 'vitest';
import {
  aggregateKpis, signalBelowTarget, signalDroppedVsBaseline,
  signalGoneQuiet, signalLowConversion, evaluateSignals,
} from '../../src/services/kpiSignals.js';

const TH = { visits_per_day: 20, signups_per_day: 10, conversion_floor_pct: 25,
  qualified_floor_pct: 50, drop_pct: 40, quiet_days: 2, baseline_window_days: 14 };

describe('aggregateKpis', () => {
  it('averages and guards divide-by-zero', () => {
    const r = aggregateKpis([
      { date: '2026-07-01', visits: 20, signups: 10, qualified: 5 },
      { date: '2026-07-02', visits: 10, signups: 4, qualified: 2 },
    ]);
    expect(r.visits_per_day).toBe(15);
    expect(r.signups_per_day).toBe(7);
    expect(r.conversion_pct).toBeCloseTo(14 / 30);
    expect(r.qualified_pct).toBeCloseTo(7 / 14);
    expect(r.days).toBe(2);
  });
  it('no visits → zero conversion, no NaN', () => {
    const r = aggregateKpis([{ date: 'd', visits: 0, signups: 0, qualified: 0 }]);
    expect(r.conversion_pct).toBe(0);
    expect(r.qualified_pct).toBe(0);
  });
});

describe('signals', () => {
  it('below-target lists each metric under floor', () => {
    const s = signalBelowTarget({ visits_per_day: 12, signups_per_day: 11 }, TH);
    expect(s.triggered).toBe(true);
    expect(s.metrics).toContain('visits_per_day');
    expect(s.metrics).not.toContain('signups_per_day');
  });
  it('dropped-vs-baseline is self-relative', () => {
    const s = signalDroppedVsBaseline({ signups_per_day: 5 }, { signups_per_day: 10 }, TH);
    expect(s.triggered).toBe(true); // 5 < 10*0.6=6
    const s2 = signalDroppedVsBaseline({ signups_per_day: 7 }, { signups_per_day: 10 }, TH);
    expect(s2.triggered).toBe(false); // 7 >= 6
  });
  it('gone-quiet fires past quiet_days', () => {
    expect(signalGoneQuiet(3, TH).triggered).toBe(true);
    expect(signalGoneQuiet(2, TH).triggered).toBe(false);
  });
  it('low-conversion fires under floor', () => {
    expect(signalLowConversion({ conversion_pct: 0.2 }, TH).triggered).toBe(true);  // 20% < 25%
    expect(signalLowConversion({ conversion_pct: 0.3 }, TH).triggered).toBe(false);
  });
  it('evaluateSignals collects all triggered', () => {
    const out = evaluateSignals({
      actual: { visits_per_day: 12, signups_per_day: 5, conversion_pct: 0.2 },
      baseline: { signups_per_day: 10 }, daysSinceLastVisit: 3, thresholds: TH,
    });
    const types = out.map(s => s.type).sort();
    expect(types).toEqual(['below_target', 'dropped_vs_baseline', 'gone_quiet', 'low_conversion']);
  });
  it('empty window (days=0) flags nothing — no fabricated signals (M-1)', () => {
    const out = evaluateSignals({
      actual: aggregateKpis([]), baseline: aggregateKpis([]),
      daysSinceLastVisit: 999, thresholds: TH,
    });
    expect(out).toEqual([]);
  });
});
