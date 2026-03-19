import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  FileText, 
  User, 
  Building, 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Download,
  Upload,
  Filter,
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal
} from 'lucide-react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { kycService, KYCSubmission, KYCFilter, KYCStats } from '../../services/kyc.service'
import { formatDate, formatCurrency } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { DataTable } from '../../components/ui/tables/DataTable'
import toast from 'react-hot-toast'
import SearchableSelect from '../../components/ui/SearchableSelect'

export default function KYCManagement() {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [approveId, setApproveId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [showBulkApprove, setShowBulkApprove] = useState(false)
  const [showBulkReject, setShowBulkReject] = useState(false)
  const [filter, setFilter] = useState<KYCFilter>({
    page: 1,
    limit: 20,
    sort_by: 'created_at',
    sort_order: 'desc'
  })
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: kycData, isLoading, error, refetch } = useQuery({
    queryKey: ['kyc-submissions', filter],
    queryFn: () => kycService.getKYCSubmissions(filter),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })

  const { data: stats } = useQuery({
    queryKey: ['kyc-stats'],
    queryFn: () => kycService.getKYCStats(),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })

  const submissions = kycData?.submissions || []
  const pagination = kycData?.pagination || {}

  const approveSubmissionMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => 
      kycService.approveKYCSubmission(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-stats'] })
      toast.success('KYC submission approved successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve KYC submission')
    }
  })

  const rejectSubmissionMutation = useMutation({
    mutationFn: ({ id, reason, notes }: { id: string; reason: string; notes?: string }) => 
      kycService.rejectKYCSubmission(id, reason, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-stats'] })
      toast.success('KYC submission rejected')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject KYC submission')
    }
  })

  const deleteSubmissionMutation = useMutation({
    mutationFn: (id: string) => kycService.deleteKYCSubmission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-stats'] })
      toast.success('KYC submission deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete KYC submission')
    }
  })

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      under_review: { color: 'bg-blue-100 text-blue-800', icon: Eye },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
      requires_update: { color: 'bg-orange-100 text-orange-800', icon: AlertTriangle }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  const getRiskLevelBadge = (riskLevel: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[riskLevel as keyof typeof colors] || colors.medium}`}>
        {riskLevel.toUpperCase()}
      </span>
    )
  }

  const handleViewDetails = async (id: string) => {
    try {
      const submission = await kycService.getKYCSubmission(id)
      setSelectedSubmission(submission)
      setShowDetailsModal(true)
    } catch (error) {
      toast.error('Failed to load submission details')
    }
  }

  const handleApprove = (id: string) => {
    setApproveId(id)
  }

  const confirmApprove = (notes?: string) => {
    if (!approveId) return
    approveSubmissionMutation.mutate({ id: approveId, notes: notes || undefined })
    setApproveId(null)
  }

  const handleReject = (id: string) => {
    setRejectId(id)
  }

  const confirmReject = (reason?: string) => {
    if (!rejectId || !reason) return
    rejectSubmissionMutation.mutate({ id: rejectId, reason, notes: undefined })
    setRejectId(null)
  }

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteSubmissionMutation.mutate(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  const handleExport = () => {
    kycService.exportKYCReport('excel', filter)
    toast.success('Export started - file will download shortly')
  }

  const handleBulkApprove = () => {
    if (selectedSubmissions.length === 0) return
    setShowBulkApprove(true)
  }

  const confirmBulkApprove = (notes?: string) => {
    setShowBulkApprove(false)
    Promise.all(
      selectedSubmissions.map(id => 
        kycService.approveKYCSubmission(id, notes || undefined)
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['kyc-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-stats'] })
      toast.success(`${selectedSubmissions.length} submissions approved`)
      setSelectedSubmissions([])
    }).catch(() => {
      toast.error('Some submissions failed to approve')
    })
  }

  const handleBulkReject = () => {
    if (selectedSubmissions.length === 0) return
    setShowBulkReject(true)
  }

  const confirmBulkReject = (reason?: string) => {
    if (!reason) return
    setShowBulkReject(false)
    Promise.all(
      selectedSubmissions.map(id => 
        kycService.rejectKYCSubmission(id, reason, undefined)
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['kyc-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-stats'] })
      toast.success(`${selectedSubmissions.length} submissions rejected`)
      setSelectedSubmissions([])
    }).catch(() => {
      toast.error('Some submissions failed to reject')
    })
  }

  const columns = [
    {
      key: 'customer_name',
      title: 'Customer',
      render: (value: any, row: any) => (
        <div>
          <div className="font-medium text-gray-900">{row.customer_name}</div>
          <div className="text-sm text-gray-500">{row.customer_code}</div>
        </div>
      )
    },
    {
      key: 'agent_name',
      title: 'Agent',
      render: (value: any, row: any) => (
        <div className="text-sm text-gray-900">{row.agent_name}</div>
      )
    },
    {
      key: 'status',
      title: 'Status',
      render: (value: any, row: any) => getStatusBadge(row.status)
    },
    {
      key: 'risk_level',
      title: 'Risk Level',
      render: (value: any, row: any) => getRiskLevelBadge(row.verification_status?.risk_level || 'medium')
    },
    {
      key: 'overall_score',
      title: 'Score',
      render: (value: any, row: any) => (
        <div className="text-sm font-medium">
          {row.verification_status?.overall_score || 0}/100
        </div>
      )
    },
    {
      key: 'submission_date',
      title: 'Submitted',
      render: (value: any, row: any) => (
        <div className="text-sm text-gray-900">
          {formatDate(row.submission_date)}
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
          {row.status === 'pending' && (
            <>
              <button
                onClick={() => handleApprove(row.id)}
                className="text-green-600 hover:text-green-900"
                title="Approve"
                disabled={approveSubmissionMutation.isPending}
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleReject(row.id)}
                className="text-red-600 hover:text-red-900"
                title="Reject"
                disabled={rejectSubmissionMutation.isPending}
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => handleDelete(row.id)}
            className="text-red-600 hover:text-red-900"
            title="Delete"
            disabled={deleteSubmissionMutation.isPending}
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
          <h1 className="text-2xl font-bold text-gray-900">KYC Management</h1>
          <p className="text-gray-600">Manage customer Know Your Customer submissions</p>
        </div>
        <div className="card">
          <div className="text-center py-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load KYC Data</h3>
            <p className="text-gray-600 mb-4">KYC submissions could not be loaded. The service may not be available yet.</p>
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
          <h1 className="text-2xl font-bold text-gray-900">KYC Management</h1>
          <p className="text-gray-600">Manage customer Know Your Customer submissions</p>
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
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New KYC</span>
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
                <p className="text-sm font-medium text-gray-500">Total Submissions</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total_submissions}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-yellow-100">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pending Review</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.pending_submissions}</p>
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
                <p className="text-sm font-medium text-gray-500">Approved</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.approved_submissions}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-red-100">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Rejected</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.rejected_submissions}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-purple-100">
                  <CreditCard className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Approval Rate</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.approval_rate}%</p>
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
                  placeholder="Search customers, agents..."
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
              <SearchableSelect
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'under_review', label: 'Under Review' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                  { value: 'requires_update', label: 'Requires Update' },
                ]}
                value={filter.status || '' || null}
                placeholder="All Statuses"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Risk Level
              </label>
              <SearchableSelect
                options={[
                  { value: '', label: 'All Risk Levels' },
                  { value: 'low', label: 'Low Risk' },
                  { value: 'medium', label: 'Medium Risk' },
                  { value: 'high', label: 'High Risk' },
                ]}
                value={filter.risk_level || '' || null}
                placeholder="All Risk Levels"
              />
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
          data={submissions}
          columns={columns}
          title="KYC Submissions"
          searchable={true}
          exportable={true}
          pagination={true}
          pageSize={filter.limit || 20}
        />
      </div>

      {/* Bulk Actions */}
      {selectedSubmissions.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border p-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">
              {selectedSubmissions.length} selected
            </span>
            <button
              onClick={handleBulkApprove}
              className="btn-primary btn-sm"
            >
              Bulk Approve
            </button>
            <button
              onClick={handleBulkReject}
              className="btn-outline btn-sm"
            >
              Bulk Reject
            </button>
            <button
              onClick={() => setSelectedSubmissions([])}
              className="btn-outline btn-sm"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">KYC Submission Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <p className="text-gray-900">{selectedSubmission.customer_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Code</label>
                    <p className="text-gray-900">{selectedSubmission.customer_code}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">{getStatusBadge(selectedSubmission.status)}</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Status</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Risk Level</label>
                    <div className="mt-1">
                      {getRiskLevelBadge(selectedSubmission.verification_status?.risk_level || 'medium')}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Overall Score</label>
                    <p className="text-gray-900">{selectedSubmission.verification_status?.overall_score || 0}/100</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Submitted By</label>
                    <p className="text-gray-900">{selectedSubmission.agent_name}</p>
                  </div>
                </div>
              </div>
            </div>

            {selectedSubmission.documents && selectedSubmission.documents.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedSubmission.documents.map((doc: any) => (
                    <div key={doc.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{doc.document_type}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          doc.verification_status === 'verified' ? 'bg-green-100 text-green-800' :
                          doc.verification_status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {doc.verification_status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{doc.file_name}</p>
                      <button
                        onClick={() => window.open(doc.file_url, '_blank')}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View Document
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              {selectedSubmission.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      handleApprove(selectedSubmission.id)
                      setShowDetailsModal(false)
                    }}
                    className="btn-primary"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      handleReject(selectedSubmission.id)
                      setShowDetailsModal(false)
                    }}
                    className="btn-outline"
                  >
                    Reject
                  </button>
                </>
              )}
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
        title="Delete KYC Submission"
        message="Are you sure you want to delete this KYC submission? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={approveId !== null}
        onClose={() => setApproveId(null)}
        onConfirm={confirmApprove}
        title="Approve Submission"
        message="Add approval notes (optional)."
        confirmLabel="Approve"
        variant="info"
        showReasonInput
        reasonPlaceholder="Approval notes (optional)..."
      />

      <ConfirmDialog
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onConfirm={confirmReject}
        title="Reject Submission"
        message="Please provide a reason for rejection."
        confirmLabel="Reject"
        variant="danger"
        showReasonInput
        reasonPlaceholder="Rejection reason (required)..."
        reasonRequired
      />

      <ConfirmDialog
        isOpen={showBulkApprove}
        onClose={() => setShowBulkApprove(false)}
        onConfirm={confirmBulkApprove}
        title="Bulk Approve"
        message={`Approve ${selectedSubmissions.length} selected submission(s). Add notes (optional).`}
        confirmLabel="Approve All"
        variant="info"
        showReasonInput
        reasonPlaceholder="Bulk approval notes (optional)..."
      />

      <ConfirmDialog
        isOpen={showBulkReject}
        onClose={() => setShowBulkReject(false)}
        onConfirm={confirmBulkReject}
        title="Bulk Reject"
        message={`Reject ${selectedSubmissions.length} selected submission(s). Provide a reason.`}
        confirmLabel="Reject All"
        variant="danger"
        showReasonInput
        reasonPlaceholder="Bulk rejection reason (required)..."
        reasonRequired
      />
    </div>
  )
}
