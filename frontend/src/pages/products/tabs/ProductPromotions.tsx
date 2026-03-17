import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Tag, Calendar } from 'lucide-react'
import { promotionsService as promotionService } from '../../../services/promotions.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function ProductPromotions() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: promotions = [], isLoading, isError } = useQuery({
    queryKey: ['product-promotions', id],
    queryFn: () => promotionService.getProductPromotions(id!),
  })

  const activePromotions = promotions.filter((p: any) => p.status === 'active')

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Product Promotions</h2>
          <p className="text-sm text-gray-600">{activePromotions.length} active promotion(s)</p>
        </div>
        <button
          onClick={() => navigate(`/marketing/promotions/create?product_id=${id}`)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Promotion
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500"><LoadingSpinner size="md" /></div>
        ) : promotions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Tag className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No promotions found for this product.</p>
            <button
              onClick={() => navigate(`/marketing/promotions/create?product_id=${id}`)}
              className="mt-4 btn-primary"
            >
              Create First Promotion
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Promotion Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Discount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    End Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {promotions.map((promo: any) => (
                  <tr key={promo.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{promo.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        {promo.type || 'discount'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `R ${promo.discount_value}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {new Date(promo.start_date).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(promo.end_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        promo.status === 'active' ? 'bg-green-100 text-green-800' :
                        promo.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        promo.status === 'expired' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {promo.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => navigate(`/marketing/promotions/${promo.id}`)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        View
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
