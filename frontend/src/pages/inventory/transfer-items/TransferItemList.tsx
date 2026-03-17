import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, AlertTriangle } from 'lucide-react'

export default function TransferItemList() {
  const { transferId } = useParams<{ transferId: string }>()
  const navigate = useNavigate()

  const { data: transfer } = useQuery({
    queryKey: ['transfer', transferId],
    queryFn: async () => {
      const response = await fetch(`/api/transfers/${transferId}`, {
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
    queryKey: ['transfer-items', transferId],
    queryFn: async () => {
      const response = await fetch(`/api/transfers/${transferId}/items`, {
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
        quantity_requested: 100,
        quantity_shipped: 100,
        quantity_received: 95,
        variance: -5,
        status: 'received_with_variance',
      },
      {
        id: '2',
        product_name: 'Pepsi 500ml',
        product_sku: 'PP-500',
        quantity_requested: 50,
        quantity_shipped: 50,
        quantity_received: 50,
        variance: 0,
        status: 'received',
      },
      {
        id: '3',
        product_name: 'Sprite 500ml',
        product_sku: 'SP-500',
        quantity_requested: 75,
        quantity_shipped: 75,
        quantity_received: null,
        variance: 0,
        status: 'in_transit',
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading transfer items...</div>
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
          onClick={() => navigate(`/inventory/transfers/${transferId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Transfer
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Transfer Items</h1>
        <p className="text-gray-600">
          {transfer?.transfer_number} - {transfer?.from_warehouse} → {transfer?.to_warehouse}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Requested</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Shipped</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Received</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items?.map((item) => {
              const hasVariance = item.variance !== 0
              return (
                <tr key={item.id} className="hover:bg-surface-secondary">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.product_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.product_sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {item.quantity_requested}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {item.quantity_shipped}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {item.quantity_received || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {item.quantity_received ? (
                      <div className="flex items-center justify-end gap-1">
                        {hasVariance && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                        <span className={`font-medium ${hasVariance ? 'text-yellow-600' : 'text-green-600'}`}>
                          {item.variance > 0 ? '+' : ''}{item.variance}
                        </span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.status === 'received' ? 'bg-green-100 text-green-800' :
                      item.status === 'received_with_variance' ? 'bg-yellow-100 text-yellow-800' :
                      item.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => navigate(`/inventory/transfers/${transferId}/items/${item.id}`)}
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
