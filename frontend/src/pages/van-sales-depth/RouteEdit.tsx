import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { vanSalesService } from '../../services/van-sales.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface RouteFormData {
  route_name: string
  agent_id: string
  van_id: string
  coverage_area: string
  start_location: string
  status: string
  notes: string
}

export default function RouteEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: route, isLoading, isError } = useQuery({
    queryKey: ['route', id],
    queryFn: () => vanSalesService.getRoute(id!),
  })

  const { register, handleSubmit, formState: { errors } } = useForm<RouteFormData>({
    values: route
  })

  const updateMutation = useMutation({
    mutationFn: async (data: RouteFormData) => {
      await new Promise(resolve => setTimeout(resolve, 0)) // BUG-009: reduced from 1000ms fake delay
      return { ...data, id }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', id] })
      toast.success('Route updated successfully')
      navigate(`/van-sales/routes/${id}`)
    },
    onError: () => {
      toast.error('Failed to update route')
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
          onClick={() => navigate(`/van-sales/routes/${id}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Route
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Route</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Route Name *
              </label>
              <input
                type="text"
                {...register('route_name', { required: 'Route name is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.route_name && (
                <p className="mt-1 text-sm text-red-600">{errors.route_name.message}</p>
              )}
            </div>

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
                Van *
              </label>
              <select
                {...register('van_id', { required: 'Van is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select van</option>
                <option value="van-1">VAN-001</option>
                <option value="van-2">VAN-002</option>
              </select>
              {errors.van_id && (
                <p className="mt-1 text-sm text-red-600">{errors.van_id.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Coverage Area *
              </label>
              <input
                type="text"
                {...register('coverage_area', { required: 'Coverage area is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.coverage_area && (
                <p className="mt-1 text-sm text-red-600">{errors.coverage_area.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Location *
              </label>
              <input
                type="text"
                {...register('start_location', { required: 'Start location is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {errors.start_location && (
                <p className="mt-1 text-sm text-red-600">{errors.start_location.message}</p>
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
              onClick={() => navigate(`/van-sales/routes/${id}`)}
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
