import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, MapPin, Clock } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import { vanSalesService } from '../../../services/van-sales.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function RouteStopList() {
  const { routeId } = useParams<{ routeId: string }>()
  const navigate = useNavigate()

  const { data: route } = useQuery({
    queryKey: ['route', routeId],
    queryFn: async () => {
      if (!routeId) return null
      return await vanSalesService.getRoute(routeId)
    },
    enabled: !!routeId,
  })

  const { data: stops = [], isLoading, isError } = useQuery({
    queryKey: ['route-stops', routeId],
    queryFn: async () => {
      if (!routeId) return []
      return await vanSalesService.getRouteStops(routeId)
    },
    enabled: !!routeId,
  })

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
          onClick={() => navigate(`/van-sales/routes/${routeId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Route
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Route Stops</h1>
        <p className="text-gray-600">
          {route?.route_number} - {route?.agent_name} - {new Date(route?.route_date || '').toLocaleDateString()}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planned</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actual</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Order Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stops?.map((stop) => (
              <tr key={stop.id} className="hover:bg-surface-secondary">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {stop.stop_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {stop.customer_name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {stop.address}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(stop.planned_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {stop.actual_arrival ? (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(stop.actual_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                  {formatCurrency(stop.order_value)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    stop.status === 'completed' ? 'bg-green-100 text-green-800' :
                    stop.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    stop.status === 'skipped' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {stop.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => navigate(`/van-sales/routes/${routeId}/stops/${stop.id}`)}
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
