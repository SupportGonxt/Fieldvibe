import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, ArrowRight, MapPin } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function TransferItemDetail() {
  const { transferId, itemId } = useParams<{ transferId: string; itemId: string }>()
  const navigate = useNavigate()

  const { data: transfer } = useQuery({
    queryKey: ['transfer', transferId],
    queryFn: async () => {
      const response = await apiClient.get(`/transfers/${transferId}`)
      const result = response.data
      return result.data
    },
  })

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['transfer-item', transferId, itemId],
    queryFn: async () => {
      const response = await apiClient.get(`/transfers/${transferId}/items/${itemId}`)
      const result = response.data
      return result.data
    },
  })

  const oldItem = {
      id: itemId,
      transfer_id: transferId,
      product_id: 'prod-1',
      product_name: 'Coca-Cola 500ml',
      product_sku: 'CC-500',
      quantity_requested: 100,
      quantity_shipped: 100,
      quantity_received: 95,
      variance: -5,
      unit_cost: 15.00,
      total_value: 1500.00,
      status: 'received_with_variance',
      shipped_at: '2024-01-20T08:00:00Z',
      received_at: '2024-01-22T10:00:00Z',
      variance_notes: '5 units damaged during transit',
    }

  if (isLoading) {
    return <div className="p-6">Loading transfer item...</div>
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
    return <div className="p-6">Transfer item not found</div>
  }

  const hasVariance = item.variance !== 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/inventory/transfers/${transferId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Transfer
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Transfer Item Detail</h1>
        <p className="text-gray-600">{transfer?.transfer_number}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Product</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">{item.product_name}</p>
          <p className="text-sm text-gray-600 mt-1">{item.product_sku}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <ArrowRight className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Quantity</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{item.quantity_received}</p>
          <p className="text-sm text-gray-600 mt-1">of {item.quantity_requested} requested</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Status</h3>
          </div>
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            item.status === 'received' ? 'bg-green-100 text-green-800' :
            item.status === 'received_with_variance' ? 'bg-yellow-100 text-yellow-800' :
            item.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {item.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Transfer Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">From Warehouse</dt>
            <dd className="mt-1 text-sm text-gray-900">{transfer?.from_warehouse}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">To Warehouse</dt>
            <dd className="mt-1 text-sm text-gray-900">{transfer?.to_warehouse}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Quantity Requested</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.quantity_requested}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Quantity Shipped</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.quantity_shipped}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Quantity Received</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.quantity_received}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Unit Cost</dt>
            <dd className="mt-1 text-sm text-gray-900">${item.unit_cost.toFixed(2)}</dd>
          </div>
        </dl>
      </div>

      {hasVariance && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-yellow-900 mb-4">Variance Detected</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-yellow-700">Variance Quantity</dt>
              <dd className="mt-1 text-lg font-bold text-yellow-900">
                {item.variance > 0 ? '+' : ''}{item.variance} units
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-yellow-700">Variance Notes</dt>
              <dd className="mt-1 text-sm text-yellow-900">{item.variance_notes}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Shipped At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(item.shipped_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Received At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {item.received_at 
                ? new Date(item.received_at).toLocaleString()
                : 'Not received yet'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/products/${item.product_id}`)}
          className="btn-secondary"
        >
          View Product
        </button>
        <button
          onClick={() => navigate(`/inventory/transfers/${transferId}/items/${itemId}/edit`)}
          className="btn-secondary"
        >
          Edit
        </button>
        {hasVariance && (
          <button
            onClick={() => navigate(`/inventory/transfers/${transferId}/items/${itemId}/tracking`)}
            className="btn-primary"
          >
            View Tracking
          </button>
        )}
      </div>
    </div>
  )
}
