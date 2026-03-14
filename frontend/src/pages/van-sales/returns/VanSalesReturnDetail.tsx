import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { vanSalesService } from '../../../services/van-sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function VanSalesReturnDetail() {
  const { id } = useParams()
  const [returnData, setReturnData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReturn()
  }, [id])

  const loadReturn = async () => {
    setLoading(true)
    try {
      const response = await vanSalesService.getReturn(Number(id))
      setReturnData(response.data)
    } catch (error) {
      console.error('Failed to load return:', error)
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

  if (!returnData) {
    return <ErrorState title="Return not found" message="The return you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Return Number', value: returnData.return_number },
    { label: 'Return Date', value: formatDate(returnData.return_date) },
    { label: 'Customer', value: returnData.customer_name },
    { label: 'Original Order', value: returnData.original_order },
    { label: 'Return Amount', value: formatCurrency(returnData.return_amount) },
    { label: 'Reason', value: returnData.reason },
    { label: 'Status', value: returnData.status },
    { label: 'Notes', value: returnData.notes },
    { label: 'Created By', value: returnData.created_by },
    { label: 'Created At', value: formatDate(returnData.created_at) }
  ]

  const statusColor = {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red'
  }[returnData.status] as 'green' | 'yellow' | 'red'

  return (
    <TransactionDetail
      title={`Return ${returnData.return_number}`}
      fields={fields}
      auditTrail={returnData.audit_trail || []}
      backPath="/van-sales/returns"
      status={returnData.status}
      statusColor={statusColor}
    />
  )
}
