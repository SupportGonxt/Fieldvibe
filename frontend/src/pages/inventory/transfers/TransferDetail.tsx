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

export default function TransferDetail() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ title: string; message: string; action: () => void }>({ title: '', message: '', action: () => {} })
  const { toast } = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const [transfer, setTransfer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTransfer()
  }, [id])

  const loadTransfer = async () => {
    setLoading(true)
    try {
      const response = await inventoryService.getTransfer(Number(id))
      setTransfer(response.data)
    } catch (error) {
      console.error('Failed to load transfer:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReverse = async () => {
    setPendingAction({
      title: 'Confirm',
      message: 'Are you sure you want to reverse this transfer? This will reverse all inventory movements.',
      action: async () => {
        try {
      await inventoryService.reverseTransfer(Number(id))
      navigate('/inventory/transfers')
    } catch (error) {
      console.error('Failed to reverse transfer:', error)
      toast.error('Failed to reverse transfer')
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

  if (!transfer) {
    return <ErrorState title="Transfer not found" message="The transfer you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Transfer Number', value: transfer.transfer_number },
    { label: 'Transfer Date', value: formatDate(transfer.transfer_date) },
    { label: 'From Warehouse', value: transfer.from_warehouse },
    { label: 'To Warehouse', value: transfer.to_warehouse },
    { label: 'Total Items', value: transfer.total_items },
    { label: 'Status', value: transfer.status },
    { label: 'Shipped At', value: transfer.shipped_at ? formatDate(transfer.shipped_at) : '-' },
    { label: 'Received At', value: transfer.received_at ? formatDate(transfer.received_at) : '-' },
    { label: 'Notes', value: transfer.notes },
    { label: 'Created By', value: transfer.created_by },
    { label: 'Created At', value: formatDate(transfer.created_at) }
  ]

  const statusColor = {
    pending: 'yellow',
    in_transit: 'blue',
    received: 'green',
    reversed: 'red'
  }[transfer.status] as 'green' | 'yellow' | 'red' | 'gray'

  const documentData: DocumentData = {
    type: 'stock_transfer',
    number: transfer.transfer_number || `TRF-${id}`,
    date: transfer.transfer_date || new Date().toISOString(),
    status: transfer.status,
    company: { name: 'Fieldvibe', email: 'warehouse@fieldvibe.com' },
    customer: { name: transfer.to_warehouse || 'Destination Warehouse' },
    items: [],
    subtotal: 0,
    tax_total: 0,
    total: 0,
    from_warehouse: transfer.from_warehouse,
    to_warehouse: transfer.to_warehouse,
    notes: transfer.notes,
    inventory_items: (transfer.items || []).map((item: any) => ({
      description: item.product_name || item.description || 'Item',
      sku: item.sku || item.product_code,
      quantity: item.quantity || 0,
      uom: item.uom,
      batch_number: item.batch_number,
    })),
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <DocumentActions documentData={documentData} />
      </div>
      <TransactionDetail
      title={`Transfer ${transfer.transfer_number}`}
      fields={fields}
      auditTrail={transfer.audit_trail || []}
      onReverse={transfer.status === 'received' ? handleReverse : undefined}
      backPath="/inventory/transfers"
      status={transfer.status}
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
