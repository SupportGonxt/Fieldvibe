// workers-api/src/services/kpiSignals.js
// Pure KPI math + underperformance signals. No DB, no I/O. Aggregates on read.
// ponytail: aggregate-on-read; add a rollup table only if roster latency bites.

function safeDiv(n, d) { return d > 0 ? n / d : 0; }

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

export function evaluateSignals({ actual, baseline, daysSinceLastVisit, thresholds }) {
  // Empty window = no activity captured, not underperformance. The zero-fill +
  // fabricated daysSinceLastVisit=999 would trigger below_target + gone_quiet +
  // low_conversion on an agent we have no data for, inflating flagged counts.
  // Insufficient signal → flag nothing. (M-1)
  if (!actual || actual.days === 0) return [];
  const out = [];
  const bt = signalBelowTarget(actual, thresholds);
  if (bt.triggered) out.push({ type: 'below_target', detail: bt });
  const dv = signalDroppedVsBaseline(actual, baseline || {}, thresholds);
  if (dv.triggered) out.push({ type: 'dropped_vs_baseline', detail: dv });
  const gq = signalGoneQuiet(daysSinceLastVisit ?? 0, thresholds);
  if (gq.triggered) out.push({ type: 'gone_quiet', detail: gq });
  const lc = signalLowConversion(actual, thresholds);
  if (lc.triggered) out.push({ type: 'low_conversion', detail: lc });
  return out;
}
