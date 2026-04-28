import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { vanSalesService } from '../../../services/van-sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

const STATUS_COLOR: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  pending: 'yellow',
  closed: 'yellow',
  approved: 'green',
  reconciled: 'green',
}

export default function CashReconciliationDetail() {
  const { id } = useParams()
  const [reconciliation, setReconciliation] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadReconciliation() }, [id])

  const loadReconciliation = async () => {
    setLoading(true)
    try {
      const response = await vanSalesService.getCashReconciliation(String(id))
      setReconciliation(response.data?.data || response.data || null)
    } catch (error) {
      console.error('Failed to load reconciliation:', error)
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
    return <ErrorState title="Reconciliation not found" message="The reconciliation you are looking for does not exist or has been deleted." />
  }

  const expected = Number(reconciliation.cash_expected ?? reconciliation.expected_cash ?? 0)
  const actual = Number(reconciliation.cash_actual ?? reconciliation.actual_cash ?? 0)
  const variance = Number(reconciliation.variance ?? actual - expected)

  const fields = [
    { label: 'Reconciliation', value: reconciliation.id },
    { label: 'Date', value: reconciliation.created_at ? formatDate(reconciliation.created_at) : '—' },
    { label: 'Van', value: reconciliation.vehicle_reg || '—' },
    { label: 'Agent', value: reconciliation.agent_name || '—' },
    { label: 'Expected Cash', value: formatCurrency(expected) },
    { label: 'Actual Cash', value: formatCurrency(actual) },
    { label: 'Variance', value: formatCurrency(variance) },
    { label: 'Status', value: reconciliation.status || '—' },
    { label: 'Notes', value: reconciliation.notes || '—' },
    { label: 'Approved By', value: reconciliation.approved_by || '—' },
    { label: 'Approved At', value: reconciliation.approved_at ? formatDate(reconciliation.approved_at) : '—' },
  ]

  return (
    <TransactionDetail
      title={`Cash Reconciliation ${String(reconciliation.id || '').slice(0, 8)}…`}
      fields={fields}
      auditTrail={reconciliation.audit_trail || []}
      backPath="/van-sales/cash-reconciliation"
      status={reconciliation.status}
      statusColor={STATUS_COLOR[reconciliation.status] || 'gray'}
    />
  )
}
