import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, DollarSign, User, Clock } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'

export default function CollectionDetail() {
  const { sessionId, collectionId } = useParams<{ sessionId: string; collectionId: string }>()
  const navigate = useNavigate()

  const { data: session } = useQuery({
    queryKey: ['cash-session', sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/cash-sessions/${sessionId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { data: collection, isLoading } = useQuery({
    queryKey: ['collection', sessionId, collectionId],
    queryFn: async () => {
      const response = await fetch(`/api/cash-sessions/${sessionId}/collections/${collectionId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const _oldCollection = {
      id: collectionId,
      session_id: sessionId,
      customer_id: 'cust-1',
      customer_name: 'ABC Store',
      invoice_number: 'INV-2024-001',
      invoice_amount: 250.00,
      amount_collected: 250.00,
      payment_method: 'cash',
      collection_time: '2024-01-20T09:35:00Z',
      collected_by: 'John Van Sales',
      reference_number: 'REF-001',
      notes: 'Full payment received',
    }

  if (isLoading) {
    return <div className="p-6">Loading collection details...</div>
  }

  if (!collection) {
    return <div className="p-6">Collection not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/van-sales/cash-sessions/${sessionId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Cash Session
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Collection Detail</h1>
        <p className="text-gray-600">{session?.session_number} - {session?.agent_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Invoice Amount</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(collection.invoice_amount)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Amount Collected</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(collection.amount_collected)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Outstanding</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(collection.invoice_amount - collection.amount_collected)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Collection Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Customer</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <User className="h-4 w-4 text-gray-400" />
              {collection.customer_name}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Invoice Number</dt>
            <dd className="mt-1 text-sm text-gray-900">{collection.invoice_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{collection.payment_method}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Reference Number</dt>
            <dd className="mt-1 text-sm text-gray-900">{collection.reference_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Collection Time</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Clock className="h-4 w-4 text-gray-400" />
              {new Date(collection.collection_time).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Collected By</dt>
            <dd className="mt-1 text-sm text-gray-900">{collection.collected_by}</dd>
          </div>
        </dl>
      </div>

      {collection.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{collection.notes}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/customers/${collection.customer_id}`)}
          className="btn-secondary"
        >
          View Customer
        </button>
        <button
          onClick={() => navigate(`/finance/invoices/${collection.invoice_number}`)}
          className="btn-secondary"
        >
          View Invoice
        </button>
      </div>
    </div>
  )
}
