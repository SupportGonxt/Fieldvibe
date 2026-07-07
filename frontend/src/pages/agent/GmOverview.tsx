import { useEffect, useState } from 'react'
import { Loader2, TrendingUp, TrendingDown, Users, Phone, Award, UserX } from 'lucide-react'
import { apiClient } from '../../services/api.service'

// GM mobile business overview. Same payload as the web /dashboard/gm page.
// Costs/net only resolve on the monthly period (costsAvailable flag).

type Period = 'day' | 'week' | 'month'
type Leader = { id: string; name: string; signups: number; converted: number }
type Agent = { id: string; name: string; today?: number }
type Overview = {
  period: Period
  money: { revenue: number; incentiveCost: number | null; salaryCost: number | null; net: number | null; costsAvailable: boolean }
  funnel: { signups: number; converted: number; qualified: number; commissionPerDeposit: number; conversionRate: number }
  field: { activeAgents: number; totalAgents: number; leastActive: Agent[] }
  leaders: Leader[]
  calls: { contacted: number; target: number }
}

const rand = (n: number) => 'R' + Math.round(n).toLocaleString('en-ZA')
const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Today' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' },
]

export default function GmOverview() {
  const [period, setPeriod] = useState<Period>('day')
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient
      .get(`/field-ops/gm/overview?period=${period}`)
      .then((res) => setData(res?.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [period])

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

  const { money, funnel, field, leaders, calls } = data
  const callPct = calls.target ? Math.min(Math.round((calls.contacted / calls.target) * 100), 100) : 0

  return (
    <div className="min-h-screen bg-[#06090F] px-4 pt-6 pb-24">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">Overview</h1>
        <p className="text-sm text-gray-500 mb-5">What's driving the business.</p>

        {/* Period toggle */}
        <div className="flex bg-white/[0.04] border border-white/10 rounded-2xl p-1 mb-6">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                period === p.key ? 'bg-[#00E87B] text-[#0A1628]' : 'text-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Revenue hero */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-4">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Revenue</span>
          <div className="text-4xl font-bold tabular-nums text-[#00E87B] mt-1">{rand(money.revenue)}</div>
          <p className="text-xs text-gray-500 mt-1">{funnel.converted} deposits × {rand(funnel.commissionPerDeposit)}</p>
        </div>

        {/* Net / costs — monthly only */}
        {money.costsAvailable ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl divide-y divide-white/5 mb-4">
            <Row label="Incentive payouts" value={`-${rand(money.incentiveCost || 0)}`} tone="neg" />
            <Row label="Salaries" value={`-${rand(money.salaryCost || 0)}`} tone="neg" />
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
          <Stat label="Sign-ups" value={funnel.signups} sub={`${funnel.qualified} qualified`} />
          <Stat label="Converted" value={funnel.converted} sub={`${funnel.conversionRate}% rate`} />
        </div>

        {/* Field force + calls */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-[#00E87B]" /><span className="text-xs text-gray-500">Active agents</span></div>
            <div className="text-2xl font-bold text-white tabular-nums">{field.activeAgents}<span className="text-gray-600">/{field.totalAgents}</span></div>
            <div className="text-xs text-gray-600 mt-1">active today</div>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1"><Phone className="w-4 h-4 text-[#00E87B]" /><span className="text-xs text-gray-500">BO calls</span></div>
            <div className="text-2xl font-bold text-white tabular-nums">{calls.contacted}<span className="text-gray-600">/{calls.target}</span></div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
              <div className="h-full rounded-full bg-[#00E87B]" style={{ width: `${callPct}%` }} />
            </div>
          </div>
        </div>

        {/* Top performers */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3"><Award className="w-4 h-4 text-[#00E87B]" /><h2 className="text-sm font-semibold text-white">Top performers</h2></div>
          {leaders.length === 0 ? <p className="text-xs text-gray-500">No sign-ups yet this period.</p> : (
            <div className="space-y-2">
              {leaders.map((l, i) => (
                <div key={l.id} className="flex items-center justify-between">
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
                <div key={a.id} className="flex items-center justify-between">
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

function Row({ label, value, tone }: { label: string; value: string; tone: 'pos' | 'neg' }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="text-sm text-white">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${tone === 'pos' ? 'text-white' : 'text-gray-400'}`}>{value}</div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      <div className="text-xs text-gray-600 mt-1">{sub}</div>
    </div>
  )
}
