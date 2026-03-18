import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { fieldOperationsService } from '../../../services/field-operations.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function CommissionLedgerDetail() {
  const { id } = useParams()
  const [commission, setCommission] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCommission()
  }, [id])

  const loadCommission = async () => {
    setLoading(true)
    try {
      const response = await fieldOperationsService.getCommission(Number(id))
      setCommission(response.data)
    } catch (error) {
      console.error('Failed to load commission:', error)
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

  if (!commission) {
    return <ErrorState title="Commission not found" message="The commission you are looking for does not exist or has been deleted." />
  }

  const typeLabels: Record<string, string> = {
    board_placement: 'Board Placement',
    product_distribution: 'Product Distribution',
    sales_order: 'Sales Order',
    visit: 'Visit'
  }

  const fields = [
    { label: 'Commission Number', value: commission.commission_number },
    { label: 'Commission Date', value: formatDate(commission.commission_date) },
    { label: 'Agent', value: commission.agent_name },
    { label: 'Commission Type', value: typeLabels[commission.commission_type] || commission.commission_type },
    { label: 'Reference Number', value: commission.reference_number },
    { label: 'Commission Amount', value: formatCurrency(commission.commission_amount) },
    { label: 'Status', value: commission.status },
    { label: 'Approved By', value: commission.approved_by },
    { label: 'Approved At', value: commission.approved_at ? formatDate(commission.approved_at) : '-' },
    { label: 'Paid At', value: commission.paid_at ? formatDate(commission.paid_at) : '-' },
    { label: 'Notes', value: commission.notes },
    { label: 'Created By', value: commission.created_by },
    { label: 'Created At', value: formatDate(commission.created_at) }
  ]

  const statusColor = {
    pending: 'yellow',
    approved: 'green',
    paid: 'blue',
    reversed: 'red'
  }[commission.status] as 'green' | 'yellow' | 'red' | 'gray'

  return (
    <TransactionDetail
      title={`Commission ${commission.commission_number}`}
      fields={fields}
      auditTrail={commission.audit_trail || []}
      backPath="/field-operations/commission-ledger"
      status={commission.status}
      statusColor={statusColor}
    />
  )
}
