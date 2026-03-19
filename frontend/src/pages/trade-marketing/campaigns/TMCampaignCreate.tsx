import { useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { tradeMarketingService } from '../../../services/tradeMarketing.service'

export default function TMCampaignCreate() {
  const navigate = useNavigate()

  const fields = [
    {
      name: 'campaign_name',
      label: 'Campaign Name',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., Summer Trade Promotion'
    },
    {
      name: 'brand_name',
      label: 'Brand',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., Goldrush'
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
      required: true,
      validation: (value: number) => value <= 0 ? 'Budget must be greater than 0' : null
    },
    {
      name: 'target_customers',
      label: 'Target Customers',
      type: 'number' as const,
      placeholder: 'Number of target customers'
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
      type: 'textarea' as const,
      placeholder: 'Add campaign notes...'
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await tradeMarketingService.createCampaign(data)
      navigate('/trade-marketing/campaigns')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create campaign')
    }
  }

  return (
    <TransactionForm
      title="Create Trade Marketing Campaign"
      fields={fields}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/trade-marketing/campaigns')}
      submitLabel="Create Campaign"
    />
  )
}
