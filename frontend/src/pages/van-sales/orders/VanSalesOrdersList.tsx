import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Edit, RotateCcw } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { vanSalesService } from '../../../services/van-sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import { useToast } from '../../../components/ui/Toast'

export default function VanSalesOrdersList() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const response = await vanSalesService.getOrders()
      // API returns { success: true, data: [...] }, axios wraps it in response.data
      const orders = response.data?.data || response.data?.orders || response.data || []
      setOrders(Array.isArray(orders) ? orders : [])
    } catch (error) {
      console.error('Failed to load orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'order_number',
      label: 'Order #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/van-sales/orders/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'order_date',
      label: 'Date',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'customer_name',
      label: 'Customer',
      sortable: true
    },
    {
      key: 'route_name',
      label: 'Route',
      sortable: true
    },
    {
      key: 'total_amount',
      label: 'Amount',
      sortable: true,
      render: (value: number) => formatCurrency(value)
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-800',
          confirmed: 'bg-blue-100 text-blue-800',
          delivered: 'bg-green-100 text-green-800',
          cancelled: 'bg-red-100 text-red-800',
          reversed: 'bg-gray-100 text-gray-800'
        }
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[value] || colors.pending}`}>
            {value}
          </span>
        )
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/van-sales/orders/${row.id}`)}
            className="p-1 text-gray-600 hover:text-primary-600"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status === 'pending' && (
            <button
              onClick={() => navigate(`/van-sales/orders/${row.id}/edit`)}
              className="p-1 text-gray-600 hover:text-primary-600"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {row.status === 'delivered' && (
            <button
              onClick={() => handleReverse(row.id)}
              className="p-1 text-gray-600 hover:text-red-600"
              title="Reverse"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  const handleReverse = async (orderId: number) => {
    if (!window.confirm('Are you sure you want to reverse this order?')) return

    try {
      await vanSalesService.reverseOrder(orderId)
      loadOrders()
    } catch (error) {
      console.error('Failed to reverse order:', error)
      toast.error('Failed to reverse order')
    }
  }

  return (
    <TransactionList
      title="Van Sales Orders"
      columns={columns}
      data={orders}
      loading={loading}
      onRefresh={loadOrders}
      createPath="/van-sales/orders/create"
      createLabel="Create Order"
    />
  )
}
