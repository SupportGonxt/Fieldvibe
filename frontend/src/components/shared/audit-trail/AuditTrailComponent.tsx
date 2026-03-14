import { useQuery } from '@tanstack/react-query'
import { Clock, User, Filter } from 'lucide-react'
import { auditService } from '../../../services/audit.service'

interface AuditTrailComponentProps {
  entityType: string
  entityId: string
}

export default function AuditTrailComponent({ entityType, entityId }: AuditTrailComponentProps) {
  const { data: auditTrail, isLoading } = useQuery({
    queryKey: ['audit-trail', entityType, entityId],
    queryFn: async () => auditService.getAuditTrail(entityType, entityId),
  })

  if (isLoading) {
    return <div className="p-4">Loading audit trail...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Audit Trail</h2>
        <button className="text-sm text-primary-600 hover:text-primary-900 flex items-center gap-1">
          <Filter className="h-4 w-4" />
          Filter
        </button>
      </div>

      <div className="space-y-4">
        {auditTrail?.map((entry) => (
          <div key={entry.id} className="border-l-2 border-blue-200 pl-4 py-2">
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900">{entry.description}</h3>
              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                {entry.action}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {entry.performed_by}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(entry.performed_at).toLocaleString()}
              </div>
            </div>
            {entry.details && Object.keys(entry.details).length > 0 && (
              <div className="mt-2 p-2 bg-surface-secondary rounded text-xs">
                {Object.entries(entry.details).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>
                    <span className="text-gray-700">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
