import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'

export default function CreditNotesList() {
  const navigate = useNavigate()
  const [creditNotes, setCreditNotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCreditNotes()
  }, [])

  const loadCreditNotes = async () => {
    setLoading(true)
    try {
      const response = await salesService.getCreditNotes()
      // API returns { success: true, data: [...] }, axios wraps it in response.data
      const creditNotes = response.data?.data || response.data?.credit_notes || response.data || []
      setCreditNotes(Array.isArray(creditNotes) ? creditNotes : [])
    } catch (error) {
      console.error('Failed to load credit notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'credit_note_number',
      label: 'Credit Note #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/sales/credit-notes/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'credit_note_date',
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
      key: 'invoice_number',
      label: 'Invoice #',
      sortable: true
    },
    {
      key: 'credit_amount',
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
          draft: 'bg-gray-100 text-gray-800',
          issued: 'bg-green-100 text-green-800',
          applied: 'bg-blue-100 text-blue-800'
        }
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[value] || colors.draft}`}>
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
          onClick={() => navigate(`/sales/credit-notes/${row.id}`)}
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
