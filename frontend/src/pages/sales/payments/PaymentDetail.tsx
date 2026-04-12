import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import DocumentActions from '../../../components/export/DocumentActions'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import type { DocumentData } from '../../../utils/pdf/document-generator'

export default function PaymentDetail() {
  const { id } = useParams()
  const [payment, setPayment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPayment()
  }, [id])

  const loadPayment = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await salesService.getPayment(String(id))
      setPayment(response.data)
    } catch (err: any) {
      console.error('Failed to load payment:', err)
      setError(err.message || 'Failed to load payment details')
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
    return <ErrorState title="Failed to load payment" message={error} onRetry={loadPayment} />
  }

  if (!payment) {
    return <ErrorState title="Payment not found" message="The payment you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Payment Number', value: payment.payment_number },
    { label: 'Payment Date', value: formatDate(payment.payment_date) },
    { label: 'Customer', value: payment.customer_name },
    { label: 'Invoice Number', value: payment.invoice_number },
    { label: 'Payment Amount', value: formatCurrency(payment.payment_amount) },
    { label: 'Payment Method', value: payment.payment_method },
    { label: 'Reference Number', value: payment.reference_number },
    { label: 'Status', value: payment.status },
    { label: 'Cleared Date', value: payment.cleared_date ? formatDate(payment.cleared_date) : '-' },
    { label: 'Notes', value: payment.notes },
    { label: 'Created By', value: payment.created_by },
    { label: 'Created At', value: formatDate(payment.created_at) }
  ]

  const statusColor = {
    pending: 'yellow',
    cleared: 'green',
    bounced: 'red'
  }[payment.status] as 'green' | 'yellow' | 'red'

  const documentData: DocumentData = {
    type: 'receipt',
    number: payment.payment_number || `PAY-${id}`,
    date: payment.payment_date || new Date().toISOString(),
    status: payment.status,
    company: { name: 'Fieldvibe', email: 'sales@fieldvibe.com' },
    customer: {
      name: payment.customer_name || 'Customer',
      address: payment.customer_address,
      phone: payment.customer_phone,
      email: payment.customer_email,
    },
    items: [{
      description: `Payment for Invoice ${payment.invoice_number || 'N/A'}`,
      quantity: 1,
      unit_price: payment.payment_amount || 0,
      total: payment.payment_amount || 0,
    }],
    subtotal: payment.payment_amount || 0,
    tax_total: 0,
    total: payment.payment_amount || 0,
    notes: payment.notes,
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DocumentActions documentData={documentData} />
      </div>
      <TransactionDetail
        title={`Payment ${payment.payment_number}`}
        fields={fields}
        auditTrail={payment.audit_trail || []}
        backPath="/sales/payments"
        status={payment.status}
        statusColor={statusColor}
      />
    </div>
  )
}
