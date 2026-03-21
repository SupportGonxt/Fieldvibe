import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { TrendingUp, Award, Activity, Target , AlertTriangle } from 'lucide-react'

interface AgentPerformance {
  agent_id: string
  agent_name: string
  checkin_count: number
  conversions: number
  conversion_rate: number
}

const ReportsInsights: React.FC = () => {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const dateParams = startDate || endDate ? `?${startDate ? `startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}` : ''

  const { data: agentPerf = [], isLoading } = useQuery({
    queryKey: ['field-ops-insights-agents', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/agent-performance${dateParams}`)
      return (res.data?.data || []) as AgentPerformance[]
    },
  })

  const { data: hourlyData = [] } = useQuery({
    queryKey: ['field-ops-insights-hourly', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/checkins-by-hour${dateParams}`)
      return (res.data?.data || []) as { hour: number; count: number }[]
    },
  })

  const { data: conversionStats } = useQuery({
    queryKey: ['field-ops-insights-conversions', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/conversion-stats${dateParams}`)
      return res.data?.data || {}
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Failed to load data</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">Please try refreshing the page</p>
    </div>
  )


  const topAgents = [...agentPerf].sort((a, b) => b.conversion_rate - a.conversion_rate).slice(0, 5)
  const mostActive = [...agentPerf].sort((a, b) => b.checkin_count - a.checkin_count).slice(0, 5)
  const peakHours = [...hourlyData].sort((a, b) => b.count - a.count).slice(0, 5)
  const totalCheckins = agentPerf.reduce((sum, a) => sum + a.checkin_count, 0)
  const totalConversions = agentPerf.reduce((sum, a) => sum + a.conversions, 0)
  const avgConvRate = totalCheckins > 0 ? ((totalConversions / totalCheckins) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deep Insights</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Performance highlights, activity patterns, and conversion metrics</p>
        </div>
        <div className="flex gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
        </div>
      </div>

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

export default ReportsInsights
