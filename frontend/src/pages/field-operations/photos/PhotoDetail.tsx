import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Image, MapPin, Calendar, User } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function PhotoDetail() {
  const { visitId, photoId } = useParams<{ visitId: string; photoId: string }>()
  const navigate = useNavigate()

  const { data: photo, isLoading, isError } = useQuery({
    queryKey: ['photo', visitId, photoId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/visits/${visitId}/photos/${photoId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
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


  if (!photo) {
    return <div className="p-6">Photo not found</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Photo Detail</h1>
        <p className="text-gray-600 capitalize">{(photo.photo_type || 'photo').replace('_', ' ')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <img
              src={photo.photo_url}
              alt={photo.caption}
              className="w-full h-auto rounded-lg"
            />
            {photo.caption && (
              <p className="mt-4 text-sm text-gray-700">{photo.caption}</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Photo Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Type</dt>
                <dd className="mt-1 text-sm text-gray-900 capitalize">
                  {(photo.photo_type || 'photo').replace('_', ' ')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Taken At</dt>
                <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {new Date(photo.taken_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Taken By</dt>
                <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                  <User className="h-4 w-4 text-gray-400" />
                  {photo.taken_by}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Address</dt>
                <dd className="mt-1 text-sm text-gray-900 flex items-start gap-1">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  {photo.location?.address || 'Unknown'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Coordinates</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {photo.location?.latitude?.toFixed(6) || '0'}, {photo.location?.longitude?.toFixed(6) || '0'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Device</dt>
                <dd className="mt-1 text-sm text-gray-900">{photo.metadata?.device || 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Resolution</dt>
                <dd className="mt-1 text-sm text-gray-900">{photo.metadata?.resolution || 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">File Size</dt>
                <dd className="mt-1 text-sm text-gray-900">{photo.metadata?.file_size || 'Unknown'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
