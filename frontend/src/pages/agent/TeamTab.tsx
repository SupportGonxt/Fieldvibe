import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, MapPin, TrendingUp, DollarSign, RefreshCw, ChevronDown, ChevronUp, ChevronRight, UserCheck, Shield, Store, AlertCircle, Bell, Phone, Loader2 } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { useRemediate } from '../../hooks/useRemediate'

type Period = 'day' | 'week' | 'month' | 'prior_month'

interface AgentStat {
  id: string
  first_name: string
  last_name: string
  role: string
  today_visits: number
  month_visits: number
  today_stores: number
  month_stores: number
  today_individual_visits?: number
  today_store_visits?: number
  month_individual_visits?: number
  month_store_visits?: number
  week_visits?: number
  week_individual_visits?: number
  week_store_visits?: number
  prior_month_visits?: number
  prior_month_individual_visits?: number
  prior_month_store_visits?: number
  target_visits: number
  actual_visits: number
  target_stores: number
  actual_stores: number
  achievement: number
  rejected_photos?: number
}

interface IncentiveTier {
  signups: number
  deposits: number
  amount: number
}

interface TeamData {
  team_size: number
  agents: AgentStat[]
  team_totals: {
    today_visits: number
    month_visits: number
    today_stores: number
    month_stores: number
    today_individual_visits?: number
    today_store_visits?: number
    month_individual_visits?: number
    month_store_visits?: number
    week_visits?: number
    week_individual_visits?: number
    week_store_visits?: number
    prior_month_visits?: number
    prior_month_individual_visits?: number
    prior_month_store_visits?: number
  }
  team_targets: {
    target_visits: number
    actual_visits: number
    target_stores: number
    actual_stores: number
    achievement: number
  }
  team_commission: {
    pending: number
    approved: number
    paid: number
  }
  incentive_scales: {
    agent: IncentiveTier[]
    team_lead: IncentiveTier[]
  }
  team_lead_own: {
    target_visits: number
    actual_visits: number
    target_stores: number
    actual_stores: number
    achievement: number
  } | null
  manager_performance: {
    manager_name: string
    achievement: number
  } | null
}

const rand = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n || 0)

function pctClass(pct: number): string {
  if (pct >= 100) return 'text-primary'
  if (pct >= 75) return 'text-amber-400'
  return 'text-red-400'
}

function progressColor(pct: number): string {
  if (pct >= 100) return 'var(--color-primary)'
  if (pct >= 75) return '#F59E0B'
  return '#EF4444'
}

