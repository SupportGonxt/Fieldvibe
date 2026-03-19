import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { marketingService } from '../../../services/marketing.service'
import { formatDate } from '../../../utils/format'

export default function ActivationsList() {
  const navigate = useNavigate()
  const [activations, setActivations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActivations()
  }, [])

  const loadActivations = async () => {
    setLoading(true)
    try {
      const response = await marketingService.getActivations()
      setActivations(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load activations:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'activation_code',
      label: 'Activation Code',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/marketing/activations/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'activation_name',
      label: 'Activation Name',
      sortable: true
    },
    {
      key: 'activation_type',
      label: 'Type',
      sortable: true
    },
    {
      key: 'activation_date',
      label: 'Date',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'location',
      label: 'Location',
      sortable: true
    },
    {
      key: 'agent_name',
      label: 'Agent',
      sortable: true
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          planned: 'bg-blue-100 text-blue-800',
          in_progress: 'bg-yellow-100 text-yellow-800',
          completed: 'bg-green-100 text-green-800',
          cancelled: 'bg-red-100 text-red-800'
        }
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[value] || colors.planned}`}>
            {value.replace('_', ' ')}
          </span>
        )
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <button
          onClick={() => navigate(`/marketing/activations/${row.id}`)}
          className="p-1 text-gray-600 hover:text-primary-600"
          title="View"
        >
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ]

  return (
    <TransactionList
      title="Marketing Activations"
      columns={columns}
      data={activations}
      loading={loading}
      onRefresh={loadActivations}
      createPath="/marketing/activations/create"
      createLabel="Create Activation"
    />
  )
}
