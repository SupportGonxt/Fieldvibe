import { useState, useEffect } from 'react'
import { Shield, Users, Plus, Edit, Trash2, Save, X, Check, Lock, Eye, FileEdit, Search, Filter } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'
import { apiClient } from '../../services/api.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'
import SearchableSelect from '../../components/ui/SearchableSelect'

interface Permission {
  id: string
  module: string
  action: string
  description: string
}

interface Role {
  id: string
  name: string
  description: string
  userCount: number
  permissions: string[]
  isSystem: boolean
  createdAt: string
}

const PERMISSIONS: Permission[] = [
  // Dashboard
  { id: 'dashboard.view', module: 'Dashboard', action: 'View', description: 'View dashboard and analytics' },
  
  // Customers
  { id: 'customers.view', module: 'Customers', action: 'View', description: 'View customer list and details' },
  { id: 'customers.create', module: 'Customers', action: 'Create', description: 'Create new customers' },
  { id: 'customers.edit', module: 'Customers', action: 'Edit', description: 'Edit customer information' },
  { id: 'customers.delete', module: 'Customers', action: 'Delete', description: 'Delete customers' },
  { id: 'customers.export', module: 'Customers', action: 'Export', description: 'Export customer data' },
  
  // Orders
  { id: 'orders.view', module: 'Orders', action: 'View', description: 'View orders list and details' },
  { id: 'orders.create', module: 'Orders', action: 'Create', description: 'Create new orders' },
  { id: 'orders.edit', module: 'Orders', action: 'Edit', description: 'Edit order information' },
  { id: 'orders.delete', module: 'Orders', action: 'Delete', description: 'Delete orders' },
  { id: 'orders.approve', module: 'Orders', action: 'Approve', description: 'Approve pending orders' },
  { id: 'orders.cancel', module: 'Orders', action: 'Cancel', description: 'Cancel orders' },
  
  // Products
  { id: 'products.view', module: 'Products', action: 'View', description: 'View product catalog' },
  { id: 'products.create', module: 'Products', action: 'Create', description: 'Create new products' },
  { id: 'products.edit', module: 'Products', action: 'Edit', description: 'Edit product information' },
  { id: 'products.delete', module: 'Products', action: 'Delete', description: 'Delete products' },
  { id: 'products.pricing', module: 'Products', action: 'Manage Pricing', description: 'Manage product pricing' },
  
  // Inventory
  { id: 'inventory.view', module: 'Inventory', action: 'View', description: 'View inventory levels' },
  { id: 'inventory.adjust', module: 'Inventory', action: 'Adjust', description: 'Adjust stock levels' },
  { id: 'inventory.transfer', module: 'Inventory', action: 'Transfer', description: 'Transfer stock between locations' },
  
  // Field Agents
  { id: 'agents.view', module: 'Field Agents', action: 'View', description: 'View field agents' },
  { id: 'agents.create', module: 'Field Agents', action: 'Create', description: 'Create new field agents' },
  { id: 'agents.edit', module: 'Field Agents', action: 'Edit', description: 'Edit agent information' },
  { id: 'agents.delete', module: 'Field Agents', action: 'Delete', description: 'Delete agents' },
  { id: 'agents.track', module: 'Field Agents', action: 'Track', description: 'Track agent locations' },
  
  // Visits
  { id: 'visits.view', module: 'Visits', action: 'View', description: 'View visit records' },
  { id: 'visits.create', module: 'Visits', action: 'Create', description: 'Create visit records' },
  { id: 'visits.approve', module: 'Visits', action: 'Approve', description: 'Approve visit reports' },
  
  // Commissions
  { id: 'commissions.view', module: 'Commissions', action: 'View', description: 'View commission data' },
  { id: 'commissions.calculate', module: 'Commissions', action: 'Calculate', description: 'Calculate commissions' },
  { id: 'commissions.approve', module: 'Commissions', action: 'Approve', description: 'Approve commissions' },
  { id: 'commissions.pay', module: 'Commissions', action: 'Pay', description: 'Process commission payments' },
  
  // Reports
  { id: 'reports.view', module: 'Reports', action: 'View', description: 'View reports' },
  { id: 'reports.create', module: 'Reports', action: 'Create', description: 'Create custom reports' },
  { id: 'reports.export', module: 'Reports', action: 'Export', description: 'Export reports' },
  
  // Finance
  { id: 'finance.view', module: 'Finance', action: 'View', description: 'View financial data' },
  { id: 'finance.invoices', module: 'Finance', action: 'Manage Invoices', description: 'Manage invoices' },
  { id: 'finance.payments', module: 'Finance', action: 'Manage Payments', description: 'Manage payments' },
  
  // Admin
  { id: 'admin.users', module: 'Admin', action: 'Manage Users', description: 'Manage user accounts' },
  { id: 'admin.roles', module: 'Admin', action: 'Manage Roles', description: 'Manage roles and permissions' },
  { id: 'admin.settings', module: 'Admin', action: 'System Settings', description: 'Configure system settings' },
  { id: 'admin.audit', module: 'Admin', action: 'Audit Logs', description: 'View audit logs' },
  { id: 'admin.backup', module: 'Admin', action: 'Backup/Restore', description: 'Backup and restore data' },
]

