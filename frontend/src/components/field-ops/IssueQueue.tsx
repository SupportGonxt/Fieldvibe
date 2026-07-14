// The two faces of the accountability ledger (migrations/0014, cron reactToIssues):
// MyIssues — what the cron has put on *you*; UnmanagedIssues — who is sitting on theirs.
//
// Both render on the web dashboard and inside the field PWA. The PWA shell is hard-dark
// (bg-bg, forced regardless of `.dark`) rather than `.dark`-classed, so `dark:` variants
// never fire there and the two surfaces need real skins, not one set of classes.
// surface="pwa" picks the dark one.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiClient } from '../../services/api.service'
import { signalText, type Polarity, type Signal } from '../../lib/signalRegistry'
import { roleAllows } from '../../lib/capabilities'
import { useAuthStore } from '../../store/auth.store'

// Mirrors backend requireRole('admin', 'general_manager') on /issues/unmanaged
// (workers-api/src/routes/field-ops/issues.js) — fetching as any other role
// (e.g. manager) is a guaranteed 403, so gate the fetch, not just the render.
export const canSeeUnmanaged = (role?: string) => roleAllows(role, ['admin', 'general_manager'])

// Re-exported for existing callers (TeamCockpit.tsx) that import Signal/signalText from here.
export { signalText, type Signal }

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
  polarity?: Polarity
  detail?: string | null
}

// issues.detail is a JSON string column in D1 — parse it before handing it to signalText.
function parseDetail(raw: string | null | undefined): any {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function issueText(i: Issue): string {
  return signalText({ type: i.kind, detail: parseDetail(i.detail) })
}

// Bucket issues by company so a multi-company subject's rows sit under their own company
// heading instead of one conflated pile. First-seen order; NULL company (tenant-level, e.g.
// BO admin) collects under "Unassigned". Callers show the heading only when >1 group exists.
export function groupByCompany(items: Issue[]): { company: string; items: Issue[] }[] {
  const order: string[] = []
  const byCompany = new Map<string, Issue[]>()
  for (const i of items) {
    const key = i.company_name || 'Unassigned'
    if (!byCompany.has(key)) { byCompany.set(key, []); order.push(key) }
    byCompany.get(key)!.push(i)
  }
  return order.map((company) => ({ company, items: byCompany.get(company)! }))
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
    // Solid dark-red card (not translucent) so the white/white-opacity text below stays
    // legible even in light app-theme, where PWA pages force a dark bg-bg root but
    // text-white/NN opacity variants are not theme-remapped. bg-red-900 is a fixed color
    // (not a semantic token), so contrast holds in both themes regardless.
    section: 'rounded-2xl border border-red-500/40 bg-red-900',
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

  const renderIssue = (i: Issue) => (
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
          {issueText(i)} · held {hoursHeld(i.owner_since)}h
        </p>
      </div>
      {i.polarity !== 'recognition' && (
        <div className="flex gap-2">
          <button onClick={() => act(i.id, 'acknowledged')} className={s.ghost}>
            <Check className="w-4 h-4" /> I actioned this
          </button>
          <button onClick={() => act(i.id, 'resolve')} className={DANGER}>
            Resolve
          </button>
        </div>
      )}
    </li>
  )

  const deficit = issues.filter((i) => i.polarity !== 'recognition')
  const highlights = issues.filter((i) => i.polarity === 'recognition')

  return (
    <section className={s.section}>
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <ShieldAlert className={`w-5 h-5 ${s.icon}`} />
        <h2 className={s.title}>Assigned to you</h2>
        <span className={s.sub}>{issues.length} open · escalates to your manager if untouched</span>
      </header>
      {deficit.length > 0 && (
        <>
          {highlights.length > 0 && <p className={`${s.sub} px-4 pt-1`}>Issues</p>}
          {groupByCompany(deficit).map((g, _gi, arr) => (
            <div key={g.company}>
              {arr.length > 1 && <p className={`${s.sub} px-4 pt-2 uppercase tracking-wide`}>{g.company}</p>}
              <ul className={s.divide}>{g.items.map(renderIssue)}</ul>
            </div>
          ))}
        </>
      )}
      {highlights.length > 0 && (
        <>
          <p className={`${s.sub} px-4 pt-1`}>Highlights</p>
          <ul className={s.divide}>{highlights.map(renderIssue)}</ul>
        </>
      )}
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
  const role = useAuthStore((st) => st.user?.role)
  const { data } = useQuery({
    queryKey: ['gm-unmanaged'],
    queryFn: () => apiClient.get('/field-ops/issues/unmanaged').then((r) => r.data as { issues: Issue[] }),
    enabled: canSeeUnmanaged(role),
  })
  const issues = data?.issues || []
  if (!issues.length) return null
  const breached = issues.filter((i) => i.breached).length

  const renderIssue = (i: Issue) => (
    <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
      <span className={`w-1.5 h-6 rounded-full ${i.breached ? 'bg-red-600' : 'bg-amber-500'}`} />
      <span className={`${s.name} flex-1 min-w-[10rem]`}>{i.owner_name || 'Unassigned'}</span>
      <span className={`${s.muted} flex-1 min-w-[12rem]`}>
        has not actioned {i.subject_name} · {issueText(i)}
        {i.company_name && ` · ${i.company_name}`}
      </span>
      <EscalatedTag n={i.escalations} />
      <span className={`${s.muted} tabular-nums`}>{hoursHeld(i.owner_since)}h</span>
    </li>
  )

  const capped = issues.slice(0, 8)
  const deficit = capped.filter((i) => i.polarity !== 'recognition')
  const highlights = capped.filter((i) => i.polarity === 'recognition')

  return (
    <section className={s.section}>
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <ShieldAlert className={`w-5 h-5 ${s.icon}`} />
        <h2 className={s.title}>Not being managed</h2>
        <span className={s.sub}>
          {breached} past SLA of {issues.length} open
        </span>
      </header>
      {deficit.length > 0 && (
        <>
          {highlights.length > 0 && <p className={`${s.sub} px-4 pt-1`}>Issues</p>}
          {groupByCompany(deficit).map((g, _gi, arr) => (
            <div key={g.company}>
              {arr.length > 1 && <p className={`${s.sub} px-4 pt-2 uppercase tracking-wide`}>{g.company}</p>}
              <ul className={s.divide}>{g.items.map(renderIssue)}</ul>
            </div>
          ))}
        </>
      )}
      {highlights.length > 0 && (
        <>
          <p className={`${s.sub} px-4 pt-1`}>Highlights</p>
          <ul className={s.divide}>{highlights.map(renderIssue)}</ul>
        </>
      )}
    </section>
  )
}
