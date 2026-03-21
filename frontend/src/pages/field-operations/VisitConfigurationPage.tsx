import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Calendar, MapPin, CheckSquare, Camera, BarChart3 } from 'lucide-react'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { apiClient } from '../../services/api.service'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

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
  visit_category: 'field_operations' | 'marketing' | 'both'
  default_duration_minutes: number
  is_active: boolean
  created_at: string
}

export default function VisitConfigurationPage() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ title: string; message: string; action: () => void }>({ title: '', message: '', action: () => {} })
  const [showModal, setShowModal] = useState(false)
  const [editingConfig, setEditingConfig] = useState<VisitConfiguration | null>(null)
  const queryClient = useQueryClient()

  const { data: configurations, isLoading, isError } = useQuery({
    queryKey: ['visit-configurations'],
    queryFn: async () => {
      const response = await apiClient.get('/visit-configurations')
      return response.data.data || []
    }
  })

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const response = await apiClient.get('/brands')
      return response.data.data || []
    }
  })

  const { data: surveys } = useQuery({
    queryKey: ['surveys'],
    queryFn: async () => {
      const response = await apiClient.get('/surveys')
      return response.data.data || []
    }
  })

  const { data: boards } = useQuery({
    queryKey: ['boards'],
    queryFn: async () => {
      const response = await apiClient.get('/boards')
      return response.data.data || []
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/visit-configurations/${id}`)
      return response.data
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
                        {config.visit_category && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            config.visit_category === 'marketing' ? 'bg-orange-100 text-orange-800' :
                            config.visit_category === 'both' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-cyan-100 text-cyan-800'
                          }`}>
                            {config.visit_category === 'marketing' ? 'Marketing' :
                             config.visit_category === 'both' ? 'Field Ops & Marketing' :
                             'Field Ops'}
                          </span>
                        )}
                        {config.survey_id && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            config.survey_required ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            <CheckSquare className="h-3 w-3 mr-1" />
                            Survey ({config.survey_required ? 'Mandatory' : 'Optional'})
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
            setPendingAction({ title: 'Confirm', message: 'Delete this configuration?', action: async () => {
                              deleteMutation.mutate(config.id)
                            } })
                            setConfirmOpen(true)
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
    visit_category: config?.visit_category || 'field_operations',
    default_duration_minutes: config?.default_duration_minutes || 30,
    is_active: config?.is_active !== undefined ? config.is_active : true
  })

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (config) {
        const response = await apiClient.put(`/visit-configurations/${config.id}`, data)
        return response.data
      } else {
        const response = await apiClient.post('/visit-configurations', data)
        return response.data
      }
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
              <SearchableSelect
                options={[
                  { value: 'all', label: 'All Customers' },
                  { value: 'brand', label: 'Specific Brand' },
                  { value: 'customer_type', label: 'Customer Type' },
                ]}
                value={formData.target_type}
              onChange={(val) => setFormData(prev => ({...prev, target_type: val}))}
                placeholder="All Customers"
              />
            </div>

            {formData.target_type === 'brand' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select Brand' },
                    { value: 'brand.id', label: '{brand.name}' },
                  ]}
                  value={formData.brand_id || null}
              onChange={(val) => setFormData(prev => ({...prev, brand_id: val}))}
                  placeholder="Select Brand"
                />
              </div>
            )}

            {formData.target_type === 'customer_type' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select Type' },
                    { value: 'spaza', label: 'Spaza Shop' },
                    { value: 'retail', label: 'Retail' },
                    { value: 'wholesale', label: 'Wholesale' },
                    { value: 'distributor', label: 'Distributor' },
                  ]}
                  value={formData.customer_type || null}
              onChange={(val) => setFormData(prev => ({...prev, customer_type: val}))}
                  placeholder="Select Type"
                />
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
            <h3 className="text-sm font-medium text-gray-900 mb-3">Visit Category</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applies To *</label>
                <SearchableSelect
                  options={[
                    { value: 'field_operations', label: 'Field Operations' },
                    { value: 'marketing', label: 'Marketing' },
                    { value: 'both', label: 'Both (Field Ops & Marketing)' },
                  ]}
                  value={formData.visit_category}
                  onChange={(val: string) => setFormData({ ...formData, visit_category: val as 'field_operations' | 'marketing' | 'both' })}
                  placeholder="Select Category"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
                <SearchableSelect
                  options={[
                    { value: 'field_visit', label: 'Field Visit' },
                    { value: 'store_check', label: 'Store Check' },
                    { value: 'merchandising', label: 'Merchandising' },
                    { value: 'delivery', label: 'Delivery' },
                    { value: 'activation', label: 'Brand Activation' },
                    { value: 'audit', label: 'Audit' },
                  ]}
                  value={formData.visit_type}
                  onChange={(val: string) => setFormData({ ...formData, visit_type: val })}
                  placeholder="Select Visit Type"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Duration (minutes)</label>
              <input
                type="number"
                min={5}
                max={480}
                value={formData.default_duration_minutes}
                onChange={e => setFormData({ ...formData, default_duration_minutes: parseInt(e.target.value) || 30 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Survey Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Survey Template</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'No Survey' },
                    ...((surveys || []) as Array<{id: string; title: string}>).map((s: {id: string; title: string}) => ({ value: s.id, label: s.title }))
                  ]}
                  value={formData.survey_id || null}
                  onChange={(val: string) => setFormData({ ...formData, survey_id: val })}
                  placeholder="No Survey"
                />
              </div>
              {formData.survey_id && (
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 space-y-2">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="survey_mode"
                        checked={formData.survey_required}
                        onChange={() => setFormData({ ...formData, survey_required: true })}
                        className="text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-900">Mandatory</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="survey_mode"
                        checked={!formData.survey_required}
                        onChange={() => setFormData({ ...formData, survey_required: false })}
                        className="text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-900">Optional</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-600">
                    {formData.survey_required
                      ? 'Agent must complete this survey before checking out of the visit.'
                      : 'Agent can skip this survey during the visit.'}
                  </p>
                </div>
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
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Any Board' },
                        { value: 'board.id', label: '{board.name}' },
                      ]}
                      value={formData.board_id || null}
              onChange={(val) => setFormData(prev => ({...prev, board_id: val}))}
                      placeholder="Any Board"
                    />
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
    
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { pendingAction.action(); setConfirmOpen(false); }}
        title={pendingAction.title}
        message={pendingAction.message}
        confirmLabel="Confirm"
        variant="danger"
      />
    </div>
  )
}
