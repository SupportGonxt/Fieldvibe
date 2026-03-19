import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText, Download, Image as ImageIcon } from 'lucide-react'
import { ordersService } from '../../../services/orders.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'
import toast from 'react-hot-toast'

export default function DeliveryPOD() {
  const { orderId, deliveryId } = useParams<{ orderId: string; deliveryId: string }>()
  const navigate = useNavigate()

  const { data: delivery } = useQuery({
    queryKey: ['delivery', orderId, deliveryId],
    queryFn: async () => ordersService.getOrderDelivery(orderId!, deliveryId!),
  })

  const { data: pod, isLoading, isError } = useQuery({
    queryKey: ['delivery-pod', orderId, deliveryId],
    queryFn: async () => {
      const response = await apiClient.get(`/orders/${orderId}/deliveries/${deliveryId}/pod`)
      const result = response.data
      return result.data
    },
  })

  if (isLoading) {
    return <div className="p-6">Loading proof of delivery...</div>
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


  if (!pod) {
    return <div className="p-6">Proof of delivery not found</div>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Proof of Delivery</h1>
            <p className="text-gray-600">{delivery?.delivery_number} - {delivery?.customer_name}</p>
          </div>
          <button onClick={() => toast.success('PDF download started')} className="btn-secondary flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Items Delivered</h3>
          <p className="text-3xl font-bold text-green-600">{pod.items_delivered}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Items Damaged</h3>
          <p className="text-3xl font-bold text-red-600">{pod.items_damaged}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Items Returned</h3>
          <p className="text-3xl font-bold text-orange-600">{pod.items_returned}</p>
        </div>
      </div>

      {pod.signature_captured && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Signature</h2>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Signed By</dt>
              <dd className="mt-1 text-sm text-gray-900">{pod.signature_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Title</dt>
              <dd className="mt-1 text-sm text-gray-900">{pod.signature_title}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Time</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(pod.signature_time).toLocaleString()}
              </dd>
            </div>
          </dl>
          {pod.signature_image_url ? (
            <div className="border-2 border-gray-300 rounded-lg p-4 bg-surface-secondary">
              <img 
                src={pod.signature_image_url} 
                alt="Signature" 
                className="max-w-md h-32 object-contain"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>Digital signature captured</p>
            </div>
          )}
        </div>
      )}

      {pod.delivery_photos && pod.delivery_photos.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery Photos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pod.delivery_photos.map((photo) => (
              <div key={photo.id} className="border rounded-lg overflow-hidden">
                <div className="aspect-video bg-gray-100 flex items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-gray-400" />
                </div>
                <div className="p-3">
                  <p className="text-sm text-gray-900 mb-1">{photo.caption}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(photo.taken_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pod.notes && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Delivery Notes</h2>
          <p className="text-sm text-gray-700">{pod.notes}</p>
        </div>
      )}
    </div>
  )
}
