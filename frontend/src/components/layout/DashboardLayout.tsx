import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { X, HelpCircle, Plus, ShoppingCart, MapPin, FileText } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileBottomTabs from './MobileBottomTabs'
import PageTransition from './PageTransition'
import OfflineIndicator from '../ui/OfflineIndicator'
import HelpPanel from '../help/HelpPanel'
import Breadcrumbs from '../navigation/Breadcrumbs'
import { useKeyboardShortcuts } from '../ui/KeyboardShortcuts'
import { FloatingActionButton } from '../mobile/FloatingActionButton'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [helpPanelOpen, setHelpPanelOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // ENH-08: Global keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      { key: 'd', alt: true, handler: () => navigate('/dashboard'), description: 'Go to Dashboard' },
      { key: 'o', alt: true, handler: () => navigate('/sales/orders'), description: 'Go to Orders' },
      { key: 'c', alt: true, handler: () => navigate('/customers'), description: 'Go to Customers' },
      { key: 'i', alt: true, handler: () => navigate('/inventory'), description: 'Go to Inventory' },
      { key: 'h', alt: true, handler: () => setHelpPanelOpen(true), description: 'Open Help' },
    ]
  })

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
    <div className="min-h-screen bg-[#06090F] text-gray-100 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative flex flex-col max-w-[240px] w-full h-screen overflow-y-auto">
            <div className="absolute top-2 right-0 -mr-10">
              <button
                type="button"
                className="flex items-center justify-center h-8 w-8 rounded-full bg-white/10 text-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 pb-20 lg:pb-8">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="mb-4">
              <Breadcrumbs />
            </div>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>

        <footer className="border-t border-white/5 py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span>A Product of</span>
                <a href="https://www.gonxt.tech" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#00E87B] transition-colors font-medium">
                  GONXT
                </a>
              </div>
              <div className="text-xs text-gray-500">
                &copy; 2025 FieldVibe by Vantax. All rights reserved.
              </div>
            </div>
          </div>
        </footer>
      </div>
      
      <MobileBottomTabs />
      <OfflineIndicator />

      {/* ENH-14: Mobile FAB for quick actions */}
      <div className="lg:hidden">
        <FloatingActionButton
          actions={[
            { id: 'order', label: 'New Order', icon: <ShoppingCart className="w-5 h-5" />, href: '/sales/orders/create', color: 'bg-blue-500' },
            { id: 'visit', label: 'New Visit', icon: <MapPin className="w-5 h-5" />, href: '/field-operations/visits/create', color: 'bg-green-500' },
            { id: 'invoice', label: 'New Invoice', icon: <FileText className="w-5 h-5" />, href: '/sales/invoices/create', color: 'bg-purple-500' },
          ]}
          mainIcon={<Plus className="w-6 h-6" />}
        />
      </div>

      <button
        onClick={() => setHelpPanelOpen(true)}
        className="fixed bottom-6 right-6 z-40 hidden lg:flex bg-[#00E87B] hover:bg-[#00D06E] text-[#06090F] p-3 rounded-full shadow-lg transition-all hover:scale-105"
        title="Help & Training"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      <HelpPanel isOpen={helpPanelOpen} onClose={() => setHelpPanelOpen(false)} />
    </div>
  )
}
