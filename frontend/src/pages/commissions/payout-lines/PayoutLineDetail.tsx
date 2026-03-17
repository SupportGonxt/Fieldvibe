import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, DollarSign, Calendar } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function PayoutLineDetail() {
  const { payoutId, lineId } = useParams<{ payoutId: string; lineId: string }>()
  const navigate = useNavigate()

  const { data: line, isLoading, isError } = useQuery({
    queryKey: ['payout-line', payoutId, lineId],
    queryFn: async () => {
      const response = await fetch(`/api/commissions/payouts/${payoutId}/lines/${lineId}`, {
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
    return <div className="p-6">Loading payout line...</div>
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


  if (!line) {
    return <div className="p-6">Payout line not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/commissions/payouts/${payoutId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Payout
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Payout Line Detail</h1>
        <p className="text-gray-600">{line.agent_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Commission Amount</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(line.commission_amount)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Status</h3>
          </div>
          <span className={`inline-flex px-3 py-1 text-lg font-semibold rounded-full ${
            line.status === 'paid' ? 'bg-green-100 text-green-800' :
            line.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {line.status}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payout Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Agent</dt>
            <dd className="mt-1 text-sm text-gray-900">{line.agent_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Commission Period</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(line.period_start).toLocaleDateString()} - {new Date(line.period_end).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">
              {line.payment_method.replace('_', ' ')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Payment Reference</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{line.payment_reference}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Paid At</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Calendar className="h-4 w-4 text-gray-400" />
              {new Date(line.paid_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Commission Amount</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(line.commission_amount)}</dd>
          </div>
        </dl>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => navigate(`/commissions/calculations/${line.calculation_id}`)}
          className="btn-secondary"
        >
          View Calculation
        </button>
        <button
          onClick={() => navigate(`/agents/${line.agent_id}`)}
          className="btn-secondary"
        >
          View Agent
        </button>
      </div>
    </div>
  )
}
