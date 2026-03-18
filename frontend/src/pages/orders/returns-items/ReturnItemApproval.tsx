import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '../../../utils/currency'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

interface ApprovalFormData {
  decision: 'approved' | 'rejected'
  notes: string
  refund_amount_override?: number
}

export default function ReturnItemApproval() {
  const { returnId, itemId } = useParams<{ returnId: string; itemId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['return-item', returnId, itemId],
    queryFn: async () => {
      const response = await fetch(`/api/returns/${returnId}/items/${itemId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ApprovalFormData>()

  const decision = watch('decision')

  const approvalMutation = useMutation({
    mutationFn: async (data: ApprovalFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-item', returnId, itemId] })
      queryClient.invalidateQueries({ queryKey: ['return', returnId] })
      toast.success('Return item decision saved successfully')
      navigate(`/orders/returns/${returnId}/items/${itemId}`)
    },
    onError: () => {
      toast.error('Failed to save decision')
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
        <h1 className="text-2xl font-bold text-gray-900">Approve/Reject Return Item</h1>
        <p className="text-gray-600">{item.product_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Return Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Product</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.product_name} ({item.product_sku})</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Quantity</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.quantity_returned}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Condition</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{item.condition}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Requested Refund</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatCurrency(item.refund_amount)}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Reason</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.reason}</dd>
          </div>
        </dl>
      </div>

      <form onSubmit={handleSubmit((data) => approvalMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Decision *
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-surface-secondary">
                <input
                  type="radio"
                  value="approved"
                  {...register('decision', { required: 'Decision is required' })}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium text-gray-900">Approve Return</div>
                  <div className="text-sm text-gray-500">Accept the return and process refund</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-surface-secondary">
                <input
                  type="radio"
                  value="rejected"
                  {...register('decision', { required: 'Decision is required' })}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <div className="font-medium text-gray-900">Reject Return</div>
                  <div className="text-sm text-gray-500">Decline the return request</div>
                </div>
              </label>
            </div>
            {errors.decision && (
              <p className="mt-1 text-sm text-red-600">{errors.decision.message}</p>
            )}
          </div>

          {decision === 'approved' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Refund Amount Override (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('refund_amount_override', { min: 0 })}
                className="input"
                placeholder={`Default: ${formatCurrency(item.refund_amount)}`}
              />
              <p className="mt-1 text-sm text-gray-500">
                Leave blank to use the default refund amount
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes *
            </label>
            <textarea
              {...register('notes', { required: 'Notes are required' })}
              rows={4}
              className="input"
              placeholder="Explain your decision..."
            />
            {errors.notes && (
              <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={approvalMutation.isPending}
              className="btn-primary"
            >
              {approvalMutation.isPending ? 'Saving...' : 'Save Decision'}
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
