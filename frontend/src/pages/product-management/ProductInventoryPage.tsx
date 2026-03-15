import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productsService } from '../../services/products.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface ProductInventory {
  product_id: string
  product_name: string
  sku: string
  category: string
  current_stock: number
  min_stock_level: number
  max_stock_level: number
  reorder_point: number
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock'
  last_restocked: string
  warehouse_locations: Array<{
    warehouse: string
    quantity: number
  }>
}

export const ProductInventoryPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products-inventory'],
    queryFn: () => productsService.getProducts({ limit: 100 }),
  })

  const mockInventory: ProductInventory[] = (productsData?.products || productsData || []).map((p: any) => ({
    product_id: String(p.id),
    product_name: p.name || 'Unknown Product',
    sku: p.sku || '',
    category: p.category_name || p.category || '',
    current_stock: Number(p.stock_quantity || p.current_stock || 0),
    reserved_stock: Number(p.reserved_stock || 0),
    available_stock: Number(p.stock_quantity || p.current_stock || 0) - Number(p.reserved_stock || 0),
    reorder_level: Number(p.reorder_level || p.min_stock || 10),
    reorder_quantity: Number(p.reorder_quantity || 50),
    warehouse: p.warehouse_name || 'Main Warehouse',
    last_restocked: p.updated_at || new Date().toISOString(),
    status: Number(p.stock_quantity || 0) <= 0 ? 'out_of_stock' : Number(p.stock_quantity || 0) <= Number(p.reorder_level || 10) ? 'low_stock' : 'in_stock' as any,
  }))

  if (isLoading) return <LoadingSpinner />

  const getStatusBadge = (status: string) => {
    const badges = {
      in_stock: 'bg-green-100 text-green-800',
      low_stock: 'bg-yellow-100 text-yellow-800',
      out_of_stock: 'bg-red-100 text-red-800'
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  const getStockLevel = (current: number, min: number, max: number) => {
    const percentage = max > 0 ? (current / max) * 100 : 0
    return Math.min(percentage, 100)
  }

  const filteredInventory = statusFilter === 'all'
    ? mockInventory
    : mockInventory.filter(i => i.stock_status === statusFilter)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor stock levels and manage inventory across warehouses
          </p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Adjust Stock
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">In Stock</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockInventory.filter(i => i.stock_status === 'in_stock').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Low Stock</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockInventory.filter(i => i.stock_status === 'low_stock').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Out of Stock</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockInventory.filter(i => i.stock_status === 'out_of_stock').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Items</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockInventory.reduce((sum, i) => sum + i.current_stock, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-2">
          {['all', 'in_stock', 'low_stock', 'out_of_stock'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredInventory.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No inventory data</h3>
            <p className="mt-1 text-sm text-gray-500">No products found for the selected filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reorder Point
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((item) => {
                  const stockLevel = getStockLevel(item.current_stock, item.min_stock_level, item.max_stock_level)
                  return (
                    <tr key={item.product_id} className="hover:bg-surface-secondary">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                        <div className="text-sm text-gray-500">{item.sku}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.category}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{item.current_stock}</div>
                        <div className="text-sm text-gray-500">
                          Min: {item.min_stock_level} / Max: {item.max_stock_level}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2 w-24">
                            <div
                              className={`h-2 rounded-full ${
                                stockLevel >= 50 ? 'bg-green-600' :
                                stockLevel >= 25 ? 'bg-yellow-600' :
                                'bg-red-600'
                              }`}
                              style={{ width: `${stockLevel}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-900">{stockLevel.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${
                          item.current_stock <= item.reorder_point ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {item.reorder_point}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(item.stock_status)}`}>
                          {item.stock_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-900 mr-4">
                          View
                        </button>
                        <button className="text-indigo-600 hover:text-indigo-900">
                          Adjust
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
