import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { photoReviewService } from '../../../services/insights.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { Camera, Search, Filter, CheckCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight, Eye, X, User, Store, Calendar, Sparkles, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface PhotoItem {
  id: string
  visit_id: string
  photo_type: string
  r2_key: string
  r2_url: string | null
  review_status: string | null
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  ai_analysis_status: string | null
  ai_labels: string | null
  photo_uploaded_at: string
  visit_date: string
  visit_type: string
  visit_target_type: string
  visit_status: string
  agent_name: string
  agent_id: string
  store_name: string | null
  individual_name: string | null
  individual_surname: string | null
}

interface AgentOption {
  agent_id: string
  agent_name: string
}

export default function AdminPhotoReviewPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [agentFilter, setAgentFilter] = useState('')
  const [storeFilter, setStoreFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectingPhotoId, setRejectingPhotoId] = useState<string | null>(null)

  const params: Record<string, string> = { page: String(page), limit: '24' }
  if (agentFilter) params.agent_id = agentFilter
  if (storeFilter) params.store_name = storeFilter
  if (statusFilter) params.review_status = statusFilter

  const { data, isLoading } = useQuery({
    queryKey: ['admin-photo-review', page, agentFilter, storeFilter, statusFilter],
    queryFn: () => photoReviewService.getAdminReview(params),
  })

  const photos: PhotoItem[] = data?.photos || []
  const agents: AgentOption[] = data?.agents || []
  const pagination = data?.pagination || { total: 0, page: 1, limit: 24 }
  const totalPages = Math.ceil(pagination.total / pagination.limit)

  const approveMutation = useMutation({
    mutationFn: (id: string) => photoReviewService.approvePhoto(id),
    onSuccess: () => {
      toast.success('Photo approved')
      queryClient.invalidateQueries({ queryKey: ['admin-photo-review'] })
    },
    onError: () => toast.error('Failed to approve photo'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => photoReviewService.rejectPhoto(id, reason),
    onSuccess: () => {
      toast.success('Photo rejected — agent can now re-upload')
      setShowRejectModal(false)
      setRejectReason('')
      setRejectingPhotoId(null)
      queryClient.invalidateQueries({ queryKey: ['admin-photo-review'] })
    },
    onError: () => toast.error('Failed to reject photo'),
  })

  const handleReject = (photoId: string) => {
    setRejectingPhotoId(photoId)
    setRejectReason('')
    setShowRejectModal(true)
  }

  const confirmReject = () => {
    if (!rejectingPhotoId) return
    rejectMutation.mutate({ id: rejectingPhotoId, reason: rejectReason || 'Photo rejected by admin' })
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"><CheckCircle className="w-3 h-3" /> Approved</span>
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"><XCircle className="w-3 h-3" /> Rejected</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"><AlertTriangle className="w-3 h-3" /> Pending</span>
    }
  }

  const getDisplayName = (photo: PhotoItem) => {
    if (photo.store_name) return photo.store_name
    if (photo.individual_name) return `${photo.individual_name} ${photo.individual_surname || ''}`.trim()
    return 'Unknown'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Camera className="w-6 h-6" /> Photo Review
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review uploaded photos, approve or reject for agent re-upload. {pagination.total} photo(s) total.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Filter className="w-4 h-4" /> Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Agent</label>
            <select
              value={agentFilter}
              onChange={e => { setAgentFilter(e.target.value); setPage(1) }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-3 py-2"
            >
              <option value="">All Agents</option>
              {agents.map(a => (
                <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Store / Individual</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={storeFilter}
                onChange={e => { setStoreFilter(e.target.value); setPage(1) }}
                placeholder="Search by name..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white pl-9 pr-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Review Status</label>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-3 py-2"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Photo Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
      ) : photos.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No photos found matching your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {photos.map(photo => (
            <div key={photo.id} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
              {/* Photo thumbnail */}
              <div className="aspect-square relative group cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                {photo.r2_url ? (
                  <img src={photo.r2_url} alt="Visit photo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                    <Camera className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {/* Status overlay */}
                <div className="absolute top-1 right-1">
                  {getStatusBadge(photo.review_status)}
                </div>
              </div>
              {/* Photo info */}
              <div className="p-2 space-y-1">
                <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 truncate" title={getDisplayName(photo)}>
                  {photo.store_name ? <Store className="w-3 h-3 flex-shrink-0" /> : <User className="w-3 h-3 flex-shrink-0" />}
                  <span className="truncate">{getDisplayName(photo)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 truncate">
                  <User className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{photo.agent_name || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  {photo.visit_date}
                </div>
                {photo.ai_analysis_status === 'completed' && photo.ai_labels && (
                  <div className="flex items-center gap-1 text-[10px] text-violet-500">
                    <Sparkles className="w-3 h-3" /> AI analyzed
                  </div>
                )}
                {photo.ai_analysis_status === 'processing' && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-500">
                    <Loader2 className="w-3 h-3 animate-spin" /> Analyzing...
                  </div>
                )}
                {photo.rejection_reason && (
                  <p className="text-[10px] text-red-500 truncate" title={photo.rejection_reason}>
                    Reason: {photo.rejection_reason}
                  </p>
                )}
              </div>
              {/* Action buttons */}
              <div className="px-2 pb-2 flex gap-1">
                {photo.review_status !== 'approved' && (
                  <button
                    onClick={() => approveMutation.mutate(photo.id)}
                    disabled={approveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" /> Approve
                  </button>
                )}
                {photo.review_status !== 'rejected' && (
                  <button
                    onClick={() => handleReject(photo.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  >
                    <XCircle className="w-3 h-3" /> Reject
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Photo Detail</h3>
              <button onClick={() => setSelectedPhoto(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Photo */}
              <div className="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                {selectedPhoto.r2_url ? (
                  <img src={selectedPhoto.r2_url} alt="Visit photo" className="w-full max-h-[50vh] object-contain" />
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <Camera className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Store/Individual:</span>
                  <p className="font-medium text-gray-900 dark:text-white">{getDisplayName(selectedPhoto)}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Agent:</span>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedPhoto.agent_name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Visit Date:</span>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedPhoto.visit_date}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Photo Type:</span>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">{(selectedPhoto.photo_type || 'general').replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Upload Time:</span>
                  <p className="font-medium text-gray-900 dark:text-white">{new Date(selectedPhoto.photo_uploaded_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Review Status:</span>
                  <div className="mt-0.5">{getStatusBadge(selectedPhoto.review_status)}</div>
                </div>
              </div>
              {/* AI Analysis */}
              {selectedPhoto.ai_analysis_status === 'completed' && selectedPhoto.ai_labels && (() => {
                try {
                  const labels = typeof selectedPhoto.ai_labels === 'string' ? JSON.parse(selectedPhoto.ai_labels) : selectedPhoto.ai_labels
                  if (labels && typeof labels === 'object') {
                    return (
                      <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-violet-700 dark:text-violet-400 flex items-center gap-1 mb-2">
                          <Sparkles className="w-4 h-4" /> AI Analysis
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {labels.board_detected !== undefined && (
                            <div><span className="text-gray-500">Board:</span> <span className={labels.board_detected ? 'text-green-600' : 'text-gray-400'}>{labels.board_detected ? 'Detected' : 'Not found'}</span></div>
                          )}
                          {labels.brand && <div><span className="text-gray-500">Brand:</span> <span className="text-gray-900 dark:text-white">{labels.brand}</span></div>}
                          {labels.condition && <div><span className="text-gray-500">Condition:</span> <span className="capitalize">{labels.condition}</span></div>}
                          {labels.visibility && <div><span className="text-gray-500">Visibility:</span> <span className="capitalize">{labels.visibility}</span></div>}
                          {labels.description && <div className="col-span-2"><span className="text-gray-500">Description:</span> <span>{labels.description}</span></div>}
                        </div>
                      </div>
                    )
                  }
                  return null
                } catch { return null }
              })()}
              {/* Rejection reason */}
              {selectedPhoto.rejection_reason && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-1 mb-1">
                    <XCircle className="w-4 h-4" /> Rejection Reason
                  </h4>
                  <p className="text-sm text-red-600 dark:text-red-400">{selectedPhoto.rejection_reason}</p>
                </div>
              )}
              {/* Action buttons */}
              <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                {selectedPhoto.review_status !== 'approved' && (
                  <button
                    onClick={() => { approveMutation.mutate(selectedPhoto.id); setSelectedPhoto(null) }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                )}
                {selectedPhoto.review_status !== 'rejected' && (
                  <button
                    onClick={() => { handleReject(selectedPhoto.id); setSelectedPhoto(null) }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <XCircle className="w-5 h-5 text-red-500" /> Reject Photo
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              The agent will be notified and can re-upload a replacement photo.
            </p>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rejection Reason</label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g., Photo is blurry, wrong angle, board not visible..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-3 py-2 h-24 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={rejectMutation.isPending}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
