import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  MapPin, Clock, CheckCircle, AlertTriangle, TrendingUp, 
  Users, Package, DollarSign, Calendar, ChevronRight,
  Wifi, WifiOff, RefreshCw, Target, Store, User
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { isOnline, getSyncQueueCount } from '../../utils/offline-storage'
import { apiClient } from '../../services/api.service'

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
  const [statsData, setStatsData] = useState({
    today_visits: 0,
    month_visits: 0,
    today_stores: 0,
    month_stores: 0,
    today_individual_visits: 0,
    today_store_visits: 0,
    month_individual_visits: 0,
    month_store_visits: 0,
    daily_targets: [],
    monthly_targets: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    getSyncQueueCount().then(setSyncCount)
    
    // Fetch dashboard stats
    const fetchStats = async () => {
      try {
        const dashRes = await apiClient.get('/agent/dashboard').catch(() => null)
        if (dashRes?.data?.success && dashRes?.data?.data) {
          setStatsData(dashRes.data.data)
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const role = user?.role || 'agent'

  const stats: StatCard[] = [
    { label: 'Today\'s Visits', value: statsData.today_individual_visits || statsData.today_visits || 0, icon: <MapPin className="w-5 h-5" />, color: 'bg-blue-500' },
    { label: 'Completed', value: statsData.today_store_visits || 0, icon: <CheckCircle className="w-5 h-5" />, color: 'bg-green-500' },
    { label: 'Month Visits', value: statsData.month_individual_visits || statsData.month_visits || 0, icon: <TrendingUp className="w-5 h-5" />, color: 'bg-purple-500' },
    { label: 'Targets', value: statsData.daily_targets?.length || statsData.monthly_targets?.length || 0, icon: <Target className="w-5 h-5" />, color: 'bg-orange-500' },
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

      {/* Company Targets Section */}
      {!loading && ((statsData.daily_targets && statsData.daily_targets.length > 0) || (statsData.monthly_targets && statsData.monthly_targets.length > 0)) && (
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-orange-500" /> Company Targets
          </h2>
          <div className="space-y-3">
            {/* Daily Targets */}
            {statsData.daily_targets && statsData.daily_targets.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">Today's Targets</h3>
                <div className="space-y-2">
                  {statsData.daily_targets.map((target, i) => {
                    const actualVisits = target.actual_visits ?? target.actual_individual_visits ?? 0
                    // Use weekly target if available, otherwise daily target
                    const targetVisits = target.individual_target_per_week && target.individual_target_per_week > 0 ? target.individual_target_per_week : (target.target_visits ?? target.individual_target_per_day ?? 0)
                    const targetVisitsDaily = target.target_visits ?? target.individual_target_per_day ?? 0
                    const actualRegs = target.actual_stores ?? target.actual_store_visits ?? 0
                    const targetRegs = target.target_stores ?? target.store_target_per_day ?? 0
                    const vPct = targetVisits > 0 ? Math.min(100, Math.round((actualVisits / targetVisits) * 100)) : 0
                    const rPct = targetRegs > 0 ? Math.min(100, Math.round((actualRegs / targetRegs) * 100)) : 0
                    const hasWeeklyTarget = target.individual_target_per_week && target.individual_target_per_week > 0
                    return (
                      <div key={`daily-${i}`} className="bg-white dark:bg-night-50 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-night-100">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{target.company_name}</p>
                          <div className="flex items-center gap-1">
                            {hasWeeklyTarget && (
                              <span className="text-[9px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded">Weekly</span>
                            )}
                            <span className="text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded">Today</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500 dark:text-gray-400">Individual Visits</span>
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{actualVisits}/{targetVisits} <span className={vPct >= 100 ? 'text-green-600' : vPct >= 75 ? 'text-amber-500' : 'text-red-500'}>({vPct}%)</span></span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 dark:bg-night-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all bg-blue-500" style={{ width: vPct + '%' }} />
                            </div>
                            {hasWeeklyTarget && targetVisitsDaily > 0 && (
                              <p className="text-[9px] text-gray-500 mt-1">Daily target: {targetVisitsDaily} visits/day</p>
                            )}
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500 dark:text-gray-400">Store Visits</span>
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{actualRegs}/{targetRegs} <span className={rPct >= 100 ? 'text-green-600' : rPct >= 75 ? 'text-amber-500' : 'text-red-500'}>({rPct}%)</span></span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 dark:bg-night-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all bg-purple-500" style={{ width: rPct + '%' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {/* Monthly Targets */}
            {statsData.monthly_targets && statsData.monthly_targets.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">Monthly Targets</h3>
                <div className="space-y-2">
                  {statsData.monthly_targets.map((target, i) => {
                    const actualVisits = target.actual_visits ?? target.individual_visits ?? 0
                    const targetVisits = target.target_visits ?? 0
                    const actualRegs = target.actual_stores ?? target.store_visits ?? 0
                    const targetRegs = target.target_stores ?? 0
                    const vPct = targetVisits > 0 ? Math.min(100, Math.round((actualVisits / targetVisits) * 100)) : 0
                    const rPct = targetRegs > 0 ? Math.min(100, Math.round((actualRegs / targetRegs) * 100)) : 0
                    return (
                      <div key={`monthly-${i}`} className="bg-white dark:bg-night-50 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-night-100">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{target.company_name}</p>
                          <span className="text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded">Month</span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500 dark:text-gray-400">Individual Visits</span>
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{actualVisits}/{targetVisits} <span className={vPct >= 100 ? 'text-green-600' : vPct >= 75 ? 'text-amber-500' : 'text-red-500'}>({vPct}%)</span></span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 dark:bg-night-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all bg-blue-500" style={{ width: vPct + '%' }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500 dark:text-gray-400">Store Visits</span>
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{actualRegs}/{targetRegs} <span className={rPct >= 100 ? 'text-green-600' : rPct >= 75 ? 'text-amber-500' : 'text-red-500'}>({rPct}%)</span></span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 dark:bg-night-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all bg-purple-500" style={{ width: rPct + '%' }} />
                            </div>
                          </div>
                        </div>
                        {/* Store vs Individual breakdown */}
                        {((target.store_visits || 0) > 0 || (target.individual_visits || 0) > 0) && (
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            {(target.store_visits || 0) > 0 && (
                              <div className="bg-purple-50 dark:bg-purple-500/10 rounded-lg p-2">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <Store className="w-3 h-3 text-purple-500" />
                                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Store</span>
                                </div>
                                <p className="text-xs text-gray-900 dark:text-gray-100 font-semibold">{target.store_visits} visits</p>
                              </div>
                            )}
                            {(target.individual_visits || 0) > 0 && (
                              <div className="bg-cyan-50 dark:bg-cyan-500/10 rounded-lg p-2">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <User className="w-3 h-3 text-cyan-500" />
                                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">Individual</span>
                                </div>
                                <p className="text-xs text-gray-900 dark:text-gray-100 font-semibold">{target.individual_visits} visits</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
