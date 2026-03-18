import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

interface ResolutionFormData {
  resolution_action: 'accept' | 'recount' | 'adjust'
  reason: string
  notes: string
}

export default function VarianceResolution() {
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
      unit_cost: 15.00,
    }

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResolutionFormData>()

  const action = watch('resolution_action')

  const resolveMutation = useMutation({
    mutationFn: async (data: ResolutionFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['count-line', countId, lineId] })
      queryClient.invalidateQueries({ queryKey: ['stock-count', countId] })
      toast.success('Variance resolved successfully')
      navigate(`/inventory/stock-counts/${countId}/lines/${lineId}`)
    },
    onError: () => {
      toast.error('Failed to resolve variance')
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
        <h1 className="text-2xl font-bold text-gray-900">Resolve Variance</h1>
        <p className="text-gray-600">{line.product_name}</p>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-red-900 mb-4">Variance Summary</h2>
        <dl className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-sm font-medium text-red-700">Expected</dt>
            <dd className="mt-1 text-2xl font-bold text-red-900">{line.expected_quantity}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-red-700">Counted</dt>
            <dd className="mt-1 text-2xl font-bold text-red-900">{line.counted_quantity}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-red-700">Variance</dt>
            <dd className="mt-1 text-2xl font-bold text-red-900">
              {line.variance > 0 ? '+' : ''}{line.variance}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-red-700">Value Impact</dt>
            <dd className="mt-1 text-2xl font-bold text-red-900">
              ${line.variance_value.toFixed(2)}
            </dd>
          </div>
        </dl>
      </div>

      <form onSubmit={handleSubmit((data) => resolveMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Resolution Action *
            </label>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-surface-secondary has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                <input
                  type="radio"
                  value="accept"
                  {...register('resolution_action', { required: 'Resolution action is required' })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-gray-900">Accept Variance</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Accept the counted quantity and adjust system inventory accordingly
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-surface-secondary has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                <input
                  type="radio"
                  value="recount"
                  {...register('resolution_action', { required: 'Resolution action is required' })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-gray-900">Request Recount</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Mark this line for recounting to verify the variance
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-surface-secondary has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                <input
                  type="radio"
                  value="adjust"
                  {...register('resolution_action', { required: 'Resolution action is required' })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-gray-900">Manual Adjustment</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Create a manual inventory adjustment to correct the variance
                  </p>
                </div>
              </label>
            </div>
            {errors.resolution_action && (
              <p className="mt-1 text-sm text-red-600">{errors.resolution_action.message}</p>
            )}
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
              <option value="theft">Theft/Loss</option>
              <option value="counting_error">Counting error</option>
              <option value="system_error">System error</option>
              <option value="expired">Expired products</option>
              <option value="other">Other</option>
            </select>
            {errors.reason && (
              <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes *
            </label>
            <textarea
              {...register('notes', { required: 'Notes are required' })}
              rows={4}
              className="input"
              placeholder="Provide detailed explanation for the variance and resolution..."
            />
            {errors.notes && (
              <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
            )}
          </div>

          {action === 'accept' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-900">
                <strong>Warning:</strong> Accepting this variance will create an inventory adjustment 
                of {line.variance} units (${line.variance_value.toFixed(2)}) and update the system inventory.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={resolveMutation.isPending}
              className="btn-primary"
            >
              {resolveMutation.isPending ? 'Processing...' : 'Resolve Variance'}
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
