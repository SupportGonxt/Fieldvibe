import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Link2, Calendar, User } from 'lucide-react'
import { documentsService } from '../../../services/documents.service'

export default function RelationshipDetail() {
  const { entityType, entityId, relationshipId } = useParams<{ entityType: string; entityId: string; relationshipId: string }>()
  const navigate = useNavigate()

  const { data: relationship, isLoading } = useQuery({
    queryKey: ['relationship', entityType, entityId, relationshipId],
    queryFn: async () => documentsService.getRelationship(entityType!, entityId!, relationshipId!),
  })

  if (isLoading) {
    return <div className="p-6">Loading relationship...</div>
  }

  if (!relationship) {
    return <div className="p-6">Relationship not found</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Relationship Detail</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-center gap-8 mb-6">
          <div className="text-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <Link2 className="h-12 w-12 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-gray-900 capitalize">{relationship.source_entity_type}</p>
            <p className="text-xs text-gray-500">{relationship.source_entity_number}</p>
          </div>

          <div className="flex flex-col items-center">
            <ArrowLeft className="h-8 w-8 text-gray-400 rotate-180" />
            <span className="mt-2 inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-purple-100 text-purple-800 capitalize">
              {relationship.relationship_type}
            </span>
          </div>

          <div className="text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-2">
              <Link2 className="h-12 w-12 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-900 capitalize">{relationship.related_entity_type}</p>
            <p className="text-xs text-gray-500">{relationship.related_entity_number}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Relationship Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Relationship Type</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{relationship.relationship_type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created By</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <User className="h-4 w-4 text-gray-400" />
              {relationship.created_by}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created At</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Calendar className="h-4 w-4 text-gray-400" />
              {new Date(relationship.created_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      {relationship.description && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
          <p className="text-sm text-gray-700">{relationship.description}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/${relationship.source_entity_type}s/${relationship.source_entity_id}`)}
          className="btn-secondary"
        >
          View {relationship.source_entity_type}
        </button>
        <button
          onClick={() => navigate(`/${relationship.related_entity_type}s/${relationship.related_entity_id}`)}
          className="btn-secondary"
        >
          View {relationship.related_entity_type}
        </button>
      </div>
    </div>
  )
}
