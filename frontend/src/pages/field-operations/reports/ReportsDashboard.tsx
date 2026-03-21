import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { BarChart3, Users, MapPin, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight , AlertTriangle } from 'lucide-react'

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

interface HourlyData {
  hour: number
  count: number
}

interface DailyData {
  day_name: string
  day_num: number
  count: number
}

interface ConversionStats {
  converted_yes: number
  converted_no: number
  betting_yes: number
  betting_no: number
}

const ReportsDashboard: React.FC = () => {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const dateParams = startDate || endDate ? `?${startDate ? `startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}` : ''

  const { data: kpis, isLoading: kpisLoading , isError: kpisError } = useQuery({
    queryKey: ['field-ops-kpis', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/kpis${dateParams}`)
      return (res.data?.kpis || {}) as KPIs
    },
  })

  const { data: agentPerf = [], isLoading: agentLoading } = useQuery({
    queryKey: ['field-ops-agent-perf', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/agent-performance${dateParams}`)
      return (res.data?.data || []) as AgentPerformance[]
    },
  })

  const { data: hourlyData = [] } = useQuery({
    queryKey: ['field-ops-hourly', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/checkins-by-hour${dateParams}`)
      return (res.data?.data || []) as HourlyData[]
    },
  })

  const { data: dailyData = [] } = useQuery({
    queryKey: ['field-ops-daily', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/checkins-by-day${dateParams}`)
      return (res.data?.data || []) as DailyData[]
    },
  })

  const { data: conversionStats } = useQuery({
    queryKey: ['field-ops-conversions', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/conversion-stats${dateParams}`)
      return (res.data?.data || {}) as ConversionStats
    },
  })

  if (kpisLoading) return <LoadingSpinner />
  if (kpisError) return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Failed to load data</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">Please try refreshing the page</p>
    </div>
  )


  const maxHourly = Math.max(...hourlyData.map(h => h.count), 1)
  const maxDaily = Math.max(...dailyData.map(d => d.count), 1)
  const convTotal = (conversionStats?.converted_yes || 0) + (conversionStats?.converted_no || 0)
  const convRate = convTotal > 0 ? ((conversionStats?.converted_yes || 0) / convTotal * 100).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Field operations analytics and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
        </div>
      </div>

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

export default ReportsDashboard
