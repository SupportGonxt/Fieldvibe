import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, Calendar, AlertTriangle, CheckCircle } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function BatchDetail() {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()

  const { data: batch, isLoading, isError } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/batches/${batchId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldBatch = {
      id: batchId,
      batch_number: 'BATCH-2024-001',
      product_id: 'prod-1',
      product_name: 'Coca-Cola 500ml',
      product_sku: 'CC-500',
      manufacture_date: '2024-01-01',
      expiry_date: '2024-12-31',
      initial_quantity: 1000,
      current_quantity: 750,
      allocated_quantity: 100,
      available_quantity: 650,
      warehouse_name: 'Main Warehouse',
      status: 'active',
      supplier: 'Coca-Cola Bottling Co.',
      lot_number: 'LOT-2024-A-001',
      quality_status: 'passed',
      quality_checked_by: 'Jane QC',
      quality_checked_at: '2024-01-02T10:00:00Z',
      notes: 'Standard batch, all quality checks passed',
    }

  if (isLoading) {
    return <div className="p-6">Loading batch details...</div>
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


  if (!batch) {
    return <div className="p-6">Batch not found</div>
  }

  const daysUntilExpiry = Math.floor(
    (new Date(batch.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )
  const isExpiringSoon = daysUntilExpiry < 30 && daysUntilExpiry > 0
  const isExpired = daysUntilExpiry < 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/inventory/batches')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Batches
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Batch Detail</h1>
        <p className="text-gray-600">{batch.batch_number}</p>
      </div>

      {(isExpiringSoon || isExpired) && (
        <div className={`border rounded-lg p-4 mb-6 ${
          isExpired ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${isExpired ? 'text-red-600' : 'text-yellow-600'}`} />
            <p className={`font-medium ${isExpired ? 'text-red-900' : 'text-yellow-900'}`}>
              {isExpired 
                ? `This batch expired ${Math.abs(daysUntilExpiry)} days ago`
                : `This batch expires in ${daysUntilExpiry} days`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Initial</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{batch.initial_quantity}</p>
          <p className="text-sm text-gray-600 mt-1">units</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Current</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{batch.current_quantity}</p>
          <p className="text-sm text-gray-600 mt-1">units</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Allocated</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{batch.allocated_quantity}</p>
          <p className="text-sm text-gray-600 mt-1">units</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Available</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{batch.available_quantity}</p>
          <p className="text-sm text-gray-600 mt-1">units</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Batch Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Product</dt>
            <dd className="mt-1 text-sm text-gray-900">{batch.product_name} ({batch.product_sku})</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Warehouse</dt>
            <dd className="mt-1 text-sm text-gray-900">{batch.warehouse_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Lot Number</dt>
            <dd className="mt-1 text-sm text-gray-900">{batch.lot_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Supplier</dt>
            <dd className="mt-1 text-sm text-gray-900">{batch.supplier}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Manufacture Date</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Calendar className="h-4 w-4 text-gray-400" />
              {new Date(batch.manufacture_date).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Expiry Date</dt>
            <dd className={`mt-1 text-sm flex items-center gap-1 ${
              isExpired ? 'text-red-600 font-medium' : 
              isExpiringSoon ? 'text-yellow-600 font-medium' : 
              'text-gray-900'
            }`}>
              <Calendar className="h-4 w-4" />
              {new Date(batch.expiry_date).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                batch.status === 'active' ? 'bg-green-100 text-green-800' :
                batch.status === 'expired' ? 'bg-red-100 text-red-800' :
                batch.status === 'quarantine' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {batch.status}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Quality Status</dt>
            <dd className="mt-1 flex items-center gap-1">
              {batch.quality_status === 'passed' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${
                batch.quality_status === 'passed' ? 'text-green-600' : 'text-red-600'
              }`}>
                {batch.quality_status}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quality Check</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Checked By</dt>
            <dd className="mt-1 text-sm text-gray-900">{batch.quality_checked_by}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Checked At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(batch.quality_checked_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      {batch.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{batch.notes}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/products/${batch.product_id}`)}
          className="btn-secondary"
        >
          View Product
        </button>
        <button
          onClick={() => navigate(`/inventory/batches/${batchId}/movement-history`)}
          className="btn-secondary"
        >
          Movement History
        </button>
        <button
          onClick={() => navigate(`/inventory/batches/${batchId}/allocations`)}
          className="btn-secondary"
        >
          View Allocations
        </button>
      </div>
    </div>
  )
}
