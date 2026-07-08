import { useEffect, useState } from 'react'
import { Loader2, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { apiClient } from '../../services/api.service'

// GM mobile P&L. Confirmed view = money cleared through reconciliation; projected view =
// on-pace at current activity. Revenue = converted deposits x commission; cost = incentives + salaries.

type Pnl = {
  period: string
  commissionPerDeposit: number
  signups: number
  converted: number
  qualifiedSignups: number
  qualifiedConverted: number
  revenue: number
  incentiveCost: number
  salaryCost: number
  boAdminCount?: number
  boAdminSalary?: number
  boAdminCost?: number
  fieldAgentCount?: number
  phonePerAgent?: number
  phoneCost?: number
  net: number
  projectedRevenue: number
  projectedIncentiveCost: number
  projectedNet: number
}

const rand = (n: number) =>
  'R' + Math.round(n).toLocaleString('en-ZA')

export default function GMPnl() {
  const [pnl, setPnl] = useState<Pnl | null>(null)
  const [loading, setLoading] = useState(true)
  const [projected, setProjected] = useState(false)

  useEffect(() => {
    apiClient
      .get('/field-ops/incentives/pnl')
      .then((res) => setPnl(res?.data?.pnl ?? null))
      .catch(() => setPnl(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#00E87B] animate-spin" />
      </div>
    )
  }

  if (!pnl) {
    return (
      <div className="min-h-screen bg-[#06090F] px-4 pt-6 pb-24 text-center">
        <p className="text-gray-500 mt-20">No P&amp;L data available.</p>
      </div>
    )
  }

  const revenue = projected ? pnl.projectedRevenue : pnl.revenue
  const incentive = projected ? pnl.projectedIncentiveCost : pnl.incentiveCost
  const net = projected ? pnl.projectedNet : pnl.net
  const positive = net >= 0

  return (
    <div className="min-h-screen bg-[#06090F] px-4 pt-6 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-6 h-6 text-[#00E87B]" />
          <h1 className="text-2xl font-bold text-white">P&amp;L</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">{pnl.period}</p>

        {/* Confirmed / Projected toggle */}
        <div className="flex bg-white/[0.04] border border-white/10 rounded-2xl p-1 mb-6">
          {[
            { key: false, label: 'Confirmed' },
            { key: true, label: 'On pace' },
          ].map((t) => (
            <button
              key={String(t.key)}
              onClick={() => setProjected(t.key)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                projected === t.key ? 'bg-[#00E87B] text-[#0A1628]' : 'text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Net hero */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-1">
            {positive ? (
              <TrendingUp className="w-5 h-5 text-[#00E87B]" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
            <span className="text-xs text-gray-500 uppercase tracking-wide">Net</span>
          </div>
          <div className={`text-4xl font-bold tabular-nums ${positive ? 'text-[#00E87B]' : 'text-red-400'}`}>
            {rand(net)}
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl divide-y divide-white/5">
          <Row label="Revenue" sub={`${projected ? pnl.converted : pnl.qualifiedConverted} deposits × ${rand(pnl.commissionPerDeposit)}`} value={rand(revenue)} tone="pos" />
          <Row label="Incentive payouts" value={`-${rand(incentive)}`} tone="neg" />
          <Row label="Salaries" value={`-${rand(pnl.salaryCost)}`} tone="neg" />
          {(pnl.boAdminCost ?? 0) > 0 && (
            <Row label="Back office" sub={`${pnl.boAdminCount} admins × ${rand(pnl.boAdminSalary ?? 0)}`} value={`-${rand(pnl.boAdminCost ?? 0)}`} tone="neg" />
          )}
          {(pnl.phoneCost ?? 0) > 0 && (
            <Row label="Phones" sub={`${pnl.fieldAgentCount} agents × ${rand(pnl.phonePerAgent ?? 0)}`} value={`-${rand(pnl.phoneCost ?? 0)}`} tone="neg" />
          )}
        </div>

        {/* Activity */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Stat label="Signups" value={pnl.signups} sub={`${pnl.qualifiedSignups} qualified`} />
          <Stat label="Converted" value={pnl.converted} sub={`${pnl.qualifiedConverted} qualified`} />
        </div>
      </div>
    </div>
  )
}

function Row({ label, sub, value, tone }: { label: string; sub?: string; value: string; tone: 'pos' | 'neg' }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div>
        <div className="text-sm text-white">{label}</div>
        {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
      </div>
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
