import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Image, Clock } from 'lucide-react'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function PhotoTimeline() {
  const { visitId } = useParams<{ visitId: string }>()
  const navigate = useNavigate()

  const { data: visit } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/visits/${visitId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: photos, isLoading, isError } = useQuery({
    queryKey: ['visit-photos-timeline', visitId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/visits/${visitId}/photos/timeline`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
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
        <h1 className="text-2xl font-bold text-gray-900">Photo Timeline</h1>
        <p className="text-gray-600">
          {visit?.visit_number} - {visit?.customer_name}
        </p>
      </div>

      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-8">
          {photos?.map((photo, index) => (
            <div key={photo.id} className="relative flex gap-6">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 border-4 border-white shadow z-10">
                  <Image className="h-6 w-6 text-blue-600" />
                </div>
              </div>

              <div className="flex-1 bg-white rounded-lg shadow p-6">
                <div className="flex items-start gap-4">
                  <img
                    src={photo.photo_url}
                    alt={photo.caption}
                    onClick={() => navigate(`/field-operations/visits/${visitId}/photos/${photo.id}`)}
                    className="w-32 h-32 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{photo.caption}</h3>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize mt-1">
                          {photo.photo_type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-3">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {new Date(photo.taken_at).toLocaleString()}
                      </div>
                      <div>By {photo.taken_by}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
