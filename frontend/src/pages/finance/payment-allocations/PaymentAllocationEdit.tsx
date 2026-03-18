import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { financeService } from '../../../services/finance.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

interface AllocationFormData {
  allocated_amount: number
  allocation_date: string
  notes: string
}

export default function PaymentAllocationEdit() {
  const { paymentId, allocationId } = useParams<{ paymentId: string; allocationId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: allocation, isLoading, isError } = useQuery({
    queryKey: ['payment-allocation', paymentId, allocationId],
    queryFn: async () => financeService.getPaymentAllocation(paymentId!, allocationId!),
  })

  const { register, handleSubmit, formState: { errors } } = useForm<AllocationFormData>({
    values: allocation,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: AllocationFormData) => {
      return financeService.updatePaymentAllocation(paymentId!, allocationId!, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-allocation', paymentId, allocationId] })
      queryClient.invalidateQueries({ queryKey: ['payment', paymentId] })
      toast.success('Allocation updated successfully')
      navigate(`/finance/payments/${paymentId}/allocations/${allocationId}`)
    },
    onError: () => {
      toast.error('Failed to update allocation')
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


  if (!allocation) {
    return <div className="p-6">Allocation not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/finance/payments/${paymentId}/allocations/${allocationId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Allocation
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Payment Allocation</h1>
        <p className="text-gray-600">{allocation.invoice_number}</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allocated Amount *
            </label>
            <input
              type="number"
              step="0.01"
              {...register('allocated_amount', { required: 'Amount is required', min: 0 })}
              className="input"
            />
            {errors.allocated_amount && (
              <p className="mt-1 text-sm text-red-600">{errors.allocated_amount.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allocation Date *
            </label>
            <input
              type="date"
              {...register('allocation_date', { required: 'Date is required' })}
              className="input"
            />
            {errors.allocation_date && (
              <p className="mt-1 text-sm text-red-600">{errors.allocation_date.message}</p>
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
              onClick={() => navigate(`/finance/payments/${paymentId}/allocations/${allocationId}`)}
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
