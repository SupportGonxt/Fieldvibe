import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import TransactionDetail from '../../../components/transactions/TransactionDetail'
import { fieldOperationsService } from '../../../services/field-operations.service'
import { tradeMarketingService } from '../../../services/insights.service'
import { formatDate } from '../../../utils/format'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { MapPin, Calendar, User, Store, Clock, CheckCircle, XCircle, ChevronLeft, Camera, FileText, MessageSquare, BarChart3, ImageIcon, Hash, Timer, UserCheck, Edit2, Save, X, Sparkles, Loader2, Upload, AlertTriangle, Ban } from 'lucide-react'
import toast from 'react-hot-toast'

export default function VisitDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [visit, setVisit] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editingGoldrushId, setEditingGoldrushId] = useState(false)
  const [goldrushIdValue, setGoldrushIdValue] = useState('')
  const [savingGoldrushId, setSavingGoldrushId] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const desktopFileInputRef = useRef<HTMLInputElement>(null)
  const rejectedPhotosSectionRef = useRef<HTMLDivElement>(null)
  const photoFileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handlePhotoUpload = async (files: FileList | null, photoType: string = 'general') => {
    if (!files || files.length === 0 || !id) return
    setUploading(true)
    let successCount = 0
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append('photo', file)
        formData.append('visit_id', id)
        formData.append('photo_type', photoType)
        await tradeMarketingService.uploadPhoto(formData)
        successCount++
      }
      toast.success(`${successCount} photo(s) uploaded successfully`)
    } catch {
      if (successCount > 0) toast.success(`${successCount} photo(s) uploaded, some failed`)
      else toast.error('Failed to upload photos')
    } finally {
      if (successCount > 0) loadVisit()
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (desktopFileInputRef.current) desktopFileInputRef.current.value = ''
    }
  }

  const handleReplacePhoto = async (files: FileList | null, photoId: string, photoType: string) => {
    if (!files || files.length === 0 || !id) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', files[0])
      formData.append('visit_id', id)
      formData.append('photo_type', photoType)
      formData.append('replace_photo_id', photoId)
      const newPhoto = await tradeMarketingService.uploadPhoto(formData)
      // Optimistically update: remove old rejected photo, add new pending one immediately
      setVisit((prev: any) => {
        if (!prev) return prev
        const filtered = (prev.photos || []).filter((p: any) => p.id !== photoId)
        const added = newPhoto?.id ? [{
          id: newPhoto.id,
          r2_url: newPhoto.r2_url,
          photo_url: newPhoto.r2_url,
          thumbnail_url: newPhoto.thumbnail_url || null,
          photo_type: photoType,
          review_status: 'pending',
          captured_at: new Date().toISOString(),
        }, ...filtered] : filtered
        return { ...prev, photos: added }
      })
      toast.success('Photo replaced — pending admin review')
      loadVisit()
    } catch {
      toast.error('Failed to replace photo')
    } finally {
      setUploading(false)
      if (photoFileRefs.current[photoId]) photoFileRefs.current[photoId]!.value = ''
    }
  }

  const parseIndividualCfv = (v: any): Record<string, any> => {
    const individuals = v?.individuals || []
    if (individuals.length === 0) return {}
    try {
      return typeof individuals[0].custom_field_values === 'string'
        ? JSON.parse(individuals[0].custom_field_values)
        : individuals[0].custom_field_values || {}
    } catch { return {} }
  }

  const getGoldrushId = (v: any): string => parseIndividualCfv(v).goldrush_id || ''
  const getGoldrushRejected = (v: any): boolean => {
    const val = parseIndividualCfv(v).goldrush_id_rejected
    return val === true || val === 'true' || val === 1
  }
  const getGoldrushRejectionReason = (v: any): string => parseIndividualCfv(v).goldrush_id_rejection_reason || ''

  const handleSaveGoldrushId = async () => {
    if (!id) return
    setSavingGoldrushId(true)
    try {
      await fieldOperationsService.updateVisit(id, {
        custom_field_values: {
          goldrush_id: goldrushIdValue.trim(),
          goldrush_id_rejected: false,
          goldrush_id_rejection_reason: '',
        }
      })
      toast.success('Goldrush ID updated')
      setEditingGoldrushId(false)
      loadVisit()
    } catch {
      toast.error('Failed to update Goldrush ID')
    } finally {
      setSavingGoldrushId(false)
    }
  }

  // Pre-fill goldrush ID value when visit loads and the ID is rejected
  useEffect(() => {
    if (visit && getGoldrushRejected(visit)) {
      setGoldrushIdValue(getGoldrushId(visit))
    }
  }, [visit])

  // Detect mobile context by checking if path starts with /agent/
  const isMobileContext = location.pathname.startsWith('/agent/')

  useEffect(() => {
    loadVisit()
  }, [id])

  // Auto-scroll to rejected photos section if navigated here with ?scrollTo=rejected-photos
  useEffect(() => {
    if (!loading && searchParams.get('scrollTo') === 'rejected-photos') {
      setTimeout(() => {
        rejectedPhotosSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }, [loading, searchParams])

  const loadVisit = async () => {
    setLoading(true)
    try {
      const response = await fieldOperationsService.getVisit(id!)
      setVisit(response.data || response)
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

  // ─── MOBILE VIEW ────────────────────────────────────────────────────────────
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
    const hasRejectedPhotos = photos.some((p: any) => p.review_status === 'rejected')
    // Backend returns survey_responses as a parsed object; normalise to array-of-rows format
    const responses: any[] = visit.responses?.length
      ? visit.responses
      : visit.survey_responses
        ? [{ responses: typeof visit.survey_responses === 'string' ? visit.survey_responses : JSON.stringify(visit.survey_responses) }]
        : []
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
              {/* Goldrush ID — with rejection state */}
              {getGoldrushRejected(visit) && !editingGoldrushId && (
                <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Ban className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-orange-400">Goldrush ID Rejected</span>
                  </div>
                  {getGoldrushRejectionReason(visit) && (
                    <p className="text-xs text-orange-300/80 mb-2">{getGoldrushRejectionReason(visit)}</p>
                  )}
                  <p className="text-xs text-gray-400 mb-2">Please enter the correct Goldrush ID below.</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={goldrushIdValue}
                      onChange={e => setGoldrushIdValue(e.target.value.replace(/[^0-9]/g, ''))}
                      className="flex-1 px-3 py-2 text-sm bg-white/10 border border-orange-500/40 rounded-lg text-white placeholder-gray-500 focus:ring-1 focus:ring-orange-400"
                      placeholder="Enter correct ID"
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveGoldrushId() }}
                    />
                    <button
                      onClick={handleSaveGoldrushId}
                      disabled={savingGoldrushId || !goldrushIdValue.trim()}
                      className="px-3 py-2 bg-[#00E87B] text-[#0A1628] text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingGoldrushId ? 'Saving...' : 'Submit'}
                    </button>
                  </div>
                </div>
              )}
              {!getGoldrushRejected(visit) && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Goldrush ID</span>
                  {editingGoldrushId ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={goldrushIdValue}
                        onChange={e => setGoldrushIdValue(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-28 px-2 py-1 text-sm bg-white/10 border border-white/20 rounded text-white placeholder-gray-500 focus:ring-1 focus:ring-[#00E87B]"
                        placeholder="Numeric ID"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveGoldrushId(); if (e.key === 'Escape') setEditingGoldrushId(false); }}
                      />
                      <button onClick={handleSaveGoldrushId} disabled={savingGoldrushId} className="p-1 text-[#00E87B] disabled:opacity-50">
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingGoldrushId(false)} className="p-1 text-gray-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className={`text-sm ${getGoldrushId(visit) ? 'text-blue-400' : 'text-gray-600'}`}>
                        {getGoldrushId(visit) || '—'}
                      </span>
                      <button onClick={() => { setGoldrushIdValue(getGoldrushId(visit)); setEditingGoldrushId(true); }} className="p-1 text-gray-500 hover:text-[#00E87B]">
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
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

          {/* Photos — ref attached for scroll-to on rejected photo navigation */}
          <div ref={rejectedPhotosSectionRef} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3 h-3" /> Photos ({photos.length})
              </h3>
              {hasRejectedPhotos && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-[#00E87B]/10 text-[#00E87B] hover:bg-[#00E87B]/20 transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handlePhotoUpload(e.target.files)}
              />
            </div>

            {photos.length === 0 && (
              <div className="text-center py-6">
                <Camera className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No photos uploaded yet</p>
              </div>
            )}

            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo: any, idx: number) => (
                  <div key={photo.id || idx} className="rounded-lg overflow-hidden bg-white/5">
                    <div className="aspect-square relative">
                      <img
                        src={photo.r2_url || photo.photo_url || photo.url || (photo.photo_base64 ? `data:image/jpeg;base64,${photo.photo_base64}` : undefined)}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />

                      {/* Rejected overlay — tap to replace this specific photo */}
                      {photo.review_status === 'rejected' && (
                        <div className="absolute inset-0 bg-red-900/70 flex flex-col items-center justify-center gap-1 p-2">
                          <XCircle className="w-5 h-5 text-red-400" />
                          <span className="text-[10px] font-semibold text-red-300">Rejected</span>
                          {photo.rejection_reason && (
                            <span className="text-[10px] text-red-200 text-center line-clamp-2">
                              {photo.rejection_reason}
                            </span>
                          )}
                          <button
                            onClick={() => photoFileRefs.current[photo.id]?.click()}
                            disabled={uploading}
                            className="mt-1 flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md bg-[#00E87B] text-[#0A1628] disabled:opacity-50"
                          >
                            <Upload className="w-3 h-3" /> Tap to Replace
                          </button>
                          {/* Hidden input scoped to this photo */}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={el => { photoFileRefs.current[photo.id] = el }}
                            onChange={e => handleReplacePhoto(e.target.files, photo.id, photo.photo_type || 'general')}
                          />
                        </div>
                      )}

                      {/* Pending review badge */}
                      {photo.review_status === 'pending' && (
                        <div className="absolute bottom-0 left-0 right-0 bg-amber-500/90 py-1 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-white" />
                          <span className="text-[10px] font-semibold text-white">Pending Review</span>
                        </div>
                      )}
                    </div>

                    {/* Photo metadata */}
                    <div className="p-2 space-y-1">
                      {photo.ai_analysis_status === 'completed' && photo.ai_labels && (() => {
                        try {
                          const labels = typeof photo.ai_labels === 'string' ? JSON.parse(photo.ai_labels) : photo.ai_labels
                          if (labels && typeof labels === 'object') {
                            return (
                              <div className="space-y-1">
                                {labels.board_detected !== undefined && (
                                  <div className="flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-violet-400" />
                                    <span className="text-[10px] text-gray-400">Board:</span>
                                    <span className={`text-[10px] font-medium ${labels.board_detected ? 'text-green-400' : 'text-gray-500'}`}>
                                      {labels.board_detected ? 'Detected' : 'Not found'}
                                    </span>
                                  </div>
                                )}
                                {labels.brand && (
                                  <div className="flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-violet-400" />
                                    <span className="text-[10px] text-gray-400">Brand:</span>
                                    <span className="text-[10px] font-medium text-white">{labels.brand}</span>
                                  </div>
                                )}
                                {labels.condition && (
                                  <div className="flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-violet-400" />
                                    <span className="text-[10px] text-gray-400">Condition:</span>
                                    <span className={`text-[10px] font-medium ${labels.condition === 'good' ? 'text-green-400' : labels.condition === 'damaged' ? 'text-red-400' : 'text-yellow-400'}`}>
                                      {labels.condition}
                                    </span>
                                  </div>
                                )}
                                {labels.visibility && (
                                  <div className="flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-violet-400" />
                                    <span className="text-[10px] text-gray-400">Visibility:</span>
                                    <span className={`text-[10px] font-medium ${labels.visibility === 'high' ? 'text-green-400' : labels.visibility === 'low' ? 'text-red-400' : 'text-yellow-400'}`}>
                                      {labels.visibility}
                                    </span>
                                  </div>
                                )}
                                {labels.description && !labels.brand && !labels.condition && (
                                  <p className="text-[10px] text-gray-400 truncate" title={labels.description}>{labels.description}</p>
                                )}
                              </div>
                            )
                          }
                          return null
                        } catch { return null }
                      })()}
                      {photo.ai_analysis_status === 'processing' && (
                        <div className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                          <span className="text-[10px] text-amber-400">AI analyzing...</span>
                        </div>
                      )}
                      {photo.ai_share_of_voice != null && photo.ai_share_of_voice > 0 && (
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
            )}
          </div>

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

  // ─── DESKTOP VIEW ────────────────────────────────────────────────────────────
  const durationStr = (() => {
    if (visit.check_in_time && visit.check_out_time) {
      const mins = Math.round((new Date(visit.check_out_time).getTime() - new Date(visit.check_in_time).getTime()) / 60000)
      if (mins <= 0) return undefined
      if (mins < 60) return `${mins} min`
      return `${Math.floor(mins / 60)}h ${mins % 60}m`
    }
    return undefined
  })()

  const photos = visit.photos || []
  const hasRejectedPhotos = photos.some((p: any) => p.review_status === 'rejected')
  // Backend returns survey_responses as a parsed object; normalise to array-of-rows format
  const responses: any[] = visit.responses?.length
    ? visit.responses
    : visit.survey_responses
      ? [{ responses: typeof visit.survey_responses === 'string' ? visit.survey_responses : JSON.stringify(visit.survey_responses) }]
      : []

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
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Camera className="w-5 h-5" /> Photos ({photos.length})
          </h3>
          {hasRejectedPhotos && (
            <button
              onClick={() => desktopFileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Upload Photos'}
            </button>
          )}
          <input
            ref={desktopFileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handlePhotoUpload(e.target.files)}
          />
        </div>

        {photos.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            <Camera className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No photos uploaded for this visit</p>
          </div>
        )}

        {/* Rejected photos warning banner */}
        {photos.some((p: any) => p.review_status === 'rejected') && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">Some photos were rejected by admin</span>
            </div>
            <p className="text-xs text-red-600 dark:text-red-400/70 mt-1">Click the rejected photo to upload a replacement.</p>
          </div>
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((photo: any, idx: number) => (
              <div key={photo.id || idx} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="aspect-square relative">
                  <img
                    src={photo.r2_url || photo.photo_url || photo.url || (photo.photo_base64 ? `data:image/jpeg;base64,${photo.photo_base64}` : undefined)}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  />

                  {/* Desktop rejected overlay */}
                  {photo.review_status === 'rejected' && (
                    <div className="absolute inset-0 bg-red-900/70 flex flex-col items-center justify-center gap-1 p-2">
                      <XCircle className="w-6 h-6 text-red-400" />
                      <span className="text-xs font-semibold text-red-300">Rejected</span>
                      {photo.rejection_reason && (
                        <span className="text-[11px] text-red-200 text-center line-clamp-2">
                          {photo.rejection_reason}
                        </span>
                      )}
                      <button
                        onClick={() => photoFileRefs.current[photo.id]?.click()}
                        disabled={uploading}
                        className="mt-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#00E87B] text-[#0A1628] hover:bg-[#00E87B]/90 disabled:opacity-50 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" /> Click to Replace
                      </button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={el => { photoFileRefs.current[photo.id] = el }}
                        onChange={e => handleReplacePhoto(e.target.files, photo.id, photo.photo_type || 'general')}
                      />
                    </div>
                  )}

                  {/* Pending review badge */}
                  {photo.review_status === 'pending' && (
                    <div className="absolute bottom-0 left-0 right-0 bg-amber-500/90 py-1.5 flex items-center justify-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs font-semibold text-white">Pending Review</span>
                    </div>
                  )}
                </div>

                {((photo.ai_analysis_status === 'completed' && photo.ai_labels) || photo.ai_analysis_status === 'processing' || (photo.ai_share_of_voice != null && photo.ai_share_of_voice > 0) || photo.board_condition) && (
                  <div className="p-2 space-y-1 bg-gray-50 dark:bg-gray-700/50">
                    {photo.ai_analysis_status === 'completed' && photo.ai_labels && (() => {
                      try {
                        const labels = typeof photo.ai_labels === 'string' ? JSON.parse(photo.ai_labels) : photo.ai_labels
                        if (labels && typeof labels === 'object') {
                          return (
                            <div className="space-y-1">
                              {labels.board_detected !== undefined && (
                                <div className="flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-violet-500" />
                                  <span className="text-xs text-gray-500">Board:</span>
                                  <span className={`text-xs font-medium ${labels.board_detected ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                    {labels.board_detected ? 'Detected' : 'Not found'}
                                  </span>
                                </div>
                              )}
                              {labels.brand && (
                                <div className="flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-violet-500" />
                                  <span className="text-xs text-gray-500">Brand:</span>
                                  <span className="text-xs font-medium text-gray-900 dark:text-white">{labels.brand}</span>
                                </div>
                              )}
                              {labels.condition && (
                                <div className="flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-violet-500" />
                                  <span className="text-xs text-gray-500">Condition:</span>
                                  <span className={`text-xs font-medium ${labels.condition === 'good' ? 'text-green-600 dark:text-green-400' : labels.condition === 'damaged' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                    {labels.condition}
                                  </span>
                                </div>
                              )}
                              {labels.visibility && (
                                <div className="flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-violet-500" />
                                  <span className="text-xs text-gray-500">Visibility:</span>
                                  <span className={`text-xs font-medium ${labels.visibility === 'high' ? 'text-green-600 dark:text-green-400' : labels.visibility === 'low' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                    {labels.visibility}
                                  </span>
                                </div>
                              )}
                              {labels.description && !labels.brand && !labels.condition && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={labels.description}>{labels.description}</p>
                              )}
                            </div>
                          )
                        }
                        return null
                      } catch { return null }
                    })()}
                    {photo.ai_analysis_status === 'processing' && (
                      <div className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
                        <span className="text-xs text-amber-600 dark:text-amber-400">AI analyzing...</span>
                      </div>
                    )}
                    {photo.ai_share_of_voice != null && photo.ai_share_of_voice > 0 && (
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
        )}
      </div>

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
                    <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
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