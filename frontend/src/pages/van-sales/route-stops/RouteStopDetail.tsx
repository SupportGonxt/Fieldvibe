import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Clock, CheckCircle, Package } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function RouteStopDetail() {
  const { routeId, stopId } = useParams<{ routeId: string; stopId: string }>()
  const navigate = useNavigate()

  const { data: route } = useQuery({
    queryKey: ['route', routeId],
    queryFn: async () => {
      const response = await apiClient.get(`/routes/${routeId}`)
      const result = response.data
      return result.data
    },
  })

  const { data: stop, isLoading, isError } = useQuery({
    queryKey: ['route-stop', routeId, stopId],
    queryFn: async () => {
      const response = await apiClient.get(`/route-stops/${stopId}`)
      const result = response.data
      return result.data
    },
  })

  if (isLoading) {
    return <div className="p-6">Loading stop details...</div>
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


  if (!stop) {
    return <div className="p-6">Stop not found</div>
  }

  const duration = stop.actual_arrival && stop.actual_departure
    ? Math.round((new Date(stop.actual_departure).getTime() - new Date(stop.actual_arrival).getTime()) / 60000)
    : null

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/van-sales/routes/${routeId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Route
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Route Stop Detail</h1>
        <p className="text-gray-600">{route?.route_number} - Stop #{stop.stop_number}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Customer</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">{stop.customer_name}</p>
          <p className="text-sm text-gray-600 mt-1">{stop.customer_contact}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Order Value</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(stop.order_value)}</p>
          <p className="text-sm text-gray-600 mt-1">{stop.items_delivered} items</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className={`h-5 w-5 ${
              stop.status === 'completed' ? 'text-green-600' : 'text-gray-400'
            }`} />
            <h3 className="font-semibold text-gray-900">Status</h3>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
            stop.status === 'completed' ? 'bg-green-100 text-green-800' :
            stop.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
            stop.status === 'skipped' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {stop.status}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Customer Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{stop.customer_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Contact Person</dt>
            <dd className="mt-1 text-sm text-gray-900">{stop.customer_contact}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Phone</dt>
            <dd className="mt-1 text-sm text-gray-900">{stop.customer_phone}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Address</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-start gap-1">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
              {stop.address}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Timing</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Planned Arrival</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Clock className="h-4 w-4 text-gray-400" />
              {new Date(stop.planned_arrival).toLocaleTimeString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Actual Arrival</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Clock className="h-4 w-4 text-gray-400" />
              {stop.actual_arrival 
                ? new Date(stop.actual_arrival).toLocaleTimeString()
                : 'Not arrived yet'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Planned Departure</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Clock className="h-4 w-4 text-gray-400" />
              {new Date(stop.planned_departure).toLocaleTimeString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Actual Departure</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Clock className="h-4 w-4 text-gray-400" />
              {stop.actual_departure 
                ? new Date(stop.actual_departure).toLocaleTimeString()
                : 'Not departed yet'}
            </dd>
          </div>
          {duration && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Duration</dt>
              <dd className="mt-1 text-sm text-gray-900">{duration} minutes</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Order Value</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatCurrency(stop.order_value)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Payment Collected</dt>
            <dd className="mt-1 text-sm font-medium text-green-600">
              {formatCurrency(stop.payment_collected)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{stop.payment_method}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Completion Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Signature Captured</dt>
            <dd className="mt-1">
              {stop.signature_captured ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <span className="text-sm text-gray-500">No</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Photos Taken</dt>
            <dd className="mt-1 text-sm text-gray-900">{stop.photos_taken}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Items Delivered</dt>
            <dd className="mt-1 text-sm text-gray-900">{stop.items_delivered}</dd>
          </div>
        </dl>
      </div>

      {stop.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{stop.notes}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/customers/${stop.customer_id}`)}
          className="btn-secondary"
        >
          View Customer
        </button>
        <button
          onClick={() => navigate(`/van-sales/routes/${routeId}/stops/${stopId}/edit`)}
          className="btn-secondary"
        >
          Edit
        </button>
      </div>
    </div>
  )
}
