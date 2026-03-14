import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { marketingService } from '../../../services/marketing.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function CampaignEdit() {
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
      const response = await marketingService.getCampaign(Number(id))
      setCampaign(response.data)
    } catch (error) {
      console.error('Failed to load campaign:', error)
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    {
      name: 'campaign_code',
      label: 'Campaign Code',
      type: 'text' as const,
      required: true,
      disabled: true
    },
    {
      name: 'campaign_name',
      label: 'Campaign Name',
      type: 'text' as const,
      required: true
    },
    {
      name: 'campaign_type',
      label: 'Campaign Type',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'brand_awareness', label: 'Brand Awareness' },
        { value: 'product_launch', label: 'Product Launch' },
        { value: 'seasonal', label: 'Seasonal' },
        { value: 'promotional', label: 'Promotional' },
        { value: 'loyalty', label: 'Loyalty' }
      ]
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
      name: 'target_audience',
      label: 'Target Audience',
      type: 'text' as const
    },
    {
      name: 'objectives',
      label: 'Campaign Objectives',
      type: 'textarea' as const,
      required: true
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await marketingService.updateCampaign(Number(id), data)
      navigate(`/marketing/campaigns/${id}`)
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
      title={`Edit Campaign ${campaign.campaign_code}`}
      fields={fields}
      initialData={campaign}
      onSubmit={handleSubmit}
      onCancel={() => navigate(`/marketing/campaigns/${id}`)}
      submitLabel="Update Campaign"
    />
  )
}
