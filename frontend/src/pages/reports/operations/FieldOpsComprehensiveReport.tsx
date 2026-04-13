import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import { fieldOperationsService } from '../../../services/field-operations.service'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import DateRangePresets from '../../../components/ui/DateRangePresets'
import toast from 'react-hot-toast'
import {
  BarChart3, Users, MapPin, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight,
  AlertTriangle, Award, Activity, Target, Store, Eye, ChevronLeft, X,
  Filter, List, Download, FileSpreadsheet, FileText
} from 'lucide-react'

// ─── Shared Types ───────────────────────────────────────────────────────────

interface KPIs {
  total_checkins: number
  approved_checkins: number
  active_agents: number
  total_shops: number
  conversions: number
  total_visits: number
  total_individuals: number
}

interface AgentPerformance {
  agent_id: string
  agent_name: string
  checkin_count: number
  conversions: number
  conversion_rate: number
}

interface HourlyData { hour: number; count: number }
interface DailyData { day_name: string; day_num: number; count: number }

interface ConversionStats {
  converted_yes: number
  converted_no: number
  betting_yes: number
  betting_no: number
}

interface Checkin {
  id: string
  agent_id: string
  agent_name: string
  shop_id: string
  timestamp: string
  latitude: number
  longitude: number
  status: string
  notes: string
  visit_target_type: string
}

interface Agent { agent_id: string; agent_name: string }

interface Shop {
  id: string
  name: string
  address: string
  total_checkins: number
  approved_checkins: number
  conversions: number
  last_visit: string
}

interface ShopDetail {
  shop: Record<string, unknown>
  checkins: Array<{
    id: string; timestamp: string; status: string; converted: number;
    responses: string; thumbnail_url?: string; agent_name?: string;
    shop_exterior_photo?: string; ad_board_photo?: string; competitor_photo?: string
  }>
  stats: { total_checkins: number; approved: number; conversions: number }
}

interface CustomerRecord {
  checkin_id: string
  timestamp: string
  latitude: number
  longitude: number
  agent_id: string
  agent_name: string
  shop_name: string
  shop_id: string
  responses: string
  converted: number
  already_betting: number
}

// ─── Tab types ──────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'insights' | 'checkins' | 'stores' | 'individuals' | 'export'

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'insights', label: 'Insights', icon: <Activity className="w-4 h-4" /> },
  { key: 'checkins', label: 'Check-ins', icon: <List className="w-4 h-4" /> },
  { key: 'stores', label: 'Stores', icon: <Store className="w-4 h-4" /> },
  { key: 'individuals', label: 'Individuals', icon: <Users className="w-4 h-4" /> },
  { key: 'export', label: 'Export', icon: <Download className="w-4 h-4" /> },
]

// ─── Main Component ─────────────────────────────────────────────────────────

