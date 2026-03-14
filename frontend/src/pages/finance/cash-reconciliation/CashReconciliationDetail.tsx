import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { financeService } from '../../../services/finance.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function CashReconciliationDetail() {
  const { id } = useParams()
  const [reconciliation, setReconciliation] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReconciliation()
  }, [id])

  const loadReconciliation = async () => {
    setLoading(true)
    try {
      const response = await financeService.getCashReconciliation(Number(id))
      setReconciliation(response.data)
    } catch (error) {
      console.error('Failed to load cash reconciliation:', error)
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

  if (!reconciliation) {
    return <ErrorState title="Cash reconciliation not found" message="The cash reconciliation you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Reconciliation Number', value: reconciliation.reconciliation_number },
    { label: 'Reconciliation Date', value: formatDate(reconciliation.reconciliation_date) },
    { label: 'Agent', value: reconciliation.agent_name },
    { label: 'Expected Cash', value: formatCurrency(reconciliation.expected_cash) },
    { label: 'Actual Cash', value: formatCurrency(reconciliation.actual_cash) },
    { label: 'Variance', value: formatCurrency(reconciliation.variance) },
    { label: 'Cash Breakdown', value: reconciliation.cash_breakdown || '-' },
    { label: 'Variance Reason', value: reconciliation.variance_reason || '-' },
    { label: 'Status', value: reconciliation.status },
    { label: 'Reconciled By', value: reconciliation.reconciled_by || '-' },
    { label: 'Reconciled Date', value: reconciliation.reconciled_date ? formatDate(reconciliation.reconciled_date) : '-' },
    { label: 'Notes', value: reconciliation.notes },
    { label: 'Created By', value: reconciliation.created_by },
    { label: 'Created At', value: formatDate(reconciliation.created_at) }
  ]

  const statusColor = {
    pending: 'yellow',
    reconciled: 'green',
    variance: 'red'
  }[reconciliation.status] as 'green' | 'yellow' | 'red'

  return (
    <TransactionDetail
      title={`Cash Reconciliation ${reconciliation.reconciliation_number}`}
      fields={fields}
      auditTrail={reconciliation.audit_trail || []}
      backPath="/finance/cash-reconciliation"
      status={reconciliation.status}
      statusColor={statusColor}
    />
  )
}
