import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Users, Shield, Building2, Boxes, Bell, Globe, Save, ChevronDown, ChevronRight, Check, X } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToastStore } from '../../components/ui/Toast'

interface CompanySettings {
  company_name: string
  company_code: string
  timezone: string
  currency: string
  date_format: string
  language: string
  logo_url: string
  primary_color: string
  modules_enabled: Record<string, boolean>
}

interface UserRole {
  id: string
  name: string
  description: string
  permissions: string[]
  user_count: number
  is_system: boolean
}

interface UserRecord {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  status: string
  last_login: string
}

const ALL_PERMISSIONS = [
  { key: 'dashboard.view', label: 'View Dashboard', category: 'Dashboard' },
  { key: 'orders.view', label: 'View Orders', category: 'Orders' },
  { key: 'orders.create', label: 'Create Orders', category: 'Orders' },
  { key: 'orders.edit', label: 'Edit Orders', category: 'Orders' },
  { key: 'orders.delete', label: 'Delete Orders', category: 'Orders' },
  { key: 'orders.approve', label: 'Approve Orders', category: 'Orders' },
  { key: 'customers.view', label: 'View Customers', category: 'Customers' },
  { key: 'customers.create', label: 'Create Customers', category: 'Customers' },
  { key: 'customers.edit', label: 'Edit Customers', category: 'Customers' },
  { key: 'customers.delete', label: 'Delete Customers', category: 'Customers' },
  { key: 'inventory.view', label: 'View Inventory', category: 'Inventory' },
  { key: 'inventory.manage', label: 'Manage Inventory', category: 'Inventory' },
  { key: 'inventory.adjust', label: 'Adjust Stock', category: 'Inventory' },
  { key: 'finance.view', label: 'View Finance', category: 'Finance' },
  { key: 'finance.invoices', label: 'Manage Invoices', category: 'Finance' },
  { key: 'finance.payments', label: 'Manage Payments', category: 'Finance' },
  { key: 'field_ops.view', label: 'View Field Operations', category: 'Field Operations' },
  { key: 'field_ops.manage', label: 'Manage Field Ops', category: 'Field Operations' },
  { key: 'field_ops.gps', label: 'View GPS Tracking', category: 'Field Operations' },
  { key: 'marketing.view', label: 'View Marketing', category: 'Marketing' },
  { key: 'marketing.manage', label: 'Manage Campaigns', category: 'Marketing' },
  { key: 'reports.view', label: 'View Reports', category: 'Reports' },
  { key: 'reports.export', label: 'Export Reports', category: 'Reports' },
  { key: 'admin.users', label: 'Manage Users', category: 'Administration' },
  { key: 'admin.roles', label: 'Manage Roles', category: 'Administration' },
  { key: 'admin.settings', label: 'System Settings', category: 'Administration' },
]

type TabType = 'general' | 'roles' | 'users' | 'modules'

export default function CompanySetupPage() {
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const queryClient = useQueryClient()

  const tabs = [
    { id: 'general' as TabType, label: 'Company Settings', icon: Building2 },
    { id: 'roles' as TabType, label: 'Roles & Permissions', icon: Shield },
    { id: 'users' as TabType, label: 'User Management', icon: Users },
    { id: 'modules' as TabType, label: 'Enabled Modules', icon: Boxes },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Company Setup</h1>
        <p className="text-sm text-gray-600 mt-1">Configure your company settings, user roles, and permissions</p>
      </div>

      <div className="flex space-x-1 bg-gray-100 dark:bg-night-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-night-50 shadow-sm text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'general' && <GeneralSettingsTab />}
      {activeTab === 'roles' && <RolesTab />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'modules' && <ModulesTab />}
    </div>
  )
}

