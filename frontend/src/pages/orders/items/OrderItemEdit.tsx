import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { ordersService } from '../../../services/orders.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function OrderItemEdit() {
  const { orderId, itemId } = useParams<{ orderId: string; itemId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['order-item', orderId, itemId],
    queryFn: async () => ordersService.getOrderItem(orderId!, itemId!),
  })

  const { register, handleSubmit, formState: { errors } } = useForm({
    values: item,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return ordersService.updateOrderItem(orderId!, itemId!, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-item', orderId, itemId] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      toast.success('Order item updated successfully')
      navigate(`/orders/${orderId}/items/${itemId}`)
    },
    onError: () => {
      toast.error('Failed to update order item')
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


  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/orders/${orderId}/items/${itemId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Item Detail
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Order Item</h1>
        <p className="text-gray-600">{item?.product_name}</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity *
            </label>
            <input
              type="number"
              {...register('quantity', { required: 'Quantity is required', min: 1 })}
              className="input-field"
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit Price *
            </label>
            <input
              type="number"
              step="0.01"
              {...register('unit_price', { required: 'Unit price is required', min: 0 })}
              className="input-field"
            />
            {errors.unit_price && (
              <p className="mt-1 text-sm text-red-600">{errors.unit_price.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Discount %
            </label>
            <input
              type="number"
              step="0.01"
              {...register('discount_percent', { min: 0, max: 100 })}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price Override Reason
            </label>
            <input
              type="text"
              {...register('price_override_reason')}
              className="input-field"
              placeholder="Explain why price was overridden"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="input-field"
              placeholder="Additional notes about this line item"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="btn-primary"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/orders/${orderId}/items/${itemId}`)}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
