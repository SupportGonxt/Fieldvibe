import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'

import { apiClient } from '../../services/api.service'
interface InvoiceFormData {
  customer_id: string
  issue_date: string
  due_date: string
  subtotal: number
  tax: number
  notes: string
}

export default function InvoiceCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<InvoiceFormData>({
    defaultValues: {
      tax: 0
    }
  })

  const createMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      const response = await apiClient.post('/finance/invoices', data)
      return response.data?.data || response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice created successfully')
      navigate(`/finance/invoices/${data.id}`)
    },
    onError: () => {
      toast.error('Failed to create invoice')
    },
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/finance/invoices')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Invoices
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create Invoice</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer *
            </label>
            <select
              {...register('customer_id', { required: 'Customer is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select customer</option>
              <option value="cust-1">ABC Store</option>
              <option value="cust-2">XYZ Shop</option>
            </select>
            {errors.customer_id && (
              <p className="mt-1 text-sm text-red-600">{errors.customer_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Issue Date *
              </label>
              <input
                type="date"
                {...register('issue_date', { required: 'Issue date is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.issue_date && (
                <p className="mt-1 text-sm text-red-600">{errors.issue_date.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date *
              </label>
              <input
                type="date"
                {...register('due_date', { required: 'Due date is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.due_date && (
                <p className="mt-1 text-sm text-red-600">{errors.due_date.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subtotal *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('subtotal', { required: 'Subtotal is required', min: 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.subtotal && (
                <p className="mt-1 text-sm text-red-600">{errors.subtotal.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tax
              </label>
              <input
                type="number"
                step="0.01"
                {...register('tax', { min: 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
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
              onClick={() => navigate('/finance/invoices')}
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
              {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
