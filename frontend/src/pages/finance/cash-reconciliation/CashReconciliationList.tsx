import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { financeService } from '../../../services/finance.service'
import { formatCurrency, formatDate } from '../../../utils/format'

export default function CashReconciliationList() {
  const navigate = useNavigate()
  const [reconciliations, setReconciliations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReconciliations()
  }, [])

  const loadReconciliations = async () => {
    setLoading(true)
    try {
      const response = await financeService.getCashReconciliations()
      setReconciliations(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load cash reconciliations:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'reconciliation_number',
      label: 'Reconciliation #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/finance/cash-reconciliation/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'reconciliation_date',
      label: 'Date',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'agent_name',
      label: 'Agent',
      sortable: true
    },
    {
      key: 'expected_cash',
      label: 'Expected Cash',
      sortable: true,
      render: (value: number) => formatCurrency(value)
    },
    {
      key: 'actual_cash',
      label: 'Actual Cash',
      sortable: true,
      render: (value: number) => formatCurrency(value)
    },
    {
      key: 'variance',
      label: 'Variance',
      sortable: true,
      render: (value: number) => (
        <span className={value !== 0 ? 'text-red-600 font-medium' : ''}>
          {formatCurrency(value)}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-800',
          reconciled: 'bg-green-100 text-green-800',
          variance: 'bg-red-100 text-red-800'
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
          onClick={() => navigate(`/finance/cash-reconciliation/${row.id}`)}
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
      title="Cash Reconciliation"
      columns={columns}
      data={reconciliations}
      loading={loading}
      onRefresh={loadReconciliations}
      createPath="/finance/cash-reconciliation/create"
      createLabel="Create Reconciliation"
    />
  )
}
