import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Edit } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { fieldOperationsService } from '../../../services/field-operations.service'
import { formatDate } from '../../../utils/format'

export default function VisitsList() {
  const navigate = useNavigate()
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVisits()
  }, [])

  const loadVisits = async () => {
    setLoading(true)
    try {
      const response = await fieldOperationsService.getVisits()
      setVisits(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Failed to load visits:', error)
      setVisits([])
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'visit_number',
      label: 'Visit #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/field-operations/visits/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'visit_date',
      label: 'Date',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'agent_name',
      label: 'Agent',
      sortable: true
    },
    {
      key: 'customer_name',
      label: 'Customer',
      sortable: true
    },
    {
      key: 'visit_type',
      label: 'Type',
      sortable: true
    },
    {
      key: 'duration',
      label: 'Duration',
      sortable: true,
      render: (value: number) => `${value} min`
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          scheduled: 'bg-blue-100 text-blue-800',
          in_progress: 'bg-yellow-100 text-yellow-800',
          completed: 'bg-green-100 text-green-800',
          cancelled: 'bg-red-100 text-red-800'
        }
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[value] || colors.scheduled}`}>
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
            onClick={() => navigate(`/field-operations/visits/${row.id}`)}
            className="p-1 text-gray-600 hover:text-primary-600"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status !== 'completed' && (
            <button
              onClick={() => navigate(`/field-operations/visits/${row.id}/edit`)}
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
      title="Field Visits"
      columns={columns}
      data={visits}
      loading={loading}
      onRefresh={loadVisits}
      createPath="/field-operations/visits/create"
      createLabel="Create Visit"
    />
  )
}
