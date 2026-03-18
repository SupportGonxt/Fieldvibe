import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, Search } from 'lucide-react'
import { useAuthStore, hasPermission } from '../../store/auth.store'
import { navigation, navigationByCategory } from '../../config/navigation'
import type { NavigationItem } from '../../config/navigation'

export default function MegaMenu() {
  const { user } = useAuthStore()
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | null>(null)

  const isNavItemVisible = (item: NavigationItem) => {
    if (item.requiresRole && user?.role !== item.requiresRole && user?.role !== 'super_admin') {
      return false
    }
    if (!item.permission) return true
    return hasPermission(item.permission)
  }

  const filterNavigation = (items: NavigationItem[]) => {
    return items.filter(item => {
      if (!isNavItemVisible(item)) return false
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = item.name.toLowerCase().includes(query)
        const matchesChildren = item.children?.some(child => 
          child.name.toLowerCase().includes(query) ||
          child.description?.toLowerCase().includes(query)
        )
        return matchesName || matchesChildren
      }
      
      return true
    })
  }

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimerRef.current = window.setTimeout(() => {
      setActiveMenu(null)
    }, 200)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        cancelClose()
        setActiveMenu(null)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelClose()
        setActiveMenu(null)
      }
    }

    const handleResize = () => {
      cancelClose()
      setActiveMenu(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', handleResize)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleResize)
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  const visibleNavigation = filterNavigation(navigation)

  return (
    <div ref={menuRef} className="hidden lg:flex items-center space-x-1">
      {/* Search */}
      <div className="relative mr-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-4 py-2 border border-gray-300 dark:border-night-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 dark:bg-night-100 dark:text-gray-100 dark:placeholder-gray-500"
        />
      </div>

      {/* Main Navigation Items */}
      {Object.entries(navigationByCategory).map(([category, items]) => {
        const visibleItems = items.filter(isNavItemVisible)
        if (visibleItems.length === 0) return null

        return (
          <div key={category} className="relative">
            <button
              onMouseEnter={() => {
                if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                  cancelClose()
                  setActiveMenu(category)
                }
              }}
              onClick={() => {
                cancelClose()
                setActiveMenu(activeMenu === category ? null : category)
              }}
                            className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              activeMenu === category
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-night-100'
                            }`}
              aria-expanded={activeMenu === category}
              aria-haspopup="true"
            >
              <span>{category}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${
                activeMenu === category ? 'rotate-180' : ''
              }`} />
            </button>

            {/* Mega Menu Dropdown */}
            {activeMenu === category && (
              <div
                className="absolute top-full left-0 pt-1 z-[1100]"
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                {/* Hover bridge - invisible element to maintain hover state */}
                <div className="absolute -top-2 left-0 w-full h-3" />
                <div
                  className="bg-white dark:bg-night-50 rounded-2xl shadow-xl border border-gray-100 dark:border-night-100 w-[90vw] max-w-[800px] max-h-[70vh] overflow-y-auto overscroll-contain"
                  onWheelCapture={(e) => e.stopPropagation()}
                >
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-6">
                    {visibleItems.map((item) => (
                      <div key={item.name} className="space-y-2">
                        <NavLink
                          to={item.href}
                          onClick={() => setActiveMenu(null)}
                          className={({ isActive }) =>
                            `flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                              isActive
                                ? 'bg-blue-50 text-blue-700'
                                : 'hover:bg-surface-secondary'
                            }`
                          }
                        >
                          <div className="flex-shrink-0">
                            <item.icon className="h-5 w-5 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">{item.name}</div>
                          </div>
                        </NavLink>

                        {/* Children */}
                        {item.children && item.children.length > 0 && (
                          <div className="ml-11 space-y-1">
                            {item.children
                              .filter(child => !child.permission || hasPermission(child.permission))
                              .map((child) => (
                                <NavLink
                                  key={child.name}
                                  to={child.href}
                                  onClick={() => setActiveMenu(null)}
                                  className={({ isActive }) =>
                                    `block px-3 py-2 rounded-md text-sm transition-colors ${
                                      isActive
                                        ? 'bg-blue-50 text-blue-700 font-medium'
                                        : 'text-gray-600 hover:bg-surface-secondary hover:text-gray-900'
                                    }`
                                  }
                                >
                                  <div className="font-medium">{child.name}</div>
                                  {child.description && (
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {child.description}
                                    </div>
                                  )}
                                </NavLink>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
