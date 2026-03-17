import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { marketingService } from '../../../services/marketing.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function EventDetail() {
  const { id } = useParams()
  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvent()
  }, [id])

  const loadEvent = async () => {
    setLoading(true)
    try {
      const response = await marketingService.getEvent(Number(id))
      setEvent(response.data)
    } catch (error) {
      console.error('Failed to load event:', error)
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

  if (!event) {
    return <ErrorState title="Event not found" message="The event you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Event Code', value: event.event_code },
    { label: 'Event Name', value: event.event_name },
    { label: 'Event Type', value: event.event_type },
    { label: 'Event Date', value: formatDate(event.event_date) },
    { label: 'Location', value: event.location },
    { label: 'Budget', value: formatCurrency(event.budget) },
    { label: 'Actual Cost', value: formatCurrency(event.actual_cost || 0) },
    { label: 'Expected Attendees', value: event.expected_attendees },
    { label: 'Actual Attendees', value: event.actual_attendees || '-' },
    { label: 'Description', value: event.description },
    { label: 'Status', value: event.status },
    { label: 'Notes', value: event.notes },
    { label: 'Created By', value: event.created_by },
    { label: 'Created At', value: formatDate(event.created_at) }
  ]

  const statusColor = {
    draft: 'gray',
    planned: 'blue',
    confirmed: 'green',
    completed: 'gray',
    cancelled: 'red'
  }[event.status] as 'green' | 'yellow' | 'red' | 'gray'

  return (
    <TransactionDetail
      title={`Event ${event.event_code}`}
      fields={fields}
      auditTrail={event.audit_trail || []}
      editPath={(event.status === 'draft' || event.status === 'planned') ? `/marketing/events/${id}/edit` : undefined}
      backPath="/marketing/events"
      status={event.status}
      statusColor={statusColor}
    />
  )
}
