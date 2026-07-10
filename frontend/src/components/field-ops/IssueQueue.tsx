// The two faces of the accountability ledger (migrations/0014, cron reactToIssues):
// MyIssues — what the cron has put on *you*; UnmanagedIssues — who is sitting on theirs.
//
// Both render on the web dashboard and inside the field PWA. The PWA shell is hard-dark
// (#06090F) rather than `.dark`-classed, so `dark:` variants never fire there and the two
// surfaces need real skins, not one set of classes. surface="pwa" picks the dark one.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiClient } from '../../services/api.service'

export type Signal = { type: string; detail: any }

export function signalText(s: Signal): string {
  switch (s.type) {
    case 'gone_quiet':
      return `Gone quiet — ${s.detail?.daysSinceLastVisit ?? '?'} days since last visit`
    case 'below_target': {
      const m = (s.detail?.metrics || []).map((x: string) => x.replace('_per_day', '/day').replace('_', ' '))
      return `Below target on ${m.join(' & ') || 'KPIs'}`
    }
    case 'dropped_vs_baseline':
      return 'Signups dropped below recent average'
    case 'low_conversion':
      return `Low conversion — ${Math.round((s.detail?.conversion_pct || 0) * 100)}%`
    case 'late_start': {
      const m = s.detail?.avg_start_min ?? 0
      return `Late starts — first check-in ~${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    }
    case 'short_field_day':
      return `Short field days — ${(Math.round((s.detail?.avg_span_min || 0) / 6) / 10)}h on-site span`
    case 'idle_gaps':
      return `Idle gaps — ${Math.round((s.detail?.avg_idle_min || 0) / 60 * 10) / 10}h/day parked`
    case 'excess_travel':
      return `Excess travel — ~${s.detail?.avg_km_per_hop ?? '?'}km between stops`
    default:
      return 'Underperformance signal'
  }
}

export type Issue = {
  id: string
  kind: string
  subject_id: string
  subject_name: string
  severity: number
  status: string
  escalations: number
  owner_since: string
  owner_name?: string
  company_name?: string | null
  breached?: boolean
}

// D1 hands back `YYYY-MM-DD HH:MM:SS` in UTC with no zone marker; Date.parse would read it as local.
export function hoursHeld(ownerSince: string): number {
  const t = Date.parse(ownerSince.includes('T') ? ownerSince : ownerSince.replace(' ', 'T') + 'Z')
  return isNaN(t) ? 0 : Math.floor((Date.now() - t) / 3600000)
}

type Surface = 'web' | 'pwa'

const SKIN = {
  web: {
    section: 'rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/5',
    icon: 'text-red-600 dark:text-red-400',
    title: 'font-semibold text-gray-900 dark:text-white',
    sub: 'text-xs text-gray-600 dark:text-gray-400',
    divide: 'divide-y divide-red-100 dark:divide-red-500/20',
    name: 'font-medium text-gray-900 dark:text-white',
    body: 'text-sm text-gray-700 dark:text-gray-300',
    muted: 'text-sm text-gray-600 dark:text-gray-400',
    ghost:
      'min-h-[44px] inline-flex items-center gap-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 px-3 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200',
  },
  pwa: {
    section: 'rounded-2xl border border-red-500/30 bg-red-500/10',
    icon: 'text-red-400',
    title: 'font-semibold text-white',
    sub: 'text-xs text-white/60',
    divide: 'divide-y divide-red-500/20',
    name: 'font-medium text-white',
    body: 'text-sm text-white/70',
    muted: 'text-sm text-white/60',
    ghost:
      'min-h-[44px] inline-flex items-center gap-1.5 text-sm rounded-xl border border-white/10 px-3 bg-white/5 text-white',
  },
} satisfies Record<Surface, Record<string, string>>

const DANGER = 'min-h-[44px] inline-flex items-center text-sm rounded-lg px-3 bg-red-600 text-white hover:bg-red-700'

function EscalatedTag({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-red-600 text-white">
      Escalated ×{n}
    </span>
  )
}

/**
 * Issues the cron has assigned to *this* person, worst-first. Sitting on one escalates it
 * up the org chain, so it leads whatever page it's on: it is the work, the rest is context.
 * Renders nothing for anyone who owns none — agents are an issue's subject, never its owner,
 * so this is safe to mount on a shared dashboard without a role gate.
 */
export function MyIssues({ surface = 'web' }: { surface?: Surface }) {
  const s = SKIN[surface]
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['issues-mine'],
    queryFn: () => apiClient.get('/field-ops/issues/mine').then((r) => r.data as { issues: Issue[] }),
  })
  const issues = data?.issues || []
  if (!issues.length) return null

  const act = async (id: string, action: 'acknowledged' | 'resolve') => {
    try {
      await apiClient.post(`/field-ops/issues/${id}/act`, { action })
      toast.success(action === 'resolve' ? 'Issue closed' : 'Marked actioned — SLA clock reset')
      qc.invalidateQueries({ queryKey: ['issues-mine'] })
      qc.invalidateQueries({ queryKey: ['gm-unmanaged'] })
    } catch {
      toast.error('Could not update issue')
    }
  }

  return (
    <section className={s.section}>
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <ShieldAlert className={`w-5 h-5 ${s.icon}`} />
        <h2 className={s.title}>Assigned to you</h2>
        <span className={s.sub}>{issues.length} open · escalates to your manager if untouched</span>
      </header>
      <ul className={s.divide}>
        {issues.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="flex-1 min-w-[12rem]">
              <div className="flex items-center gap-2">
                <span className={s.name}>{i.subject_name}</span>
                <EscalatedTag n={i.escalations} />
                {i.status === 'acted' && (
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${s.sub}`}>Actioned</span>
                )}
              </div>
              <p className={s.body}>
                {signalText({ type: i.kind, detail: {} })} · held {hoursHeld(i.owner_since)}h
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => act(i.id, 'acknowledged')} className={s.ghost}>
                <Check className="w-4 h-4" /> I actioned this
              </button>
              <button onClick={() => act(i.id, 'resolve')} className={DANGER}>
                Resolve
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * GM/admin view of open issues nobody has actioned, breaching-first, owner named. This is the
 * "who isn't managing" surface — team leads, managers and BO admins who sit on their queue.
 * ponytail: caps at 8 rows. The full ledger belongs behind a screen of its own if it ever runs long.
 */
