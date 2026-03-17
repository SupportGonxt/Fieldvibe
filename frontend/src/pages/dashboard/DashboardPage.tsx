import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Users, 
  MapPin, 
  Package, 
  DollarSign, 
  TrendingUp, 
  Activity,
  Clock,
  CheckCircle,
  ShoppingCart,
  FileText,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Target
} from 'lucide-react'
import {
  LineChart,
  AreaChart,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  Bar,
  Line
} from 'recharts'
import { useAuthStore } from '../../store/auth.store'
import { analyticsService } from '../../services/analytics.service'
import { formatCurrency, formatNumber, formatDate } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import ExportMenu from '../../components/export/ExportMenu'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })

  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-overview', dateRange],
    queryFn: () => analyticsService.getDashboardOverview(dateRange),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const { data: salesData } = useQuery({
    queryKey: ['sales-analytics', dateRange],
    queryFn: () => analyticsService.getSalesAnalytics(dateRange),
    staleTime: 1000 * 60 * 5,
  })

  const { data: recentActivity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => analyticsService.getRecentActivity({ limit: 10 }),
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  const handleRefresh = () => {
    refetch()
  }

  const StatCard = ({ title, value, icon: Icon, change, color = 'blue', subtitle }: any) => {
    const gradientClasses: Record<string, string> = {
      blue: 'bg-gradient-to-br from-[#36A2EB] to-[#4FC3F7]',
      green: 'bg-gradient-to-br from-[#2ECC71] to-[#27AE60]',
      purple: 'bg-gradient-to-br from-[#9B59B6] to-[#8E44AD]',
      yellow: 'bg-gradient-to-br from-[#F39C12] to-[#E67E22]',
      red: 'bg-gradient-to-br from-[#E74C3C] to-[#C0392B]',
    }
    
    return (
      <div className={`rounded-2xl p-6 text-white shadow-stat relative overflow-hidden ${gradientClasses[color] || gradientClasses.blue}`}>
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">{title}</p>
              <p className="text-3xl font-bold mt-2">{value}</p>
              {change !== undefined && (
                <div className="flex items-center text-sm mt-2">
                  {change >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-white/90 mr-1" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-white/90 mr-1 rotate-180" />
                  )}
                  <span className="text-white/90">
                    {change >= 0 ? '+' : ''}{change}%
                  </span>
                  <span className="text-white/60 ml-1">vs last period</span>
                </div>
              )}
              {subtitle && (
                <p className="text-sm text-white/70 mt-1">{subtitle}</p>
              )}
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load dashboard</h3>
          <p className="text-gray-600 mb-4">There was an error loading your dashboard data.</p>
          <button onClick={handleRefresh} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const stats = dashboardData?.stats || {}
  const trends = dashboardData?.trends || {}

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.first_name}!
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Here's what's happening with your sales operations today.
          </p>
        </div>
        <div className="flex space-x-3">
          <div className="flex space-x-2">
            <label htmlFor="dashboard-start-date" className="sr-only">Start Date</label>
            <input
              id="dashboard-start-date"
              name="start_date"
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
              className="input text-sm"
              aria-label="Start date for dashboard data range"
            />
            <label htmlFor="dashboard-end-date" className="sr-only">End Date</label>
            <input
              id="dashboard-end-date"
              name="end_date"
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
              className="input text-sm"
              aria-label="End date for dashboard data range"
            />
          </div>
          <button
            onClick={handleRefresh}
            className="btn-outline flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <ExportMenu
            data={[
              { metric: 'Total Revenue', value: stats.total_revenue || 0, change: stats.revenue_growth },
              { metric: 'Active Customers', value: stats.active_customers || 0, change: stats.customer_growth },
              { metric: 'Field Agents', value: stats.total_agents || 0, change: stats.agent_growth },
              { metric: 'Products Sold', value: stats.products_sold || 0, change: stats.products_growth },
              { metric: 'Total Orders', value: stats.total_orders || 0 },
              { metric: 'New Customers', value: stats.new_customers || 0 },
            ]}
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'value', label: 'Value' },
              { key: 'change', label: 'Change %' },
            ]}
            filename="dashboard-overview"
            title="Dashboard Overview"
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.total_revenue || 0)}
          icon={DollarSign}
          change={stats.revenue_growth}
          color="green"
          subtitle={`${formatNumber(stats.total_orders || 0)} orders`}
        />
        <StatCard
          title="Active Customers"
          value={formatNumber(stats.active_customers || 0)}
          icon={Users}
          change={stats.customer_growth}
          color="blue"
          subtitle={`${formatNumber(stats.new_customers || 0)} new this period`}
        />
        <StatCard
          title="Field Agents"
          value={formatNumber(stats.total_agents || 0)}
          icon={MapPin}
          change={stats.agent_growth}
          color="purple"
          subtitle={`${formatNumber(stats.active_agents || 0)} active today`}
        />
        <StatCard
          title="Products Sold"
          value={formatNumber(stats.products_sold || 0)}
          icon={Package}
          change={stats.products_growth}
          color="yellow"
          subtitle={`${formatNumber(stats.unique_products || 0)} unique products`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Trends</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends.daily_revenue || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => formatDate(value, { format: 'short' })}
                />
                <YAxis width={80} tickFormatter={(value) => formatCurrency(value, { compact: true })} />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10B981" 
                  fill="#10B981" 
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales Performance */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Sales Performance</h3>
            <Target className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends.daily_orders || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => formatDate(value, { format: 'short' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value: any) => [formatNumber(value), 'Orders']}
                />
                <Bar dataKey="orders" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity and Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {(recentActivity?.activities || []).slice(0, 8).map((activity: any) => (
              <div key={activity.id} className="flex items-center space-x-3 p-3 bg-surface-secondary rounded-lg">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'order' ? 'bg-green-500' :
                  activity.type === 'visit' ? 'bg-blue-500' :
                  activity.type === 'customer' ? 'bg-purple-500' :
                  'bg-surface-secondary0'
                }`}></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {activity.description}
                  </p>
                  <p className="text-sm text-gray-500">
                    {activity.agent_name} • {formatDate(activity.created_at)}
                  </p>
                </div>
                {activity.value && (
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(activity.value)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Top Performers */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Agents</h3>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {(dashboardData?.top_performers || []).slice(0, 5).map((performer: any, index: number) => (
              <div key={performer.agent_id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                    index === 1 ? 'bg-gray-100 text-gray-800' :
                    index === 2 ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{performer.agent_name}</p>
                    <p className="text-sm text-gray-500">{performer.total_orders} orders</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{formatCurrency(performer.total_revenue)}</p>
                  <p className="text-sm text-gray-500">{performer.success_rate}% success rate</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => window.open('/orders/create', '_blank')}
            className="flex items-center p-4 border border-gray-100 rounded-lg hover:bg-surface-secondary transition-colors"
          >
            <ShoppingCart className="w-8 h-8 text-blue-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-gray-900">New Order</p>
              <p className="text-sm text-gray-500">Create a new customer order</p>
            </div>
          </button>
          
          <button
            onClick={() => window.open('/customers/create', '_blank')}
            className="flex items-center p-4 border border-gray-100 rounded-lg hover:bg-surface-secondary transition-colors"
          >
            <Users className="w-8 h-8 text-green-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-gray-900">Add Customer</p>
              <p className="text-sm text-gray-500">Register a new customer</p>
            </div>
          </button>
          
          <button
            onClick={() => window.open('/visits/create', '_blank')}
            className="flex items-center p-4 border border-gray-100 rounded-lg hover:bg-surface-secondary transition-colors"
          >
            <MapPin className="w-8 h-8 text-purple-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-gray-900">Schedule Visit</p>
              <p className="text-sm text-gray-500">Plan a customer visit</p>
            </div>
          </button>
          
          <button
            onClick={() => window.open('/reports', '_blank')}
            className="flex items-center p-4 border border-gray-100 rounded-lg hover:bg-surface-secondary transition-colors"
          >
            <FileText className="w-8 h-8 text-yellow-600 mr-3" />
            <div className="text-left">
              <p className="font-medium text-gray-900">View Reports</p>
              <p className="text-sm text-gray-500">Access detailed analytics</p>
            </div>
          </button>
        </div>
      </div>

      {/* Alerts and Notifications */}
      {dashboardData?.alerts && dashboardData.alerts.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">System Alerts</h3>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="space-y-3">
            {(dashboardData?.alerts || []).map((alert: any, index: number) => (
              <div key={index} className={`flex items-start p-4 rounded-lg border ${
                alert.priority === 'high' ? 'bg-red-50 border-red-200' :
                alert.priority === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <AlertTriangle className={`w-5 h-5 mt-0.5 mr-3 ${
                  alert.priority === 'high' ? 'text-red-500' :
                  alert.priority === 'medium' ? 'text-yellow-500' :
                  'text-blue-500'
                }`} />
                <div>
                  <p className={`font-medium ${
                    alert.priority === 'high' ? 'text-red-900' :
                    alert.priority === 'medium' ? 'text-yellow-900' :
                    'text-blue-900'
                  }`}>
                    {alert.title}
                  </p>
                  <p className={`text-sm mt-1 ${
                    alert.priority === 'high' ? 'text-red-700' :
                    alert.priority === 'medium' ? 'text-yellow-700' :
                    'text-blue-700'
                  }`}>
                    {alert.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {formatDate(alert.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
