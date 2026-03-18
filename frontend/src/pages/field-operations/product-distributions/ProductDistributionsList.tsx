import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, RotateCcw } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { fieldOperationsService } from '../../../services/field-operations.service'
import { formatCurrency, formatDate } from '../../../utils/format'
import { useToast } from '../../../components/ui/Toast'

export default function ProductDistributionsList() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [distributions, setDistributions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDistributions()
  }, [])

  const loadDistributions = async () => {
    setLoading(true)
    try {
      const response = await fieldOperationsService.getProductDistributions()
      setDistributions(response.data || [])
    } catch (error) {
      console.error('Failed to load product distributions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReverse = async (distributionId: number) => {
    if (!window.confirm('Are you sure you want to reverse this product distribution?')) return

    try {
      await fieldOperationsService.reverseProductDistribution(distributionId)
      loadDistributions()
    } catch (error) {
      console.error('Failed to reverse product distribution:', error)
      toast.error('Failed to reverse product distribution')
    }
  }

  const columns = [
    {
      key: 'distribution_number',
      label: 'Distribution #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/field-operations/product-distributions/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'distribution_date',
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
      key: 'customer_name',
      label: 'Customer',
      sortable: true
    },
    {
      key: 'product_name',
      label: 'Product',
      sortable: true
    },
    {
      key: 'quantity',
      label: 'Quantity',
      sortable: true
    },
    {
      key: 'commission_amount',
      label: 'Commission',
      sortable: true,
      render: (value: number) => formatCurrency(value)
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          distributed: 'bg-green-100 text-green-800',
          reversed: 'bg-gray-100 text-gray-800'
        }
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[value] || colors.distributed}`}>
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
            onClick={() => navigate(`/field-operations/product-distributions/${row.id}`)}
            className="p-1 text-gray-600 hover:text-primary-600"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status === 'distributed' && (
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
      title="Product Distributions"
      columns={columns}
      data={distributions}
      loading={loading}
      onRefresh={loadDistributions}
      createPath="/field-operations/product-distributions/create"
      createLabel="Create Distribution"
    />
  )
}