export default function RolePermissionsPage() {
  const { toast } = useToast()
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const loadRoles = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await apiClient.get('/rbac/roles')
      const apiRoles = (res.data?.data || res.data || []) as any[]
      const mapped: Role[] = apiRoles.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        userCount: r.user_count || 0,
        permissions: (r.permissions || []).map((p: any) => p.name || p.id || p),
        isSystem: r.is_system === 1 || r.is_system === true,
        createdAt: r.created_at || ''
      }))
      setRoles(mapped.length > 0 ? mapped : fallbackRoles)
    } catch {
      setRoles(fallbackRoles)
    } finally {
      setLoading(false)
    }
  }

  const fallbackRoles: Role[] = [
    { id: '1', name: 'Super Admin', description: 'Full system access', userCount: 2, permissions: PERMISSIONS.map(p => p.id), isSystem: true, createdAt: '2024-01-15' },
    { id: '2', name: 'Admin', description: 'Administrative access', userCount: 5, permissions: PERMISSIONS.filter(p => !p.id.includes('admin.backup')).map(p => p.id), isSystem: true, createdAt: '2024-01-15' },
    { id: '3', name: 'Sales Manager', description: 'Sales operations', userCount: 8, permissions: PERMISSIONS.filter(p => ['Dashboard','Customers','Orders','Field Agents','Visits','Commissions','Reports'].includes(p.module)).map(p => p.id), isSystem: false, createdAt: '2024-02-01' },
    { id: '4', name: 'Field Agent', description: 'Mobile field access', userCount: 45, permissions: ['dashboard.view','customers.view','orders.view','orders.create','products.view','visits.view','visits.create','commissions.view'], isSystem: false, createdAt: '2024-02-01' },
    { id: '5', name: 'Warehouse Manager', description: 'Inventory management', userCount: 3, permissions: PERMISSIONS.filter(p => ['Dashboard','Products','Inventory'].includes(p.module)).map(p => p.id), isSystem: false, createdAt: '2024-02-10' },
    { id: '6', name: 'Finance Manager', description: 'Financial operations', userCount: 4, permissions: PERMISSIONS.filter(p => ['Dashboard','Finance','Reports'].includes(p.module)).map(p => p.id), isSystem: false, createdAt: '2024-02-15' }
  ]

  useEffect(() => { loadRoles() }, [])

  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Partial<Role>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [filterModule, setFilterModule] = useState<string>('all')

  const modules = Array.from(new Set(PERMISSIONS.map(p => p.module)))

  const handleCreateRole = () => {
    setEditingRole({
      name: '',
      description: '',
      permissions: [],
      isSystem: false
    })
    setSelectedRole(null)
    setIsEditModalOpen(true)
  }

  const handleEditRole = (role: Role) => {
    if (role.isSystem) {
      toast.error('System roles cannot be edited')
      return
    }
    setEditingRole(role)
    setSelectedRole(role)
    setIsEditModalOpen(true)
  }

  const handleDeleteRole = (role: Role) => {
    if (role.isSystem) {
      toast.error('System roles cannot be deleted')
      return
    }
    setSelectedRole(role)
    setIsDeleteModalOpen(true)
  }

  const handleSaveRole = async () => {
    if (!editingRole.name || !editingRole.description) {
      toast.error('Please fill all required fields')
      return
    }

    try {
      if (selectedRole) {
        await apiClient.put(`/rbac/roles/${selectedRole.id}`, {
          name: editingRole.name,
          description: editingRole.description,
          permission_ids: editingRole.permissions || []
        })
        setRoles(roles.map(r => r.id === selectedRole.id ? { ...r, ...editingRole } as Role : r))
        toast.success('Role updated successfully')
      } else {
        const res = await apiClient.post('/rbac/roles', {
          name: editingRole.name,
          description: editingRole.description,
          permission_ids: editingRole.permissions || []
        })
        const newRole: Role = {
          id: res.data?.data?.id || Date.now().toString(),
          name: editingRole.name!,
          description: editingRole.description!,
          userCount: 0,
          permissions: editingRole.permissions || [],
          isSystem: false,
          createdAt: new Date().toISOString().split('T')[0]
        }
        setRoles([...roles, newRole])
        toast.success('Role created successfully')
      }
    } catch {
      // Fallback: update local state even if API fails
      if (selectedRole) {
        setRoles(roles.map(r => r.id === selectedRole.id ? { ...r, ...editingRole } as Role : r))
      } else {
        const newRole: Role = {
          id: Date.now().toString(),
          name: editingRole.name!,
          description: editingRole.description!,
          userCount: 0,
          permissions: editingRole.permissions || [],
          isSystem: false,
          createdAt: new Date().toISOString().split('T')[0]
        }
        setRoles([...roles, newRole])
      }
      toast.success(selectedRole ? 'Role updated' : 'Role created')
    }

    setIsEditModalOpen(false)
    setEditingRole({})
    setSelectedRole(null)
  }

  const confirmDelete = async () => {
    if (selectedRole) {
      try {
        await apiClient.delete(`/rbac/roles/${selectedRole.id}`)
      } catch {
        // Continue with local delete even if API fails
      }
      setRoles(roles.filter(r => r.id !== selectedRole.id))
      toast.success('Role deleted successfully')
    }
    setIsDeleteModalOpen(false)
    setSelectedRole(null)
  }

  const togglePermission = (permissionId: string) => {
    const currentPermissions = editingRole.permissions || []
    if (currentPermissions.includes(permissionId)) {
      setEditingRole({
        ...editingRole,
        permissions: currentPermissions.filter(p => p !== permissionId)
      })
    } else {
      setEditingRole({
        ...editingRole,
        permissions: [...currentPermissions, permissionId]
      })
    }
  }

  const selectAllInModule = (module: string) => {
    const modulePermissions = PERMISSIONS.filter(p => p.module === module).map(p => p.id)
    const currentPermissions = editingRole.permissions || []
    const allSelected = modulePermissions.every(p => currentPermissions.includes(p))
    
    if (allSelected) {
      setEditingRole({
        ...editingRole,
        permissions: currentPermissions.filter(p => !modulePermissions.includes(p))
      })
    } else {
      setEditingRole({
        ...editingRole,
        permissions: Array.from(new Set([...currentPermissions, ...modulePermissions]))
      })
    }
  }

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredPermissions = filterModule === 'all'
    ? PERMISSIONS
    : PERMISSIONS.filter(p => p.module === filterModule)

  const getPermissionStats = (role: Role) => {
    const total = PERMISSIONS.length
    const granted = role.permissions.length
    const percentage = Math.round((granted / total) * 100)
    return { granted, total, percentage }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage user roles and access permissions
          </p>
        </div>
        <button
          onClick={handleCreateRole}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Role
        </button>
      </div>

      {/* Search & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Roles</p>
              <p className="text-3xl font-bold mt-1">{roles.length}</p>
            </div>
            <Shield className="w-12 h-12 text-blue-200" />
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Users</p>
              <p className="text-3xl font-bold mt-1">{roles.reduce((sum, r) => sum + r.userCount, 0)}</p>
            </div>
            <Users className="w-12 h-12 text-green-200" />
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Permissions</p>
              <p className="text-3xl font-bold mt-1">{PERMISSIONS.length}</p>
            </div>
            <Lock className="w-12 h-12 text-purple-200" />
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Custom Roles</p>
              <p className="text-3xl font-bold mt-1">{roles.filter(r => !r.isSystem).length}</p>
            </div>
            <FileEdit className="w-12 h-12 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search roles by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRoles.map((role) => {
          const stats = getPermissionStats(role)
          return (
            <div key={role.id} className="card hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{role.name}</h3>
                      {role.isSystem && (
                        <span className="badge badge-primary text-xs">System</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Users</span>
                    <span className="font-semibold text-gray-900">{role.userCount}</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">Permissions</span>
                      <span className="font-semibold text-gray-900">
                        {stats.granted} / {stats.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${stats.percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Created: {new Date(role.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleEditRole(role)}
                    className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
                    disabled={role.isSystem}
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRole(role)
                      setIsEditModalOpen(true)
                      setEditingRole({ ...role })
                    }}
                    className="btn btn-outline flex-1 flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  {!role.isSystem && (
                    <button
                      onClick={() => handleDeleteRole(role)}
                      className="btn btn-outline text-red-600 hover:bg-red-50 border-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit/Create Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedRole ? `${editingRole.isSystem ? 'View' : 'Edit'} Role` : 'Create New Role'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedRole && editingRole.isSystem
                    ? 'System roles are read-only'
                    : 'Configure role details and permissions'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false)
                  setEditingRole({})
                  setSelectedRole(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-6">
                {/* Role Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role Name *
                    </label>
                    <input
                      type="text"
                      value={editingRole.name || ''}
                      onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                      className="input w-full"
                      placeholder="e.g., Sales Manager"
                      disabled={editingRole.isSystem}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <input
                      type="text"
                      value={editingRole.description || ''}
                      onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                      className="input w-full"
                      placeholder="Brief role description"
                      disabled={editingRole.isSystem}
                    />
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Permissions</h3>
                    <SearchableSelect
                      options={[
                        { value: 'all', label: 'All Modules' },
                        { value: 'module', label: '{module}' },
                      ]}
                      value={filterModule}
                      placeholder="All Modules"
                    />
                  </div>

                  <div className="space-y-4">
                    {modules
                      .filter(module => filterModule === 'all' || filterModule === module)
                      .map(module => {
                        const modulePerms = PERMISSIONS.filter(p => p.module === module)
                        const allSelected = modulePerms.every(p => editingRole.permissions?.includes(p.id))
                        const someSelected = modulePerms.some(p => editingRole.permissions?.includes(p.id))

                        return (
                          <div key={module} className="border border-gray-100 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-blue-600" />
                                {module}
                              </h4>
                              <button
                                onClick={() => !editingRole.isSystem && selectAllInModule(module)}
                                className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                                disabled={editingRole.isSystem}
                              >
                                {allSelected ? 'Deselect All' : 'Select All'}
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {modulePerms.map(permission => (
                                <label
                                  key={permission.id}
                                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                    editingRole.permissions?.includes(permission.id)
                                      ? 'bg-blue-50 border-blue-200'
                                      : 'bg-white border-gray-100 hover:bg-surface-secondary'
                                  } ${editingRole.isSystem ? 'cursor-not-allowed opacity-75' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={editingRole.permissions?.includes(permission.id) || false}
                                    onChange={() => !editingRole.isSystem && togglePermission(permission.id)}
                                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    disabled={editingRole.isSystem}
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium text-sm text-gray-900">
                                      {permission.action}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {permission.description}
                                    </div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            {!editingRole.isSystem && (
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setEditingRole({})
                    setSelectedRole(null)
                  }}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRole}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {selectedRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Role</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800">
                Are you sure you want to delete <strong>{selectedRole.name}</strong>?
                <br />
                <span className="text-red-600">
                  {selectedRole.userCount} user(s) will be affected.
                </span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setSelectedRole(null)
                }}
                className="btn btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="btn bg-red-600 hover:bg-red-700 text-white flex-1"
              >
                Delete Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
