import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { vanSalesService } from '../../../services/van-sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'

export default function VanSalesReturnsList() {
  const navigate = useNavigate()
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReturns()
  }, [])

  const loadReturns = async () => {
    setLoading(true)
    try {
      const response = await vanSalesService.getReturns()
      // API returns { success: true, data: [...] }, axios wraps it in response.data
      const returns = response.data?.data || response.data?.returns || response.data || []
      setReturns(Array.isArray(returns) ? returns : [])
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
          onClick={() => navigate(`/van-sales/returns/${row.id}`)}
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
      key: 'original_order',
      label: 'Original Order',
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
          rejected: 'bg-red-100 text-red-800'
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
          onClick={() => navigate(`/van-sales/returns/${row.id}`)}
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
      title="Van Sales Returns"
      columns={columns}
      data={returns}
      loading={loading}
      onRefresh={loadReturns}
      createPath="/van-sales/returns/create"
      createLabel="Create Return"
    />
  )
}
