import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { financeService } from '../../../services/finance.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

interface InvoiceItemFormData {
  quantity: number
  unit_price: number
  discount_percent: number
  notes: string
}

export default function InvoiceItemEdit() {
  const { invoiceId, itemId } = useParams<{ invoiceId: string; itemId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['invoice-item', invoiceId, itemId],
    queryFn: async () => financeService.getInvoiceItem(invoiceId!, itemId!),
  })

  const { register, handleSubmit, formState: { errors } } = useForm<InvoiceItemFormData>({
    values: item,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: InvoiceItemFormData) => {
      return financeService.updateInvoiceItem(invoiceId!, itemId!, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-item', invoiceId, itemId] })
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      toast.success('Invoice item updated successfully')
      navigate(`/finance/invoices/${invoiceId}/items/${itemId}`)
    },
    onError: () => {
      toast.error('Failed to update invoice item')
    },
  })

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner size="sm" /></div>
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
          onClick={() => navigate(`/finance/invoices/${invoiceId}/items/${itemId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Item
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Invoice Item</h1>
        <p className="text-gray-600">{item.product_name}</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity *
            </label>
            <input
              type="number"
              {...register('quantity', { required: 'Quantity is required', min: 1 })}
              className="input"
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit Price *
            </label>
            <input
              type="number"
              step="0.01"
              {...register('unit_price', { required: 'Unit price is required', min: 0 })}
              className="input"
            />
            {errors.unit_price && (
              <p className="mt-1 text-sm text-red-600">{errors.unit_price.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Discount %
            </label>
            <input
              type="number"
              step="0.01"
              {...register('discount_percent', { min: 0, max: 100 })}
              className="input"
            />
            {errors.discount_percent && (
              <p className="mt-1 text-sm text-red-600">{errors.discount_percent.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="input"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primary"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/finance/invoices/${invoiceId}/items/${itemId}`)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
