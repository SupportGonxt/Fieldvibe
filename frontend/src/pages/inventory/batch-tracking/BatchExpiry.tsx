import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle, Calendar, Package } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function BatchExpiry() {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()

  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: async () => {
      const response = await apiClient.get(`/batches/${batchId}`)
      const result = response.data
      return result.data
    },
  })

  const { data: expiryInfo, isLoading, isError } = useQuery({
    queryKey: ['batch-expiry', batchId],
    queryFn: async () => {
      const response = await apiClient.get(`/batches/${batchId}/expiry`)
      const result = response.data
      return result.data
    },
  })

  const oldExpiryInfo = {
      expiry_date: '2024-12-31',
      days_until_expiry: 45,
      expiry_status: 'expiring_soon',
      current_quantity: 750,
      allocated_quantity: 100,
      available_quantity: 650,
      estimated_value: 11250.00,
      recommendations: [
        {
          action: 'priority_sale',
          description: 'Prioritize this batch for upcoming orders',
          impact: 'Reduce waste by selling before expiry',
        },
        {
          action: 'promotion',
          description: 'Consider promotional pricing to move inventory',
          impact: 'Accelerate sales velocity',
        },
        {
          action: 'transfer',
          description: 'Transfer to high-volume locations',
          impact: 'Increase likelihood of sale before expiry',
        },
      ],
      expiry_alerts: [
        {
          id: '1',
          alert_type: '30_day_warning',
          triggered_at: '2024-12-01T00:00:00Z',
          notified_users: ['Inventory Manager', 'Sales Manager'],
        },
        {
          id: '2',
          alert_type: '60_day_warning',
          triggered_at: '2024-11-01T00:00:00Z',
          notified_users: ['Inventory Manager'],
        },
      ],
    }

  if (isLoading) {
    return <div className="p-6">Loading expiry information...</div>
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


  if (!expiryInfo) {
    return <div className="p-6">Expiry information not found</div>
  }

  const isExpiringSoon = expiryInfo.days_until_expiry < 30 && expiryInfo.days_until_expiry > 0
  const isExpired = expiryInfo.days_until_expiry < 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/inventory/batches/${batchId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Batch
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Batch Expiry Management</h1>
        <p className="text-gray-600">{batch?.batch_number} - {batch?.product_name}</p>
      </div>

      <div className={`border rounded-lg p-6 mb-6 ${
        isExpired ? 'bg-red-50 border-red-200' : 
        isExpiringSoon ? 'bg-yellow-50 border-yellow-200' : 
        'bg-green-50 border-green-200'
      }`}>
        <div className="flex items-start gap-4">
          <AlertTriangle className={`h-8 w-8 ${
            isExpired ? 'text-red-600' : 
            isExpiringSoon ? 'text-yellow-600' : 
            'text-green-600'
          }`} />
          <div className="flex-1">
            <h2 className={`text-xl font-bold mb-2 ${
              isExpired ? 'text-red-900' : 
              isExpiringSoon ? 'text-yellow-900' : 
              'text-green-900'
            }`}>
              {isExpired 
                ? `Expired ${Math.abs(expiryInfo.days_until_expiry)} days ago`
                : isExpiringSoon
                ? `Expires in ${expiryInfo.days_until_expiry} days`
                : `${expiryInfo.days_until_expiry} days until expiry`}
            </h2>
            <p className={`text-sm ${
              isExpired ? 'text-red-700' : 
              isExpiringSoon ? 'text-yellow-700' : 
              'text-green-700'
            }`}>
              Expiry Date: {new Date(expiryInfo.expiry_date).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Current Stock</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{expiryInfo.current_quantity}</p>
          <p className="text-sm text-gray-600 mt-1">units remaining</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Allocated</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{expiryInfo.allocated_quantity}</p>
          <p className="text-sm text-gray-600 mt-1">units allocated</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">At Risk Value</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">${expiryInfo.estimated_value.toFixed(2)}</p>
          <p className="text-sm text-gray-600 mt-1">inventory value</p>
        </div>
      </div>

      {expiryInfo.recommendations && expiryInfo.recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommended Actions</h2>
          <div className="space-y-4">
            {expiryInfo.recommendations.map((rec, idx) => (
              <div key={idx} className="border-l-4 border-primary-600 pl-4 py-2">
                <h3 className="font-medium text-gray-900 capitalize mb-1">
                  {rec.action.replace('_', ' ')}
                </h3>
                <p className="text-sm text-gray-700 mb-1">{rec.description}</p>
                <p className="text-xs text-gray-500">Impact: {rec.impact}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Expiry Alerts History</h2>
        <div className="space-y-4">
          {expiryInfo.expiry_alerts.map((alert) => (
            <div key={alert.id} className="flex items-start gap-3 p-4 border rounded-lg">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    {alert.alert_type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  Triggered: {new Date(alert.triggered_at).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  Notified: {alert.notified_users.join(', ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
