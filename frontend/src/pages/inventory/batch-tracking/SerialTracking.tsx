import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Package, Truck, User } from 'lucide-react'
import { apiClient } from '../../../services/api.service'

export default function SerialTracking() {
  const { serialId } = useParams<{ serialId: string }>()
  const navigate = useNavigate()

  const { data: serial } = useQuery({
    queryKey: ['serial', serialId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/serials/${serialId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: tracking, isLoading, isError } = useQuery({
    queryKey: ['serial-tracking', serialId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/serials/${serialId}/tracking`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldTracking = [
      {
        id: '1',
        event_type: 'delivered',
        location: 'Customer - ABC Store',
        description: 'Delivered to customer',
        performed_by: 'John Driver',
        timestamp: '2024-01-22T14:00:00Z',
        reference: 'DEL-2024-001',
      },
      {
        id: '2',
        event_type: 'shipped',
        location: 'In Transit',
        description: 'Shipped from warehouse',
        performed_by: 'Jane Shipper',
        timestamp: '2024-01-21T08:00:00Z',
        reference: 'ORD-2024-001',
      },
      {
        id: '3',
        event_type: 'sold',
        location: 'Main Warehouse',
        description: 'Sold to ABC Store',
        performed_by: 'Mike Sales',
        timestamp: '2024-01-20T10:00:00Z',
        reference: 'ORD-2024-001',
      },
      {
        id: '4',
        event_type: 'quality_check',
        location: 'Main Warehouse - QC Area',
        description: 'Quality check passed',
        performed_by: 'Jane QC',
        timestamp: '2024-01-16T14:00:00Z',
        reference: 'QC-2024-001',
      },
      {
        id: '5',
        event_type: 'received',
        location: 'Main Warehouse - Receiving',
        description: 'Received from supplier',
        performed_by: 'Tom Receiver',
        timestamp: '2024-01-15T09:00:00Z',
        reference: 'PO-2024-001',
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading tracking history...</div>
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
          onClick={() => navigate(`/inventory/serials/${serialId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Serial
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Serial Tracking History</h1>
        <p className="text-gray-600">{serial?.serial_number} - {serial?.product_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Tracking Timeline</h2>
        <div className="flow-root">
          <ul className="-mb-8">
            {tracking?.map((event, idx) => (
              <li key={event.id}>
                <div className="relative pb-8">
                  {idx !== tracking.length - 1 && (
                    <span
                      className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                        event.event_type === 'delivered' ? 'bg-green-100' :
                        event.event_type === 'shipped' ? 'bg-blue-100' :
                        event.event_type === 'sold' ? 'bg-purple-100' :
                        event.event_type === 'quality_check' ? 'bg-yellow-100' :
                        'bg-gray-100'
                      }`}>
                        {event.event_type === 'delivered' || event.event_type === 'received' ? (
                          <Package className={`h-4 w-4 ${
                            event.event_type === 'delivered' ? 'text-green-600' : 'text-gray-600'
                          }`} />
                        ) : event.event_type === 'shipped' ? (
                          <Truck className="h-4 w-4 text-blue-600" />
                        ) : event.event_type === 'sold' ? (
                          <User className="h-4 w-4 text-purple-600" />
                        ) : (
                          <Package className="h-4 w-4 text-yellow-600" />
                        )}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            event.event_type === 'delivered' ? 'bg-green-100 text-green-800' :
                            event.event_type === 'shipped' ? 'bg-blue-100 text-blue-800' :
                            event.event_type === 'sold' ? 'bg-purple-100 text-purple-800' :
                            event.event_type === 'quality_check' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {event.event_type.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-500">{event.reference}</span>
                        </div>
                        <p className="text-sm text-gray-900 mb-1">{event.description}</p>
                        <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </p>
                        <p className="text-xs text-gray-500">by {event.performed_by}</p>
                      </div>
                      <div className="whitespace-nowrap text-right text-sm text-gray-500">
                        <div>{new Date(event.timestamp).toLocaleDateString()}</div>
                        <div className="text-xs">{new Date(event.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
