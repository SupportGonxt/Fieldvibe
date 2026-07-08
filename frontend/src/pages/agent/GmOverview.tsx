import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, TrendingUp, TrendingDown, Users, Phone, Award, UserX,
  AlertTriangle, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight,
  Minus, Briefcase, Headphones,
} from 'lucide-react'
import { apiClient } from '../../services/api.service'

// GM mobile cockpit. Same payload as the web /dashboard/gm page.
// Journey: pick company/period -> pulse (revenue, funnel) -> risks ->
// teams -> management (managers + BO admins) -> individuals.
// Costs/net only resolve on the monthly period (costsAvailable flag).

type Period = 'day' | 'week' | 'month'
type Leader = { id: string; name: string; signups: number; converted: number }
type FieldAgent = { id: string; name: string; today?: number }
type Company = { id: string; name: string }
type Team = {
  id: string; name: string; managerId: string | null
  agents: number; activeAgents: number
  signups: number; converted: number; conversionRate: number
  prev: { signups: number; converted: number }
}
type Manager = {
  id: string; name: string; teamLeads: number; agents: number
  signups: number; converted: number; lastSeen: string | null
}
type BoAdmin = {
  id: string; name: string; calls: number; answered: number
  reached: number; durationS: number; lastSeen: string | null
}
type Risk = { id: string; severity: 'high' | 'medium' | string; label: string; detail: string }
type Overview = {
  period: Period
  companyId: string | null
  companies: Company[]
  window: { start: string; end: string; prevStart: string; prevEnd: string; today: string; isCurrent: boolean }
  money: { revenue: number; incentiveCost: number | null; salaryCost: number | null; net: number | null; costsAvailable: boolean; prevRevenue: number }
  funnel: { signups: number; converted: number; qualified: number; commissionPerDeposit: number; conversionRate: number; prev: { signups: number; converted: number; conversionRate: number } }
  field: { activeAgents: number; totalAgents: number; leastActive: FieldAgent[]; unassignedAgents: number }
  leaders: Leader[]
  calls: { contacted: number; target: number }
  teams: Team[]
  management: { managers: Manager[]; boAdmins: BoAdmin[] }
  risks: Risk[]
}

const rand = (n: number) => 'R' + Math.round(n).toLocaleString('en-ZA')
const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Today' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' },
]

function shiftAnchor(current: string | null, period: Period, dir: -1 | 1): string | null {
  const base = current ? new Date(current + 'T00:00:00Z') : new Date()
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()))
  if (period === 'day') d.setUTCDate(d.getUTCDate() + dir)
  else if (period === 'week') d.setUTCDate(d.getUTCDate() + dir * 7)
  else d.setUTCMonth(d.getUTCMonth() + dir)
  const iso = d.toISOString().slice(0, 10)
  return iso >= new Date().toISOString().slice(0, 10) ? null : iso
}

const fmtDay = (s: string) =>
  new Date(s + 'T00:00:00Z').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function windowLabel(w: Overview['window'], period: Period): string {
  if (period === 'day') return w.isCurrent ? 'Today' : fmtDay(w.start)
  const last = new Date(w.end + 'T00:00:00Z')
  last.setUTCDate(last.getUTCDate() - 1)
  const endStr = fmtDay(last.toISOString().slice(0, 10))
  return `${fmtDay(w.start)} – ${endStr}${w.isCurrent ? ' (to date)' : ''}`
}

function agoLabel(iso: string | null): { text: string; stale: boolean } {
  if (!iso) return { text: 'never seen', stale: true }
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return { text: 'today', stale: false }
  if (days === 1) return { text: 'yesterday', stale: false }
  return { text: `${days}d ago`, stale: days >= 7 }
}

