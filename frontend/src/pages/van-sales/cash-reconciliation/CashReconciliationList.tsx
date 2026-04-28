import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { vanSalesService } from '../../../services/van-sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  reconciled: 'bg-green-100 text-green-800',
}

export default function CashReconciliationList() {
  const navigate = useNavigate()
  const [reconciliations, setReconciliations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadReconciliations() }, [])

  const loadReconciliations = async () => {
    setLoading(true)
    try {
      const response = await vanSalesService.getCashReconciliations()
      const list = Array.isArray(response.data) ? response.data : (response.data?.data || response.data || [])
      setReconciliations(Array.isArray(list) ? list : [])
    } catch (error) {
      console.error('Failed to load reconciliations:', error)
      setReconciliations([])
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'id',
      label: 'Reconciliation ID',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/van-sales/cash-reconciliation/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium text-xs"
        >
          {String(value || '').slice(0, 8)}…
        </button>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (value: string) => (value ? formatDate(value) : '—'),
    },
    {
      key: 'vehicle_reg',
      label: 'Van',
      sortable: true,
      render: (value: string) => value || '—',
    },
    {
      key: 'agent_name',
      label: 'Agent',
      sortable: true,
      render: (value: string) => value || '—',
    },
    {
      key: 'cash_expected',
      label: 'Expected',
      sortable: true,
      render: (value: number, row: any) => formatCurrency(Number(value ?? row.expected_cash ?? 0)),
    },
    {
      key: 'cash_actual',
      label: 'Actual',
      sortable: true,
      render: (value: number, row: any) => formatCurrency(Number(value ?? row.actual_cash ?? 0)),
    },
    {
      key: 'variance',
      label: 'Variance',
      sortable: true,
      render: (value: number) => {
        const v = Number(value || 0)
        return (
          <span className={v !== 0 ? (v < 0 ? 'text-red-600 font-medium' : 'text-amber-700 font-medium') : 'text-green-600'}>
            {formatCurrency(v)}
          </span>
        )
      },
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
          onClick={() => navigate(`/van-sales/cash-reconciliation/${row.id}`)}
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
      title="Cash Reconciliation"
      columns={columns}
      data={reconciliations}
      loading={loading}
      onRefresh={loadReconciliations}
      createPath="/van-sales/cash-reconciliation/create"
      createLabel="Create Reconciliation"
    />
  )
}
