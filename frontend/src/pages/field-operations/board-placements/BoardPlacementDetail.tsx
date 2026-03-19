import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { fieldOperationsService } from '../../../services/field-operations.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'

export default function BoardPlacementDetail() {
  const { toast } = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const [placement, setPlacement] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPlacement()
  }, [id])

  const loadPlacement = async () => {
    setLoading(true)
    try {
      const response = await fieldOperationsService.getBoardPlacement(Number(id))
      setPlacement(response.data)
    } catch (error) {
      console.error('Failed to load board placement:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReverse = async () => {
    if (!window.confirm('Are you sure you want to reverse this board placement? This will reverse the commission.')) {
      return
    }

    try {
      await fieldOperationsService.reverseBoardPlacement(Number(id))
      navigate('/field-operations/board-placements')
    } catch (error) {
      console.error('Failed to reverse board placement:', error)
      toast.error('Failed to reverse board placement')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!placement) {
    return <ErrorState title="Board placement not found" message="The board placement you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Placement Number', value: placement.placement_number },
    { label: 'Placement Date', value: formatDate(placement.placement_date) },
    { label: 'Agent', value: placement.agent_name },
    { label: 'Customer', value: placement.customer_name },
    { label: 'Board Type', value: placement.board_type },
    { label: 'Dimensions', value: placement.dimensions },
    { label: 'Commission Amount', value: formatCurrency(placement.commission_amount) },
    { label: 'GPS Location', value: placement.gps_location },
    { label: 'Photo URL', value: placement.photo_url },
    { label: 'Status', value: placement.status },
    { label: 'Notes', value: placement.notes },
    { label: 'Created By', value: placement.created_by },
    { label: 'Created At', value: formatDate(placement.created_at) }
  ]

  const statusColor = {
    active: 'green',
    removed: 'red',
    reversed: 'gray'
  }[placement.status] as 'green' | 'yellow' | 'red' | 'gray'

  return (
    <TransactionDetail
      title={`Board Placement ${placement.placement_number}`}
      fields={fields}
      auditTrail={placement.audit_trail || []}
      onReverse={placement.status === 'active' ? handleReverse : undefined}
      backPath="/field-operations/board-placements"
      status={placement.status}
      statusColor={statusColor}
    />
  )
}
