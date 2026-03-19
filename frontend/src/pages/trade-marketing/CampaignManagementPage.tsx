import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tradeMarketingService } from '../../services/tradeMarketing.service'
import { Plus, Edit, Trash2, TrendingUp, Calendar, Target } from 'lucide-react'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

export default function CampaignManagementPage() {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const [filter, setFilter] = useState({ page: 1, limit: 20, status: '' })
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['campaigns', filter],
    queryFn: () => tradeMarketingService.getCampaigns(filter)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tradeMarketingService.deleteCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] })
  })

  const campaigns = data?.data || []
  const total = data?.total || 0
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', {style: 'currency', currency: 'ZAR'}).format(amount)

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>{status.toUpperCase()}</span>
  }

  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">Failed to load campaigns.</p></div></div>
  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-64 bg-gray-200 rounded"></div></div></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-gray-900">Campaign Management</h1><p className="text-sm text-gray-600 mt-1">Manage trade marketing campaigns ({total} total)</p></div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"><Plus className="h-4 w-4" /><span>Create Campaign</span></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Campaigns</p><p className="text-2xl font-bold text-gray-900">{total}</p></div>
            <Target className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Active</p><p className="text-2xl font-bold text-green-600">{campaigns.filter(c => c.status === 'active').length}</p></div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Budget</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(campaigns.reduce((sum, c) => sum + (c.budget || 0), 0))}</p></div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Completed</p><p className="text-2xl font-bold text-blue-600">{campaigns.filter(c => c.status === 'completed').length}</p></div>
            <Calendar className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <SearchableSelect
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          value={filter.status || null}
          placeholder="All Statuses"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500"><Target className="h-12 w-12 mx-auto text-gray-400 mb-2" /><p>No campaigns found</p></td></tr>
              ) : (
                campaigns.map(campaign => (
                  <tr key={campaign.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{campaign.campaign_name}</div><div className="text-sm text-gray-500">{campaign.description}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-900">{campaign.brand_name}</td>
                    <td className="px-6 py-4"><div className="text-sm text-gray-900">{new Date(campaign.start_date).toLocaleDateString()}</div><div className="text-sm text-gray-500">to {new Date(campaign.end_date).toLocaleDateString()}</div></td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatCurrency(campaign.budget || 0)}</td>
                    <td className="px-6 py-4">{getStatusBadge(campaign.status)}</td>
                    <td className="px-6 py-4"><div className="flex space-x-2"><button className="text-blue-600 hover:text-blue-900"><Edit className="h-4 w-4" /></button><button onClick={() => {setDeleteConfirmId(campaign.id)}} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > filter.limit && (
        <div className="flex justify-between items-center bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-700">Showing {(filter.page-1)*filter.limit+1} to {Math.min(filter.page*filter.limit,total)} of {total}</div>
          <div className="flex space-x-2">
            <button onClick={() => setFilter({...filter, page: filter.page-1})} disabled={filter.page<=1} className="px-4 py-2 border rounded-lg disabled:opacity-50">Previous</button>
            <button onClick={() => setFilter({...filter, page: filter.page+1})} disabled={filter.page*filter.limit>=total} className="px-4 py-2 border rounded-lg disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => { if (deleteConfirmId) { deleteMutation.mutate(deleteConfirmId); setDeleteConfirmId(null); } }}
        title="Confirm Delete"
        message="Delete?"
        confirmLabel="Confirm"
        variant="danger"
      />
    </div>
  )
}
