import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { MapPin, Clock, Truck, Navigation, Plus, Edit, Trash2 } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { apiClient } from '../../services/api.service'

interface Route {
  id: string
  name: string
  description: string
  vanAssigned: string
  driver: string
  status: 'active' | 'inactive' | 'planned'
  totalStops: number
  estimatedTime: number
  distance: number
  priority: 'high' | 'medium' | 'low'
  lastUpdated: string
  customers: Customer[]
}

interface Customer {
  id: string
  name: string
  address: string
  estimatedValue: number
  visitTime: string
  status: 'pending' | 'completed' | 'skipped'
}

export default function RouteManagementPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)

  useEffect(() => {
    fetchRoutes()
  }, [])

  const fetchRoutes = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/van-sales/routes')
      const data = response.data?.data || response.data?.routes || response.data || []
      const routeList = Array.isArray(data) ? data : []
      setRoutes(routeList.map((r: any) => ({
        id: String(r.id),
        name: r.name || '',
        description: r.description || '',
        vanAssigned: r.van_assigned || r.vanAssigned || 'Unassigned',
        driver: r.driver || r.driver_name || 'Unassigned',
        status: r.status || 'planned',
        totalStops: Number(r.total_stops || r.totalStops || 0),
        estimatedTime: Number(r.estimated_time || r.estimatedTime || 0),
        distance: Number(r.distance || 0),
        priority: r.priority || 'medium',
        lastUpdated: r.last_updated || r.updated_at || '',
        customers: Array.isArray(r.customers) ? r.customers.map((c: any) => ({
          id: String(c.id),
          name: c.name || c.customer_name || '',
          address: c.address || '',
          estimatedValue: Number(c.estimated_value || c.estimatedValue || 0),
          visitTime: c.visit_time || c.visitTime || '',
          status: c.status || 'pending',
        })) : [],
      })))
    } catch {
      setRoutes([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'inactive': return 'text-gray-600 bg-gray-100'
      case 'planned': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Route Management</h1>
          <p className="text-gray-600">Plan and optimize delivery routes for maximum efficiency</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create New Route
        </Button>
      </div>

      {/* Routes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {routes.map((route) => (
          <Card key={route.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{route.name}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{route.description}</p>
                </div>
                <div className="flex space-x-1">
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Status and Priority */}
                <div className="flex justify-between items-center">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(route.status)}`}>
                    {route.status}
                  </span>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(route.priority)}`}>
                    {route.priority} priority
                  </span>
                </div>

                {/* Van and Driver */}
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <Truck className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="text-gray-600">Van:</span>
                    <span className="ml-1 font-medium">{route.vanAssigned}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="text-gray-600 ml-6">Driver:</span>
                    <span className="ml-1 font-medium">{route.driver}</span>
                  </div>
                </div>

                {/* Route Stats */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <MapPin className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium">{route.totalStops}</p>
                    <p className="text-xs text-gray-500">Stops</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Clock className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium">{Math.round(route.estimatedTime / 60)}h</p>
                    <p className="text-xs text-gray-500">Duration</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Navigation className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium">{route.distance}km</p>
                    <p className="text-xs text-gray-500">Distance</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setSelectedRoute(route)}
                  >
                    View Details
                  </Button>
                  <Button size="sm" className="flex-1">
                    Optimize Route
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Route Details Modal/Panel */}
      {selectedRoute && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Route Details: {selectedRoute.name}</CardTitle>
              <Button variant="outline" onClick={() => setSelectedRoute(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Route Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Van Assigned</p>
                  <p className="text-lg font-semibold">{selectedRoute.vanAssigned}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Driver</p>
                  <p className="text-lg font-semibold">{selectedRoute.driver}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Distance</p>
                  <p className="text-lg font-semibold">{selectedRoute.distance} km</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Estimated Time</p>
                  <p className="text-lg font-semibold">{Math.round(selectedRoute.estimatedTime / 60)} hours</p>
                </div>
              </div>

              {/* Customer Stops */}
              {selectedRoute.customers.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Customer Stops</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-surface-secondary">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Customer
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Address
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Visit Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Est. Value
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedRoute.customers.map((customer) => (
                          <tr key={customer.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {customer.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {customer.address}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {customer.visitTime}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(customer.estimatedValue)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(customer.status)}`}>
                                {customer.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
