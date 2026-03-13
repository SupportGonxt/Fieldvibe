import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, X, HelpCircle } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import OfflineIndicator from '../ui/OfflineIndicator'
import HelpPanel from '../help/HelpPanel'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [helpPanelOpen, setHelpPanelOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [sidebarOpen])

  return (
    <div className="min-h-screen bg-surface-secondary dark:bg-night dark:text-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div 
            className="fixed inset-0 bg-black bg-opacity-25"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative flex flex-col max-w-xs w-full bg-white h-screen overflow-y-auto">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content - no sidebar on desktop, mega menu is in header */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="flex-1 pb-8">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Outlet />
          </div>
        </main>

        {/* Footer with GONXT branding */}
        <footer className="bg-white dark:bg-night-50 border-t border-gray-100 dark:border-night-100 py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>A Product of</span>
                <a href="https://www.gonxt.tech" target="_blank" rel="noopener noreferrer">
                  <img src="/gonxt-logo.svg" alt="GONXT" className="h-5" />
                </a>
              </div>
              <div className="text-sm text-gray-500 text-center sm:text-right">
                &copy; 2025 FieldVibe by Vantax. All rights reserved.
              </div>
            </div>
          </div>
        </footer>
      </div>
      
      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Help Button - Fixed position */}
      <button
        onClick={() => setHelpPanelOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all hover:scale-105"
        title="Help & Training"
      >
        <HelpCircle className="h-6 w-6" />
      </button>

      {/* Help Panel */}
      <HelpPanel isOpen={helpPanelOpen} onClose={() => setHelpPanelOpen(false)} />
    </div>
  )
}
