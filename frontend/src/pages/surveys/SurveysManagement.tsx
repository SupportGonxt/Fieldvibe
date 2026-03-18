import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  FileText, 
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
  BarChart3,
  Users,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { surveysService, Survey, SurveyFilter } from '../../services/surveys.service'
import { formatDate, formatNumber } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { DataTable } from '../../components/ui/tables/DataTable'
import toast from 'react-hot-toast'

export default function SurveysManagement() {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [filter, setFilter] = useState<SurveyFilter>({
    page: 1,
    limit: 20,
    sort_by: 'created_at',
    sort_order: 'desc'
  })
  const [selectedSurveys, setSelectedSurveys] = useState<string[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: surveysData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['surveys', filter],
    queryFn: () => surveysService.getSurveys(filter),
    staleTime: 1000 * 60 * 5,
  })

  const { data: stats } = useQuery({
    queryKey: ['surveys-stats'],
    queryFn: () => surveysService.getSurveyStats(),
    staleTime: 1000 * 60 * 10,
  })

  const surveys = surveysData?.surveys || []
  const pagination = surveysData?.pagination || {}

  const activateSurveyMutation = useMutation({
    mutationFn: (id: string) => surveysService.activateSurvey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] })
      queryClient.invalidateQueries({ queryKey: ['surveys-stats'] })
      toast.success('Survey activated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to activate survey')
    }
  })

  const deactivateSurveyMutation = useMutation({
    mutationFn: (id: string) => surveysService.deactivateSurvey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] })
      queryClient.invalidateQueries({ queryKey: ['surveys-stats'] })
      toast.success('Survey deactivated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to deactivate survey')
    }
  })

  const deleteSurveyMutation = useMutation({
    mutationFn: (id: string) => surveysService.deleteSurvey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] })
      queryClient.invalidateQueries({ queryKey: ['surveys-stats'] })
      toast.success('Survey deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete survey')
    }
  })

  const duplicateSurveyMutation = useMutation({
    mutationFn: (id: string) => surveysService.duplicateSurvey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] })
      toast.success('Survey duplicated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to duplicate survey')
    }
  })

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: Clock },
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      paused: { color: 'bg-yellow-100 text-yellow-800', icon: Pause },
      completed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      archived: { color: 'bg-gray-100 text-gray-600', icon: AlertCircle }
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
      customer_satisfaction: 'bg-blue-100 text-blue-800',
      product_feedback: 'bg-green-100 text-green-800',
      market_research: 'bg-purple-100 text-purple-800',
      employee_feedback: 'bg-orange-100 text-orange-800',
      other: 'bg-gray-100 text-gray-800'
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[type as keyof typeof colors] || colors.other}`}>
        {type.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  const handleViewDetails = async (id: string) => {
    try {
      const survey = await surveysService.getSurvey(id)
      setSelectedSurvey(survey)
      setShowDetailsModal(true)
    } catch (error) {
      toast.error('Failed to load survey details')
    }
  }

  const handleActivate = (id: string) => {
    activateSurveyMutation.mutate(id)
  }

  const handleDeactivate = (id: string) => {
    deactivateSurveyMutation.mutate(id)
  }

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteSurveyMutation.mutate(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  const handleDuplicate = (id: string) => {
    duplicateSurveyMutation.mutate(id)
  }

  const handleExport = () => {
    surveysService.exportSurveyReport('excel')
    toast.success('Export started - file will download shortly')
  }

  const handleBulkActivate = () => {
    if (selectedSurveys.length === 0) return
    
    Promise.all(
      selectedSurveys.map(id => surveysService.activateSurvey(id))
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] })
      queryClient.invalidateQueries({ queryKey: ['surveys-stats'] })
      toast.success(`${selectedSurveys.length} surveys activated`)
      setSelectedSurveys([])
    }).catch(() => {
      toast.error('Some surveys failed to activate')
    })
  }

  const handleBulkDeactivate = () => {
    if (selectedSurveys.length === 0) return
    
    Promise.all(
      selectedSurveys.map(id => surveysService.deactivateSurvey(id))
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] })
      queryClient.invalidateQueries({ queryKey: ['surveys-stats'] })
      toast.success(`${selectedSurveys.length} surveys deactivated`)
      setSelectedSurveys([])
    }).catch(() => {
      toast.error('Some surveys failed to deactivate')
    })
  }

  const columns = [
    {
      key: 'title',
      title: 'Survey',
      render: (value: any, row: any) => (
        <div>
          <div className="font-medium text-gray-900">{row.title}</div>
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
      key: 'status',
      title: 'Status',
      render: (value: any, row: any) => getStatusBadge(row.status)
    },
    {
      key: 'response_count',
      title: 'Responses',
      render: (value: any, row: any) => (
        <div className="text-center">
          <div className="font-medium text-gray-900">{row.response_count || 0}</div>
          <div className="text-xs text-gray-500">
            {row.target_responses ? `/ ${row.target_responses}` : ''}
          </div>
        </div>
      )
    },
    {
      key: 'response_rate',
      title: 'Response Rate',
      render: (value: any, row: any) => (
        <div className="text-center">
          <div className="font-medium text-gray-900">{row.response_rate || 0}%</div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
            <div 
              className="bg-blue-600 h-1.5 rounded-full" 
              style={{ width: `${Math.min(row.response_rate || 0, 100)}%` }}
            ></div>
          </div>
        </div>
      )
    },
    {
      key: 'created_at',
      title: 'Created',
      render: (value: any, row: any) => (
        <div className="text-sm text-gray-900">
          {formatDate(row.created_at)}
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
            onClick={() => window.open(`/surveys/${row.id}/results`, '_blank')}
            className="text-green-600 hover:text-green-900"
            title="View Results"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          {row.status === 'draft' || row.status === 'paused' ? (
            <button
              onClick={() => handleActivate(row.id)}
              className="text-green-600 hover:text-green-900"
              title="Activate"
              disabled={activateSurveyMutation.isPending}
            >
              <Play className="w-4 h-4" />
            </button>
          ) : row.status === 'active' ? (
            <button
              onClick={() => handleDeactivate(row.id)}
              className="text-yellow-600 hover:text-yellow-900"
              title="Pause"
              disabled={deactivateSurveyMutation.isPending}
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : null}
          <button
            onClick={() => handleDuplicate(row.id)}
            className="text-purple-600 hover:text-purple-900"
            title="Duplicate"
            disabled={duplicateSurveyMutation.isPending}
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.open(`/surveys/${row.id}/edit`, '_blank')}
            className="text-blue-600 hover:text-blue-900"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="text-red-600 hover:text-red-900"
            title="Delete"
            disabled={deleteSurveyMutation.isPending}
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

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 text-lg font-medium">Failed to load data</p>
          <p className="text-gray-500 mt-2">Please try refreshing the page</p>
        </div>
      </div>
    )
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Survey Management</h1>
          <p className="text-gray-600">Create, manage, and analyze customer surveys</p>
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
            onClick={() => window.open('/surveys/create', '_blank')}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Survey</span>
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
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Surveys</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total_surveys}</p>
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
                <p className="text-sm font-medium text-gray-500">Active Surveys</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.active_surveys}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Responses</p>
                <p className="text-2xl font-semibold text-gray-900">{formatNumber(stats.total_responses)}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-yellow-100">
                  <BarChart3 className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg. Response Rate</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.average_response_rate}%</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-orange-100">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">This Month</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.surveys_this_month}</p>
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
                  placeholder="Search surveys..."
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
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
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
                <option value="customer_satisfaction">Customer Satisfaction</option>
                <option value="product_feedback">Product Feedback</option>
                <option value="market_research">Market Research</option>
                <option value="employee_feedback">Employee Feedback</option>
                <option value="other">Other</option>
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
          data={surveys}
          columns={columns}
          title="Surveys"
          searchable={true}
          exportable={true}
          pagination={true}
          pageSize={filter.limit}
        />
      </div>

      {/* Bulk Actions */}
      {selectedSurveys.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border p-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">
              {selectedSurveys.length} selected
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
              onClick={() => setSelectedSurveys([])}
              className="btn-outline btn-sm"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedSurvey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Survey Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Eye className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Survey Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Title</label>
                    <p className="text-gray-900">{selectedSurvey.title}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <p className="text-gray-900">{selectedSurvey.description}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Type</label>
                    <div className="mt-1">{getTypeBadge(selectedSurvey.type)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">{getStatusBadge(selectedSurvey.status)}</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Response Count</label>
                    <p className="text-gray-900">{selectedSurvey.response_count || 0}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Target Responses</label>
                    <p className="text-gray-900">{selectedSurvey.target_responses || 'No target set'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Response Rate</label>
                    <p className="text-gray-900">{selectedSurvey.response_rate || 0}%</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="text-gray-900">{formatDate(selectedSurvey.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            {selectedSurvey.questions && selectedSurvey.questions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Questions ({selectedSurvey.questions.length})</h3>
                <div className="space-y-3">
                  {selectedSurvey.questions.slice(0, 5).map((question: any, index: number) => (
                    <div key={question.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">Q{index + 1}: {question.question_text}</span>
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                          {question.question_type}
                        </span>
                      </div>
                      {question.options && question.options.length > 0 && (
                        <div className="text-sm text-gray-600">
                          Options: {question.options.map((opt: any) => opt.option_text).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedSurvey.questions.length > 5 && (
                    <p className="text-sm text-gray-500 text-center">
                      ... and {selectedSurvey.questions.length - 5} more questions
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => window.open(`/surveys/${selectedSurvey.id}/results`, '_blank')}
                className="btn-primary"
              >
                View Results
              </button>
              <button
                onClick={() => window.open(`/surveys/${selectedSurvey.id}/edit`, '_blank')}
                className="btn-outline"
              >
                Edit Survey
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
        title="Delete Survey"
        message="Are you sure you want to delete this survey? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
