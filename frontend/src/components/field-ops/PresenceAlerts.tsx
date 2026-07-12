// Presence-anomaly INSIGHT card (Phase A of GPS attendance-fraud detection).
// Self-contained + self-gating: fetches the anomalies endpoint on mount and renders
// nothing on error/403 (viewer-gated on the backend) or when nothing is flagged — so
// mounting it on a page a non-viewer role also sees is safe. Read-only this phase.
import { useEffect, useState } from 'react'
import { MapPinOff, AlertTriangle, Clock } from 'lucide-react'
import { fieldOperationsService } from '../../services/field-operations.service'

type PresenceStatus = 'ok' | 'off_zone' | 'no_show' | 'low_coverage'

type DominantCluster = {
  latitude: number
  longitude: number
  hours: number
  nearCustomer: boolean
  pointCount: number
}

type PresenceAgent = {
  agent_id: string
  agent_name: string
  role: string
  status: PresenceStatus
  offZonePct: number
  sampleCount: number
  dominantCluster: DominantCluster | null
  lastSeenAt: string | null
}

type PresenceAnomalies = {
  success: boolean
  date: string
  flaggedCount: number
  agents: PresenceAgent[]
}

// Worst-first: an off-zone stationary cluster is the strongest fraud signal, then a
// no-show, then thin coverage (weakest — could just be a light-usage day).
const STATUS_ORDER: Record<PresenceStatus, number> = { off_zone: 0, no_show: 1, low_coverage: 2, ok: 3 }

// D1 hands back `YYYY-MM-DD HH:MM:SS` in UTC with no zone marker; Date.parse would read
// it as local. Normalise, then show a short local time (mirrors IssueQueue's hoursHeld).
function lastSeenLabel(raw: string | null): string {
  if (!raw) return 'no activity today'
  const t = Date.parse(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z')
  if (isNaN(t)) return 'no activity today'
  return 'last seen ' + new Date(t).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}

function AgentRow({ a }: { a: PresenceAgent }) {
  let Icon = Clock
  let tone = 'text-white/60'
  let label = 'Low coverage'
  let reason = `only ${a.sampleCount} sample${a.sampleCount === 1 ? '' : 's'}`

  if (a.status === 'off_zone') {
    Icon = MapPinOff
    tone = 'text-red-400'
    reason = `${a.offZonePct}% of samples away from customers`
    if (a.dominantCluster && !a.dominantCluster.nearCustomer) {
      reason += ` · ~${Math.round(a.dominantCluster.hours)}h stationary off-zone`
    }
    label = 'Off work zone'
  } else if (a.status === 'no_show') {
    Icon = AlertTriangle
    tone = 'text-red-400'
    label = 'No location today'
    reason = 'no app activity during work hours'
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tone}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-white">{a.agent_name}</span>
          <span className={`text-xs font-semibold ${tone}`}>{label}</span>
        </div>
        <p className="text-sm text-white/70">{reason}</p>
        <p className="text-xs text-white/40 mt-0.5">{lastSeenLabel(a.lastSeenAt)}</p>
      </div>
    </li>
  )
}

export default function PresenceAlerts() {
  const [flagged, setFlagged] = useState<PresenceAgent[]>([])

  useEffect(() => {
    let active = true
    fieldOperationsService
      .getPresenceAnomalies()
      .then((res: PresenceAnomalies) => {
        if (!active || !res?.agents) return
        const rows = res.agents
          .filter((a) => a.status !== 'ok')
          .sort((x, y) => STATUS_ORDER[x.status] - STATUS_ORDER[y.status])
        setFlagged(rows)
      })
      .catch(() => { /* viewer-gated / offline — stay silent, render nothing */ })
    return () => { active = false }
  }, [])

  if (!flagged.length) return null

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10">
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <MapPinOff className="w-5 h-5 text-amber-400" />
        <h2 className="font-semibold text-white">Presence alerts ({flagged.length})</h2>
      </header>
      <ul className="divide-y divide-white/5">
        {flagged.map((a) => <AgentRow key={a.agent_id} a={a} />)}
      </ul>
    </section>
  )
}
