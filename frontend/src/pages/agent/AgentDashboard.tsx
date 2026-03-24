import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Plus, Clock, CheckCircle, TrendingUp, Users,
  Calendar, ChevronRight, RefreshCw, Target, Building2,
  Wifi, WifiOff, LogOut, Store, User, BookOpen, GraduationCap,
  DollarSign, Flame, BarChart3
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { apiClient, invalidateApiCache } from '../../services/api.service'

interface TargetSummary {
  target_visits: number
  actual_visits: number
  target_registrations: number
  actual_registrations: number
}

interface CompanyTarget {
  company_id: string
  company_name: string
  daily_target_visits: number
  daily_target_registrations: number
  daily_actual_visits: number
  daily_actual_registrations: number
  store_target_per_month: number
  store_actual_month: number
  store_actual_today: number
  store_actual_week: number
  individual_target_per_week: number
  individual_target_per_month: number
  individual_actual_month: number
  individual_actual_today: number
  individual_actual_week: number
  week_target_visits: number
  week_actual_visits: number
  month_target_visits: number
  month_actual_visits: number
  month_target_registrations: number
  month_actual_registrations: number
}

interface DashboardData {
  today_visits: number
  month_visits: number
  week_visits: number
  today_registrations: number
  month_registrations: number
  week_registrations: number
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
    actual_store_visits?: number
    actual_individual_visits?: number
  }>
  company_targets?: CompanyTarget[]
  weekly_targets?: TargetSummary
  monthly_targets?: TargetSummary
}

interface PerfSummary {
  overall_achievement: number
  streak: number
  commission_summary: {
    pending: number
    approved: number
    paid: number
  }
}

