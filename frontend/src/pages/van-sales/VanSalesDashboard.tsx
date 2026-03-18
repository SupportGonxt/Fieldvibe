import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Truck, 
  Route,
  MapPin,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Package,
  Users,
  Target,
  BarChart3,
  PieChart,
  Download,
  RefreshCw,
  Navigation,
  Fuel,
  Calendar,
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
import { vanSalesService } from '../../services/van-sales.service'
import { formatDate, formatNumber, formatCurrency } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

export default function VanSalesDashboard() {
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['van-sales-dashboard-stats', dateRange],
    queryFn: () => vanSalesService.getVanSalesStats(dateRange),
    staleTime: 1000 * 60 * 5,
  })

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError } = useQuery({
    queryKey: ['van-sales-analytics', dateRange],
    queryFn: () => vanSalesService.getVanSalesAnalytics(),
    staleTime: 1000 * 60 * 5,
  })

  const { data: trends, isLoading: trendsLoading, isError: trendsError } = useQuery({
    queryKey: ['van-sales-trends', dateRange],
    queryFn: () => vanSalesService.getVanSalesTrends(dateRange),
    staleTime: 1000 * 60 * 5,
  })

  const isLoading = statsLoading || analyticsLoading || trendsLoading
  const isError = statsError || analyticsError || trendsError

  const handleRefresh = () => {
    refetchStats()
  }

  const handleExportReport = () => {
    vanSalesService.exportVanSalesReport('pdf', { ...dateRange, report_type: 'dashboard' })
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
          <h1 className="text-2xl font-bold text-gray-900">Van Sales Dashboard</h1>
          <p className="text-gray-600">Monitor mobile sales operations and route performance</p>
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
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Vans</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatNumber(stats?.active_vans || 0)}
              </p>
              <div className="flex items-center text-sm">
                <span className="text-green-600">{stats?.vans_on_route || 0} on route</span>
                <span className="text-gray-500 ml-1">• {stats?.vans_idle || 0} idle</span>
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
              <p className="text-sm font-medium text-gray-500">Van Sales Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(stats?.total_revenue || 0)}
              </p>
              <div className="flex items-center text-sm">
                {stats?.revenue_growth >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={stats?.revenue_growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(stats?.revenue_growth || 0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-lg bg-purple-100">
                <Route className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Routes Completed</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatNumber(stats?.completed_routes || 0)}
              </p>
              <p className="text-sm text-gray-500">
                {stats?.route_efficiency || 0}% efficiency
              </p>
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
              <p className="text-sm font-medium text-gray-500">Avg. Sales per Van</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(stats?.avg_sales_per_van || 0)}
              </p>
              <p className="text-sm text-gray-500">
                {stats?.sales_trend > 0 ? '↗' : stats?.sales_trend < 0 ? '↘' : '→'} 
                {' '}{Math.abs(stats?.sales_trend || 0).toFixed(1)} vs last period
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Performance Trends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Van Sales Performance</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends?.daily_sales || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => formatDate(value, { format: 'short' })}
                />
                <YAxis tickFormatter={(value) => formatCurrency(value, 'ZAR', { compact: true })} />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value: any) => [formatCurrency(value), 'Sales']}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#10B981" 
                  fill="#10B981" 
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Route Distribution */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Route Distribution</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={analytics?.route_distribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {(analytics?.route_distribution || []).map((entry: any, index: number) => (
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
        {/* Top Performing Vans */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Vans</h3>
            <Truck className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.top_vans || []} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => formatCurrency(value, 'ZAR', { compact: true })} />
                <YAxis dataKey="van_code" type="category" width={80} />
                <Tooltip formatter={(value: any) => [formatCurrency(value), 'Sales']} />
                <Bar dataKey="sales" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Route Efficiency Trends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Route Efficiency</h3>
            <Navigation className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends?.route_efficiency || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => formatDate(value, { format: 'short' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value: any) => [`${value}%`, 'Efficiency']}
                />
                <Line 
                  type="monotone" 
                  dataKey="efficiency" 
                  stroke="#8B5CF6" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Van Status & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Van Status Overview */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Van Status Overview</h3>
            <Truck className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {(analytics?.van_status || []).slice(0, 6).map((van: any) => (
              <div key={van.van_id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    van.status === 'on_route' ? 'bg-green-500' :
                    van.status === 'loading' ? 'bg-yellow-500' :
                    van.status === 'maintenance' ? 'bg-red-500' :
                    'bg-surface-secondary0'
                  }`}></div>
                  <div>
                    <p className="font-medium text-gray-900">{van.van_code}</p>
                    <p className="text-sm text-gray-500">{van.driver_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{formatCurrency(van.daily_sales)}</p>
                  <p className="text-sm text-gray-500">{van.current_location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Van Activities */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {(analytics?.recent_activities || []).slice(0, 6).map((activity: any) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    activity.type === 'sale_completed' ? 'bg-green-500' :
                    activity.type === 'route_started' ? 'bg-blue-500' :
                    activity.type === 'delivery_completed' ? 'bg-purple-500' :
                    'bg-surface-secondary0'
                  }`}></div>
                  <div>
                    <p className="font-medium text-gray-900">{activity.van_code}</p>
                    <p className="text-sm text-gray-500">{activity.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{formatDate(activity.created_at)}</p>
                  {activity.value && (
                    <p className="text-sm font-medium text-green-600">{formatCurrency(activity.value)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Route Performance Analysis */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Route Performance Analysis</h3>
          <Route className="w-5 h-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(analytics?.route_performance || []).map((route: any) => (
            <div key={route.route_id} className="p-4 bg-surface-secondary rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{route.route_name}</h4>
                <span className="text-sm text-gray-500">{route.van_count} vans</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Daily Sales</span>
                  <span className="font-medium">{formatCurrency(route.daily_sales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Efficiency</span>
                  <span className="font-medium">{route.efficiency}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Stops</span>
                  <span className="font-medium">{formatNumber(route.total_stops)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${route.efficiency}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operational Metrics */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Operational Metrics</h3>
          <BarChart3 className="w-5 h-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-surface-secondary rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Fuel Efficiency</h4>
              <Fuel className="w-4 h-4 text-green-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Average</span>
                <span className="font-medium">{analytics?.metrics?.fuel_efficiency || 0} km/l</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Target</span>
                <span className="font-medium">{'>'} 12 km/l</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (analytics?.metrics?.fuel_efficiency || 0) >= 12 ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${Math.min((analytics?.metrics?.fuel_efficiency || 0) * 8.33, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-secondary rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">On-Time Delivery</h4>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current</span>
                <span className="font-medium">{analytics?.metrics?.on_time_delivery || 0}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Target</span>
                <span className="font-medium">{'>'} 90%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${analytics?.metrics?.on_time_delivery || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-secondary rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Customer Satisfaction</h4>
              <Users className="w-4 h-4 text-purple-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Rating</span>
                <span className="font-medium">{analytics?.metrics?.customer_satisfaction || 0}/5</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Target</span>
                <span className="font-medium">{'>'} 4.5/5</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full"
                  style={{ width: `${(analytics?.metrics?.customer_satisfaction || 0) * 20}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-secondary rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Load Utilization</h4>
              <Package className="w-4 h-4 text-orange-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Average</span>
                <span className="font-medium">{analytics?.metrics?.load_utilization || 0}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Target</span>
                <span className="font-medium">{'>'} 85%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-orange-500 h-2 rounded-full"
                  style={{ width: `${analytics?.metrics?.load_utilization || 0}%` }}
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