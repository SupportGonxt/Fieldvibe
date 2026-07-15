import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Loader2, Wallet, AlertTriangle } from 'lucide-react'
import { apiClient } from '../../services/api.service'

// PWA view of the caller's OWN commission/incentive pay — the one rand surface
// every field role is allowed (money rules: own pay only). Backed by the
// self-scoped /commission-earnings/my endpoint; pending rows can be disputed.
// Dark-card idiom mirrors BOCommissions.

type EarningRow = {
  id: string
  source_type: string | null
  rule_name: string | null
  amount: number
  status: string
  dispute_reason: string | null
  rejection_reason: string | null
  reversal_reason: string | null
  created_at: string
  approved_at: string | null
}

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
] as const

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  disputed: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  approved: 'bg-primary/15 text-primary border-primary/30',
  paid: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  reversed: 'bg-white/5 text-gray-400 border-white/10',
}

const rand = (n: number) => `R${Number(n || 0).toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`
const day = (iso: string | null) => iso?.split('T')[0]?.split(' ')[0] || null

export default function MyEarnings() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [status, setStatus] = useState<string>('')
  const [disputing, setDisputing] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const { data: rows, isLoading, isError } = useQuery<EarningRow[]>({
    queryKey: ['my-earnings', status],
    queryFn: () =>
      apiClient
        .get('/commission-earnings/my', { params: status ? { status } : {} })
        .then((r) => r.data.data || []),
    placeholderData: keepPreviousData,
  })

  const dispute = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) =>
      apiClient.post(`/commission-earnings/${id}/dispute`, { reason: why }),
    onSuccess: () => {
      toast.success('Dispute submitted — a manager will review')
      setDisputing(null)
      setReason('')
      qc.invalidateQueries({ queryKey: ['my-earnings'] })
    },
    onError: () => toast.error('Could not submit dispute'),
  })

  const list = rows || []
  const sum = (s: (r: EarningRow) => boolean) => list.reduce((t, r) => (s(r) ? t + Number(r.amount || 0) : t), 0)
  const totals = {
    pending: sum((r) => r.status === 'pending' || r.status === 'disputed'),
    approved: sum((r) => r.status === 'approved'),
    paid: sum((r) => r.status === 'paid'),
  }

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => navigate('/agent/profile')} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">My Earnings</h1>
          <p className="text-xs text-gray-500">Your commission &amp; incentive pay</p>
        </div>
      </div>

      {/* totals — own pay in rand is allowed for every role */}
      <div className="grid grid-cols-3 gap-2 px-5 mb-3">
        {([
          ['Pending', totals.pending, 'text-amber-300'],
          ['Approved', totals.approved, 'text-primary'],
          ['Paid', totals.paid, 'text-blue-300'],
        ] as const).map(([label, amount, tone]) => (
          <div key={label} className="bg-white/[0.03] border border-white/10 rounded-2xl px-3 py-2.5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
            <p className={`text-sm font-bold ${tone}`}>{rand(amount)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 px-5 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
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
      ) : isError ? (
        <div className="mx-5 flex items-center gap-3 bg-red-500/[0.06] border border-red-500/20 rounded-2xl px-4 py-4">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm text-red-300">Could not load your earnings. Pull down to retry.</span>
        </div>
      ) : list.length === 0 ? (
        <div className="mx-5 flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-4">
          <Wallet className="w-5 h-5 text-gray-500 shrink-0" />
          <span className="text-sm text-gray-400">No {status || ''} earnings yet.</span>
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {list.map((r) => (
            <div key={r.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-white font-medium capitalize truncate">
                  {(r.rule_name || r.source_type || 'Commission').replace(/_/g, ' ')}
                </span>
                <span className="text-white font-semibold shrink-0">{rand(r.amount)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${STATUS_TONE[r.status] || STATUS_TONE.reversed}`}>
                  {r.status}
                </span>
                <p className="text-xs text-gray-500">
                  {[day(r.created_at), r.approved_at ? `approved ${day(r.approved_at)}` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              {r.status === 'disputed' && r.dispute_reason && (
                <p className="text-xs text-orange-300 mt-1">"{r.dispute_reason}"</p>
              )}
              {r.status === 'rejected' && r.rejection_reason && (
                <p className="text-xs text-red-300 mt-1">{r.rejection_reason}</p>
              )}
              {r.status === 'reversed' && r.reversal_reason && (
                <p className="text-xs text-gray-400 mt-1">{r.reversal_reason}</p>
              )}
              {r.status === 'pending' && (
                disputing === r.id ? (
                  <div className="mt-2 space-y-2">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why is this wrong? (required)"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-orange-400/50"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => reason.trim() && dispute.mutate({ id: r.id, why: reason.trim() })}
                        disabled={dispute.isPending || !reason.trim()}
                        className="flex-1 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 text-sm font-medium disabled:opacity-50"
                      >
                        {dispute.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit dispute'}
                      </button>
                      <button
                        onClick={() => { setDisputing(null); setReason('') }}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setDisputing(r.id); setReason('') }}
                    className="mt-2 flex items-center gap-1.5 text-xs text-orange-300"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Looks wrong? Dispute it
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
