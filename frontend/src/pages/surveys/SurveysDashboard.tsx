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
  Eye,
  X
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
import toast from 'react-hot-toast'
import { surveysService } from '../../services/surveys.service'
import { brandService } from '../../services/brand.service'
import { exportSectionsToExcel } from '../../utils/export'
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
  const [brandId, setBrandId] = useState('')
  const [selectedResponse, setSelectedResponse] = useState<any | null>(null)

  const filters = { ...dateRange, ...(brandId ? { brand_id: brandId } : {}) }

  const { data: brands } = useQuery({
    queryKey: ['brands-list'],
    queryFn: () => brandService.getBrands({ status: 'active' }),
    staleTime: 1000 * 60 * 10,
  })

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['surveys-dashboard-stats', filters],
    queryFn: () => surveysService.getSurveyStats(filters),
    staleTime: 1000 * 60 * 5,
  })

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError } = useQuery({
    queryKey: ['surveys-analytics', filters],
    queryFn: () => surveysService.getSurveyAnalytics('all', filters),
    staleTime: 1000 * 60 * 5,
  })

  const { data: trends, isLoading: trendsLoading, isError: trendsError } = useQuery({
    queryKey: ['surveys-trends', filters],
    queryFn: () => surveysService.getSurveyTrends(filters),
    staleTime: 1000 * 60 * 5,
  })

  const { data: responsesList } = useQuery({
    queryKey: ['surveys-responses-list', filters],
    queryFn: () => surveysService.getSurveyResponsesList(filters),
    staleTime: 1000 * 60 * 5,
  })

  const isLoading = statsLoading || analyticsLoading || trendsLoading
  const isError = statsError || analyticsError || trendsError

  const handleRefresh = () => {
    refetchStats()
  }

  const handleExportReport = () => {
    const selectedBrand = brandId ? (brands || []).find((b) => b.id === brandId) : null
    const brandLabel = selectedBrand ? selectedBrand.name : 'All Brands'

    const sections = [
      {
        title: 'Summary',
        columns: [
          { key: 'metric', label: 'Metric' },
          { key: 'value', label: 'Value' },
        ],
        data: [
          { metric: 'Total Surveys', value: stats?.total_surveys ?? 0 },
          { metric: 'Active Surveys', value: stats?.active_surveys ?? 0 },
          { metric: 'Total Responses', value: stats?.total_responses ?? 0 },
          { metric: 'Response Rate', value: `${stats?.response_rate ?? 0}%` },
        ],
      },
      {
        title: 'Surveys',
        columns: [
          { key: 'title', label: 'Survey' },
          { key: 'type', label: 'Type' },
          { key: 'status', label: 'Status' },
          { key: 'response_count', label: 'Responses' },
          { key: 'response_rate', label: 'Response Rate (%)' },
        ],
        data: (analytics?.recent_surveys || []).map((s: any) => ({
          title: s.title,
          type: s.type,
          status: s.status,
          response_count: s.response_count ?? 0,
          response_rate: s.response_rate ?? '',
        })),
      },
      {
        title: 'Responses by Agent',
        columns: [
          { key: 'agent', label: 'Agent' },
          { key: 'responses', label: 'Responses' },
        ],
        data: analytics?.responses_by_agent || [],
      },
      {
        title: 'Category Performance',
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'survey_count', label: 'Surveys' },
          { key: 'total_responses', label: 'Total Responses' },
          { key: 'avg_response_rate', label: 'Avg Response Rate (%)' },
        ],
        data: analytics?.category_performance || [],
      },
      {
        title: 'Daily Responses',
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'responses', label: 'Responses' },
        ],
        data: trends?.daily_responses || [],
      },
    ]

    const hasData = sections.some((s) => s.data.length > 0)
    if (!hasData) {
      toast.error('No survey data to export for the selected filters')
      return
    }

    const safeBrand = brandLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    exportSectionsToExcel(
      sections,
      `survey-report-${safeBrand}-${dateRange.start_date}-to-${dateRange.end_date}`,
      'Survey Report',
      [
        ['Brand', brandLabel],
        ['Period', `${dateRange.start_date} to ${dateRange.end_date}`],
      ]
    )
    toast.success('Survey report exported')
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
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="input text-sm"
          >
            <option value="">All Brands</option>
            {(brands || []).map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        {/* Responses by Agent */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Responses by Agent</h3>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            {(analytics?.responses_by_agent || []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.responses_by_agent || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="agent" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: any) => [value, 'Responses']} />
                  <Bar dataKey="responses" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No survey responses in this period
              </div>
            )}
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
                  <p className="text-sm text-gray-500 capitalize">{survey.type} survey</p>
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
                  <span className="text-gray-600">Response Rate</span>
                  <span className="font-medium">{category.avg_response_rate}%</span>
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

      {/* Survey Responses */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Survey Responses</h3>
          <MessageSquare className="w-5 h-5 text-gray-400" />
        </div>
        {(responsesList || []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(responsesList || []).map((response: any) => (
                  <tr key={response.id} className="hover:bg-surface-secondary">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{response.brand_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{response.agent_name}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedResponse(response)}
                        className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
            No survey responses in this period
          </div>
        )}
      </div>

      {/* Survey Response Detail Modal */}
      {selectedResponse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedResponse(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedResponse.questionnaire_name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedResponse.brand_name} · {selectedResponse.agent_name}
                  {selectedResponse.created_at ? ` · ${formatDate(selectedResponse.created_at)}` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedResponse(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              {(selectedResponse.answers || []).length > 0 ? (
                (selectedResponse.answers || []).map((qa: any, index: number) => (
                  <div key={index} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-gray-900">{qa.question_label}</p>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                      {qa.answer && qa.answer.trim() ? qa.answer : <span className="text-gray-400 italic">No answer</span>}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No questions or answers recorded for this response.</p>
              )}
            </div>
          </div>
        </div>
      )}

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