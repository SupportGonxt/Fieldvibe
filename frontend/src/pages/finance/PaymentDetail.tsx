import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Edit, DollarSign, CreditCard, Calendar } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import { financeService } from '../../services/finance.service'
import ErrorState from '../../components/ui/ErrorState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: payment, isLoading, isError } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => financeService.getPayment(id!),
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


  if (!payment) {
    return <div className="p-6">Payment not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/finance/payments')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Payments
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{payment.payment_number}</h1>
            <p className="text-gray-600">Customer ID: {payment.customer_id}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/finance/payments/${id}/edit`)}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit className="h-5 w-5" />
              Edit
            </button>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              payment.status === 'completed' ? 'bg-green-100 text-green-800' : 
              payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
              'bg-red-100 text-red-800'
            }`}>
              {payment.status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Payment Amount</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(payment.amount)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Payment Date</h3>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {new Date(payment.payment_date).toLocaleDateString()}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Payment Method</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">{payment.payment_method}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Payment Number</dt>
            <dd className="mt-1 text-sm text-gray-900">{payment.payment_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Invoice ID</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {payment.invoice_id ? (
                <button
                  onClick={() => navigate(`/finance/invoices/${payment.invoice_id}`)}
                  className="text-primary-600 hover:text-primary-900"
                >
                  {payment.invoice_id}
                </button>
              ) : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Customer ID</dt>
            <dd className="mt-1 text-sm text-gray-900">{payment.customer_id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Reference Number</dt>
            <dd className="mt-1 text-sm text-gray-900">{payment.reference_number}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Notes</dt>
            <dd className="mt-1 text-sm text-gray-900">{payment.notes || '-'}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
