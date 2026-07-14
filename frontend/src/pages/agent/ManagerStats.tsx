import { useCallback, useEffect, useState } from 'react'
import { MapPin, RefreshCw, UserCheck, AlertCircle, Users } from 'lucide-react'
import { apiClient } from '../../services/api.service'

// Manager Stats tab: team-scoped COUNTS only (individual signups + store visits).
// Hard business rule: field sales managers never see money here — no earnings,
// no commission, no rand amounts. Money stays out of this file entirely.

interface AgentRow {
  id: string
  name: string
  team_lead_id: string | null
  today_individual: number
  today_store: number
  week_individual: number
  week_store: number
  month_individual: number
  month_store: number
  prior_month_individual: number
  prior_month_store: number
}

interface TeamRow {
  team_lead_id: string
  team_lead_name: string
  agent_count: number
}

interface StatsData {
  total_team_leads: number
  total_agents: number
  teams: TeamRow[]
  agents?: AgentRow[]
  org_totals?: {
    today_visits?: number
    today_individual_visits?: number
    today_store_visits?: number
    week_individual_visits?: number
    week_store_visits?: number
    month_visits?: number
    month_individual_visits?: number
    month_store_visits?: number
    prior_month_individual_visits?: number
    prior_month_store_visits?: number
  }
  companies?: Array<{ id: string; name: string }>
}

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'prior_month', label: 'Prior Mo' },
] as const
type PeriodKey = typeof PERIODS[number]['key']

function agentCounts(a: AgentRow, period: PeriodKey): { ind: number; store: number } {
  switch (period) {
    case 'today': return { ind: a.today_individual || 0, store: a.today_store || 0 }
    case 'week': return { ind: a.week_individual || 0, store: a.week_store || 0 }
    case 'month': return { ind: a.month_individual || 0, store: a.month_store || 0 }
    default: return { ind: a.prior_month_individual || 0, store: a.prior_month_store || 0 }
  }
}

function CompanyChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-primary text-on-primary border-primary' : 'bg-white/[0.04] text-gray-400 border-white/10'}`}
    >
      {label}
    </button>
  )
}

export default function ManagerStats() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<PeriodKey>('today')
  const [company, setCompany] = useState<string | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await apiClient.get(`/manager/dashboard${company ? '?company_id=' + company : ''}`)
      if (res.data?.success && res.data?.data) setData(res.data.data)
      else setError(true)
    } catch (err) {
      console.error('Manager stats fetch error:', err)
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [company])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-token font-medium mb-1">Couldn't load team stats</p>
          <p className="text-xs text-token-faint mb-4">Check your connection and try again.</p>
          <button onClick={() => fetchData()} className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const companies = data?.companies || []
  const periodLabel = PERIODS.find(p => p.key === period)!.label

  const ot = data?.org_totals
  const orgPeriod =
    period === 'today' ? { ind: ot?.today_individual_visits ?? ot?.today_visits ?? 0, store: ot?.today_store_visits ?? 0 }
    : period === 'week' ? { ind: ot?.week_individual_visits ?? 0, store: ot?.week_store_visits ?? 0 }
    : period === 'month' ? { ind: ot?.month_individual_visits ?? ot?.month_visits ?? 0, store: ot?.month_store_visits ?? 0 }
    : { ind: ot?.prior_month_individual_visits ?? 0, store: ot?.prior_month_store_visits ?? 0 }

  // Group agents under their team lead; unknown/null team_lead_id -> Unassigned.
  const teamNames = new Map((data?.teams || []).map(t => [t.team_lead_id, t.team_lead_name]))
  const groups = new Map<string, AgentRow[]>()
  for (const a of data?.agents || []) {
    const key = a.team_lead_id && teamNames.has(a.team_lead_id) ? a.team_lead_id : 'unassigned'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(a)
  }
  const groupTotal = (rows: AgentRow[]) =>
    rows.reduce((s, a) => { const c = agentCounts(a, period); return { ind: s.ind + c.ind, store: s.store + c.store } }, { ind: 0, store: 0 })
  const sortedGroups = [...groups.entries()]
    .map(([key, rows]) => ({
      key,
      name: key === 'unassigned' ? 'Unassigned' : teamNames.get(key)!,
      rows: [...rows].sort((a, b) => {
        const ca = agentCounts(a, period); const cb = agentCounts(b, period)
        return (cb.ind + cb.store) - (ca.ind + ca.store)
      }),
      total: groupTotal(rows),
    }))
    .sort((a, b) => (b.total.ind + b.total.store) - (a.total.ind + a.total.store))

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Header */}
      <div className="bg-surface px-5 py-4 border-b border-token">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-token">Team Stats</h1>
            <p className="text-xs text-token-faint">{data?.total_team_leads || 0} teams &middot; {data?.total_agents || 0} agents</p>
          </div>
          <button onClick={() => fetchData(true)} className="p-2 rounded-xl bg-white/5" disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 text-token-muted ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Company selector */}
      {companies.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 pt-4 px-5">
          <CompanyChip label="All companies" active={company === null} onClick={() => setCompany(null)} />
          {companies.map(co => (
            <CompanyChip key={co.id} label={co.name} active={company === co.id} onClick={() => setCompany(co.id)} />
          ))}
        </div>
      )}

      {/* Period selector */}
      <div className="px-5 pt-4">
        <div className="bg-white/[0.04] border border-token rounded-2xl p-1 flex">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${period === p.key ? 'bg-primary text-on-primary' : 'text-gray-400'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Team totals */}
      <div className="px-5 pt-3 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-token rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-primary/10"><MapPin className="w-4 h-4 text-primary" /></div>
              <span className="text-[10px] text-token-faint uppercase tracking-wider">{periodLabel} Signups</span>
            </div>
            <p className="text-xl font-bold text-token">{orgPeriod.ind}</p>
          </div>
          <div className="bg-white/5 border border-token rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10"><UserCheck className="w-4 h-4 text-amber-400" /></div>
              <span className="text-[10px] text-token-faint uppercase tracking-wider">{periodLabel} Store</span>
            </div>
            <p className="text-xl font-bold text-token">{orgPeriod.store}</p>
          </div>
        </div>
      </div>

      {/* Per-agent breakdown, grouped by team */}
      <div className="px-5 pt-2 space-y-3">
        {sortedGroups.length === 0 && (
          <div className="bg-white/5 border border-token rounded-xl p-6 text-center">
            <Users className="w-8 h-8 text-token-faint mx-auto mb-2" />
            <p className="text-sm text-token-muted">No agents found</p>
          </div>
        )}
        {sortedGroups.map(group => (
          <div key={group.key} className="bg-white/5 border border-token rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-token bg-white/[0.03]">
              <p className="text-sm font-semibold text-token truncate">{group.name}</p>
              <p className="text-xs text-token-faint flex-shrink-0 ml-2">
                <span className="text-primary font-semibold">{group.total.ind}</span> ind &middot; <span className="text-amber-400 font-semibold">{group.total.store}</span> store
              </p>
            </div>
            {group.rows.map(a => {
              const c = agentCounts(a, period)
              return (
                <div key={a.id} className="flex items-center justify-between px-4 py-2.5 border-b border-token/50 last:border-b-0">
                  <p className="text-sm text-token truncate">{a.name}</p>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-2 tabular-nums">
                    <span className="text-sm font-semibold text-token w-8 text-right">{c.ind}</span>
                    <span className="text-sm text-token-muted w-8 text-right">{c.store}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {sortedGroups.length > 0 && (
          <p className="text-[10px] text-token-faint text-right px-1">columns: signups &middot; store visits</p>
        )}
      </div>
    </div>
  )
}
