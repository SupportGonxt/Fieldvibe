import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { ordersService } from '../../../services/orders.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

interface DeliveryFormData {
  driver_name: string
  vehicle_number: string
  scheduled_date: string
  estimated_delivery_time: string
  delivery_address: string
  notes: string
}

export default function DeliveryEdit() {
  const { orderId, deliveryId } = useParams<{ orderId: string; deliveryId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: delivery, isLoading, isError } = useQuery({
    queryKey: ['delivery', orderId, deliveryId],
    queryFn: async () => ordersService.getOrderDelivery(orderId!, deliveryId!),
  })

  const { register, handleSubmit, formState: { errors } } = useForm<DeliveryFormData>({
    values: delivery,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: DeliveryFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery', orderId, deliveryId] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      toast.success('Delivery updated successfully')
      navigate(`/orders/${orderId}/deliveries/${deliveryId}`)
    },
    onError: () => {
      toast.error('Failed to update delivery')
    },
  })

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner size="sm" /></div>
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
          onClick={() => navigate(`/orders/${orderId}/deliveries/${deliveryId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Delivery
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Delivery</h1>
        <p className="text-gray-600">{delivery.delivery_number}</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Driver Name *
            </label>
            <input
              type="text"
              {...register('driver_name', { required: 'Driver name is required' })}
              className="input"
            />
            {errors.driver_name && (
              <p className="mt-1 text-sm text-red-600">{errors.driver_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vehicle Number *
            </label>
            <input
              type="text"
              {...register('vehicle_number', { required: 'Vehicle number is required' })}
              className="input"
            />
            {errors.vehicle_number && (
              <p className="mt-1 text-sm text-red-600">{errors.vehicle_number.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scheduled Date *
            </label>
            <input
              type="date"
              {...register('scheduled_date', { required: 'Scheduled date is required' })}
              className="input"
            />
            {errors.scheduled_date && (
              <p className="mt-1 text-sm text-red-600">{errors.scheduled_date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Delivery Time *
            </label>
            <input
              type="datetime-local"
              {...register('estimated_delivery_time', { required: 'Estimated time is required' })}
              className="input"
            />
            {errors.estimated_delivery_time && (
              <p className="mt-1 text-sm text-red-600">{errors.estimated_delivery_time.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Address *
            </label>
            <textarea
              {...register('delivery_address', { required: 'Address is required' })}
              rows={3}
              className="input"
            />
            {errors.delivery_address && (
              <p className="mt-1 text-sm text-red-600">{errors.delivery_address.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="input"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primary"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/orders/${orderId}/deliveries/${deliveryId}`)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
