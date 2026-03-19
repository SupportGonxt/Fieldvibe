import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'

import { apiClient } from '../../services/api.service'
interface CommissionFormData {
  agent_id: string
  period: string
  base_amount: number
  bonus_amount: number
  status: string
  payment_date: string
  notes: string
}

export default function CommissionCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<CommissionFormData>({
    defaultValues: {
      status: 'pending',
      bonus_amount: 0
    }
  })

  const createMutation = useMutation({
    mutationFn: async (data: CommissionFormData) => {
      const response = await apiClient.post('/commissions', data)
      return response.data?.data || response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] })
      toast.success('Commission created successfully')
      navigate(`/commissions/${data.id}`)
    },
    onError: () => {
      toast.error('Failed to create commission')
    },
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/commissions')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Commissions
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create Commission</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent *
              </label>
              <select
                {...register('agent_id', { required: 'Agent is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select agent</option>
                <option value="agent-1">John Doe</option>
                <option value="agent-2">Jane Smith</option>
              </select>
              {errors.agent_id && (
                <p className="mt-1 text-sm text-red-600">{errors.agent_id.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Period *
              </label>
              <input
                type="text"
                {...register('period', { required: 'Period is required' })}
                placeholder="e.g., January 2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.period && (
                <p className="mt-1 text-sm text-red-600">{errors.period.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base Amount *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('base_amount', { required: 'Base amount is required', min: 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.base_amount && (
                <p className="mt-1 text-sm text-red-600">{errors.base_amount.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bonus Amount
              </label>
              <input
                type="number"
                step="0.01"
                {...register('bonus_amount', { min: 0 })}
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
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select>
              {errors.status && (
                <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
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
              onClick={() => navigate('/commissions')}
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
              {createMutation.isPending ? 'Creating...' : 'Create Commission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
