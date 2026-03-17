import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Image as ImageIcon, Calendar } from 'lucide-react'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function PhotoGallery() {
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

  const { data: photos, isLoading, isError } = useQuery({
    queryKey: ['visit-photos', visitId],
    queryFn: async () => {
      const response = await fetch(`/api/visits/${visitId}/photos`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldPhotos = [
      {
        id: '1',
        photo_url: '/placeholder-photo.jpg',
        photo_type: 'board_placement',
        caption: 'Promotional board at entrance',
        taken_at: '2024-01-20T09:35:00Z',
      },
      {
        id: '2',
        photo_url: '/placeholder-photo.jpg',
        photo_type: 'product_display',
        caption: 'Product display setup',
        taken_at: '2024-01-20T09:50:00Z',
      },
      {
        id: '3',
        photo_url: '/placeholder-photo.jpg',
        photo_type: 'store_front',
        caption: 'Store front view',
        taken_at: '2024-01-20T10:00:00Z',
      },
      {
        id: '4',
        photo_url: '/placeholder-photo.jpg',
        photo_type: 'signature',
        caption: 'Customer signature',
        taken_at: '2024-01-20T10:15:00Z',
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
        <h1 className="text-2xl font-bold text-gray-900">Photo Gallery</h1>
        <p className="text-gray-600">
          {visit?.visit_number} - {visit?.customer_name}
        </p>
      </div>

      <div className="mb-6 flex items-center gap-2 text-sm text-gray-600">
        <ImageIcon className="h-5 w-5" />
        <span>{photos?.length || 0} photos</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {photos?.map((photo) => (
          <div
            key={photo.id}
            onClick={() => navigate(`/field-operations/visits/${visitId}/photos/${photo.id}`)}
            className="bg-white rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="aspect-video bg-gray-200 relative">
              <img
                src={photo.photo_url}
                alt={photo.caption}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2">
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded bg-black bg-opacity-50 text-white capitalize">
                  {photo.photo_type.replace('_', ' ')}
                </span>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-medium text-gray-900 mb-2">{photo.caption}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="h-3 w-3" />
                {new Date(photo.taken_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
