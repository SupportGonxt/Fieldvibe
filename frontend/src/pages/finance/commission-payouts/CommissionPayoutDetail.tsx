import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { financeService } from '../../../services/finance.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function CommissionPayoutDetail() {
  const { id } = useParams()
  const [payout, setPayout] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayout()
  }, [id])

  const loadPayout = async () => {
    setLoading(true)
    try {
      const response = await financeService.getCommissionPayout(Number(id))
      setPayout(response.data)
    } catch (error) {
      console.error('Failed to load commission payout:', error)
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

  if (!payout) {
    return <ErrorState title="Commission payout not found" message="The commission payout you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Payout Number', value: payout.payout_number },
    { label: 'Payout Date', value: formatDate(payout.payout_date) },
    { label: 'Agent', value: payout.agent_name },
    { label: 'Period Start', value: formatDate(payout.period_start) },
    { label: 'Period End', value: formatDate(payout.period_end) },
    { label: 'Total Commission', value: formatCurrency(payout.total_commission) },
    { label: 'Deductions', value: formatCurrency(payout.deductions || 0) },
    { label: 'Net Payout', value: formatCurrency(payout.net_payout) },
    { label: 'Payment Method', value: payout.payment_method },
    { label: 'Payment Reference', value: payout.payment_reference || '-' },
    { label: 'Status', value: payout.status },
    { label: 'Approved By', value: payout.approved_by || '-' },
    { label: 'Approved Date', value: payout.approved_date ? formatDate(payout.approved_date) : '-' },
    { label: 'Paid Date', value: payout.paid_date ? formatDate(payout.paid_date) : '-' },
    { label: 'Notes', value: payout.notes },
    { label: 'Created By', value: payout.created_by },
    { label: 'Created At', value: formatDate(payout.created_at) }
  ]

  const statusColor = {
    pending: 'yellow',
    approved: 'green',
    paid: 'blue',
    rejected: 'red'
  }[payout.status] as 'green' | 'yellow' | 'red' | 'gray'

  return (
    <TransactionDetail
      title={`Commission Payout ${payout.payout_number}`}
      fields={fields}
      auditTrail={payout.audit_trail || []}
      backPath="/finance/commission-payouts"
      status={payout.status}
      statusColor={statusColor}
    />
  )
}
