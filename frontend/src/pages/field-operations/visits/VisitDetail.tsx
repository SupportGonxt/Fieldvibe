import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { fieldOperationsService } from '../../../services/field-operations.service'
import { formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function VisitDetail() {
  const { id } = useParams()
  const [visit, setVisit] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVisit()
  }, [id])

  const loadVisit = async () => {
    setLoading(true)
    try {
      const response = await fieldOperationsService.getVisit(Number(id))
      setVisit(response.data)
    } catch (error) {
      console.error('Failed to load visit:', error)
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

  if (!visit) {
    return <ErrorState title="Visit not found" message="The visit you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Visit Number', value: visit.visit_number },
    { label: 'Visit Date', value: formatDate(visit.visit_date) },
    { label: 'Agent', value: visit.agent_name },
    { label: 'Customer', value: visit.customer_name },
    { label: 'Visit Type', value: visit.visit_type },
    { label: 'Duration', value: `${visit.duration} minutes` },
    { label: 'Status', value: visit.status },
    { label: 'GPS Location', value: visit.gps_location },
    { label: 'Notes', value: visit.notes },
    { label: 'Created By', value: visit.created_by },
    { label: 'Created At', value: formatDate(visit.created_at) }
  ]

  const statusColor = {
    scheduled: 'blue',
    in_progress: 'yellow',
    completed: 'green',
    cancelled: 'red'
  }[visit.status] as 'green' | 'yellow' | 'red' | 'gray'

  return (
    <TransactionDetail
      title={`Visit ${visit.visit_number}`}
      fields={fields}
      auditTrail={visit.audit_trail || []}
      editPath={visit.status !== 'completed' ? `/field-operations/visits/${id}/edit` : undefined}
      backPath="/field-operations/visits"
      status={visit.status}
      statusColor={statusColor}
    />
  )
}
