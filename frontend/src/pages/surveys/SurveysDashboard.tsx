import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  FileText, 
  Users, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  PieChart,
  Download,
  RefreshCw,
  Target,
  Award,
  MessageSquare,
  Star
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
import { surveysService } from '../../services/surveys.service'
import { formatDate, formatNumber } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

export default function SurveysDashboard() {
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['surveys-dashboard-stats', dateRange],
    queryFn: () => surveysService.getSurveyStats(dateRange),
    staleTime: 1000 * 60 * 5,
  })

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError } = useQuery({
    queryKey: ['surveys-analytics', dateRange],
    queryFn: () => surveysService.getSurveyAnalytics('all'),
    staleTime: 1000 * 60 * 5,
  })

  const { data: trends, isLoading: trendsLoading, isError: trendsError } = useQuery({
    queryKey: ['surveys-trends', dateRange],
    queryFn: () => surveysService.getSurveyTrends(dateRange),
    staleTime: 1000 * 60 * 5,
  })

  const isLoading = statsLoading || analyticsLoading || trendsLoading
  const isError = statsError || analyticsError || trendsError

  const handleRefresh = () => {
    refetchStats()
  }

  const handleExportReport = () => {
    surveysService.exportSurveyReport('pdf')
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
          <h1 className="text-2xl font-bold text-gray-900">Surveys Dashboard</h1>
          <p className="text-gray-600">Customer feedback and survey response analytics</p>
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
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Surveys</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatNumber(stats?.total_surveys || 0)}
              </p>
              <div className="flex items-center text-sm">
                {stats?.surveys_growth >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={stats?.surveys_growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(stats?.surveys_growth || 0)}%
                </span>
                <span className="text-gray-500 ml-1">vs last period</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-lg bg-green-100">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Responses</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatNumber(stats?.total_responses || 0)}
              </p>
              <p className="text-sm text-gray-500">
                Avg. per survey: {((stats?.total_responses || 0) / (stats?.total_surveys || 1)).toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-lg bg-purple-100">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Response Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.response_rate || 0}%
              </p>
              <div className="flex items-center text-sm">
                {stats?.response_rate_change >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={stats?.response_rate_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(stats?.response_rate_change || 0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-lg bg-yellow-100">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg. Satisfaction</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.average_satisfaction || 0}/5
              </p>
              <p className="text-sm text-gray-500">
                {stats?.satisfaction_trend > 0 ? '↗' : stats?.satisfaction_trend < 0 ? '↘' : '→'} 
                {' '}{Math.abs(stats?.satisfaction_trend || 0).toFixed(1)} vs last period
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Trends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Response Trends</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends?.daily_responses || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => formatDate(value, 'MMM dd')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value: any) => [value, 'Responses']}
                />
                <Area 
                  type="monotone" 
                  dataKey="responses" 
                  stroke="#3B82F6" 
                  fill="#3B82F6" 
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Survey Types Distribution */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Survey Types</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={analytics?.survey_types_distribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {(analytics?.survey_types_distribution || []).map((entry: any, index: number) => (
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
        {/* Satisfaction Scores */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Satisfaction Scores</h3>
            <Star className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.satisfaction_distribution || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rating" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Response Rate Trends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Response Rate Trends</h3>
            <Target className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends?.response_rate_trends || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => formatDate(value, 'MMM dd')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value: any) => [`${value}%`, 'Response Rate']}
                />
                <Line 
                  type="monotone" 
                  dataKey="response_rate" 
                  stroke="#10B981" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity & Top Surveys */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Surveys */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Surveys</h3>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {(analytics?.recent_surveys || []).slice(0, 5).map((survey: any) => (
              <div key={survey.id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{survey.title}</p>
                  <p className="text-sm text-gray-500">by {survey.created_by_name}</p>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    survey.status === 'active' ? 'bg-green-100 text-green-800' :
                    survey.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                    survey.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {survey.status.toUpperCase()}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {survey.response_count} responses
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performing Surveys */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Surveys</h3>
            <Award className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {(analytics?.top_surveys || []).slice(0, 5).map((survey: any, index: number) => (
              <div key={survey.id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
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
                    <p className="font-medium text-gray-900">{survey.title}</p>
                    <p className="text-sm text-gray-500">{survey.response_count} responses</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{survey.response_rate}%</p>
                  <p className="text-sm text-gray-500">response rate</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Survey Categories Performance */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Category Performance</h3>
          <BarChart3 className="w-5 h-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(analytics?.category_performance || []).map((category: any) => (
            <div key={category.category} className="p-4 bg-surface-secondary rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{category.category}</h4>
                <span className="text-sm text-gray-500">{category.survey_count} surveys</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Avg. Response Rate</span>
                  <span className="font-medium">{category.avg_response_rate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Avg. Satisfaction</span>
                  <span className="font-medium">{category.avg_satisfaction}/5</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Responses</span>
                  <span className="font-medium">{formatNumber(category.total_responses)}</span>
                </div>
              </div>
            </div>
          ))}
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