import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, CheckCircle } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { inventoryService } from '../../../services/inventory.service'
import { formatDate } from '../../../utils/format'
import { useToast } from '../../../components/ui/Toast'

export default function StockCountsList() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [stockCounts, setStockCounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStockCounts()
  }, [])

  const loadStockCounts = async () => {
    setLoading(true)
    try {
      const response = await inventoryService.getStockCounts()
      // API returns { success: true, data: [...] }, axios wraps it in response.data
      const stockCounts = response.data?.data || response.data?.stock_counts || response.data || []
      setStockCounts(Array.isArray(stockCounts) ? stockCounts : [])
    } catch (error) {
      console.error('Failed to load stock counts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (countId: number) => {
    if (!window.confirm('Are you sure you want to confirm this stock count? This will create adjustments for variances.')) return

    try {
      await inventoryService.confirmStockCount(countId)
      loadStockCounts()
    } catch (error) {
      console.error('Failed to confirm stock count:', error)
      toast.error('Failed to confirm stock count')
    }
  }

  const columns = [
    {
      key: 'count_number',
      label: 'Count #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/inventory/stock-counts/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'count_date',
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
      key: 'count_type',
      label: 'Type',
      sortable: true,
      render: (value: string) => {
        const labels: Record<string, string> = {
          full: 'Full Count',
          cycle: 'Cycle Count',
          spot: 'Spot Check'
        }
        return labels[value] || value
      }
    },
    {
      key: 'total_items',
      label: 'Items',
      sortable: true
    },
    {
      key: 'variance_count',
      label: 'Variances',
      sortable: true,
      render: (value: number) => (
        <span className={value > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
          {value}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          in_progress: 'bg-yellow-100 text-yellow-800',
          pending_review: 'bg-blue-100 text-blue-800',
          confirmed: 'bg-green-100 text-green-800'
        }
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[value] || colors.in_progress}`}>
            {value.replace('_', ' ')}
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
            onClick={() => navigate(`/inventory/stock-counts/${row.id}`)}
            className="p-1 text-gray-600 hover:text-primary-600"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status === 'pending_review' && (
            <button
              onClick={() => handleConfirm(row.id)}
              className="p-1 text-gray-600 hover:text-green-600"
              title="Confirm"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  return (
    <TransactionList
      title="Stock Counts"
      columns={columns}
      data={stockCounts}
      loading={loading}
      onRefresh={loadStockCounts}
      createPath="/inventory/stock-counts/create"
      createLabel="Create Stock Count"
    />
  )
}
