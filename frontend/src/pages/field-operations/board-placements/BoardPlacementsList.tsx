import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, RotateCcw } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { fieldOperationsService } from '../../../services/field-operations.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import { useToast } from '../../../components/ui/Toast'

export default function BoardPlacementsList() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [placements, setPlacements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPlacements()
  }, [])

  const loadPlacements = async () => {
    setLoading(true)
    try {
      const response = await fieldOperationsService.getBoardPlacements()
      setPlacements(response.data || [])
    } catch (error) {
      console.error('Failed to load board placements:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReverse = async (placementId: number) => {
    if (!window.confirm('Are you sure you want to reverse this board placement?')) return

    try {
      await fieldOperationsService.reverseBoardPlacement(placementId)
      loadPlacements()
    } catch (error) {
      console.error('Failed to reverse board placement:', error)
      toast.error('Failed to reverse board placement')
    }
  }

  const columns = [
    {
      key: 'placement_number',
      label: 'Placement #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/field-operations/board-placements/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'placement_date',
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
      key: 'board_type',
      label: 'Board Type',
      sortable: true
    },
    {
      key: 'commission_amount',
      label: 'Commission',
      sortable: true,
      render: (value: number) => formatCurrency(value)
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          active: 'bg-green-100 text-green-800',
          removed: 'bg-red-100 text-red-800',
          reversed: 'bg-gray-100 text-gray-800'
        }
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[value] || colors.active}`}>
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
            onClick={() => navigate(`/field-operations/board-placements/${row.id}`)}
            className="p-1 text-gray-600 hover:text-primary-600"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status === 'active' && (
            <button
              onClick={() => handleReverse(row.id)}
              className="p-1 text-gray-600 hover:text-red-600"
              title="Reverse"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  return (
    <TransactionList
      title="Board Placements"
      columns={columns}
      data={placements}
      loading={loading}
      onRefresh={loadPlacements}
      createPath="/field-operations/board-placements/create"
      createLabel="Create Placement"
    />
  )
}
