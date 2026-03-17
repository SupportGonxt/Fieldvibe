import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import { Calendar, MapPin, Clock, FileText } from 'lucide-react'

export default function VisitHistoryPage() {
  const [filter, setFilter] = useState({ page: 1, limit: 20, agent_id: '', start_date: '', end_date: '' })
  const { data, isLoading, error } = useQuery({
    queryKey: ['visit-history', filter],
    queryFn: () => fieldOperationsService.getVisitHistory(filter)
  })

  const visits = data?.data || []
  const total = data?.total || 0

  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-64 bg-gray-200 rounded"></div></div></div>
  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">Failed to load visit history.</p></div></div>

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Visit History</h1><p className="text-sm text-gray-600 mt-1">View past visit records ({total} total)</p></div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent ID</label>
            <input type="text" placeholder="Filter by agent" value={filter.agent_id} onChange={e => setFilter({...filter, agent_id: e.target.value, page: 1})} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" value={filter.start_date} onChange={e => setFilter({...filter, start_date: e.target.value, page: 1})} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" value={filter.end_date} onChange={e => setFilter({...filter, end_date: e.target.value, page: 1})} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In/Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visits.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500"><Calendar className="h-12 w-12 mx-auto text-gray-400 mb-2" /><p>No visit history found</p></td></tr>
              ) : (
                visits.map(visit => {
                  const duration = visit.check_in_time && visit.check_out_time ? Math.round((new Date(visit.check_out_time).getTime() - new Date(visit.check_in_time).getTime()) / 60000) : null
                  return (
                    <tr key={visit.id} className="hover:bg-surface-secondary">
                      <td className="px-6 py-4 text-sm text-gray-900">{new Date(visit.visit_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{visit.customer_name}</div></td>
                      <td className="px-6 py-4 text-sm text-gray-900">Agent #{visit.agent_id?.substring(0,8)}</td>
                      <td className="px-6 py-4"><div className="text-sm text-gray-900">{visit.check_in_time ? new Date(visit.check_in_time).toLocaleTimeString() : '-'}</div><div className="text-sm text-gray-500">{visit.check_out_time ? new Date(visit.check_out_time).toLocaleTimeString() : '-'}</div></td>
                      <td className="px-6 py-4 text-sm text-gray-900">{duration ? `${duration} min` : '-'}</td>
                      <td className="px-6 py-4"><div className="text-sm text-gray-500 max-w-xs truncate">{visit.notes || '-'}</div></td>
                    </tr>
                  )
                })
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
    </div>
  )
}
