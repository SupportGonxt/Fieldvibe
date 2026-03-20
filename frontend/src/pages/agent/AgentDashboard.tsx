import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Plus, Clock, CheckCircle, TrendingUp, Users,
  Calendar, ChevronRight, RefreshCw, Target, Building2,
  Wifi, WifiOff, LogOut, Store, User
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { API_CONFIG } from '../../config/api.config'

interface DashboardData {
  today_visits: number
  month_visits: number
  today_registrations: number
  month_registrations: number
  recent_visits: Array<{
    id: string
    visit_date: string
    visit_type: string
    status: string
    check_in_time: string
    customer_name: string
    individual_name: string
  }>
  companies: Array<{ id: string; name: string; code: string }>
  daily_targets: Array<{
    company_name: string
    target_visits: number
    actual_visits: number
    target_registrations: number
    actual_registrations: number
  }>
}

export default function AgentDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const authUser = useAuthStore((s) => s.user)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const token = useAuthStore.getState().tokens?.access_token || localStorage.getItem('token')
      if (!token) { navigate('/auth/mobile-login'); return }

      const res = await fetch(`${API_CONFIG.BASE_URL}/agent/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [navigate])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const handleLogout = () => {
    useAuthStore.getState().logout()
    localStorage.removeItem('token')
    navigate('/auth/mobile-login')
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  const firstName = authUser?.first_name || (authUser as any)?.firstName || 'Agent'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00E87B] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#06090F] pb-24">
      <div className="bg-[#0A1628] px-4 py-2 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          {online ? <Wifi className="w-3.5 h-3.5 text-[#00E87B]" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
          <span className="text-[10px] text-gray-500">{online ? 'Online' : 'Offline'}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchDashboard(true)} className="p-1" disabled={refreshing}>
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleLogout} className="p-1">
            <LogOut className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="px-5 pt-5 pb-3">
        <p className="text-sm text-gray-500">{greeting()}</p>
        <h1 className="text-2xl font-bold text-white">{firstName}</h1>
        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
          <Calendar className="w-3 h-3" />
          {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <div className="px-5 mb-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={() => navigate('/agent/visits/create?type=store')}
            className="py-3.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform text-sm"
          >
            <Store className="w-4 h-4" />
            Store Visit
          </button>
          <button
            onClick={() => navigate('/agent/visits/create?type=individual')}
            className="py-3.5 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold rounded-2xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform text-sm"
          >
            <User className="w-4 h-4" />
            Individual Visit
          </button>
        </div>
        <button
          onClick={() => navigate('/agent/visits/create')}
          className="w-full py-3 bg-gradient-to-r from-[#00E87B] to-[#00D06E] text-[#0A1628] font-bold rounded-2xl shadow-lg shadow-[#00E87B]/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform text-sm"
        >
          <Plus className="w-4 h-4" />
          Start New Visit
        </button>
      </div>

      <div className="px-5 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<MapPin className="w-5 h-5" />} label="Today Visits" value={data?.today_visits || 0} color="bg-blue-500" />
          <StatCard icon={<Users className="w-5 h-5" />} label="Registrations" value={data?.today_registrations || 0} color="bg-purple-500" />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Month Visits" value={data?.month_visits || 0} color="bg-emerald-500" />
          <StatCard icon={<Target className="w-5 h-5" />} label="Month Regs" value={data?.month_registrations || 0} color="bg-amber-500" />
        </div>
      </div>

      {data?.companies && data.companies.length > 0 && (
        <div className="px-5 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assigned Companies</h2>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {data.companies.map((c) => (
              <div key={c.id} className="flex-shrink-0 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#00E87B]" />
                <span className="text-sm text-white whitespace-nowrap">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.daily_targets && data.daily_targets.length > 0 && (
        <div className="px-5 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Daily Targets</h2>
          <div className="space-y-2">
            {data.daily_targets.map((t, i) => {
              const visitPct = t.target_visits > 0 ? Math.min(100, Math.round((t.actual_visits / t.target_visits) * 100)) : 0
              return (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{t.company_name}</span>
                    <span className="text-xs text-[#00E87B] font-semibold">{visitPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#00E87B] to-[#00D06E] rounded-full transition-all" style={{ width: `${visitPct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-gray-500">Visits: {t.actual_visits}/{t.target_visits}</span>
                    <span className="text-[10px] text-gray-500">Regs: {t.actual_registrations}/{t.target_registrations}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="px-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Visits</h2>
          <button onClick={() => navigate('/agent/visits')} className="text-xs text-[#00E87B] flex items-center">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {data?.recent_visits && data.recent_visits.length > 0 ? (
          <div className="space-y-2">
            {data.recent_visits.slice(0, 5).map((visit) => (
              <div key={visit.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  visit.status === 'completed' ? 'bg-green-500/10' : visit.status === 'in_progress' ? 'bg-blue-500/10' : 'bg-gray-500/10'
                }`}>
                  {visit.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {visit.customer_name || visit.individual_name || 'Visit'}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    {(visit.visit_type || '').toLowerCase() === 'store' ? <Store className="w-3 h-3 text-purple-400" /> :
                     (visit.visit_type || '').toLowerCase() === 'individual' ? <User className="w-3 h-3 text-cyan-400" /> : null}
                    {visit.visit_type} &middot; {visit.visit_date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <MapPin className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No visits yet today</p>
            <p className="text-xs text-gray-600 mt-1">Start your first visit above</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${color} text-white`}>{icon}</div>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}
