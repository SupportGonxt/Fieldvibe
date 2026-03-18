import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

interface ItemFormData {
  quantity_loaded: number
  notes: string
}

export default function VanLoadItemEdit() {
  const { loadId, itemId } = useParams<{ loadId: string; itemId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['van-load-item', loadId, itemId],
    queryFn: async () => {
      const response = await apiClient.get(`/van-loads/${loadId}/items/${itemId}`)
      const result = response.data
      return result.data
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm<ItemFormData>({
    values: item,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['van-load-item', loadId, itemId] })
      queryClient.invalidateQueries({ queryKey: ['van-load', loadId] })
      toast.success('Item updated successfully')
      navigate(`/van-sales/loads/${loadId}/items/${itemId}`)
    },
    onError: () => {
      toast.error('Failed to update item')
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
    return <div className="p-6">Item not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/van-sales/loads/${loadId}/items/${itemId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Item
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Van Load Item</h1>
        <p className="text-gray-600">{item.product_name}</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity Loaded *
            </label>
            <input
              type="number"
              {...register('quantity_loaded', { 
                required: 'Quantity is required',
                min: { value: 1, message: 'Quantity must be at least 1' }
              })}
              className="input"
              placeholder="Enter quantity loaded"
            />
            {errors.quantity_loaded && (
              <p className="mt-1 text-sm text-red-600">{errors.quantity_loaded.message}</p>
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
              placeholder="Any notes about this item..."
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
              onClick={() => navigate(`/van-sales/loads/${loadId}/items/${itemId}`)}
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
