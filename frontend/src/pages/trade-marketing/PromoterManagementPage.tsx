import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tradeMarketingService } from '../../services/tradeMarketing.service'
import { Plus, Edit, Trash2, Users, TrendingUp } from 'lucide-react'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

export default function PromoterManagementPage() {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const [filter, setFilter] = useState({ page: 1, limit: 20, status: '' })
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['promoters', filter],
    queryFn: () => tradeMarketingService.getPromoters(filter)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tradeMarketingService.deletePromoter(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promoters'] })
  })

  const promoters = data?.data || []
  const total = data?.total || 0

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      on_leave: 'bg-yellow-100 text-yellow-800'
    }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>{status.replace('_', ' ').toUpperCase()}</span>
  }

  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">Failed to load promoters.</p></div></div>
  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-64 bg-gray-200 rounded"></div></div></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-gray-900">Promoter Management</h1><p className="text-sm text-gray-600 mt-1">Manage brand promoters ({total} total)</p></div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"><Plus className="h-4 w-4" /><span>Add Promoter</span></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Promoters</p><p className="text-2xl font-bold text-gray-900">{total}</p></div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Active</p><p className="text-2xl font-bold text-green-600">{promoters.filter(p => p.status === 'active').length}</p></div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">On Leave</p><p className="text-2xl font-bold text-yellow-600">{promoters.filter(p => p.status === 'on_leave').length}</p></div>
            <Users className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <SearchableSelect
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'on_leave', label: 'On Leave' },
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Join Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {promoters.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500"><Users className="h-12 w-12 mx-auto text-gray-400 mb-2" /><p>No promoters found</p></td></tr>
              ) : (
                promoters.map(promoter => (
                  <tr key={promoter.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{promoter.first_name} {promoter.last_name}</div><div className="text-sm text-gray-500">ID: {promoter.id?.substring(0,8)}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-900">{promoter.brand_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{promoter.assigned_location}</td>
                    <td className="px-6 py-4"><div className="text-sm text-gray-900">{promoter.phone}</div><div className="text-sm text-gray-500">{promoter.email}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-900">{promoter.join_date ? new Date(promoter.join_date).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4">{getStatusBadge(promoter.status)}</td>
                    <td className="px-6 py-4"><div className="flex space-x-2"><button className="text-blue-600 hover:text-blue-900"><Edit className="h-4 w-4" /></button><button onClick={() => {setDeleteConfirmId(promoter.id)}} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button></div></td>
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
