import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Truck, MapPin, Package, DollarSign, TrendingUp, Clock } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../services/api.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import SearchableSelect from '../../components/ui/SearchableSelect'

interface VanSalesMetrics {
  totalVans: number
  activeRoutes: number
  todaySales: number
  totalInventory: number
  averageDeliveryTime: number
  routeEfficiency: number
}

interface VanPerformance {
  id: string
  vanNumber: string
  driver: string
  route: string
  status: 'active' | 'inactive' | 'maintenance'
  todaySales: number
  deliveries: number
  efficiency: number
  location: string
}

export default function VanSalesPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<VanSalesMetrics>({
    totalVans: 0,
    activeRoutes: 0,
    todaySales: 0,
    totalInventory: 0,
    averageDeliveryTime: 0,
    routeEfficiency: 0
  })
  
  const [vanPerformance, setVanPerformance] = useState<VanPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddVanModal, setShowAddVanModal] = useState(false)
  const [newVanData, setNewVanData] = useState({
    registration_number: '',
    model: '',
    capacity_units: '',
    status: 'active'
  })

  useEffect(() => {
    fetchVanSalesData()
  }, [])

  const fetchVanSalesData = async () => {
    try {
      setLoading(true)
      
      // Fetch vans data
      const vansResponse = await apiClient.get('/vans')
      const vansData = vansResponse.data
      
      // Fetch van sales data
      const salesResponse = await apiClient.get('/van-sales')
      const salesData = salesResponse.data
      
      // Fetch routes data
      const routesResponse = await apiClient.get('/routes')
      const routesData = routesResponse.data
      
      // Calculate metrics from real data
      const vans = vansData.success ? vansData.data : []
      const sales = salesData.success ? salesData.data : []
      const routes = routesData.success ? routesData.data : []
      
      const totalSales = sales.reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0)
      const activeVans = vans.filter((van: any) => van.status === 'active').length
      
      setMetrics({
        totalVans: vans.length,
        activeRoutes: routes.length,
        todaySales: totalSales,
        totalInventory: 125000, // FUTURE: Calculate from inventory API
        averageDeliveryTime: 32, // FUTURE: Calculate from actual data
        routeEfficiency: activeVans > 0 ? Math.round((activeVans / vans.length) * 100) : 0
      })

      // Map vans to performance data
      const vanPerformanceData = vans.map((van: any) => {
        const vanSales = sales.filter((sale: any) => sale.van_id === van.id)
        const vanSalesTotal = vanSales.reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0)
        
        return {
          id: van.id,
          vanNumber: van.registration_number || van.van_number || 'N/A',
          driver: van.assigned_agent_name || 'Unassigned',
          route: 'Route TBD', // FUTURE: Get from route assignment
          status: van.status || 'inactive',
          todaySales: vanSalesTotal,
          deliveries: vanSales.length,
          efficiency: van.status === 'active' ? 92 : 0, // FUTURE: Calculate real efficiency
          location: 'GPS location TBD' // FUTURE: Get from GPS tracking
        }
      })
      
      setVanPerformance(vanPerformanceData)
    } catch (error: any) {
      console.error('Error fetching van sales data:', error)
      // Don't show toast for expected missing endpoints - just show zero metrics
    } finally {
      setLoading(false)
    }
  }

  const handleAddVan = async () => {
    try {
      const response = await apiClient.post('/vans', {
        registration_number: newVanData.registration_number,
        model: newVanData.model,
        capacity_units: newVanData.capacity_units ? parseInt(newVanData.capacity_units) : null,
        status: newVanData.status
      })
      
      const data = response.data
      
      if (data.success) {
        setShowAddVanModal(false)
        setNewVanData({
          registration_number: '',
          model: '',
          capacity_units: '',
          status: 'active'
        })
        fetchVanSalesData() // Refresh the data
      } else {
        toast.error(data.message || 'Failed to create van')
      }
    } catch (error) {
      console.error('Error creating van:', error)
      toast.error('Failed to create van')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'inactive': return 'text-gray-600 bg-gray-100'
      case 'maintenance': return 'text-orange-600 bg-orange-100'
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
          <h1 className="text-2xl font-bold text-gray-900">Van Sales Management</h1>
          <p className="text-gray-600">Monitor and manage your van sales operations</p>
        </div>
        <Button onClick={() => setShowAddVanModal(true)}>
          <Truck className="h-4 w-4 mr-2" />
          Add New Van
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Vans</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalVans}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <MapPin className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Routes</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.activeRoutes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Sales</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.todaySales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Package className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Inventory</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalInventory)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <Clock className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Delivery Time</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.averageDeliveryTime}min</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Route Efficiency</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.routeEfficiency}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Van Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Van Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Van Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Today's Sales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deliveries
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Efficiency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vanPerformance.map((van) => (
                  <tr key={van.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{van.vanNumber}</div>
                        <div className="text-sm text-gray-500">{van.driver}</div>
                        <div className="text-sm text-gray-500">{van.route}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(van.status)}`}>
                        {van.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(van.todaySales)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {van.deliveries}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {van.efficiency}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {van.location}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Van Modal */}
      {showAddVanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Van</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Registration Number *
                </label>
                <input
                  type="text"
                  value={newVanData.registration_number}
                  onChange={(e) => setNewVanData({ ...newVanData, registration_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., VAN-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={newVanData.model}
                  onChange={(e) => setNewVanData({ ...newVanData, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Toyota Hiace"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacity (units)
                </label>
                <input
                  type="number"
                  value={newVanData.capacity_units}
                  onChange={(e) => setNewVanData({ ...newVanData, capacity_units: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <SearchableSelect
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'maintenance', label: 'Maintenance' },
                  ]}
                  value={newVanData.status}
                  placeholder="Active"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddVanModal(false)
                  setNewVanData({
                    registration_number: '',
                    model: '',
                    capacity_units: '',
                    status: 'active'
                  })
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddVan}
                disabled={!newVanData.registration_number}
              >
                Create Van
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
