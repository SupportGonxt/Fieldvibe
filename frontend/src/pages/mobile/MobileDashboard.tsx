import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Clock, CheckCircle, AlertTriangle, TrendingUp,
  Users, Package, Calendar, ChevronRight, ChevronDown, ChevronUp,
  Wifi, WifiOff, RefreshCw, Target, Store, User, Shield, UserCheck
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { isOnline, getSyncQueueCount } from '../../utils/offline-storage'
import { apiClient } from '../../services/api.service'

// MOB-03: Mobile Dashboard with role-aware widgets, period toggle, team lead/manager drill-down, hierarchy scores

interface QuickAction {
  label: string
  icon: React.ReactNode
  path: string
  color: string
  roles?: string[]
}

interface StatCard {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
  trend?: { value: number; direction: 'up' | 'down' }
}

type PeriodType = 'day' | 'week' | 'month'

interface AgentPerf {
  agent_id: string
  agent_name: string
  visits: number
  individual_visits: number
  store_visits: number
  conversions: number
  target_visits: number
  target_stores: number
}

interface TeamPerf {
  team_lead_id: string
  team_lead_name: string
  agent_count: number
  visits: number
  individual_visits: number
  store_visits: number
  conversions: number
  target_visits: number
  target_stores: number
  conversion_rate: number
}

interface PerformanceData {
  role: string
  period?: { start: string; end: string; type: string }
  visits?: number
  individual_visits?: number
  store_visits?: number
  conversions?: number
  targets?: { visits: number; conversions: number; individuals: number; stores: number }
  visit_progress?: number
  conversion_rate?: number
  team_size?: number
  total_visits?: number
  total_individual_visits?: number
  total_store_visits?: number
  total_conversions?: number
  total_target_visits?: number
  total_target_stores?: number
  agents?: AgentPerf[]
  total_team_leads?: number
  total_agents?: number
  teams?: TeamPerf[]
  grand_total_visits?: number
  grand_total_individual_visits?: number
  grand_total_store_visits?: number
  grand_total_conversions?: number
  grand_total_target_visits?: number
  grand_total_target_stores?: number
}

interface CompanyTarget {
  company_id: string
  company_name: string
  working_days_in_month: number
  daily_target_visits: number
  daily_target_registrations: number
  daily_actual_visits: number
  daily_actual_registrations: number
  store_target_per_month: number
  store_actual_month: number
  store_actual_today: number
  store_actual_week: number
  individual_target_per_week: number
  individual_target_per_month: number
  individual_actual_month: number
  individual_actual_today: number
  individual_actual_week: number
  week_target_visits: number
  week_actual_visits: number
  week_target_registrations: number
  month_target_visits: number
  month_actual_visits: number
  month_target_registrations: number
  month_actual_registrations: number
}

interface AgentHierarchyData {
  team_performance: {
    team_lead_name: string
    member_count: number
    total_visits: number
    total_individuals: number
    target_visits: number
    actual_visits: number
    target_registrations: number
    actual_registrations: number
    achievement: number
  } | null
  manager_performance: {
    manager_name: string
    achievement: number
  } | null
}

interface DashboardResponse {
  today_visits: number
  month_visits: number
  week_visits: number
  today_stores: number
  month_stores: number
  week_stores: number
  today_individual_visits: number
  today_store_visits: number
  month_individual_visits: number
  month_store_visits: number
  week_individual_visits: number
  week_store_visits: number
  recent_visits: Array<Record<string, unknown>>
  companies: Array<{ id: string; name: string }>
  daily_targets: Array<Record<string, unknown>>
  company_target_rules: Array<Record<string, unknown>>
  company_targets: CompanyTarget[]
  weekly_targets: { target_visits: number; actual_visits: number; target_registrations: number; actual_registrations: number }
  monthly_targets: { target_visits: number; actual_visits: number; target_registrations: number; actual_registrations: number }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  ])
}

