import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, Users, Phone, DollarSign, UserCheck, Target,
  RefreshCw, AlertTriangle, Award, UserX, Activity, ChevronRight,
  ChevronLeft, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { formatCurrency, formatNumber } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'

type Period = 'day' | 'week' | 'month'

interface Leader { id: string; name: string; signups: number; converted: number }
interface Agent { id: string; name: string; phone?: string; today?: number; last_activity?: string }
interface Overview {
  period: Period
  window: { start: string; end: string; prevStart: string; prevEnd: string; today: string; isCurrent: boolean }
  money: { revenue: number; incentiveCost: number | null; salaryCost: number | null; net: number | null; costsAvailable: boolean; prevRevenue: number }
  funnel: {
    signups: number; converted: number; qualified: number; commissionPerDeposit: number; conversionRate: number
    prev: { signups: number; converted: number; conversionRate: number }
  }
  field: { activeAgents: number; totalAgents: number; leastActive: Agent[] }
  leaders: Leader[]
  calls: { contacted: number; target: number }
}

interface TenantSignals {
  counts: { below_target: number; dropped_vs_baseline: number; gone_quiet: number; low_conversion: number }
  flaggedAgents: number
  totalAgents: number
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

const PREV_LABEL: Record<Period, string> = { day: 'vs prev day', week: 'vs prev week', month: 'vs prev month' }

// Step an anchor date one period back/forward (UTC date math, backend clamps to today).
function shiftAnchor(anchor: string, period: Period, dir: -1 | 1): string {
  const d = new Date(`${anchor}T00:00:00Z`)
  if (period === 'day') d.setUTCDate(d.getUTCDate() + dir)
  else if (period === 'week') d.setUTCDate(d.getUTCDate() + 7 * dir)
  else d.setUTCMonth(d.getUTCMonth() + dir, 1)
  return d.toISOString().slice(0, 10)
}

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const fmtShort = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' })

// Human label for the displayed window (end is exclusive).
function windowLabel(w: Overview['window'], period: Period): string {
  if (period === 'day') return w.start === w.today ? `Today · ${fmtDay(w.start)}` : fmtDay(w.start)
  const last = shiftAnchor(w.end, 'day', -1)
  if (period === 'month') {
    const m = new Date(`${w.start}T00:00:00Z`).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    return w.isCurrent ? `${m} · to date` : m
  }
  return `${fmtShort(w.start)} – ${fmtShort(last)}${w.isCurrent ? ' · to date' : ''}`
}

// Compact vs-previous delta chip.
function Delta({ now, prev, suffix }: { now: number; prev: number; suffix: string }) {
  if (!now && !prev) return null
  if (!prev) return <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600"><ArrowUpRight className="w-3 h-3" />new {suffix}</span>
  const pct = Math.round(((now - prev) / prev) * 100)
  if (pct === 0) return <span className="inline-flex items-center gap-0.5 text-xs text-content-secondary"><Minus className="w-3 h-3" />flat {suffix}</span>
  const up = pct > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {up ? '+' : ''}{pct}% {suffix}
    </span>
  )
}

const SIGNAL_LABELS: { key: keyof TenantSignals['counts']; label: string }[] = [
  { key: 'below_target', label: 'Below target' },
  { key: 'dropped_vs_baseline', label: 'Signups dropped' },
  { key: 'gone_quiet', label: 'Gone quiet' },
  { key: 'low_conversion', label: 'Low conversion' },
]

function Kpi({ icon: Icon, label, value, sub, delta, tone = 'blue' }: {
  icon: any; label: string; value: string; sub?: string; delta?: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red'
}) {
  const tones: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50', green: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50', red: 'text-red-600 bg-red-50',
  }
  return (
    <div className="card flex items-start justify-between">
      <div>
        <p className="text-sm text-content-secondary">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {sub && <p className="text-xs text-content-secondary mt-1">{sub}</p>}
        {delta && <div className="mt-1">{delta}</div>}
      </div>
      <div className={`p-2.5 rounded-xl ${tones[tone]}`}><Icon className="w-5 h-5" /></div>
    </div>
  )
}

