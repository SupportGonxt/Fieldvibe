import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, MapPin, ShoppingCart, Users, MoreHorizontal, Package, DollarSign, Megaphone } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'

type TabDef = { path: string; icon: React.ComponentType<any>; label: string; roles?: string[] }

// Management roles that see every business module. The dedicated field roles
// (field_agent/sales_rep/team_lead/agent) live in the /agent PWA, but are listed
// on the tabs relevant to them for the rare time they land in the office shell.
const MGMT = ['admin', 'super_admin', 'manager', 'general_manager', 'backoffice_admin']

// MOB-02: Role-aware bottom tabs. roles use the real auth union
// (src/types/auth.types.ts) — the old vocab (team_leader/sales/warehouse/
// finance/marketing) never matched it, so gating was dead.
const allTabs: TabDef[] = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { path: '/field-operations', icon: MapPin, label: 'Field', roles: [...MGMT, 'field_agent', 'team_lead', 'agent'] },
  { path: '/sales', icon: ShoppingCart, label: 'Sales', roles: [...MGMT, 'sales_rep', 'agent'] },
  { path: '/customers', icon: Users, label: 'Customers' },
  { path: '/inventory', icon: Package, label: 'Stock', roles: [...MGMT] },
  { path: '/finance', icon: DollarSign, label: 'Finance', roles: [...MGMT, 'backoffice_admin'] },
  { path: '/marketing', icon: Megaphone, label: 'Marketing', roles: [...MGMT] },
  { path: '/more', icon: MoreHorizontal, label: 'More' },
]

export default function MobileBottomTabs() {
  const location = useLocation()
  const navigate = useNavigate()

  // Read the real role from the auth store — the old code read a non-existent
  // localStorage key ('fieldvibe_user'), so role never resolved and every user
  // silently defaulted to admin and saw all tabs.
  const userRole = useAuthStore((s) => s.user)?.role || 'admin'

  // Filter tabs by role - show max 5 tabs on mobile. GM is admin-equivalent
  // (in MGMT), so it falls through to normal filtering and sees every module,
  // matching the desktop console (#253).
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
