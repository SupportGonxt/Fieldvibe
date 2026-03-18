import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { fieldOperationsService } from '../../../services/field-operations.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'

export default function ProductDistributionDetail() {
  const { toast } = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const [distribution, setDistribution] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDistribution()
  }, [id])

  const loadDistribution = async () => {
    setLoading(true)
    try {
      const response = await fieldOperationsService.getProductDistribution(Number(id))
      setDistribution(response.data)
    } catch (error) {
      console.error('Failed to load product distribution:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReverse = async () => {
    if (!confirm('Are you sure you want to reverse this product distribution? This will reverse the commission.')) {
      return
    }

    try {
      await fieldOperationsService.reverseProductDistribution(Number(id))
      navigate('/field-operations/product-distributions')
    } catch (error) {
      console.error('Failed to reverse product distribution:', error)
      toast.error('Failed to reverse product distribution')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!distribution) {
    return <ErrorState title="Product distribution not found" message="The product distribution you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Distribution Number', value: distribution.distribution_number },
    { label: 'Distribution Date', value: formatDate(distribution.distribution_date) },
    { label: 'Agent', value: distribution.agent_name },
    { label: 'Customer', value: distribution.customer_name },
    { label: 'Product', value: distribution.product_name },
    { label: 'Quantity', value: distribution.quantity },
    { label: 'Commission Amount', value: formatCurrency(distribution.commission_amount) },
    { label: 'GPS Location', value: distribution.gps_location },
    { label: 'Status', value: distribution.status },
    { label: 'Notes', value: distribution.notes },
    { label: 'Created By', value: distribution.created_by },
    { label: 'Created At', value: formatDate(distribution.created_at) }
  ]

  const statusColor = {
    distributed: 'green',
    reversed: 'gray'
  }[distribution.status] as 'green' | 'yellow' | 'red' | 'gray'

  return (
    <TransactionDetail
      title={`Product Distribution ${distribution.distribution_number}`}
      fields={fields}
      auditTrail={distribution.audit_trail || []}
      onReverse={distribution.status === 'distributed' ? handleReverse : undefined}
      backPath="/field-operations/product-distributions"
      status={distribution.status}
      statusColor={statusColor}
    />
  )
}
