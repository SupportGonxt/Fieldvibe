import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, RotateCcw } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { inventoryService } from '../../../services/inventory.service'
import { formatDate } from '../../../utils/format'
import { useToast } from '../../../components/ui/Toast'

export default function TransfersList() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTransfers()
  }, [])

  const loadTransfers = async () => {
    setLoading(true)
    try {
      const response = await inventoryService.getTransfers()
      // API returns { success: true, data: [...] }, axios wraps it in response.data
      const transfers = response.data?.data || response.data?.transfers || response.data || []
      setTransfers(Array.isArray(transfers) ? transfers : [])
    } catch (error) {
      console.error('Failed to load transfers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReverse = async (transferId: number) => {
    if (!confirm('Are you sure you want to reverse this transfer?')) return

    try {
      await inventoryService.reverseTransfer(transferId)
      loadTransfers()
    } catch (error) {
      console.error('Failed to reverse transfer:', error)
      toast.error('Failed to reverse transfer')
    }
  }

  const columns = [
    {
      key: 'transfer_number',
      label: 'Transfer #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/inventory/transfers/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'transfer_date',
      label: 'Date',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'from_warehouse',
      label: 'From',
      sortable: true
    },
    {
      key: 'to_warehouse',
      label: 'To',
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
          in_transit: 'bg-blue-100 text-blue-800',
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
            onClick={() => navigate(`/inventory/transfers/${row.id}`)}
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
      title="Inventory Transfers"
      columns={columns}
      data={transfers}
      loading={loading}
      onRefresh={loadTransfers}
      createPath="/inventory/transfers/create"
      createLabel="Create Transfer"
    />
  )
}
