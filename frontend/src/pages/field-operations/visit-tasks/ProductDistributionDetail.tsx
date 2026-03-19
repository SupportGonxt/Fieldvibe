import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, CheckCircle } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function ProductDistributionDetail() {
  const { visitId, distributionId } = useParams<{ visitId: string; distributionId: string }>()
  const navigate = useNavigate()

  const { data: distribution, isLoading, isError } = useQuery({
    queryKey: ['product-distribution', visitId, distributionId],
    queryFn: async () => {
      const response = await apiClient.get(`/visits/${visitId}/product-distributions/${distributionId}`)
      const result = response.data
      return result.data
    },
  })

  const oldDistribution = {
      id: distributionId,
      visit_id: visitId,
      distribution_type: 'samples',
      brand_name: 'Coca-Cola',
      products_distributed: [
        {
          product_name: 'Coca-Cola 330ml Can',
          quantity: 24,
          unit_value: 1.50,
          total_value: 36.00,
        },
        {
          product_name: 'Sprite 330ml Can',
          quantity: 12,
          unit_value: 1.50,
          total_value: 18.00,
        },
      ],
      total_quantity: 36,
      total_value: 54.00,
      distributed_at: '2024-01-20T09:50:00Z',
      distributed_by: 'John Field Agent',
      recipient_name: 'Store Manager',
      recipient_signature: true,
      photos_taken: 2,
      notes: 'Samples well received, store manager interested in ordering',
    }

  if (isLoading) {
    return <div className="p-6">Loading distribution details...</div>
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


  if (!distribution) {
    return <div className="p-6">Distribution not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/field-operations/visits/${visitId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Visit
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Product Distribution Detail</h1>
        <p className="text-gray-600">{distribution.brand_name} - {distribution.distribution_type}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Total Quantity</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{distribution.total_quantity}</p>
          <p className="text-sm text-gray-600 mt-1">units</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Total Value</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">${distribution.total_value.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Signature</h3>
          </div>
          {distribution.recipient_signature ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : (
            <span className="text-sm text-gray-500">Not captured</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Products Distributed</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {distribution.products_distributed.map((product, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {product.product_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    {product.quantity}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    ${product.unit_value.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                    ${product.total_value.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribution Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Distribution Type</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{distribution.distribution_type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Brand</dt>
            <dd className="mt-1 text-sm text-gray-900">{distribution.brand_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Distributed At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(distribution.distributed_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Distributed By</dt>
            <dd className="mt-1 text-sm text-gray-900">{distribution.distributed_by}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Recipient</dt>
            <dd className="mt-1 text-sm text-gray-900">{distribution.recipient_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Photos Taken</dt>
            <dd className="mt-1 text-sm text-gray-900">{distribution.photos_taken}</dd>
          </div>
        </dl>
      </div>

      {distribution.notes && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{distribution.notes}</p>
        </div>
      )}
    </div>
  )
}
