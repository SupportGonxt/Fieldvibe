import React, { useEffect, useState, useCallback, useMemo, memo, Suspense, lazy } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  MapPin, Plus, Clock, CheckCircle, TrendingUp, Users,
  Calendar, ChevronRight, RefreshCw, Target, Building2,
  Wifi, WifiOff, LogOut, Store, User, BookOpen, GraduationCap, Download, X,
  DollarSign, Flame, BarChart3
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { usePwaInstall } from '../../hooks/usePwaInstall'
import { apiClient, invalidateApiCache } from '../../services/api.service'
import { photoReviewService } from '../../services/insights.service'

// Lazy load non-critical sections (code splitting)
const PerformanceSection = lazy(() => import('./PerformanceSection'))
const TeamPerformanceSection = lazy(() => import('./TeamPerformanceSection'))
const PerformanceMessages = lazy(() => import('./PerformanceMessages'))

interface TargetSummary {
  target_visits: number
  actual_visits: number
  target_stores: number
  actual_stores: number
}

interface CompanyTarget {
  company_id: string
  company_name: string
  daily_target_visits: number
  daily_target_stores: number
  daily_actual_visits: number
  daily_actual_stores: number
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
  month_target_stores: number
  month_actual_stores: number
}

interface DashboardData {
  today_visits: number
  month_visits: number
  week_visits: number
  today_stores: number
  month_stores: number
  week_stores: number
  today_individual_visits?: number
  today_store_visits?: number
  month_individual_visits?: number
  month_store_visits?: number
  week_individual_visits?: number
  week_store_visits?: number
  recent_visits: Array<{
    id: string
    visit_date: string
    visit_type: string
    status: string
    check_in_time: string
    customer_name: string
    individual_name: string
    thumbnail_url?: string | null
    r2_url?: string | null
  }>
  companies: Array<{ id: string; name: string; code: string }>
  daily_targets: Array<{
    company_name: string
    target_visits: number
    actual_visits: number
    target_stores: number
    actual_stores: number
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
  team_performance?: {
    team_lead_name: string
    member_count: number
    total_visits: number
    total_individuals: number
    target_visits: number
    actual_visits: number
    target_stores: number
    actual_stores: number
    achievement: number
  } | null
  manager_performance?: {
    manager_name: string
    achievement: number
  } | null
}

export default function AgentDashboard() {
  // Rejected photos KPI state (must be inside component)
  const [rejectedPhotoCount, setRejectedPhotoCount] = useState<number>(0)
  const [rejectedPhotoLoading, setRejectedPhotoLoading] = useState<boolean>(false)
  const [rejectedVisitIds, setRejectedVisitIds] = useState<string[]>([])

  // Fetch rejected photos needing reupload
  useEffect(() => {
    let mounted = true
    setRejectedPhotoLoading(true)
    photoReviewService.getNeedsReupload().then((res: any) => {
      if (!mounted) return
      // getNeedsReupload returns visit rows (each with .id = visit ID, and .rejected_count)
      const items = Array.isArray(res) ? res : Array.isArray(res?.photos) ? res.photos : []
      const totalRejected = items.reduce((n: number, v: any) => n + (v.rejected_count || 1), 0)
      setRejectedPhotoCount(totalRejected)
      const visitIds = [...new Set(items.map((v: any) => v.id).filter(Boolean))] as string[]
      setRejectedVisitIds(visitIds)
    }).catch(() => { setRejectedPhotoCount(0); setRejectedVisitIds([]) }).finally(() => setRejectedPhotoLoading(false))
    return () => { mounted = false }
  }, [])
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [perfSummary, setPerfSummary] = useState<PerfSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const authUser = useAuthStore((s) => s.user)
  const { showPrompt: showInstallPrompt, promptInstall, dismiss: dismissInstall } = usePwaInstall()

  // Critical data loaded (stats + targets) - show skeletons until this is ready
  const [criticalLoaded, setCriticalLoaded] = useState(false)

  // Memoize target calculations to avoid recalculating on every render
  // Priority: company_targets (from company_target_rules) > daily_targets > monthly_targets
  const targets = useMemo(() => {
    if (!data) return null
    // Company targets are the source of truth - they come from company_target_rules with role-specific filtering
    const companyTargetSum = data.company_targets?.reduce((s, t) => s + (t.daily_target_visits || 0), 0) || 0
    const companyStoreTargetSum = data.company_targets?.reduce((s, t) => s + (t.daily_target_stores || 0), 0) || 0
    const dailyIndivTarget = companyTargetSum > 0 ? companyTargetSum : (data.daily_targets?.reduce((s, t) => s + (t.target_visits || 0), 0) || 0)
    const dailyStoreTarget = companyStoreTargetSum > 0 ? companyStoreTargetSum : (data.daily_targets?.reduce((s, t) => s + (t.target_stores || 0), 0) || 0)
    const monthIndivTarget = data.company_targets?.reduce((s, t) => s + (t.month_target_visits || 0), 0) || data.monthly_targets?.target_visits || 0
    const monthStoreTarget = data.company_targets?.reduce((s, t) => s + (t.store_target_per_month || 0), 0) || data.monthly_targets?.target_stores || 0
    const weekIndivTarget = data.company_targets?.reduce((s, t) => s + (t.week_target_visits || 0), 0) || data.weekly_targets?.target_visits || 0
    const weekIndivActual = data.week_individual_visits || data.weekly_targets?.actual_visits || 0
    const monthIndivActual = data.month_individual_visits || data.monthly_targets?.actual_visits || 0
    const monthStoreActual = data.month_store_visits || data.monthly_targets?.actual_stores || 0
    return { dailyIndivTarget, dailyStoreTarget, monthIndivTarget, monthStoreTarget, weekIndivTarget, weekIndivActual, monthIndivActual, monthStoreActual }
  }, [data])

  // Memoize data destructuring to reduce repeated property access
  const dataProps = useMemo(() => {
    if (!data) return null
    return {
      today_individual_visits: data.today_individual_visits ?? data.today_visits ?? 0,
      today_store_visits: data.today_store_visits ?? 0,
      month_individual_visits: data.month_individual_visits ?? data.month_visits ?? 0,
      month_store_visits: data.month_store_visits ?? 0,
      recent_visits: data.recent_visits ?? [],
      company_targets: data.company_targets ?? [],
      weekly_targets: data.weekly_targets,
      monthly_targets: data.monthly_targets,
      daily_targets: data.daily_targets,
      week_individual_visits: data.week_individual_visits,
      companies: data.companies ?? [],
    }
  }, [data])

  // Memoize recent visits with thumbnail support
  const recentVisitsWithPhotos = useMemo(() => {
    if (!dataProps?.recent_visits) return []
    return dataProps.recent_visits.map(visit => ({
      ...visit,
      thumbnail_url: visit.thumbnail_url || visit.r2_url || null,
    }))
  }, [dataProps?.recent_visits])

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
      // Load dashboard first (critical data)
      const dashTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Dashboard timeout')), 15000))
      const dashPromise = apiClient.get('/agent/dashboard')
      const dashRes = await Promise.race([dashPromise, dashTimeout])
      const json = (dashRes as any).data
      if (json.success && json.data) {
        setData(json.data)
        setCriticalLoaded(true) // Mark critical data as loaded
        // Show warning if no targets found
        if ((!json.data.daily_targets?.length && !json.data.company_targets?.length) || 
            (!json.data.company_target_rules?.length && !json.data.monthly_targets?.target_visits)) {
          toast.error('No targets found. Please contact your manager to assign you to a company.')
        }
      }
      // Load performance data separately (non-critical, can be lazy-loaded)
      const perfTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Performance timeout')), 15000))
      const perfPromise = apiClient.get('/agent/performance')
      Promise.race([perfPromise, perfTimeout]).then((perfRes: any) => {
        if (perfRes?.data?.success && perfRes?.data?.data) {
          setPerfSummary((perfRes as any).data.data)
        }
      }).catch(() => { /* ignore perf errors */ })
    } catch (err) {
      console.error('Dashboard fetch error:', err)
      toast.error('Failed to load dashboard. Please check your connection.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [navigate])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const handleLogout = useCallback(() => {
    useAuthStore.getState().logout()
    localStorage.removeItem('token')
    navigate('/auth/mobile-login')
  }, [navigate])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  const firstName = authUser?.first_name || (authUser as any)?.firstName || 'Agent'

