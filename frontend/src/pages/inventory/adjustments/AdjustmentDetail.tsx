import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { inventoryService } from '../../../services/inventory.service'
import { formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function AdjustmentDetail() {
  const { id } = useParams()
  const [adjustment, setAdjustment] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAdjustment()
  }, [id])

  const loadAdjustment = async () => {
    setLoading(true)
    try {
      const response = await inventoryService.getAdjustment(Number(id))
      setAdjustment(response.data)
    } catch (error) {
      console.error('Failed to load adjustment:', error)
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

  if (!adjustment) {
    return <ErrorState title="Adjustment not found" message="The adjustment you are looking for does not exist or has been deleted." />
  }

  const typeLabels: Record<string, string> = {
    increase: 'Increase',
    decrease: 'Decrease',
    damage: 'Damage',
    expiry: 'Expiry',
    recount: 'Recount'
  }

  const fields = [
    { label: 'Adjustment Number', value: adjustment.adjustment_number },
    { label: 'Adjustment Date', value: formatDate(adjustment.adjustment_date) },
    { label: 'Warehouse', value: adjustment.warehouse_name },
    { label: 'Adjustment Type', value: typeLabels[adjustment.adjustment_type] || adjustment.adjustment_type },
    { label: 'Total Items', value: adjustment.total_items },
    { label: 'Status', value: adjustment.status },
    { label: 'Reason', value: adjustment.reason },
    { label: 'Notes', value: adjustment.notes },
    { label: 'Approved By', value: adjustment.approved_by || '-' },
    { label: 'Approved At', value: adjustment.approved_at ? formatDate(adjustment.approved_at) : '-' },
    { label: 'Created By', value: adjustment.created_by },
    { label: 'Created At', value: formatDate(adjustment.created_at) }
  ]

  const statusColor = {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red'
  }[adjustment.status] as 'green' | 'yellow' | 'red'

  return (
    <TransactionDetail
      title={`Adjustment ${adjustment.adjustment_number}`}
      fields={fields}
      auditTrail={adjustment.audit_trail || []}
      backPath="/inventory/adjustments"
      status={adjustment.status}
      statusColor={statusColor}
    />
  )
}
