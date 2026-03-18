import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Clock, Package, User } from 'lucide-react'
import { ordersService } from '../../../services/orders.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function DeliveryStopDetail() {
  const { orderId, deliveryId, stopId } = useParams<{ orderId: string; deliveryId: string; stopId: string }>()
  const navigate = useNavigate()

  const { data: delivery } = useQuery({
    queryKey: ['delivery', orderId, deliveryId],
    queryFn: async () => ordersService.getOrderDelivery(orderId!, deliveryId!),
  })

  const { data: stop, isLoading, isError } = useQuery({
    queryKey: ['delivery-stop', orderId, deliveryId, stopId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/orders/${orderId}/deliveries/${deliveryId}/stops/${stopId}`, {
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
    return <div className="p-6">Loading stop details...</div>
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


  if (!stop) {
    return <div className="p-6">Stop not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/orders/${orderId}/deliveries/${deliveryId}/stops`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Stops
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Stop {stop.stop_number} Detail</h1>
        <p className="text-gray-600">{delivery?.delivery_number} - {stop.customer_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Location</h3>
          </div>
          <p className="text-sm text-gray-900">{stop.address}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Items Delivered</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stop.items_delivered}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Duration</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {Math.round((new Date(stop.actual_departure_time).getTime() - new Date(stop.actual_arrival_time).getTime()) / 60000)} min
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Customer Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{stop.customer_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Contact Person</dt>
            <dd className="mt-1 text-sm text-gray-900">{stop.customer_contact}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Phone</dt>
            <dd className="mt-1 text-sm text-gray-900">{stop.customer_phone}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                stop.status === 'completed' 
                  ? 'bg-green-100 text-green-800' 
                  : stop.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {stop.status.replace('_', ' ')}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Scheduled Time</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(stop.scheduled_time).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Actual Arrival</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {stop.actual_arrival_time 
                ? new Date(stop.actual_arrival_time).toLocaleString()
                : 'Not arrived'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Actual Departure</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {stop.actual_departure_time 
                ? new Date(stop.actual_departure_time).toLocaleString()
                : 'Not departed'}
            </dd>
          </div>
        </dl>
      </div>

      {stop.signature_captured && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Proof of Delivery</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Signed By</dt>
              <dd className="mt-1 text-sm text-gray-900">{stop.signature_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Signature Time</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(stop.signature_time).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {stop.special_instructions && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Special Instructions</h2>
          <p className="text-sm text-gray-700">{stop.special_instructions}</p>
        </div>
      )}

      {stop.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Delivery Notes</h2>
          <p className="text-sm text-gray-700">{stop.notes}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/orders/${orderId}/deliveries/${deliveryId}/stops`)}
          className="btn-secondary"
        >
          Back to All Stops
        </button>
        <button
          onClick={() => navigate(`/orders/${orderId}/deliveries/${deliveryId}`)}
          className="btn-secondary"
        >
          View Delivery
        </button>
      </div>
    </div>
  )
}
