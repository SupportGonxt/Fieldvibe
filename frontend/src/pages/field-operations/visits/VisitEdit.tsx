import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { fieldOperationsService } from '../../../services/field-operations.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function VisitEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [visit, setVisit] = useState<any>(null)
  const [agents, setAgents] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [visitRes, agentsRes, customersRes] = await Promise.all([
        fieldOperationsService.getVisit(Number(id)),
        fieldOperationsService.getAgents(),
        fieldOperationsService.getCustomers()
      ])
      const visitData = visitRes?.data !== undefined ? visitRes.data : visitRes
      setVisit(visitData)
      // Agents endpoint returns a flat array
      const agentsList = Array.isArray(agentsRes) ? agentsRes : (agentsRes.data || [])
      // Customers endpoint returns { data: { customers: [...] } }
      const rawCustomers = customersRes.data || customersRes
      const customersList = Array.isArray(rawCustomers) ? rawCustomers : (rawCustomers.customers || [])
      setAgents(agentsList)
      setCustomers(customersList)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    {
      name: 'visit_date',
      label: 'Visit Date',
      type: 'date' as const,
      required: true
    },
    {
      name: 'agent_id',
      label: 'Agent',
      type: 'select' as const,
      required: true,
      options: agents.map((a: any) => ({
        value: a.id.toString(),
        label: a.name
      }))
    },
    {
      name: 'customer_id',
      label: 'Customer',
      type: 'select' as const,
      required: true,
      options: customers.map((c: any) => ({
        value: c.id.toString(),
        label: c.name
      }))
    },
    {
      name: 'visit_type',
      label: 'Visit Type',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'sales', label: 'Sales Visit' },
        { value: 'survey', label: 'Survey' },
        { value: 'board_placement', label: 'Board Placement' },
        { value: 'product_distribution', label: 'Product Distribution' },
        { value: 'follow_up', label: 'Follow Up' }
      ]
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const,
      placeholder: 'Add visit notes or objectives...'
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await fieldOperationsService.updateVisit(Number(id), data)
      navigate(`/field-operations/visits/${id}`)
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update visit')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!visit) {
    return <ErrorState title="Visit not found" message="The visit you are looking for does not exist or has been deleted." />
  }

  return (
    <TransactionForm
      title={`Edit Visit ${visit.visit_number}`}
      fields={fields}
      initialData={visit}
      onSubmit={handleSubmit}
      onCancel={() => navigate(`/field-operations/visits/${id}`)}
      submitLabel="Update Visit"
    />
  )
}