export default function AgentDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [perfSummary, setPerfSummary] = useState<PerfSummary | null>(null)
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
    if (isRefresh) {
      setRefreshing(true)
      invalidateApiCache('/agent/')
    } else {
      setLoading(true)
    }

    try {
      const [dashRes, perfRes] = await Promise.all([
        apiClient.get('/agent/dashboard'),
        apiClient.get('/agent/performance').catch(() => null),
      ])
      const json = dashRes.data
      if (json.success && json.data) {
        setData(json.data)
      }
      if (perfRes?.data?.success && perfRes?.data?.data) {
        setPerfSummary(perfRes.data.data)
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

      {/* Role-specific quick access card */}
      {authUser?.role === 'team_lead' && (
        <div className="px-5 mb-4">
          <button
            onClick={() => navigate('/agent/team')}
            className="w-full bg-gradient-to-r from-indigo-600/20 to-cyan-600/20 border border-indigo-500/20 rounded-2xl p-4 flex items-center gap-3 active:bg-white/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-white">Team Overview</p>
              <p className="text-xs text-gray-400">View your agents' performance</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      )}

      {authUser?.role === 'manager' && (
        <div className="px-5 mb-4">
          <button
            onClick={() => navigate('/agent/teams')}
            className="w-full bg-gradient-to-r from-violet-600/20 to-pink-600/20 border border-violet-500/20 rounded-2xl p-4 flex items-center gap-3 active:bg-white/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-violet-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-white">Organization Overview</p>
              <p className="text-xs text-gray-400">View all teams & agents</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      )}

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

      {perfSummary && (
        <div className="px-5 mb-4">
          <button
            onClick={() => navigate('/agent/stats')}
            className="w-full bg-gradient-to-r from-[#0A1628] to-[#0E1D35] border border-white/10 rounded-2xl p-4 active:bg-white/5 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#00E87B]" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Performance</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="relative w-10 h-10 mx-auto mb-1">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                    <circle cx="20" cy="20" r="16" fill="none" stroke="#00E87B" strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={Math.min(perfSummary.overall_achievement, 100) * 1.005 + ' 100.5'} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{perfSummary.overall_achievement}%</span>
                  </div>
                </div>
                <p className="text-[9px] text-gray-500">Target</p>
              </div>
              <div className="text-center">
                <DollarSign className="w-5 h-5 text-amber-400 mx-auto mb-0.5" />
                <p className="text-sm font-bold text-white">R{((perfSummary.commission_summary?.paid || 0) + (perfSummary.commission_summary?.approved || 0) + (perfSummary.commission_summary?.pending || 0)).toLocaleString()}</p>
                <p className="text-[9px] text-gray-500">Earnings</p>
              </div>
              <div className="text-center">
                <Flame className={'w-5 h-5 mx-auto mb-0.5 ' + (perfSummary.streak > 0 ? 'text-orange-400' : 'text-gray-600')} />
                <p className="text-sm font-bold text-white">{perfSummary.streak}</p>
                <p className="text-[9px] text-gray-500">Day Streak</p>
              </div>
            </div>
          </button>
        </div>
      )}

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

      {/* Weekly & Monthly Targets */}
      {(data?.weekly_targets || data?.monthly_targets) && (
        <div className="px-5 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Week & Month Progress</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {data?.weekly_targets && data.weekly_targets.target_visits > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] text-gray-500 uppercase">Week Visits</span>
                </div>
                <p className="text-lg font-bold text-white">{data.weekly_targets.actual_visits}<span className="text-sm text-gray-500">/{data.weekly_targets.target_visits}</span></p>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, Math.round((data.weekly_targets.actual_visits / data.weekly_targets.target_visits) * 100))}%` }} />
                </div>
              </div>
            )}
            {data?.monthly_targets && data.monthly_targets.target_visits > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-gray-500 uppercase">Month Visits</span>
                </div>
                <p className="text-lg font-bold text-white">{data.monthly_targets.actual_visits}<span className="text-sm text-gray-500">/{data.monthly_targets.target_visits}</span></p>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.round((data.monthly_targets.actual_visits / data.monthly_targets.target_visits) * 100))}%` }} />
                </div>
              </div>
            )}
            {data?.weekly_targets && data.weekly_targets.target_registrations > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] text-gray-500 uppercase">Week Regs</span>
                </div>
                <p className="text-lg font-bold text-white">{data.weekly_targets.actual_registrations}<span className="text-sm text-gray-500">/{data.weekly_targets.target_registrations}</span></p>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, Math.round((data.weekly_targets.actual_registrations / data.weekly_targets.target_registrations) * 100))}%` }} />
                </div>
              </div>
            )}
            {data?.monthly_targets && data.monthly_targets.target_registrations > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-gray-500 uppercase">Month Regs</span>
                </div>
                <p className="text-lg font-bold text-white">{data.monthly_targets.actual_registrations}<span className="text-sm text-gray-500">/{data.monthly_targets.target_registrations}</span></p>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, Math.round((data.monthly_targets.actual_registrations / data.monthly_targets.target_registrations) * 100))}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {data?.company_targets && data.company_targets.length > 0 ? (
        <div className="px-5 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Targets by Company</h2>
          <div className="space-y-3">
            {data.company_targets.map((ct, i) => {
              const dailyPct = ct.daily_target_visits > 0 ? Math.min(100, Math.round((ct.daily_actual_visits / ct.daily_target_visits) * 100)) : 0
              return (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">{ct.company_name}</span>
                    <span className={'text-xs font-semibold ' + (dailyPct >= 100 ? 'text-[#00E87B]' : 'text-amber-400')}>{dailyPct}%</span>
                  </div>
                  {/* Daily progress bar */}
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-[#00E87B] to-[#00D06E] rounded-full transition-all" style={{ width: `${dailyPct}%` }} />
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-[10px] text-gray-500">Today: {ct.daily_actual_visits}/{ct.daily_target_visits} visits</span>
                    <span className="text-[10px] text-gray-500">Regs: {ct.daily_actual_registrations}/{ct.daily_target_registrations}</span>
                  </div>
                  {/* Store vs Individual split */}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {(ct.store_target_per_month > 0 || ct.store_actual_month > 0) && (
                      <div className="bg-purple-500/10 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <Store className="w-3 h-3 text-purple-400" />
                          <span className="text-[10px] text-purple-300 font-medium">Store</span>
                        </div>
                        <p className="text-xs text-white">
                          <span className="font-semibold">{ct.store_actual_today}</span>
                          <span className="text-gray-500"> today</span>
                        </p>
                        {ct.store_target_per_month > 0 && (
                          <p className="text-[10px] text-gray-500">{ct.store_actual_month}/{ct.store_target_per_month} month</p>
                        )}
                      </div>
                    )}
                    {(ct.individual_target_per_month > 0 || ct.individual_actual_month > 0) && (
                      <div className="bg-cyan-500/10 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <User className="w-3 h-3 text-cyan-400" />
                          <span className="text-[10px] text-cyan-300 font-medium">Individual</span>
                        </div>
                        <p className="text-xs text-white">
                          <span className="font-semibold">{ct.individual_actual_today}</span>
                          <span className="text-gray-500"> today</span>
                        </p>
                        {ct.individual_target_per_month > 0 && (
                          <p className="text-[10px] text-gray-500">{ct.individual_actual_month}/{ct.individual_target_per_month} month</p>
                        )}
                        {ct.individual_target_per_week > 0 && (
                          <p className="text-[10px] text-gray-500">{ct.individual_actual_week}/{ct.individual_target_per_week} week</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : data?.daily_targets && data.daily_targets.length > 0 ? (
        <div className="px-5 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Daily Targets</h2>
          <div className="space-y-2">
            {data.daily_targets.map((t, i) => {
              const visitPct = t.target_visits > 0 ? Math.min(100, Math.round((t.actual_visits / t.target_visits) * 100)) : 0
              return (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{t.company_name}</span>
                    <span className={'text-xs font-semibold ' + (visitPct >= 100 ? 'text-[#00E87B]' : 'text-amber-400')}>{visitPct}%</span>
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
      ) : null}

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
      {/* Help & Training */}
      <div className="px-5 mb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Help & Training</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate('/agent/onboarding')}
            className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2.5 active:bg-white/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-white">Get Started</p>
              <p className="text-[10px] text-gray-500">Onboarding</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/agent/training')}
            className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2.5 active:bg-white/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-white">Training</p>
              <p className="text-[10px] text-gray-500">Visit guide</p>
            </div>
          </button>
        </div>
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
