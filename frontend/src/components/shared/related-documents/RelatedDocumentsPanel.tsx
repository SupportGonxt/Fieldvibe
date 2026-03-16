import { useQuery } from '@tanstack/react-query'
import { Link2, Eye, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface RelatedDocumentsPanelProps {
  entityType: string
  entityId: string
}

export default function RelatedDocumentsPanel({ entityType, entityId }: RelatedDocumentsPanelProps) {
  const navigate = useNavigate()

  const { data: relatedDocs, isLoading } = useQuery({
    queryKey: ['related-documents', entityType, entityId],
    queryFn: async () => [
      {
        id: '1',
        relationship_type: 'parent',
        related_entity_type: 'order',
        related_entity_id: 'order-1',
        related_entity_number: 'ORD-2024-001',
        related_entity_title: 'Customer Order',
        created_at: '2024-01-20T09:00:00Z',
      },
      {
        id: '2',
        relationship_type: 'child',
        related_entity_type: 'invoice',
        related_entity_id: 'invoice-1',
        related_entity_number: 'INV-2024-001',
        related_entity_title: 'Invoice for Order',
        created_at: '2024-01-20T10:00:00Z',
      },
      {
        id: '3',
        relationship_type: 'related',
        related_entity_type: 'payment',
        related_entity_id: 'payment-1',
        related_entity_number: 'PAY-2024-001',
        related_entity_title: 'Payment Received',
        created_at: '2024-01-20T11:00:00Z',
      },
    ],
  })

  const getRelationshipBadge = (type: string) => {
    const colors = {
      parent: 'bg-blue-100 text-blue-800',
      child: 'bg-green-100 text-green-800',
      related: 'bg-purple-100 text-purple-800',
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  if (isLoading) {
    return <div className="p-4">Loading related documents...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Related Documents ({relatedDocs?.length || 0})
        </h2>
        <button
          onClick={() => navigate(`/related-documents/${entityType}/${entityId}`)}
          className="text-sm text-primary-600 hover:text-primary-900"
        >
          View All
        </button>
      </div>

      {relatedDocs && relatedDocs.length > 0 ? (
        <div className="space-y-3">
          {relatedDocs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => navigate(`/${doc.related_entity_type}s/${doc.related_entity_id}`)}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-surface-secondary cursor-pointer"
            >
              <div className="flex items-center gap-3 flex-1">
                <Link2 className="h-5 w-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900">{doc.related_entity_number}</p>
                    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getRelationshipBadge(doc.relationship_type)}`}>
                      {doc.relationship_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{doc.related_entity_title}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Link2 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No related documents</p>
        </div>
      )}
    </div>
  )
}
