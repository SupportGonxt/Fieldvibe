import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, MapPin, BarChart3, User, Plus, ArrowLeft, Users, Building2 } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'

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
  return false
}

function getBackPath(pathname: string): string {
  if (pathname === '/agent/visits/create') return '/agent/visits'
  if (/^\/agent\/visits\/[^/]+/.test(pathname)) return '/agent/visits'
  if (pathname === '/agent/onboarding') return '/agent/dashboard'
  if (pathname === '/agent/training') return '/agent/dashboard'
  return '/agent/dashboard'
}

function getSubPageTitle(pathname: string): string {
  if (pathname === '/agent/visits/create') return 'New Visit'
  if (/^\/agent\/visits\/[^/]+\/edit$/.test(pathname)) return 'Edit Visit'
  if (/^\/agent\/visits\/[^/]+$/.test(pathname)) return 'Visit Details'
  if (pathname === '/agent/onboarding') return 'Getting Started'
  if (pathname === '/agent/training') return 'Training Guide'
  return ''
}

export default function AgentLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const tabs = getTabsForRole(user?.role)
  const onSubPage = isSubPage(location.pathname)

  return (
    <div className="min-h-screen bg-[#06090F] flex flex-col">
      {/* Sub-page header with back button */}
      {onSubPage && (
        <div className="sticky top-0 z-40 bg-[#0A1628]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(getBackPath(location.pathname))}
            className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-semibold text-white">{getSubPageTitle(location.pathname)}</h1>
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