export default function GmOverviewPage() {
  const [period, setPeriod] = useState<Period>('day')
  const [anchor, setAnchor] = useState<string | null>(null) // null = current period

  const today = new Date().toISOString().slice(0, 10)
  const atCurrent = !anchor || anchor >= today

  const pickPeriod = (p: Period) => { setPeriod(p); setAnchor(null) }
  const stepBack = () => setAnchor(shiftAnchor(anchor || today, period, -1))
  const stepForward = () => {
    if (atCurrent) return
    const next = shiftAnchor(anchor!, period, 1)
    setAnchor(next >= today ? null : next)
  }

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['gm-overview', period, anchor],
    queryFn: async () => (await apiClient.get<Overview & { success: boolean }>(
      `/field-ops/gm/overview?period=${period}${anchor ? `&anchor=${anchor}` : ''}`
    )).data,
    staleTime: 1000 * 60 * 2,
  })

  // Tenant-wide performance signals — independent of the period toggle (fixed baseline window).
  const { data: signals } = useQuery({
    queryKey: ['gm-tenant-signals'],
    queryFn: async () => (await apiClient.get<TenantSignals>('/field-ops/kpi/tenant-signals')).data,
    staleTime: 1000 * 60 * 2,
  })

  if (isLoading) return <div className="p-8 flex justify-center"><LoadingSpinner /></div>
  if (error || !data) return <ErrorState message="Could not load the GM overview." onRetry={() => refetch()} />

  const { money, funnel, field, leaders, calls } = data
  const callPct = calls.target ? Math.round((calls.contacted / calls.target) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Business overview</h1>
          <p className="text-content-secondary text-sm">The numbers driving the business right now.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-surface-secondary p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => pickPeriod(p.key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  period === p.key ? 'bg-white shadow-sm font-medium' : 'text-content-secondary hover:text-content'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center rounded-xl bg-surface-secondary p-1">
            <button onClick={stepBack} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm" aria-label="Previous period">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-sm font-medium whitespace-nowrap min-w-[9rem] text-center">
              {windowLabel(data.window, period)}
            </span>
            <button
              onClick={stepForward}
              disabled={atCurrent}
              className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none"
              aria-label="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-surface-secondary" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Money */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={DollarSign} tone="green" label="Revenue" value={formatCurrency(money.revenue)}
          sub={`${formatNumber(funnel.converted)} deposits × ${formatCurrency(funnel.commissionPerDeposit)}`}
          delta={<Delta now={money.revenue} prev={money.prevRevenue} suffix={PREV_LABEL[period]} />} />
        {money.costsAvailable ? (
          <>
            <Kpi icon={TrendingUp} tone="amber" label="Incentive cost" value={formatCurrency(money.incentiveCost || 0)} />
            <Kpi icon={Users} tone="amber" label="Salary cost" value={formatCurrency(money.salaryCost || 0)} />
            <Kpi icon={TrendingUp} tone={(money.net || 0) >= 0 ? 'green' : 'red'} label="Net" value={formatCurrency(money.net || 0)} />
          </>
        ) : (
          <div className="card sm:col-span-2 lg:col-span-3 flex items-center gap-3 text-content-secondary">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <span className="text-sm">Cost &amp; net figures are computed monthly. Switch to <strong>Month</strong> to see the full P&amp;L.</span>
          </div>
        )}
      </div>

      {/* Funnel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={UserCheck} label="Sign-ups" value={formatNumber(funnel.signups)}
          delta={<Delta now={funnel.signups} prev={funnel.prev.signups} suffix={PREV_LABEL[period]} />} />
        <Kpi icon={Target} tone="green" label="Converted" value={formatNumber(funnel.converted)}
          sub={`${funnel.conversionRate}% conversion`}
          delta={<Delta now={funnel.converted} prev={funnel.prev.converted} suffix={PREV_LABEL[period]} />} />
        <Kpi icon={Award} label="Qualified" value={formatNumber(funnel.qualified)} />
        <Kpi icon={Users} tone={field.activeAgents ? 'green' : 'red'} label="Agents active"
          value={`${field.activeAgents}/${field.totalAgents}`} sub="active today" />
      </div>

      {/* Performance cockpit — tenant-wide underperformance signals, links to team drill */}
      {signals && (
        <Link to="/field-operations/team-cockpit" className="card block hover:bg-surface-secondary transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-content-secondary" />
              <h2 className="font-semibold">Performance signals</h2></div>
            <span className="flex items-center gap-1 text-sm text-content-secondary">
              {signals.flaggedAgents}/{signals.totalAgents} agents flagged <ChevronRight className="w-4 h-4" />
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SIGNAL_LABELS.map(({ key, label }) => {
              const n = signals.counts[key]
              return (
                <div key={key} className="p-3 rounded-xl bg-surface-secondary">
                  <p className={`text-2xl font-semibold ${n > 0 ? 'text-amber-600' : ''}`}>{n}</p>
                  <p className="text-xs text-content-secondary mt-1">{label}</p>
                </div>
              )
            })}
          </div>
        </Link>
      )}

      {/* BO calls */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-content-secondary" />
            <h2 className="font-semibold">Back-office calls today</h2></div>
          <span className="text-sm text-content-secondary">{formatNumber(calls.contacted)} / {formatNumber(calls.target)} target</span>
        </div>
        <div className="h-2 rounded-full bg-surface-secondary overflow-hidden">
          <div className={`h-full rounded-full ${callPct >= 100 ? 'bg-emerald-500' : callPct >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`}
            style={{ width: `${Math.min(callPct, 100)}%` }} />
        </div>
        <p className="text-xs text-content-secondary mt-2">{callPct}% of daily call target reached.</p>
      </div>

      {/* Leaders + least active */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Award className="w-4 h-4 text-emerald-600" /> Top performers</h2>
          {leaders.length === 0 ? <p className="text-sm text-content-secondary">No sign-ups yet this period.</p> : (
            <ul className="space-y-2">
              {leaders.map((l, i) => (
                <li key={l.id} className="flex items-center justify-between p-2.5 bg-surface-secondary rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                    <span className="font-medium">{l.name}</span>
                  </div>
                  <span className="text-sm text-content-secondary">{formatNumber(l.signups)} sign-ups · {formatNumber(l.converted)} conv.</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><UserX className="w-4 h-4 text-amber-600" /> Needs attention</h2>
          {field.leastActive.length === 0 ? <p className="text-sm text-content-secondary">No agents on roster.</p> : (
            <ul className="space-y-2">
              {field.leastActive.map((a) => (
                <li key={a.id} className="flex items-center justify-between p-2.5 bg-surface-secondary rounded-lg">
                  <span className="font-medium">{a.name}</span>
                  <span className={`text-sm ${(a.today || 0) > 0 ? 'text-content-secondary' : 'text-amber-600'}`}>
                    {(a.today || 0) > 0 ? `${a.today} today` : 'nothing today'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
