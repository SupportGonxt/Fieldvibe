import { useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { marketingService } from '../../../services/marketing.service'

export default function PromotionCreate() {
  const navigate = useNavigate()

  const fields = [
    {
      name: 'promotion_code',
      label: 'Promotion Code',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., PROMO2025Q1'
    },
    {
      name: 'promotion_name',
      label: 'Promotion Name',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., Summer Sale 2025'
    },
    {
      name: 'promotion_type',
      label: 'Promotion Type',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'TRADE_DISCOUNT', label: 'Trade Discount' },
        { value: 'VOLUME_REBATE', label: 'Volume Rebate' },
        { value: 'DISPLAY_ALLOWANCE', label: 'Display Allowance' },
        { value: 'PERFORMANCE_BONUS', label: 'Performance Bonus' },
        { value: 'CO_OP_ADVERTISING', label: 'Co-op Advertising' },
        { value: 'SLOTTING_FEE', label: 'Slotting Fee' },
        { value: 'FREE_GOODS', label: 'Free Goods' },
        { value: 'MARKDOWN_ALLOWANCE', label: 'Markdown Allowance' }
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
      name: 'discount_percentage',
      label: 'Discount Percentage (%)',
      type: 'number' as const,
      placeholder: 'e.g., 10, 20, 50',
      validation: (value: number) => {
        if (value && (value < 0 || value > 100)) {
          return 'Discount percentage must be between 0 and 100'
        }
        return null
      }
    },
    {
      name: 'discount_amount',
      label: 'Discount Amount (R)',
      type: 'number' as const,
      placeholder: 'Fixed discount amount'
    },
    {
      name: 'minimum_purchase',
      label: 'Minimum Purchase (R)',
      type: 'number' as const,
      placeholder: 'Minimum purchase amount required'
    },
    {
      name: 'description',
      label: 'Promotion Description',
      type: 'textarea' as const,
      required: true,
      placeholder: 'Describe the promotion terms and conditions...'
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const,
      placeholder: 'Add promotion notes...'
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await marketingService.createPromotion(data)
      navigate('/marketing/promotions')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create promotion')
    }
  }

  return (
    <TransactionForm
      title="Create Promotion"
      fields={fields}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/marketing/promotions')}
      submitLabel="Create Promotion"
    />
  )
}
