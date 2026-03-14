import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Image, FileText, File } from 'lucide-react'

interface AttachmentGalleryProps {
  entityType: string
  entityId: string
}

export default function AttachmentGallery({ entityType, entityId }: AttachmentGalleryProps) {
  const navigate = useNavigate()

  const { data: attachments, isLoading } = useQuery({
    queryKey: ['attachments-gallery', entityType, entityId],
    queryFn: async () => [
      {
        id: '1',
        file_name: 'product-photo-1.jpg',
        file_type: 'image/jpeg',
        file_url: '/placeholder-photo.jpg',
        thumbnail_url: '/placeholder-photo.jpg',
        uploaded_at: '2024-01-20T10:00:00Z',
      },
      {
        id: '2',
        file_name: 'product-photo-2.jpg',
        file_type: 'image/jpeg',
        file_url: '/placeholder-photo.jpg',
        thumbnail_url: '/placeholder-photo.jpg',
        uploaded_at: '2024-01-20T11:00:00Z',
      },
      {
        id: '3',
        file_name: 'invoice.pdf',
        file_type: 'application/pdf',
        file_url: '/placeholder-file.pdf',
        thumbnail_url: null,
        uploaded_at: '2024-01-20T12:00:00Z',
      },
      {
        id: '4',
        file_name: 'contract.docx',
        file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        file_url: '/placeholder-file.docx',
        thumbnail_url: null,
        uploaded_at: '2024-01-20T13:00:00Z',
      },
    ],
  })

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return Image
    if (fileType.includes('pdf')) return FileText
    return File
  }

  if (isLoading) {
    return <div className="p-6">Loading gallery...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Attachment Gallery ({attachments?.length || 0})
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {attachments?.map((attachment) => {
          const FileIcon = getFileIcon(attachment.file_type)
          const isImage = attachment.file_type.startsWith('image/')

          return (
            <div
              key={attachment.id}
              onClick={() => navigate(`/attachments/${entityType}/${entityId}/${attachment.id}`)}
              className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            >
              {isImage && attachment.thumbnail_url ? (
                <img
                  src={attachment.thumbnail_url}
                  alt={attachment.file_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileIcon className="h-16 w-16 text-gray-400" />
                </div>
              )}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-end">
                <div className="w-full p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                  <p className="text-xs">{new Date(attachment.uploaded_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {attachments && attachments.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Image className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-sm">No attachments to display</p>
        </div>
      )}
    </div>
  )
}
