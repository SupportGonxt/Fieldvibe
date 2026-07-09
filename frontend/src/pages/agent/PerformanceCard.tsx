import { useEffect, useState } from 'react'
import { Activity, AlertTriangle } from 'lucide-react'
import { apiClient } from '../../services/api.service'

// Agent self-performance cockpit tile. Self-fetching (/field-ops/kpi/self),
// renders nothing until data arrives so it never flashes empty. Mirrors
// BOTargetCard's mobile-dark styling (bg-white/[0.03], accent #00E87B).

type Actual = {
  visits_per_day: number
  signups_per_day: number
  conversion_pct: number // 0..1
  qualified_pct: number // 0..1
  days: number
}
type Thresholds = {
  visits_per_day?: number
  signups_per_day?: number
  conversion_floor_pct?: number // percent, e.g. 20
}
type Signal = { type: string; detail: any }
type SelfKpi = { actual: Actual; thresholds: Thresholds; signals: Signal[] }

function signalText(s: Signal): string {
  switch (s.type) {
    case 'gone_quiet':
      return `You've gone quiet — ${s.detail?.daysSinceLastVisit ?? '?'} days since your last visit`
    case 'below_target': {
      const m = (s.detail?.metrics || []).map((x: string) => x.replace('_per_day', '/day').replace('_', ' '))
      return `Below target on ${m.join(' & ') || 'your KPIs'}`
    }
    case 'dropped_vs_baseline':
      return 'Your signups have dropped below your recent average'
    case 'low_conversion':
      return `Low conversion rate — ${Math.round((s.detail?.conversion_pct || 0) * 100)}%`
    case 'late_start': {
      const m = s.detail?.avg_start_min ?? 0
      return `Late starts — first check-in averages ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    }
    case 'short_field_day':
      return `Short field days — ${(Math.round((s.detail?.avg_span_min || 0) / 6) / 10)}h between first and last check-in`
    case 'idle_gaps':
      return `Idle gaps — ${Math.round((s.detail?.avg_idle_min || 0) / 60 * 10) / 10}h/day parked with little movement`
    case 'excess_travel':
      return `Excess travel — averaging ${s.detail?.avg_km_per_hop ?? '?'}km between stops`
    default:
      return 'Underperformance signal triggered'
  }
}

function Metric({ label, value, target, suffix = '' }: { label: string; value: number; target?: number; suffix?: string }) {
  const below = target != null && value < target
  const pct = target && target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 100
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${below ? 'text-amber-400' : 'text-white'}`}>
          {value.toFixed(suffix === '%' ? 0 : 1)}{suffix}
          {target != null && <span className="text-gray-600 font-normal"> / {target}{suffix}</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${below ? 'bg-amber-400' : 'bg-[#00E87B]'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function PerformanceCard() {
  const [d, setD] = useState<SelfKpi | null>(null)

  useEffect(() => {
    let live = true
    apiClient
      .get('/field-ops/kpi/self')
      .then((res) => { if (live && res?.data) setD(res.data) })
      .catch(() => {})
    return () => { live = false }
  }, [])

  if (!d || !d.actual?.days) return null
  const { actual, thresholds, signals } = d

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-[#00E87B]" />
        <span className="text-xs text-gray-500 uppercase tracking-wide">Your performance · last {actual.days}d</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric label="Visits/day" value={actual.visits_per_day} target={thresholds.visits_per_day} />
        <Metric label="Signups/day" value={actual.signups_per_day} target={thresholds.signups_per_day} />
        <Metric label="Conversion" value={actual.conversion_pct * 100} target={thresholds.conversion_floor_pct} suffix="%" />
        <Metric label="Qualified" value={actual.qualified_pct * 100} suffix="%" />
      </div>
      {signals.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
          {signals.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-300/90">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{signalText(s)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
