import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Calculator, Calendar, Eye } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function CalculationLog() {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()

  const { data: agent } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: async () => {
      const response = await fetch(`/api/agents/${agentId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: calculations, isLoading, isError } = useQuery({
    queryKey: ['commission-calculations', agentId],
    queryFn: async () => {
      const response = await fetch(`/api/commissions/calculations?agent_id=${agentId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldCalculations = [
      {
        id: '1',
        calculation_date: '2024-01-31T23:59:59Z',
        period_start: '2024-01-01',
        period_end: '2024-01-31',
        total_sales: 50000.00,
        commission_rate: 5,
        commission_amount: 2500.00,
        status: 'approved',
      },
      {
        id: '2',
        calculation_date: '2023-12-31T23:59:59Z',
        period_start: '2023-12-01',
        period_end: '2023-12-31',
        total_sales: 45000.00,
        commission_rate: 5,
        commission_amount: 2250.00,
        status: 'paid',
      },
      {
        id: '3',
        calculation_date: '2023-11-30T23:59:59Z',
        period_start: '2023-11-01',
        period_end: '2023-11-30',
        total_sales: 48000.00,
        commission_rate: 5,
        commission_amount: 2400.00,
        status: 'paid',
      },
    ]

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


  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/agents/${agentId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Agent
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Commission Calculation Log</h1>
        <p className="text-gray-600">{agent?.name}</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Calculation Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Sales</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {calculations?.map((calc) => (
              <tr key={calc.id} className="hover:bg-surface-secondary">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(calc.period_start).toLocaleDateString()} - {new Date(calc.period_end).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(calc.calculation_date).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                  {formatCurrency(calc.total_sales)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {calc.commission_rate}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                  {formatCurrency(calc.commission_amount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    calc.status === 'paid' ? 'bg-green-100 text-green-800' :
                    calc.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                    calc.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {calc.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => navigate(`/commissions/calculations/${calc.id}`)}
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
