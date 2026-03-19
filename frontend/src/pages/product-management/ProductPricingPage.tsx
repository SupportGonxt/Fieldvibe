import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productsService } from '../../services/products.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

interface ProductPricing {
  product_id: string
  product_name: string
  sku: string
  category: string
  cost_price: number
  selling_price: number
  margin_percentage: number
  margin_amount: number
  tax_rate: number
  discount_percentage?: number
  final_price: number
  last_price_change?: string
}

export const ProductPricingPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: productsData, isLoading, isError } = useQuery({
    queryKey: ['products-pricing'],
    queryFn: () => productsService.getProducts({ limit: 100 }),
  })

  const mockPricing: ProductPricing[] = (productsData?.products || productsData || []).map((p: any) => ({
    product_id: String(p.id),
    product_name: p.name || 'Unknown Product',
    sku: p.sku || '',
    category: p.category_name || p.category || '',
    cost_price: Number(p.cost_price || p.unit_cost || 0),
    selling_price: Number(p.selling_price || p.unit_price || 0),
    margin_percentage: Number(p.selling_price || p.unit_price || 0) > 0 ? ((Number(p.selling_price || p.unit_price || 0) - Number(p.cost_price || p.unit_cost || 0)) / Number(p.selling_price || p.unit_price || 1)) * 100 : 0,
    margin_amount: Number(p.selling_price || p.unit_price || 0) - Number(p.cost_price || p.unit_cost || 0),
    tax_rate: Number(p.tax_rate || 15),
    discount_percentage: Number(p.discount_percentage || 0),
    final_price: Number(p.selling_price || p.unit_price || 0),
    last_price_change: p.updated_at,
  }))

  if (isLoading) return <LoadingSpinner />


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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount)
  }

  const getMarginColor = (margin: number) => {
    if (margin >= 30) return 'text-green-600'
    if (margin >= 15) return 'text-yellow-600'
    return 'text-red-600'
  }

  const filteredPricing = searchTerm
    ? mockPricing.filter(p => 
        p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : mockPricing

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Pricing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage product prices, margins, and discounts
          </p>
        </div>
        <button onClick={() => toast.success('Bulk price update started')} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Bulk Price Update
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Selling Price</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockPricing.length > 0
                  ? formatCurrency(mockPricing.reduce((sum, p) => sum + p.selling_price, 0) / mockPricing.length)
                  : formatCurrency(0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Margin</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockPricing.length > 0
                  ? `${(mockPricing.reduce((sum, p) => sum + p.margin_percentage, 0) / mockPricing.length).toFixed(1)}%`
                  : '0%'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Products on Discount</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockPricing.filter(p => p.discount_percentage && p.discount_percentage > 0).length}
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
              <p className="text-sm font-medium text-gray-500">Low Margin Products</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockPricing.filter(p => p.margin_percentage < 15).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <input
          type="text"
          placeholder="Search products by name or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {/* Pricing List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredPricing.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pricing data</h3>
            <p className="mt-1 text-sm text-gray-500">No products found matching your search.</p>
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
                    Cost Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Selling Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Discount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Final Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPricing.map((item) => (
                  <tr key={item.product_id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                      <div className="text-sm text-gray-500">{item.sku}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(item.cost_price)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{formatCurrency(item.selling_price)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-semibold ${getMarginColor(item.margin_percentage)}`}>
                        {item.margin_percentage.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-500">{formatCurrency(item.margin_amount)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.discount_percentage && item.discount_percentage > 0 ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                          {item.discount_percentage}% OFF
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{formatCurrency(item.final_price)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button onClick={(e) => { e.stopPropagation(); toast.success('Edit pricing') }} className="text-blue-600 hover:text-blue-900 mr-4">
                        Edit
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toast.success('Viewing price history') }} className="text-indigo-600 hover:text-indigo-900">
                        History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
