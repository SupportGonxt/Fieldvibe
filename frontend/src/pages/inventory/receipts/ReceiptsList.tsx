import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, RotateCcw } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { inventoryService } from '../../../services/inventory.service'
import { formatDate } from '../../../utils/format'
import { useToast } from '../../../components/ui/Toast'

export default function ReceiptsList() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReceipts()
  }, [])

  const loadReceipts = async () => {
    setLoading(true)
    try {
      const response = await inventoryService.getReceipts()
      // API returns { success: true, data: [...] }, axios wraps it in response.data
      const receipts = response.data?.data || response.data?.receipts || response.data || []
      setReceipts(Array.isArray(receipts) ? receipts : [])
    } catch (error) {
      console.error('Failed to load receipts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReverse = async (receiptId: number) => {
    if (!window.confirm('Are you sure you want to reverse this receipt?')) return

    try {
      await inventoryService.reverseReceipt(receiptId)
      loadReceipts()
    } catch (error) {
      console.error('Failed to reverse receipt:', error)
      toast.error('Failed to reverse receipt')
    }
  }

  const columns = [
    {
      key: 'receipt_number',
      label: 'Receipt #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/inventory/receipts/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'receipt_date',
      label: 'Date',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'warehouse_name',
      label: 'Warehouse',
      sortable: true
    },
    {
      key: 'supplier_name',
      label: 'Supplier',
      sortable: true
    },
    {
      key: 'po_number',
      label: 'PO Number',
      sortable: true
    },
    {
      key: 'total_items',
      label: 'Items',
      sortable: true
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-800',
          received: 'bg-green-100 text-green-800',
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/inventory/receipts/${row.id}`)}
            className="p-1 text-gray-600 hover:text-primary-600"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status === 'received' && (
            <button
              onClick={() => handleReverse(row.id)}
              className="p-1 text-gray-600 hover:text-red-600"
              title="Reverse"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  return (
    <TransactionList
      title="Inventory Receipts (GRN)"
      columns={columns}
      data={receipts}
      loading={loading}
      onRefresh={loadReceipts}
      createPath="/inventory/receipts/create"
      createLabel="Create Receipt"
    />
  )
}