  if (loading || !criticalLoaded) {
    return (
      <div className="min-h-screen bg-[#06090F] pb-24">
        {/* Header skeleton */}
        <div className="bg-[#0A1628] px-4 py-2 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 bg-gray-700 rounded animate-pulse" />
              <div className="w-16 h-3 bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="flex gap-3">
              <div className="w-4 h-4 bg-gray-700 rounded animate-pulse" />
              <div className="w-4 h-4 bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Greeting skeleton */}
        <div className="px-5 pt-5 pb-3">
          <div className="w-24 h-4 bg-gray-800 rounded animate-pulse mb-2" />
          <div className="w-32 h-7 bg-gray-700 rounded animate-pulse mb-2" />
          <div className="w-40 h-3 bg-gray-800 rounded animate-pulse" />
        </div>

        {/* Stat cards skeleton - 4 cards */}
        <div className="px-5 mb-4">
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-gray-700 rounded-lg animate-pulse" />
                  <div className="w-12 h-3 bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="w-16 h-6 bg-gray-700 rounded animate-pulse mb-1" />
                <div className="w-20 h-3 bg-gray-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Companies skeleton */}
        <div className="px-5 mb-4">
          <div className="w-28 h-4 bg-gray-800 rounded animate-pulse mb-2" />
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex-shrink-0 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                <div className="w-24 h-4 bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Week & Month skeleton */}
        <div className="px-5 mb-4">
          <div className="w-32 h-4 bg-gray-800 rounded animate-pulse mb-2" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="w-20 h-3 bg-gray-700 rounded animate-pulse mb-2" />
                <div className="w-16 h-5 bg-gray-600 rounded animate-pulse mb-2" />
                <div className="w-full h-1.5 bg-gray-700 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Recent visits skeleton */}
        <div className="px-5">
          <div className="w-28 h-4 bg-gray-800 rounded animate-pulse mb-2" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-700 rounded-xl animate-pulse" />
                <div className="flex-1">
                  <div className="w-32 h-4 bg-gray-600 rounded animate-pulse mb-1" />
                  <div className="w-24 h-3 bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
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

      {/* PWA Install Prompt */}
      {showInstallPrompt && (
        <div className="px-5 mb-4">
          <div className="bg-gradient-to-r from-[#00E87B]/10 to-cyan-500/10 border border-[#00E87B]/20 rounded-2xl p-4 relative">
            <button
              onClick={dismissInstall}
              className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00E87B]/20 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-[#00E87B]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Install FieldVibe</p>
                <p className="text-xs text-gray-400">Add to your home screen for quick access</p>
              </div>
            </div>
            <button
              onClick={promptInstall}
              className="mt-3 w-full py-2.5 bg-gradient-to-r from-[#00E87B] to-[#00D06E] text-[#0A1628] font-semibold rounded-xl text-sm active:scale-[0.98] transition-transform"
            >
              Install App
            </button>
          </div>
        </div>
      )}

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

      {/* Performance Messages - Hourly summaries for managers and team leads */}
      {(authUser?.role === 'manager' || authUser?.role === 'team_lead') && (
        <Suspense fallback={
          <div className="px-5 mb-4">
            <div className="bg-gradient-to-r from-[#0A1628] to-[#0E1D35] border border-white/10 rounded-2xl p-4">
              <div className="w-40 h-4 bg-gray-800 rounded animate-pulse mb-3" />
              <div className="space-y-2">
                <div className="w-full h-16 bg-gray-800/50 rounded-xl animate-pulse" />
              </div>
            </div>
          </div>
        }>
          <PerformanceMessages />
        </Suspense>
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

      {/* Rejected Photos KPI */}
      <div className="px-5 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<X className="w-5 h-5" />}
            label="Rejected Photos"
            value={rejectedPhotoCount}
            color="bg-red-500"
          />
          <button
            onClick={() => {
              if (rejectedVisitIds.length === 1) {
                navigate(`/agent/visits/${rejectedVisitIds[0]}`)
              } else {
                navigate('/agent/visits?filter=rejected_photos')
              }
            }}
            className="w-full py-3 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform text-sm"
            disabled={rejectedPhotoLoading || rejectedPhotoCount === 0}
            style={{ opacity: rejectedPhotoCount === 0 ? 0.5 : 1 }}
          >
            <X className="w-4 h-4" />
            {rejectedPhotoLoading ? 'Checking...' : rejectedPhotoCount > 0 ? `View ${rejectedPhotoCount} Rejected` : 'No Rejected Photos'}
          </button>
        </div>
      </div>

      <div className="px-5 mb-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Use memoized target calculations and data props */}
          {targets && dataProps && (
            <>
              <StatCard icon={<MapPin className="w-5 h-5" />} label="Today Individual" value={dataProps.today_individual_visits} target={targets.dailyIndivTarget > 0 ? targets.dailyIndivTarget : undefined} color="bg-blue-500" />
              <StatCard icon={<Store className="w-5 h-5" />} label="Today Store" value={dataProps.today_store_visits} target={targets.dailyStoreTarget > 0 ? targets.dailyStoreTarget : undefined} color="bg-purple-500" />
              <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Month Individual" value={dataProps.month_individual_visits} target={targets.monthIndivTarget > 0 ? targets.monthIndivTarget : undefined} color="bg-emerald-500" />
              <StatCard icon={<Target className="w-5 h-5" />} label="Month Store" value={dataProps.month_store_visits} target={targets.monthStoreTarget > 0 ? targets.monthStoreTarget : undefined} color="bg-amber-500" />
            </>
          )}
        </div>
      </div>

      {/* Performance Section - Lazy loaded for code splitting */}
      {perfSummary && (
        <Suspense fallback={
          <div className="px-5 mb-4">
            <div className="bg-gradient-to-r from-[#0A1628] to-[#0E1D35] border border-white/10 rounded-2xl p-4">
              <div className="w-24 h-4 bg-gray-800 rounded animate-pulse mb-3" />
              <div className="grid grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="text-center">
                    <div className="w-10 h-10 bg-gray-700 rounded animate-pulse mx-auto mb-1" />
                    <div className="w-16 h-3 bg-gray-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        }>
          <PerformanceSection perfSummary={perfSummary} />
        </Suspense>
      )}

      {/* Team Performance - Lazy loaded for code splitting */}
      {perfSummary?.team_performance && (
        <Suspense fallback={
          <div className="px-5 mb-4">
            <div className="bg-gradient-to-r from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30 rounded-2xl p-4">
              <div className="w-32 h-4 bg-gray-700 rounded animate-pulse mb-3" />
              <div className="w-48 h-4 bg-gray-700 rounded animate-pulse mb-3" />
              <div className="grid grid-cols-2 gap-3">
                <div className="w-full h-12 bg-gray-700 rounded animate-pulse" />
                <div className="w-full h-12 bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          </div>
        }>
          <TeamPerformanceSection teamPerformance={perfSummary.team_performance} />
        </Suspense>
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
      {targets && targets.weekIndivTarget + targets.monthIndivTarget + targets.monthStoreTarget > 0 && (
        <div className="px-5 mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Week & Month Progress</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {targets.weekIndivTarget > 0 && (
              <div className={`border rounded-xl p-3 ${targets.weekIndivActual >= targets.weekIndivTarget ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] text-gray-500 uppercase">Week Individual</span>
                </div>
                <p className="text-lg font-bold text-white">{targets.weekIndivActual}<span className="text-sm text-gray-500">/{targets.weekIndivTarget}</span></p>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, Math.round((targets.weekIndivActual / targets.weekIndivTarget) * 100))}%` }} />
                </div>
                {targets.weekIndivActual >= targets.weekIndivTarget && (
                  <p className="text-[8px] text-blue-400 mt-1 font-semibold">✓ Week target met! 🎉</p>
                )}
                {targets.weekIndivActual < targets.weekIndivTarget && targets.weekIndivTarget - targets.weekIndivActual > 0 && (
                  <p className="text-[8px] text-amber-400 mt-1">{targets.weekIndivTarget - targets.weekIndivActual} more to go! 💪</p>
                )}
              </div>
            )}
            {targets.monthIndivTarget > 0 && (
              <div className={`border rounded-xl p-3 ${targets.monthIndivActual >= targets.monthIndivTarget ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-gray-500 uppercase">Month Individual</span>
                </div>
                <p className="text-lg font-bold text-white">{targets.monthIndivActual}<span className="text-sm text-gray-500">/{targets.monthIndivTarget}</span></p>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.round((targets.monthIndivActual / targets.monthIndivTarget) * 100))}%` }} />
                </div>
                {targets.monthIndivActual >= targets.monthIndivTarget && (
                  <p className="text-[8px] text-emerald-400 mt-1 font-semibold">✓ Month target met! 🏆</p>
                )}
                {targets.monthIndivActual < targets.monthIndivTarget && targets.monthIndivTarget - targets.monthIndivActual > 0 && (
                  <p className="text-[8px] text-amber-400 mt-1">{targets.monthIndivTarget - targets.monthIndivActual} more to go! 💪</p>
                )}
              </div>
            )}
            {targets.monthStoreTarget > 0 && (
              <div className={`border rounded-xl p-3 ${targets.monthStoreActual >= targets.monthStoreTarget ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-gray-500 uppercase">Month Store</span>
                </div>
                <p className="text-lg font-bold text-white">{targets.monthStoreActual}<span className="text-sm text-gray-500">/{targets.monthStoreTarget}</span></p>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, Math.round((targets.monthStoreActual / targets.monthStoreTarget) * 100))}%` }} />
                </div>
                {targets.monthStoreActual >= targets.monthStoreTarget && (
                  <p className="text-[8px] text-amber-400 mt-1 font-semibold">✓ Store target met! 🎯</p>
                )}
                {targets.monthStoreActual < targets.monthStoreTarget && targets.monthStoreTarget - targets.monthStoreActual > 0 && (
                  <p className="text-[8px] text-amber-400 mt-1">{targets.monthStoreTarget - targets.monthStoreActual} more to go! 💪</p>
                )}
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
                    <span className="text-[10px] text-gray-500">Individual: {ct.daily_actual_visits}/{ct.daily_target_visits} today</span>
                    <span className="text-[10px] text-gray-500">Store: {ct.daily_actual_stores}/{ct.daily_target_stores}</span>
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
              const isAchieved = visitPct >= 100
              const remaining = Math.max(0, t.target_visits - t.actual_visits)
              return (
                <div key={i} className={`border rounded-xl p-3 ${isAchieved ? 'bg-[#00E87B]/10 border-[#00E87B]/30' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{t.company_name}</span>
                    <span className={'text-xs font-semibold flex items-center gap-1 ' + (visitPct >= 100 ? 'text-[#00E87B]' : visitPct >= 75 ? 'text-amber-400' : 'text-red-400')}>
                      {visitPct}% {isAchieved ? '🎯' : visitPct >= 75 ? '🔥' : ''}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${isAchieved ? 'bg-gradient-to-r from-[#00E87B] to-[#00D06E]' : 'bg-gradient-to-r from-[#00E87B] to-[#00D06E]'}`} style={{ width: `${visitPct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-gray-500">Individual: {t.actual_visits}/{t.target_visits}</span>
                    <span className="text-[10px] text-gray-500">Store: {t.actual_stores}/{t.target_stores}</span>
                  </div>
                  {!isAchieved && remaining > 0 && (
                    <p className="text-[9px] text-amber-400 mt-1.5 flex items-center gap-1">
                      <Target className="w-2.5 h-2.5" /> {remaining} more visit{remaining > 1 ? 's' : ''} to hit target!
                    </p>
                  )}
                  {isAchieved && (
                    <p className="text-[9px] text-[#00E87B] mt-1.5 font-semibold">✓ Target Achieved! Great job! 🎉</p>
                  )}
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
        {recentVisitsWithPhotos && recentVisitsWithPhotos.length > 0 ? (
          <div className="space-y-2">
            {recentVisitsWithPhotos.slice(0, 5).map((visit) => (
              <div key={visit.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                {/* Photo thumbnail or status icon */}
                <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden border border-white/10">
                  {visit.thumbnail_url ? (
                    <img src={visit.thumbnail_url} alt="Visit" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${
                      visit.status === 'completed' ? 'bg-green-500/10' : visit.status === 'in_progress' ? 'bg-blue-500/10' : 'bg-gray-500/10'
                    }`}>
                      {visit.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
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

const StatCard = memo(({ icon, label, value, target, color }: { icon: React.ReactNode; label: string; value: number; target?: number; color: string }) => {
  const showTarget = target != null && target > 0
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${color} text-white`}>{icon}</div>
        {showTarget && (
          <span className={`text-[9px] font-semibold ${value >= target ? 'text-[#00E87B]' : 'text-amber-400'}`}>
            {value}/{target}
          </span>
        )}
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      {showTarget && (
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
          <div className={`h-full rounded-full transition-all ${value >= target ? 'bg-gradient-to-r from-[#00E87B] to-[#00D06E]' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`} style={{ width: `${Math.min(100, Math.round((value / target) * 100))}%` }} />
        </div>
      )}
    </div>
  )
})

StatCard.displayName = 'StatCard'