function GeneralSettingsTab() {
  const [settings, setSettings] = useState<CompanySettings>({
    company_name: '',
    company_code: '',
    timezone: 'Africa/Johannesburg',
    currency: 'ZAR',
    date_format: 'DD/MM/YYYY',
    language: 'en',
    logo_url: '',
    primary_color: '#3B82F6',
    modules_enabled: {},
  })

  const { isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const response = await apiClient.get('/settings/company')
      const data = response.data.data || response.data
      setSettings(prev => ({ ...prev, ...data }))
      return data
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<CompanySettings>) => {
      const response = await apiClient.put('/settings/company', data)
      return response.data
    },
    onSuccess: () => useToastStore.getState().addToast({ type: 'success', message: 'Settings saved successfully' }),
    onError: () => useToastStore.getState().addToast({ type: 'error', message: 'Failed to save settings' }),
  })

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 dark:bg-night-100 rounded w-1/4" /><div className="h-64 bg-gray-200 dark:bg-night-100 rounded" /></div>
  }

  return (
    <div className="bg-white dark:bg-night-50 rounded-lg shadow p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
        <button
          onClick={() => saveMutation.mutate(settings)}
          disabled={saveMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{saveMutation.isPending ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
          <input
            type="text"
            value={settings.company_name}
            onChange={e => setSettings({ ...settings, company_name: e.target.value })}
            className="w-full border border-gray-300 dark:border-night-100 dark:bg-night-100 rounded-lg px-3 py-2 text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Code</label>
          <input
            type="text"
            value={settings.company_code}
            disabled
            className="w-full border border-gray-300 dark:border-night-100 dark:bg-night-100 rounded-lg px-3 py-2 text-gray-500 bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <select
            value={settings.timezone}
            onChange={e => setSettings({ ...settings, timezone: e.target.value })}
            className="w-full border border-gray-300 dark:border-night-100 dark:bg-night-100 rounded-lg px-3 py-2 text-gray-900"
          >
            <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
            <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
            <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="America/New_York">America/New_York (EST)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select
            value={settings.currency}
            onChange={e => setSettings({ ...settings, currency: e.target.value })}
            className="w-full border border-gray-300 dark:border-night-100 dark:bg-night-100 rounded-lg px-3 py-2 text-gray-900"
          >
            <option value="ZAR">ZAR - South African Rand</option>
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="NGN">NGN - Nigerian Naira</option>
            <option value="KES">KES - Kenyan Shilling</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
          <select
            value={settings.date_format}
            onChange={e => setSettings({ ...settings, date_format: e.target.value })}
            className="w-full border border-gray-300 dark:border-night-100 dark:bg-night-100 rounded-lg px-3 py-2 text-gray-900"
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={settings.primary_color}
              onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
              className="h-10 w-10 rounded border border-gray-300"
            />
            <input
              type="text"
              value={settings.primary_color}
              onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
              className="flex-1 border border-gray-300 dark:border-night-100 dark:bg-night-100 rounded-lg px-3 py-2 text-gray-900"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function RolesTab() {
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<UserRole | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/roles')
        return response.data.data || response.data || []
      } catch {
        return [
          { id: '1', name: 'admin', description: 'Full system access', permissions: ALL_PERMISSIONS.map(p => p.key), user_count: 1, is_system: true },
          { id: '2', name: 'manager', description: 'Manage operations and team', permissions: ALL_PERMISSIONS.filter(p => !p.key.startsWith('admin.')).map(p => p.key), user_count: 3, is_system: true },
          { id: '3', name: 'agent', description: 'Field agent access', permissions: ['dashboard.view', 'orders.view', 'orders.create', 'customers.view', 'field_ops.view'], user_count: 10, is_system: true },
          { id: '4', name: 'viewer', description: 'Read-only access', permissions: ALL_PERMISSIONS.filter(p => p.key.includes('.view')).map(p => p.key), user_count: 2, is_system: false },
        ]
      }
    }
  })

  const updatePermissions = useMutation({
    mutationFn: async ({ roleId, permissions }: { roleId: string; permissions: string[] }) => {
      await apiClient.patch(`/roles/${roleId}`, { permissions })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      useToastStore.getState().addToast({ type: 'success', message: 'Permissions updated' })
    },
    onError: () => useToastStore.getState().addToast({ type: 'error', message: 'Failed to update permissions' }),
  })

  const handlePermissionToggle = (role: UserRole, permKey: string) => {
    if (role.is_system) return
    const current = role.permissions || []
    const updated = current.includes(permKey)
      ? current.filter(p => p !== permKey)
      : [...current, permKey]
    updatePermissions.mutate({ roleId: role.id, permissions: updated })
  }

  const categories = [...new Set(ALL_PERMISSIONS.map(p => p.category))]

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 dark:bg-night-100 rounded w-1/4" /><div className="h-64 bg-gray-200 dark:bg-night-100 rounded" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Roles & Permissions</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Shield className="h-4 w-4" />
          <span>Create Role</span>
        </button>
      </div>

      {(roles as UserRole[]).map((role: UserRole) => (
        <div key={role.id} className="bg-white dark:bg-night-50 rounded-lg shadow overflow-hidden">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-night-100"
            onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
          >
            <div className="flex items-center space-x-3">
              {expandedRole === role.id ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">{role.name}</span>
                  {role.is_system && <span className="text-xs bg-gray-100 dark:bg-night-100 text-gray-500 px-2 py-0.5 rounded">System</span>}
                </div>
                <span className="text-sm text-gray-500">{role.description}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{role.permissions?.length || 0} permissions</span>
              <span className="text-sm text-gray-500">{role.user_count} users</span>
            </div>
          </div>

          {expandedRole === role.id && (
            <div className="border-t border-gray-100 dark:border-night-100 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(cat => (
                  <div key={cat} className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">{cat}</h4>
                    {ALL_PERMISSIONS.filter(p => p.category === cat).map(perm => (
                      <label key={perm.key} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={role.permissions?.includes(perm.key) || false}
                          disabled={role.is_system}
                          className="rounded border-gray-300 text-blue-600"
                          onChange={() => handlePermissionToggle(role, perm.key)}
                        />
                        <span className="text-sm text-gray-600">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function UsersTab() {
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['company-users'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/users')
        return response.data.data || response.data || []
      } catch {
        return []
      }
    }
  })

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/users/${id}`)
    },
    onSuccess: () => {
      useToastStore.getState().addToast({ type: 'success', message: 'User removed' })
      setDeleteUserId(null)
    },
    onError: () => useToastStore.getState().addToast({ type: 'error', message: 'Failed to remove user' }),
  })

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 dark:bg-night-100 rounded w-1/4" /><div className="h-64 bg-gray-200 dark:bg-night-100 rounded" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Users className="h-4 w-4" />
          <span>Invite User</span>
        </button>
      </div>

      <div className="bg-white dark:bg-night-50 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-night-100">
          <thead className="bg-gray-50 dark:bg-night-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-night-100">
            {(users as UserRecord[]).length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No users found</td></tr>
            ) : (
              (users as UserRecord[]).map((user: UserRecord) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-night-100">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {user.status || 'active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setDeleteUserId(user.id)}
                      className="text-red-600 hover:text-red-900 text-sm"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={deleteUserId !== null}
        onClose={() => setDeleteUserId(null)}
        onConfirm={() => deleteUserId && deleteUser.mutate(deleteUserId)}
        title="Remove User"
        message="Are you sure you want to remove this user? They will lose access to the system."
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  )
}

function ModulesTab() {
  const { data: modules, isLoading } = useQuery({
    queryKey: ['tenant-modules'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/settings/modules')
        return response.data.data || response.data || {}
      } catch {
        return {}
      }
    }
  })

  const moduleList = [
    { key: 'field_operations', label: 'Field Operations', icon: Globe },
    { key: 'van_sales', label: 'Van Sales', icon: Building2 },
    { key: 'orders', label: 'Orders & Deliveries', icon: Boxes },
    { key: 'inventory', label: 'Inventory', icon: Boxes },
    { key: 'finance', label: 'Finance', icon: Building2 },
    { key: 'commissions', label: 'Commissions', icon: Building2 },
    { key: 'marketing', label: 'Marketing', icon: Bell },
    { key: 'trade_marketing', label: 'Trade Marketing', icon: Bell },
    { key: 'surveys', label: 'Surveys', icon: Shield },
    { key: 'kyc', label: 'KYC / Compliance', icon: Shield },
    { key: 'insights', label: 'Insights & Analytics', icon: Settings },
    { key: 'reports', label: 'Reports & Exports', icon: Settings },
  ]

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 dark:bg-night-100 rounded w-1/4" /><div className="h-64 bg-gray-200 dark:bg-night-100 rounded" /></div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Enabled Modules</h2>
        <p className="text-sm text-gray-500 mt-1">These modules are configured by your super admin. Contact them to enable or disable modules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {moduleList.map(mod => {
          const isEnabled = (modules as Record<string, boolean>)?.[mod.key] !== false
          return (
            <div key={mod.key} className={`bg-white dark:bg-night-50 rounded-lg shadow p-4 flex items-center space-x-3 ${!isEnabled ? 'opacity-50' : ''}`}>
              <div className={`p-2 rounded-lg ${isEnabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-night-100'}`}>
                {isEnabled ? <Check className="h-5 w-5 text-green-600 dark:text-green-400" /> : <X className="h-5 w-5 text-gray-400" />}
              </div>
              <div>
                <div className="font-medium text-gray-900">{mod.label}</div>
                <div className="text-xs text-gray-500">{isEnabled ? 'Enabled' : 'Disabled by super admin'}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
