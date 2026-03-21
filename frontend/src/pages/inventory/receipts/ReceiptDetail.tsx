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

export default function ReceiptDetail() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ title: string; message: string; action: () => void }>({ title: '', message: '', action: () => {} })
  const { toast } = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const [receipt, setReceipt] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReceipt()
  }, [id])

  const loadReceipt = async () => {
    setLoading(true)
    try {
      const response = await inventoryService.getReceipt(Number(id))
      setReceipt(response.data)
    } catch (error) {
      console.error('Failed to load receipt:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReverse = async () => {
    setPendingAction({
      title: 'Confirm',
      message: 'Are you sure you want to reverse this receipt? This will reverse all inventory movements.',
      action: async () => {
        try {
      await inventoryService.reverseReceipt(Number(id))
      navigate('/inventory/receipts')
    } catch (error) {
      console.error('Failed to reverse receipt:', error)
      toast.error('Failed to reverse receipt')
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

  if (!receipt) {
    return <ErrorState title="Receipt not found" message="The receipt you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Receipt Number', value: receipt.receipt_number },
    { label: 'Receipt Date', value: formatDate(receipt.receipt_date) },
    { label: 'Warehouse', value: receipt.warehouse_name },
    { label: 'Supplier', value: receipt.supplier_name },
    { label: 'PO Number', value: receipt.po_number },
    { label: 'Total Items', value: receipt.total_items },
    { label: 'Status', value: receipt.status },
    { label: 'Notes', value: receipt.notes },
    { label: 'Created By', value: receipt.created_by },
    { label: 'Created At', value: formatDate(receipt.created_at) }
  ]

  const statusColor = {
    pending: 'yellow',
    received: 'green',
    reversed: 'red'
  }[receipt.status] as 'green' | 'yellow' | 'red'

  const documentData: DocumentData = {
    type: 'goods_receipt',
    number: receipt.receipt_number || `GRN-${id}`,
    date: receipt.receipt_date || new Date().toISOString(),
    status: receipt.status,
    company: { name: 'Fieldvibe', email: 'warehouse@fieldvibe.com' },
    customer: { name: receipt.supplier_name || 'Supplier' },
    items: [],
    subtotal: 0,
    tax_total: 0,
    total: 0,
    warehouse: receipt.warehouse_name,
    supplier_name: receipt.supplier_name,
    po_number: receipt.po_number,
    notes: receipt.notes,
    inventory_items: (receipt.items || []).map((item: any) => ({
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
      title={`Receipt ${receipt.receipt_number}`}
      fields={fields}
      auditTrail={receipt.audit_trail || []}
      onReverse={receipt.status === 'received' ? handleReverse : undefined}
      backPath="/inventory/receipts"
      status={receipt.status}
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
