import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import { vanSalesService } from '../../services/van-sales.service'
import { ordersService } from '../../services/orders.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function RouteOrders() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: route } = useQuery({
    queryKey: ['route', id],
    queryFn: () => vanSalesService.getRoute(id!),
  })

  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ['route-orders', id],
    queryFn: async () => {
      const result = await ordersService.getOrders({ route_id: id })
      return result.data || []
    },
  })

  const total = orders?.reduce((sum, o) => sum + o.amount, 0) || 0

  if (isLoading) return <div className="p-6"><LoadingSpinner size="md" /></div>


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
        <button onClick={() => navigate(`/van-sales/routes/${id}`)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-5 w-5" />
          Back to Route
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Route Orders</h1>
        <p className="text-gray-600">{route?.route_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <p className="text-sm text-gray-600">Total Orders Value</p>
        <p className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders?.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.order_number}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.customer}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(order.amount)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    order.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(order.date).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button onClick={() => navigate(`/orders/${order.id}`)} className="text-primary-600 hover:text-primary-900 flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
