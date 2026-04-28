import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { marketingService } from '../../../services/marketing.service'

interface Option {
  value: string
  label: string
}

export default function ActivationCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [agents, setAgents] = useState<Option[]>([])
  const [campaigns, setCampaigns] = useState<Option[]>([])
  const [customers, setCustomers] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOptions()
  }, [])

  const loadOptions = async () => {
    setLoading(true)
    try {
      const [agentsRes, campaignsRes, customersRes] = await Promise.allSettled([
        marketingService.getAgents(),
        marketingService.getCampaigns(),
        marketingService.getCustomers(),
      ])
      if (agentsRes.status === 'fulfilled') {
        const list = agentsRes.value?.data?.data || agentsRes.value?.data || []
        setAgents((Array.isArray(list) ? list : []).map((a: any) => ({
          value: String(a.id),
          label: a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || a.id,
        })))
      }
      if (campaignsRes.status === 'fulfilled') {
        const list = campaignsRes.value?.data?.data || campaignsRes.value?.data?.campaigns || campaignsRes.value?.data || []
        setCampaigns((Array.isArray(list) ? list : []).map((c: any) => ({
          value: String(c.id),
          label: c.name || c.title || c.id,
        })))
      }
      if (customersRes.status === 'fulfilled') {
        const list = customersRes.value?.data?.data || customersRes.value?.data?.customers || customersRes.value?.data || []
        setCustomers((Array.isArray(list) ? list : []).map((c: any) => ({
          value: String(c.id),
          label: c.name || c.id,
        })))
      }
    } catch (error) {
      console.error('Failed to load activation form options:', error)
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    {
      name: 'name',
      label: 'Activation Name',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., Mall of Africa weekend demo',
    },
    {
      name: 'campaign_id',
      label: 'Campaign',
      type: 'select' as const,
      required: true,
      options: [{ value: '', label: loading ? 'Loading…' : 'Select a campaign' }, ...campaigns],
    },
    {
      name: 'customer_id',
      label: 'Customer / Store (optional)',
      type: 'select' as const,
      options: [{ value: '', label: loading ? 'Loading…' : 'No customer' }, ...customers],
    },
    {
      name: 'agent_id',
      label: 'Assigned Agent',
      type: 'select' as const,
      options: [{ value: '', label: loading ? 'Loading…' : 'Assign later' }, ...agents],
    },
    {
      name: 'location_description',
      label: 'Location',
      type: 'text' as const,
      placeholder: 'e.g., Sandton City Mall, ground floor',
    },
    {
      name: 'scheduled_start',
      label: 'Scheduled Start',
      type: 'date' as const,
      required: true,
    },
    {
      name: 'scheduled_end',
      label: 'Scheduled End',
      type: 'date' as const,
    },
  ]

  // Prefill from query params (e.g. ?brand_id=... is unused server-side but ?campaign_id= is honoured).
  const initialData = (() => {
    const v: Record<string, any> = {}
    const cid = searchParams.get('campaign_id')
    if (cid) v.campaign_id = cid
    return v
  })()

  const handleSubmit = async (data: any) => {
    // Strip empty strings so the backend's COALESCE / nullable defaults take effect.
    const payload: Record<string, any> = {}
    for (const [k, val] of Object.entries(data)) {
      if (val !== '' && val != null) payload[k] = val
    }
    if (!payload.campaign_id) {
      throw new Error('Campaign is required')
    }
    try {
      await marketingService.createActivation(payload)
      navigate('/marketing/activations')
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to create activation')
    }
  }

  return (
    <TransactionForm
      title="Schedule Brand Activation"
      fields={fields}
      initialData={initialData}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/marketing/activations')}
      submitLabel="Schedule Activation"
    />
  )
}
