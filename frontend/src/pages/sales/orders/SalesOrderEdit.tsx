import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { salesService } from '../../../services/sales.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function SalesOrderEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<any>(null)
  const [customers, setCustomers] = useState([])
  const [salesReps, setSalesReps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [orderRes, customersRes, salesRepsRes] = await Promise.all([
        salesService.getOrder(id!),
        salesService.getCustomers(),
        salesService.getSalesReps()
      ])
      setOrder(orderRes.data)
      setCustomers(customersRes.data || [])
      setSalesReps(salesRepsRes.data || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    {
      name: 'order_date',
      label: 'Order Date',
      type: 'date' as const,
      required: true
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
      name: 'sales_rep_id',
      label: 'Sales Rep',
      type: 'select' as const,
      required: true,
      options: salesReps.map((s: any) => ({
        value: s.id.toString(),
        label: s.name
      }))
    },
    {
      name: 'delivery_date',
      label: 'Delivery Date',
      type: 'date' as const,
      required: true
    },
    {
      name: 'payment_terms',
      label: 'Payment Terms',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'cash', label: 'Cash' },
        { value: 'credit_7', label: 'Credit 7 Days' },
        { value: 'credit_30', label: 'Credit 30 Days' },
        { value: 'credit_60', label: 'Credit 60 Days' }
      ]
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const,
      placeholder: 'Add order notes...'
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await salesService.updateOrder(id!, data)
      navigate(`/sales/orders/${id}`)
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update order')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!order) {
    return <ErrorState title="Order not found" message="The order you are looking for does not exist or has been deleted." />
  }

  return (
    <TransactionForm
      title={`Edit Sales Order ${order.order_number}`}
      fields={fields}
      initialData={order}
      onSubmit={handleSubmit}
      onCancel={() => navigate(`/sales/orders/${id}`)}
      submitLabel="Update Order"
    />
  )
}
