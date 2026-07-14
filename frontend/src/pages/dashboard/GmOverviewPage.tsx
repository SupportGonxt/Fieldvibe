import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, Users, Phone, DollarSign, UserCheck, Target,
  RefreshCw, AlertTriangle, Award, UserX, Activity, ChevronRight,
  ChevronLeft, ArrowUpRight, ArrowDownRight, Minus, Briefcase, Headphones,
} from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { MyIssues, UnmanagedIssues } from '../../components/field-ops/IssueQueue'
import { SIGNAL_REGISTRY } from '../../lib/signalRegistry'
import { formatCurrency, formatNumber } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'
import RevenueSparkline, { type TrendPoint } from '../../components/field-ops/RevenueSparkline'

type Period = 'day' | 'week' | 'month'

interface Leader { id: string; name: string; signups: number; converted: number }
interface Agent { id: string; name: string; phone?: string; today?: number; last_activity?: string }
interface Company { id: string; name: string }
interface Team {
  id: string; name: string; managerId: string | null; agents: number; activeAgents: number
  signups: number; converted: number; conversionRate: number
  prev: { signups: number; converted: number }
}
interface Manager { id: string; name: string; teamLeads: number; agents: number; signups: number; converted: number; lastSeen: string | null }
interface BoAdmin { id: string; name: string; calls: number; answered: number; reached: number; durationS: number; lastSeen: string | null }
interface Risk { id: string; severity: 'high' | 'medium'; label: string; detail: string }
interface Overview {
  period: Period
  companyId: string | null
  companies: Company[]
  window: { start: string; end: string; prevStart: string; prevEnd: string; today: string; isCurrent: boolean }
  money: { revenue: number; incentiveCost: number | null; salaryCost: number | null; net: number | null; costsAvailable: boolean; prevRevenue: number }
  funnel: {
    signups: number; converted: number; qualified: number; commissionPerDeposit: number; conversionRate: number
    prev: { signups: number; converted: number; conversionRate: number }
  }
  field: { activeAgents: number; totalAgents: number; leastActive: Agent[]; unassignedAgents: number }
  leaders: Leader[]
  calls: { contacted: number; target: number }
  teams: Team[]
  management: { managers: Manager[]; boAdmins: BoAdmin[] }
  risks: Risk[]
  trend?: TrendPoint[]
}

