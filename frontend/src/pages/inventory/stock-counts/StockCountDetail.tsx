import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { inventoryService } from '../../../services/inventory.service'
import { formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'

export default function StockCountDetail() {
  const { toast } = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const [stockCount, setStockCount] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStockCount()
  }, [id])

  const loadStockCount = async () => {
    setLoading(true)
    try {
      const response = await inventoryService.getStockCount(Number(id))
      setStockCount(response.data)
    } catch (error) {
      console.error('Failed to load stock count:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!window.confirm('Are you sure you want to confirm this stock count? This will create adjustments for variances.')) {
      return
    }

    try {
      await inventoryService.confirmStockCount(Number(id))
      navigate('/inventory/stock-counts')
    } catch (error) {
      console.error('Failed to confirm stock count:', error)
      toast.error('Failed to confirm stock count')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!stockCount) {
    return <ErrorState title="Stock count not found" message="The stock count you are looking for does not exist or has been deleted." />
  }

  const typeLabels: Record<string, string> = {
    full: 'Full Count',
    cycle: 'Cycle Count',
    spot: 'Spot Check'
  }

  const fields = [
    { label: 'Count Number', value: stockCount.count_number },
    { label: 'Count Date', value: formatDate(stockCount.count_date) },
    { label: 'Warehouse', value: stockCount.warehouse_name },
    { label: 'Count Type', value: typeLabels[stockCount.count_type] || stockCount.count_type },
    { label: 'Total Items', value: stockCount.total_items },
    { label: 'Variance Count', value: stockCount.variance_count },
    { label: 'Status', value: stockCount.status.replace('_', ' ') },
    { label: 'Notes', value: stockCount.notes },
    { label: 'Confirmed By', value: stockCount.confirmed_by || '-' },
    { label: 'Confirmed At', value: stockCount.confirmed_at ? formatDate(stockCount.confirmed_at) : '-' },
    { label: 'Created By', value: stockCount.created_by },
    { label: 'Created At', value: formatDate(stockCount.created_at) }
  ]

  const statusColor = {
    in_progress: 'yellow',
    pending_review: 'blue',
    confirmed: 'green'
  }[stockCount.status] as 'green' | 'yellow' | 'red' | 'gray'

  return (
    <TransactionDetail
      title={`Stock Count ${stockCount.count_number}`}
      fields={fields}
      auditTrail={stockCount.audit_trail || []}
      backPath="/inventory/stock-counts"
      status={stockCount.status.replace('_', ' ')}
      statusColor={statusColor}
    />
  )
}
