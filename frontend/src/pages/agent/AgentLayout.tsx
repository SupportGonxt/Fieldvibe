import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, MapPin, BarChart3, User, Plus } from 'lucide-react'

const tabs = [
  { path: '/agent/dashboard', label: 'Home', icon: Home },
  { path: '/agent/visits', label: 'Visits', icon: MapPin },
  { path: '/field-operations/visits/create', label: 'New', icon: Plus, isCta: true },
  { path: '/agent/stats', label: 'Stats', icon: BarChart3 },
  { path: '/agent/profile', label: 'Profile', icon: User },
]

export default function AgentLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#06090F] flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0A1628]/95 backdrop-blur-xl border-t border-white/5 px-2 pb-[env(safe-area-inset-bottom)] z-50">
        <div className="max-w-md mx-auto flex items-end justify-around py-1">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path || (tab.path === '/agent/dashboard' && location.pathname === '/agent')
            const Icon = tab.icon

            if (tab.isCta) {
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
    </div>
  )
}
