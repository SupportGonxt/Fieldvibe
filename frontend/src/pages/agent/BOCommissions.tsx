import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Check, X, Loader2, CheckCircle2, Wallet } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { apiClient } from '../../services/api.service'
import { hasRole } from '../../store/auth.store'

// Mobile adaptation of commissions/CommissionApprovalPage — same
// commission-earnings endpoints, pending-first queue, dark PWA skin. The BO
// admin clears this from BOActionQueue's "commissions to approve" tap-through.
// BO admin is admin-equivalent (roleAllows), so rand amounts show here.

type EarningRow = {
  id: string
  earner_name: string | null
  amount: number
  source_type: string | null
  rule_name: string | null
  status: string
  rejection_reason: string | null
  created_at: string
}

type EarningsResponse = {
  earnings: EarningRow[]
  totalAmount: number
  pagination: { total: number; page: number; limit: number }
}

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
] as const

const rand = (n: number) => `R${Number(n || 0).toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`

export default function BOCommissions() {
  // Approval is admin-equivalent only; field roles landing here get their own-pay view instead.
  if (!hasRole('admin')) return <Navigate to="/agent/earnings" replace />
  return <BOCommissionsInner />
}

function BOCommissionsInner() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [status, setStatus] = useState<string>('pending')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const { data, isLoading } = useQuery<EarningsResponse>({
    queryKey: ['bo-commissions', status],
    queryFn: () =>
      apiClient
        .get('/commission-earnings', { params: { status, limit: 100 } })
        .then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['bo-commissions'] })

  const approve = useMutation({
    mutationFn: (id: string) => apiClient.put(`/commission-earnings/${id}/approve`),
    onSuccess: () => { toast.success('Approved'); invalidate() },
    onError: () => toast.error('Could not approve commission'),
  })

  const approveAll = useMutation({
    mutationFn: (ids: string[]) => apiClient.post('/commission-earnings/bulk-approve', { ids }),
    onSuccess: (_r, ids) => { toast.success(`${ids.length} approved`); invalidate() },
    onError: () => toast.error('Could not approve commissions'),
  })

  const reject = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) =>
      apiClient.put(`/commission-earnings/${id}/reject`, { reason: why }),
    onSuccess: () => { toast.success('Rejected'); setRejecting(null); setReason(''); invalidate() },
    onError: () => toast.error('Could not reject commission'),
  })

  const rows = data?.earnings || []
  const total = data?.pagination?.total ?? 0

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => navigate('/agent/dashboard')} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white">Commissions</h1>
          <p className="text-xs text-gray-500">
            {total} {status}{data ? ` · ${rand(data.totalAmount)}` : ''}
          </p>
        </div>
        {status === 'pending' && rows.length > 1 && (
          <button
            onClick={() => approveAll.mutate(rows.map((r) => r.id))}
            disabled={approveAll.isPending}
            className="px-3 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs font-semibold shrink-0"
          >
            {approveAll.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Approve all ${rows.length}`}
          </button>
        )}
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
      ) : rows.length === 0 ? (
        <div className="mx-5 flex items-center gap-3 bg-primary/[0.06] border border-primary/20 rounded-2xl px-4 py-4">
          {status === 'pending'
            ? <><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /><span className="text-sm text-white">Nothing waiting for approval.</span></>
            : <><Wallet className="w-5 h-5 text-gray-500 shrink-0" /><span className="text-sm text-gray-400">No {status} commissions.</span></>}
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-white font-medium truncate">{r.earner_name || 'Unknown earner'}</span>
                <span className="text-white font-semibold shrink-0">{rand(r.amount)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {[r.source_type, r.rule_name, r.created_at?.split('T')[0]?.split(' ')[0]].filter(Boolean).join(' · ')}
              </p>
              {r.status === 'rejected' && r.rejection_reason && (
                <p className="text-xs text-red-300 mt-1">{r.rejection_reason}</p>
              )}
              {r.status === 'pending' && (
                rejecting === r.id ? (
                  <div className="mt-2 space-y-2">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason (required)"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-red-400/50"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => reason.trim() && reject.mutate({ id: r.id, why: reason.trim() })}
                        disabled={reject.isPending || !reason.trim()}
                        className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm font-medium disabled:opacity-50"
                      >
                        {reject.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm reject'}
                      </button>
                      <button
                        onClick={() => { setRejecting(null); setReason('') }}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => approve.mutate(r.id)}
                      disabled={approve.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-medium disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => { setRejecting(r.id); setReason('') }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm font-medium"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
