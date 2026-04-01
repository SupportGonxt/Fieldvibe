import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Edit } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { marketingService } from '../../../services/marketing.service'
import { formatCurrency, formatDate } from '../../../utils/format'

export default function CampaignsList() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCampaigns()
  }, [])

  const loadCampaigns = async () => {
    setLoading(true)
    try {
      const response = await marketingService.getCampaigns()
      // API returns {success, data, pagination} - extract the data array
      const apiResponse = response.data
      setCampaigns(Array.isArray(apiResponse?.data) ? apiResponse.data : Array.isArray(apiResponse) ? apiResponse : [])
    } catch (error) {
      console.error('Failed to load campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'campaign_code',
      label: 'Campaign Code',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/marketing/campaigns/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'campaign_name',
      label: 'Campaign Name',
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
      key: 'budget',
      label: 'Budget',
      sortable: true,
      render: (value: number) => formatCurrency(value)
    },
    {
      key: 'actual_spend',
      label: 'Actual Spend',
      sortable: true,
      render: (value: number) => formatCurrency(value)
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => {
        const colors: Record<string, string> = {
          draft: 'bg-gray-100 text-gray-800',
          planned: 'bg-blue-100 text-blue-800',
          active: 'bg-green-100 text-green-800',
          completed: 'bg-gray-100 text-gray-800',
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/marketing/campaigns/${row.id}`)}
            className="p-1 text-gray-600 hover:text-primary-600"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {(row.status === 'draft' || row.status === 'planned') && (
            <button
              onClick={() => navigate(`/marketing/campaigns/${row.id}/edit`)}
              className="p-1 text-gray-600 hover:text-primary-600"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  return (
    <TransactionList
      title="Marketing Campaigns"
      columns={columns}
      data={campaigns}
      loading={loading}
      onRefresh={loadCampaigns}
      createPath="/marketing/campaigns/create"
      createLabel="Create Campaign"
    />
  )
}
