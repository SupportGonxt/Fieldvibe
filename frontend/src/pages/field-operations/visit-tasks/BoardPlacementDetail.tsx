import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Package, Calendar, Image } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function BoardPlacementDetail() {
  const { visitId, placementId } = useParams<{ visitId: string; placementId: string }>()
  const navigate = useNavigate()

  const { data: placement, isLoading, isError } = useQuery({
    queryKey: ['board-placement', visitId, placementId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/visits/${visitId}/board-placements/${placementId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldPlacement = {
      id: placementId,
      visit_id: visitId,
      board_id: 'board-1',
      board_type: 'promotional',
      brand_name: 'Coca-Cola',
      location_description: 'Store entrance, right side',
      installation_date: '2024-01-20T09:30:00Z',
      installed_by: 'John Field Agent',
      dimensions: '2m x 1m',
      condition: 'excellent',
      visibility_rating: 5,
      photos_taken: 3,
      customer_approval: true,
      notes: 'Perfect location with high visibility',
    }

  if (isLoading) {
    return <div className="p-6">Loading placement details...</div>
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


  if (!placement) {
    return <div className="p-6">Placement not found</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Board Placement Detail</h1>
        <p className="text-gray-600">{placement.brand_name} - {placement.board_type}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Board Type</h3>
          </div>
          <p className="text-lg font-bold text-gray-900 capitalize">{placement.board_type}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Visibility</h3>
          </div>
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <span key={i} className={`text-2xl ${
                i < placement.visibility_rating ? 'text-yellow-400' : 'text-gray-300'
              }`}>
                ★
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Image className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Photos</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{placement.photos_taken}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Placement Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Brand</dt>
            <dd className="mt-1 text-sm text-gray-900">{placement.brand_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Board Type</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{placement.board_type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Location</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-start gap-1">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
              {placement.location_description}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Dimensions</dt>
            <dd className="mt-1 text-sm text-gray-900">{placement.dimensions}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Installation Date</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Calendar className="h-4 w-4 text-gray-400" />
              {new Date(placement.installation_date).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Installed By</dt>
            <dd className="mt-1 text-sm text-gray-900">{placement.installed_by}</dd>
          </div>
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
            <dt className="text-sm font-medium text-gray-500">Customer Approval</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {placement.customer_approval ? 'Yes' : 'No'}
            </dd>
          </div>
        </dl>
      </div>

      {placement.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{placement.notes}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/field-operations/boards/${placement.board_id}`)}
          className="btn-secondary"
        >
          View Board
        </button>
        {placement.photos_taken > 0 && (
          <button
            onClick={() => navigate(`/field-operations/visits/${visitId}/placements/${placementId}/photos`)}
            className="btn-secondary"
          >
            View Photos
          </button>
        )}
      </div>
    </div>
  )
}
