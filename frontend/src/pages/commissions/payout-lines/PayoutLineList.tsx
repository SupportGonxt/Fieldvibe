import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import { commissionsService } from '../../../services/commissions.service'
import { apiClient } from '../../../services/api.service'

export default function PayoutLineList() {
  const { payoutId } = useParams<{ payoutId: string }>()
  const navigate = useNavigate()

  const { data: payout } = useQuery({
    queryKey: ['payout', payoutId],
    queryFn: async () => {
      const response = await apiClient.get(`/commissions/payouts/${payoutId}`)
      const result = response.data
      return result.data
    },
  })

  const { data: lines, isLoading, isError } = useQuery({
    queryKey: ['payout-lines', payoutId],
    queryFn: async () => {
      if (!payoutId) return []
      return await commissionsService.getPayoutLines(payoutId)
    },
    enabled: !!payoutId,
    placeholderData: [
      {
        id: '1',
        agent_name: 'John Sales Agent',
        period: 'Jan 2024',
        commission_amount: 2700.00,
        payment_method: 'bank_transfer',
        status: 'paid',
      },
      {
        id: '2',
        agent_name: 'Jane Agent',
        period: 'Jan 2024',
        commission_amount: 3200.00,
        payment_method: 'bank_transfer',
        status: 'paid',
      },
      {
        id: '3',
        agent_name: 'Bob Field Agent',
        period: 'Jan 2024',
        commission_amount: 2100.00,
        payment_method: 'mobile_money',
        status: 'paid',
      },
    ],
  })

  if (isLoading) {
    return <div className="p-6">Loading payout lines...</div>
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


  const totalAmount = lines?.reduce((sum, line) => sum + line.commission_amount, 0) || 0

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
        <h1 className="text-2xl font-bold text-gray-900">Payout Lines</h1>
        <p className="text-gray-600">{payout?.payout_number} - {payout?.payout_date}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Payout Amount</p>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Lines</p>
            <p className="text-3xl font-bold text-gray-900">{lines?.length || 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {lines?.map((line) => (
              <tr key={line.id} className="hover:bg-surface-secondary">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {line.agent_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {line.period}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                  {formatCurrency(line.commission_amount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                  {line.payment_method.replace('_', ' ')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    line.status === 'paid' ? 'bg-green-100 text-green-800' :
                    line.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {line.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => navigate(`/commissions/payouts/${payoutId}/lines/${line.id}`)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <Eye className="h-4 w-4" />
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
