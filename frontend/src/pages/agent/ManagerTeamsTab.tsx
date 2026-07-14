import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, MapPin, DollarSign, RefreshCw, ChevronDown, ChevronUp, ChevronRight, UserCheck, AlertCircle, Shield, Bell, Phone, Loader2 } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { useRemediate } from '../../hooks/useRemediate'

interface TeamStat {
  team_lead_id: string
  team_lead_name: string
  agent_count: number
  month_visits: number
  month_stores: number
  target_visits: number
  actual_visits: number
  target_stores: number
  actual_stores: number
  achievement: number
  team_lead_own?: {
    target_visits: number
    actual_visits: number
    target_stores: number
    actual_stores: number
  }
  // Period breakdowns (optional: older API responses won't have them)
  today_visits?: number
  today_stores?: number
  week_visits?: number
  week_stores?: number
  prior_month_visits?: number
  prior_month_stores?: number
}

interface IncentiveTier {
  signups: number
  deposits: number
  amount: number
}

interface Company {
  id: string
  name: string
}

interface ManagerData {
  total_team_leads: number
  total_agents: number
  unassigned_agents: number
  teams: TeamStat[]
  org_totals: {
    today_visits: number
    month_visits: number
    today_stores: number
    month_stores: number
    today_individual_visits?: number
    today_store_visits?: number
    month_individual_visits?: number
    month_store_visits?: number
    week_individual_visits?: number
    week_store_visits?: number
    prior_month_individual_visits?: number
    prior_month_store_visits?: number
  }
  org_targets: {
    target_visits: number
    actual_visits: number
    target_stores: number
    actual_stores: number
    achievement: number
  }
  org_commission: {
    pending: number
    approved: number
    paid: number
  }
  companies: Company[]
  incentive_scales: {
    agent: IncentiveTier[]
    team_lead: IncentiveTier[]
    manager: IncentiveTier[]
  }
}

const rand = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n || 0)

function CompanyChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-[#00E87B] text-[#0A1628] border-[#00E87B]' : 'bg-white/[0.04] text-gray-400 border-white/10'}`}
    >
      {label}
    </button>
  )
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

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'prior_month', label: 'Prior Mo' },
] as const
type PeriodKey = typeof PERIODS[number]['key']

