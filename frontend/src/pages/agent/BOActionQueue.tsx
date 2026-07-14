import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote, Bell, Camera, CloudOff, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { photoReviewService } from '../../services/insights.service'

// BO Home work queue: the back-office admin's job is clearing gates — unmatched
// deposits and unactioned agent notifications. This surfaces both as live counts
// that tap straight to the screen that clears them, worst-first. When both are
// zero it says so (unlike a passive KPI card that just hides) so the admin knows
// the queue is actually clear, not just unloaded. Footer keeps the 7d acted stat.

type DepositRow = { matched: boolean }
type Stats = { received: number; acted: number }

type Action = {
  key: string
  tone: 'bad' | 'warn'
  icon: typeof Banknote
  count: number
  label: string
  hint: string
  to: string
}

const toneCls = {
  bad: 'bg-red-500/15 text-red-300 border-red-500/30',
  warn: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
}

export default function BOActionQueue() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [unmatched, setUnmatched] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [pendingPhotos, setPendingPhotos] = useState(0)
  const [uploadFails, setUploadFails] = useState(0)

  useEffect(() => {
    let live = true
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    Promise.all([
      apiClient.get('/field-ops/deposits?limit=200').catch(() => null),
      apiClient.get('/field-ops/issues/stats').catch(() => null),
      photoReviewService.getAdminReview({ page: '1', limit: '1', review_status: 'pending' }).catch(() => null),
      apiClient.get(`/field-ops/reports/goldrush-upload-failures?startDate=${weekAgo}&endDate=${today}`).catch(() => null),
    ]).then(([dep, st, rev, uf]) => {
      if (!live) return
      const rows: DepositRow[] = dep?.data?.deposits || []
      setUnmatched(rows.filter((r) => !r.matched).length)
      if (st?.data?.success) setStats({ received: st.data.received, acted: st.data.acted })
      setPendingPhotos(rev?.pagination?.total || 0)
      setUploadFails(uf?.data?.total || uf?.data?.data?.length || 0)
      setLoading(false)
    })
    return () => { live = false }
  }, [])

  const outstanding = stats ? Math.max(0, stats.received - stats.acted) : 0

  const actions: Action[] = []
  if (unmatched > 0)
    actions.push({
      key: 'deposits', tone: 'bad', icon: Banknote, count: unmatched,
      label: `${unmatched} deposit${unmatched === 1 ? '' : 's'} unmatched`,
      hint: 'Chase the signup or remove the row', to: '/agent/deposits',
    })
  if (uploadFails > 0)
    actions.push({
      key: 'uploads', tone: 'bad', icon: CloudOff, count: uploadFails,
      label: `${uploadFails} signup${uploadFails === 1 ? '' : 's'} not loaded`,
      hint: 'Fix the capture so it loads', to: '/agent/upload-failures',
    })
  if (pendingPhotos > 0)
    actions.push({
      key: 'photos', tone: 'warn', icon: Camera, count: pendingPhotos,
      label: `${pendingPhotos} photo${pendingPhotos === 1 ? '' : 's'} to review`,
      hint: 'Approve or reject for reshoot', to: '/agent/photo-review',
    })
  if (outstanding > 0)
    actions.push({
      key: 'notifs', tone: 'warn', icon: Bell, count: outstanding,
      label: `${outstanding} notification${outstanding === 1 ? '' : 's'} to action`,
      hint: 'Call the agent to clear it', to: '/agent/call-list',
    })

  if (loading)
    return (
      <div className="flex justify-center bg-white/[0.03] border border-white/10 rounded-2xl py-6 mb-4">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    )

  return (
    <div className="mb-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Your queue</div>
      {actions.length === 0 ? (
        <div className="flex items-center gap-3 bg-primary/[0.06] border border-primary/20 rounded-2xl px-4 py-4">
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          <div className="text-sm text-white">Queue clear — nothing waiting.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.key}
                onClick={() => navigate(a.to)}
                className="flex items-center w-full text-left bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 active:scale-[0.99] transition-transform"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${toneCls[a.tone]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 ml-3">
                  <div className="text-white font-medium truncate">{a.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{a.hint}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600 shrink-0" />
              </button>
            )
          })}
        </div>
      )}
      {stats && stats.received > 0 && (
        <div className="text-[11px] text-gray-600 mt-2 px-1">
          {stats.acted}/{stats.received} notifications acted · 7d
        </div>
      )}
    </div>
  )
}
