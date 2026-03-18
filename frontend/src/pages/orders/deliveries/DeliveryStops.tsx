import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, CheckCircle, Clock, Eye } from 'lucide-react'
import { ordersService } from '../../../services/orders.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function DeliveryStops() {
  const { orderId, deliveryId } = useParams<{ orderId: string; deliveryId: string }>()
  const navigate = useNavigate()

  const { data: delivery } = useQuery({
    queryKey: ['delivery', orderId, deliveryId],
    queryFn: async () => ordersService.getOrderDelivery(orderId!, deliveryId!),
  })

  const { data: stops = [], isLoading, isError } = useQuery({
    queryKey: ['delivery-stops', orderId, deliveryId],
    queryFn: async () => {
      return []
    },
  })

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner size="md" /></div>
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
          onClick={() => navigate(`/orders/${orderId}/deliveries/${deliveryId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Delivery
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Delivery Stops</h1>
        <p className="text-gray-600">{delivery?.delivery_number}</p>
      </div>

      <div className="space-y-4">
        {stops?.map((stop, idx) => (
          <div key={stop.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  stop.status === 'completed' 
                    ? 'bg-green-100 text-green-600' 
                    : stop.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {stop.status === 'completed' ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : stop.status === 'in_progress' ? (
                    <Clock className="h-5 w-5" />
                  ) : (
                    <MapPin className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Stop {stop.stop_number}: {stop.customer_name}
                    </h3>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      stop.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : stop.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {stop.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{stop.address}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Scheduled:</span>
                      <span className="ml-2 text-gray-900">
                        {new Date(stop.scheduled_time).toLocaleTimeString()}
                      </span>
                    </div>
                    {stop.actual_arrival_time && (
                      <div>
                        <span className="text-gray-500">Arrived:</span>
                        <span className="ml-2 text-gray-900">
                          {new Date(stop.actual_arrival_time).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                    {stop.actual_departure_time && (
                      <div>
                        <span className="text-gray-500">Departed:</span>
                        <span className="ml-2 text-gray-900">
                          {new Date(stop.actual_departure_time).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                  {stop.notes && (
                    <p className="mt-2 text-sm text-gray-700">{stop.notes}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate(`/orders/${orderId}/deliveries/${deliveryId}/stops/${stop.id}`)}
                className="text-primary-600 hover:text-primary-900"
              >
                <Eye className="h-5 w-5" />
              </button>
            </div>
            {idx < stops.length - 1 && (
              <div className="ml-5 mt-4 border-l-2 border-gray-100 h-4" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
