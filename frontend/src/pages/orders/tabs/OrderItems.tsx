import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Package, DollarSign } from 'lucide-react'
import { ordersService as orderService } from '../../../services/orders.service'
import { EntityRefLink } from '../../../components/generic/EntityRefLink'

export default function OrderItems() {
  const { id } = useParams<{ id: string }>()

  const { data: orderData, isLoading, isError } = useQuery({
    queryKey: ['order-items', id],
    queryFn: () => orderService.getOrder(id!),
  })

  const items = orderData?.items || []
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0)
  const tax = subtotal * 0.15 // 15% VAT
  const total = subtotal + tax

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
        <p className="text-sm text-gray-600">{items.length} item(s) in this order</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading order items...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No items found in this order.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Discount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-surface-secondary">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <EntityRefLink
                          entity={{ id: item.product_id, name: item.product_name, type: 'product' }}
                          className="text-sm font-medium"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.sku || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        R {item.unit_price?.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        {item.discount ? `R ${item.discount.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        R {(item.quantity * item.unit_price - (item.discount || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="border-t border-gray-100 px-6 py-4 bg-surface-secondary">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium text-gray-900">R {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax (15%):</span>
                    <span className="font-medium text-gray-900">R {tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                    <span className="text-gray-900">Total:</span>
                    <span className="text-gray-900">R {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
