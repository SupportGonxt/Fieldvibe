import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, TrendingUp, TrendingDown } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function VanLoadItemDetail() {
  const { loadId, itemId } = useParams<{ loadId: string; itemId: string }>()
  const navigate = useNavigate()

  const { data: load } = useQuery({
    queryKey: ['van-load', loadId],
    queryFn: async () => {
      const response = await apiClient.get(`/van-loads/${loadId}`)
      const result = response.data
      return result.data
    },
  })

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['van-load-item', loadId, itemId],
    queryFn: async () => {
      const response = await apiClient.get(`/van-loads/${loadId}/items/${itemId}`)
      const result = response.data
      return result.data
    },
  })

  if (isLoading) {
    return <div className="p-6">Loading item details...</div>
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


  if (!item) {
    return <div className="p-6">Item not found</div>
  }

  const sellThrough = ((item.quantity_sold / item.quantity_loaded) * 100).toFixed(1)

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
        <h1 className="text-2xl font-bold text-gray-900">Van Load Item Detail</h1>
        <p className="text-gray-600">{load?.load_number} - {load?.agent_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Loaded</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{item.quantity_loaded}</p>
          <p className="text-sm text-gray-600 mt-1">units</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingDown className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Sold</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{item.quantity_sold}</p>
          <p className="text-sm text-gray-600 mt-1">{sellThrough}% sell-through</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Returned</h3>
          </div>
          <p className="text-3xl font-bold text-orange-600">{item.quantity_returned}</p>
          <p className="text-sm text-gray-600 mt-1">units</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Remaining</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{item.quantity_remaining}</p>
          <p className="text-sm text-gray-600 mt-1">units</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Product Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.product_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">SKU</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.product_sku}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Unit Price</dt>
            <dd className="mt-1 text-sm text-gray-900">${item.unit_price.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                item.status === 'active' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {item.status}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Loaded Value</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900">
              ${item.total_loaded_value.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Sold Value</dt>
            <dd className="mt-1 text-lg font-bold text-green-600">
              ${item.total_sold_value.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Remaining Value</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900">
              ${(item.quantity_remaining * item.unit_price).toFixed(2)}
            </dd>
          </div>
        </dl>
      </div>

      {item.variance !== 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-5 w-5 text-yellow-600" />
            <h2 className="text-lg font-semibold text-yellow-900">Variance Detected</h2>
          </div>
          <p className="text-sm text-yellow-700">
            There is a variance of {item.variance} units between expected and actual quantities.
          </p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/products/${item.product_id}`)}
          className="btn-secondary"
        >
          View Product
        </button>
        <button
          onClick={() => navigate(`/van-sales/loads/${loadId}/items/${itemId}/edit`)}
          className="btn-secondary"
        >
          Edit
        </button>
      </div>
    </div>
  )
}
