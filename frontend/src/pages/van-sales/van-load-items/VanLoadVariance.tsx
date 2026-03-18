import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

interface VarianceFormData {
  resolution_action: string
  reason: string
  notes: string
}

export default function VanLoadVariance() {
  const { loadId, itemId } = useParams<{ loadId: string; itemId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['van-load-item', loadId, itemId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/van-loads/${loadId}/items/${itemId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm<VarianceFormData>()

  const resolveMutation = useMutation({
    mutationFn: async (data: VarianceFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['van-load-item', loadId, itemId] })
      queryClient.invalidateQueries({ queryKey: ['van-load', loadId] })
      toast.success('Variance resolved successfully')
      navigate(`/van-sales/loads/${loadId}/items/${itemId}`)
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
        <h1 className="text-2xl font-bold text-gray-900">Resolve Van Load Variance</h1>
        <p className="text-gray-600">{item.product_name} ({item.product_sku})</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-yellow-900 mb-2">Variance Detected</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-yellow-700 font-medium">Expected Remaining</p>
                <p className="text-2xl font-bold text-yellow-900">{item.expected_remaining}</p>
              </div>
              <div>
                <p className="text-yellow-700 font-medium">Actual Remaining</p>
                <p className="text-2xl font-bold text-yellow-900">{item.actual_remaining}</p>
              </div>
              <div>
                <p className="text-yellow-700 font-medium">Variance</p>
                <p className={`text-2xl font-bold ${
                  item.variance < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {item.variance > 0 ? '+' : ''}{item.variance}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => resolveMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resolution Action *
            </label>
            <select
              {...register('resolution_action', { required: 'Resolution action is required' })}
              className="input"
            >
              <option value="">Select action...</option>
              <option value="accept_variance">Accept Variance</option>
              <option value="recount">Request Recount</option>
              <option value="investigate">Investigate Further</option>
              <option value="write_off">Write Off Shortage</option>
              <option value="charge_agent">Charge to Agent</option>
            </select>
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
              <option value="damaged_goods">Damaged Goods</option>
              <option value="theft">Theft/Loss</option>
              <option value="counting_error">Counting Error</option>
              <option value="system_error">System Error</option>
              <option value="customer_return_not_logged">Customer Return Not Logged</option>
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
              placeholder="Provide detailed explanation of the variance and resolution..."
            />
            {errors.notes && (
              <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Resolution Guidelines</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>Accept Variance:</strong> Use for minor discrepancies that don't require investigation</li>
              <li>• <strong>Recount:</strong> Request physical recount if counting error is suspected</li>
              <li>• <strong>Investigate:</strong> Escalate for further investigation by management</li>
              <li>• <strong>Write Off:</strong> Accept loss and adjust inventory records</li>
              <li>• <strong>Charge Agent:</strong> Deduct shortage value from agent's account</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={resolveMutation.isPending}
              className="btn-primary"
            >
              {resolveMutation.isPending ? 'Resolving...' : 'Resolve Variance'}
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
