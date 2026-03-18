import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, Clock, DollarSign, Package } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function RouteStopPerformance() {
  const { routeId } = useParams<{ routeId: string }>()
  const navigate = useNavigate()

  const { data: route } = useQuery({
    queryKey: ['route', routeId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/routes/${routeId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: performance, isLoading, isError } = useQuery({
    queryKey: ['route-performance', routeId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/routes/${routeId}/performance`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  if (isLoading) {
    return <div className="p-6">Loading performance data...</div>
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


  if (!performance) {
    return <div className="p-6">Performance data not found</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Route Stop Performance</h1>
        <p className="text-gray-600">{route?.route_number} - {route?.agent_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Completion Rate</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{performance.completion_rate}%</p>
          <p className="text-sm text-gray-600 mt-1">
            {performance.completed_stops}/{performance.total_stops} stops
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Total Revenue</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(performance.total_revenue)}</p>
          <p className="text-sm text-gray-600 mt-1">
            {formatCurrency(performance.total_revenue / performance.completed_stops)} avg/stop
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Avg Duration</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{performance.average_stop_duration}</p>
          <p className="text-sm text-gray-600 mt-1">minutes per stop</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">On-Time %</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{performance.on_time_percentage}%</p>
          <p className="text-sm text-gray-600 mt-1">
            {performance.late_stops} late, {performance.early_stops} early
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Stop Performance Details</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Planned</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">On Time</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {performance.stops_detail.map((stop) => (
                <tr key={stop.stop_number} className="hover:bg-surface-secondary">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stop.stop_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {stop.customer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {stop.planned_duration} min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {stop.actual_duration} min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {stop.on_time ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        On Time
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Late
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    {formatCurrency(stop.revenue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {stop.items_sold}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Performance Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-blue-700">
              <strong>Completion:</strong> {performance.completed_stops} completed, {performance.skipped_stops} skipped, {performance.pending_stops} pending
            </p>
          </div>
          <div>
            <p className="text-blue-700">
              <strong>Timing:</strong> {performance.on_time_percentage}% on-time arrival rate
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
