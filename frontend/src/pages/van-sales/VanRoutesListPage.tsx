import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vanSalesService } from '../../services/van-sales.service'
import { Plus, Edit, Trash2, MapPin, TrendingUp, Calendar, Truck } from 'lucide-react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

export default function VanRoutesListPage() {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const [filter, setFilter] = useState({ page: 1, limit: 20, status: '' })
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['van-routes', filter],
    queryFn: () => vanSalesService.getRoutes(filter)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vanSalesService.deleteRoute(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['van-routes'] })
  })

  const routes = data?.data || []
  const total = data?.total || 0

  const getStatusBadge = (status: string) => {
    const colors = {
      planned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>{status.replace('_', ' ').toUpperCase()}</span>
  }

  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">Failed to load van routes.</p></div></div>
  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded"></div>)}</div><div className="h-64 bg-gray-200 rounded"></div></div></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-gray-900">Van Routes</h1><p className="text-sm text-gray-600 mt-1">Manage van routes ({total} total)</p></div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"><Plus className="h-4 w-4" /><span>Create Route</span></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Routes</p><p className="text-2xl font-bold text-gray-900">{total}</p></div><MapPin className="h-8 w-8 text-blue-500" /></div></div>
        <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">In Progress</p><p className="text-2xl font-bold text-yellow-600">{routes.filter(r => r.status === 'in_progress').length}</p></div><Truck className="h-8 w-8 text-yellow-500" /></div></div>
        <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Completed</p><p className="text-2xl font-bold text-green-600">{routes.filter(r => r.status === 'completed').length}</p></div><TrendingUp className="h-8 w-8 text-green-500" /></div></div>
        <div className="bg-white rounded-lg shadow p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Planned</p><p className="text-2xl font-bold text-blue-600">{routes.filter(r => r.status === 'planned').length}</p></div><Calendar className="h-8 w-8 text-blue-500" /></div></div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Van</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stops</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {routes.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500"><MapPin className="h-12 w-12 mx-auto text-gray-400 mb-2" /><p>No routes found</p></td></tr>
              ) : (
                routes.map(route => (
                  <tr key={route.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{route.route_name}</div><div className="text-sm text-gray-500">{route.start_location} → {route.end_location}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-900">Van #{route.van_id?.substring(0,8)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{new Date(route.route_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4"><div className="text-sm text-gray-900">{route.completed_stops}/{route.planned_stops}</div><div className="w-full bg-gray-200 rounded-full h-2 mt-1"><div className="bg-blue-600 h-2 rounded-full" style={{width: `${(route.completed_stops/route.planned_stops)*100}%`}}></div></div></td>
                    <td className="px-6 py-4">{getStatusBadge(route.status)}</td>
                    <td className="px-6 py-4"><div className="flex space-x-2"><button className="text-blue-600 hover:text-blue-900"><Edit className="h-4 w-4" /></button><button onClick={() => {setDeleteConfirmId(route.id)}} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button></div></td>
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
