import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, Factory, Calendar, CheckCircle } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function LotDetail() {
  const { lotId } = useParams<{ lotId: string }>()
  const navigate = useNavigate()

  const { data: lot, isLoading, isError } = useQuery({
    queryKey: ['lot', lotId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/lots/${lotId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldLot = {
      id: lotId,
      lot_number: 'LOT-2024-A-001',
      product_id: 'prod-1',
      product_name: 'Coca-Cola 500ml',
      product_sku: 'CC-500',
      manufacture_date: '2024-01-01',
      manufacture_location: 'Factory A - Line 3',
      supplier: 'Coca-Cola Bottling Co.',
      supplier_lot_number: 'SUP-LOT-2024-001',
      total_quantity: 5000,
      batches_count: 5,
      quality_status: 'passed',
      quality_certificate: 'QC-2024-001.pdf',
      quality_checked_by: 'Jane QC Manager',
      quality_checked_at: '2024-01-02T10:00:00Z',
      certifications: ['ISO 9001', 'HACCP', 'FDA Approved'],
      test_results: [
        {
          test_name: 'pH Level',
          result: '2.5',
          standard: '2.4-2.6',
          status: 'passed',
        },
        {
          test_name: 'Sugar Content',
          result: '10.8g/100ml',
          standard: '10.6-11.0g/100ml',
          status: 'passed',
        },
        {
          test_name: 'Carbonation',
          result: '3.8 volumes',
          standard: '3.7-4.0 volumes',
          status: 'passed',
        },
      ],
      notes: 'Standard production lot, all quality checks passed',
    }

  const { data: batches } = useQuery({
    queryKey: ['lot-batches', lotId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/lots/${lotId}/batches`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  const oldBatches = [
      {
        id: 'batch-1',
        batch_number: 'BATCH-2024-001',
        warehouse_name: 'Main Warehouse',
        quantity: 1000,
        status: 'active',
      },
      {
        id: 'batch-2',
        batch_number: 'BATCH-2024-002',
        warehouse_name: 'Branch Warehouse',
        quantity: 1000,
        status: 'active',
      },
      {
        id: 'batch-3',
        batch_number: 'BATCH-2024-003',
        warehouse_name: 'Main Warehouse',
        quantity: 1000,
        status: 'active',
      },
      {
        id: 'batch-4',
        batch_number: 'BATCH-2024-004',
        warehouse_name: 'Regional Warehouse',
        quantity: 1000,
        status: 'active',
      },
      {
        id: 'batch-5',
        batch_number: 'BATCH-2024-005',
        warehouse_name: 'Main Warehouse',
        quantity: 1000,
        status: 'active',
      },
    ]

  if (isLoading) {
    return <div className="p-6">Loading lot details...</div>
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


  if (!lot) {
    return <div className="p-6">Lot not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/inventory/lots')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Lots
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Lot Detail</h1>
        <p className="text-gray-600">{lot.lot_number}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Product</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">{lot.product_name}</p>
          <p className="text-sm text-gray-600 mt-1">{lot.product_sku}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Total Quantity</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{lot.total_quantity.toLocaleString()}</p>
          <p className="text-sm text-gray-600 mt-1">units produced</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Batches</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{lot.batches_count}</p>
          <p className="text-sm text-gray-600 mt-1">batches created</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Lot Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Lot Number</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{lot.lot_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Supplier Lot Number</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{lot.supplier_lot_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Supplier</dt>
            <dd className="mt-1 text-sm text-gray-900">{lot.supplier}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Manufacture Date</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Calendar className="h-4 w-4 text-gray-400" />
              {new Date(lot.manufacture_date).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Manufacture Location</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Factory className="h-4 w-4 text-gray-400" />
              {lot.manufacture_location}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Quality Status</dt>
            <dd className="mt-1 flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">
                {lot.quality_status}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-green-900 mb-4">Quality Assurance</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <dt className="text-sm font-medium text-green-700">Checked By</dt>
            <dd className="mt-1 text-sm text-green-900">{lot.quality_checked_by}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-green-700">Checked At</dt>
            <dd className="mt-1 text-sm text-green-900">
              {new Date(lot.quality_checked_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-green-700">Certificate</dt>
            <dd className="mt-1 text-sm text-green-900">{lot.quality_certificate}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-green-700">Certifications</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {lot.certifications.map((cert, idx) => (
                <span key={idx} className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  {cert}
                </span>
              ))}
            </dd>
          </div>
        </dl>

        <div className="mt-4 pt-4 border-t border-green-200">
          <h3 className="text-sm font-medium text-green-900 mb-3">Test Results</h3>
          <div className="space-y-2">
            {lot.test_results.map((test, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-white rounded">
                <div>
                  <p className="text-sm font-medium text-gray-900">{test.test_name}</p>
                  <p className="text-xs text-gray-600">Standard: {test.standard}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{test.result}</p>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    {test.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Batches in this Lot</h2>
        <div className="space-y-2">
          {batches?.map((batch) => (
            <button
              key={batch.id}
              onClick={() => navigate(`/inventory/batches/${batch.id}`)}
              className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-surface-secondary"
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{batch.batch_number}</p>
                  <p className="text-xs text-gray-500">{batch.warehouse_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{batch.quantity} units</p>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    {batch.status}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {lot.notes && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{lot.notes}</p>
        </div>
      )}
    </div>
  )
}
