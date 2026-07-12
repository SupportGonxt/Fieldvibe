// workers-api/src/services/kpiSignals.js
// Pure KPI math + underperformance signals. No DB, no I/O. Aggregates on read.
// ponytail: aggregate-on-read; add a rollup table only if roster latency bites.

function safeDiv(n, d) { return d > 0 ? n / d : 0; }

// local minutes-of-day -> "HH:MM", for late_start display only.
function minToClock(min) {
  const h = Math.floor(min / 60) % 24, m = Math.round(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// DB metric keys -> plain English, so signal text reads "daily visits" not "visits_per_day".
// Fallback de-slugs anything unmapped (strips _per_day / _pct, underscores to spaces).
// ponytail: keep in sync with the same map in frontend/src/lib/signalRegistry.ts.
const METRIC_LABELS = {
  visits_per_day: 'daily visits', signups_per_day: 'daily sign-ups',
  conversion_pct: 'conversion rate', qualified_pct: 'qualified rate',
  visits: 'visits', signups: 'sign-ups', deposits: 'deposits', qualified: 'qualified leads',
};
export function metricLabel(key) {
  if (!key) return 'target';
  return METRIC_LABELS[key] ||
    String(key).replace(/_per_day$/, '').replace(/_pct$/, ' rate').replace(/_/g, ' ');
}

// Friendly lowercase phrase per signal type, for notification copy that reads mid-sentence
// ("Signals: gone quiet, behind on incentive pace"). Falls back to the de-slugged type.
const SIGNAL_LABELS = {
  gone_quiet: 'gone quiet', below_gate: 'behind on incentive pace', below_target: 'below target',
  dropped_vs_baseline: 'sign-ups dropped', low_conversion: 'low conversion', late_start: 'late starts',
  short_field_day: 'short field days', idle_gaps: 'idle gaps between stops', excess_travel: 'excess travel',
  declining_trend: 'trending down', improving_trend: 'trending up', team_bottom: 'bottom of the roster',
  team_top: 'top of the roster', at_risk_gate: 'slipping off incentive pace', hit_gate_early: 'cleared the gate early',
  slow_response: 'slow response time', stale_queue: 'stale open queue', recon_backlog: 'reconciliation backlog',
};
export function signalLabel(type) {
  return SIGNAL_LABELS[type] || String(type || '').replace(/_/g, ' ');
}

// Single source of truth for signal display text + severity + polarity, replacing
// three independent frontend hand-rolled switches (IssueQueue.tsx, GmStats.tsx,
// GmOverviewPage.tsx) that all lacked a below_gate case. severityWeight values match
// the old issueEngine.js KIND_WEIGHT exactly (below_gate=4 is load-bearing — see
// issueEngine.js demo()). Actions are dispatched generically by resolveAction, not
// listed per-signal here.
// frontend/src/lib/signalRegistry.ts mirrors the labels/text of this registry — keep in sync.
export const SIGNAL_REGISTRY = {
  gone_quiet: {
    polarity: 'deficit', severityWeight: 5,
    buildText: (d) => `Gone quiet — ${d.daysSinceLastVisit} day${d.daysSinceLastVisit === 1 ? '' : 's'} since last visit`,
  },
  below_gate: {
    polarity: 'deficit', severityWeight: 4,
    buildText: (d) => `Behind on incentive pace for ${metricLabel(d.metric)} — short ${d.shortfall} of ${d.target}`,
  },
  below_target: {
    polarity: 'deficit', severityWeight: 4,
    buildText: (d) => `Below target on ${(d.metrics || []).map(metricLabel).join(', ')}`,
  },
  dropped_vs_baseline: {
    polarity: 'deficit', severityWeight: 3,
    buildText: (d) => `Signups dropped below baseline (floor ${(d.floor || 0).toFixed(1)}/day)`,
  },
  low_conversion: {
    polarity: 'deficit', severityWeight: 2,
    buildText: (d) => `Conversion rate low (${((d.conversion_pct || 0) * 100).toFixed(1)}%)`,
  },
  late_start: {
    polarity: 'deficit', severityWeight: 1,
    buildText: (d) => `Late field start (avg ${minToClock(d.avg_start_min)})`,
  },
  short_field_day: {
    polarity: 'deficit', severityWeight: 1,
    buildText: (d) => `Short field day (avg ${(d.avg_span_min / 60).toFixed(1)}h active)`,
  },
  idle_gaps: {
    polarity: 'deficit', severityWeight: 1,
    buildText: (d) => `Idle gaps between stops (avg ${d.avg_idle_min}min/day)`,
  },
  excess_travel: {
    polarity: 'deficit', severityWeight: 1,
    buildText: (d) => `Excess travel between stops (avg ${d.avg_km_per_hop}km/hop)`,
  },
  declining_trend: {
    polarity: 'deficit', severityWeight: 2,
    buildText: (d) => `${metricLabel(d.metric)} trending down (${d.pct}% vs prior period)`,
  },
  improving_trend: {
    polarity: 'recognition', severityWeight: 2,
    buildText: (d) => `${metricLabel(d.metric)} trending up (${d.pct > 0 ? '+' : ''}${d.pct}% vs prior period)`,
  },
  team_bottom: {
    polarity: 'deficit', severityWeight: 2,
    buildText: (d) => `Bottom of roster (${d.rank} of ${d.of})`,
  },
  team_top: {
    polarity: 'recognition', severityWeight: 2,
    buildText: (d) => `Top of roster (${d.rank} of ${d.of})`,
  },
  at_risk_gate: {
    polarity: 'deficit', severityWeight: 3,
    buildText: (d) => `Slipping off incentive pace for ${metricLabel(d.metric)} (${d.pct}% vs baseline, still clearing today)`,
  },
  hit_gate_early: {
    polarity: 'recognition', severityWeight: 3,
    buildText: () => 'Comfortably clearing every gate metric ahead of schedule',
  },
  slow_response: {
    polarity: 'deficit', severityWeight: 2,
    buildText: (d) => `Slow response time (avg ${d.avg_response_mins}min)`,
  },
  stale_queue: {
    polarity: 'deficit', severityWeight: 3,
    buildText: (d) => `Stale open queue (oldest ${d.oldest_open_hours}h)`,
  },
  recon_backlog: {
    polarity: 'deficit', severityWeight: 3,
    buildText: (d) => `Reconciliation backlog (oldest ${d.oldest_recon_hours}h unverified)`,
  },
};

export function aggregateKpis(rows) {
  const days = rows.length || 0;
  const totV = rows.reduce((a, r) => a + (r.visits || 0), 0);
  const totS = rows.reduce((a, r) => a + (r.signups || 0), 0);
  const totQ = rows.reduce((a, r) => a + (r.qualified || 0), 0);
  return {
    visits_per_day: days ? totV / days : 0,
    signups_per_day: days ? totS / days : 0,
    conversion_pct: safeDiv(totS, totV),
    qualified_pct: safeDiv(totQ, totS),
    days,
  };
}

export function signalBelowTarget(actual, th) {
  const metrics = [];
  if (actual.visits_per_day != null && actual.visits_per_day < th.visits_per_day) metrics.push('visits_per_day');
  if (actual.signups_per_day != null && actual.signups_per_day < th.signups_per_day) metrics.push('signups_per_day');
  return { triggered: metrics.length > 0, metrics };
}

export function signalDroppedVsBaseline(recent, baseline, th) {
  const floor = (baseline.signups_per_day || 0) * (1 - th.drop_pct / 100);
  return { triggered: (recent.signups_per_day || 0) < floor, floor };
}

export function signalGoneQuiet(daysSinceLastVisit, th) {
  return { triggered: daysSinceLastVisit > th.quiet_days, daysSinceLastVisit };
}

export function signalLowConversion(actual, th) {
  return { triggered: (actual.conversion_pct || 0) * 100 < th.conversion_floor_pct,
    conversion_pct: actual.conversion_pct || 0 };
}

// A person trailing the pace needed for their next incentive tier. One signal per gate metric
// still short (shortfall > 0), carrying the metric key, its shortfall, and the target it missed.
// Pure: callers compute nextGate via incentiveService and pass it in. Silent when on/above pace.
export function signalBelowGate({ nextGate }) {
  if (!nextGate) return [];
  return Object.entries(nextGate.shortfall || {})
    .filter(([, short]) => short > 0)
    .map(([metric, shortfall]) => ({
      type: 'below_gate',
      detail: { metric, shortfall, target: nextGate.targets[metric] },
    }));
}

export function evaluateSignals({ actual, baseline, daysSinceLastVisit, thresholds }) {
  // Empty window = no activity captured, not underperformance. The zero-fill +
  // fabricated daysSinceLastVisit=999 would trigger below_target + gone_quiet +
  // low_conversion on an agent we have no data for, inflating flagged counts.
  // Insufficient signal → flag nothing. (M-1)
  if (!actual || actual.days === 0) return [];
  const out = [];
  // gone_quiet keys off recency of the last visit, not sample size — a barely-active
  // agent who then vanished must still flag, so evaluate it regardless of day count.
  const gq = signalGoneQuiet(daysSinceLastVisit ?? 0, thresholds);
  if (gq.triggered) out.push({ type: 'gone_quiet', detail: gq });
  // The rate/volume signals average per active day; below min_days a single slow
  // day would fire them prematurely. Match rootCauseSignals' min_days floor (default 3).
  if (actual.days >= (thresholds.min_days ?? 3)) {
    const bt = signalBelowTarget(actual, thresholds);
    if (bt.triggered) out.push({ type: 'below_target', detail: bt });
    const dv = signalDroppedVsBaseline(actual, baseline || {}, thresholds);
    if (dv.triggered) out.push({ type: 'dropped_vs_baseline', detail: dv });
    const lc = signalLowConversion(actual, thresholds);
    if (lc.triggered) out.push({ type: 'low_conversion', detail: lc });
  }
  return out;
}

// One comparator, two polarities off a single percent delta between a recent and
// prior value for the same metric. priorVal<=0 is undefined territory (division by
// zero, or a brand-new agent with no prior period) — no signal, not a false trigger.
export function signalTrend(recentVal, priorVal, metric, th) {
  if (!(priorVal > 0)) return null;
  const pct = Math.round(((recentVal - priorVal) / priorVal) * 100);
  const improve = th?.improve_pct ?? 20;
  if (pct <= -improve) return { type: 'declining_trend', detail: { metric, pct } };
  if (pct >= improve) return { type: 'improving_trend', detail: { metric, pct } };
  return null;
}

// Bottom quartile of a worst-first ranked roster (by signal count, see kpi.js
// rankRoster) gets flagged; top quartile recognized. Below minRosterSize a quartile
// is 0-1 people — noise, not signal — so skip entirely.
export function peerSignals(rankedIds, minRosterSize = 4) {
  const n = rankedIds.length;
  if (n < minRosterSize) return [];
  const q = Math.max(1, Math.floor(n / 4));
  const out = [];
  rankedIds.forEach((id, i) => {
    if (i < q) out.push({ id, type: 'team_bottom', detail: { rank: i + 1, of: n } });
    else if (i >= n - q) out.push({ id, type: 'team_top', detail: { rank: i + 1, of: n } });
  });
  return out;
}

// Predictive gate-pace signal. Reuses two computeIncentive snapshots the caller already
// has (today's metricByKey, and one from baseline_window_days ago) rather than adding
// new pace machinery to incentiveService.js. Fires when a metric still clears its gate
// today but has fallen >=10% since the baseline snapshot — sliding, not yet short.
// Metrics already short belong to below_gate, not here.
export function signalAtRiskGate(metricByKeyNow, metricByKeyBaseline, targets, th) {
  const declineFloor = (th?.at_risk_decline_pct ?? 10) / 100;
  const out = [];
  for (const [metric, target] of Object.entries(targets || {})) {
    if (!(target > 0)) continue;
    const now = metricByKeyNow?.[metric] ?? 0;
    if (now < target) continue; // already short = below_gate's job
    const before = metricByKeyBaseline?.[metric] ?? 0;
    if (!(before > 0)) continue; // no baseline to compare against
    const pct = (now - before) / before;
    if (pct <= -declineFloor) out.push({ type: 'at_risk_gate', detail: { metric, pct: Math.round(pct * 100) } });
  }
  return out;
}

// Comfortably (>=110% by default) ahead of every gate metric — a recognition signal.
// Silent if any metric is short (below_gate) or merely on-pace (not the same as "early").
export function signalHitGateEarly(metricByKey, targets, th) {
  const entries = Object.entries(targets || {});
  if (!entries.length) return [];
  const margin = (th?.gate_margin_pct ?? 110) / 100;
  const allAhead = entries.every(([metric, target]) => (metricByKey?.[metric] ?? 0) >= target * margin);
  if (!allAhead) return [];
  return [{ type: 'hit_gate_early', detail: { margin_pct: th?.gate_margin_pct ?? 110 } }];
}

// backoffice_admin queue-health signals. No DB: caller supplies avgResponseMins/
// oldestOpenHours (from the existing issues.stats aggregate, BO admin as owner) and
// oldestReconHours (sourced from the same tables deposits.js already reads — issues
// carries no reconciliation-aging data).
export function evaluateBoSignals({ avgResponseMins, oldestOpenHours, oldestReconHours } = {}, th = {}) {
  const out = [];
  if (avgResponseMins != null && avgResponseMins > (th.response_mins ?? 30))
    out.push({ type: 'slow_response', detail: { avg_response_mins: Math.round(avgResponseMins) } });
  if (oldestOpenHours != null && oldestOpenHours > (th.stale_queue_hours ?? 48))
    out.push({ type: 'stale_queue', detail: { oldest_open_hours: Math.round(oldestOpenHours) } });
  if (oldestReconHours != null && oldestReconHours > (th.recon_hours ?? 24))
    out.push({ type: 'recon_backlog', detail: { oldest_recon_hours: Math.round(oldestReconHours) } });
  return out;
}
