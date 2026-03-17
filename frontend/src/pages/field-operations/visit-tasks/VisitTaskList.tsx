import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, CheckCircle, Clock } from 'lucide-react'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function VisitTaskList() {
  const { visitId } = useParams<{ visitId: string }>()
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

  const { data: tasks, isLoading, isError } = useQuery({
    queryKey: ['visit-tasks', visitId],
    queryFn: async () => {
      const response = await fetch(`/api/visits/${visitId}/tasks`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldTasks = [
      {
        id: '1',
        task_type: 'board_placement',
        task_title: 'Install promotional board',
        priority: 'high',
        status: 'completed',
        duration_minutes: 30,
        completed_at: '2024-01-20T09:45:00Z',
      },
      {
        id: '2',
        task_type: 'product_distribution',
        task_title: 'Distribute product samples',
        priority: 'medium',
        status: 'completed',
        duration_minutes: 15,
        completed_at: '2024-01-20T10:00:00Z',
      },
      {
        id: '3',
        task_type: 'survey',
        task_title: 'Complete customer survey',
        priority: 'low',
        status: 'completed',
        duration_minutes: 10,
        completed_at: '2024-01-20T10:10:00Z',
      },
    ]

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
          onClick={() => navigate(`/field-operations/visits/${visitId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Visit
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Visit Tasks</h1>
        <p className="text-gray-600">
          {visit?.visit_number} - {visit?.customer_name}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks?.map((task) => (
              <tr key={task.id} className="hover:bg-surface-secondary">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                  {task.task_type.replace('_', ' ')}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {task.task_title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    task.priority === 'high' ? 'bg-red-100 text-red-800' :
                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3 text-gray-400" />
                    {task.duration_minutes} min
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    task.status === 'completed' ? 'bg-green-100 text-green-800' :
                    task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {task.completed_at 
                    ? new Date(task.completed_at).toLocaleString()
                    : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => navigate(`/field-operations/visits/${visitId}/tasks/${task.id}`)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
