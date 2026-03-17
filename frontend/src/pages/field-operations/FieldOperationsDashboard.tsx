import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Users, 
  MapPin, 
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  PieChart,
  Download,
  RefreshCw,
  Route,
  Calendar,
  Award,
  Activity,
  Navigation
} from 'lucide-react'
import {
  LineChart,
  AreaChart,
  BarChart,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  Bar,
  Line,
  Cell,
  Pie
} from 'recharts'
import { fieldOperationsService } from '../../services/field-operations.service'
import { formatDate, formatNumber, formatCurrency } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

export default function FieldOperationsDashboard() {
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['field-operations-dashboard-stats', dateRange],
    queryFn: () => fieldOperationsService.getFieldOperationsStats(dateRange),
    staleTime: 1000 * 60 * 5,
  })

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError } = useQuery({
    queryKey: ['field-operations-analytics', dateRange],
    queryFn: () => fieldOperationsService.getFieldOperationsAnalytics(dateRange),
    staleTime: 1000 * 60 * 5,
  })

  const { data: trends, isLoading: trendsLoading, isError: trendsError } = useQuery({
    queryKey: ['field-operations-trends', dateRange],
    queryFn: () => fieldOperationsService.getFieldOperationsTrends(dateRange),
    staleTime: 1000 * 60 * 5,
  })

  const isLoading = statsLoading || analyticsLoading || trendsLoading
  const isError = statsError || analyticsError || trendsError

  const handleRefresh = () => {
    refetchStats()
  }

  const handleExportReport = () => {
    fieldOperationsService.exportFieldOperationsReport('pdf', { ...dateRange, report_type: 'dashboard' })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 text-lg font-medium">Failed to load data</p>
          <p className="text-gray-500 mt-2">Please try refreshing the page</p>
        </div>
      </div>
    )
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Field Operations Dashboard</h1>
          <p className="text-gray-600">Monitor field agent performance and territory management</p>
        </div>
        <div className="flex space-x-3">
          <div className="flex space-x-2">
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
              className="input text-sm"
            />
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
              className="input text-sm"
            />
          </div>
          <button
            onClick={handleRefresh}
            className="btn-outline flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportReport}
            className="btn-primary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-lg bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Agents</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatNumber(stats?.total_agents || 0)}
              </p>
              <div className="flex items-center text-sm">
                <span className="text-green-600">{stats?.active_agents || 0} active</span>
                <span className="text-gray-500 ml-1">• {stats?.inactive_agents || 0} inactive</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-lg bg-green-100">
                <Target className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Tasks Completed</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatNumber(stats?.completed_tasks || 0)}
              </p>
              <div className="flex items-center text-sm">
                {stats?.task_completion_growth >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={stats?.task_completion_growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(stats?.task_completion_growth || 0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-lg bg-purple-100">
                <MapPin className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Territories Covered</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatNumber(stats?.territories_covered || 0)}
              </p>
              <p className="text-sm text-gray-500">
                {stats?.coverage_percentage || 0}% coverage
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-lg bg-yellow-100">
                <Award className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg. Performance</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.average_performance_score || 0}%
              </p>
              <p className="text-sm text-gray-500">
                {stats?.performance_trend > 0 ? '↗' : stats?.performance_trend < 0 ? '↘' : '→'} 
                {' '}{Math.abs(stats?.performance_trend || 0).toFixed(1)} vs last period
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Performance Trends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Agent Performance Trends</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends?.daily_performance || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => formatDate(value, { format: 'short' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value: any) => [`${value}%`, 'Performance Score']}
                />
                <Area 
                  type="monotone" 
                  dataKey="performance_score" 
                  stroke="#3B82F6" 
                  fill="#3B82F6" 
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Status Distribution */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Task Status Distribution</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={analytics?.task_status_distribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {(analytics?.task_status_distribution || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Territory Performance */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Territory Performance</h3>
            <MapPin className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.territory_performance || []} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="territory_name" type="category" width={100} />
                <Tooltip formatter={(value: any) => [`${value}%`, 'Performance Score']} />
                <Bar dataKey="performance_score" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent Activity Levels */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Agent Activity Levels</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends?.agent_activity || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => formatDate(value, { format: 'short' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value: any) => [value, 'Active Agents']}
                />
                <Line 
                  type="monotone" 
                  dataKey="active_agents" 
                  stroke="#8B5CF6" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Agent Performance & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Agents */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Agents</h3>
            <Award className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {(analytics?.top_agents || []).slice(0, 5).map((agent: any, index: number) => (
              <div key={agent.agent_id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                    index === 1 ? 'bg-gray-100 text-gray-800' :
                    index === 2 ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-gray-900">{agent.agent_name}</p>
                    <p className="text-sm text-gray-500">{agent.territory_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{agent.performance_score}%</p>
                  <p className="text-sm text-gray-500">{agent.completed_tasks} tasks</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Field Activities */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {(analytics?.recent_activities || []).slice(0, 5).map((activity: any) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    activity.type === 'task_completed' ? 'bg-green-500' :
                    activity.type === 'visit_completed' ? 'bg-blue-500' :
                    activity.type === 'territory_assigned' ? 'bg-purple-500' :
                    'bg-surface-secondary0'
                  }`}></div>
                  <div>
                    <p className="font-medium text-gray-900">{activity.agent_name}</p>
                    <p className="text-sm text-gray-500">{activity.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{formatDate(activity.created_at)}</p>
                  {activity.location && (
                    <p className="text-xs text-gray-400">{activity.location}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Territory Coverage Map */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Territory Coverage</h3>
          <Navigation className="w-5 h-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(analytics?.territory_coverage || []).map((territory: any) => (
            <div key={territory.territory_id} className="p-4 bg-surface-secondary rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{territory.territory_name}</h4>
                <span className="text-sm text-gray-500">{territory.agent_count} agents</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Coverage</span>
                  <span className="font-medium">{territory.coverage_percentage}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Performance</span>
                  <span className="font-medium">{territory.performance_score}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tasks</span>
                  <span className="font-medium">{formatNumber(territory.total_tasks)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${territory.coverage_percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Performance Metrics</h3>
          <BarChart3 className="w-5 h-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-surface-secondary rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Task Completion Rate</h4>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current Period</span>
                <span className="font-medium">{analytics?.metrics?.task_completion_rate || 0}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Target</span>
                <span className="font-medium">{'>'} 85%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (analytics?.metrics?.task_completion_rate || 0) >= 85 ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${analytics?.metrics?.task_completion_rate || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-secondary rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Response Time</h4>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Average</span>
                <span className="font-medium">{analytics?.metrics?.avg_response_time || 0}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Target</span>
                <span className="font-medium">{'<'} 4h</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (analytics?.metrics?.avg_response_time || 0) <= 4 ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((analytics?.metrics?.avg_response_time || 0) * 25, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-secondary rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Territory Efficiency</h4>
              <Route className="w-4 h-4 text-purple-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current</span>
                <span className="font-medium">{analytics?.metrics?.territory_efficiency || 0}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Target</span>
                <span className="font-medium">{'>'} 75%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full"
                  style={{ width: `${analytics?.metrics?.territory_efficiency || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-secondary rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Agent Utilization</h4>
              <Users className="w-4 h-4 text-orange-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current</span>
                <span className="font-medium">{analytics?.metrics?.agent_utilization || 0}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Target</span>
                <span className="font-medium">{'>'} 80%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-orange-500 h-2 rounded-full"
                  style={{ width: `${analytics?.metrics?.agent_utilization || 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Insights & Recommendations */}
      {analytics?.insights && analytics.insights.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Insights & Recommendations</h3>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <div className="space-y-3">
            {(analytics?.insights || []).map((insight: any, index: number) => (
              <div key={index} className="flex items-start p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-500 mt-0.5 mr-3" />
                <div>
                  <p className="font-medium text-blue-900">{insight.title}</p>
                  <p className="text-sm text-blue-700 mt-1">{insight.description}</p>
                  {insight.recommendation && (
                    <p className="text-sm text-blue-600 mt-2 font-medium">
                      💡 {insight.recommendation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}