export default function ManagerTeamsTab() {
  const navigate = useNavigate()
  const { busy, nudge, call } = useRemediate()
  const [data, setData] = useState<ManagerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [period, setPeriod] = useState<PeriodKey>('today')
  const [company, setCompany] = useState<string | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await apiClient.get(`/manager/dashboard${company ? '?company_id=' + company : ''}`)
      if (res.data?.success && res.data?.data) {
        setData(res.data.data)
      } else {
        setError(true)
      }
    } catch (err) {
      console.error('Manager dashboard fetch error:', err)
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [company])

  useEffect(() => { fetchData() }, [fetchData])

  // Full-screen spinner only on first load — company switches refetch with data still on screen
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00E87B] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading organization data...</p>
        </div>
      </div>
    )
  }

  // Fetch failed and we have nothing to show — say so instead of rendering
  // an all-zero dashboard that looks like real (empty) data.
  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-white font-medium mb-1">Couldn't load organization data</p>
          <p className="text-xs text-gray-500 mb-4">Check your connection and try again.</p>
          <button onClick={() => fetchData()} className="px-4 py-2 rounded-xl bg-[#00E87B] text-[#0A1628] text-sm font-semibold">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const achievement = data?.org_targets?.achievement || 0
  const totalEarnings = (data?.org_commission?.pending || 0) + (data?.org_commission?.approved || 0) + (data?.org_commission?.paid || 0)
  const vPct = (data?.org_targets?.target_visits || 0) > 0 ? Math.min(100, Math.round(((data?.org_targets?.actual_visits || 0) / (data?.org_targets?.target_visits || 1)) * 100)) : 0
  const rPct = (data?.org_targets?.target_stores || 0) > 0 ? Math.min(100, Math.round(((data?.org_targets?.actual_stores || 0) / (data?.org_targets?.target_stores || 1)) * 100)) : 0
  const companies = data?.companies || []
  const scales = data?.incentive_scales
  const scaleGroups = [
    { key: 'agent', label: 'Agents', tiers: scales?.agent || [] },
    { key: 'team_lead', label: 'Team Leads (team avg/day)', tiers: scales?.team_lead || [] },
    { key: 'manager', label: 'Managers (org avg/day)', tiers: scales?.manager || [] },
  ].filter(g => g.tiers.length > 0)
  const periodLabel = PERIODS.find(p => p.key === period)!.label

  // ?? 0 fallbacks: older API responses lack the period fields
  const ot = data?.org_totals
  const orgPeriod =
    period === 'today' ? { ind: ot?.today_individual_visits ?? ot?.today_visits ?? 0, store: ot?.today_store_visits ?? 0 }
    : period === 'week' ? { ind: ot?.week_individual_visits ?? 0, store: ot?.week_store_visits ?? 0 }
    : period === 'month' ? { ind: ot?.month_individual_visits ?? ot?.month_visits ?? 0, store: ot?.month_store_visits ?? 0 }
    : { ind: ot?.prior_month_individual_visits ?? 0, store: ot?.prior_month_store_visits ?? 0 }

  const teamPeriod = (team: TeamStat) =>
    period === 'today' ? { ind: team.today_visits ?? 0, store: team.today_stores ?? 0 }
    : period === 'week' ? { ind: team.week_visits ?? 0, store: team.week_stores ?? 0 }
    : period === 'month' ? { ind: team.month_visits, store: team.month_stores }
    : { ind: team.prior_month_visits ?? 0, store: team.prior_month_stores ?? 0 }

  // Worst-first: a manager opens this to find who needs attention, not to admire the leader.
  const teams = [...(data?.teams || [])].sort((a, b) => (a.achievement || 0) - (b.achievement || 0))

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
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-1 flex">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors ${period === p.key ? 'bg-[#00E87B] text-[#0A1628]' : 'text-gray-400'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Org KPIs */}
      <div className="px-5 pt-3 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-[#00E87B]/10"><MapPin className="w-4 h-4 text-[#00E87B]" /></div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">{periodLabel} Individual</span>
            </div>
            <p className="text-xl font-bold text-white">{orgPeriod.ind}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10"><UserCheck className="w-4 h-4 text-amber-400" /></div>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">{periodLabel} Store</span>
            </div>
            <p className="text-xl font-bold text-white">{orgPeriod.store}</p>
          </div>
        </div>
      </div>

      {/* Org Targets - Individual + Store Visits with progress bars */}
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
              <p className="text-[10px] text-gray-400">Month-to-date vs target · not the {periodLabel} filter above</p>
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
                {data?.org_targets?.actual_visits || 0}/{data?.org_targets?.target_visits || 0}
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
                {data?.org_targets?.actual_stores || 0}/{data?.org_targets?.target_stores || 0}
                <span className={' ml-1 ' + pctClass(rPct)}>({rPct}%)</span>
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: rPct + '%', backgroundColor: progressColor(rPct) }} />
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

      {/* Incentive Tiers (expandable) — sourced from incentive_scales, same as agent/team-lead screens */}
      {scaleGroups.length > 0 && (
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
              {scaleGroups.map((group) => (
                <div key={group.key} className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{group.label}</h3>
                  <div className="space-y-1.5">
                    {group.tiers.map((tier) => (
                      <div key={tier.amount} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                        <p className="text-xs text-gray-400">{tier.signups} signups + {tier.deposits} deposits /day</p>
                        <span className="text-xs font-semibold text-[#00E87B]">{rand(tier.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[9px] text-gray-600 px-1">Both gates must be met on daily average for the month</p>
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

      {/* Team Leads List — the team-lead tier of the org drill-down (org ring above → team here → agents on tap) */}
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Team Performance</h2>
          <span className="text-[10px] text-gray-600">Lowest achievement first</span>
        </div>
        {teams.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No teams found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {teams.map((team) => {
              const isExpanded = expandedTeam === team.team_lead_id
              const teamVPct = (team.target_visits || 0) > 0 ? Math.min(100, Math.round((team.actual_visits / team.target_visits) * 100)) : 0
              const teamRPct = (team.target_stores || 0) > 0 ? Math.min(100, Math.round((team.actual_stores / team.target_stores) * 100)) : 0
              return (
                <div key={team.team_lead_id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedTeam(isExpanded ? null : team.team_lead_id)}
                    className="w-full p-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#00E87B]/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-[#00E87B]" />
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
                          <p className="text-[10px] text-gray-500">{periodLabel} Individual</p>
                          <p className="text-sm font-semibold text-white">{teamPeriod(team).ind}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-[10px] text-gray-500">{periodLabel} Store</p>
                          <p className="text-sm font-semibold text-white">{teamPeriod(team).store}</p>
                        </div>
                      </div>
                      {/* Individual target progress */}
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-gray-500">Individual Target</span>
                          <span className="text-white">{team.actual_visits}/{team.target_visits} <span className={pctClass(teamVPct)}>({teamVPct}%)</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: teamVPct + '%', backgroundColor: progressColor(teamVPct) }} />
                        </div>
                      </div>
                      {/* Store target progress */}
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-gray-500">Store Target</span>
                          <span className="text-white">{team.actual_stores}/{team.target_stores} <span className={pctClass(teamRPct)}>({teamRPct}%)</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: teamRPct + '%', backgroundColor: progressColor(teamRPct) }} />
                        </div>
                      </div>
                      {/* A manager's accountable person is the team lead, so act on them here. */}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => nudge(team.team_lead_id, team.team_lead_name)}
                          disabled={busy === team.team_lead_id}
                          className="min-h-[44px] py-2 bg-amber-400/10 border border-amber-400/25 rounded-lg text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {busy === team.team_lead_id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Bell className="w-3.5 h-3.5" />} Nudge Lead
                        </button>
                        <button
                          onClick={() => call(team.team_lead_id, team.team_lead_name)}
                          disabled={busy === team.team_lead_id}
                          className="min-h-[44px] py-2 bg-[#00E87B]/10 border border-[#00E87B]/25 rounded-lg text-xs font-semibold text-[#00E87B] flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call Lead
                        </button>
                      </div>
                      {/* Drill-down button */}
                      <button
                        onClick={() => navigate(`/agent/team-detail/${team.team_lead_id}`)}
                        className="w-full mt-2 min-h-[44px] py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" /> View Agents & History
                        <ChevronRight className="w-3 h-3" />
                      </button>
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
