import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { apiClient } from '../../../services/api.service'

interface ImpactAnalysisProps {
  entityType: string
  entityId: string
  action: string
}

export default function ImpactAnalysis({ entityType, entityId, action }: ImpactAnalysisProps) {
  const { data: impact, isLoading } = useQuery({
    queryKey: ['impact-analysis', entityType, entityId, action],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/${entityType}/${entityId}/impact-analysis?action=${action}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  if (isLoading) {
    return <div className="p-6">Analyzing impact...</div>
  }

  if (!impact) {
    return <div className="p-6">Impact analysis not available</div>
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-50 border-red-200 text-red-900'
      case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-900'
      case 'low': return 'bg-blue-50 border-blue-200 text-blue-900'
      default: return 'bg-surface-secondary border-gray-100 text-gray-900'
    }
  }

  const getImpactIcon = (impactType: string) => {
    switch (impactType) {
      case 'requires_update': return <AlertTriangle className="h-5 w-5 text-red-600" />
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'info': return <Info className="h-5 w-5 text-blue-600" />
      default: return <CheckCircle className="h-5 w-5 text-green-600" />
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Impact Analysis</h2>

      <div className={`border rounded-lg p-4 mb-6 ${getSeverityColor(impact.severity)}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">
              {impact.severity.charAt(0).toUpperCase() + impact.severity.slice(1)} Impact Detected
            </p>
            <p className="text-sm">
              This action ({impact.action}) will affect {impact.affected_documents.length} related document{impact.affected_documents.length !== 1 ? 's' : ''}.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Affected Documents</h3>
        <div className="space-y-3">
          {impact.affected_documents.map((doc, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
              {getImpactIcon(doc.impact_type)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900">{doc.number}</p>
                  <span className="text-xs text-gray-500 capitalize">({doc.type})</span>
                </div>
                <p className="text-sm text-gray-700">{doc.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Recommendations</h3>
        <ul className="space-y-1">
          {impact.recommendations.map((rec, idx) => (
            <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