export default function GmOverview() {
  const [period, setPeriod] = useState<Period>('day')
  const [anchor, setAnchor] = useState<string | null>(null)
  const [company, setCompany] = useState<string | null>(null)
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    const qs = `period=${period}${anchor ? `&anchor=${anchor}` : ''}${company ? `&company_id=${company}` : ''}`
    apiClient
      .get(`/field-ops/gm/overview?${qs}`)
      .then((res) => setData(res?.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [period, anchor, company])

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#00E87B] animate-spin" />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-[#06090F] px-4 pt-6 text-center">
        <p className="text-gray-500 mt-20">No overview data available.</p>
      </div>
    )
  }

  const { money, funnel, field, leaders, calls, teams, management, risks, companies } = data
  const callPct = calls.target ? Math.min(Math.round((calls.contacted / calls.target) * 100), 100) : 0
  const maxTeamSignups = Math.max(1, ...teams.map((t) => t.signups))

  return (
    <div className="min-h-screen bg-[#06090F] px-4 pt-6 pb-24">
      <div className={`max-w-md mx-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
        <h1 className="text-2xl font-bold text-white mb-1">Overview</h1>
        <p className="text-sm text-gray-500 mb-4">What's driving the business.</p>

        {/* Company selector */}
        {companies.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-4 px-4">
            <CompanyChip label="All companies" active={company === null} onClick={() => setCompany(null)} />
            {companies.map((c) => (
              <CompanyChip key={c.id} label={c.name} active={company === c.id} onClick={() => setCompany(c.id)} />
            ))}
          </div>
        )}

        {/* Period toggle */}
        <div className="flex bg-white/[0.04] border border-white/10 rounded-2xl p-1 mb-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => { setPeriod(p.key); setAnchor(null) }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                period === p.key ? 'bg-[#00E87B] text-[#0A1628]' : 'text-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Window stepper */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setAnchor(shiftAnchor(anchor ?? data.window.start, period, -1) ?? shiftAnchor(null, period, -1))}
            className="p-2 -ml-2 text-gray-400 active:text-white"
            aria-label="Previous period"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-medium text-gray-400 tabular-nums">{windowLabel(data.window, period)}</span>
          <button
            onClick={() => setAnchor(anchor ? shiftAnchor(anchor, period, 1) : null)}
            disabled={!anchor}
            className="p-2 -mr-2 text-gray-400 active:text-white disabled:opacity-30"
            aria-label="Next period"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Revenue hero */}
        <div onClick={() => navigate('/agent/pnl')} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-4 cursor-pointer active:bg-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Revenue</span>
            <Delta now={money.revenue} prev={money.prevRevenue} money />
          </div>
          <div className="text-4xl font-bold tabular-nums text-[#00E87B] mt-1">{rand(money.revenue)}</div>
          <p className="text-xs text-gray-500 mt-1">{funnel.converted} deposits × {rand(funnel.commissionPerDeposit)}</p>
        </div>

        {/* Risks */}
        {risks.length > 0 && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Risks</h2>
            </div>
            <div className="space-y-3">
              {risks.map((r) => (
                <div key={r.id} className="flex items-start gap-2.5">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.severity === 'high' ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <div className="min-w-0">
                    <div className="text-sm text-white leading-snug">{r.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Net / costs — monthly only */}
        {money.costsAvailable ? (
          <div onClick={() => navigate('/agent/pnl')} className="bg-white/[0.03] border border-white/10 rounded-2xl divide-y divide-white/5 mb-4 cursor-pointer active:bg-white/[0.06]">
            <Row label="Incentive payouts" value={`-${rand(money.incentiveCost || 0)}`} />
            <Row label="Salaries" value={`-${rand(money.salaryCost || 0)}`} />
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-2">
                {(money.net || 0) >= 0 ? <TrendingUp className="w-4 h-4 text-[#00E87B]" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                <span className="text-sm text-white">Net</span>
              </div>
              <span className={`text-base font-semibold tabular-nums ${(money.net || 0) >= 0 ? 'text-[#00E87B]' : 'text-red-400'}`}>{rand(money.net || 0)}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 mb-4 px-1">Cost &amp; net figures are monthly — switch to <span className="text-gray-300 font-medium">Month</span> for the full P&amp;L.</p>
        )}

        {/* Funnel stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label="Sign-ups" value={funnel.signups} sub={`${funnel.qualified} qualified`} delta={<Delta now={funnel.signups} prev={funnel.prev.signups} />} onClick={() => navigate('/agent/pnl')} />
          <Stat label="Converted" value={funnel.converted} sub={`${funnel.conversionRate}% rate`} delta={<Delta now={funnel.converted} prev={funnel.prev.converted} />} onClick={() => navigate('/agent/pnl')} />
        </div>

        {/* Field force + calls */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-[#00E87B]" /><span className="text-xs text-gray-500">Active agents</span></div>
            <div className="text-2xl font-bold text-white tabular-nums">{field.activeAgents}<span className="text-gray-600">/{field.totalAgents}</span></div>
            <div className="text-xs text-gray-600 mt-1">
              {field.unassignedAgents > 0 ? <span className="text-amber-400">{field.unassignedAgents} without team lead</span> : 'active today'}
            </div>
          </div>
          <div onClick={() => navigate('/agent/call-list')} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 cursor-pointer active:bg-white/[0.06]">
            <div className="flex items-center gap-2 mb-1"><Phone className="w-4 h-4 text-[#00E87B]" /><span className="text-xs text-gray-500">BO calls</span></div>
            <div className="text-2xl font-bold text-white tabular-nums">{calls.contacted}<span className="text-gray-600">/{calls.target}</span></div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
              <div className="h-full rounded-full bg-[#00E87B]" style={{ width: `${callPct}%` }} />
            </div>
          </div>
        </div>

        {/* Teams */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-[#00E87B]" /><h2 className="text-sm font-semibold text-white">Teams</h2></div>
          {teams.length === 0 ? <p className="text-xs text-gray-500">No team leads set up yet.</p> : (
            <div className="space-y-3.5">
              {teams.map((t) => (
                <div key={t.id} onClick={() => navigate(`/agent/team-detail/${t.id}`)} className="cursor-pointer active:opacity-70">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white truncate mr-2">{t.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-white tabular-nums">{t.signups}</span>
                      <Delta now={t.signups} prev={t.prev.signups} />
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-1">
                    <div className="h-full rounded-full bg-[#00E87B]/70" style={{ width: `${Math.round((t.signups / maxTeamSignups) * 100)}%` }} />
                  </div>
                  <div className="text-xs text-gray-500 tabular-nums">
                    {t.activeAgents}/{t.agents} agents active · {t.converted} converted ({t.conversionRate}%)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Managers — static rows; ponytail: no manager-detail page exists yet, add nav when one does */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3"><Briefcase className="w-4 h-4 text-[#00E87B]" /><h2 className="text-sm font-semibold text-white">Managers</h2></div>
          {management.managers.length === 0 ? <p className="text-xs text-gray-500">No managers on roster.</p> : (
            <div className="space-y-2.5">
              {management.managers.map((m) => {
                const seen = agoLabel(m.lastSeen)
                return (
                  <div key={m.id} className="flex items-center justify-between">
                    <div className="min-w-0 mr-2">
                      <div className="text-sm text-white truncate">{m.name}</div>
                      <div className="text-xs text-gray-500 tabular-nums">{m.teamLeads} team leads · {m.agents} agents · {m.signups} sign-ups</div>
                    </div>
                    <span className={`text-xs flex-shrink-0 ${seen.stale ? 'text-amber-400' : 'text-gray-500'}`}>{seen.text}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Back office */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3"><Headphones className="w-4 h-4 text-[#00E87B]" /><h2 className="text-sm font-semibold text-white">Back office</h2></div>
          {management.boAdmins.length === 0 ? <p className="text-xs text-gray-500">No back-office staff on roster.</p> : (
            <div className="space-y-2.5">
              {management.boAdmins.map((b) => {
                const seen = agoLabel(b.lastSeen)
                return (
                  <div key={b.id} onClick={() => navigate('/agent/call-list')} className="flex items-center justify-between cursor-pointer active:opacity-70">
                    <div className="min-w-0 mr-2">
                      <div className="text-sm text-white truncate">{b.name}</div>
                      <div className="text-xs text-gray-500 tabular-nums">
                        {b.calls} calls · {b.answered} answered · {b.reached} reached{b.durationS > 0 ? ` · ${Math.round(b.durationS / 60)}m` : ''}
                      </div>
                    </div>
                    <span className={`text-xs flex-shrink-0 ${seen.stale ? 'text-amber-400' : 'text-gray-500'}`}>{seen.text}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top performers */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3"><Award className="w-4 h-4 text-[#00E87B]" /><h2 className="text-sm font-semibold text-white">Top performers</h2></div>
          {leaders.length === 0 ? <p className="text-xs text-gray-500">No sign-ups yet this period.</p> : (
            <div className="space-y-2">
              {leaders.map((l, i) => (
                <div key={l.id} onClick={() => navigate(`/agent/agent-detail/${l.id}`)} className="flex items-center justify-between cursor-pointer active:opacity-70">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#00E87B]/15 text-[#00E87B] text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm text-white">{l.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 tabular-nums">{l.signups} · {l.converted} conv.</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Needs attention */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3"><UserX className="w-4 h-4 text-amber-400" /><h2 className="text-sm font-semibold text-white">Needs attention</h2></div>
          {field.leastActive.length === 0 ? <p className="text-xs text-gray-500">No agents on roster.</p> : (
            <div className="space-y-2">
              {field.leastActive.map((a) => (
                <div key={a.id} onClick={() => navigate(`/agent/agent-detail/${a.id}`)} className="flex items-center justify-between cursor-pointer active:opacity-70">
                  <span className="text-sm text-white">{a.name}</span>
                  <span className={`text-xs tabular-nums ${(a.today || 0) > 0 ? 'text-gray-500' : 'text-amber-400'}`}>
                    {(a.today || 0) > 0 ? `${a.today} today` : 'nothing today'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CompanyChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        active ? 'bg-[#00E87B] text-[#0A1628] border-[#00E87B]' : 'bg-white/[0.04] text-gray-400 border-white/10'
      }`}
    >
      {label}
    </button>
  )
}

function Delta({ now, prev, money }: { now: number; prev: number; money?: boolean }) {
  if (!prev && !now) return null
  const pct = prev ? Math.round(((now - prev) / prev) * 100) : null
  const up = now > prev, flat = now === prev
  const text = pct === null ? 'new' : flat ? '0%' : `${pct > 0 ? '+' : ''}${pct}%`
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${
      flat ? 'text-gray-500' : up ? 'text-emerald-400' : 'text-red-400'
    }`} title={money ? `prev ${rand(prev)}` : `prev ${prev}`}>
      <Icon className="w-3 h-3" />{text}
    </span>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="text-sm text-white">{label}</div>
      <div className="text-base font-semibold tabular-nums text-gray-400">{value}</div>
    </div>
  )
}

function Stat({ label, value, sub, delta, onClick }: { label: string; value: number; sub: string; delta?: React.ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-white/[0.03] border border-white/10 rounded-2xl p-4 ${onClick ? 'cursor-pointer active:bg-white/[0.06]' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
        {delta}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      <div className="text-xs text-gray-600 mt-1">{sub}</div>
    </div>
  )
}
