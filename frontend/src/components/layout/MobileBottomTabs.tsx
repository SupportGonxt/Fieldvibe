import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, MapPin, ShoppingCart, Users, MoreHorizontal, Package, DollarSign, Megaphone } from 'lucide-react'

type TabDef = { path: string; icon: React.ComponentType<any>; label: string; roles?: string[] }

// MOB-02: Role-aware bottom tabs
const allTabs: TabDef[] = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { path: '/field-operations', icon: MapPin, label: 'Field', roles: ['admin', 'super_admin', 'manager', 'field_agent', 'team_leader'] },
  { path: '/sales', icon: ShoppingCart, label: 'Sales', roles: ['admin', 'super_admin', 'manager', 'sales'] },
  { path: '/customers', icon: Users, label: 'Customers' },
  { path: '/inventory', icon: Package, label: 'Stock', roles: ['admin', 'super_admin', 'manager', 'warehouse'] },
  { path: '/finance', icon: DollarSign, label: 'Finance', roles: ['admin', 'super_admin', 'manager', 'finance'] },
  { path: '/marketing', icon: Megaphone, label: 'Marketing', roles: ['admin', 'super_admin', 'manager', 'marketing'] },
  { path: '/more', icon: MoreHorizontal, label: 'More' },
]

export default function MobileBottomTabs() {
  const location = useLocation()
  const navigate = useNavigate()

  let userRole = 'admin'
  try {
    const userStr = localStorage.getItem('fieldvibe_user')
    if (userStr) userRole = JSON.parse(userStr).role || 'admin'
  } catch { /* malformed localStorage - default to admin */ }

  // Filter tabs by role - show max 5 tabs on mobile
  const visibleTabs = allTabs
    .filter(tab => !tab.roles || tab.roles.includes(userRole))
    .slice(0, 5)

  // Always ensure More tab is included
  const moreDef = allTabs.find(t => t.path === '/more')!
  if (visibleTabs.length === 5 && !visibleTabs.find(t => t.path === '/more')) {
    visibleTabs[4] = moreDef
  } else if (!visibleTabs.find(t => t.path === '/more')) {
    visibleTabs.push(moreDef)
  }

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white dark:bg-[#0A0E18] border-t border-gray-200 dark:border-white/10 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {visibleTabs.map((tab) => {
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
