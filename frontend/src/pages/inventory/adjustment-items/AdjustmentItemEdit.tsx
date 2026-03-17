import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

interface AdjustmentItemFormData {
  quantity: number
  reason: string
  justification: string
}

export default function AdjustmentItemEdit() {
  const { adjustmentId, itemId } = useParams<{ adjustmentId: string; itemId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['adjustment-item', adjustmentId, itemId],
    queryFn: async () => {
      const response = await fetch(`/api/adjustments/${adjustmentId}/items/${itemId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldItem = {
      id: itemId,
      adjustment_id: adjustmentId,
      product_name: 'Coca-Cola 500ml',
      adjustment_type: 'decrease',
      quantity: -10,
      reason: 'damaged',
      justification: 'Found 10 damaged units during quality inspection',
    }

  const { register, handleSubmit, formState: { errors } } = useForm<AdjustmentItemFormData>({
    values: item,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: AdjustmentItemFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustment-item', adjustmentId, itemId] })
      queryClient.invalidateQueries({ queryKey: ['adjustment', adjustmentId] })
      toast.success('Adjustment item updated successfully')
      navigate(`/inventory/adjustments/${adjustmentId}/items/${itemId}`)
    },
    onError: () => {
      toast.error('Failed to update adjustment item')
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
    return <div className="p-6">Adjustment item not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/inventory/adjustments/${adjustmentId}/items/${itemId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Item
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Adjustment Item</h1>
        <p className="text-gray-600">{item.product_name}</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity *
            </label>
            <input
              type="number"
              {...register('quantity', { required: 'Quantity is required' })}
              className="input"
              placeholder="Use negative for decrease, positive for increase"
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Negative values decrease inventory, positive values increase inventory
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason *
            </label>
            <select
              {...register('reason', { required: 'Reason is required' })}
              className="input"
            >
              <option value="">Select reason...</option>
              <option value="damaged">Damaged goods</option>
              <option value="expired">Expired products</option>
              <option value="theft">Theft/Loss</option>
              <option value="found">Found inventory</option>
              <option value="correction">System correction</option>
              <option value="return">Customer return</option>
              <option value="other">Other</option>
            </select>
            {errors.reason && (
              <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Justification *
            </label>
            <textarea
              {...register('justification', { required: 'Justification is required' })}
              rows={4}
              className="input"
              placeholder="Provide detailed explanation for this adjustment..."
            />
            {errors.justification && (
              <p className="mt-1 text-sm text-red-600">{errors.justification.message}</p>
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
              onClick={() => navigate(`/inventory/adjustments/${adjustmentId}/items/${itemId}`)}
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
