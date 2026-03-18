import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Calendar, MapPin, CheckSquare, Camera, BarChart3 } from 'lucide-react'

interface VisitConfiguration {
  id: string
  name: string
  description: string
  target_type: 'brand' | 'customer_type' | 'all'
  brand_id?: string
  brand_name?: string
  customer_type?: string
  valid_from: string
  valid_to: string
  survey_id?: string
  survey_title?: string
  survey_required: boolean
  requires_board_placement: boolean
  board_id?: string
  board_name?: string
  board_photo_required: boolean
  track_coverage_analytics: boolean
  visit_type?: string
  default_duration_minutes: number
  is_active: boolean
  created_at: string
}

export default function VisitConfigurationPage() {
  const [showModal, setShowModal] = useState(false)
  const [editingConfig, setEditingConfig] = useState<VisitConfiguration | null>(null)
  const queryClient = useQueryClient()

  const { data: configurations, isLoading, isError } = useQuery({
    queryKey: ['visit-configurations'],
    queryFn: async () => {
      const response = await fetch('/api/visit-configurations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO'
        }
      })
      const result = await response.json()
      return result.data || []
    }
  })

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const response = await fetch('/api/brands', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO'
        }
      })
      const result = await response.json()
      return result.data || []
    }
  })

  const { data: surveys } = useQuery({
    queryKey: ['surveys'],
    queryFn: async () => {
      const response = await fetch('/api/surveys', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO'
        }
      })
      const result = await response.json()
      return result.data || []
    }
  })

  const { data: boards } = useQuery({
    queryKey: ['boards'],
    queryFn: async () => {
      const response = await fetch('/api/boards', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO'
        }
      })
      const result = await response.json()
      return result.data || []
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/visit-configurations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO'
        }
      })
      if (!response.ok) throw new Error('Failed to delete configuration')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visit-configurations'] })
    }
  })

  const getTargetTypeLabel = (config: VisitConfiguration) => {
    if (config.target_type === 'brand') return `Brand: ${config.brand_name}`
    if (config.target_type === 'customer_type') return `Type: ${config.customer_type}`
    return 'All Customers'
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Inactive</span>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 text-lg font-medium">Failed to load data</p>
          <p className="text-gray-500 mt-2">Please try refreshing the page</p>
        </div>
      </div>
    )
  }


  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visit Configurations</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure visits by brand, customer type, with surveys and board placements
          </p>
        </div>
        <button
          onClick={() => {
            setEditingConfig(null)
            setShowModal(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>New Configuration</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Range</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Features</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {configurations?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p>No visit configurations found</p>
                    <p className="text-sm mt-1">Create your first configuration to get started</p>
                  </td>
                </tr>
              ) : (
                configurations?.map((config: VisitConfiguration) => (
                  <tr key={config.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{config.name}</div>
                      <div className="text-sm text-gray-500">{config.description}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getTargetTypeLabel(config)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {new Date(config.valid_from).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        to {new Date(config.valid_to).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {config.survey_id && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <CheckSquare className="h-3 w-3 mr-1" />
                            Survey{config.survey_required && ' (Required)'}
                          </span>
                        )}
                        {config.requires_board_placement && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <Camera className="h-3 w-3 mr-1" />
                            Board
                          </span>
                        )}
                        {config.track_coverage_analytics && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <BarChart3 className="h-3 w-3 mr-1" />
                            Analytics
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(config.is_active)}</td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingConfig(config)
                            setShowModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this configuration?')) {
                              deleteMutation.mutate(config.id)
                            }
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ConfigurationModal
          config={editingConfig}
          brands={brands || []}
          surveys={surveys || []}
          boards={boards || []}
          onClose={() => {
            setShowModal(false)
            setEditingConfig(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['visit-configurations'] })
            setShowModal(false)
            setEditingConfig(null)
          }}
        />
      )}
    </div>
  )
}

interface ConfigurationModalProps {
  config: VisitConfiguration | null
  brands: any[]
  surveys: any[]
  boards: any[]
  onClose: () => void
  onSuccess: () => void
}

function ConfigurationModal({ config, brands, surveys, boards, onClose, onSuccess }: ConfigurationModalProps) {
  const [formData, setFormData] = useState({
    name: config?.name || '',
    description: config?.description || '',
    target_type: config?.target_type || 'all',
    brand_id: config?.brand_id || '',
    customer_type: config?.customer_type || '',
    valid_from: config?.valid_from?.split('T')[0] || '',
    valid_to: config?.valid_to?.split('T')[0] || '',
    survey_id: config?.survey_id || '',
    survey_required: config?.survey_required || false,
    requires_board_placement: config?.requires_board_placement || false,
    board_id: config?.board_id || '',
    board_photo_required: config?.board_photo_required || false,
    track_coverage_analytics: config?.track_coverage_analytics || false,
    visit_type: config?.visit_type || 'field_visit',
    default_duration_minutes: config?.default_duration_minutes || 30,
    is_active: config?.is_active !== undefined ? config.is_active : true
  })

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = config
        ? `/api/visit-configurations/${config.id}`
        : '/api/visit-configurations'
      const response = await fetch(url, {
        method: config ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO'
        },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to save configuration')
      return response.json()
    },
    onSuccess
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {config ? 'Edit' : 'New'} Visit Configuration
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Type *</label>
              <select
                required
                value={formData.target_type}
                onChange={e => setFormData({ ...formData, target_type: e.target.value as any })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">All Customers</option>
                <option value="brand">Specific Brand</option>
                <option value="customer_type">Customer Type</option>
              </select>
            </div>

            {formData.target_type === 'brand' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                <select
                  required
                  value={formData.brand_id}
                  onChange={e => setFormData({ ...formData, brand_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Select Brand</option>
                  {brands.map(brand => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.target_type === 'customer_type' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type *</label>
                <select
                  required
                  value={formData.customer_type}
                  onChange={e => setFormData({ ...formData, customer_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Select Type</option>
                  <option value="spaza">Spaza Shop</option>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="distributor">Distributor</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid From *</label>
              <input
                type="date"
                required
                value={formData.valid_from}
                onChange={e => setFormData({ ...formData, valid_from: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid To *</label>
              <input
                type="date"
                required
                value={formData.valid_to}
                onChange={e => setFormData({ ...formData, valid_to: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Survey Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Survey</label>
                <select
                  value={formData.survey_id}
                  onChange={e => setFormData({ ...formData, survey_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">No Survey</option>
                  {surveys.map(survey => (
                    <option key={survey.id} value={survey.id}>{survey.title}</option>
                  ))}
                </select>
              </div>
              {formData.survey_id && (
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.survey_required}
                    onChange={e => setFormData({ ...formData, survey_required: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Survey is mandatory</span>
                </label>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Board Placement Configuration</h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.requires_board_placement}
                  onChange={e => setFormData({ ...formData, requires_board_placement: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Requires board placement</span>
              </label>
              {formData.requires_board_placement && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Board</label>
                    <select
                      value={formData.board_id}
                      onChange={e => setFormData({ ...formData, board_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">Any Board</option>
                      {boards.map(board => (
                        <option key={board.id} value={board.id}>{board.name}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.board_photo_required}
                      onChange={e => setFormData({ ...formData, board_photo_required: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Photo capture required</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.track_coverage_analytics}
                      onChange={e => setFormData({ ...formData, track_coverage_analytics: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Track coverage % analytics</span>
                  </label>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Configuration is active</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-surface-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
