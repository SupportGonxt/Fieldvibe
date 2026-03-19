import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { financeService } from '../../../services/finance.service'
import { formatCurrency, formatDate } from '../../../utils/format'

export default function CommissionPayoutsList() {
  const navigate = useNavigate()
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayouts()
  }, [])

  const loadPayouts = async () => {
    setLoading(true)
    try {
      const response = await financeService.getCommissionPayouts()
      setPayouts(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load commission payouts:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'payout_number',
      label: 'Payout #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/finance/commission-payouts/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'payout_date',
      label: 'Payout Date',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'agent_name',
      label: 'Agent',
      sortable: true
    },
    {
      key: 'period_start',
      label: 'Period Start',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'period_end',
      label: 'Period End',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'total_commission',
      label: 'Commission',
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
          approved: 'bg-green-100 text-green-800',
          paid: 'bg-blue-100 text-blue-800',
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
          onClick={() => navigate(`/finance/commission-payouts/${row.id}`)}
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
      title="Commission Payouts"
      columns={columns}
      data={payouts}
      loading={loading}
      onRefresh={loadPayouts}
    />
  )
}
