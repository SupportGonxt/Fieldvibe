import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Hash, Package, MapPin, User, Clock } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function SerialDetail() {
  const { serialId } = useParams<{ serialId: string }>()
  const navigate = useNavigate()

  const { data: serial, isLoading, isError } = useQuery({
    queryKey: ['serial', serialId],
    queryFn: async () => {
      const response = await apiClient.get(`/serials/${serialId}`)
      const result = response.data
      return result.data
    },
  })

  const oldSerial = {
      id: serialId,
      serial_number: 'SN-2024-001-00001',
      product_id: 'prod-1',
      product_name: 'Premium Coffee Machine',
      product_sku: 'PCM-001',
      batch_id: 'batch-1',
      batch_number: 'BATCH-2024-001',
      status: 'sold',
      current_location: 'Customer - ABC Store',
      warehouse_name: 'Main Warehouse',
      manufacture_date: '2024-01-15',
      warranty_start: '2024-01-20',
      warranty_end: '2025-01-20',
      sold_to_customer: 'ABC Store',
      sold_date: '2024-01-20',
      sold_order: 'ORD-2024-001',
      sold_invoice: 'INV-2024-001',
      notes: 'Premium model with extended warranty',
    }

  if (isLoading) {
    return <div className="p-6">Loading serial details...</div>
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


  if (!serial) {
    return <div className="p-6">Serial not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/inventory/serials')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Serials
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Serial Number Detail</h1>
        <p className="text-gray-600">{serial.serial_number}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Product</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">{serial.product_name}</p>
          <p className="text-sm text-gray-600 mt-1">{serial.product_sku}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Location</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">{serial.current_location}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Hash className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Status</h3>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
            serial.status === 'sold' ? 'bg-green-100 text-green-800' :
            serial.status === 'in_stock' ? 'bg-blue-100 text-blue-800' :
            serial.status === 'returned' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {serial.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Serial Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Serial Number</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{serial.serial_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Batch Number</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <button
                onClick={() => navigate(`/inventory/batches/${serial.batch_id}`)}
                className="text-primary-600 hover:text-primary-900"
              >
                {serial.batch_number}
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Manufacture Date</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Clock className="h-4 w-4 text-gray-400" />
              {new Date(serial.manufacture_date).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Original Warehouse</dt>
            <dd className="mt-1 text-sm text-gray-900">{serial.warehouse_name}</dd>
          </div>
        </dl>
      </div>

      {serial.status === 'sold' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-green-900 mb-4">Sale Information</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-green-700">Customer</dt>
              <dd className="mt-1 text-sm text-green-900 flex items-center gap-1">
                <User className="h-4 w-4" />
                {serial.sold_to_customer}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-green-700">Sale Date</dt>
              <dd className="mt-1 text-sm text-green-900 flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {new Date(serial.sold_date).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-green-700">Order</dt>
              <dd className="mt-1 text-sm text-green-900">
                <button
                  onClick={() => navigate(`/orders/${serial.sold_order}`)}
                  className="text-green-700 hover:text-green-900 underline"
                >
                  {serial.sold_order}
                </button>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-green-700">Invoice</dt>
              <dd className="mt-1 text-sm text-green-900">
                <button
                  onClick={() => navigate(`/finance/invoices/${serial.sold_invoice}`)}
                  className="text-green-700 hover:text-green-900 underline"
                >
                  {serial.sold_invoice}
                </button>
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Warranty Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Warranty Start</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(serial.warranty_start).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Warranty End</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(serial.warranty_end).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>

      {serial.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{serial.notes}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/products/${serial.product_id}`)}
          className="btn-secondary"
        >
          View Product
        </button>
        <button
          onClick={() => navigate(`/inventory/serials/${serialId}/tracking`)}
          className="btn-secondary"
        >
          View Tracking History
        </button>
      </div>
    </div>
  )
}
