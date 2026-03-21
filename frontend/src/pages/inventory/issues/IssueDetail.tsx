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

export default function IssueDetail() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ title: string; message: string; action: () => void }>({ title: '', message: '', action: () => {} })
  const { toast } = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const [issue, setIssue] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadIssue()
  }, [id])

  const loadIssue = async () => {
    setLoading(true)
    try {
      const response = await inventoryService.getIssue(Number(id))
      setIssue(response.data)
    } catch (error) {
      console.error('Failed to load issue:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReverse = async () => {
    setPendingAction({
      title: 'Confirm',
      message: 'Are you sure you want to reverse this issue? This will reverse all inventory movements.',
      action: async () => {
        try {
      await inventoryService.reverseIssue(Number(id))
      navigate('/inventory/issues')
    } catch (error) {
      console.error('Failed to reverse issue:', error)
      toast.error('Failed to reverse issue')
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

  if (!issue) {
    return <ErrorState title="Issue not found" message="The issue you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Issue Number', value: issue.issue_number },
    { label: 'Issue Date', value: formatDate(issue.issue_date) },
    { label: 'Warehouse', value: issue.warehouse_name },
    { label: 'Issued To', value: issue.issued_to },
    { label: 'Issue Type', value: issue.issue_type },
    { label: 'Total Items', value: issue.total_items },
    { label: 'Status', value: issue.status },
    { label: 'Notes', value: issue.notes },
    { label: 'Created By', value: issue.created_by },
    { label: 'Created At', value: formatDate(issue.created_at) }
  ]

  const statusColor = {
    pending: 'yellow',
    issued: 'green',
    reversed: 'red'
  }[issue.status] as 'green' | 'yellow' | 'red'

  const documentData: DocumentData = {
    type: 'stock_issue',
    number: issue.issue_number || `ISS-${id}`,
    date: issue.issue_date || new Date().toISOString(),
    status: issue.status,
    company: { name: 'Fieldvibe', email: 'warehouse@fieldvibe.com' },
    customer: { name: issue.issued_to || 'Recipient' },
    items: [],
    subtotal: 0,
    tax_total: 0,
    total: 0,
    warehouse: issue.warehouse_name,
    issued_to: issue.issued_to,
    notes: issue.notes,
    inventory_items: (issue.items || []).map((item: any) => ({
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
      title={`Issue ${issue.issue_number}`}
      fields={fields}
      auditTrail={issue.audit_trail || []}
      onReverse={issue.status === 'issued' ? handleReverse : undefined}
      backPath="/inventory/issues"
      status={issue.status}
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
