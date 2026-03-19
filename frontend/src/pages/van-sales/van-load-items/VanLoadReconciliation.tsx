import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, AlertTriangle, Package } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function VanLoadReconciliation() {
  const { loadId } = useParams<{ loadId: string }>()
  const navigate = useNavigate()

  const { data: load } = useQuery({
    queryKey: ['van-load', loadId],
    queryFn: async () => {
      const response = await apiClient.get(`/van-loads/${loadId}`)
      const result = response.data
      return result.data
    },
  })

  const { data: reconciliation, isLoading, isError } = useQuery({
    queryKey: ['van-load-reconciliation', loadId],
    queryFn: async () => {
      const response = await apiClient.get(`/van-loads/${loadId}/reconciliation`)
      const result = response.data
      return result.data
    },
  })

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner size="md" /></div>
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


  if (!reconciliation) {
    return <div className="p-6">Reconciliation not found</div>
  }

  const isBalanced = reconciliation.variance === 0 && reconciliation.cash_variance === 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/van-sales/loads/${loadId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Van Load
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Van Load Reconciliation</h1>
        <p className="text-gray-600">{load?.load_number} - {load?.agent_name}</p>
      </div>

      <div className={`border rounded-lg p-6 mb-6 ${
        isBalanced ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center gap-3">
          {isBalanced ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          )}
          <div>
            <h2 className={`text-xl font-bold ${
              isBalanced ? 'text-green-900' : 'text-yellow-900'
            }`}>
              {isBalanced ? 'Load Balanced' : 'Variance Detected'}
            </h2>
            <p className={`text-sm ${
              isBalanced ? 'text-green-700' : 'text-yellow-700'
            }`}>
              {isBalanced 
                ? 'All items and cash reconciled successfully'
                : 'Please review variances below'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Loaded</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{reconciliation.total_items_loaded}</p>
          <p className="text-sm text-gray-600 mt-1">items</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Sold</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{reconciliation.total_items_sold}</p>
          <p className="text-sm text-gray-600 mt-1">items</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Returned</h3>
          </div>
          <p className="text-3xl font-bold text-orange-600">{reconciliation.total_items_returned}</p>
          <p className="text-sm text-gray-600 mt-1">items</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Remaining</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{reconciliation.total_items_remaining}</p>
          <p className="text-sm text-gray-600 mt-1">
            {reconciliation.variance !== 0 && (
              <span className="text-red-600 font-medium">
                Variance: {reconciliation.variance}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Reconciliation</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Loaded Value</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900">
              {formatCurrency(reconciliation.total_loaded_value)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Sold Value</dt>
            <dd className="mt-1 text-lg font-bold text-green-600">
              {formatCurrency(reconciliation.total_sold_value)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Cash Collected</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900">
              {formatCurrency(reconciliation.total_cash_collected)}
            </dd>
          </div>
        </dl>
        {reconciliation.cash_variance !== 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm font-medium text-yellow-900">
              Cash Variance: {formatCurrency(Math.abs(reconciliation.cash_variance))}
              {reconciliation.cash_variance > 0 ? ' (Over)' : ' (Short)'}
            </p>
          </div>
        )}
      </div>

      {reconciliation.items_with_variance && reconciliation.items_with_variance.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Items with Variance</h2>
          <div className="space-y-3">
            {reconciliation.items_with_variance.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                  <p className="text-xs text-gray-500">{item.product_sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-red-600">
                    Variance: {item.variance} units
                  </p>
                  <p className="text-xs text-gray-500">
                    Expected: {item.expected}, Actual: {item.actual}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reconciliation Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Reconciled By</dt>
            <dd className="mt-1 text-sm text-gray-900">{reconciliation.reconciled_by}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Reconciled At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(reconciliation.reconciled_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                reconciliation.reconciliation_status === 'balanced' ? 'bg-green-100 text-green-800' :
                reconciliation.reconciliation_status === 'variance' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {reconciliation.reconciliation_status}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
