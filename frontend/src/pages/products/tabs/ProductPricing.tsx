import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, TrendingUp, Calendar } from 'lucide-react'
import { productsService as productService } from '../../../services/products.service'

export default function ProductPricing() {
  const { id } = useParams<{ id: string }>()

  const { data: pricing = [], isLoading, isError } = useQuery({
    queryKey: ['product-pricing', id],
    queryFn: () => productService.getProductPricing(id!),
  })

  const currentPrice = pricing.find((p: any) => p.is_current)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Product Pricing</h2>
        {currentPrice && (
          <div className="mt-4 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Price</p>
                <p className="text-3xl font-bold text-gray-900">R {currentPrice.price?.toFixed(2)}</p>
              </div>
              <DollarSign className="h-12 w-12 text-green-600" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Cost Price</p>
                <p className="text-lg font-semibold text-gray-900">R {currentPrice.cost_price?.toFixed(2) || '0.00'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Margin</p>
                <p className="text-lg font-semibold text-green-600">
                  {currentPrice.cost_price ? ((currentPrice.price - currentPrice.cost_price) / currentPrice.price * 100).toFixed(1) : '0'}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Pricing History</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading pricing history...</div>
        ) : pricing.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No pricing history found for this product.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Effective Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Changed By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pricing.map((price: any) => (
                  <tr key={price.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {new Date(price.effective_date).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      R {price.price?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      R {price.cost_price?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">
                          {price.cost_price ? ((price.price - price.cost_price) / price.price * 100).toFixed(1) : '0'}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        price.is_current ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {price.is_current ? 'Current' : 'Historical'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {price.changed_by || '-'}
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
