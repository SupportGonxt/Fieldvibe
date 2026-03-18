import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

interface ApprovalFormData {
  decision: 'approve' | 'reject'
  notes: string
}

export default function CountLineApproval() {
  const { countId, lineId } = useParams<{ countId: string; lineId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: line, isLoading, isError } = useQuery({
    queryKey: ['count-line', countId, lineId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/stock-counts/${countId}/lines/${lineId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldLine = {
      id: lineId,
      count_id: countId,
      product_name: 'Coca-Cola 500ml',
      product_sku: 'CC-500',
      expected_quantity: 100,
      counted_quantity: 95,
      variance: -5,
      variance_percent: -5.0,
      variance_value: -75.00,
      counted_by: 'John Counter',
      counted_at: '2024-01-20T14:30:00Z',
      resolution_notes: 'Found 5 damaged units during count',
    }

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ApprovalFormData>()

  const decision = watch('decision')

  const approvalMutation = useMutation({
    mutationFn: async (data: ApprovalFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['count-line', countId, lineId] })
      queryClient.invalidateQueries({ queryKey: ['stock-count', countId] })
      toast.success('Count line decision saved successfully')
      navigate(`/inventory/stock-counts/${countId}/lines/${lineId}`)
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


  if (!line) {
    return <div className="p-6">Count line not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/inventory/stock-counts/${countId}/lines/${lineId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Count Line
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Approve/Reject Count Line</h1>
        <p className="text-gray-600">{line.product_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Count Summary</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Product</dt>
            <dd className="mt-1 text-sm text-gray-900">{line.product_name} ({line.product_sku})</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Counted By</dt>
            <dd className="mt-1 text-sm text-gray-900">{line.counted_by}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Expected Quantity</dt>
            <dd className="mt-1 text-sm text-gray-900">{line.expected_quantity}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Counted Quantity</dt>
            <dd className="mt-1 text-sm text-gray-900">{line.counted_quantity}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Variance</dt>
            <dd className="mt-1 text-sm font-bold text-red-600">
              {line.variance > 0 ? '+' : ''}{line.variance} ({line.variance_percent.toFixed(1)}%)
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Value Impact</dt>
            <dd className="mt-1 text-sm font-bold text-red-600">
              ${line.variance_value.toFixed(2)}
            </dd>
          </div>
          {line.resolution_notes && (
            <div className="md:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Resolution Notes</dt>
              <dd className="mt-1 text-sm text-gray-900">{line.resolution_notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <form onSubmit={handleSubmit((data) => approvalMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Decision *
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-surface-secondary has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                <input
                  type="radio"
                  value="approve"
                  {...register('decision', { required: 'Decision is required' })}
                />
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium text-gray-900">Approve Count</div>
                  <div className="text-sm text-gray-500">Accept the counted quantity and variance</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-surface-secondary has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                <input
                  type="radio"
                  value="reject"
                  {...register('decision', { required: 'Decision is required' })}
                />
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <div className="font-medium text-gray-900">Reject Count</div>
                  <div className="text-sm text-gray-500">Request recount for this item</div>
                </div>
              </label>
            </div>
            {errors.decision && (
              <p className="mt-1 text-sm text-red-600">{errors.decision.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Approval Notes *
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

          {decision === 'approve' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-900">
                <strong>Note:</strong> Approving this count will finalize the variance and update 
                the system inventory by {line.variance} units.
              </p>
            </div>
          )}

          {decision === 'reject' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900">
                <strong>Note:</strong> Rejecting this count will mark it for recounting. 
                The counter will be notified to recount this item.
              </p>
            </div>
          )}

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
              onClick={() => navigate(`/inventory/stock-counts/${countId}/lines/${lineId}`)}
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
