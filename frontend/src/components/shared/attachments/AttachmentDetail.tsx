import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Paperclip, Download, Calendar, User } from 'lucide-react'
import { attachmentsService } from '../../../services/attachments.service'

export default function AttachmentDetail() {
  const { entityType, entityId, attachmentId } = useParams<{ entityType: string; entityId: string; attachmentId: string }>()
  const navigate = useNavigate()

  const { data: attachment, isLoading } = useQuery({
    queryKey: ['attachment', entityType, entityId, attachmentId],
    queryFn: async () => attachmentsService.getAttachment(entityType!, entityId!, attachmentId!),
  })

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (isLoading) {
    return <div className="p-6">Loading attachment...</div>
  }

  if (!attachment) {
    return <div className="p-6">Attachment not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Attachment Detail</h1>
        <p className="text-gray-600">{attachment.file_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center mb-4">
              <Paperclip className="h-16 w-16 text-gray-400" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">File Name</p>
                <p className="text-lg font-semibold text-gray-900">{attachment.file_name}</p>
              </div>
              <button className="btn-primary flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">File Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">File Type</dt>
                <dd className="mt-1 text-sm text-gray-900">{attachment.file_type}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">File Size</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatFileSize(attachment.file_size)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Uploaded By</dt>
                <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                  <User className="h-4 w-4 text-gray-400" />
                  {attachment.uploaded_by}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Uploaded At</dt>
                <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {new Date(attachment.uploaded_at).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {attachment.description && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
              <p className="text-sm text-gray-700">{attachment.description}</p>
            </div>
          )}

          {attachment.tags && attachment.tags.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {attachment.tags.map((tag, idx) => (
                  <span key={idx} className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
