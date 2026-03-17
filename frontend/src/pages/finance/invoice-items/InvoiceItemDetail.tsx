import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, DollarSign, TrendingUp } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import { financeService } from '../../../services/finance.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function InvoiceItemDetail() {
  const { invoiceId, itemId } = useParams<{ invoiceId: string; itemId: string }>()
  const navigate = useNavigate()

  const { data: invoice } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => financeService.getInvoice(invoiceId!),
  })

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['invoice-item', invoiceId, itemId],
    queryFn: async () => financeService.getInvoiceItem(invoiceId!, itemId!),
  })

  if (isLoading) {
    return <div className="p-6">Loading invoice item...</div>
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


  if (!item) {
    return <div className="p-6">Invoice item not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/finance/invoices/${invoiceId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Invoice
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Invoice Item Detail</h1>
        <p className="text-gray-600">{invoice?.invoice_number} - {invoice?.customer_name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Quantity</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{item.quantity}</p>
          <p className="text-sm text-gray-600 mt-1">{item.product_sku}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Unit Price</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(item.unit_price)}</p>
          {item.discount_percent > 0 && (
            <p className="text-sm text-gray-600 mt-1">{item.discount_percent}% discount</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Line Total</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(item.total)}</p>
          <p className="text-sm text-gray-600 mt-1">Incl. tax: {formatCurrency(item.tax_amount)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing & Tax Breakdown</h2>
        <dl className="space-y-3">
          <div className="flex justify-between">
            <dt className="text-sm text-gray-600">Subtotal ({item.quantity} × {formatCurrency(item.unit_price)})</dt>
            <dd className="text-sm font-medium text-gray-900">{formatCurrency(item.line_total)}</dd>
          </div>
          {item.discount_amount > 0 && (
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Discount ({item.discount_percent}%)</dt>
              <dd className="text-sm font-medium text-red-600">-{formatCurrency(item.discount_amount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-sm text-gray-600">Subtotal after discount</dt>
            <dd className="text-sm font-medium text-gray-900">{formatCurrency(item.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-gray-600">Tax ({item.tax_rate}% - {item.tax_code})</dt>
            <dd className="text-sm font-medium text-gray-900">{formatCurrency(item.tax_amount)}</dd>
          </div>
          <div className="flex justify-between pt-3 border-t">
            <dt className="text-base font-semibold text-gray-900">Total</dt>
            <dd className="text-base font-bold text-gray-900">{formatCurrency(item.total)}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Accounting Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">GL Account</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.gl_account}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Cost Center</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.cost_center}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Tax Code</dt>
            <dd className="mt-1 text-sm text-gray-900">{item.tax_code}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/products/${item.product_id}`)}
          className="btn-secondary"
        >
          View Product
        </button>
        <button
          onClick={() => navigate(`/finance/invoices/${invoiceId}`)}
          className="btn-secondary"
        >
          View Invoice
        </button>
      </div>
    </div>
  )
}
