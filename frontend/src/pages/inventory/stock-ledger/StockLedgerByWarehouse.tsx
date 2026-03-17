import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Warehouse, Eye } from 'lucide-react'

export default function StockLedgerByWarehouse() {
  const { warehouseId } = useParams<{ warehouseId: string }>()
  const navigate = useNavigate()

  const { data: warehouse } = useQuery({
    queryKey: ['warehouse', warehouseId],
    queryFn: async () => {
      const response = await fetch(`/api/warehouses/${warehouseId}`, {
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
    queryKey: ['stock-ledger-warehouse', warehouseId],
    queryFn: async () => {
      const response = await fetch(`/api/warehouses/${warehouseId}/stock-ledger`, {
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
        product_name: 'Coca-Cola 500ml',
        product_sku: 'CC-500',
        transaction_type: 'sale',
        transaction_reference: 'ORD-2024-001',
        quantity_change: -10,
        quantity_after: 140,
        transaction_date: '2024-01-20T14:30:00Z',
      },
      {
        id: '2',
        product_name: 'Pepsi 500ml',
        product_sku: 'PP-500',
        transaction_type: 'purchase',
        transaction_reference: 'PO-2024-001',
        quantity_change: 50,
        quantity_after: 100,
        transaction_date: '2024-01-20T10:00:00Z',
      },
      {
        id: '3',
        product_name: 'Sprite 500ml',
        product_sku: 'SP-500',
        transaction_type: 'adjustment',
        transaction_reference: 'ADJ-2024-001',
        quantity_change: -5,
        quantity_after: 70,
        transaction_date: '2024-01-19T16:00:00Z',
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
          onClick={() => navigate('/inventory/stock-ledger')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Stock Ledger
        </button>
        <div className="flex items-center gap-3">
          <Warehouse className="h-8 w-8 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Ledger by Warehouse</h1>
            <p className="text-gray-600">{warehouse?.name}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entry.product_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.product_sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                    {entry.transaction_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.transaction_reference}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                    isIncrease ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {entry.quantity_change > 0 ? '+' : ''}{entry.quantity_change}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {entry.quantity_after}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(entry.transaction_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => navigate(`/inventory/stock-ledger/${entry.id}`)}
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
