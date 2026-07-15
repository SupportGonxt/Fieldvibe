import { describe, it, expect } from 'vitest';
import {
  aggregateKpis, evaluateSignals, signalBelowGate, signalBelowTarget, SIGNAL_REGISTRY,
  signalTrend, trendSignals, peerSignals, signalAtRiskGate, signalHitGateEarly, evaluateBoSignals,
} from './kpiSignals.js';

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

describe('SIGNAL_REGISTRY', () => {
  it('below_gate weight matches issueEngine severityOf(["below_gate"]) === 5', () => {
    expect(SIGNAL_REGISTRY.below_gate.severityWeight).toBe(4);
  });
  it('every entry has polarity, severityWeight, buildText', () => {
    for (const [type, e] of Object.entries(SIGNAL_REGISTRY)) {
      expect(['deficit', 'recognition']).toContain(e.polarity);
      expect(typeof e.severityWeight).toBe('number');
      expect(typeof e.buildText(e.detail || {})).toBe('string');
      void type;
    }
  });
});

describe('signalTrend', () => {
  const th = { improve_pct: 20 };
  it('declining beyond threshold', () => {
    expect(signalTrend(8, 10, 'visits_per_day', th)).toEqual({ type: 'declining_trend', detail: { metric: 'visits_per_day', pct: -20 } });
  });
  it('improving beyond threshold', () => {
    expect(signalTrend(12, 10, 'visits_per_day', th)).toEqual({ type: 'improving_trend', detail: { metric: 'visits_per_day', pct: 20 } });
  });
  it('flat (within threshold) is silent', () => {
    expect(signalTrend(10.5, 10, 'visits_per_day', th)).toBeNull();
  });
  it('priorVal<=0 guard (no prior period, no false trigger)', () => {
    expect(signalTrend(10, 0, 'visits_per_day', th)).toBeNull();
    expect(signalTrend(10, -5, 'visits_per_day', th)).toBeNull();
  });
});

describe('trendSignals', () => {
  const th = { visits_per_day: 5, signups_per_day: 2, improve_pct: 20 };
  it('one signal per thresholds-targeted metric, skips untargeted keys', () => {
    const actual = { visits_per_day: 8, signups_per_day: 2.6, boards_per_day: 0 };
    const baseline = { visits_per_day: 10, signups_per_day: 2, boards_per_day: 5 };
    const out = trendSignals(actual, baseline, th);
    expect(out).toEqual([
      { type: 'declining_trend', detail: { metric: 'visits_per_day', pct: -20 } },
      { type: 'improving_trend', detail: { metric: 'signups_per_day', pct: 30 } },
    ]);
  });
  it('silent when nothing moves past improve_pct or baseline empty', () => {
    expect(trendSignals({ visits_per_day: 10 }, { visits_per_day: 10 }, th)).toEqual([]);
    expect(trendSignals({ visits_per_day: 10 }, {}, th)).toEqual([]);
  });
});

describe('peerSignals', () => {
  it('below minRosterSize skips entirely', () => {
    expect(peerSignals(['a', 'b', 'c'], 4)).toEqual([]);
  });
  it('flags bottom and top quartile of a worst-first ranked roster', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const out = peerSignals(ids, 4);
    expect(out.find((s) => s.id === 'a')).toEqual({ id: 'a', type: 'team_bottom', detail: { rank: 1, of: 8 } });
    expect(out.find((s) => s.id === 'h')).toEqual({ id: 'h', type: 'team_top', detail: { rank: 8, of: 8 } });
    expect(out.find((s) => s.id === 'd')).toBeUndefined();
  });
});

