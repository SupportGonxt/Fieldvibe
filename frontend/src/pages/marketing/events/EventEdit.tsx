import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { marketingService } from '../../../services/marketing.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function EventEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
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

  const fields = [
    {
      name: 'event_code',
      label: 'Event Code',
      type: 'text' as const,
      required: true,
      disabled: true
    },
    {
      name: 'event_name',
      label: 'Event Name',
      type: 'text' as const,
      required: true
    },
    {
      name: 'event_type',
      label: 'Event Type',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'product_launch', label: 'Product Launch' },
        { value: 'trade_show', label: 'Trade Show' },
        { value: 'conference', label: 'Conference' },
        { value: 'workshop', label: 'Workshop' },
        { value: 'roadshow', label: 'Roadshow' },
        { value: 'activation', label: 'Activation' }
      ]
    },
    {
      name: 'event_date',
      label: 'Event Date',
      type: 'date' as const,
      required: true
    },
    {
      name: 'location',
      label: 'Location',
      type: 'text' as const,
      required: true
    },
    {
      name: 'budget',
      label: 'Budget (R)',
      type: 'number' as const,
      required: true
    },
    {
      name: 'expected_attendees',
      label: 'Expected Attendees',
      type: 'number' as const,
      required: true
    },
    {
      name: 'description',
      label: 'Event Description',
      type: 'textarea' as const,
      required: true
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await marketingService.updateEvent(Number(id), data)
      navigate(`/marketing/events/${id}`)
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update event')
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

  return (
    <TransactionForm
      title={`Edit Event ${event.event_code}`}
      fields={fields}
      initialData={event}
      onSubmit={handleSubmit}
      onCancel={() => navigate(`/marketing/events/${id}`)}
      submitLabel="Update Event"
    />
  )
}
