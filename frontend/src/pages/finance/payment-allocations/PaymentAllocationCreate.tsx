import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { financeService } from '../../../services/finance.service'

interface AllocationFormData {
  invoice_id: string
  allocated_amount: number
  allocation_date: string
  notes: string
}

export default function PaymentAllocationCreate() {
  const { paymentId } = useParams<{ paymentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: payment } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: async () => financeService.getPayment(paymentId!),
  })

  const { data: invoices } = useQuery({
    queryKey: ['customer-invoices', payment?.customer_id],
    queryFn: async () => financeService.getInvoicesList(),
    enabled: !!payment?.customer_id,
  })

  const { register, handleSubmit, formState: { errors } } = useForm<AllocationFormData>({
    defaultValues: {
      allocation_date: new Date().toISOString().split('T')[0],
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: AllocationFormData) => {
      return { id: 'new-allocation', ...data }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-allocations', paymentId] })
      queryClient.invalidateQueries({ queryKey: ['payment', paymentId] })
      toast.success('Allocation created successfully')
      navigate(`/finance/payments/${paymentId}/allocations/${data.id}`)
    },
    onError: () => {
      toast.error('Failed to create allocation')
    },
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/finance/payments/${paymentId}/allocations`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Allocations
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create Payment Allocation</h1>
        <p className="text-gray-600">{payment?.payment_number} - {payment?.customer_name}</p>
      </div>

      <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice *
            </label>
            <select
              {...register('invoice_id', { required: 'Invoice is required' })}
              className="input"
            >
              <option value="">Select invoice...</option>
              {invoices?.invoices?.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} (Balance: ${invoice.balance.toFixed(2)})
                </option>
              ))}
            </select>
            {errors.invoice_id && (
              <p className="mt-1 text-sm text-red-600">{errors.invoice_id.message}</p>
            )}
          </div>

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
              placeholder="Optional notes about this allocation..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Allocation'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/finance/payments/${paymentId}/allocations`)}
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
