import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { marketingService } from '../../../services/marketing.service'

export default function ActivationCreate() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const response = await marketingService.getAgents()
      const rawAgents = response.data?.data || response.data || []
      setAgents(Array.isArray(rawAgents) ? rawAgents : [])
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  const fields = [
    {
      name: 'activation_code',
      label: 'Activation Code',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., ACT2025001'
    },
    {
      name: 'activation_name',
      label: 'Activation Name',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., Store Activation - Mall of Africa'
    },
    {
      name: 'activation_type',
      label: 'Activation Type',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'sampling', label: 'Product Sampling' },
        { value: 'demonstration', label: 'Product Demonstration' },
        { value: 'merchandising', label: 'Merchandising' },
        { value: 'brand_visibility', label: 'Brand Visibility' },
        { value: 'consumer_engagement', label: 'Consumer Engagement' }
      ]
    },
    {
      name: 'activation_date',
      label: 'Activation Date',
      type: 'date' as const,
      required: true
    },
    {
      name: 'location',
      label: 'Location',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., Sandton City Mall'
    },
    {
      name: 'agent_id',
      label: 'Assigned Agent',
      type: 'select' as const,
      required: true,
      options: agents.map((a: any) => ({
        value: a.id.toString(),
        label: a.name
      }))
    },
    {
      name: 'description',
      label: 'Activation Description',
      type: 'textarea' as const,
      required: true,
      placeholder: 'Describe the activation activities...'
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const,
      placeholder: 'Add activation notes...'
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await marketingService.createActivation(data)
      navigate('/marketing/activations')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create activation')
    }
  }

  return (
    <TransactionForm
      title="Create Marketing Activation"
      fields={fields}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/marketing/activations')}
      submitLabel="Create Activation"
    />
  )
}
