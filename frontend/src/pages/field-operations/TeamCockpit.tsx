import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../services/api.service'
import { useAuthStore } from '../../store/auth.store'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { toast } from 'react-hot-toast'
import { Users, AlertTriangle, Phone, Bell, StickyNote, ChevronDown, ChevronRight } from 'lucide-react'

// Team-leader / manager performance cockpit. Consumes GET /field-ops/kpi/roster
// (already ranked worst-first server-side) and the three POST /field-ops/kpi/remediate/*
// one-tap actions. Web dashboard theme (light + dark variants), react-query for the read.
// ponytail: one responsive row-list (reflows to stacked cards under md) instead of a
// separate <table> + card markup — same worst-first scan, half the JSX.

type Actual = {
  visits_per_day: number
  signups_per_day: number
  conversion_pct: number // 0..1
  qualified_pct: number // 0..1
  days: number
}
type Signal = { type: string; detail: any }
type RosterAgent = { agentId: string; name: string; actual: Actual; signals: Signal[] }

const LEADER_ROLES = ['team_lead', 'manager', 'general_manager', 'admin', 'super_admin']

function signalText(s: Signal): string {
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
    default:
      return 'Underperformance signal'
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  )
}

function NoteBox({ agentId, signalType, onDone }: { agentId: string; signalType?: string; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!note.trim()) return
    setSaving(true)
    try {
      await apiClient.post('/field-ops/kpi/remediate/note', {
        agentId, note, signalType, action: 'note', created_suffix: `${Date.now()}`,
      })
      toast.success('Coaching note logged')
      setNote('')
      onDone()
    } catch {
      toast.error('Failed to log note')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="What did you discuss / commit to?"
        className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !note.trim()}
          className="btn-primary text-sm px-3 py-1.5 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save note'}
        </button>
        <button onClick={onDone} className="text-sm px-3 py-1.5 text-gray-500">Cancel</button>
      </div>
    </div>
  )
}

function AgentRow({ a }: { a: RosterAgent }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const call = async () => {
    try {
      const { data } = await apiClient.post('/field-ops/calls/start', { callee_id: a.agentId })
      navigate(`/agent/call/${data.callId}`, { state: { peerName: a.name, iceServers: data.iceServers } })
    } catch {
      toast.error('Could not start call')
    }
  }
  const nudge = async () => {
    try {
      const res = await apiClient.post('/field-ops/kpi/remediate/nudge', { agentId: a.agentId })
      if (res.data?.ok) toast.success(`Nudge sent to ${a.name}`)
      else toast(`Could not reach ${a.name}`)
    } catch {
      toast.error('Nudge failed')
    }
  }

  const conv = Math.round(a.actual.conversion_pct * 100)
  const qual = Math.round(a.actual.qualified_pct * 100)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Summary row — reflows to stacked on mobile */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        <span className="font-medium text-gray-900 dark:text-white flex-1 min-w-[8rem]">{a.name}</span>
        <div className="flex items-center gap-4 sm:gap-6">
          <Stat label="Visits/d" value={a.actual.visits_per_day.toFixed(1)} />
          <Stat label="Signups/d" value={a.actual.signups_per_day.toFixed(1)} />
          <Stat label="Conv" value={`${conv}%`} />
        </div>
        {a.signals.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 rounded-full px-2 py-0.5">
            <AlertTriangle className="w-3 h-3" /> {a.signals.length}
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
          {a.signals.length > 0 ? (
            <ul className="space-y-1 mb-3">
              {a.signals.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{signalText(s)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 mb-3">No underperformance signals · last {a.actual.days}d.</p>
          )}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <Stat label="Visits/d" value={a.actual.visits_per_day.toFixed(1)} />
            <Stat label="Signups/d" value={a.actual.signups_per_day.toFixed(1)} />
            <Stat label="Conversion" value={`${conv}%`} />
            <Stat label="Qualified" value={`${qual}%`} />
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={call} className="inline-flex items-center gap-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Phone className="w-4 h-4" /> Call
            </button>
            <button onClick={nudge} className="inline-flex items-center gap-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Bell className="w-4 h-4" /> Nudge
            </button>
            <button onClick={() => setNoteOpen((v) => !v)} className="inline-flex items-center gap-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
              <StickyNote className="w-4 h-4" /> Note
            </button>
          </div>
          {noteOpen && (
            <NoteBox agentId={a.agentId} signalType={a.signals[0]?.type} onDone={() => setNoteOpen(false)} />
          )}
        </div>
      )}
    </div>
  )
}

export default function TeamCockpit() {
  const role = useAuthStore((s) => s.user?.role)
  const allowed = role ? LEADER_ROLES.includes(role) : false

  const { data, isLoading, isError } = useQuery({
    queryKey: ['kpi-roster'],
    queryFn: () => apiClient.get('/field-ops/kpi/roster').then((r) => r.data as { roster: RosterAgent[] }),
    enabled: allowed,
  })

  if (!allowed) {
    return (
      <div className="p-6 text-center text-gray-500">
        Team cockpit is available to team leaders and managers.
      </div>
    )
  }
  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  }
  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 text-lg font-medium">Failed to load roster</p>
          <p className="text-gray-500 mt-2">Please try refreshing the page</p>
        </div>
      </div>
    )
  }

  const roster = data?.roster || []
  const flagged = roster.filter((a) => a.signals.length > 0).length

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6" /> Team Cockpit
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {roster.length} team member{roster.length === 1 ? '' : 's'} · {flagged} flagged · worst performers first
          </p>
        </div>
      </div>

      {roster.length === 0 ? (
        <p className="text-gray-500">No team members report to you yet.</p>
      ) : (
        <div className="space-y-2">
          {roster.map((a) => <AgentRow key={a.agentId} a={a} />)}
        </div>
      )}
    </div>
  )
}
