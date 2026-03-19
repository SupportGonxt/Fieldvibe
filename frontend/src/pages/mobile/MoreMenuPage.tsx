import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings, Users, Package, BarChart3, FileText, Shield, Bell,
  HelpCircle, LogOut, ChevronRight, UserCircle, Building2,
  MapPin, Target, Wallet, Truck, ClipboardList, Camera,
  Globe, Database, Key, Palette, CreditCard, Tag
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'

interface MenuItem {
  label: string
  icon: React.ReactNode
  href: string
  description?: string
  badge?: string
  roles?: string[]
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

const menuSections: MenuSection[] = [
  {
    title: 'Field Operations',
    items: [
      { label: 'Daily Targets', icon: <Target className="w-5 h-5" />, href: '/field-operations/daily-targets', description: 'View and manage daily goals' },
      { label: 'Visit Workflow', icon: <ClipboardList className="w-5 h-5" />, href: '/visit-workflow', description: 'Start and manage field visits' },
      { label: 'Photo Evidence', icon: <Camera className="w-5 h-5" />, href: '/field-operations/photos', description: 'Capture and review photos' },
      { label: 'GPS Tracking', icon: <MapPin className="w-5 h-5" />, href: '/field-operations/gps-tracking', description: 'Live location tracking' },
      { label: 'Routes', icon: <Globe className="w-5 h-5" />, href: '/routes', description: 'Beat routes and planning' },
    ],
  },
  {
    title: 'Sales & Finance',
    items: [
      { label: 'Sales Orders', icon: <FileText className="w-5 h-5" />, href: '/sales/orders', description: 'Manage sales orders' },
      { label: 'Invoices', icon: <CreditCard className="w-5 h-5" />, href: '/finance/invoices', description: 'Invoice management' },
      { label: 'Payments', icon: <Wallet className="w-5 h-5" />, href: '/finance/payments', description: 'Payment tracking' },
      { label: 'Van Sales', icon: <Truck className="w-5 h-5" />, href: '/van-sales/loads', description: 'Van stock and sales' },
      { label: 'Commissions', icon: <Tag className="w-5 h-5" />, href: '/commissions', description: 'Commission earnings' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Products', icon: <Package className="w-5 h-5" />, href: '/products', description: 'Product catalog' },
      { label: 'Stock Levels', icon: <Database className="w-5 h-5" />, href: '/inventory/stock-levels', description: 'Current stock' },
      { label: 'Warehouses', icon: <Building2 className="w-5 h-5" />, href: '/inventory/warehouses', description: 'Warehouse management' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Customers', icon: <Users className="w-5 h-5" />, href: '/customers', description: 'Customer database' },
      { label: 'Field Agents', icon: <UserCircle className="w-5 h-5" />, href: '/field-agents', description: 'Agent management' },
    ],
  },
  {
    title: 'Reports & Analytics',
    items: [
      { label: 'Analytics', icon: <BarChart3 className="w-5 h-5" />, href: '/analytics', description: 'Deep analytics' },
      { label: 'Reports', icon: <FileText className="w-5 h-5" />, href: '/reports', description: 'Generate reports' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Profile', icon: <UserCircle className="w-5 h-5" />, href: '/settings/profile', description: 'Your profile' },
      { label: 'Notifications', icon: <Bell className="w-5 h-5" />, href: '/settings/notifications', description: 'Notification preferences' },
      { label: 'System Settings', icon: <Settings className="w-5 h-5" />, href: '/admin/settings', description: 'System configuration', roles: ['admin', 'super_admin'] },
      { label: 'Security', icon: <Shield className="w-5 h-5" />, href: '/admin/security', description: 'Security settings', roles: ['admin', 'super_admin'] },
      { label: 'API Keys', icon: <Key className="w-5 h-5" />, href: '/admin/api-keys', description: 'API key management', roles: ['admin', 'super_admin'] },
      { label: 'Appearance', icon: <Palette className="w-5 h-5" />, href: '/settings/appearance', description: 'Theme and display' },
      { label: 'Help & Support', icon: <HelpCircle className="w-5 h-5" />, href: '/help', description: 'Get help' },
    ],
  },
]

export default function MoreMenuPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const userRole = user?.role || 'agent'

  const handleLogout = () => {
    logout()
    navigate('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-night-300 pb-24">
      {/* User profile header */}
      <div className="bg-white dark:bg-night-50 px-4 py-5 border-b border-gray-200 dark:border-night-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <UserCircle className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {user?.first_name || user?.email || 'User'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{userRole.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      {/* Menu sections */}
      <div className="px-4 py-4 space-y-6">
        {menuSections.map(section => {
          const visibleItems = section.items.filter(
            item => !item.roles || item.roles.includes(userRole)
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                {section.title}
              </h3>
              <div className="bg-white dark:bg-night-50 rounded-xl border border-gray-200 dark:border-night-100 divide-y divide-gray-100 dark:divide-night-100 overflow-hidden">
                {visibleItems.map(item => (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-night-100 transition-colors text-left"
                  >
                    <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</div>
                      {item.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</div>
                      )}
                    </div>
                    {item.badge && (
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Logout */}
      <div className="px-4 pb-8">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
