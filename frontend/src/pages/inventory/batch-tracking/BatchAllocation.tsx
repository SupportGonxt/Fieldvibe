import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, ShoppingCart, Eye } from 'lucide-react'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function BatchAllocation() {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()

  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: async () => {
      const response = await fetch(`/api/batches/${batchId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: allocations, isLoading, isError } = useQuery({
    queryKey: ['batch-allocations', batchId],
    queryFn: async () => {
      const response = await fetch(`/api/batches/${batchId}/allocations`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldAllocations = [
      {
        id: '1',
        order_number: 'ORD-2024-001',
        customer_name: 'ABC Store',
        quantity_allocated: 50,
        allocation_date: '2024-01-20T10:00:00Z',
        status: 'pending',
        expected_ship_date: '2024-01-22',
      },
      {
        id: '2',
        order_number: 'ORD-2024-002',
        customer_name: 'XYZ Mart',
        quantity_allocated: 30,
        allocation_date: '2024-01-19T14:00:00Z',
        status: 'pending',
        expected_ship_date: '2024-01-21',
      },
      {
        id: '3',
        order_number: 'ORD-2024-003',
        customer_name: 'DEF Shop',
        quantity_allocated: 20,
        allocation_date: '2024-01-18T09:00:00Z',
        status: 'fulfilled',
        shipped_date: '2024-01-19',
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
          onClick={() => navigate(`/inventory/batches/${batchId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Batch
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Batch Allocations</h1>
        <p className="text-gray-600">{batch?.batch_number} - {batch?.product_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Current Stock</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{batch?.current_quantity}</p>
          <p className="text-sm text-gray-600 mt-1">total units</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Allocated</h3>
          </div>
          <p className="text-3xl font-bold text-orange-600">{batch?.allocated_quantity}</p>
          <p className="text-sm text-gray-600 mt-1">units allocated</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Available</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{batch?.available_quantity}</p>
          <p className="text-sm text-gray-600 mt-1">units available</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Allocation Details</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allocated Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected Ship</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {allocations?.map((allocation) => (
              <tr key={allocation.id} className="hover:bg-surface-secondary">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {allocation.order_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {allocation.customer_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                  {allocation.quantity_allocated}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(allocation.allocation_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {allocation.status === 'fulfilled' 
                    ? new Date(allocation.shipped_date).toLocaleDateString()
                    : new Date(allocation.expected_ship_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    allocation.status === 'fulfilled' ? 'bg-green-100 text-green-800' :
                    allocation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {allocation.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => navigate(`/orders/${allocation.id}`)}
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
