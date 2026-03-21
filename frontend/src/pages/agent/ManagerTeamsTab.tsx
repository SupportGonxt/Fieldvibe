import React, { useEffect, useState, useCallback } from 'react'
import { Users, MapPin, Target, TrendingUp, DollarSign, RefreshCw, ChevronDown, ChevronUp, UserCheck, AlertCircle, Star, Shield } from 'lucide-react'
import { apiClient } from '../../services/api.service'

interface TeamStat {
  team_lead_id: string
  team_lead_name: string
  agent_count: number
  month_visits: number
  month_registrations: number
  target_visits: number
  actual_visits: number
  target_registrations: number
  actual_registrations: number
  achievement: number
  team_lead_own?: {
    target_visits: number
    actual_visits: number
    target_registrations: number
    actual_registrations: number
  }
}

interface CommissionRule {
  id: string
  name: string
  source_type: string
  rate: number
  min_threshold: number
  max_cap: number | null
  effective_from: string | null
  effective_to: string | null
}

interface CommissionTier {
  id: string
  tier_name: string
  min_achievement_pct: number
  max_achievement_pct: number | null
  commission_rate: number
  bonus_amount: number
  metric_type: string
}

interface ManagerData {
  total_team_leads: number
  total_agents: number
  unassigned_agents: number
  teams: TeamStat[]
  org_totals: {
    today_visits: number
    month_visits: number
    today_registrations: number
    month_registrations: number
  }
  org_targets: {
    target_visits: number
    actual_visits: number
    target_registrations: number
    actual_registrations: number
    achievement: number
  }
  org_commission: {
    pending: number
    approved: number
    paid: number
  }
  commission_rules: CommissionRule[]
  commission_tiers: CommissionTier[]
  current_org_tier: CommissionTier | null
}

function tierColor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('platinum') || n.includes('diamond')) return 'text-cyan-300'
  if (n.includes('gold')) return 'text-yellow-400'
  if (n.includes('silver')) return 'text-gray-300'
  return 'text-amber-600'
}

function tierBg(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('platinum') || n.includes('diamond')) return 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20'
  if (n.includes('gold')) return 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/20'
  if (n.includes('silver')) return 'from-gray-400/20 to-gray-500/10 border-gray-400/20'
  return 'from-amber-700/20 to-amber-800/10 border-amber-700/20'
}

function pctClass(pct: number): string {
  if (pct >= 100) return 'text-[#00E87B]'
  if (pct >= 75) return 'text-amber-400'
  return 'text-red-400'
}

function progressColor(pct: number): string {
  if (pct >= 100) return '#00E87B'
  if (pct >= 75) return '#F59E0B'
  return '#EF4444'
}

