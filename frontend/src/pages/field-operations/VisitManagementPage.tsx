import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import { Plus, Edit, Trash2, MapPin, Calendar, Map, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import LiveVisitMap from '../../components/maps/LiveVisitMap'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

export default function VisitManagementPage() {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const [filter, setFilter] = useState({ page: 1, limit: 20, status: '' })
  const [showMap, setShowMap] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['visits', filter],
    queryFn: () => fieldOperationsService.getVisits(filter)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.deleteVisit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits'] })
  })

  const visits = data?.data || []
  const total = data?.total || 0

  const getStatusBadge = (status: string) => {
    const colors = {
      planned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>{status.toUpperCase()}</span>
  }

  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">Failed to load visits.</p></div></div>
  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-64 bg-gray-200 rounded"></div></div></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-gray-900">Visit Management</h1><p className="text-sm text-gray-600 mt-1">Schedule and manage field visits ({total} total)</p></div>
        <div className="flex space-x-2">
          <button 
            onClick={() => navigate('/field-operations/visit-configurations')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>Configurations</span>
          </button>
          <button 
            onClick={() => setShowMap(!showMap)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Map className="h-4 w-4" />
            <span>{showMap ? 'Hide' : 'Show'} Map</span>
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"><Plus className="h-4 w-4" /><span>Schedule Visit</span></button>
        </div>
      </div>

      {showMap && (
        <div className="bg-white rounded-lg shadow p-4" style={{ height: '500px' }}>
          <LiveVisitMap 
            visits={visits.map(v => ({
              id: v.id,
              customer_name: v.customer_name,
              agent_name: v.agent_name || 'Unknown',
              status: v.status,
              lat: v.latitude,
              lng: v.longitude,
              visit_date: v.visit_date
            }))}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <SearchableSelect
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'planned', label: 'Planned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            value={filter.status || null}
            placeholder="All Statuses"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visits.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500"><Calendar className="h-12 w-12 mx-auto text-gray-400 mb-2" /><p>No visits found</p></td></tr>
              ) : (
                visits.map(visit => (
                  <tr key={visit.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{visit.customer_name}</div><div className="text-sm text-gray-500">ID: {visit.customer_id?.substring(0,8)}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-900">Agent #{visit.agent_id?.substring(0,8)}</td>
                    <td className="px-6 py-4"><div className="text-sm text-gray-900">{new Date(visit.visit_date).toLocaleDateString()}</div><div className="text-sm text-gray-500">{visit.check_in_time ? new Date(visit.check_in_time).toLocaleTimeString() : 'Not started'}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-900">{visit.visit_type}</td>
                    <td className="px-6 py-4">{getStatusBadge(visit.status)}</td>
                    <td className="px-6 py-4"><div className="flex space-x-2"><button className="text-blue-600 hover:text-blue-900"><Edit className="h-4 w-4" /></button><button onClick={() => {setDeleteConfirmId(visit.id)}} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button></div></td>
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
