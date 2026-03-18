import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

interface CountLineFormData {
  counted_quantity: number
  notes: string
}

export default function CountLineEdit() {
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
      expected_quantity: 100,
      counted_quantity: 95,
      notes: 'Found 5 damaged units',
    }

  const { register, handleSubmit, formState: { errors } } = useForm<CountLineFormData>({
    values: line,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: CountLineFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['count-line', countId, lineId] })
      queryClient.invalidateQueries({ queryKey: ['stock-count', countId] })
      toast.success('Count line updated successfully')
      navigate(`/inventory/stock-counts/${countId}/lines/${lineId}`)
    },
    onError: () => {
      toast.error('Failed to update count line')
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
        <h1 className="text-2xl font-bold text-gray-900">Edit Count Line</h1>
        <p className="text-gray-600">{line.product_name}</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div className="bg-surface-secondary border border-gray-100 rounded-lg p-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Expected Quantity</dt>
                <dd className="mt-1 text-lg font-bold text-gray-900">{line.expected_quantity}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Product</dt>
                <dd className="mt-1 text-sm text-gray-900">{line.product_name}</dd>
              </div>
            </dl>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Counted Quantity *
            </label>
            <input
              type="number"
              {...register('counted_quantity', { required: 'Counted quantity is required', min: 0 })}
              className="input"
            />
            {errors.counted_quantity && (
              <p className="mt-1 text-sm text-red-600">{errors.counted_quantity.message}</p>
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
              placeholder="Any observations or issues during counting..."
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
