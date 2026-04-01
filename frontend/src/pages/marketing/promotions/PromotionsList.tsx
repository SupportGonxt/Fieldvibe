import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { marketingService } from '../../../services/marketing.service'
import { formatDate } from '../../../utils/format'

export default function PromotionsList() {
  const navigate = useNavigate()
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPromotions()
  }, [])

  const loadPromotions = async () => {
    setLoading(true)
    try {
      const response = await marketingService.getPromotions()
      // API returns {success, data} - extract the data array
      const apiResponse = response.data
      setPromotions(Array.isArray(apiResponse?.data) ? apiResponse.data : Array.isArray(apiResponse) ? apiResponse : [])
    } catch (error) {
      console.error('Failed to load promotions:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'promotion_code',
      label: 'Promotion Code',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/marketing/promotions/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'promotion_name',
      label: 'Promotion Name',
      sortable: true
    },
    {
      key: 'promotion_type',
      label: 'Type',
      sortable: true
    },
    {
      key: 'start_date',
      label: 'Start Date',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'end_date',
      label: 'End Date',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'discount_percentage',
      label: 'Discount',
      sortable: true,
      render: (value: number) => value ? `${value}%` : '-'
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          draft: 'bg-gray-100 text-gray-800',
          active: 'bg-green-100 text-green-800',
          expired: 'bg-gray-100 text-gray-800',
          cancelled: 'bg-red-100 text-red-800'
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
          onClick={() => navigate(`/marketing/promotions/${row.id}`)}
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
      title="Promotions"
      columns={columns}
      data={promotions}
      loading={loading}
      onRefresh={loadPromotions}
      createPath="/marketing/promotions/create"
      createLabel="Create Promotion"
    />
  )
}
