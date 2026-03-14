import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Calculator, DollarSign, TrendingUp } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'

export default function CalculationDetail() {
  const { calculationId } = useParams<{ calculationId: string }>()
  const navigate = useNavigate()

  const { data: calculation, isLoading } = useQuery({
    queryKey: ['commission-calculation', calculationId],
    queryFn: async () => {
      const response = await fetch(`/api/commissions/calculations/${calculationId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
    placeholderData: {
      id: calculationId,
      agent_id: 'agent-1',
      agent_name: 'John Sales Agent',
      calculation_date: '2024-01-31T23:59:59Z',
      period_start: '2024-01-01',
      period_end: '2024-01-31',
      total_sales: 50000.00,
      commission_rate: 5,
      base_commission: 2500.00,
      bonuses: 250.00,
      deductions: 50.00,
      final_commission: 2700.00,
      status: 'approved',
      approved_by: 'Manager',
      approved_at: '2024-02-01T10:00:00Z',
      breakdown: [
        { category: 'Product Sales', amount: 40000.00, rate: 5, commission: 2000.00 },
        { category: 'Service Sales', amount: 10000.00, rate: 5, commission: 500.00 },
      ],
    },
  })

  if (isLoading) {
    return <div className="p-6">Loading calculation...</div>
  }

  if (!calculation) {
    return <div className="p-6">Calculation not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/agents/${calculation.agent_id}/commissions`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Calculations
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Commission Calculation Detail</h1>
        <p className="text-gray-600">{calculation.agent_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Total Sales</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(calculation.total_sales)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calculator className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Base Commission</h3>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(calculation.base_commission)}</p>
          <p className="text-sm text-gray-600 mt-1">{calculation.commission_rate}% rate</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Bonuses</h3>
          </div>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(calculation.bonuses)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Final Commission</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(calculation.final_commission)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Commission Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sales Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {calculation.breakdown.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(item.amount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{item.rate}%</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{formatCurrency(item.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Calculation Summary</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Period</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(calculation.period_start).toLocaleDateString()} - {new Date(calculation.period_end).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Calculation Date</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(calculation.calculation_date).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Base Commission</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatCurrency(calculation.base_commission)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Bonuses</dt>
            <dd className="mt-1 text-sm text-green-600">+{formatCurrency(calculation.bonuses)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Deductions</dt>
            <dd className="mt-1 text-sm text-red-600">-{formatCurrency(calculation.deductions)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Final Commission</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(calculation.final_commission)}</dd>
          </div>
        </dl>
      </div>

      {calculation.status === 'approved' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Approval Information</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Approved By</dt>
              <dd className="mt-1 text-sm text-gray-900">{calculation.approved_by}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Approved At</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(calculation.approved_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}
