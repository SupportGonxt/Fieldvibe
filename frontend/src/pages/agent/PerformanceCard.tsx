import { useEffect, useState } from 'react'
import { Activity, AlertTriangle } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { signalText, type Signal } from '../../lib/signalRegistry'

// Agent self-performance cockpit tile. Self-fetching (/field-ops/kpi/self),
// renders nothing until data arrives so it never flashes empty. Uses the
// shared mobile-dark styling (bg-white/[0.03], accent #00E87B).

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
type RegistryMetric = { key: string; label: string; value: number; target: number | null; shortfall: number }
type SelfKpi = { actual: Actual; thresholds: Thresholds; signals: Signal[]; metrics?: RegistryMetric[] }

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
        <div className={`h-full rounded-full ${below ? 'bg-amber-400' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function PerformanceCard({ title = 'Your performance' }: { title?: string } = {}) {
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
        <Activity className="w-4 h-4 text-primary" />
        <span className="text-xs text-gray-500 uppercase tracking-wide">{title} · last {actual.days}d</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric label="Visits/day" value={actual.visits_per_day} target={thresholds.visits_per_day} />
        {(d.metrics || []).map((m) => (
          <Metric key={m.key} label={`${m.label}/day`} value={m.value} target={m.target ?? undefined} />
        ))}
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
