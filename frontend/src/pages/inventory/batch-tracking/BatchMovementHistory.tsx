import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { apiClient } from '../../../services/api.service'

export default function BatchMovementHistory() {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()

  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/batches/${batchId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: movements, isLoading, isError } = useQuery({
    queryKey: ['batch-movements', batchId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/batches/${batchId}/movements`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldMovements = [
      {
        id: '1',
        movement_type: 'sale',
        reference: 'ORD-2024-001',
        quantity_before: 850,
        quantity_change: -100,
        quantity_after: 750,
        location: 'Main Warehouse',
        performed_by: 'John Picker',
        timestamp: '2024-01-20T14:30:00Z',
        notes: 'Order fulfillment',
      },
      {
        id: '2',
        movement_type: 'allocation',
        reference: 'ORD-2024-002',
        quantity_before: 850,
        quantity_change: 0,
        quantity_after: 850,
        location: 'Main Warehouse',
        performed_by: 'System',
        timestamp: '2024-01-19T10:00:00Z',
        notes: 'Allocated 100 units for pending order',
      },
      {
        id: '3',
        movement_type: 'transfer_out',
        reference: 'TRF-2024-001',
        quantity_before: 900,
        quantity_change: -50,
        quantity_after: 850,
        location: 'Main Warehouse',
        performed_by: 'Jane Shipper',
        timestamp: '2024-01-15T08:00:00Z',
        notes: 'Transfer to Branch Warehouse',
      },
      {
        id: '4',
        movement_type: 'receipt',
        reference: 'PO-2024-001',
        quantity_before: 0,
        quantity_change: 1000,
        quantity_after: 1000,
        location: 'Main Warehouse',
        performed_by: 'Mike Receiver',
        timestamp: '2024-01-02T09:00:00Z',
        notes: 'Initial receipt from supplier',
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading movement history...</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Batch Movement History</h1>
        <p className="text-gray-600">{batch?.batch_number} - {batch?.product_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Movement Timeline</h2>
        <div className="flow-root">
          <ul className="-mb-8">
            {movements?.map((movement, idx) => {
              const isIncrease = movement.quantity_change > 0
              const isNeutral = movement.quantity_change === 0
              return (
                <li key={movement.id}>
                  <div className="relative pb-8">
                    {idx !== movements.length - 1 && (
                      <span
                        className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                        aria-hidden="true"
                      />
                    )}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                          isNeutral ? 'bg-blue-100' :
                          isIncrease ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {isNeutral ? (
                            <Clock className="h-4 w-4 text-blue-600" />
                          ) : isIncrease ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              isNeutral ? 'bg-blue-100 text-blue-800' :
                              isIncrease ? 'bg-green-100 text-green-800' : 
                              'bg-red-100 text-red-800'
                            }`}>
                              {movement.movement_type.replace('_', ' ')}
                            </span>
                            <span className="text-sm text-gray-600">{movement.reference}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 mb-2">
                            <div>
                              <p className="text-xs text-gray-500">Before</p>
                              <p className="text-sm font-medium text-gray-900">{movement.quantity_before}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Change</p>
                              <p className={`text-sm font-bold ${
                                isNeutral ? 'text-blue-600' :
                                isIncrease ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {movement.quantity_change > 0 ? '+' : ''}{movement.quantity_change}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">After</p>
                              <p className="text-sm font-medium text-gray-900">{movement.quantity_after}</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{movement.notes}</p>
                          <p className="text-xs text-gray-500">
                            {movement.location} • by {movement.performed_by}
                          </p>
                        </div>
                        <div className="whitespace-nowrap text-right text-sm text-gray-500">
                          <div>{new Date(movement.timestamp).toLocaleDateString()}</div>
                          <div className="text-xs">{new Date(movement.timestamp).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
