import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'

export default function AdjustmentItemList() {
  const { adjustmentId } = useParams<{ adjustmentId: string }>()
  const navigate = useNavigate()

  const { data: adjustment } = useQuery({
    queryKey: ['adjustment', adjustmentId],
    queryFn: async () => {
      const response = await fetch(`/api/adjustments/${adjustmentId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ['adjustment-items', adjustmentId],
    queryFn: async () => {
      const response = await fetch(`/api/adjustments/${adjustmentId}/items`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldItems = [
      {
        id: '1',
        product_name: 'Coca-Cola 500ml',
        product_sku: 'CC-500',
        adjustment_type: 'decrease',
        quantity: -10,
        unit_cost: 15.00,
        total_value: -150.00,
        reason: 'damaged',
      },
      {
        id: '2',
        product_name: 'Pepsi 500ml',
        product_sku: 'PP-500',
        adjustment_type: 'increase',
        quantity: 5,
        unit_cost: 14.00,
        total_value: 70.00,
        reason: 'found',
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading adjustment items...</div>
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
          onClick={() => navigate(`/inventory/adjustments/${adjustmentId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Adjustment
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Adjustment Items</h1>
        <p className="text-gray-600">{adjustment?.adjustment_number} - {adjustment?.warehouse_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items?.map((item) => {
              const isIncrease = item.adjustment_type === 'increase'
              return (
                <tr key={item.id} className="hover:bg-surface-secondary">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.product_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.product_sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-1">
                      {isIncrease ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span className="capitalize">{item.adjustment_type}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                    isIncrease ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.quantity > 0 ? '+' : ''}{item.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(item.unit_cost)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                    isIncrease ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(Math.abs(item.total_value))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                    {item.reason.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => navigate(`/inventory/adjustments/${adjustmentId}/items/${item.id}`)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
