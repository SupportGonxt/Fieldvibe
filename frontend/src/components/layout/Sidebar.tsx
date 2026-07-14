import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeft } from 'lucide-react'
import { useAuthStore, hasPermission, hasRole } from '../../store/auth.store'
import { navigation, navigationBySection } from '../../config/navigation'
import type { NavigationItem, NavigationChild } from '../../config/navigation'

interface SidebarProps {
  onNavigate?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function Sidebar({ onNavigate, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user } = useAuthStore()
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleExpand = (name: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const isItemActive = (item: NavigationItem) => {
    if (location.pathname === item.href) return true
    if (item.children?.some(c => location.pathname.startsWith(c.href))) return true
    return location.pathname.startsWith(item.href + '/')
  }

  const isNavItemVisible = (item: NavigationItem) => {
    // hasRole encodes admin-equivalence (backoffice_admin & general_manager ⇒ admin,
    // super_admin ⇒ all). GM/BO admin get full office-console module access this way.
    if (item.requiresRole && !hasRole(item.requiresRole)) return false
    // If item has a permission requirement, check it
    if (item.permission && !hasPermission(item.permission)) return false
    return true
  }

  const isChildVisible = (child: NavigationChild) => {
    // requiresRole on money-surface children (invoices, payments, commissions):
    // field roles are counts-only; hasRole('admin') covers admin-equivalents.
    if (child.requiresRole && !hasRole(child.requiresRole)) return false
    if (child.permission && !hasPermission(child.permission)) return false
    return true
  }

  const sectionLabels: Record<string, string> = {
    Core: 'CORE',
    Operations: 'OPERATIONS',
    Commercial: 'COMMERCIAL',
    Platform: 'PLATFORM',
  }

  return (
    <div className={`flex flex-col h-full bg-surface text-token-muted transition-all duration-200 ${collapsed ? 'w-[60px]' : 'w-[240px]'}`}>
      {/* Logo */}
      <div className="flex items-center h-16 flex-shrink-0 px-3 border-b border-token">
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
                  <span className="text-[10px] font-semibold tracking-widest text-token-faint uppercase">
                    {sectionLabels[section] || section}
                  </span>
                </div>
              )}
              {collapsed && <div className="border-t border-token mx-2 my-1" />}

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
                              ? 'bg-primary/10 text-primary'
                              : 'text-token-muted hover:bg-white/5 hover:text-token'
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
                              ? 'bg-primary/10 text-primary'
                              : 'text-token-muted hover:bg-white/5 hover:text-token'
                          } ${collapsed ? 'justify-center' : ''}`}
                        >
                          <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                          {!collapsed && <span className="truncate">{item.name}</span>}
                        </NavLink>
                      )}
                    </div>

                    {/* Children */}
                    {hasChildren && expanded && !collapsed && (() => {
                      const children = item.children!.filter(isChildVisible)
                      const hasGroups = children.some(c => c.group)

                      if (!hasGroups) {
                        return (
                          <div className="ml-4 mr-2 mt-0.5 mb-1 space-y-0.5">
                            {children.map((child) => (
                              <NavLink
                                key={child.name}
                                to={child.href}
                                onClick={onNavigate}
                                className={({ isActive }) =>
                                  `flex items-center pl-6 pr-2 py-1.5 rounded-md text-[13px] transition-colors ${
                                    isActive
                                      ? 'text-primary bg-primary/5 font-medium'
                                      : 'text-token-faint hover:text-token-muted hover:bg-white/5'
                                  }`
                                }
                              >
                                <span className="truncate">{child.name}</span>
                              </NavLink>
                            ))}
                          </div>
                        )
                      }

                      // Group children by group name (filtered by permissions)
                      const groups: Record<string, typeof children> = {}
                      children.forEach(c => {
                        const g = c.group || 'Other'
                        if (!groups[g]) groups[g] = []
                        groups[g].push(c)
                      })

                      return (
                        <div className="ml-4 mr-2 mt-0.5 mb-1">
                          {Object.entries(groups).map(([groupName, groupChildren]) => {
                            const groupExpanded = expandedGroups.has(`${item.name}:${groupName}`)
                            const groupActive = groupChildren.some(c => location.pathname.startsWith(c.href))

                            return (
                              <div key={groupName} className="mb-0.5">
                                <button
                                  onClick={() => toggleGroup(`${item.name}:${groupName}`)}
                                  className={`w-full flex items-center gap-1 pl-5 pr-2 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                                    groupActive
                                      ? 'text-primary/70'
                                      : 'text-gray-600 hover:text-token-muted'
                                  }`}
                                >
                                  {groupExpanded || groupActive ? (
                                    <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-60" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-60" />
                                  )}
                                  <span>{groupName}</span>
                                </button>
                                {(groupExpanded || groupActive) && (
                                  <div className="space-y-0.5">
                                    {groupChildren.map((child) => (
                                      <NavLink
                                        key={child.name}
                                        to={child.href}
                                        onClick={onNavigate}
                                        className={({ isActive }) =>
                                          `flex items-center pl-9 pr-2 py-1.5 rounded-md text-[13px] transition-colors ${
                                            isActive
                                              ? 'text-primary bg-primary/5 font-medium'
                                              : 'text-token-faint hover:text-token-muted hover:bg-white/5'
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
                    })()}
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
          className="hidden lg:flex items-center justify-center h-10 border-t border-token text-token-faint hover:text-token-muted hover:bg-white/5 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      )}

      {/* User info */}
      {!collapsed && (
        <div className="flex-shrink-0 border-t border-token p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-token truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <p className="text-[11px] text-token-faint capitalize truncate">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="flex-shrink-0 border-t border-token p-2 flex justify-center">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-primary">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
