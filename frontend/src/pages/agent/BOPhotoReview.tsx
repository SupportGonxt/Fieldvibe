import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Check, X, Loader2, CheckCircle2, Camera } from 'lucide-react'
import { photoReviewService } from '../../services/insights.service'

// Mobile adaptation of field-operations/photos/AdminPhotoReviewPage — same
// endpoints (photoReviewService), pending-first queue, dark PWA skin. The BO
// admin clears this from BOActionQueue's "photos to review" tap-through.

type PhotoItem = {
  id: string
  r2_url: string
  review_status: 'approved' | 'rejected' | null
  rejection_reason: string | null
  photo_uploaded_at: string
  visit_date: string
  agent_name: string
  store_name: string | null
  individual_name: string | null
  individual_surname: string | null
  goldrush_id: string | null
}

type ReviewResponse = {
  photos: PhotoItem[]
  pagination: { total: number; page: number; limit: number }
}

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
] as const

const displayName = (p: PhotoItem) =>
  p.store_name || [p.individual_name, p.individual_surname].filter(Boolean).join(' ') || 'Unknown'

export default function BOPhotoReview() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [status, setStatus] = useState<string>('pending')
  const [page, setPage] = useState(1)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)

  const { data, isLoading, isFetching } = useQuery<ReviewResponse>({
    queryKey: ['bo-photo-review', status, page],
    queryFn: () =>
      photoReviewService.getAdminReview({ page: String(page), limit: '24', review_status: status }),
    placeholderData: keepPreviousData,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bo-photo-review'] })
    qc.invalidateQueries({ queryKey: ['admin-photo-review'] })
  }

  const approve = useMutation({
    mutationFn: (id: string) => photoReviewService.approvePhoto(id),
    onSuccess: () => { toast.success('Approved'); invalidate() },
    onError: () => toast.error('Could not approve photo'),
  })

  const reject = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) =>
      photoReviewService.rejectPhoto(id, why || 'Photo rejected by admin'),
    onSuccess: () => { toast.success('Rejected — agent will reshoot'); setRejecting(null); setReason(''); invalidate() },
    onError: () => toast.error('Could not reject photo'),
  })

  const photos = data?.photos || []
  const total = data?.pagination?.total ?? 0
  const hasMore = page * 24 < total

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => navigate('/agent/dashboard')} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Photo review</h1>
          <p className="text-xs text-gray-500">{total} {status}</p>
        </div>
      </div>

      <div className="flex gap-2 px-5 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setStatus(f.key); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              status === f.key
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-white/[0.03] text-gray-400 border-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : photos.length === 0 ? (
        <div className="mx-5 flex items-center gap-3 bg-primary/[0.06] border border-primary/20 rounded-2xl px-4 py-4">
          {status === 'pending'
            ? <><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /><span className="text-sm text-white">Nothing waiting for review.</span></>
            : <><Camera className="w-5 h-5 text-gray-500 shrink-0" /><span className="text-sm text-gray-400">No {status} photos.</span></>}
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {photos.map((p) => (
            <div key={p.id} className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
              <button onClick={() => setLightbox(p.r2_url)} className="block w-full">
                <img src={p.r2_url} alt="visit" className="w-full h-48 object-cover" loading="lazy" />
              </button>
              <div className="p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-white font-medium truncate">{displayName(p)}</span>
                  <span className="text-[11px] text-gray-500 shrink-0">{p.visit_date}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {p.agent_name}{p.goldrush_id ? ` · GR ${p.goldrush_id}` : ''}
                </p>
                {p.review_status === 'rejected' && p.rejection_reason && (
                  <p className="text-xs text-red-300 mt-1">{p.rejection_reason}</p>
                )}
                {p.review_status === null && (
                  rejecting === p.id ? (
                    <div className="mt-2 space-y-2">
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason (agent sees this)"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-red-400/50"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => reject.mutate({ id: p.id, why: reason.trim() })}
                          disabled={reject.isPending}
                          className="flex-1 min-h-[44px] rounded-xl bg-red-600 text-white text-sm font-semibold"
                        >
                          {reject.isPending ? 'Rejecting…' : 'Confirm reject'}
                        </button>
                        <button onClick={() => { setRejecting(null); setReason('') }} className="min-h-[44px] px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => approve.mutate(p.id)}
                        disabled={approve.isPending}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-on-primary text-sm font-semibold active:scale-[0.99]"
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => setRejecting(p.id)}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm font-semibold active:scale-[0.99]"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={() => setPage((n) => n + 1)}
              disabled={isFetching}
              className="w-full min-h-[44px] rounded-2xl bg-white/[0.03] border border-white/10 text-sm text-gray-300"
            >
              {isFetching ? 'Loading…' : `Load more (${total - page * 24} left)`}
            </button>
          )}
        </div>
      )}

      {lightbox && (
        <button onClick={() => setLightbox(null)} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <img src={lightbox} alt="full" className="max-w-full max-h-full object-contain rounded-xl" />
        </button>
      )}
    </div>
  )
}