const FieldOpsComprehensiveReport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<string>('')

  // Company selector (shared across all tabs)
  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })
  const companies = companiesResp?.data || companiesResp || []

  useEffect(() => {
    if (Array.isArray(companies) && companies.length === 1 && !selectedCompany) {
      setSelectedCompany(companies[0].id)
    }
  }, [companies, selectedCompany])

  const dateParams = startDate || endDate
    ? `?${startDate ? `startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`
    : ''
  const companyParam = selectedCompany
    ? `${dateParams ? '&' : '?'}company_id=${selectedCompany}`
    : ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Field Operations Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Comprehensive analytics, check-ins, stores, individuals, and export</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Array.isArray(companies) && companies.length > 1 && (
            <SearchableSelect
              options={[
                { value: '', label: 'All Companies' },
                ...companies.map((c: any) => ({ value: c.id, label: c.name }))
              ]}
              value={selectedCompany || null}
              onChange={(val) => setSelectedCompany(val || '')}
              placeholder="All Companies"
            />
          )}
          <DateRangePresets
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab dateParams={dateParams} companyParam={companyParam} startDate={startDate} endDate={endDate} selectedCompany={selectedCompany} />
      )}
      {activeTab === 'insights' && (
        <InsightsTab dateParams={dateParams} companyParam={companyParam} startDate={startDate} endDate={endDate} selectedCompany={selectedCompany} />
      )}
      {activeTab === 'checkins' && (
        <CheckinsTab startDate={startDate} endDate={endDate} selectedCompany={selectedCompany} />
      )}
      {activeTab === 'stores' && (
        <StoresTab startDate={startDate} endDate={endDate} selectedCompany={selectedCompany} />
      )}
      {activeTab === 'individuals' && (
        <IndividualsTab startDate={startDate} endDate={endDate} selectedCompany={selectedCompany} />
      )}
      {activeTab === 'export' && (
        <ExportTab dateParams={dateParams} companyParam={companyParam} startDate={startDate} endDate={endDate} selectedCompany={selectedCompany} />
      )}
    </div>
  )
}

// ─── Overview Tab (was ReportsDashboard) ────────────────────────────────────

interface TabProps {
  dateParams: string
  companyParam: string
  startDate: string
  endDate: string
  selectedCompany: string
}

function OverviewTab({ dateParams, companyParam, startDate, endDate, selectedCompany }: TabProps) {
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useQuery({
    queryKey: ['field-ops-kpis', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/kpis${dateParams}${companyParam}`)
      return (res.data?.kpis || {}) as KPIs
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })

  const { data: agentPerf = [], isLoading: agentLoading } = useQuery({
    queryKey: ['field-ops-agent-perf', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/agent-performance${dateParams}${companyParam}`)
      return (res.data?.data || []) as AgentPerformance[]
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })

  const { data: hourlyData = [] } = useQuery({
    queryKey: ['field-ops-hourly', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/checkins-by-hour${dateParams}${companyParam}`)
      return (res.data?.data || []) as HourlyData[]
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })

  const { data: dailyData = [] } = useQuery({
    queryKey: ['field-ops-daily', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/checkins-by-day${dateParams}${companyParam}`)
      return (res.data?.data || []) as DailyData[]
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })

  const { data: conversionStats } = useQuery({
    queryKey: ['field-ops-conversions', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/conversion-stats${dateParams}${companyParam}`)
      return (res.data?.data || {}) as ConversionStats
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })

  if (kpisLoading) return <LoadingSpinner />
  if (kpisError) return <ErrorBanner />

  const maxHourly = Math.max(...hourlyData.map(h => h.count), 1)
  const maxDaily = Math.max(...dailyData.map(d => d.count), 1)
  const convTotal = (conversionStats?.converted_yes || 0) + (conversionStats?.converted_no || 0)
  const convRate = convTotal > 0 ? ((conversionStats?.converted_yes || 0) / convTotal * 100).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: 'Total Check-ins', value: kpis?.total_checkins || 0, icon: MapPin, color: 'blue' },
          { label: 'Approved', value: kpis?.approved_checkins || 0, icon: BarChart3, color: 'green' },
          { label: 'Active Agents', value: kpis?.active_agents || 0, icon: Users, color: 'purple' },
          { label: 'Total Shops', value: kpis?.total_shops || 0, icon: MapPin, color: 'orange' },
          { label: 'Conversions', value: kpis?.conversions || 0, icon: TrendingUp, color: 'emerald' },
          { label: 'Individuals', value: kpis?.total_individuals || 0, icon: Users, color: 'pink' },
          { label: 'Conv. Rate', value: `${convRate}%`, icon: ArrowUpRight, color: 'cyan' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`h-4 w-4 text-${kpi.color}-500`} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Check-ins by Hour</h3>
          <div className="flex items-end gap-1 h-48">
            {hourlyData.map((h) => (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-blue-500 rounded-t" style={{ height: `${(h.count / maxHourly) * 100}%`, minHeight: h.count > 0 ? '4px' : '0' }} />
                <span className="text-[10px] text-gray-400">{h.hour}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Check-ins by Day</h3>
          <div className="space-y-3">
            {dailyData.map((d) => (
              <div key={d.day_num} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-20">{d.day_name.slice(0, 3)}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full flex items-center px-2"
                    style={{ width: `${(d.count / maxDaily) * 100}%`, minWidth: d.count > 0 ? '30px' : '0' }}>
                    <span className="text-xs text-white font-medium">{d.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conversion Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conversion Analysis</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-3xl font-bold text-green-600">{conversionStats?.converted_yes || 0}</p>
              <p className="text-sm text-green-700 dark:text-green-400">Converted</p>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-3xl font-bold text-red-600">{conversionStats?.converted_no || 0}</p>
              <p className="text-sm text-red-700 dark:text-red-400">Not Converted</p>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{conversionStats?.betting_yes || 0}</p>
              <p className="text-sm text-blue-700 dark:text-blue-400">Store Visits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-3xl font-bold text-gray-600 dark:text-gray-300">{conversionStats?.betting_no || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Non-Store Visits</p>
            </div>
          </div>
        </div>

        {/* Conversion Rate Gauge */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Overall Conversion Rate</h3>
          <div className="flex flex-col items-center justify-center h-48">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-emerald-500"
                  strokeWidth="8" strokeDasharray={`${parseFloat(convRate) * 2.51} 251`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">{convRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agent Performance</h3>
        {agentLoading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Agent</th>
                  <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Check-ins</th>
                  <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Conversions</th>
                  <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Conv. Rate</th>
                </tr>
              </thead>
              <tbody>
                {agentPerf.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400">No agent data available</td></tr>
                ) : agentPerf.map((agent) => (
                  <tr key={agent.agent_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{agent.agent_name || 'Unknown'}</td>
                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{agent.checkin_count}</td>
                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{agent.conversions}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        agent.conversion_rate >= 50 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        agent.conversion_rate >= 25 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {agent.conversion_rate >= 50 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {agent.conversion_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Insights Tab (was ReportsInsights) ─────────────────────────────────────

function InsightsTab({ dateParams, companyParam, startDate, endDate, selectedCompany }: TabProps) {
  const { data: agentPerf = [], isLoading, isError } = useQuery({
    queryKey: ['field-ops-insights-agents', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/agent-performance${dateParams}${companyParam}`)
      return (res.data?.data || []) as AgentPerformance[]
    },
  })

  const { data: hourlyData = [] } = useQuery({
    queryKey: ['field-ops-insights-hourly', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/checkins-by-hour${dateParams}${companyParam}`)
      return (res.data?.data || []) as HourlyData[]
    },
  })

  const { data: conversionStats } = useQuery({
    queryKey: ['field-ops-insights-conversions', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/conversion-stats${dateParams}${companyParam}`)
      return res.data?.data || {}
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return <ErrorBanner />

  const topAgents = [...agentPerf].sort((a, b) => b.conversion_rate - a.conversion_rate).slice(0, 5)
  const mostActive = [...agentPerf].sort((a, b) => b.checkin_count - a.checkin_count).slice(0, 5)
  const peakHours = [...hourlyData].sort((a, b) => b.count - a.count).slice(0, 5)
  const totalCheckins = agentPerf.reduce((sum, a) => sum + a.checkin_count, 0)
  const totalConversions = agentPerf.reduce((sum, a) => sum + a.conversions, 0)
  const avgConvRate = totalCheckins > 0 ? ((totalConversions / totalCheckins) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <Activity className="h-6 w-6 mb-2 opacity-80" />
          <p className="text-3xl font-bold">{totalCheckins.toLocaleString()}</p>
          <p className="text-sm opacity-80">Total Check-ins</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
          <TrendingUp className="h-6 w-6 mb-2 opacity-80" />
          <p className="text-3xl font-bold">{totalConversions.toLocaleString()}</p>
          <p className="text-sm opacity-80">Total Conversions</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <Target className="h-6 w-6 mb-2 opacity-80" />
          <p className="text-3xl font-bold">{avgConvRate}%</p>
          <p className="text-sm opacity-80">Avg Conversion Rate</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
          <Award className="h-6 w-6 mb-2 opacity-80" />
          <p className="text-3xl font-bold">{agentPerf.length}</p>
          <p className="text-sm opacity-80">Active Agents</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Converting Agents */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" /> Top Converting Agents
          </h3>
          <div className="space-y-4">
            {topAgents.length === 0 ? (
              <p className="text-gray-400 text-sm">No data available</p>
            ) : topAgents.map((agent, i) => (
              <div key={agent.agent_id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                  i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-600' : 'bg-gray-300'
                }`}>{i + 1}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{agent.agent_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{agent.checkin_count} check-ins · {agent.conversions} conversions</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">{agent.conversion_rate}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Most Active Agents */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" /> Most Active Agents
          </h3>
          <div className="space-y-4">
            {mostActive.length === 0 ? (
              <p className="text-gray-400 text-sm">No data available</p>
            ) : mostActive.map((agent) => {
              const maxCheckins = mostActive[0]?.checkin_count || 1
              return (
                <div key={agent.agent_id}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{agent.agent_name || 'Unknown'}</span>
                    <span className="text-sm text-gray-500">{agent.checkin_count}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(agent.checkin_count / maxCheckins) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Peak Activity Hours */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Peak Activity Hours</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {peakHours.map((h, i) => (
            <div key={h.hour} className={`text-center p-4 rounded-lg ${
              i === 0 ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700' :
              'bg-gray-50 dark:bg-gray-700/50'
            }`}>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{h.hour.toString().padStart(2, '0')}:00</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{h.count} check-ins</p>
              {i === 0 && <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Peak Hour</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Check-ins Tab (was ReportsCheckinsList) ────────────────────────────────

function CheckinsTab({ startDate, endDate, selectedCompany }: { startDate: string; endDate: string; selectedCompany: string }) {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [agentId, setAgentId] = useState('')
  const [selectedCheckin, setSelectedCheckin] = useState<string | null>(null)

  const { data: agents = [] } = useQuery({
    queryKey: ['report-agents'],
    queryFn: async () => {
      const res = await apiClient.get('/field-ops/reports/agents')
      return (res.data?.agents || []) as Agent[]
    },
  })

  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  if (status) params.set('status', status)
  if (agentId) params.set('agentId', agentId)
  if (selectedCompany) params.set('company_id', selectedCompany)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['report-checkins', page, startDate, endDate, status, agentId, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/checkins?${params.toString()}`)
      return { checkins: (res.data?.checkins || []) as Checkin[], total: res.data?.total || 0 }
    },
  })

  const { data: checkinDetail } = useQuery({
    queryKey: ['checkin-detail', selectedCheckin],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/checkins/${selectedCheckin}`)
      return res.data
    },
    enabled: !!selectedCheckin,
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return <ErrorBanner />

  const totalPages = Math.ceil((data?.total || 0) / 20)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">{data?.total || 0} records</div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={agentId} onChange={e => { setAgentId(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            <option value="">All Agents</option>
            {agents.map(a => <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>)}
          </select>
        </div>
      </div>

      {/* Checkin Detail Modal */}
      {selectedCheckin && checkinDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCheckin(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Check-in Details</h3>
            <div className="space-y-3 text-sm">
              {Object.entries(checkinDetail.checkin || {}).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                  <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{String(val ?? '-')}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedCheckin(null)} className="mt-4 w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm">Close</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Agent</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Location</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(data?.checkins || []).length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">No check-ins found</td></tr>
              ) : (data?.checkins || []).map((c) => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 text-gray-900 dark:text-white text-xs">{c.timestamp ? new Date(c.timestamp).toLocaleString() : '-'}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{c.agent_name || c.agent_id?.slice(0, 8) || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.visit_target_type === 'store' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>{c.visit_target_type || 'general'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      c.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>{c.status}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {c.latitude && c.longitude ? `${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => setSelectedCheckin(c.id)} className="text-blue-600 hover:text-blue-700">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Stores Tab (was ReportsShopsAnalytics) ─────────────────────────────────

function StoresTab({ startDate, endDate, selectedCompany }: { startDate: string; endDate: string; selectedCompany: string }) {
  const [page, setPage] = useState(1)
  const [selectedShop, setSelectedShop] = useState<string | null>(null)
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)

  const dateParams = `${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`
  const companyParam = selectedCompany ? `&company_id=${selectedCompany}` : ''

  const { data, isLoading, isError } = useQuery({
    queryKey: ['shops-analytics', page, startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/shops-analytics?page=${page}&limit=15${dateParams}${companyParam}`)
      return { shops: (res.data?.shops || []) as Shop[], total: res.data?.total || 0 }
    },
  })

  const { data: shopDetail } = useQuery({
    queryKey: ['shop-detail', selectedShop],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/shops/${selectedShop}`)
      return res.data as ShopDetail
    },
    enabled: !!selectedShop,
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return <ErrorBanner />

  if (selectedShop && shopDetail) {
    const shop = shopDetail.shop as Record<string, string>
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedShop(null)} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
          <ChevronLeft className="h-4 w-4" /> Back to Stores
        </button>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{shop.name || 'Store Details'}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{shop.address || 'No address'}</p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{shopDetail.stats?.total_checkins || 0}</p>
              <p className="text-xs text-blue-700 dark:text-blue-400">Total Check-ins</p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{shopDetail.stats?.approved || 0}</p>
              <p className="text-xs text-green-700 dark:text-green-400">Approved</p>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{shopDetail.stats?.conversions || 0}</p>
              <p className="text-xs text-purple-700 dark:text-purple-400">Conversions</p>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Recent Check-ins</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Photo</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Agent</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Converted</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(shopDetail.checkins || []).map(c => (
                  <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 px-3">
                      {c.thumbnail_url ? (
                        <button onClick={() => setExpandedPhoto(c.thumbnail_url!)} className="block">
                          <img src={c.thumbnail_url} alt="Visit photo" className="w-10 h-10 rounded object-cover border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity" />
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">No photo</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-900 dark:text-white">{c.timestamp ? new Date(c.timestamp).toLocaleDateString() : '-'}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{c.agent_name || '-'}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">{c.converted ? <span className="text-green-600 font-medium">Yes</span> : <span className="text-gray-400">No</span>}</td>
                    <td className="py-2 px-3 text-gray-500 truncate max-w-[200px]">{c.responses || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Photo Expand Modal */}
        {expandedPhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setExpandedPhoto(null)}>
            <div className="relative max-w-3xl max-h-[90vh] p-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setExpandedPhoto(null)}
                className="absolute top-0 right-0 m-2 p-1 bg-white dark:bg-gray-800 rounded-full shadow-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={expandedPhoto}
                alt="Visit photo expanded"
                className="max-w-full max-h-[85vh] rounded-lg object-contain"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  const totalPages = Math.ceil((data?.total || 0) / 15)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <Store className="h-5 w-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.total || 0}</p>
          <p className="text-sm text-gray-500">Total Stores</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <MapPin className="h-5 w-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {(data?.shops || []).reduce((s, shop) => s + shop.total_checkins, 0)}
          </p>
          <p className="text-sm text-gray-500">Total Check-ins</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <Eye className="h-5 w-5 text-purple-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {(data?.shops || []).reduce((s, shop) => s + shop.conversions, 0)}
          </p>
          <p className="text-sm text-gray-500">Total Conversions</p>
        </div>
      </div>

      {/* Shops Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Store</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Check-ins</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Approved</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Conversions</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Last Visit</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(data?.shops || []).length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">No stores found</td></tr>
              ) : (data?.shops || []).map((shop) => (
                <tr key={shop.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900 dark:text-white">{shop.name}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{shop.address || '-'}</p>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{shop.total_checkins}</td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{shop.approved_checkins}</td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{shop.conversions}</td>
                  <td className="py-3 px-4 text-right text-gray-500 text-xs">{shop.last_visit ? new Date(shop.last_visit).toLocaleDateString() : '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => setSelectedShop(shop.id)} className="text-blue-600 hover:text-blue-700 text-xs font-medium">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Individuals Tab (was ReportsCustomersAnalytics) ────────────────────────

function IndividualsTab({ startDate, endDate, selectedCompany }: { startDate: string; endDate: string; selectedCompany: string }) {
  const [page, setPage] = useState(1)

  const dateParams = `${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`
  const companyParam = selectedCompany ? `&company_id=${selectedCompany}` : ''

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customers-analytics', page, startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/customers-analytics?page=${page}&limit=20${dateParams}${companyParam}`)
      return {
        customers: (res.data?.customers || []) as CustomerRecord[],
        total: res.data?.total || 0,
        stats: res.data?.stats || { total_customers: 0, converted: 0, already_betting: 0 },
      }
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return <ErrorBanner />

  const totalPages = Math.ceil((data?.total || 0) / 20)
  const stats = data?.stats || { total_customers: 0, converted: 0, already_betting: 0 }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <Users className="h-5 w-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_customers}</p>
          <p className="text-sm text-gray-500">Total Individual Interactions</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <TrendingUp className="h-5 w-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.converted}</p>
          <p className="text-sm text-gray-500">Converted</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <MapPin className="h-5 w-5 text-purple-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.already_betting}</p>
          <p className="text-sm text-gray-500">Store Visits</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Agent</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Shop</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Converted</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Store Visit</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Location</th>
              </tr>
            </thead>
            <tbody>
              {(data?.customers || []).length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">No individual data available</td></tr>
              ) : (data?.customers || []).map((c) => (
                <tr key={c.checkin_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 text-gray-900 dark:text-white text-xs">
                    {c.timestamp ? new Date(c.timestamp).toLocaleString() : '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{c.agent_name || 'Unknown'}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{c.shop_name || '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.converted ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>{c.converted ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.already_betting ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>{c.already_betting ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {c.latitude && c.longitude ? `${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Export Tab (was ReportsExport) ─────────────────────────────────────────

function ExportTab({ dateParams, companyParam, startDate, endDate, selectedCompany }: TabProps) {
  const [exporting, setExporting] = useState(false)

  const { data: agentPerf = [] } = useQuery({
    queryKey: ['export-agent-perf', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const parts = []
      if (startDate) parts.push(`startDate=${startDate}`)
      if (endDate) parts.push(`endDate=${endDate}`)
      if (selectedCompany) parts.push(`company_id=${selectedCompany}`)
      const qs = parts.length > 0 ? `?${parts.join('&')}` : ''
      const res = await apiClient.get(`/field-ops/reports/agent-performance${qs}`)
      return res.data?.data || []
    },
  })

  const { data: conversionStats } = useQuery({
    queryKey: ['export-conversions', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const parts = []
      if (startDate) parts.push(`startDate=${startDate}`)
      if (endDate) parts.push(`endDate=${endDate}`)
      if (selectedCompany) parts.push(`company_id=${selectedCompany}`)
      const qs = parts.length > 0 ? `?${parts.join('&')}` : ''
      const res = await apiClient.get(`/field-ops/reports/conversion-stats${qs}`)
      return res.data?.data || {}
    },
  })

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToCSV = async (type: 'checkins' | 'agents' | 'conversions') => {
    setExporting(true)
    try {
      if (type === 'checkins') {
        const res = await apiClient.get(`/field-ops/reports/export/checkins?dummy=1${dateParams}${companyParam}`)
        const data = res.data?.data || []
        if (data.length === 0) { toast.error('No data to export'); return }
        const headers = Object.keys(data[0])
        const csv = [headers.join(','), ...data.map((row: Record<string, unknown>) => headers.map(h => `"${String(row[h] ?? '')}"`).join(','))].join('\n')
        downloadCSV(csv, `checkins-export-${new Date().toISOString().slice(0, 10)}.csv`)
        toast.success(`Exported ${data.length} check-in records`)
      } else if (type === 'agents') {
        if (agentPerf.length === 0) { toast.error('No agent data to export'); return }
        const headers = ['agent_name', 'checkin_count', 'conversions', 'conversion_rate']
        const csv = [headers.join(','), ...agentPerf.map((a: Record<string, unknown>) => headers.map(h => `"${String(a[h] ?? '')}"`).join(','))].join('\n')
        downloadCSV(csv, `agent-performance-${new Date().toISOString().slice(0, 10)}.csv`)
        toast.success(`Exported ${agentPerf.length} agent records`)
      } else if (type === 'conversions') {
        const cs = conversionStats || {}
        const headers = ['metric', 'value']
        const rows = Object.entries(cs).map(([k, v]) => `"${k}","${v}"`)
        const csv = [headers.join(','), ...rows].join('\n')
        downloadCSV(csv, `conversion-stats-${new Date().toISOString().slice(0, 10)}.csv`)
        toast.success('Exported conversion stats')
      }
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Check-ins Data</h3>
              <p className="text-xs text-gray-500">All check-in records with location, status, and conversion data</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Includes visit date, agent, shop, GPS coordinates, status, conversion status, and visit type.
          </p>
          <button onClick={() => exportToCSV('checkins')} disabled={exporting}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
            <Download className="h-4 w-4" /> Export Check-ins CSV
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <BarChart3 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Agent Performance</h3>
              <p className="text-xs text-gray-500">Agent check-in counts, conversions, and rates</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Summarized per-agent metrics: total check-ins, total conversions, and conversion rate percentage.
          </p>
          <button onClick={() => exportToCSV('agents')} disabled={exporting}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium">
            <Download className="h-4 w-4" /> Export Agent CSV
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Conversion Stats</h3>
              <p className="text-xs text-gray-500">Overall conversion and betting metrics</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Summary of conversion rates: converted vs not converted, store visits vs non-store visits.
          </p>
          <button onClick={() => exportToCSV('conversions')} disabled={exporting}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
            <Download className="h-4 w-4" /> Export Conversion CSV
          </button>
        </div>
      </div>

      {/* Agent Performance Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agent Performance Preview</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Agent</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Check-ins</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Conversions</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {agentPerf.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">No data for selected period</td></tr>
              ) : agentPerf.slice(0, 10).map((a: Record<string, unknown>, i: number) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2 px-3 text-gray-900 dark:text-white">{String(a.agent_name || 'Unknown')}</td>
                  <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{String(a.checkin_count)}</td>
                  <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{String(a.conversions)}</td>
                  <td className="py-2 px-3 text-right font-medium text-emerald-600">{String(a.conversion_rate)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Shared Error Banner ────────────────────────────────────────────────────

function ErrorBanner() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Failed to load data</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">Please try refreshing the page</p>
    </div>
  )
}

export default FieldOpsComprehensiveReport
