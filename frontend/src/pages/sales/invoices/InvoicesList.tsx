import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { salesService } from '../../../services/sales.service'
import { formatCurrency, formatDate } from '../../../utils/format'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-200 text-gray-800',
}
const PAYMENT_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  PARTIAL: 'bg-amber-100 text-amber-800',
  PAID: 'bg-green-100 text-green-800',
}

export default function InvoicesList() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadInvoices() }, [])

  const loadInvoices = async () => {
    setLoading(true)
    try {
      const response = await salesService.getInvoices()
      const list = response.data?.data || response.data?.invoices || response.data || []
      setInvoices(Array.isArray(list) ? list : [])
    } catch (error) {
      console.error('Failed to load invoices:', error)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'order_number',
      label: 'Invoice #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/sales/invoices/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value || row.invoice_number || '—'}
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
      key: 'subtotal',
      label: 'Subtotal',
      sortable: true,
      render: (value: number) => formatCurrency(Number(value || 0)),
    },
    {
      key: 'tax_amount',
      label: 'Tax',
      sortable: true,
      render: (value: number) => formatCurrency(Number(value || 0)),
    },
    {
      key: 'total_amount',
      label: 'Total',
      sortable: true,
      render: (value: number, row: any) => formatCurrency(Number(value ?? row.invoice_amount ?? 0)),
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
      key: 'payment_status',
      label: 'Payment',
      sortable: true,
      render: (value: string) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${PAYMENT_COLORS[value] || 'bg-gray-100 text-gray-800'}`}>
          {String(value || '').toLowerCase()}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <button
          onClick={() => navigate(`/sales/invoices/${row.id}`)}
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
      title="Sales Invoices"
      columns={columns}
      data={invoices}
      loading={loading}
      onRefresh={loadInvoices}
      createPath="/sales/invoices/create"
      createLabel="Create Invoice"
    />
  )
}
