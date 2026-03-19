import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

interface StopFormData {
  planned_arrival: string
  planned_departure: string
  notes: string
}

export default function RouteStopEdit() {
  const { routeId, stopId } = useParams<{ routeId: string; stopId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: stop, isLoading, isError } = useQuery({
    queryKey: ['route-stop', routeId, stopId],
    queryFn: async () => {
      const response = await apiClient.get(`/route-stops/${stopId}`)
      const result = response.data
      return result.data
    },
  })

  const { register, handleSubmit, formState: { errors } } = useForm<StopFormData>({
    values: stop,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: StopFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-stop', routeId, stopId] })
      queryClient.invalidateQueries({ queryKey: ['route', routeId] })
      toast.success('Stop updated successfully')
      navigate(`/van-sales/routes/${routeId}/stops/${stopId}`)
    },
    onError: () => {
      toast.error('Failed to update stop')
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


  if (!stop) {
    return <div className="p-6">Stop not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/van-sales/routes/${routeId}/stops/${stopId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Stop
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Route Stop</h1>
        <p className="text-gray-600">{stop.customer_name}</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Planned Arrival Time *
            </label>
            <input
              type="datetime-local"
              {...register('planned_arrival', { required: 'Planned arrival is required' })}
              className="input"
            />
            {errors.planned_arrival && (
              <p className="mt-1 text-sm text-red-600">{errors.planned_arrival.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Planned Departure Time *
            </label>
            <input
              type="datetime-local"
              {...register('planned_departure', { required: 'Planned departure is required' })}
              className="input"
            />
            {errors.planned_departure && (
              <p className="mt-1 text-sm text-red-600">{errors.planned_departure.message}</p>
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
              placeholder="Any special instructions or notes..."
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
              onClick={() => navigate(`/van-sales/routes/${routeId}/stops/${stopId}`)}
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
