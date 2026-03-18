import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, TrendingUp, AlertTriangle } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function CountLineDetail() {
  const { countId, lineId } = useParams<{ countId: string; lineId: string }>()
  const navigate = useNavigate()

  const { data: count } = useQuery({
    queryKey: ['stock-count', countId],
    queryFn: async () => {
      const response = await fetch(`/api/stock-counts/${countId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: line, isLoading, isError } = useQuery({
    queryKey: ['count-line', countId, lineId],
    queryFn: async () => {
      const response = await fetch(`/api/stock-counts/${countId}/lines/${lineId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldLine = {
      id: lineId,
      count_id: countId,
      product_id: 'prod-1',
      product_name: 'Coca-Cola 500ml',
      product_sku: 'CC-500',
      expected_quantity: 100,
      counted_quantity: 95,
      variance: -5,
      variance_percent: -5.0,
      variance_value: -75.00,
      unit_cost: 15.00,
      counted_by: 'John Counter',
      counted_at: '2024-01-20T14:30:00Z',
      status: 'variance_pending',
      notes: 'Found 5 damaged units',
      location: 'Aisle 3, Shelf B',
    }

  if (isLoading) {
    return <div className="p-6">Loading count line...</div>
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


  if (!line) {
    return <div className="p-6">Count line not found</div>
  }

  const hasVariance = line.variance !== 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/inventory/stock-counts/${countId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Stock Count
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Count Line Detail</h1>
        <p className="text-gray-600">{count?.count_number} - {count?.warehouse_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Expected</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{line.expected_quantity}</p>
          <p className="text-sm text-gray-600 mt-1">{line.product_sku}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Counted</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{line.counted_quantity}</p>
          <p className="text-sm text-gray-600 mt-1">
            {new Date(line.counted_at).toLocaleDateString()}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className={`h-5 w-5 ${hasVariance ? 'text-red-600' : 'text-green-600'}`} />
            <h3 className="font-semibold text-gray-900">Variance</h3>
          </div>
          <p className={`text-3xl font-bold ${hasVariance ? 'text-red-600' : 'text-green-600'}`}>
            {line.variance > 0 ? '+' : ''}{line.variance}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {line.variance_percent > 0 ? '+' : ''}{line.variance_percent.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Product Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{line.product_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">SKU</dt>
            <dd className="mt-1 text-sm text-gray-900">{line.product_sku}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Location</dt>
            <dd className="mt-1 text-sm text-gray-900">{line.location}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Unit Cost</dt>
            <dd className="mt-1 text-sm text-gray-900">${line.unit_cost.toFixed(2)}</dd>
          </div>
        </dl>
      </div>

      {hasVariance && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-red-900 mb-4">Variance Details</h2>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <dt className="text-sm font-medium text-red-700">Quantity Variance</dt>
              <dd className="mt-1 text-sm text-red-900 font-bold">
                {line.variance > 0 ? '+' : ''}{line.variance} units
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-red-700">Percentage Variance</dt>
              <dd className="mt-1 text-sm text-red-900 font-bold">
                {line.variance_percent > 0 ? '+' : ''}{line.variance_percent.toFixed(2)}%
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-red-700">Value Variance</dt>
              <dd className="mt-1 text-sm text-red-900 font-bold">
                ${line.variance_value.toFixed(2)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Count Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Counted By</dt>
            <dd className="mt-1 text-sm text-gray-900">{line.counted_by}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Counted At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(line.counted_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                line.status === 'approved' ? 'bg-green-100 text-green-800' :
                line.status === 'variance_pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {line.status.replace('_', ' ')}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {line.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{line.notes}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/products/${line.product_id}`)}
          className="btn-secondary"
        >
          View Product
        </button>
        {hasVariance && line.status === 'variance_pending' && (
          <button
            onClick={() => navigate(`/inventory/stock-counts/${countId}/lines/${lineId}/resolve`)}
            className="btn-primary"
          >
            Resolve Variance
          </button>
        )}
        <button
          onClick={() => navigate(`/inventory/stock-counts/${countId}/lines/${lineId}/edit`)}
          className="btn-secondary"
        >
          Edit
        </button>
      </div>
    </div>
  )
}
