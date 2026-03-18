import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, DollarSign, Users, Package } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import { vanSalesService } from '../../services/van-sales.service'
import { beatRoutesService } from '../../services/beat-routes.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function RoutePerformance() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: route } = useQuery({
    queryKey: ['route', id],
    queryFn: () => vanSalesService.getRoute(id!),
  })

  const { data: performance, isLoading, isError } = useQuery({
    queryKey: ['route-performance', id],
    queryFn: () => beatRoutesService.getBeatStats(id),
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
        <h1 className="text-2xl font-bold text-gray-900">Route Performance</h1>
        <p className="text-gray-600">{route?.route_name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Total Sales</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(performance?.total_sales || 0)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Total Orders</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{performance?.total_orders || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Customers</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{performance?.total_customers || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Avg Order</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(performance?.avg_order_value || 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h2>
          <div className="space-y-3">
            {performance?.sales_trend.map((item) => (
              <div key={item.date} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{new Date(item.date).toLocaleDateString()}</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(item.sales)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h2>
          <div className="space-y-3">
            {performance?.top_products.map((product, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-600">{product.quantity} units</p>
                </div>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(product.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
