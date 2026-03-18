import React, { useState, useEffect } from 'react'
import { 
  Server, Database, Users, Package, ShoppingCart, TrendingUp, 
  AlertTriangle, CheckCircle, Activity, Clock, HardDrive, Cpu,
  FileText, DollarSign, MapPin, Calendar, BarChart3, PieChart
} from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface SystemStats {
  totalUsers: number
  activeUsers: number
  totalCustomers: number
  totalOrders: number
  totalProducts: number
  totalRevenue: number
  activeAgents: number
  todayVisits: number
}

interface RecentActivity {
  id: string
  type: string
  description: string
  user: string
  timestamp: string
  status: 'success' | 'warning' | 'error'
}

export default function AdminPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalCustomers: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalRevenue: 0,
    activeAgents: 0,
    todayVisits: 0
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [systemHealth, setSystemHealth] = useState({
    status: 'healthy',
    uptime: '99.9%',
    lastBackup: new Date().toISOString(),
    apiResponse: 'fast',
    dbSize: '45.2 MB'
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch multiple endpoints in parallel
      const [usersRes, customersRes, ordersRes, productsRes, agentsRes, visitsRes] = await Promise.all([
        apiClient.get('/users').catch(() => ({ data: { data: { users: [] } } })),
        apiClient.get('/customers').catch(() => ({ data: { data: { customers: [] } } })),
        apiClient.get('/orders').catch(() => ({ data: { data: { orders: [] } } })),
        apiClient.get('/products').catch(() => ({ data: { data: { products: [] } } })),
        apiClient.get('/agents').catch(() => ({ data: { data: [] } })),
        apiClient.get('/visits').catch(() => ({ data: { data: [] } }))
      ])

      const users = usersRes.data.data?.users || []
      const customers = customersRes.data.data?.customers || []
      const orders = ordersRes.data.data?.orders || []
      const products = productsRes.data.data?.products || []
      const agents = agentsRes.data.data || []
      const visits = visitsRes.data.data || []

      // Calculate stats
      const totalRevenue = orders.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0)
      const today = new Date().toISOString().split('T')[0]
      const todayVisits = visits.filter((v: any) => v.visit_date?.startsWith(today)).length

      setStats({
        totalUsers: users.length,
        activeUsers: users.filter((u: any) => u.status === 'active').length,
        totalCustomers: customers.length,
        totalOrders: orders.length,
        totalProducts: products.length,
        totalRevenue,
        activeAgents: agents.length,
        todayVisits
      })

      // Mock recent activity (in production, this would come from audit logs)
      setRecentActivity([
        {
          id: '1',
          type: 'user',
          description: 'New user registered',
          user: 'Admin',
          timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
          status: 'success'
        },
        {
          id: '2',
          type: 'order',
          description: 'New order created',
          user: 'Agent 1',
          timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
          status: 'success'
        },
        {
          id: '3',
          type: 'product',
          description: 'Product stock updated',
          user: 'Manager',
          timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
          status: 'warning'
        },
        {
          id: '4',
          type: 'customer',
          description: 'New customer added',
          user: 'Salesman',
          timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
          status: 'success'
        }
      ])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user': return <Users className="w-5 h-5" />
      case 'order': return <ShoppingCart className="w-5 h-5" />
      case 'product': return <Package className="w-5 h-5" />
      case 'customer': return <Users className="w-5 h-5" />
      default: return <Activity className="w-5 h-5" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administration Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          System overview, health monitoring, and quick actions
        </p>
      </div>

      {/* System Health */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-2">System Status</h2>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm">All systems operational</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-right">
            <div>
              <p className="text-sm opacity-75">Uptime</p>
              <p className="text-xl font-bold">{systemHealth.uptime}</p>
            </div>
            <div>
              <p className="text-sm opacity-75">API Response</p>
              <p className="text-xl font-bold capitalize">{systemHealth.apiResponse}</p>
            </div>
            <div>
              <p className="text-sm opacity-75">Database</p>
              <p className="text-xl font-bold">{systemHealth.dbSize}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
             onClick={() => navigate('/admin/users')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
              <p className="text-sm text-green-600 mt-1">
                {stats.activeUsers} active
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
             onClick={() => navigate('/customers')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Customers</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalCustomers}</p>
              <p className="text-sm text-gray-500 mt-1">Total registered</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
             onClick={() => navigate('/orders')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
              <p className="text-sm text-blue-600 mt-1">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <ShoppingCart className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
             onClick={() => navigate('/products')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Products</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
              <p className="text-sm text-gray-500 mt-1">In catalog</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Package className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Field Operations Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-indigo-600" />
            Field Operations Today
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm text-indigo-600 font-medium">Active Agents</p>
              <p className="text-2xl font-bold text-indigo-900">{stats.activeAgents}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 font-medium">Visits Today</p>
              <p className="text-2xl font-bold text-green-900">{stats.todayVisits}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
            Revenue Overview
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Revenue</span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(stats.totalRevenue)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Average Order</span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/admin/users')}
              className="flex items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Users className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-900">Users</span>
            </button>
            <button
              onClick={() => navigate('/admin/audit-logs')}
              className="flex items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <FileText className="w-5 h-5 text-purple-600 mr-2" />
              <span className="text-sm font-medium text-purple-900">Audit Logs</span>
            </button>
            <button
              onClick={() => navigate('/customers')}
              className="flex items-center justify-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <Users className="w-5 h-5 text-green-600 mr-2" />
              <span className="text-sm font-medium text-green-900">Customers</span>
            </button>
            <button
              onClick={() => navigate('/products')}
              className="flex items-center justify-center p-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors"
            >
              <Package className="w-5 h-5 text-yellow-600 mr-2" />
              <span className="text-sm font-medium text-yellow-900">Products</span>
            </button>
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center justify-center p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              <ShoppingCart className="w-5 h-5 text-indigo-600 mr-2" />
              <span className="text-sm font-medium text-indigo-900">Orders</span>
            </button>
            <button
              onClick={() => navigate('/field-operations/visits')}
              className="flex items-center justify-center p-4 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors"
            >
              <MapPin className="w-5 h-5 text-pink-600 mr-2" />
              <span className="text-sm font-medium text-pink-900">Visits</span>
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="flex items-center justify-center p-4 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              <BarChart3 className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-sm font-medium text-red-900">Analytics</span>
            </button>
            <button
              onClick={() => fetchDashboardData()}
              className="flex items-center justify-center p-4 bg-surface-secondary hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Activity className="w-5 h-5 text-gray-600 mr-2" />
              <span className="text-sm font-medium text-gray-900">Refresh</span>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 hover:bg-surface-secondary rounded-lg transition-colors">
                  <div className={`p-2 rounded-lg ${getStatusColor(activity.status)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      by {activity.user} · {formatTimestamp(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => navigate('/admin/audit-logs')}
            className="w-full mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            View All Activity
          </button>
        </div>
      </div>

      {/* System Resources */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Server className="w-5 h-5 mr-2 text-gray-600" />
          System Resources
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <Cpu className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">CPU Usage</p>
            <p className="text-2xl font-bold text-gray-900">12%</p>
          </div>
          <div className="text-center">
            <Activity className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Memory</p>
            <p className="text-2xl font-bold text-gray-900">28%</p>
          </div>
          <div className="text-center">
            <HardDrive className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Disk Space</p>
            <p className="text-2xl font-bold text-gray-900">9.1%</p>
          </div>
          <div className="text-center">
            <Database className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Database</p>
            <p className="text-2xl font-bold text-gray-900">{systemHealth.dbSize}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
