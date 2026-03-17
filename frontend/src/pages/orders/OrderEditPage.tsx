import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionForm from '../../components/transactions/TransactionForm'
import { ordersService } from '../../services/orders.service'
import { customersService } from '../../services/customers.service'
import ErrorState from '../../components/ui/ErrorState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function OrderEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<any>(null)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      // Use Promise.allSettled to handle partial failures gracefully
      const [orderRes, customersRes] = await Promise.allSettled([
        ordersService.getOrder(id!),
        customersService.getCustomers()
      ])
      if (orderRes.status === 'fulfilled') {
        setOrder(orderRes.value)
      }
      if (customersRes.status === 'fulfilled') {
        setCustomers(customersRes.value.customers || [])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    {
      name: 'order_number',
      label: 'Order Number',
      type: 'text' as const,
      required: true,
      disabled: true
    },
    {
      name: 'created_at',
      label: 'Order Date',
      type: 'date' as const,
      disabled: true
    },
    {
      name: 'customer_id',
      label: 'Customer',
      type: 'select' as const,
      required: true,
      options: customers.map((c: any) => ({
        value: c.id,
        label: c.name
      }))
    },
    {
      name: 'delivery_date',
      label: 'Delivery Date',
      type: 'date' as const
    },
    {
      name: 'payment_method',
      label: 'Payment Method',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'cash', label: 'Cash' },
        { value: 'credit', label: 'Credit' },
        { value: 'mobile_money', label: 'Mobile Money' }
      ]
    },
    {
      name: 'payment_status',
      label: 'Payment Status',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'paid', label: 'Paid' },
        { value: 'partial', label: 'Partial' },
        { value: 'failed', label: 'Failed' }
      ]
    },
    {
      name: 'status',
      label: 'Order Status',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'processing', label: 'Processing' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'delivered', label: 'Delivered' }
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
      await ordersService.updateOrder(id!, data)
      navigate(`/orders/${id}`)
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
      title={`Edit Order ${order.order_number}`}
      fields={fields}
      initialData={order}
      onSubmit={handleSubmit}
      onCancel={() => navigate(`/orders/${id}`)}
      submitLabel="Update Order"
    />
  )
}
