import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, Clock, User, FileText } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function VisitTaskDetail() {
  const { visitId, taskId } = useParams<{ visitId: string; taskId: string }>()
  const navigate = useNavigate()

  const { data: visit } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: async () => {
      const response = await fetch(`/api/visits/${visitId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: task, isLoading, isError } = useQuery({
    queryKey: ['visit-task', visitId, taskId],
    queryFn: async () => {
      const response = await fetch(`/api/visits/${visitId}/tasks/${taskId}`, {
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
      task_type: 'board_placement',
      task_title: 'Install promotional board',
      description: 'Install new Coca-Cola promotional board at store entrance',
      status: 'completed',
      priority: 'high',
      assigned_to: 'John Field Agent',
      assigned_at: '2024-01-20T08:00:00Z',
      started_at: '2024-01-20T09:15:00Z',
      completed_at: '2024-01-20T09:45:00Z',
      duration_minutes: 30,
      notes: 'Board installed successfully, customer satisfied',
      completion_photos: 2,
      customer_signature: true,
    }

  if (isLoading) {
    return <div className="p-6">Loading task details...</div>
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
          onClick={() => navigate(`/field-operations/visits/${visitId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Visit
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Visit Task Detail</h1>
        <p className="text-gray-600">{visit?.visit_number} - {visit?.agent_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Task Type</h3>
          </div>
          <p className="text-lg font-bold text-gray-900 capitalize">
            {task.task_type.replace('_', ' ')}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Duration</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{task.duration_minutes}</p>
          <p className="text-sm text-gray-600 mt-1">minutes</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className={`h-5 w-5 ${
              task.status === 'completed' ? 'text-green-600' : 'text-gray-400'
            }`} />
            <h3 className="font-semibold text-gray-900">Status</h3>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
            task.status === 'completed' ? 'bg-green-100 text-green-800' :
            task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
            task.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {task.status}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Task Title</dt>
            <dd className="mt-1 text-sm text-gray-900">{task.task_title}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Priority</dt>
            <dd className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                task.priority === 'high' ? 'bg-red-100 text-red-800' :
                task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {task.priority}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Assigned To</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <User className="h-4 w-4 text-gray-400" />
              {task.assigned_to}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Assigned At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(task.assigned_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
        <p className="text-sm text-gray-700">{task.description}</p>
      </div>

      {task.status === 'completed' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Completion Details</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Started At</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(task.started_at).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Completed At</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(task.completed_at).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Completion Photos</dt>
              <dd className="mt-1 text-sm text-gray-900">{task.completion_photos}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer Signature</dt>
              <dd className="mt-1">
                {task.customer_signature ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <span className="text-sm text-gray-500">No</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {task.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{task.notes}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/field-operations/visits/${visitId}/tasks/${taskId}/edit`)}
          className="btn-secondary"
        >
          Edit
        </button>
        {task.completion_photos > 0 && (
          <button
            onClick={() => navigate(`/field-operations/visits/${visitId}/tasks/${taskId}/photos`)}
            className="btn-secondary"
          >
            View Photos
          </button>
        )}
      </div>
    </div>
  )
}