export function UnmanagedIssues({ surface = 'web' }: { surface?: Surface }) {
  const s = SKIN[surface]
  const { data } = useQuery({
    queryKey: ['gm-unmanaged'],
    queryFn: () => apiClient.get('/field-ops/issues/unmanaged').then((r) => r.data as { issues: Issue[] }),
  })
  const issues = data?.issues || []
  if (!issues.length) return null
  const breached = issues.filter((i) => i.breached).length

  return (
    <section className={s.section}>
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <ShieldAlert className={`w-5 h-5 ${s.icon}`} />
        <h2 className={s.title}>Not being managed</h2>
        <span className={s.sub}>
          {breached} past SLA of {issues.length} open
        </span>
      </header>
      <ul className={s.divide}>
        {issues.slice(0, 8).map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
            <span className={`w-1.5 h-6 rounded-full ${i.breached ? 'bg-red-600' : 'bg-amber-500'}`} />
            <span className={`${s.name} flex-1 min-w-[10rem]`}>{i.owner_name || 'Unassigned'}</span>
            <span className={`${s.muted} flex-1 min-w-[12rem]`}>
              has not actioned {i.subject_name} · {i.kind.replace(/_/g, ' ')}
              {i.company_name && ` · ${i.company_name}`}
            </span>
            <EscalatedTag n={i.escalations} />
            <span className={`${s.muted} tabular-nums`}>{hoursHeld(i.owner_since)}h</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
