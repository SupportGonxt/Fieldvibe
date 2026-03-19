import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'

import { apiClient } from '../../services/api.service'
interface PaymentFormData {
  invoice_id: string
  amount: number
  payment_date: string
  payment_method: string
  reference_number: string
  status: string
  notes: string
}

export default function PaymentCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<PaymentFormData>({
    defaultValues: {
      status: 'pending'
    }
  })

  const createMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      const response = await apiClient.post('/payments', data)
      return response.data?.data || response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Payment created successfully')
      navigate(`/finance/payments/${data.id}`)
    },
    onError: () => {
      toast.error('Failed to create payment')
    },
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/finance/payments')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Payments
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Record Payment</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice *
            </label>
            <select
              {...register('invoice_id', { required: 'Invoice is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select invoice</option>
              <option value="inv-1">INV-2024-001 - ABC Store</option>
              <option value="inv-2">INV-2024-002 - XYZ Shop</option>
            </select>
            {errors.invoice_id && (
              <p className="mt-1 text-sm text-red-600">{errors.invoice_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('amount', { required: 'Amount is required', min: 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Date *
              </label>
              <input
                type="date"
                {...register('payment_date', { required: 'Payment date is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.payment_date && (
                <p className="mt-1 text-sm text-red-600">{errors.payment_date.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method *
              </label>
              <select
                {...register('payment_method', { required: 'Payment method is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select method</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Cheque">Cheque</option>
              </select>
              {errors.payment_method && (
                <p className="mt-1 text-sm text-red-600">{errors.payment_method.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference Number
              </label>
              <input
                type="text"
                {...register('reference_number')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status *
              </label>
              <select
                {...register('status', { required: 'Status is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
              </select>
              {errors.status && (
                <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter any notes"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/finance/payments')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="h-5 w-5" />
              {createMutation.isPending ? 'Creating...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
