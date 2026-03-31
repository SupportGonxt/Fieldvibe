import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Award, Plus, Trash2, Save, Edit2, Building2, DollarSign, Percent, TrendingUp } from 'lucide-react'
import { toast } from 'react-hot-toast'
import SearchableSelect from '../../components/ui/SearchableSelect'

interface TierForm {
  company_id: string
  tier_name: string
  min_achievement_pct: number
  max_achievement_pct: number | ''
  commission_rate: number
  bonus_amount: number
  metric_type: string
}

const defaultForm: TierForm = {
  company_id: '',
  tier_name: '',
  min_achievement_pct: 0,
  max_achievement_pct: '',
  commission_rate: 0,
  bonus_amount: 0,
  metric_type: 'visits',
}

export default function TargetCommissionsPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TierForm>({ ...defaultForm })

  const { data: tiers, isLoading, isError } = useQuery({
    queryKey: ['commission-tiers'],
    queryFn: () => fieldOperationsService.getCommissionTiers(),
  })

  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })

  const companies = companiesResp?.data || companiesResp || []
  const tierList = tiers?.data || tiers || []

  const createMutation = useMutation({
    mutationFn: (data: TierForm) => {
      const payload: any = { ...data }
      if (payload.max_achievement_pct === '') delete payload.max_achievement_pct
      return fieldOperationsService.createCommissionTier(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-tiers'] })
      toast.success('Commission tier created')
      setShowCreate(false)
      setForm({ ...defaultForm })
    },
    onError: () => toast.error('Failed to create tier'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fieldOperationsService.updateCommissionTier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-tiers'] })
      toast.success('Commission tier updated')
      setEditingId(null)
      setForm({ ...defaultForm })
    },
    onError: () => toast.error('Failed to update tier'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.deleteCommissionTier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-tiers'] })
      toast.success('Tier deleted')
    },
    onError: () => toast.error('Failed to delete tier'),
  })

  function startEdit(tier: any) {
    setEditingId(tier.id)
    setForm({
      company_id: tier.company_id || '',
      tier_name: tier.tier_name,
      min_achievement_pct: tier.min_achievement_pct,
      max_achievement_pct: tier.max_achievement_pct ?? '',
      commission_rate: tier.commission_rate,
      bonus_amount: tier.bonus_amount || 0,
      metric_type: tier.metric_type || 'visits',
    })
    setShowCreate(true)
  }

  function handleSave() {
    if (!form.tier_name) {
      toast.error('Tier name is required')
      return
    }
    if (editingId) {
      const payload: any = { ...form }
      if (payload.max_achievement_pct === '') delete payload.max_achievement_pct
      updateMutation.mutate({ id: editingId, data: payload })
    } else {
      createMutation.mutate(form)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commission Tiers</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure commission rates based on target achievement percentage. Higher achievement = higher commission.
          </p>
        </div>
        <button onClick={() => { setShowCreate(!showCreate); setEditingId(null); setForm({ ...defaultForm }) }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Add Tier</span>
        </button>
      </div>

      {/* How it works */}
      <div className="card p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
        <p className="text-sm text-yellow-800 dark:text-yellow-300">
          <strong>How it works:</strong> When monthly targets are recalculated, the system compares actual vs target.
          The achievement % determines which tier applies. Commission = (actual count x rate) + bonus.
        </p>
      </div>

      {/* Create/Edit Form */}
      {showCreate && (
        <div className="card p-6 border-2 border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingId ? 'Edit Commission Tier' : 'New Commission Tier'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tier Name *</label>
              <input
                type="text"
                value={form.tier_name}
                onChange={(e) => setForm({ ...form, tier_name: e.target.value })}
                className="input w-full"
                placeholder="e.g. Bronze, Silver, Gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company (optional)</label>
              <SearchableSelect
                options={[
                  { value: '', label: 'All Companies' },
                  ...companies.map((c: any) => ({ value: c.id, label: c.name }))
                ]}
                value={form.company_id || null}
                onChange={(val) => setForm({ ...form, company_id: val || '' })}
                placeholder="All Companies"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metric Type</label>
              <select
                value={form.metric_type}
                onChange={(e) => setForm({ ...form, metric_type: e.target.value })}
                className="input w-full"
              >
                <option value="visits">Visits</option>
                <option value="stores">Stores</option>
                <option value="conversions">Conversions</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Achievement %</label>
              <input
                type="number"
                value={form.min_achievement_pct}
                onChange={(e) => setForm({ ...form, min_achievement_pct: parseFloat(e.target.value) || 0 })}
                className="input w-full"
                min="0" max="200" step="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Achievement % (blank = unlimited)</label>
              <input
                type="number"
                value={form.max_achievement_pct}
                onChange={(e) => setForm({ ...form, max_achievement_pct: e.target.value ? parseFloat(e.target.value) : '' })}
                className="input w-full"
                min="0" max="999" step="1"
                placeholder="No cap"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Commission Rate (R per unit)</label>
              <input
                type="number"
                value={form.commission_rate}
                onChange={(e) => setForm({ ...form, commission_rate: parseFloat(e.target.value) || 0 })}
                className="input w-full"
                min="0" step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bonus Amount (R)</label>
              <input
                type="number"
                value={form.bonus_amount}
                onChange={(e) => setForm({ ...form, bonus_amount: parseFloat(e.target.value) || 0 })}
                className="input w-full"
                min="0" step="0.01"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSave}
              disabled={!form.tier_name || createMutation.isPending || updateMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingId ? 'Update Tier' : 'Create Tier'}
            </button>
            <button onClick={() => { setShowCreate(false); setEditingId(null); setForm({ ...defaultForm }) }} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Tiers Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Metric</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Achievement Range</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rate (R/unit)</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bonus (R)</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {Array.isArray(tierList) && tierList.map((tier: any) => (
                <tr key={tier.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-yellow-500" />
                      <span className="font-medium text-gray-900 dark:text-white">{tier.tier_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-300">{tier.company_name || 'All'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs font-medium capitalize">
                      {tier.metric_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Percent className="w-3 h-3 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {tier.min_achievement_pct}% — {tier.max_achievement_pct != null ? `${tier.max_achievement_pct}%` : '∞'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      R {Number(tier.commission_rate).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      R {Number(tier.bonus_amount || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      tier.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {tier.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(tier)} className="text-blue-600 hover:text-blue-800 p-1" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(tier.id)} className="text-red-600 hover:text-red-800 p-1" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!Array.isArray(tierList) || tierList.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-lg font-medium">No commission tiers configured</p>
                    <p className="text-gray-400 text-sm">Click "Add Tier" to set up tiered commission rates</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
