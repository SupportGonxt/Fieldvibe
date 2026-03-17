import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, ArrowRight, Calendar } from 'lucide-react'

export default function BoardLocationChanges() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()

  const { data: board } = useQuery({
    queryKey: ['board', boardId],
    queryFn: async () => {
      const response = await fetch(`/api/boards/${boardId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: changes, isLoading, isError } = useQuery({
    queryKey: ['board-location-changes', boardId],
    queryFn: async () => {
      const response = await fetch(`/api/boards/${boardId}/location-history`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldChanges = [
      {
        id: '1',
        from_location: 'XYZ Mart - Window Display',
        to_location: 'ABC Store - Entrance',
        change_date: '2024-01-20T09:00:00Z',
        reason: 'Better visibility at new location',
        changed_by: 'John Field Agent',
        approved_by: 'Manager',
      },
      {
        id: '2',
        from_location: 'DEF Shop - Counter',
        to_location: 'XYZ Mart - Window Display',
        change_date: '2023-12-15T10:00:00Z',
        reason: 'Store renovation at previous location',
        changed_by: 'Jane Agent',
        approved_by: 'Manager',
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading location changes...</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Board Location Changes</h1>
        <p className="text-gray-600">{board?.board_number} - {board?.brand_name}</p>
      </div>

      <div className="space-y-4">
        {changes?.map((change) => (
          <div key={change.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500">From</p>
                    <p className="text-sm text-gray-900">{change.from_location}</p>
                  </div>
                </div>
                <ArrowRight className="h-6 w-6 text-blue-600" />
                <div className="flex items-center gap-2 flex-1">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500">To</p>
                    <p className="text-sm text-gray-900 font-medium">{change.to_location}</p>
                  </div>
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div>
                <dt className="text-sm font-medium text-gray-500">Change Date</dt>
                <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {new Date(change.change_date).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Changed By</dt>
                <dd className="mt-1 text-sm text-gray-900">{change.changed_by}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Approved By</dt>
                <dd className="mt-1 text-sm text-gray-900">{change.approved_by}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Reason</dt>
                <dd className="mt-1 text-sm text-gray-900">{change.reason}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}
