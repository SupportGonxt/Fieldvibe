import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Gift, 
  Plus, 
  Search, 
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Copy,
  Play,
  Pause,
  Calendar,
  Users,
  Target,
  DollarSign,
  Percent,
  BarChart3,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { promotionsService, Promotion, PromotionFilter } from '../../services/promotions.service'
import { formatDate, formatNumber, formatCurrency } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { DataTable } from '../../components/ui/tables/DataTable'
import toast from 'react-hot-toast'

export default function PromotionsManagement() {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [filter, setFilter] = useState<PromotionFilter>({
    page: 1,
    limit: 20,
    sort_by: 'created_at',
    sort_order: 'desc'
  })
  const [selectedPromotions, setSelectedPromotions] = useState<string[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: promotionsData, isLoading, error, refetch } = useQuery({
    queryKey: ['promotions', filter],
    queryFn: () => promotionsService.getPromotions(filter),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })

  const { data: stats } = useQuery({
    queryKey: ['promotions-stats'],
    queryFn: () => promotionsService.getPromotionStats(),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })

  const promotions = promotionsData?.promotions || []
  const pagination = promotionsData?.pagination || {}

  const activatePromotionMutation = useMutation({
    mutationFn: (id: string) => promotionsService.activatePromotion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      queryClient.invalidateQueries({ queryKey: ['promotions-stats'] })
      toast.success('Promotion activated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to activate promotion')
    }
  })

  const deactivatePromotionMutation = useMutation({
    mutationFn: (id: string) => promotionsService.deactivatePromotion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      queryClient.invalidateQueries({ queryKey: ['promotions-stats'] })
      toast.success('Promotion deactivated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to deactivate promotion')
    }
  })

  const deletePromotionMutation = useMutation({
    mutationFn: (id: string) => promotionsService.deletePromotion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      queryClient.invalidateQueries({ queryKey: ['promotions-stats'] })
      toast.success('Promotion deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete promotion')
    }
  })

  const duplicatePromotionMutation = useMutation({
    mutationFn: (id: string) => promotionsService.duplicatePromotion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      toast.success('Promotion duplicated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to duplicate promotion')
    }
  })

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: Clock },
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      paused: { color: 'bg-yellow-100 text-yellow-800', icon: Pause },
      expired: { color: 'bg-red-100 text-red-800', icon: AlertTriangle },
      scheduled: { color: 'bg-blue-100 text-blue-800', icon: Calendar }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    const Icon = config.icon
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.toUpperCase()}
      </span>
    )
  }

  const getTypeBadge = (type: string) => {
    const colors = {
      percentage: 'bg-blue-100 text-blue-800',
      fixed_amount: 'bg-green-100 text-green-800',
      buy_one_get_one: 'bg-purple-100 text-purple-800',
      bundle: 'bg-orange-100 text-orange-800',
      loyalty: 'bg-pink-100 text-pink-800'
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[type as keyof typeof colors] || colors.percentage}`}>
        {type.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  const handleViewDetails = async (id: string) => {
    try {
      const promotion = await promotionsService.getPromotion(id)
      setSelectedPromotion(promotion)
      setShowDetailsModal(true)
    } catch (error) {
      toast.error('Failed to load promotion details')
    }
  }

  const handleActivate = (id: string) => {
    activatePromotionMutation.mutate(id)
  }

  const handleDeactivate = (id: string) => {
    deactivatePromotionMutation.mutate(id)
  }

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deletePromotionMutation.mutate(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  const handleDuplicate = (id: string) => {
    duplicatePromotionMutation.mutate(id)
  }

  const handleExport = () => {
    promotionsService.exportPromotionReport('excel', filter)
    toast.success('Export started - file will download shortly')
  }

  const handleBulkActivate = () => {
    if (selectedPromotions.length === 0) return
    
    Promise.all(
      selectedPromotions.map(id => promotionsService.activatePromotion(id))
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      queryClient.invalidateQueries({ queryKey: ['promotions-stats'] })
      toast.success(`${selectedPromotions.length} promotions activated`)
      setSelectedPromotions([])
    }).catch(() => {
      toast.error('Some promotions failed to activate')
    })
  }

  const handleBulkDeactivate = () => {
    if (selectedPromotions.length === 0) return
    
    Promise.all(
      selectedPromotions.map(id => promotionsService.deactivatePromotion(id))
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      queryClient.invalidateQueries({ queryKey: ['promotions-stats'] })
      toast.success(`${selectedPromotions.length} promotions deactivated`)
      setSelectedPromotions([])
    }).catch(() => {
      toast.error('Some promotions failed to deactivate')
    })
  }

  const columns = [
    {
      key: 'name',
      title: 'Promotion',
      render: (value: any, row: any) => (
        <div>
          <div className="font-medium text-gray-900">{row.name}</div>
          <div className="text-sm text-gray-500">{row.description?.substring(0, 50)}...</div>
        </div>
      )
    },
    {
      key: 'type',
      title: 'Type',
      render: (value: any, row: any) => getTypeBadge(row.type)
    },
    {
      key: 'discount_value',
      title: 'Discount',
      render: (value: any, row: any) => (
        <div className="text-center">
          <div className="font-medium text-gray-900">
            {row.type === 'percentage' ? `${row.discount_value}%` : 
             row.type === 'fixed_amount' ? formatCurrency(row.discount_value) :
             row.discount_value}
          </div>
          {row.max_discount_amount && (
            <div className="text-xs text-gray-500">
              Max: {formatCurrency(row.max_discount_amount)}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'status',
      title: 'Status',
      render: (value: any, row: any) => getStatusBadge(row.status)
    },
    {
      key: 'performance',
      title: 'Performance',
      render: (value: any, row: any) => (
        <div className="text-center">
          <div className="font-medium text-gray-900">{row.usage_count || 0}</div>
          <div className="text-xs text-gray-500">uses</div>
          <div className="text-xs text-green-600">{formatCurrency(row.total_revenue || 0)}</div>
        </div>
      )
    },
    {
      key: 'duration',
      title: 'Duration',
      render: (value: any, row: any) => (
        <div className="text-sm">
          <div className="text-gray-900">{formatDate(row.start_date, 'short')}</div>
          <div className="text-gray-500">to {formatDate(row.end_date, 'short')}</div>
        </div>
      )
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (value: any, row: any) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleViewDetails(row.id)}
            className="text-blue-600 hover:text-blue-900"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.open(`/promotions/${row.id}/analytics`, '_blank')}
            className="text-green-600 hover:text-green-900"
            title="View Analytics"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          {row.status === 'draft' || row.status === 'paused' ? (
            <button
              onClick={() => handleActivate(row.id)}
              className="text-green-600 hover:text-green-900"
              title="Activate"
              disabled={activatePromotionMutation.isPending}
            >
              <Play className="w-4 h-4" />
            </button>
          ) : row.status === 'active' ? (
            <button
              onClick={() => handleDeactivate(row.id)}
              className="text-yellow-600 hover:text-yellow-900"
              title="Pause"
              disabled={deactivatePromotionMutation.isPending}
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : null}
          <button
            onClick={() => handleDuplicate(row.id)}
            className="text-purple-600 hover:text-purple-900"
            title="Duplicate"
            disabled={duplicatePromotionMutation.isPending}
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.open(`/promotions/${row.id}/edit`, '_blank')}
            className="text-blue-600 hover:text-blue-900"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="text-red-600 hover:text-red-900"
            title="Delete"
            disabled={deletePromotionMutation.isPending}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promotions Management</h1>
          <p className="text-gray-600">Create, manage, and track promotional campaigns</p>
        </div>
        <div className="card">
          <div className="text-center py-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Promotions</h3>
            <p className="text-gray-600 mb-4">Promotions data could not be loaded. The service may not be available yet.</p>
            <button onClick={() => refetch()} className="btn-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promotions Management</h1>
          <p className="text-gray-600">Create, manage, and track promotional campaigns</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-outline flex items-center space-x-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
          <button
            onClick={handleExport}
            className="btn-outline flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <button
            onClick={() => window.open('/promotions/create', '_blank')}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Promotion</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Gift className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Promotions</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total_promotions}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Promotions</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.active_promotions}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-purple-100">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.total_revenue)}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-yellow-100">
                  <Users className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Customers Engaged</p>
                <p className="text-2xl font-semibold text-gray-900">{formatNumber(stats.customers_engaged)}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-orange-100">
                  <Target className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg. Conversion</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.average_conversion_rate}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search promotions..."
                  className="input pl-10"
                  value={filter.search || ''}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value, page: 1 })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                className="input"
                value={filter.status || ''}
                onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined, page: 1 })}
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="expired">Expired</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                className="input"
                value={filter.type || ''}
                onChange={(e) => setFilter({ ...filter, type: e.target.value || undefined, page: 1 })}
              >
                <option value="">All Types</option>
                <option value="percentage">Percentage</option>
                <option value="fixed_amount">Fixed Amount</option>
                <option value="buy_one_get_one">BOGO</option>
                <option value="bundle">Bundle</option>
                <option value="loyalty">Loyalty</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <div className="flex space-x-2">
                <input
                  type="date"
                  className="input text-sm"
                  value={filter.start_date || ''}
                  onChange={(e) => setFilter({ ...filter, start_date: e.target.value || undefined, page: 1 })}
                />
                <input
                  type="date"
                  className="input text-sm"
                  value={filter.end_date || ''}
                  onChange={(e) => setFilter({ ...filter, end_date: e.target.value || undefined, page: 1 })}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="card">
        <DataTable
          data={promotions}
          columns={columns}
          title="Promotions"
          searchable={true}
          exportable={true}
          pagination={true}
          pageSize={filter.limit || 20}
        />
      </div>

      {/* Bulk Actions */}
      {selectedPromotions.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border p-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">
              {selectedPromotions.length} selected
            </span>
            <button
              onClick={handleBulkActivate}
              className="btn-primary btn-sm"
            >
              Bulk Activate
            </button>
            <button
              onClick={handleBulkDeactivate}
              className="btn-outline btn-sm"
            >
              Bulk Pause
            </button>
            <button
              onClick={() => setSelectedPromotions([])}
              className="btn-outline btn-sm"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedPromotion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Promotion Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Promotion Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <p className="text-gray-900">{selectedPromotion.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <p className="text-gray-900">{selectedPromotion.description}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Type</label>
                    <div className="mt-1">{getTypeBadge(selectedPromotion.type)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">{getStatusBadge(selectedPromotion.status)}</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Usage Count</label>
                    <p className="text-gray-900">{selectedPromotion.usage_count || 0}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Revenue</label>
                    <p className="text-gray-900">{formatCurrency(0)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Conversion Rate</label>
                    <p className="text-gray-900">0%</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Duration</label>
                    <p className="text-gray-900">
                      {formatDate(selectedPromotion.start_date)} - {formatDate(selectedPromotion.end_date)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {selectedPromotion.conditions && selectedPromotion.conditions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Conditions</h3>
                <div className="space-y-2">
                  {selectedPromotion.conditions.map((condition: any, index: number) => (
                    <div key={index} className="p-3 bg-surface-secondary rounded-lg">
                      <p className="text-sm text-gray-900">{condition.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              {selectedPromotion.status === 'draft' || selectedPromotion.status === 'paused' ? (
                <button
                  onClick={() => {
                    handleActivate(selectedPromotion.id)
                    setShowDetailsModal(false)
                  }}
                  className="btn-primary"
                >
                  Activate
                </button>
              ) : selectedPromotion.status === 'active' ? (
                <button
                  onClick={() => {
                    handleDeactivate(selectedPromotion.id)
                    setShowDetailsModal(false)
                  }}
                  className="btn-outline"
                >
                  Pause
                </button>
              ) : null}
              <button
                onClick={() => window.open(`/promotions/${selectedPromotion.id}/analytics`, '_blank')}
                className="btn-outline"
              >
                View Analytics
              </button>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="btn-outline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDelete}
        title="Delete Promotion"
        message="Are you sure you want to delete this promotion? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
