import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Receipt, Eye } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import { apiClient } from '../../../services/api.service'

export default function SourceTransactions() {
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

  const { data: transactions, isLoading, isError } = useQuery({
    queryKey: ['payout-line-transactions', payoutId, lineId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/commissions/payouts/${payoutId}/lines/${lineId}/transactions`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldTransactions = [
      {
        id: '1',
        transaction_type: 'order',
        transaction_number: 'ORD-2024-001',
        transaction_date: '2024-01-05',
        transaction_amount: 10000.00,
        commission_rate: 5,
        commission_amount: 500.00,
      },
      {
        id: '2',
        transaction_type: 'order',
        transaction_number: 'ORD-2024-015',
        transaction_date: '2024-01-12',
        transaction_amount: 15000.00,
        commission_rate: 5,
        commission_amount: 750.00,
      },
      {
        id: '3',
        transaction_type: 'order',
        transaction_number: 'ORD-2024-028',
        transaction_date: '2024-01-20',
        transaction_amount: 12000.00,
        commission_rate: 5,
        commission_amount: 600.00,
      },
      {
        id: '4',
        transaction_type: 'order',
        transaction_number: 'ORD-2024-035',
        transaction_date: '2024-01-28',
        transaction_amount: 13000.00,
        commission_rate: 5,
        commission_amount: 650.00,
      },
      {
        id: '5',
        transaction_type: 'bonus',
        transaction_number: 'BONUS-2024-001',
        transaction_date: '2024-01-31',
        transaction_amount: 0,
        commission_rate: 0,
        commission_amount: 200.00,
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading source transactions...</div>
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


  const totalCommission = transactions?.reduce((sum, t) => sum + t.commission_amount, 0) || 0

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
        <h1 className="text-2xl font-bold text-gray-900">Source Transactions</h1>
        <p className="text-gray-600">{line?.agent_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Commission from Transactions</p>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalCommission)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Transactions</p>
            <p className="text-3xl font-bold text-gray-900">{transactions?.length || 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions?.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-surface-secondary">
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    transaction.transaction_type === 'order' ? 'bg-blue-100 text-blue-800' :
                    transaction.transaction_type === 'bonus' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {transaction.transaction_type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {transaction.transaction_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(transaction.transaction_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {transaction.transaction_amount > 0 ? formatCurrency(transaction.transaction_amount) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {transaction.commission_rate > 0 ? `${transaction.commission_rate}%` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                  {formatCurrency(transaction.commission_amount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {transaction.transaction_type === 'order' && (
                    <button
                      onClick={() => navigate(`/orders/${transaction.id}`)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
