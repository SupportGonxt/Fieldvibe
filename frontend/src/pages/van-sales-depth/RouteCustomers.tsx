import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Phone } from 'lucide-react'
import { vanSalesService } from '../../services/van-sales.service'
import { beatRoutesService } from '../../services/beat-routes.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function RouteCustomers() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: route } = useQuery({
    queryKey: ['route', id],
    queryFn: () => vanSalesService.getRoute(id!),
  })

  const { data: customers, isLoading, isError } = useQuery({
    queryKey: ['route-customers', id],
    queryFn: () => beatRoutesService.getRouteCustomers(id!),
  })

  if (isLoading) return <div className="p-6"><LoadingSpinner size="md" /></div>


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
        <button onClick={() => navigate(`/van-sales/routes/${id}`)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-5 w-5" />
          Back to Route
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Route Customers</h1>
        <p className="text-gray-600">{route?.route_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Visit</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers?.map((customer) => (
              <tr key={customer.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {customer.address}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {customer.phone}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {customer.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(customer.last_visit).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
