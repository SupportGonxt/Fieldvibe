import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, DollarSign, TrendingUp } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import { ordersService } from '../../../services/orders.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function OrderItemDetail() {
  const { orderId, itemId } = useParams<{ orderId: string; itemId: string }>()
  const navigate = useNavigate()

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => ordersService.getOrder(orderId!),
  })

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['order-item', orderId, itemId],
    queryFn: async () => ordersService.getOrderItem(orderId!, itemId!),
  })

  if (isLoading) {
    return <div className="p-6">Loading order item...</div>
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
    return <div className="p-6">Order item not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/orders/${orderId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Order
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Item Detail</h1>
            <p className="text-gray-600">{order?.order_number} - {order?.customer_name}</p>
          </div>
          <button
            onClick={() => navigate(`/orders/${orderId}/items/${itemId}/edit`)}
            className="btn-secondary"
          >
            Edit Item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Quantity</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{item.quantity}</p>
          <p className="text-sm text-gray-600 mt-1">
            Fulfilled: {item.fulfilled_quantity} | Pending: {item.pending_quantity}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Unit Price</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(item.unit_price)}</p>
          {item.discount_percent > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              {item.discount_percent}% discount applied
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Line Total</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(item.total)}</p>
          <p className="text-sm text-gray-600 mt-1">
            Incl. tax: {formatCurrency(item.tax_amount)}
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
            <dt className="text-sm font-medium text-gray-500">Fulfillment Status</dt>
            <dd className="mt-1">
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                item.fulfillment_status === 'fulfilled' ? 'bg-green-100 text-green-800' :
                item.fulfillment_status === 'partially_fulfilled' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {item.fulfillment_status.replace('_', ' ')}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing Breakdown</h2>
        <dl className="space-y-3">
          <div className="flex justify-between">
            <dt className="text-sm text-gray-600">Subtotal ({item.quantity} × {formatCurrency(item.unit_price)})</dt>
            <dd className="text-sm font-medium text-gray-900">{formatCurrency(item.line_total)}</dd>
          </div>
          {item.discount_amount > 0 && (
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Discount ({item.discount_percent}%)</dt>
              <dd className="text-sm font-medium text-red-600">-{formatCurrency(item.discount_amount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-sm text-gray-600">Subtotal after discount</dt>
            <dd className="text-sm font-medium text-gray-900">{formatCurrency(item.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-gray-600">Tax ({item.tax_rate}%)</dt>
            <dd className="text-sm font-medium text-gray-900">{formatCurrency(item.tax_amount)}</dd>
          </div>
          <div className="flex justify-between pt-3 border-t">
            <dt className="text-base font-semibold text-gray-900">Total</dt>
            <dd className="text-base font-bold text-gray-900">{formatCurrency(item.total)}</dd>
          </div>
        </dl>
      </div>

      {item.price_override_reason && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-yellow-800 mb-1">Price Override</h3>
          <p className="text-sm text-yellow-700">{item.price_override_reason}</p>
        </div>
      )}

      {item.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{item.notes}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Created At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(item.created_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(item.updated_at).toLocaleString()}
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
          onClick={() => navigate(`/orders/${orderId}`)}
          className="btn-secondary"
        >
          View Order
        </button>
      </div>
    </div>
  )
}
