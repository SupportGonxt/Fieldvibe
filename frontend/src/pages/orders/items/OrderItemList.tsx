import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, Edit } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import { ordersService } from '../../../services/orders.service'

export default function OrderItemList() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => ordersService.getOrder(orderId!),
  })

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ['order-items', orderId],
    queryFn: async () => ordersService.getOrderItemsList(orderId!),
  })

  if (isLoading) {
    return <div className="p-6">Loading order items...</div>
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
          onClick={() => navigate(`/orders/${orderId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Order
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Order Items</h1>
        <p className="text-gray-600">{order?.order_number} - {order?.customer_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Discount</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Line Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items?.map((item) => (
              <tr key={item.id} className="hover:bg-surface-secondary">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.product_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.product_sku}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {item.quantity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {item.discount_percent}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                  {formatCurrency(item.line_total)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    item.fulfillment_status === 'fulfilled' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {item.fulfillment_status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => navigate(`/orders/${orderId}/items/${item.id}`)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/orders/${orderId}/items/${item.id}/edit`)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
