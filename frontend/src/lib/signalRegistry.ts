// Mirrors workers-api/src/services/kpiSignals.js SIGNAL_REGISTRY (labels/text only — no
// action/handler dispatch here, that stays server-gated). Keep in sync manually; no monorepo
// linkage between the two. Single source of truth for signal display text on the frontend,
// replacing three independent hand-rolled switches (IssueQueue.tsx, GmStats.tsx,
// GmOverviewPage.tsx) that all lacked a below_gate case.
export type Polarity = 'deficit' | 'recognition'
export type Signal = { type: string; detail: any }

type RegistryEntry = { polarity: Polarity; severityWeight: number; label: string; buildText: (detail: any) => string }

// local minutes-of-day -> "HH:MM", for late_start display only.
function minToClock(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = Math.round(min % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// DB metric keys -> plain English. Mirrors METRIC_LABELS in
// workers-api/src/services/kpiSignals.js — keep in sync.
const METRIC_LABELS: Record<string, string> = {
  visits_per_day: 'daily visits', signups_per_day: 'daily sign-ups',
  conversion_pct: 'conversion rate', qualified_pct: 'qualified rate',
  visits: 'visits', signups: 'sign-ups', deposits: 'deposits', qualified: 'qualified leads',
}
function metricLabel(key: string): string {
  if (!key) return 'target'
  return METRIC_LABELS[key] ||
    String(key).replace(/_per_day$/, '').replace(/_pct$/, ' rate').replace(/_/g, ' ')
}

export const SIGNAL_REGISTRY: Record<string, RegistryEntry> = {
  gone_quiet: {
    polarity: 'deficit', severityWeight: 5, label: 'Gone quiet',
    buildText: (d) => `Gone quiet — ${d.daysSinceLastVisit} day${d.daysSinceLastVisit === 1 ? '' : 's'} since last visit`,
  },
  below_gate: {
    polarity: 'deficit', severityWeight: 4, label: 'Behind on pace',
    buildText: (d) => `Behind on incentive pace for ${metricLabel(d.metric)} — short ${d.shortfall} of ${d.target}`,
  },
  below_target: {
    polarity: 'deficit', severityWeight: 4, label: 'Below target',
    buildText: (d) => `Below target on ${(d.metrics || []).map(metricLabel).join(', ')}`,
  },
  dropped_vs_baseline: {
    polarity: 'deficit', severityWeight: 3, label: 'Dropped vs baseline',
    buildText: (d) => `Signups dropped below baseline (floor ${(d.floor || 0).toFixed(1)}/day)`,
  },
  low_conversion: {
    polarity: 'deficit', severityWeight: 2, label: 'Low conversion',
    buildText: (d) => `Conversion rate low (${((d.conversion_pct || 0) * 100).toFixed(1)}%)`,
  },
  late_start: {
    polarity: 'deficit', severityWeight: 1, label: 'Late starts',
    buildText: (d) => `Late field start (avg ${minToClock(d.avg_start_min)})`,
  },
  short_field_day: {
    polarity: 'deficit', severityWeight: 1, label: 'Short field days',
    buildText: (d) => `Short field day (avg ${(d.avg_span_min / 60).toFixed(1)}h active)`,
  },
  idle_gaps: {
    polarity: 'deficit', severityWeight: 1, label: 'Idle gaps',
    buildText: (d) => `Idle gaps between stops (avg ${d.avg_idle_min}min/day)`,
  },
  excess_travel: {
    polarity: 'deficit', severityWeight: 1, label: 'Excess travel',
    buildText: (d) => `Excess travel between stops (avg ${d.avg_km_per_hop}km/hop)`,
  },
  declining_trend: {
    polarity: 'deficit', severityWeight: 2, label: 'Declining trend',
    buildText: (d) => `${metricLabel(d.metric)} trending down (${d.pct}% vs prior period)`,
  },
  improving_trend: {
    polarity: 'recognition', severityWeight: 2, label: 'Improving trend',
    buildText: (d) => `${metricLabel(d.metric)} trending up (${d.pct > 0 ? '+' : ''}${d.pct}% vs prior period)`,
  },
  team_bottom: {
    polarity: 'deficit', severityWeight: 2, label: 'Bottom of roster',
    buildText: (d) => `Bottom of roster (${d.rank} of ${d.of})`,
  },
  team_top: {
    polarity: 'recognition', severityWeight: 2, label: 'Top of roster',
    buildText: (d) => `Top of roster (${d.rank} of ${d.of})`,
  },
  at_risk_gate: {
    polarity: 'deficit', severityWeight: 3, label: 'Slipping off pace',
    buildText: (d) => `Slipping off incentive pace for ${metricLabel(d.metric)} (${d.pct}% vs baseline, still clearing today)`,
  },
  hit_gate_early: {
    polarity: 'recognition', severityWeight: 3, label: 'Hit gate early',
    buildText: () => 'Comfortably clearing every gate metric ahead of schedule',
  },
  slow_response: {
    polarity: 'deficit', severityWeight: 2, label: 'Slow response',
    buildText: (d) => `Slow response time (avg ${d.avg_response_mins}min)`,
  },
  stale_queue: {
    polarity: 'deficit', severityWeight: 3, label: 'Stale queue',
    buildText: (d) => `Stale open queue (oldest ${d.oldest_open_hours}h)`,
  },
  recon_backlog: {
    polarity: 'deficit', severityWeight: 3, label: 'Recon backlog',
    buildText: (d) => `Reconciliation backlog (oldest ${d.oldest_recon_hours}h unverified)`,
  },
}

// Convenience wrapper for the common case: given a {type, detail}, produce its display text.
// Unknown types (or a buildText that throws on a malformed detail) fall back to the humanized
// type string rather than a generic "Underperformance signal".
export function signalText(s: Signal): string {
  const entry = SIGNAL_REGISTRY[s.type]
  if (!entry) return s.type.replace(/_/g, ' ')
  try {
    return entry.buildText(s.detail ?? {})
  } catch {
    return entry.label
  }
}
