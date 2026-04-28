import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import DocumentActions from '../../../components/export/DocumentActions'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import type { DocumentData } from '../../../utils/pdf/document-generator'

const STATUS_COLOR: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  draft: 'gray',
  CONFIRMED: 'yellow',
  PROCESSING: 'yellow',
  COMPLETED: 'green',
  CANCELLED: 'gray',
}

export default function InvoiceDetail() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadInvoice() }, [id])

  const loadInvoice = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await salesService.getInvoice(String(id))
      setInvoice(response.data?.data || response.data)
    } catch (err: any) {
      console.error('Failed to load invoice:', err)
      setError(err.message || 'Failed to load invoice details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (error) {
    return <ErrorState title="Failed to load invoice" message={error} onRetry={loadInvoice} />
  }
  if (!invoice) {
    return <ErrorState title="Invoice not found" message="The invoice you are looking for does not exist or has been deleted." />
  }

  const subtotal = Number(invoice.subtotal ?? 0)
  const tax = Number(invoice.tax_amount ?? 0)
  const discount = Number(invoice.discount_amount ?? 0)
  const total = Number(invoice.total_amount ?? invoice.invoice_amount ?? subtotal + tax - discount)
  const status: string = invoice.status || ''
  const paymentStatus: string = invoice.payment_status || 'pending'

  const fields = [
    { label: 'Invoice / Order #', value: invoice.order_number || invoice.invoice_number || '—' },
    { label: 'Issued', value: invoice.created_at ? formatDate(invoice.created_at) : '—' },
    { label: 'Customer', value: invoice.customer_name || '—' },
    { label: 'Subtotal', value: formatCurrency(subtotal) },
    { label: 'Tax', value: formatCurrency(tax) },
    { label: 'Discount', value: discount ? `-${formatCurrency(discount)}` : formatCurrency(0) },
    { label: 'Total', value: formatCurrency(total) },
    { label: 'Status', value: String(status).toLowerCase() },
    { label: 'Payment Status', value: String(paymentStatus).toLowerCase() },
    { label: 'Payment Method', value: invoice.payment_method || '—' },
    { label: 'Notes', value: invoice.notes || '—' },
  ]

  const documentData: DocumentData = {
    type: 'invoice',
    number: invoice.order_number || invoice.invoice_number || `INV-${id}`,
    date: invoice.created_at || new Date().toISOString(),
    status,
    company: { name: 'Fieldvibe', email: 'sales@fieldvibe.com' },
    customer: { name: invoice.customer_name || 'Customer' },
    items: (invoice.items || []).map((item: any) => ({
      description: item.product_name || item.description || 'Item',
      sku: item.sku || item.product_code,
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      total: item.line_total ?? item.total ?? (item.quantity || 0) * (item.unit_price || 0),
    })),
    subtotal,
    tax_total: tax,
    discount_total: discount || undefined,
    total,
    notes: invoice.notes,
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DocumentActions documentData={documentData} />
      </div>
      <TransactionDetail
        title={`Invoice ${invoice.order_number || invoice.invoice_number || ''}`}
        fields={fields}
        auditTrail={invoice.audit_trail || []}
        backPath="/sales/invoices"
        status={status}
        statusColor={STATUS_COLOR[status] || 'gray'}
      />
    </div>
  )
}
