import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Check, X, Loader2, CheckCircle2, FileText } from 'lucide-react'
import { kycService } from '../../services/kyc.service'

// Mobile KYC approve/reject for the BO admin — dark PWA skin like BOPhotoReview.
// Uses the kyc_cases lifecycle (kycService.getKYCCases/approveKYCCase/rejectKYCCase):
// the desktop KYCManagement "submission" approve/reject endpoints (/kyc/:id/approve)
// are 501 stubs server-side; /kyc/cases/:id/approve|reject are the DB-backed ones.

type KYCCase = {
  id: string
  case_number: string
  customer_id: string | null
  customer_name: string | null
  status: string
  risk_level: string | null
  notes: string | null
  rejection_reason: string | null
  created_at: string
}

type CasesResponse = {
  cases: KYCCase[]
  pagination: { total: number; page: number; limit: number }
}

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
] as const

const riskCls: Record<string, string> = {
  low: 'bg-primary/15 text-primary border-primary/30',
  medium: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  high: 'bg-red-500/15 text-red-300 border-red-500/30',
}

const PAGE_SIZE = 50

export default function BOKyc() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [status, setStatus] = useState<string>('pending')
  const [page, setPage] = useState(1)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const { data, isLoading, isFetching } = useQuery<CasesResponse>({
    queryKey: ['bo-kyc-cases', status, page],
    queryFn: () => kycService.getKYCCases({ status, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['bo-kyc-cases'] })

  const approve = useMutation({
    mutationFn: (id: string) => kycService.approveKYCCase(id),
    onSuccess: () => { toast.success('KYC approved'); invalidate() },
    onError: () => toast.error('Could not approve KYC case'),
  })

  const reject = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => kycService.rejectKYCCase(id, why),
    onSuccess: () => { toast.success('KYC rejected'); setRejecting(null); setReason(''); invalidate() },
    onError: () => toast.error('Could not reject KYC case'),
  })

  const cases = data?.cases || []
  const total = data?.pagination?.total ?? 0
  const hasMore = page * PAGE_SIZE < total

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => navigate('/agent/dashboard')} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">KYC review</h1>
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
      ) : cases.length === 0 ? (
        <div className="mx-5 flex items-center gap-3 bg-primary/[0.06] border border-primary/20 rounded-2xl px-4 py-4">
          {status === 'pending'
            ? <><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /><span className="text-sm text-white">Nothing waiting for review.</span></>
            : <><FileText className="w-5 h-5 text-gray-500 shrink-0" /><span className="text-sm text-gray-400">No {status} cases.</span></>}
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {cases.map((k) => (
            <div key={k.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-white font-medium truncate">{k.customer_name || 'Unknown customer'}</span>
                <span className="text-[11px] text-gray-500 shrink-0">{k.created_at?.slice(0, 10)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">{k.case_number}</span>
                {k.risk_level && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${riskCls[k.risk_level] || riskCls.medium}`}>
                    {k.risk_level} risk
                  </span>
                )}
              </div>
              {k.notes && <p className="text-xs text-gray-400 mt-1.5">{k.notes}</p>}
              {k.status === 'rejected' && k.rejection_reason && (
                <p className="text-xs text-red-300 mt-1.5">{k.rejection_reason}</p>
              )}
              {k.status !== 'approved' && k.status !== 'rejected' && (
                rejecting === k.id ? (
                  <div className="mt-2 space-y-2">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Rejection reason (required)"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-red-400/50"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => reason.trim() && reject.mutate({ id: k.id, why: reason.trim() })}
                        disabled={reject.isPending || !reason.trim()}
                        className="flex-1 min-h-[44px] rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
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
                      onClick={() => approve.mutate(k.id)}
                      disabled={approve.isPending}
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-on-primary text-sm font-semibold active:scale-[0.99]"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => setRejecting(k.id)}
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm font-semibold active:scale-[0.99]"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
          {hasMore && (
            <button
              onClick={() => setPage((n) => n + 1)}
              disabled={isFetching}
              className="w-full min-h-[44px] rounded-2xl bg-white/[0.03] border border-white/10 text-sm text-gray-300"
            >
              {isFetching ? 'Loading…' : `Load more (${total - page * PAGE_SIZE} left)`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
