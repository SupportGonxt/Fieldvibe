import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, PlayCircle, ShieldCheck } from 'lucide-react'
import { apiClient } from '../../services/api.service'

// Goldrush individual visits held by a photo review (three failed photo attempts).
// Waiting = Back Office / GM haven't decided yet; approved = the photo was accepted and
// the agent continues the visit from where they stopped (unfinished until submitted).

export interface UnfinishedVisit {
  id: string
  status: 'pending' | 'approved'
  first_name: string | null
  last_name: string | null
  goldrush_id: string | null
  created_at: string
  reviewed_at: string | null
}

export const resumeVisitPath = (reviewId: string) => `/agent/visits/create?type=individual&resume=${reviewId}`

export function useUnfinishedGoldrushVisits() {
  const [visits, setVisits] = useState<UnfinishedVisit[]>([])
  useEffect(() => {
    let live = true
    apiClient.get('/field-ops/goldrush-photo/unfinished')
      .then(res => { if (live) setVisits(res.data?.visits || []) })
      .catch(() => { /* optional panel — the visit list still loads */ })
    return () => { live = false }
  }, [])
  return visits
}

const nameOf = (v: UnfinishedVisit) => [v.first_name, v.last_name].filter(Boolean).join(' ') || 'Goldrush individual visit'

// Shown at the top of My Visits.
export default function UnfinishedGoldrushVisits() {
  const navigate = useNavigate()
  const visits = useUnfinishedGoldrushVisits()
  if (visits.length === 0) return null
  return (
    <div className="mb-4">
      <div className="text-xs text-token-faint uppercase tracking-wide mb-2">Unfinished visits</div>
      <div className="space-y-2">
        {visits.map(v => v.status === 'approved' ? (
          <button
            key={v.id}
            onClick={() => navigate(resumeVisitPath(v.id))}
            className="w-full flex items-center gap-3 text-left bg-primary/[0.08] border border-primary/30 rounded-xl p-3.5 active:scale-[0.99] transition-transform"
          >
            <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-token truncate">{nameOf(v)}</div>
              <div className="text-xs text-token-faint">Photo approved — tap to continue this visit</div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
              <PlayCircle className="w-4 h-4" /> Continue
            </span>
          </button>
        ) : (
          <div key={v.id} className="w-full flex items-center gap-3 bg-white/5 border border-token rounded-xl p-3.5">
            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-token truncate">Goldrush individual visit</div>
              <div className="text-xs text-token-faint">Waiting for review — you can carry on with other visits</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Pops up once per session (e.g. after logging in) when a visit's photo was approved.
export function ApprovedVisitPrompt() {
  const navigate = useNavigate()
  const visits = useUnfinishedGoldrushVisits()
  const [dismissed, setDismissed] = useState(false)
  const approved = visits.filter(v => v.status === 'approved')
  const key = approved.map(v => v.id).join(',')
  let seen = false
  try { seen = !!key && sessionStorage.getItem('approved-visit-prompt') === key } catch { /* storage blocked */ }
  if (approved.length === 0 || dismissed || seen) return null
  const close = () => {
    try { sessionStorage.setItem('approved-visit-prompt', key) } catch { /* storage blocked */ }
    setDismissed(true)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Visit approved">
      <div className="w-full max-w-sm bg-surface border border-token rounded-2xl p-5">
        <ShieldCheck className="w-8 h-8 text-primary mb-2" />
        <h2 className="text-lg font-bold text-token">
          {approved.length === 1 ? 'Your visit was approved' : `${approved.length} visits were approved`}
        </h2>
        <p className="text-sm text-token-muted mt-1">
          The photo for {approved.length === 1 ? nameOf(approved[0]) : 'these visits'} was approved. Continue with your visit to finish it.
        </p>
        <div className="flex gap-2 mt-4">
          <button onClick={close} className="flex-1 min-h-[44px] rounded-xl bg-white/5 border border-token text-sm text-token-muted">
            Later
          </button>
          <button
            onClick={() => { close(); navigate(approved.length === 1 ? resumeVisitPath(approved[0].id) : '/agent/visits') }}
            className="flex-1 min-h-[44px] rounded-xl bg-primary text-on-primary text-sm font-semibold"
          >
            Continue visit
          </button>
        </div>
      </div>
    </div>
  )
}
