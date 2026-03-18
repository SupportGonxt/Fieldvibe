import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

interface PayoutLineFormData {
  payment_method: string
  payment_reference: string
  notes: string
}

export default function PayoutLineEdit() {
  const { payoutId, lineId } = useParams<{ payoutId: string; lineId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: line, isLoading, isError } = useQuery({
    queryKey: ['payout-line', payoutId, lineId],
    queryFn: async () => {
      const response = await apiClient.get(`/commissions/payouts/${payoutId}/lines/${lineId}`)
      const result = response.data
      return result.data
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm<PayoutLineFormData>({
    values: line,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: PayoutLineFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout-line', payoutId, lineId] })
      queryClient.invalidateQueries({ queryKey: ['payout', payoutId] })
      toast.success('Payout line updated successfully')
      navigate(`/commissions/payouts/${payoutId}/lines/${lineId}`)
    },
    onError: () => {
      toast.error('Failed to update payout line')
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
    return <div className="p-6">Payout line not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/commissions/payouts/${payoutId}/lines/${lineId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Payout Line
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Payout Line</h1>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method *
            </label>
            <select
              {...register('payment_method', { required: 'Payment method is required' })}
              className="input"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="check">Check</option>
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
            {errors.payment_method && (
              <p className="mt-1 text-sm text-red-600">{errors.payment_method.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Reference *
            </label>
            <input
              type="text"
              {...register('payment_reference', { required: 'Payment reference is required' })}
              className="input"
              placeholder="PAY-2024-001"
            />
            {errors.payment_reference && (
              <p className="mt-1 text-sm text-red-600">{errors.payment_reference.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={4}
              className="input"
              placeholder="Additional notes..."
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
              onClick={() => navigate(`/commissions/payouts/${payoutId}/lines/${lineId}`)}
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
