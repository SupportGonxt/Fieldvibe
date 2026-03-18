import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, MapPin, ShoppingCart, Users, MoreHorizontal } from 'lucide-react'

const tabs = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { path: '/field-operations', icon: MapPin, label: 'Field' },
  { path: '/sales', icon: ShoppingCart, label: 'Sales' },
  { path: '/customers', icon: Users, label: 'Customers' },
  { path: '/more', icon: MoreHorizontal, label: 'More' },
]

export default function MobileBottomTabs() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[#0A0E18] border-t border-white/10 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.path)
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active ? 'text-[#00E87B]' : 'text-gray-500'
              }`}
            >
              <tab.icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
              {active && (
                <div className="absolute top-0 w-8 h-0.5 bg-[#00E87B] rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
