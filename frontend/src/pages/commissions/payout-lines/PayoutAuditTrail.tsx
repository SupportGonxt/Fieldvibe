import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, User } from 'lucide-react'
import { apiClient } from '../../../services/api.service'

export default function PayoutAuditTrail() {
  const { payoutId, lineId } = useParams<{ payoutId: string; lineId: string }>()
  const navigate = useNavigate()

  const { data: line } = useQuery({
    queryKey: ['payout-line', payoutId, lineId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/commissions/payouts/${payoutId}/lines/${lineId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: auditTrail, isLoading, isError } = useQuery({
    queryKey: ['payout-line-audit', payoutId, lineId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/commissions/payouts/${payoutId}/lines/${lineId}/audit`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldAuditTrail = [
      {
        id: '1',
        action: 'payout_completed',
        description: 'Payout marked as completed',
        performed_by: 'Finance Manager',
        performed_at: '2024-02-05T10:30:00Z',
        details: {
          payment_reference: 'PAY-2024-001',
          amount: 2700.00,
        },
      },
      {
        id: '2',
        action: 'payment_processed',
        description: 'Payment processed via bank transfer',
        performed_by: 'Finance Manager',
        performed_at: '2024-02-05T10:00:00Z',
        details: {
          payment_method: 'bank_transfer',
          payment_reference: 'PAY-2024-001',
        },
      },
      {
        id: '3',
        action: 'payout_approved',
        description: 'Payout approved for processing',
        performed_by: 'Manager',
        performed_at: '2024-02-01T10:00:00Z',
        details: {
          approval_notes: 'Commission calculation verified',
        },
      },
      {
        id: '4',
        action: 'payout_created',
        description: 'Payout line created',
        performed_by: 'System',
        performed_at: '2024-02-01T09:00:00Z',
        details: {
          calculation_id: 'calc-1',
          commission_amount: 2700.00,
        },
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading audit trail...</div>
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


  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/commissions/payouts/${payoutId}/lines/${lineId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Payout Line
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Payout Audit Trail</h1>
        <p className="text-gray-600">{line?.agent_name}</p>
      </div>

      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-8">
          {auditTrail?.map((entry, index) => (
            <div key={entry.id} className="relative flex gap-6">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 border-4 border-white shadow z-10">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>

              <div className="flex-1 bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{entry.description}</h3>
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize mt-1">
                      {entry.action.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mt-3 mb-3">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {entry.performed_by}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {new Date(entry.performed_at).toLocaleString()}
                  </div>
                </div>

                {entry.details && Object.keys(entry.details).length > 0 && (
                  <div className="mt-3 p-3 bg-surface-secondary rounded">
                    <p className="text-sm font-medium text-gray-700 mb-2">Details</p>
                    <dl className="grid grid-cols-2 gap-2">
                      {Object.entries(entry.details).map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-xs font-medium text-gray-500 capitalize">
                            {key.replace('_', ' ')}
                          </dt>
                          <dd className="text-xs text-gray-900">
                            {typeof value === 'number' && key.includes('amount')
                              ? `$${value.toFixed(2)}`
                              : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