export default function ManagerTeamsTab() {
  const [data, setData] = useState<ManagerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [showRules, setShowRules] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await apiClient.get('/manager/dashboard')
      if (res.data?.success && res.data?.data) {
        setData(res.data.data)
      }
    } catch (err) {
      console.error('Manager dashboard fetch error:', err)
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
          <div className="w-12 h-12 border-4 border-[#00E87B] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading organization data...</p>
        </div>
      </div>
    )
  }

  const achievement = data?.org_targets?.achievement || 0
  const totalEarnings = (data?.org_commission?.pending || 0) + (data?.org_commission?.approved || 0) + (data?.org_commission?.paid || 0)
  const vPct = (data?.org_targets?.target_visits || 0) > 0 ? Math.min(100, Math.round(((data?.org_targets?.actual_visits || 0) / (data?.org_targets?.target_visits || 1)) * 100)) : 0
  const rPct = (data?.org_targets?.target_registrations || 0) > 0 ? Math.min(100, Math.round(((data?.org_targets?.actual_registrations || 0) / (data?.org_targets?.target_registrations || 1)) * 100)) : 0
  const rules = data?.commission_rules || []
  const tiers = data?.commission_tiers || []
  const currentTier = data?.current_org_tier

  return (
    <div className="min-h-screen bg-[#06090F] pb-24">
      {/* Header */}
      <div className="bg-[#0A1628] px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Organization</h1>
            <p className="text-xs text-gray-500">{data?.total_team_leads || 0} teams &middot; {data?.total_agents || 0} agents</p>
          </div>
          <button onClick={() => fetchData(true)} className="p-2 rounded-xl bg-white/5" disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Org KPIs */}
      <div className="px-5 pt-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10"><MapPin className="w-4 h-4 text-blue-400" /></div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Today Visits</span>
            </div>
            <p className="text-xl font-bold text-white">{data?.org_totals?.today_visits || 0}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10"><UserCheck className="w-4 h-4 text-purple-400" /></div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Today Individuals</span>
            </div>
            <p className="text-xl font-bold text-white">{data?.org_totals?.today_registrations || 0}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10"><TrendingUp className="w-4 h-4 text-emerald-400" /></div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Month Visits</span>
            </div>
            <p className="text-xl font-bold text-white">{data?.org_totals?.month_visits || 0}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10"><Target className="w-4 h-4 text-amber-400" /></div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Month Individuals</span>
            </div>
            <p className="text-xl font-bold text-white">{data?.org_totals?.month_registrations || 0}</p>
          </div>
        </div>
      </div>

      {/* Org Targets - Visits + Registrations with progress bars */}
      <div className="px-5 py-2">
        <div className="bg-gradient-to-r from-[#0A1628] to-[#0E1D35] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                <circle cx="32" cy="32" r="26" fill="none" stroke="#00E87B" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${Math.min(achievement, 100) * 1.634} 163.4`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{achievement}%</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Org Achievement</p>
              <p className="text-[10px] text-gray-400">Overall target progress</p>
            </div>
            <div className="text-right">
              <DollarSign className="w-5 h-5 text-amber-400 ml-auto mb-0.5" />
              <p className="text-lg font-bold text-white">R{totalEarnings.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">Total Earnings</p>
            </div>
          </div>

          {/* Visits progress */}
          <div className="mb-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Visits</span>
              <span className="text-white font-medium">
                {data?.org_targets?.actual_visits || 0}/{data?.org_targets?.target_visits || 0}
                <span className={' ml-1 ' + pctClass(vPct)}>({vPct}%)</span>
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: vPct + '%', backgroundColor: progressColor(vPct) }} />
            </div>
          </div>

          {/* Registrations progress */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Individuals</span>
              <span className="text-white font-medium">
                {data?.org_targets?.actual_registrations || 0}/{data?.org_targets?.target_registrations || 0}
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
              <p className="text-xs font-semibold text-amber-400">R{(data?.org_commission?.pending || 0).toLocaleString()}</p>
              <p className="text-[9px] text-gray-500">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-blue-400">R{(data?.org_commission?.approved || 0).toLocaleString()}</p>
              <p className="text-[9px] text-gray-500">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-[#00E87B]">R{(data?.org_commission?.paid || 0).toLocaleString()}</p>
              <p className="text-[9px] text-gray-500">Paid</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Tier Badge */}
      {currentTier && (
        <div className="px-5 py-2">
          <div className={'bg-gradient-to-br border rounded-2xl p-3 flex items-center gap-3 ' + tierBg(currentTier.tier_name)}>
            <Star className={'w-5 h-5 ' + tierColor(currentTier.tier_name)} />
            <div className="flex-1">
              <p className={'text-sm font-bold ' + tierColor(currentTier.tier_name)}>{currentTier.tier_name} Tier</p>
              <p className="text-[10px] text-gray-400">
                {currentTier.commission_rate}% rate{currentTier.bonus_amount > 0 ? ` + R${currentTier.bonus_amount.toLocaleString()} bonus` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Org</p>
              <p className={'text-sm font-bold ' + pctClass(achievement)}>{achievement}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Commission Rules & Tiers (expandable) */}
      {(rules.length > 0 || tiers.length > 0) && (
        <div className="px-5 py-2">
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3"
          >
            <Shield className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-1 text-left">Commission Rules & Tiers</span>
            {showRules ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
          {showRules && (
            <div className="mt-2 space-y-2">
              {tiers.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Earning Tiers</h3>
                  <div className="space-y-1.5">
                    {tiers.map((tier) => {
                      const isCurrent = currentTier?.id === tier.id
                      return (
                        <div key={tier.id} className={'flex items-center justify-between p-2 rounded-lg ' + (isCurrent ? 'bg-white/10 border border-white/20' : 'bg-white/[0.02]')}>
                          <div className="flex items-center gap-2">
                            <Star className={'w-3.5 h-3.5 ' + tierColor(tier.tier_name)} />
                            <div>
                              <p className={'text-xs font-medium ' + (isCurrent ? 'text-white' : 'text-gray-400')}>{tier.tier_name}</p>
                              <p className="text-[9px] text-gray-600">{tier.min_achievement_pct}%{tier.max_achievement_pct ? ` - ${tier.max_achievement_pct}%` : '+'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={'text-xs font-semibold ' + (isCurrent ? 'text-[#00E87B]' : 'text-gray-400')}>{tier.commission_rate}%</p>
                            {tier.bonus_amount > 0 && <p className="text-[9px] text-amber-400">+R{tier.bonus_amount.toLocaleString()}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[9px] text-gray-600 mt-2">Tiers apply to both agent and team-level earnings</p>
                </div>
              )}
              {rules.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Active Rules</h3>
                  <div className="space-y-1.5">
                    {rules.map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                        <div>
                          <p className="text-xs text-white">{rule.name}</p>
                          <p className="text-[9px] text-gray-500">
                            {rule.source_type.replace(/_/g, ' ')}
                            {rule.min_threshold > 0 && ` | Min: R${rule.min_threshold.toLocaleString()}`}
                            {rule.max_cap && ` | Cap: R${rule.max_cap.toLocaleString()}`}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-[#00E87B]">{rule.rate}%</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-gray-600 mt-2">Rules apply to both individual agents and team earnings</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Unassigned agents warning */}
      {(data?.unassigned_agents || 0) > 0 && (
        <div className="px-5 py-2">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-300">{data?.unassigned_agents} agents not assigned to any team</p>
          </div>
        </div>
      )}

      {/* Hierarchy Scorecard: Manager Score */}
      <div className="px-5 py-2">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Hierarchy Scores
          </h3>
          <div className="space-y-2.5">
            {/* Manager's Own Score */}
            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400">My Score (Org Total)</p>
                <p className="text-sm font-semibold text-white">Manager</p>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold ${pctClass(achievement)}`}>{achievement}%</span>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${achievement >= 100 ? 'bg-[#00E87B]' : achievement >= 75 ? 'bg-amber-400' : 'bg-red-400'}`} />
            </div>

            {/* Team Lead Scores */}
            {(data?.teams || []).map((team) => {
              const tlAch = team.achievement || 0
              return (
                <div key={team.team_lead_id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400">Team Lead</p>
                    <p className="text-sm font-semibold text-white">{team.team_lead_name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${pctClass(tlAch)}`}>{tlAch}%</span>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${tlAch >= 100 ? 'bg-[#00E87B]' : tlAch >= 75 ? 'bg-amber-400' : 'bg-red-400'}`} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Team Leads List */}
      <div className="px-5 pt-2 pb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Team Performance</h2>
        {(data?.teams || []).length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No teams found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.teams || []).map((team) => {
              const isExpanded = expandedTeam === team.team_lead_id
              const teamVPct = (team.target_visits || 0) > 0 ? Math.min(100, Math.round((team.actual_visits / team.target_visits) * 100)) : 0
              const teamRPct = (team.target_registrations || 0) > 0 ? Math.min(100, Math.round((team.actual_registrations / team.target_registrations) * 100)) : 0
              return (
                <div key={team.team_lead_id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedTeam(isExpanded ? null : team.team_lead_id)}
                    className="w-full p-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-white truncate">{team.team_lead_name}</p>
                      <p className="text-[10px] text-gray-500">{team.agent_count} agents</p>
                    </div>
                    <div className="text-right mr-1">
                      <span className={`text-xs font-bold ${pctClass(team.achievement)}`}>
                        {team.achievement}%
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-white/5">
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-[10px] text-gray-500">Month Visits</p>
                          <p className="text-sm font-semibold text-white">{team.month_visits}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-[10px] text-gray-500">Month Individuals</p>
                          <p className="text-sm font-semibold text-white">{team.month_registrations}</p>
                        </div>
                      </div>
                      {/* Visit target progress */}
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-gray-500">Visit Target</span>
                          <span className="text-white">{team.actual_visits}/{team.target_visits} <span className={pctClass(teamVPct)}>({teamVPct}%)</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: teamVPct + '%', backgroundColor: progressColor(teamVPct) }} />
                        </div>
                      </div>
                      {/* Registration target progress */}
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-gray-500">Individual Target</span>
                          <span className="text-white">{team.actual_registrations}/{team.target_registrations} <span className={pctClass(teamRPct)}>({teamRPct}%)</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: teamRPct + '%', backgroundColor: '#8B5CF6' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="px-5 pb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Stats</h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">{data?.total_team_leads || 0}</p>
            <p className="text-[10px] text-gray-500">Teams</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">{data?.total_agents || 0}</p>
            <p className="text-[10px] text-gray-500">Agents</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">
              {data?.total_agents && data.total_team_leads ? Math.round(data.total_agents / data.total_team_leads) : 0}
            </p>
            <p className="text-[10px] text-gray-500">Avg/Team</p>
          </div>
        </div>
      </div>
    </div>
  )
}
