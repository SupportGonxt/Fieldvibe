import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { fieldOperationsService } from '../../../services/field-operations.service'
import { formatCurrency, formatDate } from '../../../utils/format'

export default function CommissionLedgerList() {
  const navigate = useNavigate()
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCommissions()
  }, [])

  const loadCommissions = async () => {
    setLoading(true)
    try {
      const response = await fieldOperationsService.getCommissions()
      setCommissions(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load commissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'commission_number',
      label: 'Commission #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/field-operations/commission-ledger/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'commission_date',
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
      key: 'commission_type',
      label: 'Type',
      sortable: true,
      render: (value: string) => {
        const labels: Record<string, string> = {
          board_placement: 'Board Placement',
          product_distribution: 'Product Distribution',
          sales_order: 'Sales Order',
          visit: 'Visit'
        }
        return labels[value] || value
      }
    },
    {
      key: 'reference_number',
      label: 'Reference',
      sortable: true
    },
    {
      key: 'commission_amount',
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
          approved: 'bg-green-100 text-green-800',
          paid: 'bg-blue-100 text-blue-800',
          reversed: 'bg-red-100 text-red-800'
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
          onClick={() => navigate(`/field-operations/commission-ledger/${row.id}`)}
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
      title="Commission Ledger"
      columns={columns}
      data={commissions}
      loading={loading}
      onRefresh={loadCommissions}
    />
  )
}
