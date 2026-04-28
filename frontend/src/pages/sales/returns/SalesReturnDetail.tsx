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
  PENDING: 'yellow',
  pending: 'yellow',
  PROCESSED: 'green',
  processed: 'green',
  APPROVED: 'green',
  REJECTED: 'red',
  rejected: 'red',
}

export default function SalesReturnDetail() {
  const { id } = useParams()
  const [returnData, setReturnData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadReturn() }, [id])

  const loadReturn = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await salesService.getReturn(String(id))
      setReturnData(response.data?.data || response.data)
    } catch (err: any) {
      console.error('Failed to load return:', err)
      setError(err.message || 'Failed to load return details')
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
    return <ErrorState title="Failed to load return" message={error} onRetry={loadReturn} />
  }
  if (!returnData) {
    return <ErrorState title="Return not found" message="The return you are looking for does not exist or has been deleted." />
  }

  const totalCredit = Number(returnData.total_credit_amount ?? returnData.return_amount ?? 0)
  const tax = Number(returnData.tax_amount ?? 0)
  const restockFee = Number(returnData.restock_fee ?? 0)
  const netCredit = Number(returnData.net_credit_amount ?? Math.max(0, totalCredit + tax - restockFee))
  const status: string = returnData.status || ''

  const fields = [
    { label: 'Return Number', value: returnData.return_number || '—' },
    { label: 'Date', value: returnData.created_at ? formatDate(returnData.created_at) : '—' },
    { label: 'Customer', value: returnData.customer_name || '—' },
    { label: 'Order Number', value: returnData.order_number || '—' },
    { label: 'Return Type', value: returnData.return_type || 'PARTIAL' },
    { label: 'Gross Credit', value: formatCurrency(totalCredit) },
    { label: 'Tax', value: formatCurrency(tax) },
    { label: 'Restock Fee', value: restockFee ? `-${formatCurrency(restockFee)}` : formatCurrency(0) },
    { label: 'Net Credit', value: formatCurrency(netCredit) },
    { label: 'Reason', value: returnData.reason || '—' },
    { label: 'Status', value: String(status).toLowerCase() },
    { label: 'Approved By', value: returnData.approved_by || '—' },
    { label: 'Notes', value: returnData.notes || '—' },
  ]

  const documentData: DocumentData = {
    type: 'sales_return',
    number: returnData.return_number || `SR-${id}`,
    date: returnData.created_at || new Date().toISOString(),
    status,
    company: { name: 'Fieldvibe', email: 'sales@fieldvibe.com' },
    customer: { name: returnData.customer_name || 'Customer' },
    items: (returnData.items || []).map((item: any) => ({
      description: item.product_name || item.description || 'Item',
      sku: item.sku || item.product_code,
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      total: item.line_credit ?? item.total ?? (item.quantity || 0) * (item.unit_price || 0),
    })),
    subtotal: totalCredit,
    tax_total: tax,
    total: netCredit,
    reason: returnData.reason,
    notes: returnData.notes,
    po_number: returnData.order_number,
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <DocumentActions documentData={documentData} />
      </div>
      <TransactionDetail
        title={`Sales Return ${returnData.return_number || ''}`}
        fields={fields}
        auditTrail={returnData.audit_trail || []}
        backPath="/sales/returns"
        status={status}
        statusColor={STATUS_COLOR[status] || 'gray'}
      />
    </>
  )
}
