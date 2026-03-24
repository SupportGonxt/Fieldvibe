import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { fieldOperationsService } from '../../../services/field-operations.service'
import { formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { MapPin, Calendar, User, Store, Clock, CheckCircle, XCircle, ChevronLeft, Camera, FileText, MessageSquare, BarChart3, ImageIcon, Hash, Timer, UserCheck } from 'lucide-react'

export default function VisitDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [visit, setVisit] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Detect mobile context by checking if path starts with /agent/
  const isMobileContext = location.pathname.startsWith('/agent/')

  useEffect(() => {
    loadVisit()
  }, [id])

  const loadVisit = async () => {
    setLoading(true)
    try {
      // Pass ID as string (UUIDs) — do NOT convert to Number
      const response = await fieldOperationsService.getVisit(id!)
      setVisit(response.data)
    } catch (error) {
      console.error('Failed to load visit:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!visit) {
    return <ErrorState title="Visit not found" message="The visit you are looking for does not exist or has been deleted." />
  }

  // Mobile-friendly detail view
  if (isMobileContext) {
    const statusIcon = visit.status === 'completed'
      ? <CheckCircle className="w-5 h-5 text-green-400" />
      : visit.status === 'cancelled'
        ? <XCircle className="w-5 h-5 text-red-400" />
        : <Clock className="w-5 h-5 text-blue-400" />

    const statusBg = visit.status === 'completed' ? 'bg-green-500/10 text-green-400'
      : visit.status === 'cancelled' ? 'bg-red-500/10 text-red-400'
        : 'bg-blue-500/10 text-blue-400'

    const visitType = (visit.visit_target_type || visit.visit_type || 'visit').toLowerCase()
    const displayName = visit.customer_name || visit.individual_name || visit.store_name || 'Visit'
    const photos = visit.photos || []
    const responses = visit.responses || []
    const individuals = visit.individuals || []

    return (
      <div className="min-h-screen bg-[#06090F] pb-24">
        {/* Header */}
        <div className="bg-[#0A1628] px-5 pt-5 pb-4 border-b border-white/5">
          <button onClick={() => navigate('/agent/visits')} className="flex items-center gap-1 text-gray-400 text-sm mb-3">
            <ChevronLeft className="w-4 h-4" /> Back to Visits
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{displayName}</h1>
              <div className="flex items-center gap-2 mt-1">
                {visitType === 'store'
                  ? <Store className="w-3 h-3 text-purple-400" />
                  : <User className="w-3 h-3 text-cyan-400" />}
                <span className="text-xs text-gray-500 capitalize">{visitType}</span>
                <span className="text-[8px] text-gray-600">&bull;</span>
                <span className="text-xs text-gray-500">{visit.visit_date}</span>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${statusBg}`}>
              {statusIcon} {visit.status?.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="px-5 pt-4 space-y-4">
          {/* Visit Info */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Visit Details</h3>
            <div className="flex justify-between">
              <span className="text-xs text-gray-500 flex items-center gap-1"><Hash className="w-3 h-3" /> Visit ID</span>
              <span className="text-sm text-white font-mono">{visit.visit_number || visit.id}</span>
            </div>
            {visit.agent_name && (
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 flex items-center gap-1"><UserCheck className="w-3 h-3" /> Created By</span>
                <span className="text-sm text-white">{visit.agent_name}</span>
              </div>
            )}
            {visit.company_name && (
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Company</span>
                <span className="text-sm text-white">{visit.company_name}</span>
              </div>
            )}
            {visit.check_in_time && (
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Check-in</span>
                <span className="text-sm text-white">{new Date(visit.check_in_time).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
            {visit.check_out_time && (
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Check-out</span>
                <span className="text-sm text-white">{new Date(visit.check_out_time).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
            {visit.check_in_time && visit.check_out_time && (
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 flex items-center gap-1"><Timer className="w-3 h-3" /> Duration</span>
                <span className="text-sm text-white">
                  {(() => {
                    const mins = Math.round((new Date(visit.check_out_time).getTime() - new Date(visit.check_in_time).getTime()) / 60000)
                    if (mins < 60) return `${mins} min`
                    return `${Math.floor(mins / 60)}h ${mins % 60}m`
                  })()}
                </span>
              </div>
            )}
            {!visit.check_out_time && visit.duration && (
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 flex items-center gap-1"><Timer className="w-3 h-3" /> Duration</span>
                <span className="text-sm text-white">{visit.duration} min</span>
              </div>
            )}
            {(visit.latitude || visit.checkin_latitude) && (
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">GPS</span>
                <span className="text-sm text-white">
                  {(visit.checkin_latitude || visit.latitude)?.toFixed(4)}, {(visit.checkin_longitude || visit.longitude)?.toFixed(4)}
                </span>
              </div>
            )}
            {visit.notes && (
              <div>
                <span className="text-xs text-gray-500">Notes</span>
                <p className="text-sm text-white mt-1">{visit.notes}</p>
              </div>
            )}
          </div>

          {/* Individual Details (for individual visits) */}
          {individuals.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3 h-3" /> Individual Details
              </h3>
              {individuals.map((ind: any, idx: number) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Name</span>
                    <span className="text-sm text-white">{ind.first_name} {ind.last_name}</span>
                  </div>
                  {ind.id_number && (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">ID Number</span>
                      <span className="text-sm text-white">{ind.id_number}</span>
                    </div>
                  )}
                  {ind.phone && (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Phone</span>
                      <span className="text-sm text-white">{ind.phone}</span>
                    </div>
                  )}
                  {ind.email && (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Email</span>
                      <span className="text-sm text-white">{ind.email}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Store visit: show individual_name/surname if stored directly */}
          {!individuals.length && (visit.individual_name || visit.individual_surname) && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3 h-3" /> Individual Details
              </h3>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Name</span>
                <span className="text-sm text-white">{visit.individual_name} {visit.individual_surname}</span>
              </div>
              {visit.individual_id_number && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">ID Number</span>
                  <span className="text-sm text-white">{visit.individual_id_number}</span>
                </div>
              )}
              {visit.individual_phone && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Phone</span>
                  <span className="text-sm text-white">{visit.individual_phone}</span>
                </div>
              )}
            </div>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Camera className="w-3 h-3" /> Photos ({photos.length})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo: any, idx: number) => (
                  <div key={idx} className="rounded-lg overflow-hidden bg-white/5">
                    <div className="aspect-square">
                      <img
                        src={photo.photo_url || photo.url || `data:image/jpeg;base64,${photo.photo_base64}`}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Photo metadata: SOV, board placement, condition */}
                    <div className="p-2 space-y-1">
                      {photo.ai_share_of_voice != null && (
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3 text-cyan-400" />
                          <span className="text-[10px] text-gray-400">SOV:</span>
                          <span className={`text-xs font-semibold ${photo.ai_share_of_voice >= 50 ? 'text-green-400' : photo.ai_share_of_voice >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {photo.ai_share_of_voice}%
                          </span>
                        </div>
                      )}
                      {photo.board_placement_location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-purple-400" />
                          <span className="text-[10px] text-gray-400 capitalize">{photo.board_placement_location.replace(/_/g, ' ')}</span>
                          {photo.board_placement_position && (
                            <span className="text-[10px] text-gray-500">/ {photo.board_placement_position}</span>
                          )}
                        </div>
                      )}
                      {photo.board_condition && (
                        <div className="flex items-center gap-1">
                          <ImageIcon className="w-3 h-3 text-amber-400" />
                          <span className={`text-[10px] capitalize ${photo.board_condition === 'good' ? 'text-green-400' : photo.board_condition === 'damaged' || photo.board_condition === 'missing' ? 'text-red-400' : 'text-yellow-400'}`}>
                            {photo.board_condition}
                          </span>
                        </div>
                      )}
                      {photo.sample_board_match_score != null && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-blue-400" />
                          <span className="text-[10px] text-gray-400">Match:</span>
                          <span className="text-xs font-semibold text-blue-400">{photo.sample_board_match_score}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Survey Responses */}
          {responses.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <FileText className="w-3 h-3" /> Survey Responses
              </h3>
              {responses.map((resp: any, idx: number) => {
                let parsed: Record<string, string> = {}
                try { parsed = typeof resp.responses === 'string' ? JSON.parse(resp.responses) : resp.responses || {} } catch { /* */ }
                return (
                  <div key={idx} className="space-y-2">
                    {Object.entries(parsed).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-xs text-gray-500">{key}</span>
                        <span className="text-sm text-white">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-center pb-4">
            <p className="text-[10px] text-gray-600">Created {visit.created_at ? new Date(visit.created_at).toLocaleString('en-ZA') : ''}</p>
          </div>
        </div>
      </div>
    )
  }

  // Desktop view: compute duration from check-in/check-out times
  const durationStr = (() => {
    if (visit.check_in_time && visit.check_out_time) {
      const mins = Math.round((new Date(visit.check_out_time).getTime() - new Date(visit.check_in_time).getTime()) / 60000)
      if (mins < 60) return `${mins} min`
      return `${Math.floor(mins / 60)}h ${mins % 60}m`
    }
    return undefined
  })()

  const photos = visit.photos || []
  const responses = visit.responses || []

  const fields = [
    { label: 'Visit ID', value: visit.visit_number || visit.id },
    { label: 'Visit Date', value: formatDate(visit.visit_date) },
    { label: 'Created By', value: visit.agent_name },
    { label: 'Customer', value: visit.customer_name },
    { label: 'Company', value: visit.company_name },
    { label: 'Visit Type', value: visit.visit_type },
    { label: 'Check-in', value: visit.check_in_time ? new Date(visit.check_in_time).toLocaleTimeString() : undefined },
    { label: 'Check-out', value: visit.check_out_time ? new Date(visit.check_out_time).toLocaleTimeString() : undefined },
    { label: 'Duration', value: durationStr },
    { label: 'Status', value: visit.status },
    { label: 'GPS Location', value: visit.gps_location || (visit.latitude ? `${visit.latitude}, ${visit.longitude}` : undefined) },
    { label: 'Notes', value: visit.notes },
    { label: 'Created At', value: formatDate(visit.created_at) }
  ]

  const statusColor = {
    scheduled: 'blue',
    in_progress: 'yellow',
    completed: 'green',
    cancelled: 'red'
  }[visit.status] as 'green' | 'yellow' | 'red' | 'gray'

  return (
    <div>
      <TransactionDetail
        title={`Visit ${visit.visit_number || id}`}
        fields={fields}
        auditTrail={visit.audit_trail || []}
        editPath={visit.status !== 'completed' ? `/field-operations/visits/${id}/edit` : undefined}
        backPath="/field-operations/visits"
        status={visit.status}
        statusColor={statusColor}
      />

      {/* Photos Section */}
      {photos.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5" /> Photos ({photos.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((photo: any, idx: number) => (
              <div key={idx} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="aspect-square">
                  <img
                    src={photo.r2_url || photo.photo_url || photo.url || (photo.photo_base64 ? `data:image/jpeg;base64,${photo.photo_base64}` : '')}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  />
                </div>
                {(photo.ai_share_of_voice != null || photo.board_condition) && (
                  <div className="p-2 space-y-1 bg-gray-50 dark:bg-gray-700/50">
                    {photo.ai_share_of_voice != null && (
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3 text-cyan-500" />
                        <span className="text-xs text-gray-500">SOV:</span>
                        <span className={`text-xs font-semibold ${photo.ai_share_of_voice >= 50 ? 'text-green-500' : photo.ai_share_of_voice >= 25 ? 'text-yellow-500' : 'text-red-500'}`}>
                          {photo.ai_share_of_voice}%
                        </span>
                      </div>
                    )}
                    {photo.board_condition && (
                      <div className="flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-amber-500" />
                        <span className={`text-xs capitalize ${photo.board_condition === 'good' ? 'text-green-500' : photo.board_condition === 'damaged' || photo.board_condition === 'missing' ? 'text-red-500' : 'text-yellow-500'}`}>
                          {photo.board_condition}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Survey Responses Section */}
      {responses.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Survey Responses
          </h3>
          {responses.map((resp: any, idx: number) => {
            let parsed: Record<string, string> = {}
            try { parsed = typeof resp.responses === 'string' ? JSON.parse(resp.responses) : resp.responses || {} } catch { /* */ }
            return (
              <div key={idx} className="space-y-2">
                {Object.entries(parsed).map(([key, value]) => (
                  <div key={key} className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{key.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{String(value)}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
