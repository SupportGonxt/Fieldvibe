import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { Users, TrendingUp, MapPin , AlertTriangle } from 'lucide-react'

interface CustomerRecord {
  checkin_id: string
  timestamp: string
  latitude: number
  longitude: number
  agent_id: string
  agent_name: string
  shop_name: string
  shop_id: string
  responses: string
  converted: number
  already_betting: number
}

const ReportsCustomersAnalytics: React.FC = () => {
  const [page, setPage] = useState(1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const dateParams = `${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`

  const { data, isLoading , isError } = useQuery({
    queryKey: ['customers-analytics', page, startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/customers-analytics?page=${page}&limit=20${dateParams}`)
      return {
        customers: (res.data?.customers || []) as CustomerRecord[],
        total: res.data?.total || 0,
        stats: res.data?.stats || { total_customers: 0, converted: 0, already_betting: 0 },
      }
    },
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
  const stats = data?.stats || { total_customers: 0, converted: 0, already_betting: 0 }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Customer interaction analysis and conversion tracking</p>
        </div>
        <div className="flex gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <Users className="h-5 w-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_customers}</p>
          <p className="text-sm text-gray-500">Total Customer Interactions</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <TrendingUp className="h-5 w-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.converted}</p>
          <p className="text-sm text-gray-500">Converted</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <MapPin className="h-5 w-5 text-purple-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.already_betting}</p>
          <p className="text-sm text-gray-500">Store Visits</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Agent</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Shop</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Converted</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Store Visit</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Location</th>
              </tr>
            </thead>
            <tbody>
              {(data?.customers || []).length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">No customer data available</td></tr>
              ) : (data?.customers || []).map((c) => (
                <tr key={c.checkin_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 text-gray-900 dark:text-white text-xs">
                    {c.timestamp ? new Date(c.timestamp).toLocaleString() : '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{c.agent_name || 'Unknown'}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{c.shop_name || '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.converted ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>{c.converted ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.already_betting ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>{c.already_betting ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {c.latitude && c.longitude ? `${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}` : '-'}
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

export default ReportsCustomersAnalytics
