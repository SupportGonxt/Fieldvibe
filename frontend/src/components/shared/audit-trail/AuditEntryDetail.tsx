import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, User, Clock, Monitor, MapPin } from 'lucide-react'
import { auditService } from '../../../services/audit.service'

export default function AuditEntryDetail() {
  const { entityType, entityId, entryId } = useParams<{ entityType: string; entityId: string; entryId: string }>()
  const navigate = useNavigate()

  const { data: entry, isLoading } = useQuery({
    queryKey: ['audit-entry', entityType, entityId, entryId],
    queryFn: async () => auditService.getAuditEntry(entityType!, entityId!, entryId!),
  })

  if (isLoading) {
    return <div className="p-6">Loading audit entry...</div>
  }

  if (!entry) {
    return <div className="p-6">Audit entry not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/${entityType}/${entityId}/audit-trail`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Audit Trail
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Audit Entry Detail</h1>
        <p className="text-gray-600">{entry.entity_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Change Details</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Action</dt>
              <dd className="mt-1">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  entry.action === 'create' ? 'bg-green-100 text-green-800' :
                  entry.action === 'update' ? 'bg-blue-100 text-blue-800' :
                  entry.action === 'delete' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {entry.action}
                </span>
              </dd>
            </div>
            {entry.field_changed && (
              <>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Field Changed</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{entry.field_changed}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Old Value</dt>
                  <dd className="mt-1 text-sm text-gray-900">{entry.old_value || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">New Value</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-medium">{entry.new_value || '-'}</dd>
                </div>
              </>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">User Information</h3>
          <div className="flex items-start gap-3 mb-4">
            <User className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">{entry.changed_by}</p>
              <p className="text-sm text-gray-600">{entry.changed_by_role}</p>
              <p className="text-xs text-gray-500 mt-1">{entry.changed_by_email}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-900">{new Date(entry.changed_at).toLocaleDateString()}</p>
              <p className="text-xs text-gray-500">{new Date(entry.changed_at).toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">IP Address</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{entry.ip_address}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Session ID</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{entry.session_id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Request ID</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{entry.request_id}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500">User Agent</dt>
            <dd className="mt-1 text-sm text-gray-900 break-all">{entry.user_agent}</dd>
          </div>
        </dl>
      </div>

      {entry.location && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-900">{entry.location.city}, {entry.location.country}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">
                {entry.location.latitude}, {entry.location.longitude}
              </p>
            </div>
          </div>
        </div>
      )}

      {entry.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{entry.notes}</p>
        </div>
      )}

      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Metadata</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(entry.metadata).map(([key, value]) => (
              <div key={key}>
                <dt className="text-sm font-medium text-gray-500 capitalize">
                  {key.replace(/_/g, ' ')}
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {Array.isArray(value) ? value.join(', ') : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
