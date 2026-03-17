import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, DollarSign, AlertCircle } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function ReturnItemDetail() {
  const { returnId, itemId } = useParams<{ returnId: string; itemId: string }>()
  const navigate = useNavigate()

  const { data: returnOrder } = useQuery({
    queryKey: ['return', returnId],
    queryFn: async () => {
      const response = await fetch(`/api/returns/${returnId}`, {
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
    queryKey: ['return-item', returnId, itemId],
    queryFn: async () => {
      const response = await fetch(`/api/returns/${returnId}/items/${itemId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  if (isLoading) {
    return <div className="p-6">Loading return item...</div>
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
    return <div className="p-6">Return item not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/orders/returns/${returnId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Return
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Return Item Detail</h1>
        <p className="text-gray-600">{returnOrder?.return_number} - {returnOrder?.customer_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Quantity Returned</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{item.quantity_returned}</p>
          <p className="text-sm text-gray-600 mt-1">{item.product_sku}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Refund Amount</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(item.refund_amount)}</p>
          <p className="text-sm text-gray-600 mt-1">{formatCurrency(item.unit_price)} per unit</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Approval Status</h3>
          </div>
          <p className="text-xl font-bold text-gray-900 capitalize">{item.approval_status}</p>
          <p className="text-sm text-gray-600 mt-1">
            {item.restockable ? 'Restockable' : 'Not restockable'}
          </p>
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
            <dt className="text-sm font-medium text-gray-500">Condition</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{item.condition}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Restockable</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.restockable ? 'Yes' : 'No'}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Return Reason</h2>
        <p className="text-sm text-gray-700">{item.reason}</p>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/products/${item.product_id}`)}
          className="btn-secondary"
        >
          View Product
        </button>
        <button
          onClick={() => navigate(`/orders/returns/${returnId}`)}
          className="btn-secondary"
        >
          View Return
        </button>
        {item.approval_status === 'pending' && (
          <button
            onClick={() => navigate(`/orders/returns/${returnId}/items/${itemId}/approve`)}
            className="btn-primary"
          >
            Approve/Reject
          </button>
        )}
      </div>
    </div>
  )
}
