import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, MapPin, User, Clock, FileText } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function MovementDetail() {
  const { movementId } = useParams<{ movementId: string }>()
  const navigate = useNavigate()

  const { data: movement, isLoading, isError } = useQuery({
    queryKey: ['stock-movement', movementId],
    queryFn: async () => {
      const response = await apiClient.get(`/stock-movements/${movementId}`)
      const result = response.data
      return result.data
    },
  })

  const oldMovement = {
      id: movementId,
      movement_number: 'MOV-2024-001',
      product_name: 'Coca-Cola 500ml',
      product_sku: 'CC-500',
      product_id: 'prod-1',
      transaction_type: 'sale',
      transaction_reference: 'ORD-2024-001',
      from_location: 'Main Warehouse - Aisle 3, Shelf B',
      to_location: 'Customer Delivery',
      quantity: 10,
      unit_cost: 15.00,
      total_value: 150.00,
      movement_date: '2024-01-20T14:30:00Z',
      performed_by: 'John Picker',
      performed_by_role: 'Warehouse Staff',
      approved_by: 'Jane Manager',
      approved_at: '2024-01-20T14:25:00Z',
      notes: 'Order fulfillment for customer ABC Store',
      related_documents: [
        {
          type: 'order',
          reference: 'ORD-2024-001',
          url: '/orders/ord-1',
        },
        {
          type: 'invoice',
          reference: 'INV-2024-001',
          url: '/finance/invoices/inv-1',
        },
      ],
    }

  if (isLoading) {
    return <div className="p-6">Loading movement details...</div>
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


  if (!movement) {
    return <div className="p-6">Movement not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/inventory/stock-ledger')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Stock Ledger
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Stock Movement Detail</h1>
        <p className="text-gray-600">{movement.movement_number}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Product</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">{movement.product_name}</p>
          <p className="text-sm text-gray-600 mt-1">{movement.product_sku}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Quantity</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{movement.quantity}</p>
          <p className="text-sm text-gray-600 mt-1">units moved</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Value</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">${movement.total_value.toFixed(2)}</p>
          <p className="text-sm text-gray-600 mt-1">@ ${movement.unit_cost.toFixed(2)}/unit</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Movement Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Transaction Type</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{movement.transaction_type}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Reference</dt>
            <dd className="mt-1 text-sm text-gray-900">{movement.transaction_reference}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">From Location</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-start gap-1">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
              {movement.from_location}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">To Location</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-start gap-1">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
              {movement.to_location}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Movement Date</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Clock className="h-4 w-4 text-gray-400" />
              {new Date(movement.movement_date).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Personnel</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Performed By</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-start gap-2">
              <User className="h-4 w-4 text-gray-400 mt-0.5" />
              <div>
                <div>{movement.performed_by}</div>
                <div className="text-xs text-gray-500">{movement.performed_by_role}</div>
              </div>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Approved By</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-start gap-2">
              <User className="h-4 w-4 text-gray-400 mt-0.5" />
              <div>
                <div>{movement.approved_by}</div>
                <div className="text-xs text-gray-500">
                  {new Date(movement.approved_at).toLocaleString()}
                </div>
              </div>
            </dd>
          </div>
        </dl>
      </div>

      {movement.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{movement.notes}</p>
        </div>
      )}

      {movement.related_documents && movement.related_documents.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Documents</h2>
          <div className="space-y-2">
            {movement.related_documents.map((doc, idx) => (
              <button
                key={idx}
                onClick={() => navigate(doc.url)}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-surface-secondary w-full text-left"
              >
                <FileText className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">{doc.type}</p>
                  <p className="text-xs text-gray-500">{doc.reference}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
