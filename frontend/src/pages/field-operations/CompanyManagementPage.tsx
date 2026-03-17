import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Building2, Plus, Edit2, Trash2, Users, Mail, Phone, Save, X, Eye } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

export default function CompanyManagementPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', code: '', description: '', contact_email: '', contact_phone: '' })

  const { data: companiesResp, isLoading } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })

  const companies = companiesResp?.data || companiesResp || []

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => fieldOperationsService.createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-companies'] })
      toast.success('Company created')
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast.error('Failed to create company'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) => fieldOperationsService.updateCompany(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-companies'] })
      toast.success('Company updated')
      setEditingId(null)
      resetForm()
    },
    onError: () => toast.error('Failed to update company'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-companies'] })
      toast.success('Company deactivated')
    },
    onError: () => toast.error('Failed to deactivate company'),
  })

  function resetForm() {
    setForm({ name: '', code: '', description: '', contact_email: '', contact_phone: '' })
  }

  function startEdit(company: any) {
    setEditingId(company.id)
    setForm({ name: company.name, code: company.code, description: company.description || '', contact_email: company.contact_email || '', contact_phone: company.contact_phone || '' })
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage companies serviced by field agents (Goldrush, Stellr, Lotto, etc.)</p>
        </div>
        <button onClick={() => { setShowCreate(true); resetForm() }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Add Company</span>
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showCreate || editingId) && (
        <div className="card p-6 border-2 border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingId ? 'Edit Company' : 'Add New Company'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full" placeholder="e.g. Goldrush" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input w-full" placeholder="e.g. GOLDRUSH" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Email</label>
              <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="input w-full" placeholder="contact@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Phone</label>
              <input type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="input w-full" placeholder="011 123 4567" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input w-full" placeholder="Brief description" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                if (!form.name) return
                if (editingId) updateMutation.mutate({ id: editingId, data: form })
                else createMutation.mutate(form)
              }}
              disabled={!form.name || createMutation.isPending || updateMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {editingId ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setShowCreate(false); setEditingId(null); resetForm() }} className="btn-outline flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company: any) => (
          <div key={company.id} className="card p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{company.name}</h3>
                  <p className="text-sm text-gray-500">{company.code}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${company.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800'}`}>
                {company.status}
              </span>
            </div>
            {company.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{company.description}</p>
            )}
            <div className="space-y-2 mb-4">
              {company.contact_email && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Mail className="w-4 h-4" /> {company.contact_email}
                </div>
              )}
              {company.contact_phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Phone className="w-4 h-4" /> {company.contact_phone}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <button onClick={() => startEdit(company)} className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button onClick={() => navigate(`/field-operations/company-dashboard/${company.id}`)} className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Dashboard
                </button>
              </div>
              <button onClick={() => deleteMutation.mutate(company.id)} className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Deactivate
              </button>
            </div>
          </div>
        ))}
        {companies.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-lg font-medium">No companies configured</p>
            <p className="text-gray-400 text-sm">Add companies like Goldrush, Stellr, Lotto, or Mondelez</p>
          </div>
        )}
      </div>
    </div>
  )
}
