import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Image, Calendar, MapPin } from 'lucide-react'

export default function BoardPhotoHistory() {
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

  const { data: photos, isLoading, isError } = useQuery({
    queryKey: ['board-photo-history', boardId],
    queryFn: async () => {
      const response = await fetch(`/api/boards/${boardId}/photos`, {
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
        photo_type: 'installation',
        location: 'ABC Store - Entrance',
        taken_at: '2024-01-20T09:35:00Z',
        taken_by: 'John Field Agent',
        caption: 'Board installed at new location',
      },
      {
        id: '2',
        photo_url: '/placeholder-photo.jpg',
        photo_type: 'inspection',
        location: 'ABC Store - Entrance',
        taken_at: '2024-01-25T14:00:00Z',
        taken_by: 'Jane Agent',
        caption: 'Weekly inspection - condition excellent',
      },
      {
        id: '3',
        photo_url: '/placeholder-photo.jpg',
        photo_type: 'maintenance',
        location: 'ABC Store - Entrance',
        taken_at: '2024-02-01T10:00:00Z',
        taken_by: 'John Field Agent',
        caption: 'Cleaning and maintenance performed',
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading photo history...</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Board Photo History</h1>
        <p className="text-gray-600">{board?.board_number} - {board?.brand_name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {photos?.map((photo) => (
          <div
            key={photo.id}
            onClick={() => navigate(`/field-operations/boards/${boardId}/photos/${photo.id}`)}
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
                  {photo.photo_type}
                </span>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-medium text-gray-900 mb-2">{photo.caption}</p>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="h-3 w-3" />
                  {photo.location}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" />
                  {new Date(photo.taken_at).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  By {photo.taken_by}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
