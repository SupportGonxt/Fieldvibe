import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Truck, MapPin, Clock, CheckCircle } from 'lucide-react'
import { ordersService } from '../../../services/orders.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function DeliveryDetail() {
  const { orderId, deliveryId } = useParams<{ orderId: string; deliveryId: string }>()
  const navigate = useNavigate()

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => ordersService.getOrder(orderId!),
  })

  const { data: delivery, isLoading, isError } = useQuery({
    queryKey: ['delivery', orderId, deliveryId],
    queryFn: async () => ordersService.getOrderDelivery(orderId!, deliveryId!),
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


  if (!delivery) {
    return <div className="p-6">Delivery not found</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Delivery Detail</h1>
        <p className="text-gray-600">{delivery.delivery_number} - {order?.customer_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Truck className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Status</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900 capitalize">{delivery.status.replace('_', ' ')}</p>
          <p className="text-sm text-gray-600 mt-1">{delivery.vehicle_number}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Progress</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{delivery.current_stop} / {delivery.stops}</p>
          <p className="text-sm text-gray-600 mt-1">Stops completed</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">ETA</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">
            {new Date(delivery.estimated_delivery_time).toLocaleTimeString()}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {new Date(delivery.estimated_delivery_time).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Tracking Number</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{delivery.tracking_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Driver</dt>
            <dd className="mt-1 text-sm text-gray-900">{delivery.driver_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Vehicle</dt>
            <dd className="mt-1 text-sm text-gray-900">{delivery.vehicle_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Scheduled Date</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(delivery.scheduled_date).toLocaleDateString()}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Delivery Address</dt>
            <dd className="mt-1 text-sm text-gray-900">{delivery.delivery_address}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Picked Up</p>
              <p className="text-sm text-gray-500">
                {new Date(delivery.actual_pickup_time).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className={`h-5 w-5 rounded-full border-2 mt-0.5 ${
              delivery.status === 'in_transit' ? 'border-blue-600 bg-blue-100' : 'border-gray-300'
            }`} />
            <div>
              <p className="text-sm font-medium text-gray-900">In Transit</p>
              <p className="text-sm text-gray-500">Stop {delivery.current_stop} of {delivery.stops}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-gray-300 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Delivered</p>
              <p className="text-sm text-gray-500">
                {delivery.actual_delivery_time 
                  ? new Date(delivery.actual_delivery_time).toLocaleString()
                  : 'Pending'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {delivery.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{delivery.notes}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/orders/${orderId}/deliveries/${deliveryId}/stops`)}
          className="btn-primary"
        >
          View Stops
        </button>
        <button
          onClick={() => navigate(`/orders/${orderId}/deliveries/${deliveryId}/pod`)}
          className="btn-secondary"
        >
          Proof of Delivery
        </button>
        <button
          onClick={() => navigate(`/orders/${orderId}/deliveries/${deliveryId}/edit`)}
          className="btn-secondary"
        >
          Edit
        </button>
      </div>
    </div>
  )
}
