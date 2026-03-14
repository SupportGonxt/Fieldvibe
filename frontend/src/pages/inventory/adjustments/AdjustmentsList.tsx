import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { inventoryService } from '../../../services/inventory.service'
import { formatDate } from '../../../utils/format'

export default function AdjustmentsList() {
  const navigate = useNavigate()
  const [adjustments, setAdjustments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAdjustments()
  }, [])

  const loadAdjustments = async () => {
    setLoading(true)
    try {
      const response = await inventoryService.getAdjustments()
      // API returns { success: true, data: [...] }, axios wraps it in response.data
      const adjustments = response.data?.data || response.data?.adjustments || response.data || []
      setAdjustments(Array.isArray(adjustments) ? adjustments : [])
    } catch (error) {
      console.error('Failed to load adjustments:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'adjustment_number',
      label: 'Adjustment #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/inventory/adjustments/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'adjustment_date',
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
      key: 'adjustment_type',
      label: 'Type',
      sortable: true,
      render: (value: string) => {
        const labels: Record<string, string> = {
          increase: 'Increase',
          decrease: 'Decrease',
          damage: 'Damage',
          expiry: 'Expiry',
          recount: 'Recount'
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
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-800',
          approved: 'bg-green-100 text-green-800',
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
          onClick={() => navigate(`/inventory/adjustments/${row.id}`)}
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
      title="Inventory Adjustments"
      columns={columns}
      data={adjustments}
      loading={loading}
      onRefresh={loadAdjustments}
      createPath="/inventory/adjustments/create"
      createLabel="Create Adjustment"
    />
  )
}
