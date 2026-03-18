import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function AdjustmentItemDetail() {
  const { adjustmentId, itemId } = useParams<{ adjustmentId: string; itemId: string }>()
  const navigate = useNavigate()

  const { data: adjustment } = useQuery({
    queryKey: ['adjustment', adjustmentId],
    queryFn: async () => {
      const response = await fetch(`/api/adjustments/${adjustmentId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['adjustment-item', adjustmentId, itemId],
    queryFn: async () => {
      const response = await fetch(`/api/adjustments/${adjustmentId}/items/${itemId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldItem = {
      id: itemId,
      adjustment_id: adjustmentId,
      product_id: 'prod-1',
      product_name: 'Coca-Cola 500ml',
      product_sku: 'CC-500',
      adjustment_type: 'decrease',
      quantity: -10,
      unit_cost: 15.00,
      total_value: -150.00,
      reason: 'damaged',
      justification: 'Found 10 damaged units during quality inspection',
      location: 'Aisle 3, Shelf B',
      created_by: 'John Manager',
      created_at: '2024-01-20T14:30:00Z',
    }

  if (isLoading) {
    return <div className="p-6">Loading adjustment item...</div>
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
    return <div className="p-6">Adjustment item not found</div>
  }

  const isIncrease = item.adjustment_type === 'increase'

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/inventory/adjustments/${adjustmentId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Adjustment
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Adjustment Item Detail</h1>
        <p className="text-gray-600">{adjustment?.adjustment_number} - {adjustment?.warehouse_name}</p>
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
            {isIncrease ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            <h3 className="font-semibold text-gray-900">Quantity</h3>
          </div>
          <p className={`text-3xl font-bold ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
            {item.quantity > 0 ? '+' : ''}{item.quantity}
          </p>
          <p className="text-sm text-gray-600 mt-1 capitalize">{item.adjustment_type}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Value Impact</h3>
          </div>
          <p className={`text-2xl font-bold ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(Math.abs(item.total_value))}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            @ {formatCurrency(item.unit_cost)}/unit
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Adjustment Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Reason</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{item.reason.replace('_', ' ')}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Location</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.location}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created By</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.created_by}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(item.created_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Justification</h2>
        <p className="text-sm text-gray-700">{item.justification}</p>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/products/${item.product_id}`)}
          className="btn-secondary"
        >
          View Product
        </button>
        <button
          onClick={() => navigate(`/inventory/adjustments/${adjustmentId}/items/${itemId}/edit`)}
          className="btn-secondary"
        >
          Edit
        </button>
      </div>
    </div>
  )
}
