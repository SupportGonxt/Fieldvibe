import { useState } from 'react'
import { Menu, Bell, Search, User, LogOut, Settings } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import MegaMenu from './MegaMenu'
import ThemeToggle from '../ui/ThemeToggle'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="sticky top-0 z-[1000] flex-shrink-0 flex h-16 bg-white dark:bg-night-50 border-b border-gray-100 dark:border-night-100">
      {/* Mobile menu button */}
      <button
        type="button"
        className="px-4 border-r border-gray-100 dark:border-night-100 text-gray-500 hover:text-gray-700 hover:bg-surface-secondary dark:hover:bg-night-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden transition-colors"
        onClick={onMenuClick}
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Logo on desktop */}
      <div className="hidden lg:flex items-center px-6 border-r border-gray-100 dark:border-night-100">
        <img src="/fieldvibe-logo.svg" alt="FieldVibe" className="h-8" />
      </div>

      {/* Mega Menu - Desktop only */}
      <MegaMenu />

      <div className="flex-1 px-4 flex justify-end">
        {/* Search - hidden on lg where MegaMenu has its own search */}
        <div className="flex-1 flex lg:hidden">
          <div className="w-full flex md:ml-0">
            <label htmlFor="search-field" className="sr-only">
              Search
            </label>
            <div className="relative w-full text-gray-400 focus-within:text-gray-600">
              <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                <Search className="h-5 w-5" />
              </div>
              <input
                id="search-field"
                className="block w-full h-full pl-8 pr-3 py-2 border-transparent text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-0 focus:border-transparent"
                placeholder="Search customers, orders, products..."
                type="search"
              />
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="ml-4 flex items-center md:ml-6 flex-shrink-0">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <div className="relative ml-2">
            <button
              type="button"
              className="relative p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-night-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5" />
              {/* Notification badge */}
              <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center ring-2 ring-white">
                <span className="text-[10px] font-medium text-white">3</span>
              </span>
            </button>

            {/* Notifications dropdown */}
            {showNotifications && (
              <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-2xl shadow-dropdown bg-white border border-gray-100 focus:outline-none overflow-hidden">
                <div className="py-1">
                  <div className="px-4 py-2 text-sm font-medium text-gray-900 border-b border-gray-100">
                    Notifications
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-100">
                    <div className="font-medium">New board placement</div>
                    <div className="text-gray-500">John Doe placed a premium billboard</div>
                    <div className="text-xs text-gray-400 mt-1">2 minutes ago</div>
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-100">
                    <div className="font-medium">Product distribution completed</div>
                    <div className="text-gray-500">Jane Smith completed delivery to ABC Store</div>
                    <div className="text-xs text-gray-400 mt-1">15 minutes ago</div>
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-100">
                    <div className="font-medium">Low inventory alert</div>
                    <div className="text-gray-500">Premium Widget A is running low</div>
                    <div className="text-xs text-gray-400 mt-1">1 hour ago</div>
                  </div>
                  <div className="px-4 py-2 text-center border-t border-gray-100">
                    <button className="text-sm text-primary-600 hover:text-primary-500">
                      View all notifications
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <div className="ml-3 relative">
            <div>
              <button
                type="button"
                className="flex items-center space-x-3 p-1.5 rounded-xl hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="h-9 w-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-sm">
                  <span className="text-sm font-semibold text-white">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.first_name} {user?.last_name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role || 'User'}</div>
                </div>
              </button>
            </div>

            {/* User menu dropdown */}
            {showUserMenu && (
              <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-2xl shadow-dropdown bg-white border border-gray-100 focus:outline-none overflow-hidden">
                <div className="py-1">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                    <div className="font-medium">{user?.first_name} {user?.last_name}</div>
                    <div className="text-gray-500">{user?.email}</div>
                  </div>
                  
                  <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <User className="mr-3 h-4 w-4" />
                    Profile Settings
                  </button>
                  
                  <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <Settings className="mr-3 h-4 w-4" />
                    Preferences
                  </button>
                  
                  <div className="border-t border-gray-100">
                    <button 
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
