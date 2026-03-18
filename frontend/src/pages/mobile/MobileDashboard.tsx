import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  MapPin, Clock, CheckCircle, AlertTriangle, TrendingUp, 
  Users, Package, DollarSign, Calendar, ChevronRight,
  Wifi, WifiOff, RefreshCw
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { isOnline, getSyncQueueCount } from '../../utils/offline-storage'

// MOB-03: Mobile Dashboard with role-aware widgets

interface QuickAction {
  label: string
  icon: React.ReactNode
  path: string
  color: string
  roles?: string[]
}

interface StatCard {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
  trend?: { value: number; direction: 'up' | 'down' }
}

export default function MobileDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [online, setOnline] = useState(isOnline())
  const [syncCount, setSyncCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    getSyncQueueCount().then(setSyncCount)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const role = user?.role || 'agent'

  const stats: StatCard[] = [
    { label: 'Today\'s Visits', value: 8, icon: <MapPin className="w-5 h-5" />, color: 'bg-blue-500', trend: { value: 12, direction: 'up' } },
    { label: 'Completed', value: 5, icon: <CheckCircle className="w-5 h-5" />, color: 'bg-green-500' },
    { label: 'Pending', value: 3, icon: <Clock className="w-5 h-5" />, color: 'bg-yellow-500' },
    { label: 'Revenue', value: 'R 12,450', icon: <DollarSign className="w-5 h-5" />, color: 'bg-purple-500', trend: { value: 8, direction: 'up' } },
  ]

  const quickActions: QuickAction[] = [
    { label: 'New Visit', icon: <MapPin className="w-6 h-6" />, path: '/field-operations/visits/create', color: 'bg-blue-100 text-blue-700' },
    { label: 'New Order', icon: <Package className="w-6 h-6" />, path: '/orders/create', color: 'bg-green-100 text-green-700' },
    { label: 'Customers', icon: <Users className="w-6 h-6" />, path: '/customers', color: 'bg-purple-100 text-purple-700' },
    { label: 'Reports', icon: <TrendingUp className="w-6 h-6" />, path: '/reports', color: 'bg-orange-100 text-orange-700', roles: ['admin', 'super_admin', 'manager'] },
  ]

  const filteredActions = quickActions.filter(a => !a.roles || a.roles.includes(role))

  const handleRefresh = async () => {
    setRefreshing(true)
    await new Promise(r => setTimeout(r, 1000))
    setRefreshing(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-night-300 pb-20">
      {/* Status Bar */}
      <div className="bg-white dark:bg-night-50 px-4 py-2 flex items-center justify-between border-b border-gray-200 dark:border-night-100">
        <div className="flex items-center gap-2">
          {online ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className="text-xs text-gray-500">{online ? 'Online' : 'Offline'}</span>
          {syncCount > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">{syncCount} pending</span>
          )}
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="p-1">
          <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Greeting */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0] || 'User'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white dark:bg-night-50 rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${stat.color} text-white`}>{stat.icon}</div>
                {stat.trend && (
                  <span className={`text-xs font-medium ${stat.trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.trend.direction === 'up' ? '+' : '-'}{stat.trend.value}%
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          {filteredActions.map((action, i) => (
            <button
              key={i}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white dark:bg-night-50 shadow-sm active:scale-95 transition-transform"
            >
              <div className={`p-2 rounded-lg ${action.color}`}>{action.icon}</div>
              <span className="text-xs text-gray-700 dark:text-gray-300 text-center">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Today's Schedule</h2>
          <button onClick={() => navigate('/field-operations/visits')} className="text-xs text-blue-600 flex items-center">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-2">
          {[
            { time: '09:00', store: 'Pick n Pay - Sandton', status: 'completed', type: 'Merchandising' },
            { time: '10:30', store: 'Spar - Rosebank', status: 'completed', type: 'Stock Check' },
            { time: '12:00', store: 'Checkers - Hyde Park', status: 'in_progress', type: 'Activation' },
            { time: '14:00', store: 'Woolworths - Fourways', status: 'pending', type: 'Delivery' },
            { time: '15:30', store: 'Shoprite - Cresta', status: 'pending', type: 'Merchandising' },
          ].map((visit, i) => (
            <div key={i} className="bg-white dark:bg-night-50 rounded-lg p-3 shadow-sm flex items-center gap-3">
              <div className="text-center min-w-[48px]">
                <p className="text-xs font-medium text-gray-500">{visit.time}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{visit.store}</p>
                <p className="text-xs text-gray-500">{visit.type}</p>
              </div>
              <div>
                {visit.status === 'completed' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : visit.status === 'in_progress' ? (
                  <Clock className="w-5 h-5 text-blue-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-gray-300" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Offline Alert */}
      {!online && (
        <div className="fixed bottom-20 left-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 shadow-lg">
          <WifiOff className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">You're offline</p>
            <p className="text-xs text-yellow-600">Changes will sync when you reconnect</p>
          </div>
        </div>
      )}
    </div>
  )
}
