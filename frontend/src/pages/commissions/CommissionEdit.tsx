import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

import { apiClient } from '../../services/api.service'
interface CommissionFormData {
  base_amount: number
  bonus_amount: number
  status: string
  payment_date: string
  notes: string
}

export default function CommissionEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: commission, isLoading, isError } = useQuery({
    queryKey: ['commission', id],
    queryFn: async () => {
      return {
        id,
        base_amount: 5000,
        bonus_amount: 1500,
        status: 'approved',
        payment_date: '2024-02-05',
        notes: 'Exceeded target by 24%'
      }
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm<CommissionFormData>({
    values: commission
  })

  const updateMutation = useMutation({
    mutationFn: async (data: CommissionFormData) => {
      const response = await apiClient.put(`/commissions/${id}`, data)
      return response.data?.data || response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission', id] })
      toast.success('Commission updated successfully')
      navigate(`/commissions/${id}`)
    },
    onError: () => {
      toast.error('Failed to update commission')
    },
  })

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner size="md" /></div>
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


  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/commissions/${id}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Commission
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Commission</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              onClick={() => navigate(`/commissions/${id}`)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="h-5 w-5" />
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
