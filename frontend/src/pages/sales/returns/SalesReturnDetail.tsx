import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import DocumentActions from '../../../components/export/DocumentActions'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import type { DocumentData } from '../../../utils/pdf/document-generator'

export default function SalesReturnDetail() {
  const { id } = useParams()
  const [returnData, setReturnData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadReturn()
  }, [id])

  const loadReturn = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await salesService.getReturn(Number(id))
      setReturnData(response.data)
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

  const fields = [
    { label: 'Return Number', value: returnData.return_number },
    { label: 'Return Date', value: formatDate(returnData.return_date) },
    { label: 'Customer', value: returnData.customer_name },
    { label: 'Order Number', value: returnData.order_number },
    { label: 'Return Amount', value: formatCurrency(returnData.return_amount) },
    { label: 'Reason', value: returnData.reason },
    { label: 'Status', value: returnData.status },
    { label: 'Approved By', value: returnData.approved_by || '-' },
    { label: 'Approved Date', value: returnData.approved_date ? formatDate(returnData.approved_date) : '-' },
    { label: 'Processed Date', value: returnData.processed_date ? formatDate(returnData.processed_date) : '-' },
    { label: 'Notes', value: returnData.notes },
    { label: 'Created By', value: returnData.created_by },
    { label: 'Created At', value: formatDate(returnData.created_at) }
  ]

  const statusColor = {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red',
    processed: 'blue'
  }[returnData.status] as 'green' | 'yellow' | 'red' | 'gray'

  const documentData: DocumentData = {
    type: 'sales_return',
    number: returnData.return_number || `SR-${id}`,
    date: returnData.return_date || new Date().toISOString(),
    status: returnData.status,
    company: { name: 'Fieldvibe', email: 'sales@fieldvibe.com' },
    customer: {
      name: returnData.customer_name || 'Customer',
    },
    items: (returnData.items || []).map((item: any) => ({
      description: item.product_name || item.description || 'Item',
      sku: item.sku || item.product_code,
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      total: item.total || (item.quantity || 0) * (item.unit_price || 0),
    })),
    subtotal: returnData.return_amount || 0,
    tax_total: returnData.tax_total || 0,
    total: returnData.return_amount || 0,
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
        title={`Sales Return ${returnData.return_number}`}
        fields={fields}
        auditTrail={returnData.audit_trail || []}
        backPath="/sales/returns"
        status={returnData.status}
        statusColor={statusColor}
      />
    </>
  )
}
