import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, RotateCcw } from 'lucide-react'
import TransactionList from '../../../components/transactions/TransactionList'
import { inventoryService } from '../../../services/inventory.service'
import { formatDate } from '../../../utils/format'
import { useToast } from '../../../components/ui/Toast'

export default function IssuesList() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadIssues()
  }, [])

  const loadIssues = async () => {
    setLoading(true)
    try {
      const response = await inventoryService.getIssues()
      // API returns { success: true, data: [...] }, axios wraps it in response.data
      const issues = response.data?.data || response.data?.issues || response.data || []
      setIssues(Array.isArray(issues) ? issues : [])
    } catch (error) {
      console.error('Failed to load issues:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReverse = async (issueId: number) => {
    if (!window.confirm('Are you sure you want to reverse this issue?')) return

    try {
      await inventoryService.reverseIssue(issueId)
      loadIssues()
    } catch (error) {
      console.error('Failed to reverse issue:', error)
      toast.error('Failed to reverse issue')
    }
  }

  const columns = [
    {
      key: 'issue_number',
      label: 'Issue #',
      sortable: true,
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/inventory/issues/${row.id}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {value}
        </button>
      )
    },
    {
      key: 'issue_date',
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
      key: 'issued_to',
      label: 'Issued To',
      sortable: true
    },
    {
      key: 'issue_type',
      label: 'Type',
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
          issued: 'bg-green-100 text-green-800',
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
            onClick={() => navigate(`/inventory/issues/${row.id}`)}
            className="p-1 text-gray-600 hover:text-primary-600"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status === 'issued' && (
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
      title="Inventory Issues"
      columns={columns}
      data={issues}
      loading={loading}
      onRefresh={loadIssues}
      createPath="/inventory/issues/create"
      createLabel="Create Issue"
    />
  )
}
