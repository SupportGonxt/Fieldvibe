import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Factory, Truck, Warehouse, CheckCircle } from 'lucide-react'

export default function LotTracking() {
  const { lotId } = useParams<{ lotId: string }>()
  const navigate = useNavigate()

  const { data: lot } = useQuery({
    queryKey: ['lot', lotId],
    queryFn: async () => {
      const response = await fetch(`/api/lots/${lotId}`, {
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
    queryKey: ['lot-tracking', lotId],
    queryFn: async () => {
      const response = await fetch(`/api/lots/${lotId}/tracking`, {
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
        event_type: 'distributed',
        description: 'Distributed to 5 warehouses',
        location: 'Multiple Locations',
        performed_by: 'Distribution Manager',
        timestamp: '2024-01-05T08:00:00Z',
        details: '5 batches created and distributed',
      },
      {
        id: '2',
        event_type: 'quality_approved',
        description: 'Quality check passed - approved for distribution',
        location: 'Factory A - QC Lab',
        performed_by: 'Jane QC Manager',
        timestamp: '2024-01-02T10:00:00Z',
        details: 'All quality tests passed',
      },
      {
        id: '3',
        event_type: 'quality_testing',
        description: 'Quality testing in progress',
        location: 'Factory A - QC Lab',
        performed_by: 'QC Team',
        timestamp: '2024-01-02T08:00:00Z',
        details: 'pH, sugar content, carbonation tests',
      },
      {
        id: '4',
        event_type: 'packaging',
        description: 'Packaging completed',
        location: 'Factory A - Packaging Line',
        performed_by: 'Production Team',
        timestamp: '2024-01-01T16:00:00Z',
        details: '5000 units packaged',
      },
      {
        id: '5',
        event_type: 'production',
        description: 'Production completed',
        location: 'Factory A - Line 3',
        performed_by: 'Production Manager',
        timestamp: '2024-01-01T14:00:00Z',
        details: 'Batch production run completed',
      },
      {
        id: '6',
        event_type: 'production_start',
        description: 'Production started',
        location: 'Factory A - Line 3',
        performed_by: 'Production Manager',
        timestamp: '2024-01-01T08:00:00Z',
        details: 'Raw materials verified and production initiated',
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading lot tracking...</div>
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
          onClick={() => navigate(`/inventory/lots/${lotId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Lot
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Lot Tracking History</h1>
        <p className="text-gray-600">{lot?.lot_number} - {lot?.product_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Production & Distribution Timeline</h2>
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
                        event.event_type === 'distributed' ? 'bg-green-100' :
                        event.event_type === 'quality_approved' ? 'bg-green-100' :
                        event.event_type === 'quality_testing' ? 'bg-yellow-100' :
                        event.event_type === 'packaging' ? 'bg-blue-100' :
                        event.event_type === 'production' ? 'bg-purple-100' :
                        'bg-gray-100'
                      }`}>
                        {event.event_type === 'distributed' ? (
                          <Truck className="h-4 w-4 text-green-600" />
                        ) : event.event_type === 'quality_approved' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : event.event_type === 'quality_testing' ? (
                          <CheckCircle className="h-4 w-4 text-yellow-600" />
                        ) : event.event_type === 'packaging' ? (
                          <Warehouse className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Factory className={`h-4 w-4 ${
                            event.event_type === 'production' ? 'text-purple-600' : 'text-gray-600'
                          }`} />
                        )}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            event.event_type === 'distributed' ? 'bg-green-100 text-green-800' :
                            event.event_type === 'quality_approved' ? 'bg-green-100 text-green-800' :
                            event.event_type === 'quality_testing' ? 'bg-yellow-100 text-yellow-800' :
                            event.event_type === 'packaging' ? 'bg-blue-100 text-blue-800' :
                            event.event_type === 'production' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {event.event_type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1">{event.description}</p>
                        <p className="text-sm text-gray-600 mb-1">{event.location}</p>
                        <p className="text-sm text-gray-500 mb-1">{event.details}</p>
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
