import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { Store, MapPin, Eye, ChevronLeft , AlertTriangle } from 'lucide-react'

interface Shop {
  id: string
  name: string
  address: string
  total_checkins: number
  approved_checkins: number
  conversions: number
  last_visit: string
}

interface ShopDetail {
  shop: Record<string, unknown>
  checkins: Array<{ id: string; timestamp: string; status: string; converted: number; responses: string }>
  stats: { total_checkins: number; approved: number; conversions: number }
}

const ReportsShopsAnalytics: React.FC = () => {
  const [page, setPage] = useState(1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedShop, setSelectedShop] = useState<string | null>(null)

  const dateParams = `${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`

  const { data, isLoading , isError } = useQuery({
    queryKey: ['shops-analytics', page, startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/shops-analytics?page=${page}&limit=15${dateParams}`)
      return { shops: (res.data?.shops || []) as Shop[], total: res.data?.total || 0 }
    },
  })

  const { data: shopDetail, isLoading: detailLoading , isError: isDetailError } = useQuery({
    queryKey: ['shop-detail', selectedShop],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/shops/${selectedShop}`)
      return res.data as ShopDetail
    },
    enabled: !!selectedShop,
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Failed to load data</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">Please try refreshing the page</p>
    </div>
  )


  if (selectedShop && shopDetail) {
    const shop = shopDetail.shop as Record<string, string>
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedShop(null)} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
          <ChevronLeft className="h-4 w-4" /> Back to Stores
        </button>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{shop.name || 'Store Details'}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{shop.address || 'No address'}</p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{shopDetail.stats?.total_checkins || 0}</p>
              <p className="text-xs text-blue-700 dark:text-blue-400">Total Check-ins</p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{shopDetail.stats?.approved || 0}</p>
              <p className="text-xs text-green-700 dark:text-green-400">Approved</p>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{shopDetail.stats?.conversions || 0}</p>
              <p className="text-xs text-purple-700 dark:text-purple-400">Conversions</p>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Recent Check-ins</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Converted</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(shopDetail.checkins || []).map(c => (
                  <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 px-3 text-gray-900 dark:text-white">{c.timestamp ? new Date(c.timestamp).toLocaleDateString() : '-'}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">{c.converted ? <span className="text-green-600 font-medium">Yes</span> : <span className="text-gray-400">No</span>}</td>
                    <td className="py-2 px-3 text-gray-500 truncate max-w-[200px]">{c.responses || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil((data?.total || 0) / 15)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Store Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Store-level check-in analytics and conversion rates</p>
        </div>
        <div className="flex gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <Store className="h-5 w-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.total || 0}</p>
          <p className="text-sm text-gray-500">Total Stores</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <MapPin className="h-5 w-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {(data?.shops || []).reduce((s, shop) => s + shop.total_checkins, 0)}
          </p>
          <p className="text-sm text-gray-500">Total Check-ins</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <Eye className="h-5 w-5 text-purple-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {(data?.shops || []).reduce((s, shop) => s + shop.conversions, 0)}
          </p>
          <p className="text-sm text-gray-500">Total Conversions</p>
        </div>
      </div>

      {/* Shops Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Store</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Check-ins</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Approved</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Conversions</th>
                <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Last Visit</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(data?.shops || []).length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">No stores found</td></tr>
              ) : (data?.shops || []).map((shop) => (
                <tr key={shop.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900 dark:text-white">{shop.name}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{shop.address || '-'}</p>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{shop.total_checkins}</td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{shop.approved_checkins}</td>
                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{shop.conversions}</td>
                  <td className="py-3 px-4 text-right text-gray-500 text-xs">{shop.last_visit ? new Date(shop.last_visit).toLocaleDateString() : '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => setSelectedShop(shop.id)} className="text-blue-600 hover:text-blue-700 text-xs font-medium">View</button>
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

export default ReportsShopsAnalytics
