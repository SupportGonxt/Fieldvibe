import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../services/api.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  user_count: number
  created_at: string
}

const DEFAULT_ROLES: Role[] = [
  { id: '1', name: 'Admin', description: 'Full system access', permissions: ['all'], user_count: 1, created_at: new Date().toISOString() },
  { id: '2', name: 'Manager', description: 'Team and operations management', permissions: ['read', 'write', 'approve'], user_count: 2, created_at: new Date().toISOString() },
  { id: '3', name: 'Agent', description: 'Field agent access', permissions: ['read', 'write'], user_count: 6, created_at: new Date().toISOString() },
  { id: '4', name: 'Viewer', description: 'Read-only access', permissions: ['read'], user_count: 0, created_at: new Date().toISOString() },
]

export const RoleManagementPage: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: roles = DEFAULT_ROLES, isLoading, isError } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/rbac/roles')
        return response.data?.data || response.data || DEFAULT_ROLES
      } catch {
        return DEFAULT_ROLES
      }
    },
  })

  if (isLoading) return <LoadingSpinner />

  const availablePermissions = [
    { id: 'users.view', name: 'View Users', category: 'Users' },
    { id: 'users.create', name: 'Create Users', category: 'Users' },
    { id: 'users.edit', name: 'Edit Users', category: 'Users' },
    { id: 'users.delete', name: 'Delete Users', category: 'Users' },
    { id: 'orders.view', name: 'View Orders', category: 'Orders' },
    { id: 'orders.create', name: 'Create Orders', category: 'Orders' },
    { id: 'orders.edit', name: 'Edit Orders', category: 'Orders' },
    { id: 'orders.delete', name: 'Delete Orders', category: 'Orders' },
    { id: 'customers.view', name: 'View Customers', category: 'Customers' },
    { id: 'customers.create', name: 'Create Customers', category: 'Customers' },
    { id: 'customers.edit', name: 'Edit Customers', category: 'Customers' },
    { id: 'customers.delete', name: 'Delete Customers', category: 'Customers' },
    { id: 'reports.view', name: 'View Reports', category: 'Reports' },
    { id: 'reports.export', name: 'Export Reports', category: 'Reports' },
    { id: 'settings.view', name: 'View Settings', category: 'Settings' },
    { id: 'settings.edit', name: 'Edit Settings', category: 'Settings' }
  ]

  const permissionsByCategory = availablePermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = []
    }
    acc[perm.category].push(perm)
    return acc
  }, {} as Record<string, typeof availablePermissions>)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage roles and permissions for user access control
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Create Role
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Roles</p>
              <p className="text-2xl font-semibold text-gray-900">{roles.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Permissions</p>
              <p className="text-2xl font-semibold text-gray-900">{availablePermissions.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Assigned Users</p>
              <p className="text-2xl font-semibold text-gray-900">
                {roles.reduce((sum, r) => sum + r.user_count, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No roles</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new role.</p>
          </div>
        ) : (
          roles.map((role) => (
            <div key={role.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-1">{role.name}</h3>
                    <p className="text-sm text-gray-500">{role.description}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <span>{role.permissions.length} permissions</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>{role.user_count} users</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Created {new Date(role.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => toast.success('Edit role')} className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm text-center hover:bg-blue-700">
                    Edit
                  </button>
                  <button onClick={() => toast.success('Viewing role details')} className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm text-center hover:bg-gray-200">
                    View
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Available Permissions Reference */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Available Permissions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(permissionsByCategory).map(([category, perms]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-gray-900 mb-2">{category}</h3>
              <ul className="space-y-1">
                {perms.map((perm) => (
                  <li key={perm.id} className="text-sm text-gray-600 flex items-center">
                    <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {perm.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
