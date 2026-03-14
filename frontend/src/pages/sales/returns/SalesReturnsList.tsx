import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'

export default function SalesReturnsList() {
  const navigate = useNavigate()
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReturns()
  }, [])

  const loadReturns = async () => {
    setLoading(true)
    try {
      const response = await salesService.getReturns()
      // API returns { success: true, data: [...] }, axios wraps in response.data
      const returnsData = response.data?.data || response.data || []
      setReturns(Array.isArray(returnsData) ? returnsData : [])
    } catch (error) {
      console.error('Failed to load returns:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'return_number',
      label: 'Return #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/sales/returns/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'return_date',
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
      key: 'order_number',
      label: 'Order #',
      sortable: true
    },
    {
      key: 'return_amount',
      label: 'Amount',
      sortable: true,
      render: (value: number) => formatCurrency(value)
    },
    {
      key: 'reason',
      label: 'Reason',
      sortable: true
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-800',
          approved: 'bg-green-100 text-green-800',
          rejected: 'bg-red-100 text-red-800',
          processed: 'bg-blue-100 text-blue-800'
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
        <button
          onClick={() => navigate(`/sales/returns/${row.id}`)}
          className="p-1 text-gray-600 hover:text-primary-600"
          title="View"
        >
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ]

  return (
    <TransactionList
      title="Sales Returns"
      columns={columns}
      data={returns}
      loading={loading}
      onRefresh={loadReturns}
      createPath="/sales/returns/create"
      createLabel="Create Return"
    />
  )
}
