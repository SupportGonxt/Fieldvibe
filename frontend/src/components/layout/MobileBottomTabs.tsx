import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, MapPin, ShoppingCart, Users, MoreHorizontal, Package, DollarSign, Megaphone } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { roleAllows, canSeeMoney } from '../../lib/capabilities'

type TabDef = { path: string; icon: React.ComponentType<any>; label: string; can?: (role: string) => boolean }

// Tab visibility derives from capabilities.ts so a tab only shows when the route
// behind it lets the role in: /finance/* is requiredRole="admin" (canSeeMoney),
// /inventory + /marketing are requiredRole="manager" (roleAllows). The old
// hand-rolled MGMT array disagreed with the route gates and gave `manager` —
// a FIELD role, counts-only, never rand — a dead-end Finance tab.
const allTabs: TabDef[] = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { path: '/field-operations', icon: MapPin, label: 'Field', can: (r) => roleAllows(r, ['manager', 'field_agent', 'team_lead', 'agent']) },
  { path: '/sales', icon: ShoppingCart, label: 'Sales', can: (r) => roleAllows(r, ['manager', 'sales_rep', 'agent']) },
  { path: '/customers', icon: Users, label: 'Customers' },
  { path: '/inventory', icon: Package, label: 'Stock', can: (r) => roleAllows(r, ['manager']) },
  { path: '/finance', icon: DollarSign, label: 'Finance', can: canSeeMoney },
  { path: '/marketing', icon: Megaphone, label: 'Marketing', can: (r) => roleAllows(r, ['manager']) },
  { path: '/more', icon: MoreHorizontal, label: 'More' },
]

// Pure so it's testable: max 5 tabs, More always kept.
export function visibleTabsForRole(role: string): TabDef[] {
  const tabs = allTabs.filter((tab) => !tab.can || tab.can(role)).slice(0, 5)
  const moreDef = allTabs[allTabs.length - 1]
  if (!tabs.includes(moreDef)) {
    if (tabs.length === 5) tabs[4] = moreDef
    else tabs.push(moreDef)
  }
  return tabs
}

export default function MobileBottomTabs() {
  const location = useLocation()
  const navigate = useNavigate()

  // Read the real role from the auth store — the old code read a non-existent
  // localStorage key ('fieldvibe_user'), so role never resolved and every user
  // silently defaulted to admin and saw all tabs.
  const userRole = useAuthStore((s) => s.user)?.role || 'admin'

  // GM/backoffice_admin are admin-equivalent inside roleAllows/canSeeMoney, so
  // they see every module, matching the desktop console (#253).
  const visibleTabs = visibleTabsForRole(userRole)

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white dark:bg-surface border-t border-gray-200 dark:border-white/10 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {visibleTabs.map((tab) => {
          const active = isActive(tab.path)
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active ? 'text-primary' : 'text-gray-500'
              }`}
            >
              <tab.icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
              {active && (
                <div className="absolute top-0 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
