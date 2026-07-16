import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, MapPin, BarChart3, User, Plus, ArrowLeft, Users, Building2, PhoneCall, ClipboardCheck, Wallet, LayoutDashboard, Banknote } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { NotificationCenter } from '../../components/ui/NotificationCenter'
import OfflineIndicator from '../../components/OfflineIndicator'
import { ensurePushSubscription } from '../../services/push'
import FirstLoginTour from './FirstLoginTour'
import { usePresenceHeartbeat } from '../../hooks/usePresenceHeartbeat'
import PresenceConsentNotice from '../../components/PresenceConsentNotice'
import PageErrorBoundary from '../../components/ui/PageErrorBoundary'

// Ring delivery is Web Push only (push-sw.js notification + SW message below).
// The old 5s /calls/incoming poll is gone: a ringing row stays live for up to
// 60s, so backing out of the call screen remounted this layout and the next
// tick force-navigated straight back — a visible flash loop on every field
// device, plus a constant network drain the field teams don't need.
function useIncomingCallPush() {
  const navigate = useNavigate()
  React.useEffect(() => {
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
    return () => navigator.serviceWorker?.removeEventListener('message', onSwMessage)
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
      // Team leads sell too — own targets/earnings via StatsForRole → AgentStats
      { path: '/agent/stats', label: 'Stats', icon: BarChart3 },
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
      { path: '/agent/teams', label: 'Team', icon: Users },
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
      { path: '/agent/stats', label: 'Stats', icon: BarChart3 },
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
  if (pathname === '/agent/pin-management') return true
  if (/^\/agent\/agent-detail\/[^/]+$/.test(pathname)) return true
  if (/^\/agent\/team-detail\/[^/]+$/.test(pathname)) return true
  if (/^\/agent\/customer-edit\/[^/]+$/.test(pathname)) return true
  return false
}

// Returns a fixed back path, or null to indicate navigate(-1) should be used
function getBackPath(pathname: string): string | null {
  if (pathname === '/agent/visits/create') return '/agent/visits'
  if (/^\/agent\/visits\/[^/]+/.test(pathname)) return '/agent/visits'
  if (pathname === '/agent/onboarding') return '/agent/dashboard'
  if (pathname === '/agent/training') return '/agent/dashboard'
  // BO PWA tool, entered from the Agents tab
  if (pathname === '/agent/pin-management') return '/agent/call-list'
  // Drill-down pages: use browser history so managers go back to team-detail
  // and team leads go back to team tab correctly
  if (/^\/agent\/agent-detail\/[^/]+$/.test(pathname)) return null
  if (/^\/agent\/team-detail\/[^/]+$/.test(pathname)) return null
  // Corrective-edit loop: entered from upload-failures rows — history back returns there
  if (/^\/agent\/customer-edit\/[^/]+$/.test(pathname)) return null
  return '/agent/dashboard'
}

function getSubPageTitle(pathname: string): string {
  if (pathname === '/agent/visits/create') return 'New Visit'
  if (/^\/agent\/visits\/[^/]+\/edit$/.test(pathname)) return 'Edit Visit'
  if (/^\/agent\/visits\/[^/]+$/.test(pathname)) return 'Visit Details'
  if (pathname === '/agent/onboarding') return 'Getting Started'
  if (pathname === '/agent/training') return 'Training Guide'
  if (pathname === '/agent/pin-management') return 'Agent PINs'
  if (/^\/agent\/agent-detail\/[^/]+$/.test(pathname)) return 'Agent Details'
  if (/^\/agent\/team-detail\/[^/]+$/.test(pathname)) return 'Team Details'
  if (/^\/agent\/customer-edit\/[^/]+$/.test(pathname)) return 'Edit Customer'
  return ''
}

export default function AgentLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const tabs = getTabsForRole(user?.role)
  const onSubPage = isSubPage(location.pathname)
  useIncomingCallPush()
  usePresenceHeartbeat(user?.role)

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <FirstLoginTour />
      <PresenceConsentNotice role={user?.role} />

      {/* Sub-page header with back button */}
      {onSubPage && (
        <div className="sticky top-0 z-40 bg-surface/95 backdrop-blur-xl border-b border-token px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              const backPath = getBackPath(location.pathname)
              if (backPath) { navigate(backPath) } else { navigate(-1) }
            }}
            className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-token" />
          </button>
          <h1 className="text-lg font-semibold text-token">{getSubPageTitle(location.pathname)}</h1>
        </div>
      )}

      {/* Notification bell + offline pill — main pages only (sub-pages have their own header) */}
      {!onSubPage && (
        <div className="fixed top-3 right-3 z-40 flex items-center gap-2">
          <OfflineIndicator />
          <NotificationCenter />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Contain a crashing page to this pane so the nav chrome survives and
            the user can move to another tab. Keyed by path: boundary state
            doesn't reset on navigation, so without the key one crashed page
            would keep every tab stuck on the error card. */}
        <PageErrorBoundary key={location.pathname} pageName="this screen">
          <Outlet />
        </PageErrorBoundary>
      </div>

      {/* Bottom Navigation - hidden on sub-pages */}
      {!onSubPage && (
        <nav className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-token px-2 pb-[env(safe-area-inset-bottom)] z-50">
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
                    <div className="w-14 h-14 bg-gradient-to-br from-primary to-[#00D06E] rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform">
                      <Icon className="w-6 h-6 text-on-primary" />
                    </div>
                    <span className="text-[10px] text-primary mt-1 font-medium">{tab.label}</span>
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
                    isActive ? 'text-primary' : 'text-gray-600'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-gray-600'}`} />
                  <span className={`text-[10px] mt-1 ${isActive ? 'font-semibold text-primary' : 'text-gray-600'}`}>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
