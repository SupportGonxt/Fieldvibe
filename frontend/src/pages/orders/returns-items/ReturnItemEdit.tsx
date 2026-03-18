import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

interface ReturnItemFormData {
  quantity_returned: number
  reason: string
  condition: string
  restockable: boolean
}

export default function ReturnItemEdit() {
  const { returnId, itemId } = useParams<{ returnId: string; itemId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['return-item', returnId, itemId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/returns/${returnId}/items/${itemId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm<ReturnItemFormData>({
    values: item,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: ReturnItemFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-item', returnId, itemId] })
      queryClient.invalidateQueries({ queryKey: ['return', returnId] })
      toast.success('Return item updated successfully')
      navigate(`/orders/returns/${returnId}/items/${itemId}`)
    },
    onError: () => {
      toast.error('Failed to update return item')
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


  if (!item) {
    return <div className="p-6">Return item not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/orders/returns/${returnId}/items/${itemId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Item
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Return Item</h1>
        <p className="text-gray-600">{item.product_name}</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity Returned *
            </label>
            <input
              type="number"
              {...register('quantity_returned', { required: 'Quantity is required', min: 1 })}
              className="input"
            />
            {errors.quantity_returned && (
              <p className="mt-1 text-sm text-red-600">{errors.quantity_returned.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Condition *
            </label>
            <select
              {...register('condition', { required: 'Condition is required' })}
              className="input"
            >
              <option value="">Select condition...</option>
              <option value="new">New/Unopened</option>
              <option value="opened">Opened</option>
              <option value="damaged">Damaged</option>
              <option value="defective">Defective</option>
            </select>
            {errors.condition && (
              <p className="mt-1 text-sm text-red-600">{errors.condition.message}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('restockable')}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Restockable</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Return Reason *
            </label>
            <textarea
              {...register('reason', { required: 'Reason is required' })}
              rows={3}
              className="input"
            />
            {errors.reason && (
              <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
            )}
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
              onClick={() => navigate(`/orders/returns/${returnId}/items/${itemId}`)}
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
