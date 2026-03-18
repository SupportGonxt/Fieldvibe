import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Clock, Truck, CheckCircle } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function TransferItemTracking() {
  const { transferId, itemId } = useParams<{ transferId: string; itemId: string }>()
  const navigate = useNavigate()

  const { data: item } = useQuery({
    queryKey: ['transfer-item', transferId, itemId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/transfers/${transferId}/items/${itemId}`, {
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
    queryKey: ['transfer-item-tracking', transferId, itemId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/transfers/${transferId}/items/${itemId}/tracking`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldTracking = {
      transfer_number: 'TRF-2024-001',
      from_warehouse: 'Main Warehouse',
      to_warehouse: 'Branch Warehouse',
      current_status: 'received',
      tracking_events: [
        {
          id: '1',
          status: 'received',
          location: 'Branch Warehouse',
          timestamp: '2024-01-22T10:00:00Z',
          notes: 'Received with 5 units damaged',
          performed_by: 'Jane Receiver',
        },
        {
          id: '2',
          status: 'in_transit',
          location: 'En route to Branch Warehouse',
          timestamp: '2024-01-21T08:00:00Z',
          notes: 'Departed distribution center',
          performed_by: 'System',
        },
        {
          id: '3',
          status: 'shipped',
          location: 'Main Warehouse',
          timestamp: '2024-01-20T08:00:00Z',
          notes: 'Loaded on vehicle VAN-001',
          performed_by: 'John Shipper',
        },
        {
          id: '4',
          status: 'prepared',
          location: 'Main Warehouse',
          timestamp: '2024-01-19T14:00:00Z',
          notes: 'Items picked and packed',
          performed_by: 'Mike Picker',
        },
      ],
    }

  if (isLoading) {
    return <div className="p-6">Loading tracking information...</div>
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


  if (!tracking) {
    return <div className="p-6">Tracking information not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/inventory/transfers/${transferId}/items/${itemId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Item
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Transfer Tracking</h1>
        <p className="text-gray-600">
          {item?.product_name} ({item?.product_sku}) - {tracking.transfer_number}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">From</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">{tracking.from_warehouse}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Truck className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Current Status</h3>
          </div>
          <p className="text-lg font-bold text-gray-900 capitalize">
            {tracking.current_status.replace('_', ' ')}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">To</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">{tracking.to_warehouse}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Tracking Timeline</h2>
        <div className="flow-root">
          <ul className="-mb-8">
            {tracking.tracking_events.map((event, idx) => (
              <li key={event.id}>
                <div className="relative pb-8">
                  {idx !== tracking.tracking_events.length - 1 && (
                    <span
                      className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                        event.status === 'received' ? 'bg-green-100' :
                        event.status === 'in_transit' ? 'bg-blue-100' :
                        event.status === 'shipped' ? 'bg-purple-100' :
                        'bg-gray-100'
                      }`}>
                        {event.status === 'received' ? (
                          <CheckCircle className={`h-4 w-4 ${
                            event.status === 'received' ? 'text-green-600' : 'text-gray-600'
                          }`} />
                        ) : event.status === 'in_transit' ? (
                          <Truck className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Clock className={`h-4 w-4 ${
                            event.status === 'shipped' ? 'text-purple-600' : 'text-gray-600'
                          }`} />
                        )}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            event.status === 'received' ? 'bg-green-100 text-green-800' :
                            event.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                            event.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {event.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 mb-1">
                          <MapPin className="inline h-3 w-3 mr-1" />
                          {event.location}
                        </p>
                        <p className="text-sm text-gray-600 mb-1">{event.notes}</p>
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
