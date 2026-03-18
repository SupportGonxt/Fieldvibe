import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function ExceptionDetail() {
  const { calculationId, exceptionId } = useParams<{ calculationId: string; exceptionId: string }>()
  const navigate = useNavigate()

  const { data: exception, isLoading, isError } = useQuery({
    queryKey: ['commission-exception', calculationId, exceptionId],
    queryFn: async () => {
      const response = await apiClient.get(`/commissions/calculations/${calculationId}/exceptions/${exceptionId}`)
      const result = response.data
      return result.data
    },
  })

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner size="md" /></div>
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


  if (!exception) {
    return <div className="p-6">Exception not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/commissions/calculations/${calculationId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Calculation
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Commission Exception Detail</h1>
      </div>

      <div className={`border rounded-lg p-6 mb-6 ${
        exception.severity === 'high' ? 'bg-red-50 border-red-200' :
        exception.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
        'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`h-8 w-8 mt-0.5 ${
            exception.severity === 'high' ? 'text-red-600' :
            exception.severity === 'medium' ? 'text-yellow-600' :
            'text-blue-600'
          }`} />
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className={`text-lg font-semibold mb-1 ${
                  exception.severity === 'high' ? 'text-red-900' :
                  exception.severity === 'medium' ? 'text-yellow-900' :
                  'text-blue-900'
                }`}>
                  {exception.description}
                </h2>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  exception.severity === 'high' ? 'bg-red-100 text-red-800' :
                  exception.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {exception.severity} severity
                </span>
              </div>
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                exception.resolution_status === 'resolved' ? 'bg-green-100 text-green-800' :
                exception.resolution_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {exception.resolution_status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Exception Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Exception Type</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">
              {exception.exception_type.replace('_', ' ')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Detected At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(exception.detected_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Affected Amount</dt>
            <dd className={`mt-1 text-sm font-bold ${
              exception.affected_amount < 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {formatCurrency(exception.affected_amount)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Severity</dt>
            <dd className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                exception.severity === 'high' ? 'bg-red-100 text-red-800' :
                exception.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {exception.severity}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {exception.resolution_status === 'resolved' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resolution Details</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Resolved By</dt>
              <dd className="mt-1 text-sm text-gray-900">{exception.resolved_by}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Resolved At</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(exception.resolved_at).toLocaleString()}
              </dd>
            </div>
          </dl>
          <div className="p-4 bg-surface-secondary rounded">
            <p className="text-sm font-medium text-gray-500 mb-1">Resolution Action</p>
            <p className="text-sm text-gray-900">{exception.resolution_action}</p>
          </div>
        </div>
      )}
    </div>
  )
}
