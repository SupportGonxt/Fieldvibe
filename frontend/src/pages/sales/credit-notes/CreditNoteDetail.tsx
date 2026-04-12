import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import DocumentActions from '../../../components/export/DocumentActions'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import type { DocumentData } from '../../../utils/pdf/document-generator'

export default function CreditNoteDetail() {
  const { id } = useParams()
  const [creditNote, setCreditNote] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCreditNote()
  }, [id])

  const loadCreditNote = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await salesService.getCreditNote(String(id))
      setCreditNote(response.data)
    } catch (err: any) {
      console.error('Failed to load credit note:', err)
      setError(err.message || 'Failed to load credit note details')
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
    return <ErrorState title="Failed to load credit note" message={error} onRetry={loadCreditNote} />
  }

  if (!creditNote) {
    return <ErrorState title="Credit note not found" message="The credit note you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Credit Note Number', value: creditNote.credit_note_number },
    { label: 'Credit Note Date', value: formatDate(creditNote.credit_note_date) },
    { label: 'Customer', value: creditNote.customer_name },
    { label: 'Invoice Number', value: creditNote.invoice_number },
    { label: 'Credit Amount', value: formatCurrency(creditNote.credit_amount) },
    { label: 'Reason', value: creditNote.reason },
    { label: 'Status', value: creditNote.status },
    { label: 'Applied Date', value: creditNote.applied_date ? formatDate(creditNote.applied_date) : '-' },
    { label: 'Notes', value: creditNote.notes },
    { label: 'Created By', value: creditNote.created_by },
    { label: 'Created At', value: formatDate(creditNote.created_at) }
  ]

  const statusColor = {
    draft: 'gray',
    issued: 'green',
    applied: 'blue'
  }[creditNote.status] as 'green' | 'yellow' | 'red' | 'gray'

  const documentData: DocumentData = {
    type: 'credit_note',
    number: creditNote.credit_note_number || `CN-${id}`,
    date: creditNote.credit_note_date || new Date().toISOString(),
    status: creditNote.status,
    company: { name: 'Fieldvibe', email: 'sales@fieldvibe.com' },
    customer: {
      name: creditNote.customer_name || 'Customer',
      address: creditNote.customer_address,
      phone: creditNote.customer_phone,
      email: creditNote.customer_email,
    },
    items: (creditNote.items || []).map((item: any) => ({
      description: item.product_name || item.description || 'Item',
      sku: item.sku || item.product_code,
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      discount: item.discount,
      tax: item.tax,
      total: item.total || (item.quantity || 0) * (item.unit_price || 0),
    })),
    subtotal: creditNote.subtotal || creditNote.credit_amount || 0,
    tax_total: creditNote.tax_total || 0,
    total: creditNote.credit_amount || 0,
    notes: creditNote.notes,
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DocumentActions documentData={documentData} />
      </div>
      <TransactionDetail
        title={`Credit Note ${creditNote.credit_note_number}`}
        fields={fields}
        auditTrail={creditNote.audit_trail || []}
        backPath="/sales/credit-notes"
        status={creditNote.status}
        statusColor={statusColor}
      />
    </div>
  )
}
