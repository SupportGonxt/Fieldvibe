import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, RotateCcw, AlertCircle } from 'lucide-react'
import { ordersService as orderService } from '../../../services/orders.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function OrderReturns() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: returns = [], isLoading, isError } = useQuery({
    queryKey: ['order-returns', id],
    queryFn: () => orderService.getOrderReturns(id!),
  })

  const totalReturned = returns.reduce((sum: number, r: any) => sum + (r.refund_amount || 0), 0)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Order Returns</h2>
          {returns.length > 0 && (
            <p className="text-sm text-gray-600">
              Total Refunded: <span className="font-semibold text-red-600">R {totalReturned.toFixed(2)}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => navigate(`/orders/${id}/returns/create`)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Process Return
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500"><LoadingSpinner size="md" /></div>
        ) : returns.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <RotateCcw className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No returns recorded for this order.</p>
            <button
              onClick={() => navigate(`/orders/${id}/returns/create`)}
              className="mt-4 btn-primary"
            >
              Process First Return
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Return Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Refund Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {returns.map((returnItem: any) => (
                  <tr key={returnItem.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(returnItem.return_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{returnItem.product_name}</div>
                      <div className="text-sm text-gray-500">{returnItem.sku}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {returnItem.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <span className="text-sm text-gray-900">{returnItem.reason || 'Not specified'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      R {returnItem.refund_amount?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        returnItem.status === 'approved' ? 'bg-green-100 text-green-800' :
                        returnItem.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        returnItem.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {returnItem.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => navigate(`/orders/${id}/returns/${returnItem.id}`)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
