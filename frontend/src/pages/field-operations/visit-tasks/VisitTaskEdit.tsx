import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

interface TaskFormData {
  task_title: string
  description: string
  priority: string
  notes: string
}

export default function VisitTaskEdit() {
  const { visitId, taskId } = useParams<{ visitId: string; taskId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: task, isLoading, isError } = useQuery({
    queryKey: ['visit-task', visitId, taskId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/visits/${visitId}/tasks/${taskId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldTask = {
      id: taskId,
      visit_id: visitId,
      task_title: 'Install promotional board',
      description: 'Install new Coca-Cola promotional board at store entrance',
      priority: 'high',
      notes: 'Board installed successfully, customer satisfied',
    }

  const { register, handleSubmit, formState: { errors } } = useForm<TaskFormData>({
    values: task,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visit-task', visitId, taskId] })
      queryClient.invalidateQueries({ queryKey: ['visit', visitId] })
      toast.success('Task updated successfully')
      navigate(`/field-operations/visits/${visitId}/tasks/${taskId}`)
    },
    onError: () => {
      toast.error('Failed to update task')
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


  if (!task) {
    return <div className="p-6">Task not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/field-operations/visits/${visitId}/tasks/${taskId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Task
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Visit Task</h1>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Title *
            </label>
            <input
              type="text"
              {...register('task_title', { required: 'Task title is required' })}
              className="input"
              placeholder="Enter task title"
            />
            {errors.task_title && (
              <p className="mt-1 text-sm text-red-600">{errors.task_title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              {...register('description', { required: 'Description is required' })}
              rows={3}
              className="input"
              placeholder="Enter task description"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority *
            </label>
            <select
              {...register('priority', { required: 'Priority is required' })}
              className="input"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {errors.priority && (
              <p className="mt-1 text-sm text-red-600">{errors.priority.message}</p>
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
              placeholder="Any additional notes..."
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
              onClick={() => navigate(`/field-operations/visits/${visitId}/tasks/${taskId}`)}
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
