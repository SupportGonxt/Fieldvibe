import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Truck, MapPin, Calendar, CheckCircle } from 'lucide-react'
import { ordersService as orderService } from '../../../services/orders.service'

export default function OrderDelivery() {
  const { id } = useParams<{ id: string }>()

  const { data: deliveryData, isLoading, isError } = useQuery({
    queryKey: ['order-delivery', id],
    queryFn: () => orderService.getOrderDelivery(id!),
  })

  const delivery = deliveryData?.delivery || {}
  const timeline = deliveryData?.timeline || []

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Delivery Information</h2>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-500">Loading delivery information...</div>
      ) : !delivery.id ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <Truck className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>No delivery information available for this order.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Delivery Status Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-medium text-gray-600">Delivery Status</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{delivery.status || 'Pending'}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium text-gray-600">Expected Delivery</p>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {delivery.expected_date ? new Date(delivery.expected_date).toLocaleDateString() : 'TBD'}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-5 w-5 text-purple-600" />
                  <p className="text-sm font-medium text-gray-600">Delivery Address</p>
                </div>
                <p className="text-sm text-gray-900">{delivery.address || 'Not specified'}</p>
              </div>
            </div>
          </div>

          {/* Delivery Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Driver Name</p>
                <p className="text-sm font-medium text-gray-900">{delivery.driver_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Vehicle Number</p>
                <p className="text-sm font-medium text-gray-900">{delivery.vehicle_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Contact Number</p>
                <p className="text-sm font-medium text-gray-900">{delivery.contact_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tracking Number</p>
                <p className="text-sm font-medium text-gray-900">{delivery.tracking_number || '-'}</p>
              </div>
            </div>
            {delivery.notes && (
              <div className="mt-4">
                <p className="text-sm text-gray-600">Delivery Notes</p>
                <p className="text-sm text-gray-900 mt-1">{delivery.notes}</p>
              </div>
            )}
          </div>

          {/* Delivery Timeline */}
          {timeline.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Timeline</h3>
              <div className="space-y-4">
                {timeline.map((event: any, index: number) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`rounded-full p-2 ${
                        event.completed ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <CheckCircle className={`h-5 w-5 ${
                          event.completed ? 'text-green-600' : 'text-gray-400'
                        }`} />
                      </div>
                      {index < timeline.length - 1 && (
                        <div className={`w-0.5 h-12 ${
                          event.completed ? 'bg-green-200' : 'bg-gray-200'
                        }`} />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-gray-900">{event.title}</p>
                      <p className="text-sm text-gray-500">{event.description}</p>
                      {event.timestamp && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
