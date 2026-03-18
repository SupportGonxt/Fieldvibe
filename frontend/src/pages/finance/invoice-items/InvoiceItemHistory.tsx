import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import { financeService } from '../../../services/finance.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function InvoiceItemHistory() {
  const { invoiceId, itemId } = useParams<{ invoiceId: string; itemId: string }>()
  const navigate = useNavigate()

  const { data: item } = useQuery({
    queryKey: ['invoice-item', invoiceId, itemId],
    queryFn: async () => financeService.getInvoiceItem(invoiceId!, itemId!),
  })

  const { data: history = [], isLoading, isError } = useQuery({
    queryKey: ['invoice-item-history', invoiceId, itemId],
    queryFn: async () => {
      return []
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


  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/finance/invoices/${invoiceId}/items/${itemId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Item
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Item Change History</h1>
        <p className="text-gray-600">{item?.product_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flow-root">
            <ul className="-mb-8">
              {history?.map((entry, idx) => (
                <li key={entry.id}>
                  <div className="relative pb-8">
                    {idx !== history.length - 1 && (
                      <span
                        className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                        aria-hidden="true"
                      />
                    )}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center ring-8 ring-white">
                          <Clock className="h-4 w-4 text-primary-600" />
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div>
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{entry.action}</span>
                            {entry.field && (
                              <>
                                {' '}field <span className="font-medium">{entry.field}</span>
                              </>
                            )}
                          </p>
                          {entry.old_value && entry.new_value && (
                            <p className="mt-1 text-sm text-gray-500">
                              Changed from <span className="font-medium">{entry.old_value}</span> to{' '}
                              <span className="font-medium">{entry.new_value}</span>
                            </p>
                          )}
                          <p className="mt-1 text-xs text-gray-500">
                            by {entry.changed_by}
                          </p>
                        </div>
                        <div className="whitespace-nowrap text-right text-sm text-gray-500">
                          {new Date(entry.changed_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
