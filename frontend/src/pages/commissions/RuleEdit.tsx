import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface RuleFormData {
  name: string
  description: string
  base_rate: number
  bonus_threshold: number
  bonus_rate: number
  status: string
  effective_from: string
}

export default function RuleEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: rule, isLoading, isError } = useQuery({
    queryKey: ['commission-rule', id],
    queryFn: async () => {
      return {
        id,
        name: 'Standard Sales Commission',
        description: 'Base commission for all sales agents',
        base_rate: 5,
        bonus_threshold: 50000,
        bonus_rate: 2,
        status: 'active',
        effective_from: '2024-01-01'
      }
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm<RuleFormData>({
    values: rule
  })

  const updateMutation = useMutation({
    mutationFn: async (data: RuleFormData) => {
      await new Promise(resolve => setTimeout(resolve, 0)) // BUG-009: reduced from 1000ms fake delay
      return { ...data, id }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-rule', id] })
      toast.success('Rule updated successfully')
      navigate(`/commissions/rules/${id}`)
    },
    onError: () => {
      toast.error('Failed to update rule')
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
          onClick={() => navigate(`/commissions/rules/${id}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Rule
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Commission Rule</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rule Name *
              </label>
              <input
                type="text"
                {...register('name', { required: 'Name is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base Rate (%) *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('base_rate', { required: 'Base rate is required', min: 0, max: 100 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.base_rate && (
                <p className="mt-1 text-sm text-red-600">{errors.base_rate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bonus Threshold *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('bonus_threshold', { required: 'Bonus threshold is required', min: 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.bonus_threshold && (
                <p className="mt-1 text-sm text-red-600">{errors.bonus_threshold.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bonus Rate (%) *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('bonus_rate', { required: 'Bonus rate is required', min: 0, max: 100 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.bonus_rate && (
                <p className="mt-1 text-sm text-red-600">{errors.bonus_rate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status *
              </label>
              <select
                {...register('status', { required: 'Status is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              {errors.status && (
                <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Effective From *
              </label>
              <input
                type="date"
                {...register('effective_from', { required: 'Effective date is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.effective_from && (
                <p className="mt-1 text-sm text-red-600">{errors.effective_from.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(`/commissions/rules/${id}`)}
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
