import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  PROCESSED: 'bg-blue-100 text-blue-800',
  processed: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function SalesReturnsList() {
  const navigate = useNavigate()
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadReturns() }, [])

  const loadReturns = async () => {
    setLoading(true)
    try {
      const response = await salesService.getReturns()
      const list = response.data?.data || response.data || []
      setReturns(Array.isArray(list) ? list : [])
    } catch (error) {
      console.error('Failed to load returns:', error)
      setReturns([])
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
          {value || '—'}
        </button>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (value: string) => (value ? formatDate(value) : '—'),
    },
    { key: 'customer_name', label: 'Customer', sortable: true },
    { key: 'order_number', label: 'Order #', sortable: true },
    {
      key: 'total_credit_amount',
      label: 'Gross',
      sortable: true,
      render: (value: number, row: any) => formatCurrency(Number(value ?? row.return_amount ?? 0)),
    },
    {
      key: 'restock_fee',
      label: 'Restock fee',
      sortable: true,
      render: (value: number) => formatCurrency(Number(value || 0)),
    },
    {
      key: 'net_credit_amount',
      label: 'Net credit',
      sortable: true,
      render: (value: number) => formatCurrency(Number(value || 0)),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[value] || 'bg-gray-100 text-gray-800'}`}>
          {String(value || '').toLowerCase()}
        </span>
      ),
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
      ),
    },
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