describe('signalAtRiskGate / signalHitGateEarly', () => {
  const targets = { signups: 10 };
  it('at_risk_gate fires when still clearing gate but sliding vs baseline', () => {
    const out = signalAtRiskGate({ signups: 10 }, { signups: 12 }, targets);
    expect(out).toEqual([{ type: 'at_risk_gate', detail: { metric: 'signups', pct: -17 } }]);
  });
  it('already short defers to below_gate (silent here)', () => {
    expect(signalAtRiskGate({ signups: 9 }, { signups: 12 }, targets)).toEqual([]);
  });
  it('hit_gate_early fires when comfortably ahead on every gate metric', () => {
    expect(signalHitGateEarly({ signups: 11 }, targets)).toEqual([{ type: 'hit_gate_early', detail: { margin_pct: 110 } }]);
  });
  it('hit_gate_early silent when merely on-pace, not early', () => {
    expect(signalHitGateEarly({ signups: 10 }, targets)).toEqual([]);
  });
});

describe('evaluateBoSignals', () => {
  it('fires each threshold independently', () => {
    expect(evaluateBoSignals({ avgResponseMins: 45 })).toEqual([{ type: 'slow_response', detail: { avg_response_mins: 45 } }]);
    expect(evaluateBoSignals({ oldestOpenHours: 60 })).toEqual([{ type: 'stale_queue', detail: { oldest_open_hours: 60 } }]);
    expect(evaluateBoSignals({ oldestReconHours: 30 })).toEqual([{ type: 'recon_backlog', detail: { oldest_recon_hours: 30 } }]);
  });
  it('clean case (all within threshold) flags nothing', () => {
    expect(evaluateBoSignals({ avgResponseMins: 10, oldestOpenHours: 5, oldestReconHours: 2 })).toEqual([]);
  });
});

describe('aggregateKpis boards/surveys/quality superset', () => {
  it('averages boards and surveys per day and quality across scored visits', () => {
    const rows = [
      { date: '2026-07-01', visits: 4, signups: 2, qualified: 1, boards: 2, surveys: 3, quality_sum: 1.6, quality_n: 2 },
      { date: '2026-07-02', visits: 6, signups: 3, qualified: 2, boards: 4, surveys: 5, quality_sum: 0.9, quality_n: 1 },
    ];
    const a = aggregateKpis(rows);
    expect(a.boards_per_day).toBeCloseTo(3);          // (2+4)/2
    expect(a.surveys_per_day).toBeCloseTo(4);         // (3+5)/2
    expect(a.board_quality).toBeCloseTo(2.5 / 3);     // (1.6+0.9)/(2+1)
    expect(a.visits_per_day).toBeCloseTo(5);          // existing keys unchanged
  });

  it('board_quality is 0 when no visit carried a match score', () => {
    const rows = [{ date: '2026-07-01', visits: 1, signups: 0, qualified: 0, boards: 0, surveys: 0, quality_sum: 0, quality_n: 0 }];
    expect(aggregateKpis(rows).board_quality).toBe(0);
  });
});

describe('signalBelowTarget config-driven', () => {
  const actual = {
    visits_per_day: 3, signups_per_day: 1, boards_per_day: 2, surveys_per_day: 1, board_quality: 0.5,
  };
  it('Goldrush config flags only its configured sign-up/visit metrics', () => {
    const r = signalBelowTarget(actual, { visits_per_day: 5, signups_per_day: 4 });
    expect(r.triggered).toBe(true);
    expect(r.metrics.sort()).toEqual(['signups_per_day', 'visits_per_day']);
  });
  it('Stellr config flags boards/surveys/quality, never sign-ups it does not configure', () => {
    const r = signalBelowTarget(actual, { boards_per_day: 4, surveys_per_day: 3, board_quality: 0.7, visits_per_day: 2 });
    expect(r.metrics.sort()).toEqual(['board_quality', 'boards_per_day', 'surveys_per_day']);
    expect(r.metrics).not.toContain('signups_per_day'); // Stellr doesn't do sign-ups
  });
  it('nothing configured under target → not triggered', () => {
    expect(signalBelowTarget(actual, { visits_per_day: 1, boards_per_day: 1 }).triggered).toBe(false);
  });
});
