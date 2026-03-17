import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, User, FileText } from 'lucide-react'
import { ordersService } from '../../../services/orders.service'

export default function OrderStatusHistory() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => ordersService.getOrder(orderId!),
  })

  const { data: history = [], isLoading, isError } = useQuery({
    queryKey: ['order-status-history', orderId],
    queryFn: async () => ordersService.getOrderStatusHistory(orderId!),
  })

  if (isLoading) {
    return <div className="p-6">Loading status history...</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Order Status History</h1>
        <p className="text-gray-600">
          {order?.order_number} - {order?.customer_name} - Current: {' '}
          <span className="font-semibold capitalize">{order?.current_status}</span>
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flow-root">
          <ul className="-mb-8">
            {history?.map((entry, idx) => (
              <li key={entry.id}>
                <div className="relative pb-8">
                  {idx !== history.length - 1 && (
                    <span
                      className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                        entry.status === 'delivered' ? 'bg-green-100' :
                        entry.status === 'shipped' ? 'bg-blue-100' :
                        entry.status === 'processing' ? 'bg-yellow-100' :
                        entry.status === 'confirmed' ? 'bg-purple-100' :
                        'bg-gray-100'
                      }`}>
                        <Clock className={`h-4 w-4 ${
                          entry.status === 'delivered' ? 'text-green-600' :
                          entry.status === 'shipped' ? 'text-blue-600' :
                          entry.status === 'processing' ? 'text-yellow-600' :
                          entry.status === 'confirmed' ? 'text-purple-600' :
                          'text-gray-600'
                        }`} />
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            entry.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            entry.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                            entry.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            entry.status === 'confirmed' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {entry.status}
                          </span>
                          {entry.previous_status && (
                            <>
                              <span className="text-gray-400">←</span>
                              <span className="text-xs text-gray-500 capitalize">
                                {entry.previous_status}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 mb-1">{entry.notes}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{entry.changed_by} ({entry.changed_by_role})</span>
                          </div>
                          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              <span>{Object.keys(entry.metadata).length} metadata fields</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="whitespace-nowrap text-right text-sm text-gray-500">
                        <div>{new Date(entry.changed_at).toLocaleDateString()}</div>
                        <div className="text-xs">{new Date(entry.changed_at).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
