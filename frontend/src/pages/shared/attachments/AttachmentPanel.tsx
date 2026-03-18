import { useQuery } from '@tanstack/react-query'
import { Paperclip, Download, Eye, Trash2 } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

interface AttachmentPanelProps {
  entityType: string
  entityId: string
}

export default function AttachmentPanel({ entityType, entityId }: AttachmentPanelProps) {
  const { data: attachments, isLoading, isError } = useQuery({
    queryKey: ['attachments', entityType, entityId],
    queryFn: async () => [
      {
        id: '1',
        file_name: 'invoice.pdf',
        file_type: 'application/pdf',
        file_size: 245000,
        uploaded_by: 'John User',
        uploaded_at: '2024-01-20T10:00:00Z',
      },
      {
        id: '2',
        file_name: 'receipt.jpg',
        file_type: 'image/jpeg',
        file_size: 180000,
        uploaded_by: 'Jane User',
        uploaded_at: '2024-01-20T11:00:00Z',
      },
      {
        id: '3',
        file_name: 'contract.docx',
        file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        file_size: 320000,
        uploaded_by: 'Manager',
        uploaded_at: '2024-01-20T12:00:00Z',
      },
    ],
  })

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (isLoading) {
    return <div className="p-4"><LoadingSpinner size="md" /></div>
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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          Attachments ({attachments?.length || 0})
        </h2>
        <button className="btn-primary text-sm">
          Upload File
        </button>
      </div>

      {attachments && attachments.length > 0 ? (
        <div className="space-y-3">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-surface-secondary">
              <div className="flex items-center gap-3 flex-1">
                <Paperclip className="h-5 w-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{attachment.file_name}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(attachment.file_size)} • Uploaded by {attachment.uploaded_by} • {new Date(attachment.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-blue-600">
                  <Eye className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-green-600">
                  <Download className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Paperclip className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No attachments yet</p>
        </div>
      )}
    </div>
  )
}
