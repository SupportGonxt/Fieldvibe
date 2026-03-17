import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Gift, 
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  DollarSign,
  Target,
  Calendar,
  BarChart3,
  PieChart,
  Download,
  RefreshCw,
  Award,
  Percent,
  Activity
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
import { promotionsService } from '../../services/promotions.service'
import { formatDate, formatNumber, formatCurrency } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

export default function PromotionsDashboard() {
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['promotions-dashboard-stats', dateRange],
    queryFn: () => promotionsService.getPromotionStats(dateRange),
    staleTime: 1000 * 60 * 5,
  })

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError } = useQuery({
    queryKey: ['promotions-analytics', dateRange],
    queryFn: () => promotionsService.getPromotionAnalytics('all'),
    staleTime: 1000 * 60 * 5,
  })

  const { data: trends, isLoading: trendsLoading, isError: trendsError } = useQuery({
    queryKey: ['promotions-trends', dateRange],
    queryFn: () => promotionsService.getPromotionTrends(dateRange),
    staleTime: 1000 * 60 * 5,
  })

  const isLoading = statsLoading || analyticsLoading || trendsLoading
  const isError = statsError || analyticsError || trendsError

  const handleRefresh = () => {
    refetchStats()
  }

  const handleExportReport = () => {
    promotionsService.exportPromotionReport('pdf', { ...dateRange, report_type: 'dashboard' })
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
          <h1 className="text-2xl font-bold text-gray-900">Promotions Dashboard</h1>
          <p className="text-gray-600">Track promotion performance and customer engagement</p>
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
                <Gift className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Promotions</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatNumber(stats?.active_promotions || 0)}
              </p>
              <div className="flex items-center text-sm">
                {stats?.promotions_growth >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={stats?.promotions_growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(stats?.promotions_growth || 0)}%
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
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Promotion Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(stats?.promotion_revenue || 0)}
              </p>
              <p className="text-sm text-gray-500">
                {((stats?.promotion_revenue || 0) / (stats?.total_revenue || 1) * 100).toFixed(1)}% of total revenue
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-lg bg-purple-100">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Customers Engaged</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatNumber(stats?.customers_engaged || 0)}
              </p>
              <div className="flex items-center text-sm">
                {stats?.engagement_growth >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={stats?.engagement_growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(stats?.engagement_growth || 0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-lg bg-yellow-100">
                <Target className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg. Conversion Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.average_conversion_rate || 0}%
              </p>
              <p className="text-sm text-gray-500">
                {stats?.conversion_trend > 0 ? '↗' : stats?.conversion_trend < 0 ? '↘' : '→'} 
                {' '}{Math.abs(stats?.conversion_trend || 0).toFixed(1)} vs last period
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Promotion Performance Trends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Promotion Performance</h3>
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
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value: any, name: string) => [
                    name === 'revenue' ? formatCurrency(value) : formatNumber(value),
                    name === 'revenue' ? 'Revenue' : 'Conversions'
                  ]}
                />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3B82F6" 
                  fill="#3B82F6" 
                  fillOpacity={0.1}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="conversions" 
                  stroke="#10B981" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Promotion Types Distribution */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Promotion Types</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={analytics?.promotion_types_distribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {(analytics?.promotion_types_distribution || []).map((entry: any, index: number) => (
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
        {/* Top Performing Promotions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Promotions</h3>
            <Award className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.top_promotions || []} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip formatter={(value: any) => [formatCurrency(value), 'Revenue']} />
                <Bar dataKey="revenue" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversion Rate Trends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Conversion Rate Trends</h3>
            <Percent className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends?.conversion_rate_trends || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => formatDate(value, { format: 'short' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value: any) => [`${value}%`, 'Conversion Rate']}
                />
                <Line 
                  type="monotone" 
                  dataKey="conversion_rate" 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active Promotions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Promotions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active Promotions</h3>
            <Gift className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {(analytics?.active_promotions || []).slice(0, 5).map((promotion: any) => (
              <div key={promotion.id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{promotion.name}</p>
                  <p className="text-sm text-gray-500">{promotion.type} • {promotion.discount_value}% off</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{formatCurrency(promotion.revenue)}</p>
                  <p className="text-sm text-gray-500">{promotion.conversions} conversions</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Promotion Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {(analytics?.recent_activity || []).slice(0, 5).map((activity: any) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    activity.type === 'conversion' ? 'bg-green-500' : 
                    activity.type === 'view' ? 'bg-blue-500' : 'bg-surface-secondary0'
                  }`}></div>
                  <div>
                    <p className="font-medium text-gray-900">{activity.customer_name}</p>
                    <p className="text-sm text-gray-500">{activity.promotion_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${
                    activity.type === 'conversion' ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {activity.type === 'conversion' ? formatCurrency(activity.value) : activity.type}
                  </p>
                  <p className="text-sm text-gray-500">{formatDate(activity.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Promotion Categories Performance */}
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
                <span className="text-sm text-gray-500">{category.promotion_count} promotions</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Revenue</span>
                  <span className="font-medium">{formatCurrency(category.revenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Conversion Rate</span>
                  <span className="font-medium">{category.conversion_rate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Customers</span>
                  <span className="font-medium">{formatNumber(category.customers_engaged)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${Math.min(category.conversion_rate, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ROI Analysis */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">ROI Analysis</h3>
          <DollarSign className="w-5 h-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {analytics?.roi_analysis?.total_roi || 0}%
            </div>
            <div className="text-sm text-gray-500">Overall ROI</div>
            <div className="text-xs text-gray-400 mt-1">
              Revenue: {formatCurrency(analytics?.roi_analysis?.total_revenue || 0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {formatCurrency(analytics?.roi_analysis?.cost_per_conversion || 0)}
            </div>
            <div className="text-sm text-gray-500">Cost per Conversion</div>
            <div className="text-xs text-gray-400 mt-1">
              Total conversions: {formatNumber(analytics?.roi_analysis?.total_conversions || 0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {formatCurrency(analytics?.roi_analysis?.average_order_value || 0)}
            </div>
            <div className="text-sm text-gray-500">Avg. Order Value</div>
            <div className="text-xs text-gray-400 mt-1">
              From promoted orders
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