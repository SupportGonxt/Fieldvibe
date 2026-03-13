import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import LoadingSpinner from '../ui/LoadingSpinner'
import { tenantService } from '../../services/tenant.service'
import { apiClient } from '../../services/api.service'

interface Tenant {
  id: string
  name: string
  code: string
  domain?: string
  status: 'active' | 'suspended' | 'inactive'
  subscription_plan: 'basic' | 'professional' | 'enterprise'
  user_count: number
  max_users: number
  features: Record<string, boolean>
  created_at: string
}

interface NewTenant {
  name: string
  code: string
  domain: string
  subscriptionPlan: 'basic' | 'professional' | 'enterprise'
  adminUser: {
    email: string
    password: string
    firstName: string
    lastName: string
  }
}

const TenantManagement: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [newTenant, setNewTenant] = useState<NewTenant>({
    name: '',
    code: '',
    domain: '',
    subscriptionPlan: 'professional',
    adminUser: {
      email: '',
      password: '',
      firstName: '',
      lastName: ''
    }
  })

  useEffect(() => {
    loadTenants()
  }, [])

  const loadTenants = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/tenants')
      setTenants(response.data.data.tenants)
    } catch (error) {
      console.error('Failed to load tenants:', error)
    } finally {
      setLoading(false)
    }
  }

  const createTenant = async () => {
    try {
      await apiClient.post('/tenants', newTenant)
      setShowAddModal(false)
      setNewTenant({
        name: '',
        code: '',
        domain: '',
        subscriptionPlan: 'professional',
        adminUser: {
          email: '',
          password: '',
          firstName: '',
          lastName: ''
        }
      })
      loadTenants()
    } catch (error) {
      console.error('Failed to create tenant:', error)
    }
  }

  const updateTenantStatus = async (tenantId: string, status: string) => {
    try {
      await apiClient.put(`/tenants/${tenantId}`, { status })
      loadTenants()
    } catch (error) {
      console.error('Failed to update tenant status:', error)
    }
  }

  const switchToTenant = async (tenantCode: string) => {
    try {
      await tenantService.switchTenant(tenantCode)
    } catch (error) {
      console.error('Failed to switch tenant:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'suspended': return 'bg-yellow-100 text-yellow-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'basic': return 'bg-blue-100 text-blue-800'
      case 'professional': return 'bg-purple-100 text-purple-800'
      case 'enterprise': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Management</h1>
          <p className="text-gray-600">Manage multi-tenant deployments and configurations</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          Add New Tenant
        </Button>
      </div>

      {/* Current Tenant Info */}
      <Card>
        <CardHeader>
          <CardTitle>Current Tenant Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div>
              <p className="font-medium">{tenantService.getCurrentTenant()?.name || 'Unknown'}</p>
              <p className="text-sm text-gray-600">Code: {tenantService.getTenantCode()}</p>
            </div>
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tenants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tenants.map((tenant) => (
          <Card key={tenant.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{tenant.name}</CardTitle>
                  <p className="text-sm text-gray-600">{tenant.code}</p>
                </div>
                <div className="flex flex-col space-y-1">
                  <Badge className={getStatusColor(tenant.status)}>
                    {tenant.status}
                  </Badge>
                  <Badge className={getPlanColor(tenant.subscription_plan)}>
                    {tenant.subscription_plan}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tenant.domain && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Domain</p>
                    <p className="text-sm text-gray-600">{tenant.domain}</p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm font-medium text-gray-700">Users</p>
                  <p className="text-sm text-gray-600">
                    {tenant.user_count} / {tenant.max_users}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">Features</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(tenant.features || {})
                      .filter(([_, enabled]) => enabled)
                      .slice(0, 3)
                      .map(([feature]) => (
                        <Badge key={feature} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    {Object.values(tenant.features || {}).filter(Boolean).length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{Object.values(tenant.features || {}).filter(Boolean).length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedTenant(tenant)}
                  >
                    Details
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => switchToTenant(tenant.code)}
                  >
                    Switch
                  </Button>
                  {tenant.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-yellow-600 hover:text-yellow-700"
                      onClick={() => updateTenantStatus(tenant.id, 'suspended')}
                    >
                      Suspend
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:text-green-700"
                      onClick={() => updateTenantStatus(tenant.id, 'active')}
                    >
                      Activate
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Tenant Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Tenant"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tenant Name
              </label>
              <Input
                value={newTenant.name}
                onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                placeholder="Acme Corporation"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tenant Code
              </label>
              <Input
                value={newTenant.code}
                onChange={(e) => setNewTenant({ ...newTenant, code: e.target.value.toUpperCase() })}
                placeholder="ACME_SA"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domain
            </label>
            <Input
              value={newTenant.domain}
              onChange={(e) => setNewTenant({ ...newTenant, domain: e.target.value })}
              placeholder="acme.fieldvibe.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subscription Plan
            </label>
            <select
              value={newTenant.subscriptionPlan}
              onChange={(e) => setNewTenant({ 
                ...newTenant, 
                subscriptionPlan: e.target.value as 'basic' | 'professional' | 'enterprise'
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="basic">Basic</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Admin User</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <Input
                  value={newTenant.adminUser.firstName}
                  onChange={(e) => setNewTenant({
                    ...newTenant,
                    adminUser: { ...newTenant.adminUser, firstName: e.target.value }
                  })}
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <Input
                  value={newTenant.adminUser.lastName}
                  onChange={(e) => setNewTenant({
                    ...newTenant,
                    adminUser: { ...newTenant.adminUser, lastName: e.target.value }
                  })}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                type="email"
                value={newTenant.adminUser.email}
                onChange={(e) => setNewTenant({
                  ...newTenant,
                  adminUser: { ...newTenant.adminUser, email: e.target.value }
                })}
                placeholder="admin@acme.com"
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <Input
                type="password"
                value={newTenant.adminUser.password}
                onChange={(e) => setNewTenant({
                  ...newTenant,
                  adminUser: { ...newTenant.adminUser, password: e.target.value }
                })}
                placeholder="Secure password"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={createTenant}>
              Create Tenant
            </Button>
          </div>
        </div>
      </Modal>

      {/* Tenant Details Modal */}
      {selectedTenant && (
        <Modal
          isOpen={!!selectedTenant}
          onClose={() => setSelectedTenant(null)}
          title={`Tenant Details: ${selectedTenant.name}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Name</p>
                <p className="text-sm text-gray-900">{selectedTenant.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Code</p>
                <p className="text-sm text-gray-900">{selectedTenant.code}</p>
              </div>
            </div>

            {selectedTenant.domain && (
              <div>
                <p className="text-sm font-medium text-gray-700">Domain</p>
                <p className="text-sm text-gray-900">{selectedTenant.domain}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Status</p>
                <Badge className={getStatusColor(selectedTenant.status)}>
                  {selectedTenant.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Plan</p>
                <Badge className={getPlanColor(selectedTenant.subscription_plan)}>
                  {selectedTenant.subscription_plan}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700">Users</p>
              <p className="text-sm text-gray-900">
                {selectedTenant.user_count} / {selectedTenant.max_users}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Features</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(selectedTenant.features || {}).map(([feature, enabled]) => (
                  <div key={feature} className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700">Created</p>
              <p className="text-sm text-gray-900">
                {new Date(selectedTenant.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default TenantManagement