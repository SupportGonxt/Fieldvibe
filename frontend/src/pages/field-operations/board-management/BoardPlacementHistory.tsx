import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Calendar, Eye } from 'lucide-react'
import { apiClient } from '../../../services/api.service'

export default function BoardPlacementHistory() {
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

  const { data: placements, isLoading, isError } = useQuery({
    queryKey: ['board-placement-history', boardId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/boards/${boardId}/placements`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldPlacements = [
      {
        id: '1',
        location: 'ABC Store - Entrance',
        installed_at: '2024-01-20T09:30:00Z',
        removed_at: null,
        status: 'active',
        condition: 'excellent',
        installed_by: 'John Field Agent',
      },
      {
        id: '2',
        location: 'XYZ Mart - Window Display',
        installed_at: '2023-12-15T10:00:00Z',
        removed_at: '2024-01-15T14:00:00Z',
        status: 'removed',
        condition: 'good',
        installed_by: 'Jane Agent',
      },
      {
        id: '3',
        location: 'DEF Shop - Counter',
        installed_at: '2023-11-01T11:00:00Z',
        removed_at: '2023-12-10T15:00:00Z',
        status: 'removed',
        condition: 'fair',
        installed_by: 'John Field Agent',
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading placement history...</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Board Placement History</h1>
        <p className="text-gray-600">{board?.board_number} - {board?.brand_name}</p>
      </div>

      <div className="space-y-4">
        {placements?.map((placement) => (
          <div key={placement.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-blue-600 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{placement.location}</h3>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                    placement.status === 'active' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {placement.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate(`/field-operations/boards/${boardId}/placements/${placement.id}`)}
                className="text-primary-600 hover:text-primary-900"
              >
                <Eye className="h-5 w-5" />
              </button>
            </div>

            <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Installed At</dt>
                <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {new Date(placement.installed_at).toLocaleString()}
                </dd>
              </div>
              {placement.removed_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Removed At</dt>
                  <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    {new Date(placement.removed_at).toLocaleString()}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Condition</dt>
                <dd className="mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    placement.condition === 'excellent' ? 'bg-green-100 text-green-800' :
                    placement.condition === 'good' ? 'bg-blue-100 text-blue-800' :
                    placement.condition === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {placement.condition}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Installed By</dt>
                <dd className="mt-1 text-sm text-gray-900">{placement.installed_by}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}
