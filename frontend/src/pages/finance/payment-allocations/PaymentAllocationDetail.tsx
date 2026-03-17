import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, DollarSign, FileText, Calendar } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import { financeService } from '../../../services/finance.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function PaymentAllocationDetail() {
  const { paymentId, allocationId } = useParams<{ paymentId: string; allocationId: string }>()
  const navigate = useNavigate()

  const { data: payment } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: async () => financeService.getPayment(paymentId!),
  })

  const { data: allocation, isLoading, isError } = useQuery({
    queryKey: ['payment-allocation', paymentId, allocationId],
    queryFn: async () => financeService.getPaymentAllocation(paymentId!, allocationId!),
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


  if (!allocation) {
    return <div className="p-6">Allocation not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/finance/payments/${paymentId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Payment
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Payment Allocation Detail</h1>
        <p className="text-gray-600">{payment?.payment_number} - {payment?.customer_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Allocated Amount</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(allocation.allocated_amount)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Invoice Amount</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(allocation.invoice_amount)}</p>
          <p className="text-sm text-gray-600 mt-1">Balance: {formatCurrency(allocation.invoice_balance)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Allocation Date</h3>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {new Date(allocation.allocation_date).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Invoice Number</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <button
                onClick={() => navigate(`/finance/invoices/${allocation.invoice_id}`)}
                className="text-primary-600 hover:text-primary-900"
              >
                {allocation.invoice_number}
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Invoice Date</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(allocation.invoice_date).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Invoice Amount</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatCurrency(allocation.invoice_amount)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Remaining Balance</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatCurrency(allocation.invoice_balance)}</dd>
          </div>
        </dl>
      </div>

      {allocation.notes && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{allocation.notes}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/finance/invoices/${allocation.invoice_id}`)}
          className="btn-secondary"
        >
          View Invoice
        </button>
        <button
          onClick={() => navigate(`/finance/payments/${paymentId}`)}
          className="btn-secondary"
        >
          View Payment
        </button>
      </div>
    </div>
  )
}
