import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { tradeMarketingService } from '../../../services/tradeMarketing.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function TMCampaignEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
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

  const fields = [
    {
      name: 'campaign_name',
      label: 'Campaign Name',
      type: 'text' as const,
      required: true
    },
    {
      name: 'brand_name',
      label: 'Brand',
      type: 'text' as const,
      required: true
    },
    {
      name: 'start_date',
      label: 'Start Date',
      type: 'date' as const,
      required: true
    },
    {
      name: 'end_date',
      label: 'End Date',
      type: 'date' as const,
      required: true
    },
    {
      name: 'budget',
      label: 'Budget (R)',
      type: 'number' as const,
      required: true
    },
    {
      name: 'target_customers',
      label: 'Target Customers',
      type: 'number' as const
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'planned', label: 'Planned' },
        { value: 'active', label: 'Active' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' }
      ]
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await tradeMarketingService.updateCampaign(id!, data)
      navigate(`/trade-marketing/campaigns/${id}`)
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update campaign')
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

  return (
    <TransactionForm
      title={`Edit Campaign: ${campaign.campaign_name}`}
      fields={fields}
      initialData={campaign}
      onSubmit={handleSubmit}
      onCancel={() => navigate(`/trade-marketing/campaigns/${id}`)}
      submitLabel="Update Campaign"
    />
  )
}
