import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import DocumentActions from '../../../components/export/DocumentActions'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import type { DocumentData } from '../../../utils/pdf/document-generator'

export default function InvoiceDetail() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInvoice()
  }, [id])

  const loadInvoice = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await salesService.getInvoice(Number(id))
      setInvoice(response.data)
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

  const fields = [
    { label: 'Invoice Number', value: invoice.invoice_number },
    { label: 'Invoice Date', value: formatDate(invoice.invoice_date) },
    { label: 'Customer', value: invoice.customer_name },
    { label: 'Order Number', value: invoice.order_number },
    { label: 'Invoice Amount', value: formatCurrency(invoice.invoice_amount) },
    { label: 'Due Date', value: formatDate(invoice.due_date) },
    { label: 'Status', value: invoice.status },
    { label: 'Payment Status', value: invoice.payment_status },
    { label: 'Amount Paid', value: formatCurrency(invoice.amount_paid || 0) },
    { label: 'Balance Due', value: formatCurrency(invoice.balance_due || invoice.invoice_amount) },
    { label: 'Notes', value: invoice.notes },
    { label: 'Created By', value: invoice.created_by },
    { label: 'Created At', value: formatDate(invoice.created_at) }
  ]

  const statusColor = {
    draft: 'gray',
    sent: 'blue',
    paid: 'green',
    overdue: 'red',
    cancelled: 'gray'
  }[invoice.status] as 'green' | 'yellow' | 'red' | 'gray'

  const documentData: DocumentData = {
    type: 'invoice',
    number: invoice.invoice_number || `INV-${id}`,
    date: invoice.invoice_date || new Date().toISOString(),
    due_date: invoice.due_date,
    status: invoice.status,
    company: { name: 'Fieldvibe', email: 'sales@fieldvibe.com' },
    customer: {
      name: invoice.customer_name || 'Customer',
      address: invoice.customer_address,
      phone: invoice.customer_phone,
      email: invoice.customer_email,
    },
    items: (invoice.items || []).map((item: any) => ({
      description: item.product_name || item.description || 'Item',
      sku: item.sku || item.product_code,
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      discount: item.discount,
      tax: item.tax,
      total: item.total || (item.quantity || 0) * (item.unit_price || 0),
    })),
    subtotal: invoice.subtotal || invoice.invoice_amount || 0,
    tax_total: invoice.tax_total || 0,
    discount_total: invoice.discount_total,
    total: invoice.invoice_amount || 0,
    notes: invoice.notes,
    payment_terms: invoice.payment_terms,
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DocumentActions documentData={documentData} />
      </div>
      <TransactionDetail
        title={`Invoice ${invoice.invoice_number}`}
        fields={fields}
        auditTrail={invoice.audit_trail || []}
        backPath="/sales/invoices"
        status={invoice.status}
        statusColor={statusColor}
      />
    </div>
  )
}
