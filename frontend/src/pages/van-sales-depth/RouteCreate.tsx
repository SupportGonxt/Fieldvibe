import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'

import { apiClient } from '../../services/api.service'
interface RouteFormData {
  route_name: string
  agent_id: string
  van_id: string
  coverage_area: string
  start_location: string
  status: string
  notes: string
}

export default function RouteCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<RouteFormData>({
    defaultValues: { status: 'active' }
  })

  const createMutation = useMutation({
    mutationFn: async (data: RouteFormData) => {
      const response = await apiClient.post('/van-routes', data)
      return response.data?.data || response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      toast.success('Route created successfully')
      navigate(`/van-sales/routes/${data.id}`)
    },
    onError: () => {
      toast.error('Failed to create route')
    },
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <button onClick={() => navigate('/van-sales/routes')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-5 w-5" />
          Back to Routes
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create Route</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Route Name *</label>
              <input type="text" {...register('route_name', { required: 'Route name is required' })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
              {errors.route_name && <p className="mt-1 text-sm text-red-600">{errors.route_name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Agent *</label>
              <select {...register('agent_id', { required: 'Agent is required' })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Select agent</option>
                <option value="agent-1">John Doe</option>
              </select>
              {errors.agent_id && <p className="mt-1 text-sm text-red-600">{errors.agent_id.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Van *</label>
              <select {...register('van_id', { required: 'Van is required' })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Select van</option>
                <option value="van-1">VAN-001</option>
              </select>
              {errors.van_id && <p className="mt-1 text-sm text-red-600">{errors.van_id.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Coverage Area *</label>
              <input type="text" {...register('coverage_area', { required: 'Coverage area is required' })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
              {errors.coverage_area && <p className="mt-1 text-sm text-red-600">{errors.coverage_area.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Location *</label>
              <input type="text" {...register('start_location', { required: 'Start location is required' })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
              {errors.start_location && <p className="mt-1 text-sm text-red-600">{errors.start_location.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea {...register('notes')} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => navigate('/van-sales/routes')} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary flex items-center gap-2">
              <Save className="h-5 w-5" />
              {createMutation.isPending ? 'Creating...' : 'Create Route'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
