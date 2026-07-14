import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { fieldOperationsService } from '../../services/field-operations.service'

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
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  // Open scoped to whatever company the GM was viewing when they tapped through (?company_id=…).
  const [searchParams] = useSearchParams()
  const [company, setCompany] = useState<string | null>(searchParams.get('company_id'))

  useEffect(() => {
    fieldOperationsService
      .getCompanies()
      .then((res: any) => setCompanies(res?.companies ?? res ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    apiClient
      .get(`/field-ops/incentives/pnl${company ? `?company_id=${company}` : ''}`)
      .then((res) => setPnl(res?.data?.pnl ?? null))
      .catch(() => setPnl(null))
      .finally(() => setLoading(false))
  }, [company])

  const revenue = pnl ? (projected ? pnl.projectedRevenue : pnl.revenue) : 0
  const incentive = pnl ? (projected ? pnl.projectedIncentiveCost : pnl.incentiveCost) : 0
  const net = pnl ? (projected ? pnl.projectedNet : pnl.net) : 0
  const positive = net >= 0

  return (
    <div className="min-h-screen bg-bg px-4 pt-6 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-token">P&amp;L</h1>
        </div>
        <p className="text-sm text-token-faint mb-5">{pnl?.period ?? ' '}</p>

        {/* Company scope — mirrors GmOverview chips */}
        {companies.length > 1 && (
          <div className="flex gap-2 overflow-x-auto mb-4 -mx-4 px-4 scrollbar-hide">
            <CompanyChip label="All companies" active={company === null} onClick={() => setCompany(null)} />
            {companies.map((co) => (
              <CompanyChip key={co.id} label={co.name} active={company === co.id} onClick={() => setCompany(co.id)} />
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : !pnl ? (
          <p className="text-token-faint text-center mt-20">No P&amp;L data available.</p>
        ) : (
          <>
        {/* Confirmed / Projected toggle */}
        <div className="flex bg-white/[0.04] border border-token rounded-2xl p-1 mb-6">
          {[
            { key: false, label: 'Confirmed' },
            { key: true, label: 'On pace' },
          ].map((t) => (
            <button
              key={String(t.key)}
              onClick={() => setProjected(t.key)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                projected === t.key ? 'bg-primary text-on-primary' : 'text-token-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Net hero */}
        <div className="bg-white/[0.03] border border-token rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-1">
            {positive ? (
              <TrendingUp className="w-5 h-5 text-primary" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
            <span className="text-xs text-token-faint uppercase tracking-wide">Net</span>
          </div>
          <div className={`text-4xl font-bold tabular-nums ${positive ? 'text-primary' : 'text-red-400'}`}>
            {rand(net)}
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-white/[0.03] border border-token rounded-2xl divide-y divide-token">
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
          </>
        )}
      </div>
    </div>
  )
}

function CompanyChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        active ? 'bg-primary text-on-primary border-primary' : 'bg-white/[0.04] text-token-muted border-token'
      }`}
    >
      {label}
    </button>
  )
}

function Row({ label, sub, value, tone }: { label: string; sub?: string; value: string; tone: 'pos' | 'neg' }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div>
        <div className="text-sm text-token">{label}</div>
        {sub && <div className="text-xs text-token-faint mt-0.5">{sub}</div>}
      </div>
      <div className={`text-base font-semibold tabular-nums ${tone === 'pos' ? 'text-token' : 'text-token-muted'}`}>{value}</div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-white/[0.03] border border-token rounded-2xl p-4">
      <div className="text-2xl font-bold text-token tabular-nums">{value}</div>
      <div className="text-xs text-token-faint mt-0.5">{label}</div>
      <div className="text-xs text-gray-600 mt-1">{sub}</div>
    </div>
  )
}
