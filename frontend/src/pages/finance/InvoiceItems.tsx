import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import { financeService } from '../../services/finance.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function InvoiceItems() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: invoice } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => financeService.getInvoice(id!),
  })

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ['invoice-items', id],
    queryFn: () => financeService.getInvoiceItemsList(id!),
  })

  const subtotal = items?.reduce((sum, item) => sum + item.total, 0) || 0

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


  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/finance/invoices/${id}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Invoice
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Invoice Items</h1>
        <p className="text-gray-600">{invoice?.invoice_number} - {invoice?.customer_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items?.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{item.product_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.quantity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface-secondary">
            <tr>
              <td colSpan={3} className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                Subtotal:
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                {formatCurrency(subtotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