export default function TeamTab() {
  const navigate = useNavigate()
  const { busy, nudge, call } = useRemediate()
  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [period, setPeriod] = useState<Period>('day')

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await apiClient.get('/team-lead/dashboard')
      if (res.data?.success && res.data?.data) {
        setData(res.data.data)
      }
    } catch (err) {
      console.error('Team dashboard fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading team data...</p>
        </div>
      </div>
    )
  }

  const achievement = data?.team_targets?.achievement || 0
  const totalEarnings = (data?.team_commission?.pending || 0) + (data?.team_commission?.approved || 0) + (data?.team_commission?.paid || 0)
  const vPct = (data?.team_targets?.target_visits || 0) > 0 ? Math.min(100, Math.round(((data?.team_targets?.actual_visits || 0) / (data?.team_targets?.target_visits || 1)) * 100)) : 0
  const rPct = (data?.team_targets?.target_stores || 0) > 0 ? Math.min(100, Math.round(((data?.team_targets?.actual_stores || 0) / (data?.team_targets?.target_stores || 1)) * 100)) : 0
  const agentTiers = data?.incentive_scales?.agent || []
  const tlTiers = data?.incentive_scales?.team_lead || []

  // Period-based team totals helper
  const getTeamTotals = (p: Period) => {
    const t = data?.team_totals
    if (!t) return { individual: 0, store: 0, total: 0 }
    switch (p) {
      case 'day': return { individual: t.today_individual_visits ?? t.today_visits ?? 0, store: t.today_store_visits ?? 0, total: t.today_visits ?? 0 }
      case 'week': return { individual: t.week_individual_visits ?? 0, store: t.week_store_visits ?? 0, total: t.week_visits ?? 0 }
      case 'month': return { individual: t.month_individual_visits ?? t.month_visits ?? 0, store: t.month_store_visits ?? 0, total: t.month_visits ?? 0 }
      case 'prior_month': return { individual: t.prior_month_individual_visits ?? 0, store: t.prior_month_store_visits ?? 0, total: t.prior_month_visits ?? 0 }
    }
  }
  // Period-based agent data helper
  const getAgentPeriod = (a: AgentStat, p: Period) => {
    switch (p) {
      case 'day': return { individual: a.today_individual_visits ?? a.today_visits ?? 0, store: a.today_store_visits ?? a.today_stores ?? 0, total: a.today_visits ?? 0 }
      case 'week': return { individual: a.week_individual_visits ?? 0, store: a.week_store_visits ?? 0, total: a.week_visits ?? 0 }
      case 'month': return { individual: a.month_individual_visits ?? a.month_visits ?? 0, store: a.month_store_visits ?? a.month_stores ?? 0, total: a.month_visits ?? 0 }
      case 'prior_month': return { individual: a.prior_month_individual_visits ?? 0, store: a.prior_month_store_visits ?? 0, total: a.prior_month_visits ?? 0 }
    }
  }
  const periodLabel = (p: Period) => p === 'day' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'Month to Date' : 'Prior Month'
  const teamPeriod = getTeamTotals(period)

  return (
    <div className="min-h-screen bg-[#06090F] pb-24">
      {/* Header */}
      <div className="bg-[#0A1628] px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">My Team</h1>
            <p className="text-xs text-gray-500">{data?.team_size || 0} agents</p>
          </div>
          <button onClick={() => fetchData(true)} className="p-2 rounded-xl bg-white/5" disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Period Toggle */}
      <div className="px-5 pt-4 pb-1">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {(['day', 'week', 'month', 'prior_month'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={'flex-1 py-1.5 text-[10px] font-semibold rounded-lg capitalize transition-all ' + (period === p ? 'bg-primary text-[#0A1628]' : 'text-gray-400')}>
              {p === 'prior_month' ? 'Prior Mo' : p === 'month' ? 'MTD' : p === 'week' ? 'Week' : 'Day'}
            </button>
          ))}
        </div>
      </div>

      {/* Team KPIs */}
      <div className="px-5 pt-2 pb-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{periodLabel(period)} Team Totals</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10"><MapPin className="w-3.5 h-3.5 text-blue-400" /></div>
              <span className="text-[10px] text-gray-500">Individual</span>
            </div>
            <p className="text-xl font-bold text-white">{teamPeriod.individual}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10"><Store className="w-3.5 h-3.5 text-purple-400" /></div>
              <span className="text-[10px] text-gray-500">Store</span>
            </div>
            <p className="text-xl font-bold text-white">{teamPeriod.store}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="p-1.5 rounded-lg bg-primary/10"><TrendingUp className="w-3.5 h-3.5 text-primary" /></div>
              <span className="text-[10px] text-gray-500">Total</span>
            </div>
            <p className="text-xl font-bold text-white">{teamPeriod.total}</p>
          </div>
        </div>
      </div>

      {/* Team Targets - Individual + Store Visits with progress bars */}
      <div className="px-5 py-2">
        <div className="bg-gradient-to-r from-[#0A1628] to-[#0E1D35] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                <circle cx="32" cy="32" r="26" fill="none" stroke="var(--color-primary)" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${Math.min(achievement, 100) * 1.634} 163.4`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{achievement}%</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Team Achievement</p>
              <p className="text-[10px] text-gray-400">Overall target progress</p>
            </div>
            <div className="text-right">
              <DollarSign className="w-5 h-5 text-amber-400 ml-auto mb-0.5" />
              <p className="text-lg font-bold text-white">R{totalEarnings.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">My Earnings</p>
            </div>
          </div>

          {/* Individual Visits progress */}
          <div className="mb-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Individual Visits</span>
              <span className="text-white font-medium">
                {data?.team_targets?.actual_visits || 0}/{data?.team_targets?.target_visits || 0}
                <span className={' ml-1 ' + pctClass(vPct)}>({vPct}%)</span>
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: vPct + '%', backgroundColor: progressColor(vPct) }} />
            </div>
          </div>

          {/* Store Visits progress */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Store Visits</span>
              <span className="text-white font-medium">
                {data?.team_targets?.actual_stores || 0}/{data?.team_targets?.target_stores || 0}
                <span className={' ml-1 ' + pctClass(rPct)}>({rPct}%)</span>
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: rPct + '%', backgroundColor: '#8B5CF6' }} />
            </div>
          </div>

          {/* Earnings breakdown */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
            <div className="text-center">
              <p className="text-xs font-semibold text-amber-400">R{(data?.team_commission?.pending || 0).toLocaleString()}</p>
              <p className="text-[9px] text-gray-500">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-blue-400">R{(data?.team_commission?.approved || 0).toLocaleString()}</p>
              <p className="text-[9px] text-gray-500">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-primary">R{(data?.team_commission?.paid || 0).toLocaleString()}</p>
              <p className="text-[9px] text-gray-500">Paid</p>
            </div>
          </div>
        </div>
      </div>

      {/* Incentive Tiers (expandable) */}
      {(agentTiers.length > 0 || tlTiers.length > 0) && (
        <div className="px-5 py-2">
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3"
          >
            <Shield className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-1 text-left">Incentive Tiers</span>
            {showRules ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
          {showRules && (
            <div className="mt-2 space-y-2">
              {tlTiers.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Team Leads (team avg/day)</h3>
                  <div className="space-y-1.5">
                    {tlTiers.map((tier) => (
                      <div key={tier.amount} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                        <p className="text-xs text-gray-400">{tier.signups} signups + {tier.deposits} deposits /day</p>
                        <span className="text-xs font-semibold text-primary">{rand(tier.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {agentTiers.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Agents</h3>
                  <div className="space-y-1.5">
                    {agentTiers.map((tier) => (
                      <div key={tier.amount} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                        <p className="text-xs text-gray-400">{tier.signups} signups + {tier.deposits} deposits /day</p>
                        <span className="text-xs font-semibold text-primary">{rand(tier.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[9px] text-gray-600">Both gates must be met on daily average for the month</p>
            </div>
          )}
        </div>
      )}

      {/* Hierarchy Scorecard: Team Lead → Agents → Manager */}
      <div className="px-5 py-2">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Hierarchy Scores
          </h3>
          <div className="space-y-2.5">
            {/* My Score (Team Lead) */}
            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400">My Score (Team Total)</p>
                <p className="text-sm font-semibold text-white">Team Lead</p>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold ${pctClass(achievement)}`}>{achievement}%</span>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${achievement >= 100 ? 'bg-primary' : achievement >= 75 ? 'bg-amber-400' : 'bg-red-400'}`} />
            </div>

            {/* Team Lead's Own Contribution */}
            {data?.team_lead_own && (
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400">My Own Contribution</p>
                  <p className="text-[10px] text-gray-500">{data.team_lead_own.actual_visits}/{data.team_lead_own.target_visits} visits</p>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold ${pctClass(data.team_lead_own.achievement)}`}>{data.team_lead_own.achievement}%</span>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${data.team_lead_own.achievement >= 100 ? 'bg-primary' : data.team_lead_own.achievement >= 75 ? 'bg-amber-400' : 'bg-red-400'}`} />
              </div>
            )}

            {/* Manager Score */}
            {data?.manager_performance && (
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400">Manager</p>
                  <p className="text-sm font-semibold text-white">{data.manager_performance.manager_name}</p>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold ${pctClass(data.manager_performance.achievement)}`}>{data.manager_performance.achievement}%</span>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${data.manager_performance.achievement >= 100 ? 'bg-primary' : data.manager_performance.achievement >= 75 ? 'bg-amber-400' : 'bg-red-400'}`} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agent List */}
      <div className="px-5 pt-2 pb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Agent Performance</h2>
        {(data?.agents || []).length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No agents assigned to your team</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.agents || []).map((agent) => {
              const isExpanded = expandedAgent === agent.id
              const agentVPct = (agent.target_visits || 0) > 0 ? Math.min(100, Math.round((agent.actual_visits / agent.target_visits) * 100)) : 0
              const agentRPct = (agent.target_stores || 0) > 0 ? Math.min(100, Math.round((agent.actual_stores / agent.target_stores) * 100)) : 0
              return (
                <div key={agent.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                    className="w-full p-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{(agent.first_name?.[0] || '') + (agent.last_name?.[0] || '')}</span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-white truncate">{agent.first_name} {agent.last_name}</p>
                        {(agent.rejected_photos || 0) > 0 && (
                          <span
                            onClick={(e) => { e.stopPropagation(); navigate(`/agent/agent-detail/${agent.id}?filter=rejected_photos`) }}
                            className="flex-shrink-0 flex items-center gap-0.5 bg-red-500/20 border border-red-500/30 rounded-full px-1.5 py-0.5 cursor-pointer"
                          >
                            <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                            <span className="text-[9px] font-bold text-red-400">{agent.rejected_photos}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500">{getAgentPeriod(agent, period).individual} individual · {getAgentPeriod(agent, period).store} store ({periodLabel(period).toLowerCase()})</p>
                    </div>
                    <div className="text-right mr-1">
                      <span className={`text-xs font-bold ${pctClass(agent.achievement)}`}>
                        {agent.achievement}%
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </button>
                  {isExpanded && (() => {
                    const ap = getAgentPeriod(agent, period)
                    return (
                    <div className="px-3 pb-3 pt-0 border-t border-white/5">
                      {/* Period breakdown table */}
                      <div className="mt-2 bg-white/5 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-4 gap-0 text-[10px]">
                          <div className="p-1.5 text-gray-500 font-medium">Period</div>
                          <div className="p-1.5 text-gray-500 font-medium text-center">Individual</div>
                          <div className="p-1.5 text-gray-500 font-medium text-center">Store</div>
                          <div className="p-1.5 text-gray-500 font-medium text-center">Total</div>
                          {(['day', 'week', 'month', 'prior_month'] as Period[]).map(p => {
                            const d = getAgentPeriod(agent, p)
                            const isActive = p === period
                            return (<React.Fragment key={p}>
                              <div className={'p-1.5 ' + (isActive ? 'text-primary font-semibold' : 'text-gray-400')}>{p === 'prior_month' ? 'Prior Mo' : p === 'month' ? 'MTD' : p === 'week' ? 'Week' : 'Day'}</div>
                              <div className={'p-1.5 text-center font-semibold ' + (isActive ? 'text-white' : 'text-gray-300')}>{d.individual}</div>
                              <div className={'p-1.5 text-center font-semibold ' + (isActive ? 'text-white' : 'text-gray-300')}>{d.store}</div>
                              <div className={'p-1.5 text-center font-semibold ' + (isActive ? 'text-white' : 'text-gray-300')}>{d.total}</div>
                            </React.Fragment>)
                          })}
                        </div>
                      </div>
                      {/* Selected period highlight */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-blue-500/10 rounded-lg p-2">
                          <p className="text-[10px] text-blue-300">{periodLabel(period)} Individual</p>
                          <p className="text-sm font-semibold text-white">{ap.individual}</p>
                        </div>
                        <div className="bg-purple-500/10 rounded-lg p-2">
                          <p className="text-[10px] text-purple-300">{periodLabel(period)} Store</p>
                          <p className="text-sm font-semibold text-white">{ap.store}</p>
                        </div>
                      </div>
                      {/* Individual target progress */}
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-gray-500">Individual Target</span>
                          <span className="text-white">{agent.actual_visits}/{agent.target_visits} <span className={pctClass(agentVPct)}>({agentVPct}%)</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: agentVPct + '%', backgroundColor: progressColor(agentVPct) }} />
                        </div>
                      </div>
                      {/* Store target progress */}
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-gray-500">Store Target</span>
                          <span className="text-white">{agent.actual_stores}/{agent.target_stores} <span className={pctClass(agentRPct)}>({agentRPct}%)</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: agentRPct + '%', backgroundColor: '#8B5CF6' }} />
                        </div>
                      </div>
                      {/* Rejected photos alert */}
                      {(agent.rejected_photos || 0) > 0 && (
                        <div className="mt-2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          <p className="text-xs text-red-300 flex-1">
                            <span className="font-bold">{agent.rejected_photos}</span> rejected {agent.rejected_photos === 1 ? 'photo' : 'photos'} — agent needs to re-upload
                          </p>
                        </div>
                      )}
                      {/* Act on the agent from the row itself — the PWA has no other nudge/call entry point. */}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => nudge(agent.id, agent.first_name)}
                          disabled={busy === agent.id}
                          className="min-h-[44px] py-2 bg-amber-400/10 border border-amber-400/25 rounded-lg text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {busy === agent.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Bell className="w-3.5 h-3.5" />} Nudge
                        </button>
                        <button
                          onClick={() => call(agent.id, `${agent.first_name} ${agent.last_name}`.trim())}
                          disabled={busy === agent.id}
                          className="min-h-[44px] py-2 bg-primary/10 border border-primary/25 rounded-lg text-xs font-semibold text-primary flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call
                        </button>
                      </div>
                      {/* Drill-down button */}
                      <button
                        onClick={() => navigate(`/agent/agent-detail/${agent.id}`)}
                        className="w-full mt-2 min-h-[44px] py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 flex items-center justify-center gap-1.5"
                      >
                        <MapPin className="w-3.5 h-3.5" /> View Visit History
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
