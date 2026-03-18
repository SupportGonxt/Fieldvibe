import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Edit, MapPin, Users, TrendingUp } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import { vanSalesService } from '../../services/van-sales.service'
import ErrorState from '../../components/ui/ErrorState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function RouteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: route, isLoading, isError } = useQuery({
    queryKey: ['route', id],
    queryFn: () => vanSalesService.getRoute(id!),
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


  if (!route) {
    return <div className="p-6">Route not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/van-sales/routes')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Routes
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{route.route_name}</h1>
            <p className="text-gray-600">{route.agent_name} - {route.van_number}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/van-sales/routes/${id}/edit`)}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit className="h-5 w-5" />
              Edit
            </button>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              route.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {route.status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Total Customers</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{route.total_customers}</p>
          <p className="text-sm text-gray-600 mt-1">{route.active_customers} active</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Avg Daily Sales</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(route.avg_daily_sales)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Coverage Area</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">{route.coverage_area}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Route Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Route Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{route.route_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Agent</dt>
            <dd className="mt-1 text-sm text-gray-900">{route.agent_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Van</dt>
            <dd className="mt-1 text-sm text-gray-900">{route.van_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Start Location</dt>
            <dd className="mt-1 text-sm text-gray-900">{route.start_location}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Notes</dt>
            <dd className="mt-1 text-sm text-gray-900">{route.notes || '-'}</dd>
          </div>
        </dl>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => navigate(`/van-sales/routes/${id}/customers`)}
          className="btn-primary"
        >
          View Customers
        </button>
        <button
          onClick={() => navigate(`/van-sales/routes/${id}/orders`)}
          className="btn-secondary"
        >
          View Orders
        </button>
        <button
          onClick={() => navigate(`/van-sales/routes/${id}/performance`)}
          className="btn-secondary"
        >
          View Performance
        </button>
      </div>
    </div>
  )
}
