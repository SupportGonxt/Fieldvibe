// Per-BO-admin throughput for the GM: photo reviews, calls and issue actions over the
// last 7/30 days, plus the shared queues (pending photo reviews, unmatched deposits)
// with oldest-item age. Self-fetching so both GM views mount it with one line.
// Two skins, same reason as IssueQueue: the PWA shell is hard-dark, `dark:` never fires there.
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck } from 'lucide-react'
import { apiClient } from '../../services/api.service'

type Window = { photosApproved: number; photosRejected: number; calls: number; answered: number; issuesActed: number; total: number }
type BoAdminPerf = { id: string; name: string; lastSeen: string | null; d7: Window; d30: Window }
type Queue = { depth: number; oldestDays: number | null }
type BoPerformance = {
  success: boolean
  since: { d7: string; d30: string }
  admins: BoAdminPerf[]
  queues: { photoReview: Queue; unmatchedDeposits: Queue }
}

// A queue is stale when its oldest item has sat for 3+ days.
const STALE_DAYS = 3

type Surface = 'web' | 'pwa'
const SKIN = {
  web: {
    section: 'card',
    title: 'font-semibold flex items-center gap-2',
    icon: 'w-4 h-4 text-content-secondary',
    row: 'p-2.5 bg-surface-secondary rounded-lg',
    name: 'font-medium text-sm truncate',
    sub: 'text-xs text-content-secondary mt-1',
    muted: 'text-sm text-content-secondary',
    num: 'text-sm font-semibold tabular-nums shrink-0',
    faint: 'text-xs text-content-secondary',
    warn: 'text-amber-600 font-medium',
  },
  pwa: {
    section: 'bg-white/[0.03] border border-token rounded-2xl p-4 mb-4',
    title: 'text-sm font-semibold text-token flex items-center gap-2',
    icon: 'w-4 h-4 text-primary',
    row: '',
    name: 'text-sm text-token truncate',
    sub: 'text-xs text-token-faint tabular-nums mt-0.5',
    muted: 'text-xs text-token-faint',
    num: 'text-sm font-semibold text-token tabular-nums shrink-0',
    faint: 'text-xs text-token-faint',
    warn: 'text-amber-400 font-medium',
  },
} satisfies Record<Surface, Record<string, string>>

function queueLabel(label: string, q: Queue): { text: string; stale: boolean } {
  const stale = q.depth > 0 && (q.oldestDays ?? 0) >= STALE_DAYS
  const age = q.depth > 0 && q.oldestDays != null ? ` · oldest ${q.oldestDays}d` : ''
  return { text: `${label}: ${q.depth}${age}`, stale }
}

export default function BoPerformanceCard({ surface = 'web' }: { surface?: Surface }) {
  const s = SKIN[surface]
  const { data } = useQuery({
    queryKey: ['gm-bo-performance'],
    queryFn: () => apiClient.get('/field-ops/gm/bo-performance').then((r) => r.data as BoPerformance),
    staleTime: 1000 * 60 * 2,
  })
  if (!data?.success) return null

  const queues = [
    queueLabel('Photo queue', data.queues.photoReview),
    queueLabel('Unmatched deposits', data.queues.unmatchedDeposits),
  ]

  return (
    <div className={s.section}>
      <h2 className={`${s.title} mb-1`}><ClipboardCheck className={s.icon} /> Back-office throughput</h2>
      <p className={`${s.faint} mb-3`}>
        {queues.map((q, i) => (
          <span key={i}>
            {i > 0 && ' · '}
            <span className={q.stale ? s.warn : undefined}>{q.text}{q.stale ? ' (stale)' : ''}</span>
          </span>
        ))}
      </p>
      {data.admins.length === 0 ? (
        <p className={s.muted}>No back-office staff on roster.</p>
      ) : (
        <ul className="space-y-2.5">
          {data.admins.map((a) => (
            <li key={a.id} className={s.row}>
              <div className="flex items-center justify-between gap-3">
                <span className={s.name}>{a.name}</span>
                <span className={s.num}>
                  {a.d7.total} <span className={s.faint}>/ {a.d30.total}</span>
                  {a.d7.total === 0 && <span className={` ${s.warn} text-xs`}> · quiet 7d</span>}
                </span>
              </div>
              <p className={s.sub}>
                {a.d7.photosApproved + a.d7.photosRejected} reviews ({a.d7.photosApproved}✓ {a.d7.photosRejected}✗) · {a.d7.calls} calls ({a.d7.answered} answered) · {a.d7.issuesActed} issues acted — 7d
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className={`${s.faint} mt-3`}>Actions done last 7d / 30d: photo reviews + calls + issue actions.</p>
    </div>
  )
}
