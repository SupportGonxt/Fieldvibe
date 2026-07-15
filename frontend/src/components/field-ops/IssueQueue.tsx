// The two faces of the accountability ledger (migrations/0014, cron reactToIssues):
// MyIssues — what the cron has put on *you*; UnmanagedIssues — who is sitting on theirs.
//
// Both render on the web dashboard and inside the field PWA. The PWA shell is hard-dark
// (bg-bg, forced regardless of `.dark`) rather than `.dark`-classed, so `dark:` variants
// never fire there and the two surfaces need real skins, not one set of classes.
// surface="pwa" picks the dark one.
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert, Check, CalendarClock, Link2, Award, ChevronRight } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiClient } from '../../services/api.service'
import { SIGNAL_REGISTRY, signalText, type Polarity, type Signal } from '../../lib/signalRegistry'
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

// Server-collapsed feed: one row per signal kind, count + the worst 3 items. The backend
// (issues.js dedupCap) dedupes by (subject, kind) then groups, so a 125-issue tenant renders
// as ~a dozen collapsed rows instead of an endless scroll.
export type IssueGroup = { kind: string; polarity?: Polarity; count: number; breached?: number; worst: Issue[] }

// Fallback for stale cached/offline responses that predate the grouped shape: rebuild groups
// from the flat (already deduped, capped) list so the UI never regresses to the long scroll.
export function toGroups(issues: Issue[]): IssueGroup[] {
  const byKind = new Map<string, IssueGroup>()
  for (const i of issues) {
    let g = byKind.get(i.kind)
    if (!g) { g = { kind: i.kind, polarity: i.polarity || 'deficit', count: 0, breached: 0, worst: [] }; byKind.set(i.kind, g) }
    g.count += 1
    if (i.breached) g.breached! += 1
    if (g.worst.length < 3) g.worst.push(i)
  }
  return [...byKind.values()]
}

export const kindLabel = (kind: string) => SIGNAL_REGISTRY[kind]?.label ?? kind.replace(/_/g, ' ')

export const groupTotal = (groups: IssueGroup[], polarity: 'deficit' | 'recognition') =>
  groups.filter((g) => (g.polarity === 'recognition') === (polarity === 'recognition')).reduce((n, g) => n + g.count, 0)

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
    input:
      'w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400',
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
    input:
      'w-full text-sm rounded-xl border border-white/10 px-3 py-2 bg-white/5 text-white placeholder-white/40',
  },
} satisfies Record<Surface, Record<string, string>>

const DANGER = 'min-h-[44px] inline-flex items-center text-sm rounded-lg px-3 bg-red-600 text-white hover:bg-red-700'
const SUBMIT = 'min-h-[44px] inline-flex items-center text-sm rounded-lg px-3 bg-primary text-on-primary'

function EscalatedTag({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-red-600 text-white">
      Escalated ×{n}
    </span>
  )
}