interface TenantSignals {
  counts: Record<string, number>
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

function agoLabel(iso: string | null): { text: string; stale: boolean } {
  if (!iso) return { text: 'never seen', stale: true }
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return { text: 'today', stale: false }
  if (days === 1) return { text: 'yesterday', stale: false }
  return { text: `${days}d ago`, stale: days >= 7 }
}

function fmtDuration(s: number): string {
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

function Kpi({ icon: Icon, label, value, sub, delta, footer, tone = 'blue' }: {
  icon: any; label: string; value: string; sub?: string; delta?: ReactNode; footer?: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red'
}) {
  const tones: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50', green: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50', red: 'text-red-600 bg-red-50',
  }
  return (
    <div className="card flex items-start justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-content-secondary">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {sub && <p className="text-xs text-content-secondary mt-1">{sub}</p>}
        {delta && <div className="mt-1">{delta}</div>}
        {footer && <div className="mt-2">{footer}</div>}
      </div>
      <div className={`p-2.5 rounded-xl ${tones[tone]}`}><Icon className="w-5 h-5" /></div>
    </div>
  )
}

export default function GmOverviewPage() {
  const [period, setPeriod] = useState<Period>('day')
  const [anchor, setAnchor] = useState<string | null>(null) // null = current period
  const [company, setCompany] = useState<string | null>(null) // null = all companies
  const [expandedManager, setExpandedManager] = useState<string | null>(null)

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
    queryKey: ['gm-overview', period, anchor, company],
    queryFn: async () => (await apiClient.get<Overview & { success: boolean }>(
      `/field-ops/gm/overview?period=${period}${anchor ? `&anchor=${anchor}` : ''}${company ? `&company_id=${company}` : ''}`
    )).data,
    staleTime: 1000 * 60 * 2,
  })

  // Performance signals — independent of the period toggle (fixed baseline window), but
  // company-scoped: pass company_id so the "flagged agents" card matches the selected company
  // (else it counts every agent across all companies in the tenant).
  const { data: signals } = useQuery({
    queryKey: ['gm-tenant-signals', company],
    queryFn: async () => (await apiClient.get<TenantSignals>(
      `/field-ops/kpi/tenant-signals${company ? `?company_id=${company}` : ''}`
    )).data,
    staleTime: 1000 * 60 * 2,
  })

  if (isLoading) return <div className="p-8 flex justify-center"><LoadingSpinner /></div>
  if (error || !data) return <ErrorState message="Could not load the GM overview." onRetry={() => refetch()} />

  const { money, funnel, field, leaders, calls, teams, management, risks, companies } = data
  const callPct = calls.target ? Math.round((calls.contacted / calls.target) * 100) : 0
  const maxTeamSignups = Math.max(1, ...(teams || []).map(t => t.signups))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Business overview</h1>
          <p className="text-content-secondary text-sm">The numbers driving the business right now.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {companies && companies.length > 1 && (
            <div className="inline-flex rounded-xl bg-surface-secondary p-1">
              <button
                onClick={() => setCompany(null)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  company === null ? 'bg-white shadow-sm font-medium' : 'text-content-secondary hover:text-content'
                }`}
              >
                All companies
              </button>
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCompany(c.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    company === c.id ? 'bg-white shadow-sm font-medium' : 'text-content-secondary hover:text-content'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
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
          sub={`${formatNumber(funnel.qualified)} deposits × ${formatCurrency(funnel.commissionPerDeposit)}`}
          delta={<Delta now={money.revenue} prev={money.prevRevenue} suffix={PREV_LABEL[period]} />}
          footer={(data.trend?.length ?? 0) > 0 ? (
            <div>
              <RevenueSparkline trend={data.trend!} className="text-emerald-500" />
              <p className="text-[10px] text-content-secondary mt-0.5">Daily revenue · last 14 days</p>
            </div>
          ) : undefined} />
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

      {/* Risks */}
      {risks && risks.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" /> Risks
          </h2>
          <ul className="space-y-2">
            {risks.map((r) => (
              <li key={r.id} className="flex items-start gap-3 p-2.5 bg-surface-secondary rounded-lg">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${r.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div className="min-w-0">
                  <p className="font-medium text-sm">{r.label}</p>
                  <p className="text-xs text-content-secondary mt-0.5">{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

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
            {Object.entries(signals.counts).map(([key, n]) => (
              <div key={key} className="p-3 rounded-xl bg-surface-secondary">
                <p className={`text-2xl font-semibold ${n > 0 ? 'text-amber-600' : ''}`}>{n}</p>
                <p className="text-xs text-content-secondary mt-1">{SIGNAL_REGISTRY[key]?.label ?? key.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </Link>
      )}

      {/* Accountability — what escalated onto the GM, then who below them is sitting on an issue. */}
      <MyIssues />
      <UnmanagedIssues />

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

      {/* Teams */}
      {teams && teams.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-content-secondary" /> Teams</h2>
            {field.unassignedAgents > 0 && (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                {field.unassignedAgents} agent{field.unassignedAgents === 1 ? '' : 's'} without a team lead
              </span>
            )}
          </div>
          <ul className="space-y-2">
            {teams.map((t) => (
              <li key={t.id} className="p-2.5 bg-surface-secondary rounded-lg">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-sm truncate">{t.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <Delta now={t.signups} prev={t.prev.signups} suffix={PREV_LABEL[period]} />
                    <span className="text-sm font-semibold tabular-nums">{formatNumber(t.signups)}</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(t.signups / maxTeamSignups) * 100}%` }} />
                </div>
                <p className="text-xs text-content-secondary mt-1.5">
                  {t.activeAgents}/{t.agents} agents active · {formatNumber(t.converted)} converted ({t.conversionRate}%)
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Management */}
      {management && (management.managers.length > 0 || management.boAdmins.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Briefcase className="w-4 h-4 text-content-secondary" /> Managers</h2>
            {management.managers.length === 0 ? <p className="text-sm text-content-secondary">No managers on roster.</p> : (
              <ul className="space-y-2">
                {management.managers.map((m) => {
                  const seen = agoLabel(m.lastSeen)
                  const isOpen = expandedManager === m.id
                  const mTeams = (teams || []).filter((t) => t.managerId === m.id)
                  return (
                    <li key={m.id} className="p-2.5 bg-surface-secondary rounded-lg">
                      <button
                        type="button"
                        onClick={() => setExpandedManager(isOpen ? null : m.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-sm truncate">{m.name}</span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-xs ${seen.stale ? 'text-amber-600 font-medium' : 'text-content-secondary'}`}>{seen.text}</span>
                            <ChevronRight className={`w-3.5 h-3.5 text-content-secondary transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                          </span>
                        </div>
                        <p className="text-xs text-content-secondary mt-1">
                          {m.teamLeads} team lead{m.teamLeads === 1 ? '' : 's'} · {m.agents} agents · {formatNumber(m.signups)} sign-ups · {formatNumber(m.converted)} converted
                        </p>
                      </button>
                      {isOpen && (
                        <div className="mt-2 ml-2 pl-3 border-l border-token space-y-1.5">
                          {mTeams.length === 0 ? (
                            <p className="text-xs text-content-secondary">No team leads linked in this period.</p>
                          ) : mTeams.map((t) => (
                            <div key={t.id} className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <span className="text-sm truncate block">{t.name}</span>
                                <span className="text-xs text-content-secondary">{t.activeAgents}/{t.agents} active · {formatNumber(t.converted)} converted ({t.conversionRate}%)</span>
                              </div>
                              <span className="text-sm font-semibold tabular-nums shrink-0">{formatNumber(t.signups)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="card">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Headphones className="w-4 h-4 text-content-secondary" /> Back office</h2>
            {management.boAdmins.length === 0 ? <p className="text-sm text-content-secondary">No back-office activity this period.</p> : (
              <ul className="space-y-2">
                {management.boAdmins.map((b) => {
                  const seen = agoLabel(b.lastSeen)
                  return (
                    <li key={b.id} className="p-2.5 bg-surface-secondary rounded-lg">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-sm truncate">{b.name}</span>
                        <span className={`text-xs shrink-0 ${seen.stale ? 'text-amber-600 font-medium' : 'text-content-secondary'}`}>{seen.text}</span>
                      </div>
                      <p className="text-xs text-content-secondary mt-1">
                        {formatNumber(b.calls)} calls · {formatNumber(b.answered)} answered · {formatNumber(b.reached)} reached · {fmtDuration(b.durationS)}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

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
          {field.leastActive.length === 0 ? (
            <p className="text-sm text-content-secondary">{field.totalAgents === 0 ? 'No agents on roster.' : 'Everyone has activity today.'}</p>
          ) : (
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
