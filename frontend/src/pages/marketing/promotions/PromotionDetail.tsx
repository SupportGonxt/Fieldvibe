import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { marketingService } from '../../../services/marketing.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function PromotionDetail() {
  const { id } = useParams()
  const [promotion, setPromotion] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPromotion()
  }, [id])

  const loadPromotion = async () => {
    setLoading(true)
    try {
      const response = await marketingService.getPromotion(Number(id))
      setPromotion(response.data)
    } catch (error) {
      console.error('Failed to load promotion:', error)
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

  if (!promotion) {
    return <ErrorState title="Promotion not found" message="The promotion you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Promotion Code', value: promotion.promotion_code },
    { label: 'Promotion Name', value: promotion.promotion_name },
    { label: 'Promotion Type', value: promotion.promotion_type },
    { label: 'Start Date', value: formatDate(promotion.start_date) },
    { label: 'End Date', value: formatDate(promotion.end_date) },
    { label: 'Discount Percentage', value: promotion.discount_percentage ? `${promotion.discount_percentage}%` : '-' },
    { label: 'Discount Amount', value: promotion.discount_amount ? formatCurrency(promotion.discount_amount) : '-' },
    { label: 'Minimum Purchase', value: promotion.minimum_purchase ? formatCurrency(promotion.minimum_purchase) : '-' },
    { label: 'Usage Count', value: promotion.usage_count || 0 },
    { label: 'Description', value: promotion.description },
    { label: 'Status', value: promotion.status },
    { label: 'Notes', value: promotion.notes },
    { label: 'Created By', value: promotion.created_by },
    { label: 'Created At', value: formatDate(promotion.created_at) }
  ]

  const statusColor = {
    draft: 'gray',
    active: 'green',
    expired: 'gray',
    cancelled: 'red'
  }[promotion.status] as 'green' | 'yellow' | 'red' | 'gray'

  return (
    <TransactionDetail
      title={`Promotion ${promotion.promotion_code}`}
      fields={fields}
      auditTrail={promotion.audit_trail || []}
      backPath="/marketing/promotions"
      status={promotion.status}
      statusColor={statusColor}
    />
  )
}
