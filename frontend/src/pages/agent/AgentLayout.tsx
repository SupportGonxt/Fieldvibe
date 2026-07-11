import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, MapPin, BarChart3, User, Plus, ArrowLeft, Users, Building2, PhoneCall, ClipboardCheck, Wallet, LayoutDashboard, Banknote } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { NotificationCenter } from '../../components/ui/NotificationCenter'
import { apiClient } from '../../services/api.service'
import { ensurePushSubscription } from '../../services/push'
import FirstLoginTour from './FirstLoginTour'

// Poll for a ringing call aimed at this user. Call screens render outside this
// layout, so AgentLayout unmounts during a call and polling pauses on its own.
// Web Push (Phase C) will make ring delivery instant; this is the fallback.
function useIncomingCallPoll() {
  const navigate = useNavigate()
  React.useEffect(() => {
    let active = true
    const tick = async () => {
      try {
        const res = await apiClient.get('/field-ops/calls/incoming')
        const call = res?.data?.call
        if (active && call) {
          navigate('/agent/call/incoming', {
            state: { callId: call.callId, peerName: call.callerName, iceServers: res.data.iceServers },
          })
        }
      } catch { /* offline / transient — try again next tick */ }
    }
    const id = setInterval(tick, 5000)

    // Web Push: subscribe once (best-effort) and route SW notificationclick
    // messages straight to the call screen when the PWA is already open.
    ensurePushSubscription()
    const onSwMessage = (ev: MessageEvent) => {
      const d = ev.data
      if (d?.type === 'incoming_call' && d.callId) {
        navigate('/agent/call/incoming', {
          state: { callId: d.callId, peerName: d.callerName },
        })
      }
    }
    navigator.serviceWorker?.addEventListener('message', onSwMessage)

    return () => {
      active = false
      clearInterval(id)
      navigator.serviceWorker?.removeEventListener('message', onSwMessage)
    }
  }, [navigate])
}

function getTabsForRole(role: string | undefined) {
  const baseTabs = [
    { path: '/agent/dashboard', label: 'Home', icon: Home },
  ]

  if (role === 'team_lead') {
    return [
      ...baseTabs,
      { path: '/agent/visits', label: 'Visits', icon: MapPin },
      { path: '/agent/visits/create', label: 'New', icon: Plus, isCta: true },
      { path: '/agent/team', label: 'Team', icon: Users },
      { path: '/agent/profile', label: 'Profile', icon: User },
    ]
  }

  if (role === 'manager') {
    return [
      ...baseTabs,
      { path: '/agent/teams', label: 'Teams', icon: Building2 },
      { path: '/agent/stats', label: 'Stats', icon: BarChart3 },
      { path: '/agent/profile', label: 'Profile', icon: User },
    ]
  }

  if (role === 'general_manager') {
    return [
      { path: '/agent/overview', label: 'Overview', icon: LayoutDashboard },
      { path: '/agent/pnl', label: 'P&L', icon: Wallet },
      { path: '/agent/stats', label: 'Stats', icon: BarChart3 },
      { path: '/agent/profile', label: 'Profile', icon: User },
    ]
  }

  if (role === 'backoffice_admin') {
    return [
      ...baseTabs,
      { path: '/agent/reconcile', label: 'Reconcile', icon: ClipboardCheck },
      { path: '/agent/deposits', label: 'Deposits', icon: Banknote },
      { path: '/agent/call-list', label: 'Agents', icon: PhoneCall },
      { path: '/agent/profile', label: 'Profile', icon: User },
    ]
  }

  // Default: agent / field_agent / sales_rep
  return [
    ...baseTabs,
    { path: '/agent/visits', label: 'Visits', icon: MapPin },
    { path: '/agent/visits/create', label: 'New', icon: Plus, isCta: true },
    { path: '/agent/stats', label: 'Stats', icon: BarChart3 },
    { path: '/agent/profile', label: 'Profile', icon: User },
  ]
}

