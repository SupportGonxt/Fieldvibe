import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, TrendingUp, TrendingDown } from 'lucide-react'
import { vanSalesService } from '../../../services/van-sales.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function VanLoadItemList() {
  const { loadId } = useParams<{ loadId: string }>()
  const navigate = useNavigate()

  const { data: load } = useQuery({
    queryKey: ['van-load', loadId],
    queryFn: async () => {
      const response = await apiClient.get(`/van-loads/${loadId}`)
      const result = response.data
      return result.data
    },
  })

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['van-load-items', loadId],
    queryFn: async () => {
      if (!loadId) return []
      return await vanSalesService.getVanLoadItems(loadId)
    },
    enabled: !!loadId,
  })

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner size="md" /></div>
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
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/van-sales/loads/${loadId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Van Load
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Van Load Items</h1>
        <p className="text-gray-600">{load?.load_number} - {load?.agent_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Loaded</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sold</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Returned</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sell-Through</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items?.map((item) => {
              const sellThrough = ((item.quantity_sold / item.quantity_loaded) * 100).toFixed(1)
              return (
                <tr key={item.id} className="hover:bg-surface-secondary">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.product_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.product_sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {item.quantity_loaded}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <div className="flex items-center justify-end gap-1 text-green-600 font-medium">
                      <TrendingDown className="h-3 w-3" />
                      {item.quantity_sold}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <div className="flex items-center justify-end gap-1 text-orange-600">
                      <TrendingUp className="h-3 w-3" />
                      {item.quantity_returned}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    {item.quantity_remaining}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      parseFloat(sellThrough) >= 80 ? 'bg-green-100 text-green-800' :
                      parseFloat(sellThrough) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {sellThrough}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => navigate(`/van-sales/loads/${loadId}/items/${item.id}`)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
