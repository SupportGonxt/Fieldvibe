import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import DocumentActions from '../../../components/export/DocumentActions'
import { inventoryService } from '../../../services/inventory.service'
import { formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import type { DocumentData } from '../../../utils/pdf/document-generator'

export default function StockCountDetail() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ title: string; message: string; action: () => void }>({ title: '', message: '', action: () => {} })
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
    setPendingAction({
      title: 'Confirm',
      message: 'Are you sure you want to confirm this stock count? This will create adjustments for variances.',
      action: async () => {
        try {
      await inventoryService.confirmStockCount(Number(id))
      navigate('/inventory/stock-counts')
    } catch (error) {
      console.error('Failed to confirm stock count:', error)
      toast.error('Failed to confirm stock count')
    }
      }
    })
    setConfirmOpen(true)
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

  const documentData: DocumentData = {
    type: 'stock_count',
    number: stockCount.count_number || `SC-${id}`,
    date: stockCount.count_date || new Date().toISOString(),
    status: stockCount.status,
    company: { name: 'Fieldvibe', email: 'warehouse@fieldvibe.com' },
    customer: { name: stockCount.warehouse_name || 'Warehouse' },
    items: [],
    subtotal: 0,
    tax_total: 0,
    total: 0,
    warehouse: stockCount.warehouse_name,
    count_type: typeLabels[stockCount.count_type] || stockCount.count_type,
    notes: stockCount.notes,
    inventory_items: (stockCount.items || []).map((item: any) => ({
      description: item.product_name || item.description || 'Item',
      sku: item.sku || item.product_code,
      quantity: item.counted_qty || item.quantity || 0,
      expected_qty: item.expected_qty || item.system_qty,
      variance: item.variance,
      uom: item.uom,
    })),
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <DocumentActions documentData={documentData} />
      </div>
      <TransactionDetail
      title={`Stock Count ${stockCount.count_number}`}
      fields={fields}
      auditTrail={stockCount.audit_trail || []}
      backPath="/inventory/stock-counts"
      status={stockCount.status.replace('_', ' ')}
      statusColor={statusColor}
    />
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { pendingAction.action(); setConfirmOpen(false); }}
        title={pendingAction.title}
        message={pendingAction.message}
        confirmLabel="Confirm"
        variant="danger"
      />
    </>
  )
}