function isSubPage(pathname: string): boolean {
  if (pathname === '/agent/visits/create') return true
  if (/^\/agent\/visits\/[^/]+$/.test(pathname)) return true
  if (/^\/agent\/visits\/[^/]+\/edit$/.test(pathname)) return true
  if (pathname === '/agent/onboarding') return true
  if (pathname === '/agent/training') return true
  if (/^\/agent\/agent-detail\/[^/]+$/.test(pathname)) return true
  if (/^\/agent\/team-detail\/[^/]+$/.test(pathname)) return true
  return false
}

// Returns a fixed back path, or null to indicate navigate(-1) should be used
function getBackPath(pathname: string): string | null {
  if (pathname === '/agent/visits/create') return '/agent/visits'
  if (/^\/agent\/visits\/[^/]+/.test(pathname)) return '/agent/visits'
  if (pathname === '/agent/onboarding') return '/agent/dashboard'
  if (pathname === '/agent/training') return '/agent/dashboard'
  // Drill-down pages: use browser history so managers go back to team-detail
  // and team leads go back to team tab correctly
  if (/^\/agent\/agent-detail\/[^/]+$/.test(pathname)) return null
  if (/^\/agent\/team-detail\/[^/]+$/.test(pathname)) return null
  return '/agent/dashboard'
}

function getSubPageTitle(pathname: string): string {
  if (pathname === '/agent/visits/create') return 'New Visit'
  if (/^\/agent\/visits\/[^/]+\/edit$/.test(pathname)) return 'Edit Visit'
  if (/^\/agent\/visits\/[^/]+$/.test(pathname)) return 'Visit Details'
  if (pathname === '/agent/onboarding') return 'Getting Started'
  if (pathname === '/agent/training') return 'Training Guide'
  if (/^\/agent\/agent-detail\/[^/]+$/.test(pathname)) return 'Agent Details'
  if (/^\/agent\/team-detail\/[^/]+$/.test(pathname)) return 'Team Details'
  return ''
}

export default function AgentLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const tabs = getTabsForRole(user?.role)
  const onSubPage = isSubPage(location.pathname)
  useIncomingCallPoll()

  return (
    <div className="min-h-screen bg-[#06090F] flex flex-col">
      <FirstLoginTour />

      {/* Sub-page header with back button */}
      {onSubPage && (
        <div className="sticky top-0 z-40 bg-[#0A1628]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              const backPath = getBackPath(location.pathname)
              if (backPath) { navigate(backPath) } else { navigate(-1) }
            }}
            className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-semibold text-white">{getSubPageTitle(location.pathname)}</h1>
        </div>
      )}

      {/* Notification bell — main pages only (sub-pages have their own header) */}
      {!onSubPage && (
        <div className="fixed top-3 right-3 z-40">
          <NotificationCenter />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>

      {/* Bottom Navigation - hidden on sub-pages */}
      {!onSubPage && (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0A1628]/95 backdrop-blur-xl border-t border-white/5 px-2 pb-[env(safe-area-inset-bottom)] z-50">
          <div className="max-w-md mx-auto flex items-end justify-around py-1">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path || (tab.path === '/agent/dashboard' && location.pathname === '/agent')
              const Icon = tab.icon

              if ('isCta' in tab && tab.isCta) {
                return (
                  <button
                    key={tab.path}
                    data-tour={tab.path}
                    data-tour-label={tab.label}
                    onClick={() => navigate(tab.path)}
                    className="flex flex-col items-center -mt-5"
                  >
                    <div className="w-14 h-14 bg-gradient-to-br from-[#00E87B] to-[#00D06E] rounded-2xl flex items-center justify-center shadow-lg shadow-[#00E87B]/30 active:scale-95 transition-transform">
                      <Icon className="w-6 h-6 text-[#0A1628]" />
                    </div>
                    <span className="text-[10px] text-[#00E87B] mt-1 font-medium">{tab.label}</span>
                  </button>
                )
              }

              return (
                <button
                  key={tab.path}
                  data-tour={tab.path}
                  data-tour-label={tab.label}
                  onClick={() => navigate(tab.path)}
                  className={`flex flex-col items-center py-2 px-3 transition-colors ${
                    isActive ? 'text-[#00E87B]' : 'text-gray-600'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#00E87B]' : 'text-gray-600'}`} />
                  <span className={`text-[10px] mt-1 ${isActive ? 'font-semibold text-[#00E87B]' : 'text-gray-600'}`}>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
