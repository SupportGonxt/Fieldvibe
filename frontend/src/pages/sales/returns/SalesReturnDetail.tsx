import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'

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

  return (
    <TransactionDetail
      title={`Sales Return ${returnData.return_number}`}
      fields={fields}
      auditTrail={returnData.audit_trail || []}
      backPath="/sales/returns"
      status={returnData.status}
      statusColor={statusColor}
    />
  )
}
