import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, TrendingUp, TrendingDown } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function StockLedgerDetail() {
  const { productId, entryId } = useParams<{ productId: string; entryId: string }>()
  const navigate = useNavigate()

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const response = await apiClient.get(`/products/${productId}`)
      const result = response.data
      return result.data
    },
  })

  const { data: entry, isLoading, isError } = useQuery({
    queryKey: ['stock-ledger-entry', productId, entryId],
    queryFn: async () => {
      const response = await apiClient.get(`/stock-ledger/${entryId}`)
      const result = response.data
      return result.data
    },
  })

  const oldEntry = {
      id: entryId,
      product_id: productId,
      transaction_type: 'sale',
      transaction_reference: 'ORD-2024-001',
      warehouse_name: 'Main Warehouse',
      quantity_before: 150,
      quantity_change: -10,
      quantity_after: 140,
      unit_cost: 15.00,
      total_value: -150.00,
      transaction_date: '2024-01-20T14:30:00Z',
      created_by: 'System',
      notes: 'Order fulfillment',
    }

  if (isLoading) {
    return <div className="p-6">Loading ledger entry...</div>
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


  if (!entry) {
    return <div className="p-6">Ledger entry not found</div>
  }

  const isIncrease = entry.quantity_change > 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/products/${productId}/stock-ledger`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Stock Ledger
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Stock Ledger Entry</h1>
        <p className="text-gray-600">{product?.name} ({product?.sku})</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Before</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{entry.quantity_before}</p>
          <p className="text-sm text-gray-600 mt-1">units in stock</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            {isIncrease ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            <h3 className="font-semibold text-gray-900">Change</h3>
          </div>
          <p className={`text-3xl font-bold ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
            {entry.quantity_change > 0 ? '+' : ''}{entry.quantity_change}
          </p>
          <p className="text-sm text-gray-600 mt-1 capitalize">{entry.transaction_type}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">After</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{entry.quantity_after}</p>
          <p className="text-sm text-gray-600 mt-1">units in stock</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Transaction Type</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{entry.transaction_type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Reference</dt>
            <dd className="mt-1 text-sm text-gray-900">{entry.transaction_reference}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Warehouse</dt>
            <dd className="mt-1 text-sm text-gray-900">{entry.warehouse_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Transaction Date</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(entry.transaction_date).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Unit Cost</dt>
            <dd className="mt-1 text-sm text-gray-900">${entry.unit_cost.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Value</dt>
            <dd className={`mt-1 text-sm font-medium ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(entry.total_value).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created By</dt>
            <dd className="mt-1 text-sm text-gray-900">{entry.created_by}</dd>
          </div>
        </dl>
      </div>

      {entry.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{entry.notes}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/products/${productId}`)}
          className="btn-secondary"
        >
          View Product
        </button>
        <button
          onClick={() => navigate(`/products/${productId}/stock-ledger`)}
          className="btn-secondary"
        >
          View All Entries
        </button>
      </div>
    </div>
  )
}