export default function MobileDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [online, setOnline] = useState(isOnline())
  const [syncCount, setSyncCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [dashData, setDashData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodType>('day')
  const [perfData, setPerfData] = useState<PerformanceData | null>(null)
  const [perfLoading, setPerfLoading] = useState(false)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [teamAgents, setTeamAgents] = useState<Record<string, AgentPerf[]>>({})
  const [teamAgentsLoading, setTeamAgentsLoading] = useState<string | null>(null)
  const [hierarchyData, setHierarchyData] = useState<AgentHierarchyData | null>(null)

  const role = user?.role || 'agent'
  const isTeamLead = role === 'team_lead'
  const isManager = role === 'manager' || role === 'admin' || role === 'super_admin'
  const isAgent = !isTeamLead && !isManager

  const fetchStats = useCallback(async () => {
    try {
      const dashRes = await withTimeout(apiClient.get('/agent/dashboard'), 15000)
      if (dashRes?.data?.success && dashRes?.data?.data) {
        setDashData(dashRes.data.data as DashboardResponse)
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch performance data for ALL roles (agents, team leads, managers)
  const fetchPerformance = useCallback(async (p: PeriodType) => {
    setPerfLoading(true)
    try {
      const res = await withTimeout(apiClient.get('/field-ops/performance?period=' + p), 15000)
      if (res?.data) {
        setPerfData(res.data)
      }
    } catch (err) {
      console.error('Performance fetch error:', err)
    } finally {
      setPerfLoading(false)
    }
  }, [])

  // Fetch hierarchy data for agents (team lead + manager scores)
  const fetchHierarchy = useCallback(async () => {
    if (!isAgent) return
    try {
      const res = await withTimeout(apiClient.get('/agent/performance'), 15000)
      if (res?.data?.success && res?.data?.data) {
        setHierarchyData({
          team_performance: res.data.data.team_performance || null,
          manager_performance: res.data.data.manager_performance || null,
        })
      }
    } catch (err) {
      console.error('Hierarchy fetch error:', err)
    }
  }, [isAgent])

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    getSyncQueueCount().then(setSyncCount)
    fetchStats()
    fetchHierarchy()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [fetchStats, fetchHierarchy])

  // Fetch performance data when period changes - for ALL roles
  useEffect(() => {
    fetchPerformance(period)
    // Clear cached team agents when period changes so stale data isn't shown
    setTeamAgents({})
    setExpandedTeam(null)
  }, [period, fetchPerformance])

  // Get period-specific stats from dashboard data
  const getPeriodStats = () => {
    if (!dashData) return { visits: 0, stores: 0, label: "Today's" }
    if (period === 'day') {
      return {
        visits: dashData.today_individual_visits || dashData.today_visits || 0,
        stores: dashData.today_store_visits || dashData.today_stores || 0,
        label: "Today's"
      }
    } else if (period === 'week') {
      return {
        visits: dashData.week_individual_visits || dashData.week_visits || 0,
        stores: dashData.week_store_visits || dashData.week_stores || 0,
        label: "This Week's"
      }
    } else {
      return {
        visits: dashData.month_individual_visits || dashData.month_visits || 0,
        stores: dashData.month_store_visits || dashData.month_stores || 0,
        label: "This Month's"
      }
    }
  }

  // Get agent performance stats from /field-ops/performance (period-filtered)
  const getAgentPerfStats = () => {
    if (!perfData || perfData.role !== 'agent') return null
    return {
      visits: perfData.visits || 0,
      individual_visits: perfData.individual_visits || 0,
      store_visits: perfData.store_visits || 0,
      conversions: perfData.conversions || 0,
      targets: perfData.targets || { visits: 0, conversions: 0, individuals: 0, stores: 0 },
      visit_progress: perfData.visit_progress || 0,
      conversion_rate: perfData.conversion_rate || 0,
    }
  }

  const periodStats = getPeriodStats()
  const agentPerfStats = getAgentPerfStats()

  // Compute target count from company_targets
  const companyTargets = dashData?.company_targets || []
  const hasTargets = companyTargets.length > 0

  const stats: StatCard[] = [
    { label: periodStats.label + ' Individual', value: agentPerfStats ? agentPerfStats.individual_visits : periodStats.visits, icon: <MapPin className="w-5 h-5" />, color: 'bg-blue-500' },
    { label: periodStats.label + ' Store', value: agentPerfStats ? agentPerfStats.store_visits : periodStats.stores, icon: <Store className="w-5 h-5" />, color: 'bg-purple-500' },
    { label: periodStats.label + ' Total', value: agentPerfStats ? agentPerfStats.visits : (periodStats.visits + periodStats.stores), icon: <TrendingUp className="w-5 h-5" />, color: 'bg-green-500' },
    { label: 'Targets', value: hasTargets ? companyTargets.length : 0, icon: <Target className="w-5 h-5" />, color: 'bg-orange-500' },
  ]

  const quickActions: QuickAction[] = [
    { label: 'New Visit', icon: <MapPin className="w-6 h-6" />, path: '/field-operations/visits/create', color: 'bg-blue-100 text-blue-700' },
    { label: 'New Order', icon: <Package className="w-6 h-6" />, path: '/orders/create', color: 'bg-green-100 text-green-700' },
    { label: 'Customers', icon: <Users className="w-6 h-6" />, path: '/customers', color: 'bg-purple-100 text-purple-700' },
    { label: 'Reports', icon: <TrendingUp className="w-6 h-6" />, path: '/reports', color: 'bg-orange-100 text-orange-700', roles: ['admin', 'super_admin', 'manager'] },
  ]

  const filteredActions = quickActions.filter(a => !a.roles || a.roles.includes(role))

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        fetchStats(),
        fetchPerformance(period),
        fetchHierarchy(),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  const handleExpandTeam = async (teamLeadId: string) => {
    if (expandedTeam === teamLeadId) {
      setExpandedTeam(null)
      return
    }
    setExpandedTeam(teamLeadId)
    if (teamAgents[teamLeadId]) return
    setTeamAgentsLoading(teamLeadId)
    try {
      const res = await withTimeout(apiClient.get('/field-ops/performance?period=' + period + '&team_lead_id=' + teamLeadId), 15000)
      if (res?.data?.agents) {
        setTeamAgents(prev => ({ ...prev, [teamLeadId]: res.data.agents }))
      }
    } catch {
      // fallback
    } finally {
      setTeamAgentsLoading(null)
    }
  }

  const periodLabels: Record<PeriodType, string> = { day: 'Day', week: 'Week', month: 'Month' }
  const recentVisits = dashData?.recent_visits

  // Helper: get target values for a company based on current period
  const getCompanyTargetForPeriod = (ct: CompanyTarget) => {
    if (period === 'day') {
      return {
        targetIndiv: ct.daily_target_visits,
        actualIndiv: ct.daily_actual_visits,
        targetStore: ct.daily_target_registrations,
        actualStore: ct.daily_actual_registrations,
        periodLabel: 'Today',
      }
    } else if (period === 'week') {
      return {
        targetIndiv: ct.week_target_visits || (ct.individual_target_per_week > 0 ? ct.individual_target_per_week : ct.daily_target_visits * 5),
        actualIndiv: ct.individual_actual_week,
        targetStore: ct.week_target_registrations || (ct.daily_target_registrations * 5),
        actualStore: ct.store_actual_week,
        periodLabel: 'Week',
      }
    } else {
      return {
        targetIndiv: ct.month_target_visits || ct.individual_target_per_month || (ct.daily_target_visits * ct.working_days_in_month),
        actualIndiv: ct.individual_actual_month,
        targetStore: ct.month_target_registrations || ct.store_target_per_month || (ct.daily_target_registrations * ct.working_days_in_month),
        actualStore: ct.store_actual_month,
        periodLabel: 'Month',
      }
    }
  }

  // Helper: percentage with color
  const pctColor = (pct: number) => pct >= 100 ? 'text-green-600' : pct >= 75 ? 'text-amber-500' : 'text-red-500'
  const pctBadge = (pct: number) => pct >= 100 ? 'bg-green-100 text-green-700' : pct >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  const pctBar = (pct: number) => pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-500' : 'bg-red-500'
  const pctDot = (pct: number) => pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-night-300 pb-20">
      {/* Status Bar */}
      <div className="bg-white dark:bg-night-50 px-4 py-2 flex items-center justify-between border-b border-gray-200 dark:border-night-100">
        <div className="flex items-center gap-2">
          {online ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className="text-xs text-gray-500">{online ? 'Online' : 'Offline'}</span>
          {syncCount > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">{syncCount} pending</span>
          )}
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="p-1">
          <RefreshCw className={'w-4 h-4 text-gray-500 ' + (refreshing ? 'animate-spin' : '')} />
        </button>
      </div>

      {/* Greeting */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.first_name || 'User'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Period Toggle */}
      <div className="px-4 py-2">
        <div className="flex bg-gray-200 dark:bg-night-100 rounded-lg p-0.5">
          {(['day', 'week', 'month'] as PeriodType[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ' + (
                period === p
                  ? 'bg-white dark:bg-night-50 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white dark:bg-night-50 rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className={'p-2 rounded-lg ' + stat.color + ' text-white'}>{stat.icon}</div>
                {stat.trend && (
                  <span className={'text-xs font-medium ' + (stat.trend.direction === 'up' ? 'text-green-600' : 'text-red-600')}>
                    {stat.trend.direction === 'up' ? '+' : '-'}{stat.trend.value}%
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Agent Performance (period-aware) */}
      {isAgent && agentPerfStats && (
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-500" /> My Performance ({periodLabels[period]})
          </h2>
          <div className="bg-white dark:bg-night-50 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-night-100">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-blue-600">{agentPerfStats.individual_visits}</p>
                <p className="text-[10px] text-gray-500">Individuals</p>
                {agentPerfStats.targets.individuals > 0 && (
                  <p className="text-[9px] text-gray-400">/ {agentPerfStats.targets.individuals} target</p>
                )}
              </div>
              <div>
                <p className="text-lg font-bold text-purple-600">{agentPerfStats.store_visits}</p>
                <p className="text-[10px] text-gray-500">Stores</p>
                {agentPerfStats.targets.stores > 0 && (
                  <p className="text-[9px] text-gray-400">/ {agentPerfStats.targets.stores} target</p>
                )}
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{agentPerfStats.conversions}</p>
                <p className="text-[10px] text-gray-500">Conversions</p>
                {agentPerfStats.targets.conversions > 0 && (
                  <p className="text-[9px] text-gray-400">/ {agentPerfStats.targets.conversions} target</p>
                )}
              </div>
            </div>
            {agentPerfStats.targets.visits > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Visit Progress</span>
                  <span className={pctColor(agentPerfStats.visit_progress)}>{agentPerfStats.visit_progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-night-200 rounded-full overflow-hidden">
                  <div className={'h-full rounded-full transition-all ' + pctBar(agentPerfStats.visit_progress)} style={{ width: Math.min(100, agentPerfStats.visit_progress) + '%' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hierarchy Scores: Agent vs Team Lead vs Manager (always monthly to match hierarchy data) */}
      {isAgent && hierarchyData && (hierarchyData.team_performance || hierarchyData.manager_performance) && (
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" /> Score Comparison (Monthly)
          </h2>
          <div className="space-y-2">
            {/* My Score - always monthly to match hierarchy data */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">My Total</span>
                </div>
                <span className="text-lg font-bold text-blue-600">{(dashData?.month_individual_visits ?? dashData?.month_visits ?? 0) + (dashData?.month_store_visits ?? dashData?.month_stores ?? 0)}</span>
              </div>
            </div>
            {/* Team Lead Score */}
            {hierarchyData.team_performance && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-green-600" />
                    <div>
                      <span className="text-sm font-medium text-green-800 dark:text-green-300">Team Lead Total</span>
                      <p className="text-[10px] text-green-600 dark:text-green-400">{hierarchyData.team_performance.team_lead_name} ({hierarchyData.team_performance.member_count} members)</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-green-600">{hierarchyData.team_performance.total_visits}</span>
                    <p className={'text-[10px] font-medium ' + pctColor(hierarchyData.team_performance.achievement)}>{hierarchyData.team_performance.achievement}%</p>
                  </div>
                </div>
              </div>
            )}
            {/* Manager Score */}
            {hierarchyData.manager_performance && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800 dark:text-purple-300">{hierarchyData.manager_performance.manager_name}</span>
                  </div>
                  <div className="text-right">
                    <span className={'text-[10px] font-medium ' + pctColor(hierarchyData.manager_performance.achievement)}>{hierarchyData.manager_performance.achievement}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team Lead: Team Performance */}
      {isTeamLead && (
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" /> Team Performance ({periodLabels[period]})
          </h2>
          {perfLoading ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : perfData?.agents && perfData.agents.length > 0 ? (
            <div className="space-y-2">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 mb-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-600">{perfData.total_visits || 0}</p>
                    <p className="text-[10px] text-blue-700 dark:text-blue-400">Total Visits</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{perfData.total_conversions || 0}</p>
                    <p className="text-[10px] text-green-700 dark:text-green-400">Conversions</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-purple-600">{perfData.team_size || 0}</p>
                    <p className="text-[10px] text-purple-700 dark:text-purple-400">Team Size</p>
                  </div>
                </div>
              </div>
              {perfData.agents.map((agent) => {
                const vPct = agent.target_visits > 0 ? Math.min(100, Math.round((agent.visits / agent.target_visits) * 100)) : 0
                return (
                  <div key={agent.agent_id} className="bg-white dark:bg-night-50 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-night-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{agent.agent_name}</p>
                      </div>
                      <span className={'text-xs font-medium px-2 py-0.5 rounded ' + pctBadge(vPct)}>
                        {vPct}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{agent.individual_visits || 0}</p>
                        <p className="text-gray-500">Individuals</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{agent.store_visits || 0}</p>
                        <p className="text-gray-500">Stores</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{agent.conversions || 0}</p>
                        <p className="text-gray-500">Conversions</p>
                      </div>
                    </div>
                    {agent.target_visits > 0 && (
                      <div className="mt-2">
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-night-200 rounded-full overflow-hidden">
                          <div className={'h-full rounded-full transition-all ' + pctBar(vPct)} style={{ width: vPct + '%' }} />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">{agent.visits}/{agent.target_visits} target visits</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-night-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-400">No team performance data available</p>
            </div>
          )}
        </div>
      )}

      {/* Manager: All Teams Drill-Down */}
      {isManager && (
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" /> All Teams ({periodLabels[period]})
          </h2>
          {perfLoading ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : perfData?.teams && perfData.teams.length > 0 ? (
            <div className="space-y-2">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 mb-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-indigo-600">{perfData.grand_total_visits || perfData.total_visits || 0}</p>
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-400">Visits</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{perfData.grand_total_conversions || perfData.total_conversions || 0}</p>
                    <p className="text-[10px] text-green-700 dark:text-green-400">Conversions</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-600">{perfData.total_team_leads || 0}</p>
                    <p className="text-[10px] text-blue-700 dark:text-blue-400">Team Leads</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-purple-600">{perfData.total_agents || 0}</p>
                    <p className="text-[10px] text-purple-700 dark:text-purple-400">Agents</p>
                  </div>
                </div>
              </div>
              {perfData.teams.map((team) => {
                const isExpanded = expandedTeam === team.team_lead_id
                const agents = teamAgents[team.team_lead_id]
                const vPct = team.target_visits > 0 ? Math.min(100, Math.round((team.visits / team.target_visits) * 100)) : 0
                return (
                  <div key={team.team_lead_id} className="bg-white dark:bg-night-50 rounded-xl shadow-sm border border-gray-200 dark:border-night-100 overflow-hidden">
                    <button
                      onClick={() => handleExpandTeam(team.team_lead_id)}
                      className="w-full p-3 text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{team.team_lead_name}</p>
                            <p className="text-[10px] text-gray-500">{team.agent_count} agents</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={'text-xs font-medium px-2 py-0.5 rounded ' + pctBadge(vPct)}>
                            {vPct}%
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{team.visits}</p>
                          <p className="text-gray-500">Visits</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{team.conversions}</p>
                          <p className="text-gray-500">Conversions</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{team.conversion_rate}%</p>
                          <p className="text-gray-500">Conv Rate</p>
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-night-100 bg-gray-50 dark:bg-night-200/50 p-2 space-y-1.5">
                        {teamAgentsLoading === team.team_lead_id ? (
                          <div className="flex items-center justify-center py-3">
                            <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                          </div>
                        ) : agents && agents.length > 0 ? (
                          agents.map((agent) => (
                            <div key={agent.agent_id} className="bg-white dark:bg-night-50 rounded-lg p-2.5">
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3 text-gray-400" />
                                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{agent.agent_name}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center text-[10px] mt-1.5">
                                <div>
                                  <p className="font-semibold text-gray-700 dark:text-gray-300">{agent.individual_visits || 0}</p>
                                  <p className="text-gray-400">Individuals</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-700 dark:text-gray-300">{agent.store_visits || 0}</p>
                                  <p className="text-gray-400">Stores</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-700 dark:text-gray-300">{agent.conversions || 0}</p>
                                  <p className="text-gray-400">Conversions</p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-xs text-gray-400 py-2">No agent data available</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-night-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-400">No team data available</p>
            </div>
          )}
        </div>
      )}

      {/* Company Targets (period-aware from company_targets) */}
      {!loading && hasTargets && (
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-orange-500" /> Company Targets ({periodLabels[period]})
          </h2>
          <div className="space-y-2">
            {companyTargets.map((ct, i) => {
              const t = getCompanyTargetForPeriod(ct)
              const vPct = t.targetIndiv > 0 ? Math.min(100, Math.round((t.actualIndiv / t.targetIndiv) * 100)) : 0
              const sPct = t.targetStore > 0 ? Math.min(100, Math.round((t.actualStore / t.targetStore) * 100)) : 0
              return (
                <div key={ct.company_id || i} className="bg-white dark:bg-night-50 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-night-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{ct.company_name}</p>
                    <div className="flex items-center gap-1">
                      <div className={'w-2 h-2 rounded-full ' + pctDot(Math.max(vPct, sPct))} />
                      <span className="text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded">{t.periodLabel}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500 dark:text-gray-400">Individual Visits</span>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{t.actualIndiv}/{t.targetIndiv} <span className={pctColor(vPct)}>({vPct}%)</span></span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-night-200 rounded-full overflow-hidden">
                        <div className={'h-full rounded-full transition-all ' + pctBar(vPct)} style={{ width: vPct + '%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500 dark:text-gray-400">Store Visits</span>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{t.actualStore}/{t.targetStore} <span className={pctColor(sPct)}>({sPct}%)</span></span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-night-200 rounded-full overflow-hidden">
                        <div className={'h-full rounded-full transition-all ' + pctBar(sPct)} style={{ width: sPct + '%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          {filteredActions.map((action, i) => (
            <button
              key={i}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white dark:bg-night-50 shadow-sm active:scale-95 transition-transform"
            >
              <div className={'p-2 rounded-lg ' + action.color}>{action.icon}</div>
              <span className="text-xs text-gray-700 dark:text-gray-300 text-center">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Visits */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Visits</h2>
          <button onClick={() => navigate('/field-operations/visits')} className="text-xs text-blue-600 flex items-center">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-2">
          {recentVisits && recentVisits.length > 0 ? (
            recentVisits.slice(0, 5).map((visit: Record<string, unknown>, i: number) => (
              <div key={(visit.id as string) || i} className="bg-white dark:bg-night-50 rounded-lg p-3 shadow-sm flex items-center gap-3">
                <div className="text-center min-w-[48px]">
                  <p className="text-xs font-medium text-gray-500">{visit.visit_date ? new Date(visit.visit_date as string).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }) : ''}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{(visit.customer_name as string) || (visit.visit_type as string) || 'Visit'}</p>
                  <p className="text-xs text-gray-500">{visit.visit_type as string}</p>
                </div>
                <div>
                  {visit.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : visit.status === 'in_progress' ? (
                    <Clock className="w-5 h-5 text-blue-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-gray-300" />
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-night-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-400">No recent visits</p>
            </div>
          )}
        </div>
      </div>

      {/* Offline Alert */}
      {!online && (
        <div className="fixed bottom-20 left-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 shadow-lg">
          <WifiOff className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">You're offline</p>
            <p className="text-xs text-yellow-600">Changes will sync when you reconnect</p>
          </div>
        </div>
      )}
    </div>
  )
}
