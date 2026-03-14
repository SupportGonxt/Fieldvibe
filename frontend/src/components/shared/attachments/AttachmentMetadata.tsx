import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { attachmentsService } from '../../../services/attachments.service'

interface MetadataFormData {
  description: string
  tags: string
  category: string
}

export default function AttachmentMetadata() {
  const { entityType, entityId, attachmentId } = useParams<{ entityType: string; entityId: string; attachmentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: attachment, isLoading } = useQuery({
    queryKey: ['attachment-metadata', entityType, entityId, attachmentId],
    queryFn: async () => attachmentsService.getAttachment(entityType!, entityId!, attachmentId!),
  })

  const { register, handleSubmit, formState: { errors } } = useForm<MetadataFormData>({
    values: attachment,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: MetadataFormData) => {
      return attachmentsService.uploadAttachment(entityType!, entityId!, new File([], ''), { description: data.description, tags: data.tags.split(',').map(t => t.trim()) })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachment-metadata', entityType, entityId, attachmentId] })
      queryClient.invalidateQueries({ queryKey: ['attachment', entityType, entityId, attachmentId] })
      toast.success('Metadata updated successfully')
      navigate(`/attachments/${entityType}/${entityId}/${attachmentId}`)
    },
    onError: () => {
      toast.error('Failed to update metadata')
    },
  })

  if (isLoading) {
    return <div className="p-6">Loading...</div>
  }

  if (!attachment) {
    return <div className="p-6">Attachment not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/attachments/${entityType}/${entityId}/${attachmentId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Attachment
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Attachment Metadata</h1>
        <p className="text-gray-600">{attachment.file_name}</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={4}
              className="input"
              placeholder="Add a description for this file..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <input
              type="text"
              {...register('tags')}
              className="input"
              placeholder="invoice, finance, important (comma-separated)"
            />
            <p className="mt-1 text-sm text-gray-500">
              Separate tags with commas
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              {...register('category')}
              className="input"
            >
              <option value="">Select a category</option>
              <option value="financial">Financial</option>
              <option value="legal">Legal</option>
              <option value="operational">Operational</option>
              <option value="marketing">Marketing</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primary"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/attachments/${entityType}/${entityId}/${attachmentId}`)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
