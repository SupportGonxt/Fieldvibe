import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Wrench, Calendar, CheckCircle } from 'lucide-react'
import { apiClient } from '../../../services/api.service'

export default function BoardMaintenanceLog() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()

  const { data: board } = useQuery({
    queryKey: ['board', boardId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/boards/${boardId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: logs, isLoading, isError } = useQuery({
    queryKey: ['board-maintenance-log', boardId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/boards/${boardId}/maintenance`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldLogs = [
      {
        id: '1',
        maintenance_type: 'cleaning',
        maintenance_date: '2024-02-01T10:00:00Z',
        performed_by: 'John Field Agent',
        duration_minutes: 30,
        status: 'completed',
        notes: 'Board cleaned, all surfaces wiped down',
        photos_taken: 2,
      },
      {
        id: '2',
        maintenance_type: 'repair',
        maintenance_date: '2024-01-28T14:00:00Z',
        performed_by: 'Jane Agent',
        duration_minutes: 45,
        status: 'completed',
        notes: 'Replaced damaged corner bracket',
        photos_taken: 3,
      },
      {
        id: '3',
        maintenance_type: 'inspection',
        maintenance_date: '2024-01-25T10:00:00Z',
        performed_by: 'Jane Manager',
        duration_minutes: 15,
        status: 'completed',
        notes: 'Routine inspection - no issues found',
        photos_taken: 1,
      },
      {
        id: '4',
        maintenance_type: 'replacement',
        maintenance_date: '2024-01-20T09:00:00Z',
        performed_by: 'John Field Agent',
        duration_minutes: 60,
        status: 'completed',
        notes: 'Replaced worn promotional material',
        photos_taken: 4,
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading maintenance log...</div>
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
          onClick={() => navigate(`/field-operations/boards/${boardId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Board
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Board Maintenance Log</h1>
        <p className="text-gray-600">{board?.board_number} - {board?.brand_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Wrench className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Total Maintenance</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{logs?.length || 0}</p>
          <p className="text-sm text-gray-600 mt-1">activities</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Completed</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">
            {logs?.filter(l => l.status === 'completed').length || 0}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Last Maintenance</h3>
          </div>
          <p className="text-sm text-gray-900">
            {logs && logs.length > 0 
              ? new Date(logs[0].maintenance_date).toLocaleDateString()
              : 'N/A'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {logs?.map((log) => (
          <div key={log.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <Wrench className="h-6 w-6 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 capitalize">
                    {log.maintenance_type}
                  </h3>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                    log.status === 'completed' ? 'bg-green-100 text-green-800' :
                    log.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {log.status}
                  </span>
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Date</dt>
                <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {new Date(log.maintenance_date).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Performed By</dt>
                <dd className="mt-1 text-sm text-gray-900">{log.performed_by}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Duration</dt>
                <dd className="mt-1 text-sm text-gray-900">{log.duration_minutes} minutes</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Photos</dt>
                <dd className="mt-1 text-sm text-gray-900">{log.photos_taken}</dd>
              </div>
            </dl>

            {log.notes && (
              <div className="mt-3 p-3 bg-surface-secondary rounded">
                <p className="text-sm text-gray-700">{log.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
