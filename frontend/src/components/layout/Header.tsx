import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, User, LogOut, Settings, Command } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import ThemeToggle from '../ui/ThemeToggle'
import { NotificationCenter } from '../ui/NotificationCenter'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => { logout() }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(prev => !prev)
        setTimeout(() => searchRef.current?.focus(), 100)
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false)
        setShowUserMenu(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const commandItems = [
    { label: 'Go to Dashboard', action: () => navigate('/dashboard') },
    { label: 'Go to Insights', action: () => navigate('/insights') },
    { label: 'Go to Sales Orders', action: () => navigate('/sales/orders') },
    { label: 'Go to Customers', action: () => navigate('/customers') },
    { label: 'Go to Van Sales', action: () => navigate('/van-sales') },
    { label: 'Go to Inventory', action: () => navigate('/inventory') },
    { label: 'Go to Field Operations', action: () => navigate('/field-operations') },
    { label: 'Go to Finance', action: () => navigate('/finance') },
    { label: 'Go to Marketing', action: () => navigate('/marketing') },
    { label: 'Go to Admin', action: () => navigate('/admin') },
    { label: 'Create New Order', action: () => navigate('/sales/orders/create') },
    { label: 'Create New Visit', action: () => navigate('/field-operations/visits/create') },
    { label: 'View Reports', action: () => navigate('/reports') },
  ]

  const filteredCommands = searchQuery
    ? commandItems.filter(c => c.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : commandItems

  return (
    <>
      <div className="sticky top-0 z-[1000] flex-shrink-0 flex items-center h-14 bg-white/80 dark:bg-[#0A0E18]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5">
        <button
          type="button"
          className="px-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white lg:hidden transition-colors"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex-1 flex items-center px-4">
          <button
            onClick={() => { setShowCommandPalette(true); setTimeout(() => searchRef.current?.focus(), 100) }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-sm max-w-sm w-full"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-200 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-[10px] font-mono text-gray-500">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-1 px-4">
          <ThemeToggle />

          {/* ENH-10: Real-time NotificationCenter */}
          <NotificationCenter />

          <div className="relative ml-1" ref={userMenuRef}>
            <button
              type="button"
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="h-8 w-8 bg-gradient-to-br from-[#00E87B] to-[#00B862] rounded-lg flex items-center justify-center">
                <span className="text-xs font-bold text-[#06090F]">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.first_name} {user?.last_name}</div>
                <div className="text-[11px] text-gray-500 capitalize">{user?.role || 'User'}</div>
              </div>
            </button>

            {showUserMenu && (
              <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#0A0E18] border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-200">{user?.first_name} {user?.last_name}</div>
                  <div className="text-xs text-gray-500">{user?.email}</div>
                </div>
                <div className="py-1">
                  <button className="flex items-center w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <User className="mr-3 h-4 w-4" />
                    Profile Settings
                  </button>
                  <button className="flex items-center w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <Settings className="mr-3 h-4 w-4" />
                    Preferences
                  </button>
                </div>
                <div className="border-t border-gray-100 dark:border-white/5 py-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCommandPalette && (
        <div className="fixed inset-0 z-[2000] flex items-start justify-center pt-[20vh]">
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowCommandPalette(false)} />
          <div className="relative w-full max-w-lg mx-4 rounded-xl bg-white dark:bg-[#0A0E18] border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-white/5">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Type a command or search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredCommands.length > 0) {
                    filteredCommands[0].action()
                    setShowCommandPalette(false)
                    setSearchQuery('')
                  }
                }}
              />
              <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[10px] font-mono text-gray-500">ESC</kbd>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filteredCommands.map((item, i) => (
                <button
                  key={i}
                  onClick={() => { item.action(); setShowCommandPalette(false); setSearchQuery('') }}
                  className="flex items-center w-full px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  {item.label}
                </button>
              ))}
              {filteredCommands.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-500">No results found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
