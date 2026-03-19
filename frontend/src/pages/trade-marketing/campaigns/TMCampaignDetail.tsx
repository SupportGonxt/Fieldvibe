import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { tradeMarketingService } from '../../../services/tradeMarketing.service'
import { formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function TMCampaignDetail() {
  const { id } = useParams()
  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCampaign()
  }, [id])

  const loadCampaign = async () => {
    setLoading(true)
    try {
      const data = await tradeMarketingService.getCampaign(id!)
      setCampaign(data)
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
    { label: 'Campaign Name', value: campaign.campaign_name },
    { label: 'Brand', value: campaign.brand_name },
    { label: 'Start Date', value: formatDate(campaign.start_date) },
    { label: 'End Date', value: formatDate(campaign.end_date) },
    { label: 'Budget', value: campaign.budget ? `R ${Number(campaign.budget).toLocaleString()}` : '-' },
    { label: 'Actual Spend', value: campaign.actual_spend ? `R ${Number(campaign.actual_spend).toLocaleString()}` : '-' },
    { label: 'Target Customers', value: campaign.target_customers },
    { label: 'Actual Reach', value: campaign.actual_reach },
    { label: 'Status', value: campaign.status },
    { label: 'Notes', value: campaign.notes },
    { label: 'Created At', value: formatDate(campaign.created_at) }
  ]

  const statusColor = {
    planned: 'blue',
    active: 'green',
    completed: 'gray',
    cancelled: 'red'
  }[campaign.status] as 'green' | 'yellow' | 'red' | 'gray'

  return (
    <TransactionDetail
      title={`Campaign: ${campaign.campaign_name}`}
      fields={fields}
      auditTrail={campaign.audit_trail || []}
      editPath={`/trade-marketing/campaigns/${id}/edit`}
      backPath="/trade-marketing/campaigns"
      status={campaign.status}
      statusColor={statusColor}
    />
  )
}
