import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { marketingService } from '../../../services/marketing.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function CampaignDetail() {
  const { id } = useParams()
  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCampaign()
  }, [id])

  const loadCampaign = async () => {
    setLoading(true)
    try {
      const response = await marketingService.getCampaign(Number(id))
      setCampaign(response.data)
    } catch (error) {
      console.error('Failed to load campaign:', error)
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

  if (!campaign) {
    return <ErrorState title="Campaign not found" message="The campaign you are looking for does not exist or has been deleted." />
  }

  const fields = [
    { label: 'Campaign Code', value: campaign.campaign_code },
    { label: 'Campaign Name', value: campaign.campaign_name },
    { label: 'Campaign Type', value: campaign.campaign_type },
    { label: 'Start Date', value: formatDate(campaign.start_date) },
    { label: 'End Date', value: formatDate(campaign.end_date) },
    { label: 'Budget', value: formatCurrency(campaign.budget) },
    { label: 'Actual Spend', value: formatCurrency(campaign.actual_spend || 0) },
    { label: 'Budget Variance', value: formatCurrency((campaign.budget || 0) - (campaign.actual_spend || 0)) },
    { label: 'Target Audience', value: campaign.target_audience },
    { label: 'Objectives', value: campaign.objectives },
    { label: 'Status', value: campaign.status },
    { label: 'Notes', value: campaign.notes },
    { label: 'Created By', value: campaign.created_by },
    { label: 'Created At', value: formatDate(campaign.created_at) }
  ]

  const statusColor = {
    draft: 'gray',
    planned: 'blue',
    active: 'green',
    completed: 'gray',
    cancelled: 'red'
  }[campaign.status] as 'green' | 'yellow' | 'red' | 'gray'

  return (
    <TransactionDetail
      title={`Campaign ${campaign.campaign_code}`}
      fields={fields}
      auditTrail={campaign.audit_trail || []}
      editPath={(campaign.status === 'draft' || campaign.status === 'planned') ? `/marketing/campaigns/${id}/edit` : undefined}
      backPath="/marketing/campaigns"
      status={campaign.status}
      statusColor={statusColor}
    />
  )
}
