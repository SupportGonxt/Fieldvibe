import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeft } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { navigation, navigationBySection } from '../../config/navigation'
import type { NavigationItem } from '../../config/navigation'

interface SidebarProps {
  onNavigate?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function Sidebar({ onNavigate, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user } = useAuthStore()
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleExpand = (name: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const isItemActive = (item: NavigationItem) => {
    if (location.pathname === item.href) return true
    if (item.children?.some(c => location.pathname.startsWith(c.href))) return true
    return location.pathname.startsWith(item.href + '/')
  }

  const isNavItemVisible = (item: NavigationItem) => {
    if (item.requiresRole && user?.role !== item.requiresRole && user?.role !== 'super_admin') return false
    return true
  }

  const sectionLabels: Record<string, string> = {
    Core: 'CORE',
    Operations: 'OPERATIONS',
    Commercial: 'COMMERCIAL',
    Platform: 'PLATFORM',
  }

  return (
    <div className={`flex flex-col h-full bg-[#0A0E18] text-gray-300 transition-all duration-200 ${collapsed ? 'w-[60px]' : 'w-[240px]'}`}>
      {/* Logo */}
      <div className="flex items-center h-16 flex-shrink-0 px-3 border-b border-white/5">
        {collapsed ? (
          <img src="/fieldvibe-icon.svg" alt="FV" className="h-8 w-8 mx-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <img src="/fieldvibe-logo.svg" alt="FieldVibe" className="h-9" />
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2">
        {Object.entries(navigationBySection).map(([section, items]) => {
          const visibleItems = items.filter(isNavItemVisible)
          if (visibleItems.length === 0) return null

          return (
            <div key={section} className="mb-1">
              {/* Section label */}
              {!collapsed && (
                <div className="px-4 py-2 mt-2 first:mt-0">
                  <span className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase">
                    {sectionLabels[section] || section}
                  </span>
                </div>
              )}
              {collapsed && <div className="border-t border-white/5 mx-2 my-1" />}

              {/* Items */}
              {visibleItems.map((item) => {
                const active = isItemActive(item)
                const expanded = expandedItems.has(item.name) || active
                const hasChildren = item.children && item.children.length > 0

                return (
                  <div key={item.name}>
                    <div className="px-2">
                      {hasChildren && !collapsed ? (
                        <button
                          onClick={() => toggleExpand(item.name)}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                            active
                              ? 'bg-[#00E87B]/10 text-[#00E87B]'
                              : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                          }`}
                        >
                          <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                          <span className="flex-1 text-left truncate">{item.name}</span>
                          {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                          )}
                        </button>
                      ) : (
                        <NavLink
                          to={item.href}
                          onClick={onNavigate}
                          title={collapsed ? item.name : undefined}
                          className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                            active
                              ? 'bg-[#00E87B]/10 text-[#00E87B]'
                              : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                          } ${collapsed ? 'justify-center' : ''}`}
                        >
                          <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                          {!collapsed && <span className="truncate">{item.name}</span>}
                        </NavLink>
                      )}
                    </div>

                    {/* Children */}
                    {hasChildren && expanded && !collapsed && (
                      <div className="ml-4 mr-2 mt-0.5 mb-1 space-y-0.5">
                        {item.children!.map((child) => (
                          <NavLink
                            key={child.name}
                            to={child.href}
                            onClick={onNavigate}
                            className={({ isActive }) =>
                              `flex items-center pl-6 pr-2 py-1.5 rounded-md text-[13px] transition-colors ${
                                isActive
                                  ? 'text-[#00E87B] bg-[#00E87B]/5 font-medium'
                                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                              }`
                            }
                          >
                            <span className="truncate">{child.name}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Collapse toggle */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center h-10 border-t border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      )}

      {/* User info */}
      {!collapsed && (
        <div className="flex-shrink-0 border-t border-white/5 p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#00E87B]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-[#00E87B]">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-[#00E87B]" />
                <p className="text-[11px] text-gray-500 capitalize truncate">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="flex-shrink-0 border-t border-white/5 p-2 flex justify-center">
          <div className="h-8 w-8 rounded-lg bg-[#00E87B]/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-[#00E87B]">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
