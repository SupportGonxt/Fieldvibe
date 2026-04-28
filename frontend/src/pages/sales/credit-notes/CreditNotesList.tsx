import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'

const STATUS_COLORS: Record<string, string> = {
  ISSUED: 'bg-green-100 text-green-800',
  PARTIALLY_APPLIED: 'bg-amber-100 text-amber-800',
  FULLY_APPLIED: 'bg-blue-100 text-blue-800',
  VOIDED: 'bg-gray-200 text-gray-800',
  // legacy / mixed-case forms — match anything the backend has historically returned
  issued: 'bg-green-100 text-green-800',
  partially_applied: 'bg-amber-100 text-amber-800',
  fully_applied: 'bg-blue-100 text-blue-800',
  voided: 'bg-gray-200 text-gray-800',
}

export default function CreditNotesList() {
  const navigate = useNavigate()
  const [creditNotes, setCreditNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCreditNotes()
  }, [])

  const loadCreditNotes = async () => {
    setLoading(true)
    try {
      const response = await salesService.getCreditNotes()
      const list = response.data?.data || response.data?.credit_notes || response.data || []
      setCreditNotes(Array.isArray(list) ? list : [])
    } catch (error) {
      console.error('Failed to load credit notes:', error)
      setCreditNotes([])
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'credit_number',
      label: 'Credit Note #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/sales/credit-notes/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value || row.credit_note_number || '—'}
        </button>
      ),
    },
    {
      key: 'created_at',
      label: 'Issued',
      sortable: true,
      render: (value: string) => (value ? formatDate(value) : '—'),
    },
    { key: 'customer_name', label: 'Customer', sortable: true },
    {
      key: 'amount',
      label: 'Total',
      sortable: true,
      render: (value: number, row: any) => formatCurrency(Number(value ?? row.credit_amount ?? 0)),
    },
    {
      key: 'remaining_balance',
      label: 'Remaining',
      sortable: true,
      render: (value: number, row: any) => {
        // Backend may return null for older rows; fall back to amount - applied_amount.
        const remaining = value != null
          ? Number(value)
          : Number(row.amount || 0) - Number(row.applied_amount || 0)
        return formatCurrency(remaining)
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const klass = STATUS_COLORS[value] || 'bg-gray-100 text-gray-800'
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${klass}`}>
            {String(value || '').replace(/_/g, ' ').toLowerCase()}
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <button
          onClick={() => navigate(`/sales/credit-notes/${row.id}`)}
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
      title="Credit Notes"
      columns={columns}
      data={creditNotes}
      loading={loading}
      onRefresh={loadCreditNotes}
      createPath="/sales/credit-notes/create"
      createLabel="Create Credit Note"
    />
  )
}
