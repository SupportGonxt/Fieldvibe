import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, CheckCircle } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { vanSalesService } from '../../../services/van-sales.service'
import { formatDate } from '../../../utils/format'
import { useToast } from '../../../components/ui/Toast'

export default function VanLoadsList() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [vanLoads, setVanLoads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVanLoads()
  }, [])

  const loadVanLoads = async () => {
    setLoading(true)
    try {
      const response = await vanSalesService.getVanLoads()
      // API returns { success: true, data: [...] }, axios wraps it in response.data
      const vanLoads = response.data?.data || response.data?.van_loads || response.data || []
      setVanLoads(Array.isArray(vanLoads) ? vanLoads : [])
    } catch (error) {
      console.error('Failed to load van loads:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (loadId: number) => {
    if (!window.confirm('Are you sure you want to confirm this van load?')) return

    try {
      await vanSalesService.confirmVanLoad(loadId)
      loadVanLoads()
    } catch (error) {
      console.error('Failed to confirm van load:', error)
      toast.error('Failed to confirm van load')
    }
  }

  const columns = [
    {
      key: 'load_number',
      label: 'Load #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/van-sales/van-loads/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'load_date',
      label: 'Date',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'van_number',
      label: 'Van',
      sortable: true
    },
    {
      key: 'driver_name',
      label: 'Driver',
      sortable: true
    },
    {
      key: 'route_name',
      label: 'Route',
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
          confirmed: 'bg-green-100 text-green-800',
          in_transit: 'bg-blue-100 text-blue-800',
          completed: 'bg-gray-100 text-gray-800'
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
            onClick={() => navigate(`/van-sales/van-loads/${row.id}`)}
            className="p-1 text-gray-600 hover:text-primary-600"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status === 'pending' && (
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
      title="Van Loads"
      columns={columns}
      data={vanLoads}
      loading={loading}
      onRefresh={loadVanLoads}
      createPath="/van-sales/van-loads/create"
      createLabel="Create Van Load"
    />
  )
}
