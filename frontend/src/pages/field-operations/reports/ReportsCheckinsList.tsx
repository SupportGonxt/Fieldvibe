import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { List, Filter, Eye , AlertTriangle } from 'lucide-react'

interface Checkin {
  id: string
  agent_id: string
  shop_id: string
  timestamp: string
  latitude: number
  longitude: number
  status: string
  notes: string
  visit_target_type: string
}

interface Agent {
  agent_id: string
  agent_name: string
}

const ReportsCheckinsList: React.FC = () => {
  const [page, setPage] = useState(1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('')
  const [agentId, setAgentId] = useState('')
  const [selectedCheckin, setSelectedCheckin] = useState<string | null>(null)

  const { data: agents = [] } = useQuery({
    queryKey: ['report-agents'],
    queryFn: async () => {
      const res = await apiClient.get('/field-ops/reports/agents')
      return (res.data?.agents || []) as Agent[]
    },
  })

  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  if (status) params.set('status', status)
  if (agentId) params.set('agentId', agentId)

  const { data, isLoading , isError } = useQuery({
    queryKey: ['report-checkins', page, startDate, endDate, status, agentId],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/checkins?${params.toString()}`)
      return { checkins: (res.data?.checkins || []) as Checkin[], total: res.data?.total || 0 }
    },
  })

  const { data: checkinDetail } = useQuery({
    queryKey: ['checkin-detail', selectedCheckin],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/checkins/${selectedCheckin}`)
      return res.data
    },
    enabled: !!selectedCheckin,
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Failed to load data</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">Please try refreshing the page</p>
    </div>
  )


  const totalPages = Math.ceil((data?.total || 0) / 20)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Check-ins List</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Browse and filter all check-in records</p>
        </div>
        <div className="text-sm text-gray-500">{data?.total || 0} records</div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Start Date" />
          <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="End Date" />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={agentId} onChange={e => { setAgentId(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            <option value="">All Agents</option>
            {agents.map(a => <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>)}
          </select>
        </div>
      </div>

      {/* Checkin Detail Modal */}
      {selectedCheckin && checkinDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCheckin(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Check-in Details</h3>
            <div className="space-y-3 text-sm">
              {Object.entries(checkinDetail.checkin || {}).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                  <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{String(val ?? '-')}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedCheckin(null)} className="mt-4 w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm">Close</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Agent</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Location</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(data?.checkins || []).length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">No check-ins found</td></tr>
              ) : (data?.checkins || []).map((c) => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 text-gray-900 dark:text-white text-xs">{c.timestamp ? new Date(c.timestamp).toLocaleString() : '-'}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{c.agent_id?.slice(0, 8) || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.visit_target_type === 'store' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>{c.visit_target_type || 'general'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      c.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>{c.status}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {c.latitude && c.longitude ? `${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => setSelectedCheckin(c.id)} className="text-blue-600 hover:text-blue-700">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReportsCheckinsList
