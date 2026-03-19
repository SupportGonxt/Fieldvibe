import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionForm from '../../../components/transactions/TransactionForm'
import { vanSalesService } from '../../../services/van-sales.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function VanSalesOrderEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<any>(null)
  const [customers, setCustomers] = useState([])
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [orderRes, customersRes, routesRes] = await Promise.all([
        vanSalesService.getOrder(Number(id)),
        vanSalesService.getCustomers(),
        vanSalesService.getRoutes()
      ])
      const orderData = orderRes?.data !== undefined ? orderRes.data : orderRes
      setOrder(orderData)
      const rawCustomers = customersRes.data || customersRes
      setCustomers(Array.isArray(rawCustomers) ? rawCustomers : (rawCustomers.customers || []))
      const rawRoutes = routesRes.data || routesRes
      setRoutes(Array.isArray(rawRoutes) ? rawRoutes : (rawRoutes.routes || []))
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
      name: 'route_id',
      label: 'Route',
      type: 'select' as const,
      required: true,
      options: routes.map((r: any) => ({
        value: r.id.toString(),
        label: r.name
      }))
    },
    {
      name: 'delivery_date',
      label: 'Delivery Date',
      type: 'date' as const,
      required: true
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
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const,
      placeholder: 'Add any notes or special instructions...'
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await vanSalesService.updateOrder(Number(id), data)
      navigate(`/van-sales/orders/${id}`)
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
      onCancel={() => navigate(`/van-sales/orders/${id}`)}
      submitLabel="Update Order"
    />
  )
}
