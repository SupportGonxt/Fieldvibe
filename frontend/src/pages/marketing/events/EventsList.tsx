import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Edit } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { marketingService } from '../../../services/marketing.service'
import { formatCurrency, formatDate } from '../../../utils/format'

export default function EventsList() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    setLoading(true)
    try {
      const response = await marketingService.getEvents()
      setEvents(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'event_code',
      label: 'Event Code',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/marketing/events/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'event_name',
      label: 'Event Name',
      sortable: true
    },
    {
      key: 'event_date',
      label: 'Event Date',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'location',
      label: 'Location',
      sortable: true
    },
    {
      key: 'budget',
      label: 'Budget',
      sortable: true,
      render: (value: number) => formatCurrency(value)
    },
    {
      key: 'attendees',
      label: 'Attendees',
      sortable: true
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          draft: 'bg-gray-100 text-gray-800',
          planned: 'bg-blue-100 text-blue-800',
          confirmed: 'bg-green-100 text-green-800',
          completed: 'bg-gray-100 text-gray-800',
          cancelled: 'bg-red-100 text-red-800'
        }
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[value] || colors.draft}`}>
            {value}
          </span>
        )
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/marketing/events/${row.id}`)}
            className="p-1 text-gray-600 hover:text-primary-600"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {(row.status === 'draft' || row.status === 'planned') && (
            <button
              onClick={() => navigate(`/marketing/events/${row.id}/edit`)}
              className="p-1 text-gray-600 hover:text-primary-600"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  return (
    <TransactionList
      title="Marketing Events"
      columns={columns}
      data={events}
      loading={loading}
      onRefresh={loadEvents}
      createPath="/marketing/events/create"
      createLabel="Create Event"
    />
  )
}
