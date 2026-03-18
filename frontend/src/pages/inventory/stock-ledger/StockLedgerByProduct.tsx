import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, Eye, TrendingUp, TrendingDown } from 'lucide-react'
import { apiClient } from '../../../services/api.service'

export default function StockLedgerByProduct() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/products/${productId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: entries, isLoading, isError } = useQuery({
    queryKey: ['stock-ledger-product', productId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/products/${productId}/stock-ledger`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldEntries = [
      {
        id: '1',
        warehouse_name: 'Main Warehouse',
        transaction_type: 'sale',
        transaction_reference: 'ORD-2024-001',
        quantity_before: 150,
        quantity_change: -10,
        quantity_after: 140,
        transaction_date: '2024-01-20T14:30:00Z',
      },
      {
        id: '2',
        warehouse_name: 'Main Warehouse',
        transaction_type: 'purchase',
        transaction_reference: 'PO-2024-001',
        quantity_before: 100,
        quantity_change: 50,
        quantity_after: 150,
        transaction_date: '2024-01-15T10:00:00Z',
      },
      {
        id: '3',
        warehouse_name: 'Branch Warehouse',
        transaction_type: 'transfer_in',
        transaction_reference: 'TRF-2024-001',
        quantity_before: 20,
        quantity_change: 30,
        quantity_after: 50,
        transaction_date: '2024-01-14T16:00:00Z',
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading stock ledger...</div>
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
          onClick={() => navigate(`/products/${productId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Product
        </button>
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Ledger</h1>
            <p className="text-gray-600">{product?.name} ({product?.sku})</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">Current Stock Level</p>
            <p className="text-2xl font-bold text-blue-900">{product?.current_stock} units</p>
          </div>
          <Package className="h-12 w-12 text-blue-600" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warehouse</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Before</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">After</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries?.map((entry) => {
              const isIncrease = entry.quantity_change > 0
              return (
                <tr key={entry.id} className="hover:bg-surface-secondary">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.warehouse_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-1">
                      {isIncrease ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span className="capitalize">{entry.transaction_type.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.transaction_reference}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {entry.quantity_before}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                    isIncrease ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {entry.quantity_change > 0 ? '+' : ''}{entry.quantity_change}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    {entry.quantity_after}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(entry.transaction_date).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => navigate(`/products/${productId}/stock-ledger/${entry.id}`)}
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
