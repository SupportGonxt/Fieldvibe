import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  Package,
  DollarSign,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  Target,
  Award,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import {
  LineChart as RechartsLineChart,
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
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { analyticsService } from '../../services/analytics.service'
import { dashboardService } from '../../services/dashboard.service'

interface AnalyticsData {
  overview: {
    total_revenue: number
    revenue_growth: number
    total_orders: number
    orders_growth: number
    total_customers: number
    customers_growth: number
    total_products: number
    products_growth: number
    avg_order_value: number
    aov_growth: number
    conversion_rate: number
    conversion_growth: number
  }
  revenue_trend: Array<{
    date: string
    revenue: number
    orders: number
    customers: number
  }>
  sales_by_category: Array<{
    category: string
    revenue: number
    orders: number
    percentage: number
  }>
  top_products: Array<{
    id: string
    name: string
    revenue: number
    quantity_sold: number
    growth: number
  }>
  customer_segments: Array<{
    segment: string
    count: number
    revenue: number
    percentage: number
  }>
  field_agent_performance: Array<{
    agent_id: string
    agent_name: string
    total_sales: number
    orders_count: number
    customers_visited: number
    conversion_rate: number
    commission_earned: number
  }>
  geographic_data: Array<{
    region: string
    revenue: number
    orders: number
    customers: number
    growth: number
  }>
  time_analysis: {
    peak_hours: Array<{
      hour: number
      orders: number
      revenue: number
    }>
    peak_days: Array<{
      day: string
      orders: number
      revenue: number
    }>
  }
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316']

const fallbackAnalyticsData: AnalyticsData = {
  overview: { total_revenue: 0, revenue_growth: 0, total_orders: 0, orders_growth: 0, total_customers: 0, customers_growth: 0, total_products: 0, products_growth: 0, avg_order_value: 0, aov_growth: 0, conversion_rate: 0, conversion_growth: 0 },
  revenue_trend: [],
  sales_by_category: [],
  top_products: [],
  customer_segments: [],
  field_agent_performance: [],
  geographic_data: [],
  time_analysis: { peak_hours: [], peak_days: [] }
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)
  const [dateRange, setDateRange] = useState('30d')
  const [selectedMetric, setSelectedMetric] = useState('revenue')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadAnalyticsData()
  }, [dateRange])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      
      const filter = {
        start_date: getStartDate(dateRange),
        end_date: new Date().toISOString().split('T')[0]
      }
      
      const [
        dashboardMetrics,
        salesAnalytics,
        agentAnalytics,
        customerAnalytics,
        productAnalytics
      ] = await Promise.all([
        analyticsService.getDashboardMetrics(filter),
        analyticsService.getSalesAnalytics(filter),
        analyticsService.getAgentAnalytics(filter),
        analyticsService.getCustomerAnalytics(filter),
        analyticsService.getProductAnalytics(filter)
      ])
      
      const analyticsData: AnalyticsData = {
        overview: {
          total_revenue: dashboardMetrics.sales?.total_revenue || 0,
          revenue_growth: dashboardMetrics.sales?.revenue_growth || 0,
          total_orders: dashboardMetrics.sales?.total_orders || 0,
          orders_growth: dashboardMetrics.sales?.orders_growth || 0,
          total_customers: dashboardMetrics.customers?.total_customers || 0,
          customers_growth: ((dashboardMetrics.customers?.new_customers || 0) / (dashboardMetrics.customers?.total_customers || 1)) * 100,
          total_products: dashboardMetrics.products?.total_products || 0,
          products_growth: 0,
          avg_order_value: dashboardMetrics.sales?.average_order_value || 0,
          aov_growth: 0,
          conversion_rate: dashboardMetrics.visits?.visit_success_rate || 0,
          conversion_growth: 0
        },
        revenue_trend: salesAnalytics.sales_by_period || [],
        sales_by_category: salesAnalytics.sales_by_category?.map((cat: any) => ({
          category: cat.category_name || cat.category,
          revenue: cat.revenue || 0,
          orders: cat.orders || 0,
          percentage: cat.percentage || 0
        })) || [],
        top_products: productAnalytics.top_selling_products?.map((p: any) => ({
          id: p.product_id,
          name: p.product_name,
          revenue: p.revenue || 0,
          quantity_sold: p.quantity_sold || 0,
          growth: p.growth_rate || 0
        })) || [],
        customer_segments: customerAnalytics.customers_by_type?.map((seg: any) => ({
          segment: seg.type,
          count: seg.count,
          revenue: 0,
          percentage: seg.percentage
        })) || [],
        field_agent_performance: agentAnalytics.top_performers?.map((agent: any) => ({
          agent_id: agent.agent_id,
          agent_name: agent.agent_name,
          total_sales: agent.total_sales || 0,
          orders_count: 0,
          customers_visited: agent.total_visits || 0,
          conversion_rate: agent.success_rate || 0,
          commission_earned: agent.commission_earned || 0
        })) || [],
        geographic_data: salesAnalytics.sales_by_region?.map((region: any) => ({
          region: region.region_name || region.region,
          revenue: region.revenue || 0,
          orders: region.orders || 0,
          customers: 0,
          growth: 0
        })) || [],
        time_analysis: {
          peak_hours: [],
          peak_days: []
        }
      }
      
      setData(analyticsData)
    } catch (err) {
      setUsingFallback(true)
      console.error('Error loading analytics:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const getStartDate = (range: string): string => {
    const now = new Date()
    switch (range) {
      case '7d':
        now.setDate(now.getDate() - 7)
        break
      case '30d':
        now.setDate(now.getDate() - 30)
        break
      case '90d':
        now.setDate(now.getDate() - 90)
        break
      case '1y':
        now.setFullYear(now.getFullYear() - 1)
        break
      default:
        now.setDate(now.getDate() - 30)
    }
    return now.toISOString().split('T')[0]
  }

  const refreshData = async () => {
    setRefreshing(true)
    await loadAnalyticsData()
    setRefreshing(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    const num = Number(value);
    return `${num > 0 ? '+' : ''}${Number.isFinite(num) ? num.toFixed(1) : '0.0'}%`
  }

  const displayData = data || fallbackAnalyticsData

  const exportData = () => {
    const d = data || fallbackAnalyticsData
    const csvData = 'Date,Revenue,Orders,Customers\n' + 
      (d.revenue_trend.map(item => 
        `${item.date},${item.revenue},${item.orders},${item.customers}`
      ).join('\n') || '')
    
    const blob = new Blob([csvData], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${dateRange}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            Comprehensive analytics and reporting dashboard with real-time insights.
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="btn-outline p-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={exportData}
            className="btn-primary flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {usingFallback && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">Analytics data is not yet available. Showing default values.</p>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(displayData.overview.total_revenue)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {displayData.overview.revenue_growth > 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${displayData.overview.revenue_growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(displayData.overview.revenue_growth)}
            </span>
            <span className="text-sm text-gray-500 ml-2">vs last period</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{displayData.overview.total_orders.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {displayData.overview.orders_growth > 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${displayData.overview.orders_growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(displayData.overview.orders_growth)}
            </span>
            <span className="text-sm text-gray-500 ml-2">vs last period</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{displayData.overview.total_customers.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {displayData.overview.customers_growth > 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${displayData.overview.customers_growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(displayData.overview.customers_growth)}
            </span>
            <span className="text-sm text-gray-500 ml-2">vs last period</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(displayData.overview.avg_order_value)}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Target className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {displayData.overview.aov_growth > 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${displayData.overview.aov_growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(displayData.overview.aov_growth)}
            </span>
            <span className="text-sm text-gray-500 ml-2">vs last period</span>
          </div>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Revenue Trend</h3>
          <div className="flex items-center space-x-2">
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="revenue">Revenue</option>
              <option value="orders">Orders</option>
              <option value="customers">Customers</option>
            </select>
          </div>
        </div>
        
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData.revenue_trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis 
                tickFormatter={(value) => 
                  selectedMetric === 'revenue' ? formatCurrency(value) : value.toLocaleString()
                }
              />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: number) => [
                  selectedMetric === 'revenue' ? formatCurrency(value) : value.toLocaleString(),
                  selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)
                ]}
              />
              <Area 
                type="monotone" 
                dataKey={selectedMetric} 
                stroke="#3B82F6" 
                fill="#3B82F6" 
                fillOpacity={0.1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Category */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Sales by Category</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={displayData.sales_by_category}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percentage }) => `${category} (${percentage}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {displayData.sales_by_category.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Top Products</h3>
          <div className="space-y-4">
            {displayData.top_products.map((product, index) => (
              <div key={product.id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-600">#{index + 1}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.quantity_sold} units sold</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(product.revenue)}</p>
                  <div className="flex items-center">
                    {product.growth > 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={`text-xs ${product.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage(product.growth)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Field Agent Performance */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Field Agent Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Sales
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customers Visited
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Conversion Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commission
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayData.field_agent_performance.map((agent) => (
                <tr key={agent.agent_id} className="hover:bg-surface-secondary">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-600">
                            {agent.agent_name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{agent.agent_name}</div>
                        <div className="text-sm text-gray-500">ID: {agent.agent_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(agent.total_sales)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {agent.orders_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {agent.customers_visited}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${agent.conversion_rate}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-900">{Number.isFinite(Number(agent.conversion_rate)) ? Number(agent.conversion_rate).toFixed(1) : '0.0'}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(agent.commission_earned)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Geographic Performance & Time Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Geographic Performance */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Geographic Performance</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayData.geographic_data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="region" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="revenue" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours Analysis */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Peak Hours Analysis</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={displayData.time_analysis.peak_hours}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="hour" 
                  tickFormatter={(value) => `${value}:00`}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => `${value}:00`}
                  formatter={(value: number, name: string) => [
                    name === 'revenue' ? formatCurrency(value) : value,
                    name === 'revenue' ? 'Revenue' : 'Orders'
                  ]}
                />
                <Line type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} />
                <Legend />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900">{displayData.overview.conversion_rate}%</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-full">
              <Activity className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center">
              {displayData.overview.conversion_growth > 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${displayData.overview.conversion_growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(displayData.overview.conversion_growth)}
              </span>
              <span className="text-sm text-gray-500 ml-2">vs last period</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Products</p>
              <p className="text-2xl font-bold text-gray-900">{displayData.overview.total_products}</p>
            </div>
            <div className="p-3 bg-teal-100 rounded-full">
              <Package className="h-6 w-6 text-teal-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center">
              {displayData.overview.products_growth > 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${displayData.overview.products_growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(displayData.overview.products_growth)}
              </span>
              <span className="text-sm text-gray-500 ml-2">vs last period</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Customer Segments</p>
              <p className="text-2xl font-bold text-gray-900">{displayData.customer_segments.length}</p>
            </div>
            <div className="p-3 bg-pink-100 rounded-full">
              <Award className="h-6 w-6 text-pink-600" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {displayData.customer_segments.map((segment) => (
              <div key={segment.segment} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{segment.segment}</span>
                <span className="font-medium text-gray-900">{segment.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
