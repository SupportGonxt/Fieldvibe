import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText, User, Clock, Filter } from 'lucide-react'
import { auditService } from '../../../services/audit.service'

interface AuditTrailProps {
  entityType: string
  entityId: string
}

export default function AuditTrail() {
  const { entityType, entityId } = useParams<{ entityType: string; entityId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const actionFilter = searchParams.get('action')
  const userFilter = searchParams.get('user')

  const { data: entity } = useQuery({
    queryKey: [entityType, entityId],
    queryFn: async () => {
      const response = await fetch(`/api/${entityType}/${entityId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: auditLog, isLoading } = useQuery({
    queryKey: ['audit-trail', entityType, entityId, actionFilter, userFilter],
    queryFn: async () => auditService.getAuditTrail(entityType!, entityId!),
  })

  if (isLoading) {
    return <div className="p-6">Loading audit trail...</div>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
            <p className="text-gray-600">
              {entityType} - {entity?.name}
            </p>
          </div>
          <button
            onClick={() => navigate(`/${entityType}/${entityId}/audit-trail/filter`)}
            className="btn-secondary flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Old Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Changed By</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {auditLog?.map((entry) => (
              <tr key={entry.id} className="hover:bg-surface-secondary">
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    entry.action === 'create' ? 'bg-green-100 text-green-800' :
                    entry.action === 'update' ? 'bg-blue-100 text-blue-800' :
                    entry.action === 'delete' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {entry.action}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.field_changed || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {entry.old_value || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.new_value || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <div>
                      <div>{entry.changed_by}</div>
                      <div className="text-xs text-gray-500">{entry.changed_by_role}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <div>
                      <div>{new Date(entry.changed_at).toLocaleDateString()}</div>
                      <div className="text-xs">{new Date(entry.changed_at).toLocaleTimeString()}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => navigate(`/${entityType}/${entityId}/audit-trail/${entry.id}`)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
