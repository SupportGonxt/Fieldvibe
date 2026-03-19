import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { fieldOperationsService } from '../../../services/field-operations.service'

export default function ProductDistributionCreate() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])

  useEffect(() => {
    loadFormData()
  }, [])

  const loadFormData = async () => {
    try {
      const [agentsRes, customersRes, productsRes] = await Promise.all([
        fieldOperationsService.getAgents(),
        fieldOperationsService.getCustomers(),
        fieldOperationsService.getProducts()
      ])
      // Agents endpoint returns a flat array; others wrap in { data: ... }
      const agentsList = Array.isArray(agentsRes) ? agentsRes : (agentsRes.data || [])
      // Customers endpoint returns { data: { customers: [...] } }
      const rawCustomers = customersRes.data || customersRes
      const customersList = Array.isArray(rawCustomers) ? rawCustomers : (rawCustomers.customers || [])
      // Products endpoint returns { data: [...] }
      const productsList = Array.isArray(productsRes) ? productsRes : (Array.isArray(productsRes.data) ? productsRes.data : [])
      setAgents(agentsList)
      setCustomers(customersList)
      setProducts(productsList)
    } catch (error) {
      console.error('Failed to load form data:', error)
    }
  }

  const fields = [
    {
      name: 'distribution_date',
      label: 'Distribution Date',
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
      name: 'product_id',
      label: 'Product',
      type: 'select' as const,
      required: true,
      options: products.map((p: any) => ({
        value: p.id.toString(),
        label: p.name
      }))
    },
    {
      name: 'quantity',
      label: 'Quantity',
      type: 'number' as const,
      required: true,
      validation: (value: number) => value <= 0 ? 'Quantity must be greater than 0' : null
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const,
      placeholder: 'Add distribution notes...'
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await fieldOperationsService.createProductDistribution(data)
      navigate('/field-operations/product-distributions')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create product distribution')
    }
  }

  return (
    <TransactionForm
      title="Create Product Distribution"
      fields={fields}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/field-operations/product-distributions')}
      submitLabel="Create Distribution"
    />
  )
}
