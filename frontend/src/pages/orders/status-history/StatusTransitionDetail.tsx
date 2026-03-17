import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, User, FileText, AlertCircle } from 'lucide-react'
import { ordersService } from '../../../services/orders.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function StatusTransitionDetail() {
  const { orderId, transitionId } = useParams<{ orderId: string; transitionId: string }>()
  const navigate = useNavigate()

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => ordersService.getOrder(orderId!),
  })

  const { data: transition, isLoading, isError } = useQuery({
    queryKey: ['status-transition', orderId, transitionId],
    queryFn: async () => {
      const history = await ordersService.getOrderStatusHistory(orderId!)
      return history.find(h => h.id === transitionId) || null
    },
  })

  if (isLoading) {
    return <div className="p-6">Loading transition details...</div>
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


  if (!transition) {
    return <div className="p-6">Transition not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/orders/${orderId}/status-history`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Status History
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Status Transition Detail</h1>
        <p className="text-gray-600">{order?.order_number} - {order?.customer_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Status Change</h3>
          <div className="flex items-center gap-3">
            <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800 capitalize">
              {transition.previous_status}
            </span>
            <span className="text-gray-400">→</span>
            <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
              {transition.status}
            </span>
          </div>
          <p className="mt-3 text-sm text-gray-600">{transition.reason}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Changed By</h3>
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">{transition.changed_by}</p>
              <p className="text-sm text-gray-600">{transition.changed_by_role}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(transition.changed_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Validation Checks</h2>
        <div className="space-y-2">
          {transition.validation_checks.map((check, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {check.passed ? (
                <Clock className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-sm ${check.passed ? 'text-gray-900' : 'text-red-600'}`}>
                {check.check}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(transition.metadata).map(([key, value]) => (
            <div key={key}>
              <dt className="text-sm font-medium text-gray-500 capitalize">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {transition.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{transition.notes}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">IP Address</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{transition.system_info.ip_address}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">User Agent</dt>
            <dd className="mt-1 text-sm text-gray-900">{transition.system_info.user_agent}</dd>
          </div>
          {transition.system_info.location && (
            <div className="md:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Location</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {transition.system_info.location.latitude}, {transition.system_info.location.longitude}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
