import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, AlertTriangle } from 'lucide-react'

export default function CountLineList() {
  const { countId } = useParams<{ countId: string }>()
  const navigate = useNavigate()

  const { data: count } = useQuery({
    queryKey: ['stock-count', countId],
    queryFn: async () => {
      const response = await fetch(`/api/stock-counts/${countId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: lines, isLoading, isError } = useQuery({
    queryKey: ['count-lines', countId],
    queryFn: async () => {
      const response = await fetch(`/api/stock-counts/${countId}/lines`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldLines = [
      {
        id: '1',
        product_name: 'Coca-Cola 500ml',
        product_sku: 'CC-500',
        expected_quantity: 100,
        counted_quantity: 95,
        variance: -5,
        variance_percent: -5.0,
        status: 'variance_pending',
      },
      {
        id: '2',
        product_name: 'Pepsi 500ml',
        product_sku: 'PP-500',
        expected_quantity: 50,
        counted_quantity: 50,
        variance: 0,
        variance_percent: 0,
        status: 'approved',
      },
      {
        id: '3',
        product_name: 'Sprite 500ml',
        product_sku: 'SP-500',
        expected_quantity: 75,
        counted_quantity: 80,
        variance: 5,
        variance_percent: 6.67,
        status: 'variance_pending',
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading count lines...</div>
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
          onClick={() => navigate(`/inventory/stock-counts/${countId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Stock Count
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Count Lines</h1>
        <p className="text-gray-600">{count?.count_number} - {count?.warehouse_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expected</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Counted</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {lines?.map((line) => {
              const hasVariance = line.variance !== 0
              return (
                <tr key={line.id} className="hover:bg-surface-secondary">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {line.product_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {line.product_sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {line.expected_quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {line.counted_quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <div className="flex items-center justify-end gap-1">
                      {hasVariance && <AlertTriangle className="h-4 w-4 text-red-600" />}
                      <span className={`font-medium ${hasVariance ? 'text-red-600' : 'text-green-600'}`}>
                        {line.variance > 0 ? '+' : ''}{line.variance}
                      </span>
                      <span className="text-gray-500 text-xs">
                        ({line.variance_percent > 0 ? '+' : ''}{line.variance_percent.toFixed(1)}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      line.status === 'approved' ? 'bg-green-100 text-green-800' :
                      line.status === 'variance_pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {line.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => navigate(`/inventory/stock-counts/${countId}/lines/${line.id}`)}
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