// Collapsed group rows — "Gone quiet · 42", tap to expand the worst 3 + "+N more". Compact by
// default so the section can't push the metrics below it off-screen. Same tap-to-expand idiom
// as the managers accordion on GmOverview (ChevronRight rotate-90).
function GroupList({ groups, s, renderIssue }: {
  groups: IssueGroup[]
  s: (typeof SKIN)[Surface]
  renderIssue: (i: Issue) => React.ReactNode
}) {
  const [open, setOpen] = useState<string | null>(null)
  const deficit = groups.filter((g) => g.polarity !== 'recognition')
  const highlights = groups.filter((g) => g.polarity === 'recognition')

  const row = (g: IssueGroup) => {
    const isOpen = open === g.kind
    return (
      <div key={g.kind}>
        <button
          onClick={() => setOpen(isOpen ? null : g.kind)}
          className="w-full min-h-[44px] flex items-center gap-2 px-4 py-2.5 text-left"
        >
          <ChevronRight className={`w-4 h-4 flex-shrink-0 ${s.icon} transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          <span className={`${s.name} flex-1 min-w-0 truncate`}>{kindLabel(g.kind)}</span>
          {(g.breached || 0) > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-red-600 text-white">
              {g.breached} past SLA
            </span>
          )}
          <span className={`${s.sub} tabular-nums font-semibold`}>{g.count}</span>
        </button>
        {isOpen && (
          <>
            <ul className={s.divide}>{g.worst.map(renderIssue)}</ul>
            {g.count > g.worst.length && (
              <p className={`${s.sub} px-4 pb-2`}>+{g.count - g.worst.length} more — worst {g.worst.length} shown</p>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <>
      {deficit.length > 0 && highlights.length > 0 && <p className={`${s.sub} px-4 pt-1`}>Issues</p>}
      {deficit.length > 0 && <div className={s.divide}>{deficit.map(row)}</div>}
      {highlights.length > 0 && (
        <>
          <p className={`${s.sub} px-4 pt-1`}>Highlights</p>
          <div className={s.divide}>{highlights.map(row)}</div>
        </>
      )}
      <div className="pb-2" />
    </>
  )
}

/**
 * Issues the cron has assigned to *this* person, worst-first. Sitting on one escalates it
 * up the org chain, so it leads whatever page it's on: it is the work, the rest is context.
 * Renders nothing for anyone who owns none — agents are an issue's subject, never its owner,
 * so this is safe to mount on a shared dashboard without a role gate.
 */
type CoachType = 'checkin' | 'resource' | 'recognition'

// Mirrors backend ACTION_REGISTRY roles for checkin/resource/recognition
// (workers-api/src/routes/field-ops/issues.js) — plain includes, no admin
// expansion: backoffice_admin/admin would 403 on these coaching actions.
export const canCoach = (role?: string) => !!role && ['manager', 'team_lead', 'general_manager'].includes(role)

export function MyIssues({ surface = 'web' }: { surface?: Surface }) {
  const s = SKIN[surface]
  const qc = useQueryClient()
  const role = useAuthStore((st) => st.user?.role)
  const [coach, setCoach] = useState<{ id: string; type: CoachType } | null>(null)
  const [note, setNote] = useState('')
  const [extra, setExtra] = useState('')
  const [sending, setSending] = useState(false)
  const { data } = useQuery({
    queryKey: ['issues-mine'],
    queryFn: () => apiClient.get('/field-ops/issues/mine').then((r) => r.data as { issues: Issue[]; more?: number; groups?: IssueGroup[] }),
  })
  const issues = data?.issues || []
  const groups = data?.groups ?? toGroups(issues)
  if (!groups.length) return null
  const total = groups.reduce((n, g) => n + g.count, 0)

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

  const openCoach = (id: string, type: CoachType) => {
    setCoach(coach?.id === id && coach.type === type ? null : { id, type })
    setNote('')
    setExtra('')
  }

  const submitCoach = async () => {
    if (!coach || sending) return
    setSending(true)
    try {
      const body: Record<string, string> = { type: coach.type }
      if (note) body.note = note
      if (coach.type === 'checkin' && extra) body.followUpDate = extra
      if (coach.type === 'resource' && extra) body.resourceLink = extra
      await apiClient.post(`/field-ops/issues/${coach.id}/action`, body)
      toast.success(coach.type === 'recognition' ? 'Recognition sent' : 'Coaching note logged')
      setCoach(null)
      setNote('')
      setExtra('')
      qc.invalidateQueries({ queryKey: ['issues-mine'] })
    } catch {
      toast.error('Could not send')
    } finally {
      setSending(false)
    }
  }

  const COACH_LABEL: Record<CoachType, string> = {
    checkin: 'Schedule check-in',
    resource: 'Share resource',
    recognition: 'Send recognition',
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
      {i.polarity !== 'recognition' ? (
        <div className="flex flex-wrap gap-2">
          {canCoach(role) && (
            <>
              <button onClick={() => openCoach(i.id, 'checkin')} className={s.ghost}>
                <CalendarClock className="w-4 h-4" /> Check-in
              </button>
              <button onClick={() => openCoach(i.id, 'resource')} className={s.ghost}>
                <Link2 className="w-4 h-4" /> Resource
              </button>
            </>
          )}
          <button onClick={() => act(i.id, 'acknowledged')} className={s.ghost}>
            <Check className="w-4 h-4" /> I actioned this
          </button>
          <button onClick={() => act(i.id, 'resolve')} className={DANGER}>
            Resolve
          </button>
        </div>
      ) : (
        canCoach(role) && (
          <button onClick={() => openCoach(i.id, 'recognition')} className={s.ghost}>
            <Award className="w-4 h-4" /> Recognise
          </button>
        )
      )}
      {coach?.id === i.id && (
        <div className="w-full space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={
              coach.type === 'recognition'
                ? 'What did they do well? They get this as a push.'
                : coach.type === 'checkin'
                  ? 'What will you cover in the check-in?'
                  : 'Why this resource helps'
            }
            className={s.input}
          />
          {coach.type === 'checkin' && (
            <input type="date" value={extra} onChange={(e) => setExtra(e.target.value)} className={s.input} />
          )}
          {coach.type === 'resource' && (
            <input
              type="url"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="https:// link to the doc/video"
              className={s.input}
            />
          )}
          <div className="flex gap-2">
            <button onClick={submitCoach} disabled={sending} className={`${SUBMIT} disabled:opacity-50`}>
              {COACH_LABEL[coach.type]}
            </button>
            <button onClick={() => setCoach(null)} className={s.ghost}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  )

  return (
    <section className={s.section}>
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <ShieldAlert className={`w-5 h-5 ${s.icon}`} />
        <h2 className={s.title}>Assigned to you</h2>
        <span className={s.sub}>{total} open · escalates to your manager if untouched</span>
      </header>
      <GroupList groups={groups} s={s} renderIssue={renderIssue} />
    </section>
  )
}

/**
 * GM/admin view of open issues nobody has actioned, breaching-first, owner named. This is the
 * "who isn't managing" surface — team leads, managers and BO admins who sit on their queue.
 * The backend dedupes by (subject, kind) and collapses to per-kind groups (worst 3 each).
 */
export function UnmanagedIssues({ surface = 'web' }: { surface?: Surface }) {
  const s = SKIN[surface]
  const role = useAuthStore((st) => st.user?.role)
  const { data } = useQuery({
    queryKey: ['gm-unmanaged'],
    queryFn: () => apiClient.get('/field-ops/issues/unmanaged').then((r) => r.data as { issues: Issue[]; more?: number; groups?: IssueGroup[] }),
    enabled: canSeeUnmanaged(role),
  })
  const issues = data?.issues || []
  const groups = data?.groups ?? toGroups(issues)
  if (!groups.length) return null
  const total = groups.reduce((n, g) => n + g.count, 0)
  const breached = groups.reduce((n, g) => n + (g.breached || 0), 0)

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

  return (
    <section className={s.section}>
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <ShieldAlert className={`w-5 h-5 ${s.icon}`} />
        <h2 className={s.title}>Not being managed</h2>
        <span className={s.sub}>
          {breached} past SLA of {total} open
        </span>
      </header>
      <GroupList groups={groups} s={s} renderIssue={renderIssue} />
    </section>
  )
}
