import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter,
  BarChart3,
  PieChart,
  TrendingUp,
  Package,
  AlertTriangle,
  DollarSign,
  Activity,
  MapPin,
  Eye,
  Printer
} from 'lucide-react'
import {
  LineChart,
  AreaChart,
  BarChart,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  Bar,
  Line,
  Cell,
  Pie
} from 'recharts'
import { inventoryService } from '../../services/inventory.service'
import { formatDate, formatNumber, formatCurrency } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

interface ReportFilter {
  start_date: string
  end_date: string
  location_id?: string
  category?: string
  report_type: 'summary' | 'detailed' | 'movements' | 'valuation' | 'performance'
}

export default function InventoryReports() {
  const [filter, setFilter] = useState<ReportFilter>({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    report_type: 'summary'
  })

  const [selectedReport, setSelectedReport] = useState<string>('summary')

  const { data: reportData, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory-reports', filter],
    queryFn: () => inventoryService.getInventoryReports('all'),
    staleTime: 1000 * 60 * 5,
  })

  const { data: locations } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => inventoryService.getLocations(),
    staleTime: 1000 * 60 * 10,
  })

  const handleExport = (format: 'excel' | 'csv') => {
    inventoryService.exportInventoryReport(format, filter)
    toast.success(`${format.toUpperCase()} report export started`)
  }

  const handlePrint = () => {
    window.print()
  }

  const reportTypes = [
    { id: 'summary', name: 'Summary Report', icon: BarChart3, description: 'Overview of inventory metrics and KPIs' },
    { id: 'detailed', name: 'Detailed Report', icon: FileText, description: 'Comprehensive item-by-item analysis' },
    { id: 'movements', name: 'Movement Report', icon: Activity, description: 'Stock movement and transaction history' },
    { id: 'valuation', name: 'Valuation Report', icon: DollarSign, description: 'Inventory valuation and cost analysis' },
    { id: 'performance', name: 'Performance Report', icon: TrendingUp, description: 'Turnover and performance metrics' }
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Reports</h1>
          <p className="text-gray-600">Comprehensive inventory analysis and reporting</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handlePrint}
            className="btn-outline flex items-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
          <div className="flex space-x-1">
            <button
              onClick={() => handleExport('excel')}
              className="btn-outline flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="btn-outline flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {reportTypes.map((type) => {
          const Icon = type.icon
          return (
            <button
              key={type.id}
              onClick={() => {
                setSelectedReport(type.id)
                setFilter({ ...filter, report_type: type.id as any })
              }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedReport === type.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-100 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center mb-2">
                <Icon className={`w-5 h-5 mr-2 ${
                  selectedReport === type.id ? 'text-blue-600' : 'text-gray-400'
                }`} />
                <h3 className={`font-medium ${
                  selectedReport === type.id ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  {type.name}
                </h3>
              </div>
              <p className="text-sm text-gray-600">{type.description}</p>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filter.start_date}
              onChange={(e) => setFilter({ ...filter, start_date: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filter.end_date}
              onChange={(e) => setFilter({ ...filter, end_date: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <select
              value={filter.location_id || ''}
              onChange={(e) => setFilter({ ...filter, location_id: e.target.value || undefined })}
              className="input"
            >
              <option value="">All Locations</option>
              {(locations || []).map((location: any) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={filter.category || ''}
              onChange={(e) => setFilter({ ...filter, category: e.target.value || undefined })}
              className="input"
            >
              <option value="">All Categories</option>
              <option value="beverages">Beverages</option>
              <option value="snacks">Snacks</option>
              <option value="dairy">Dairy</option>
              <option value="frozen">Frozen</option>
              <option value="household">Household</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {selectedReport === 'summary' && (
        <div className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 rounded-lg bg-blue-100">
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Items</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatNumber(reportData?.summary?.total_items || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 rounded-lg bg-green-100">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Value</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(reportData?.summary?.total_value || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 rounded-lg bg-red-100">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatNumber(reportData?.summary?.low_stock_items || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 rounded-lg bg-purple-100">
                    <Activity className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Turnover Rate</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {reportData?.summary?.turnover_rate || 0}x
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Value by Category</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={reportData?.charts?.category_distribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(reportData?.charts?.category_distribution || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [formatCurrency(value), 'Value']} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Levels by Location</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData?.charts?.location_distribution || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="location" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [formatCurrency(value), 'Stock Value']} />
                    <Bar dataKey="value" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedReport === 'detailed' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Inventory Items</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Min/Max Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(reportData?.detailed?.items || []).map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                        <div className="text-sm text-gray-500">{item.product_code}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.location_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatNumber(item.current_stock)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.minimum_stock} / {item.maximum_stock || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(item.unit_cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(item.current_stock * item.unit_cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.stock_status === 'in_stock' ? 'bg-green-100 text-green-800' :
                        item.stock_status === 'low_stock' ? 'bg-yellow-100 text-yellow-800' :
                        item.stock_status === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {item.stock_status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedReport === 'movements' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Movement Trends</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reportData?.movements?.daily_movements || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => formatDate(value, { format: 'short' })}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => formatDate(value)}
                    formatter={(value: any, name: string) => [value, name === 'inbound' ? 'Stock In' : 'Stock Out']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="inbound" 
                    stackId="1"
                    stroke="#10B981" 
                    fill="#10B981" 
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="outbound" 
                    stackId="1"
                    stroke="#EF4444" 
                    fill="#EF4444" 
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Stock Movements</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(reportData?.movements?.recent_movements || []).map((movement: any) => (
                    <tr key={movement.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(movement.movement_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{movement.product_name}</div>
                          <div className="text-sm text-gray-500">{movement.product_code}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          movement.movement_type === 'inbound' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {movement.movement_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {movement.movement_type === 'inbound' ? '+' : '-'}{formatNumber(movement.quantity)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {movement.location_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {movement.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedReport === 'valuation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(reportData?.valuation?.total_inventory_value || 0)}
                </div>
                <div className="text-sm text-gray-500">Total Inventory Value</div>
              </div>
            </div>
            <div className="card">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {formatCurrency(reportData?.valuation?.average_unit_cost || 0)}
                </div>
                <div className="text-sm text-gray-500">Average Unit Cost</div>
              </div>
            </div>
            <div className="card">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {reportData?.valuation?.cost_method || 'FIFO'}
                </div>
                <div className="text-sm text-gray-500">Valuation Method</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Valuation by Category</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData?.valuation?.category_values || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis tickFormatter={(value) => formatCurrency(value, { compact: true })} />
                  <Tooltip formatter={(value: any) => [formatCurrency(value), 'Value']} />
                  <Bar dataKey="value" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {selectedReport === 'performance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="card">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {reportData?.performance?.inventory_turnover || 0}x
                </div>
                <div className="text-sm text-gray-500">Inventory Turnover</div>
              </div>
            </div>
            <div className="card">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {reportData?.performance?.days_sales_inventory || 0}
                </div>
                <div className="text-sm text-gray-500">Days Sales in Inventory</div>
              </div>
            </div>
            <div className="card">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {reportData?.performance?.stockout_rate || 0}%
                </div>
                <div className="text-sm text-gray-500">Stockout Rate</div>
              </div>
            </div>
            <div className="card">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {reportData?.performance?.fill_rate || 0}%
                </div>
                <div className="text-sm text-gray-500">Fill Rate</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Products</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Turnover Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Units Sold
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg. Stock Level
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(reportData?.performance?.top_products || []).map((product: any) => (
                    <tr key={product.product_id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                          <div className="text-sm text-gray-500">{product.product_code}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.turnover_rate}x
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(product.units_sold)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(product.revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(product.avg_stock_level)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}