import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { inventoryService } from '../../../services/inventory.service'
import { formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'

export default function IssueDetail() {
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
    if (!window.confirm('Are you sure you want to reverse this issue? This will reverse all inventory movements.')) {
      return
    }

    try {
      await inventoryService.reverseIssue(Number(id))
      navigate('/inventory/issues')
    } catch (error) {
      console.error('Failed to reverse issue:', error)
      toast.error('Failed to reverse issue')
    }
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

  return (
    <TransactionDetail
      title={`Issue ${issue.issue_number}`}
      fields={fields}
      auditTrail={issue.audit_trail || []}
      onReverse={issue.status === 'issued' ? handleReverse : undefined}
      backPath="/inventory/issues"
      status={issue.status}
      statusColor={statusColor}
    />
  )
}
