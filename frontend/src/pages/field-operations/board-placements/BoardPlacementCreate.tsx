import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { fieldOperationsService } from '../../../services/field-operations.service'

export default function BoardPlacementCreate() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])
  const [customers, setCustomers] = useState([])
  const [boardTypes, setBoardTypes] = useState([])

  useEffect(() => {
    loadFormData()
  }, [])

  const loadFormData = async () => {
    try {
      const [agentsRes, customersRes, boardTypesRes] = await Promise.all([
        fieldOperationsService.getAgents(),
        fieldOperationsService.getCustomers(),
        fieldOperationsService.getBoardTypes()
      ])
      // Agents endpoint returns a flat array; others wrap in { data: ... }
      const agentsList = Array.isArray(agentsRes) ? agentsRes : (agentsRes.data || [])
      // Customers endpoint returns { data: { customers: [...] } }
      const rawCustomers = customersRes.data || customersRes
      const customersList = Array.isArray(rawCustomers) ? rawCustomers : (rawCustomers.customers || [])
      // Board types endpoint returns { data: [...] }
      const boardTypesList = Array.isArray(boardTypesRes) ? boardTypesRes : (Array.isArray(boardTypesRes.data) ? boardTypesRes.data : [])
      setAgents(agentsList)
      setCustomers(customersList)
      setBoardTypes(boardTypesList)
    } catch (error) {
      console.error('Failed to load form data:', error)
    }
  }

  const fields = [
    {
      name: 'placement_date',
      label: 'Placement Date',
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
      name: 'board_type_id',
      label: 'Board Type',
      type: 'select' as const,
      required: true,
      options: boardTypes.map((b: any) => ({
        value: b.id.toString(),
        label: `${b.name} (${b.dimensions})`
      }))
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const,
      placeholder: 'Add placement notes or location details...'
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await fieldOperationsService.createBoardPlacement(data)
      navigate('/field-operations/board-placements')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create board placement')
    }
  }

  return (
    <TransactionForm
      title="Create Board Placement"
      fields={fields}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/field-operations/board-placements')}
      submitLabel="Create Placement"
    />
  )
}
