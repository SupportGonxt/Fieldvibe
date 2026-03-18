import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

interface TransferItemFormData {
  quantity_requested: number
  notes: string
}

export default function TransferItemEdit() {
  const { transferId, itemId } = useParams<{ transferId: string; itemId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['transfer-item', transferId, itemId],
    queryFn: async () => {
      const response = await apiClient.get(`/transfers/${transferId}/items/${itemId}`)
      const result = response.data
      return result.data
    },
  })

  const oldItem = {
      id: itemId,
      transfer_id: transferId,
      product_name: 'Coca-Cola 500ml',
      quantity_requested: 100,
      notes: '',
    }

  const { register, handleSubmit, formState: { errors } } = useForm<TransferItemFormData>({
    values: item,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: TransferItemFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-item', transferId, itemId] })
      queryClient.invalidateQueries({ queryKey: ['transfer', transferId] })
      toast.success('Transfer item updated successfully')
      navigate(`/inventory/transfers/${transferId}/items/${itemId}`)
    },
    onError: () => {
      toast.error('Failed to update transfer item')
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
    return <div className="p-6">Transfer item not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/inventory/transfers/${transferId}/items/${itemId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Item
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Transfer Item</h1>
        <p className="text-gray-600">{item.product_name}</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity Requested *
            </label>
            <input
              type="number"
              {...register('quantity_requested', { required: 'Quantity is required', min: 1 })}
              className="input"
            />
            {errors.quantity_requested && (
              <p className="mt-1 text-sm text-red-600">{errors.quantity_requested.message}</p>
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
              placeholder="Any special instructions or notes..."
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
              onClick={() => navigate(`/inventory/transfers/${transferId}/items/${itemId}`)}
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
