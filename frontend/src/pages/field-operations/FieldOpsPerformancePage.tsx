import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import {
  Users,
  Target,
  TrendingUp,
  Award,
  ChevronRight,
  Calendar,
  BarChart3,
  UserCheck,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  FileSpreadsheet
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { useNavigate } from 'react-router-dom'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

type TimePeriod = 'day' | 'week' | 'month' | 'custom'

export default function FieldOpsPerformancePage() {
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month')
  const [dateRange, setDateRange] = useState({
    start_date: today,
    end_date: today
  })

  const { data: performance, isLoading, error } = useQuery({
    queryKey: ['field-ops-performance', timePeriod, dateRange],
    queryFn: async () => {
      const params = { 
        period: timePeriod === 'custom' ? undefined : timePeriod,
        start_date: timePeriod === 'custom' ? dateRange.start_date : undefined,
        end_date: timePeriod === 'custom' ? dateRange.end_date : undefined
      }
      console.log('[PERF-FRONTEND] Fetching with params:', params)
      const result = await fieldOperationsService.getPerformance(params)
      console.log('[PERF-FRONTEND] Received data:', result)
      return result
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (timePeriod !== 'custom') {
        params.append('period', timePeriod)
      } else {
        params.append('start_date', dateRange.start_date)
        params.append('end_date', dateRange.end_date)
      }
      
      const response = await fieldOperationsService.get(`/field-ops/performance/export?${params.toString()}`)
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const periodLabel = timePeriod === 'day' ? 'Day' : timePeriod === 'week' ? 'Week' : timePeriod === 'month' ? 'Month' : 'Custom'
      a.download = `field-ops-performance-${periodLabel}-${today}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Failed to export report. Please try again.')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load performance data. Please try again later.
        </div>
      </div>
    )
  }

  const role = performance?.role || 'agent'

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {role === 'agent' ? 'Your daily performance' : role === 'team_lead' ? 'Team performance overview' : 'Organization performance overview'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Period Selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setTimePeriod('day')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                timePeriod === 'day' 
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setTimePeriod('week')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                timePeriod === 'week' 
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Week to Date
            </button>
            <button
              onClick={() => setTimePeriod('month')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                timePeriod === 'month' 
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Month to Date
            </button>
            <button
              onClick={() => setTimePeriod('custom')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                timePeriod === 'custom' 
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Date Range Picker (only for custom) */}
          {timePeriod === 'custom' && (
            <>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={dateRange.start_date}
                  onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                  className="input text-sm"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={dateRange.end_date}
                  onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                  className="input text-sm"
                />
              </div>
            </>
          )}

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="btn-primary flex items-center gap-2"
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Agent View */}
      {role === 'agent' && (
        <>
          {/* Progress Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ProgressCard
              title="Visits"
              current={performance?.visits || 0}
              target={performance?.targets?.visits || 20}
              icon={<Target className="w-6 h-6 text-blue-600" />}
              color="blue"
            />
            <ProgressCard
              title="Individuals"
              current={performance?.individuals || performance?.individual_visits || 0}
              target={performance?.targets?.individuals || 10}
              icon={<UserCheck className="w-6 h-6 text-green-600" />}
              color="green"
            />
            <ProgressCard
              title="Conversions"
              current={performance?.conversions || 0}
              target={performance?.targets?.conversions || 5}
              icon={<Award className="w-6 h-6 text-purple-600" />}
              color="purple"
            />
          </div>

          {/* Conversion Rate */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conversion Rate</h3>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {performance?.conversion_rate || 0}%
              </div>
              <div className="text-sm text-gray-500">
                {performance?.conversions || 0} out of {performance?.individuals || performance?.individual_visits || 0} individuals converted
              </div>
            </div>
          </div>
        </>
      )}

      {/* Team Lead View */}
      {role === 'team_lead' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard title="Team Size" value={performance?.team_size || 0} icon={<Users className="w-6 h-6 text-blue-600" />} />
            <MetricCard title="Total Visits" value={performance?.total_visits || 0} icon={<Target className="w-6 h-6 text-green-600" />} />
            <MetricCard title="Individuals" value={performance?.total_individuals || 0} icon={<UserCheck className="w-6 h-6 text-purple-600" />} />
            <MetricCard title="Conversion Rate" value={`${performance?.conversion_rate || 0}%`} icon={<TrendingUp className="w-6 h-6 text-yellow-600" />} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetricCard title="Individual Visits" value={performance?.total_individual_visits || 0} icon={<UserCheck className="w-5 h-5 text-indigo-600" />} />
            <MetricCard title="Store Visits" value={performance?.total_store_visits || 0} icon={<Target className="w-5 h-5 text-orange-600" />} />
          </div>

          {/* Agent Breakdown */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agent Performance</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Visits</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Individual</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Store</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conversions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(performance?.agents || []).map((agent: any) => (
                    <tr key={agent.agent_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{agent.agent_name}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{agent.visits}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{agent.individual_visits || 0}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{agent.store_visits || 0}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{agent.conversions}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/field-operations/drill-down/${agent.agent_id}`)}
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 justify-end"
                        >
                          Details <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(performance?.agents || []).length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No agent data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart */}
          {(performance?.agents || []).length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Visits by Agent</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performance?.agents || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="agent_name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="visits" fill="#3B82F6" name="Visits" />
                    <Bar dataKey="conversions" fill="#10B981" name="Conversions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* Manager View */}
      {(role === 'manager' || role === 'admin') && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard title="Team Leads" value={performance?.total_team_leads || 0} icon={<Users className="w-6 h-6 text-blue-600" />} />
            <MetricCard title="Total Agents" value={performance?.total_agents || 0} icon={<UserCheck className="w-6 h-6 text-green-600" />} />
            <MetricCard title="Total Visits" value={performance?.total_visits || 0} icon={<Target className="w-6 h-6 text-purple-600" />} />
            <MetricCard title="Conversion Rate" value={`${performance?.conversion_rate || 0}%`} icon={<TrendingUp className="w-6 h-6 text-yellow-600" />} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard title="Individual Visits" value={performance?.total_individual_visits || 0} icon={<UserCheck className="w-5 h-5 text-indigo-600" />} />
            <MetricCard title="Store Visits" value={performance?.total_store_visits || 0} icon={<Target className="w-5 h-5 text-orange-600" />} />
            <MetricCard title="Total Individuals" value={performance?.total_individuals || 0} icon={<BarChart3 className="w-5 h-5 text-indigo-600" />} />
            <MetricCard title="Total Conversions" value={performance?.total_conversions || 0} icon={<Award className="w-5 h-5 text-emerald-600" />} />
          </div>

          {/* Team Breakdown */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Team Performance</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team Lead</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Agents</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Visits</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Individual</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Store</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conversions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conv. Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(performance?.teams || []).map((team: any) => (
                    <tr key={team.team_lead_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{team.team_lead_name}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{team.agent_count}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{team.visits}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{team.individual_visits || 0}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{team.store_visits || 0}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{team.conversions}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${team.conversion_rate >= 50 ? 'bg-green-100 text-green-800' : team.conversion_rate >= 25 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {team.conversion_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/field-operations/drill-down/${team.team_lead_id}`)}
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 justify-end"
                        >
                          Drill Down <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(performance?.teams || []).length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No team data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart */}
          {(performance?.teams || []).length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Team Comparison</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performance?.teams || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="team_lead_name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="visits" fill="#3B82F6" name="Visits" />
                    <Bar dataKey="individuals" fill="#F59E0B" name="Individuals" />
                    <Bar dataKey="conversions" fill="#10B981" name="Conversions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ProgressCard({ title, current, target, icon, color }: { title: string; current: number; target: number; icon: React.ReactNode; color: string }) {
  const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30',
    green: 'bg-green-100 dark:bg-green-900/30',
    purple: 'bg-purple-100 dark:bg-purple-900/30',
  }
  const barColorMap: Record<string, string> = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    purple: 'bg-purple-600',
  }
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorMap[color] || 'bg-gray-100'}`}>{icon}</div>
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{current}/{target}</span>
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{title}</p>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
        <div className={`${barColorMap[color] || 'bg-blue-600'} h-3 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1">{pct}% of target</p>
    </div>
  )
}

function MetricCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">{icon}</div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  )
}
