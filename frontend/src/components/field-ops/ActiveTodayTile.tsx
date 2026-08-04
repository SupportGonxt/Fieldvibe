import { useState } from 'react'
import { Users, CircleDot, ChevronDown } from 'lucide-react'
import type { ActiveTodayGroup } from '../../services/field-operations.service'

// Shared "X of Y active today" KPI tile for the PWA dashboards (Team Lead,
// Manager, Back Office). Tap to expand an inline roster with a per-person
// active/inactive dot — reuses the BackOfficeCallList row idiom rather than
// introducing a new list pattern. Admin (Material UI) renders its own card.
// "Active" = logged a signup OR sent a GPS heartbeat today (backend definition).

function sinceLabel(iso: string | null): string {
  if (!iso) return 'no activity yet'
  const t = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').getTime()
  if (isNaN(t)) return 'no activity yet'
  const mins = Math.floor((Date.now() - t) / 60000)
  if (mins < 1) return 'active now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ActiveTodayTile({
  title = 'Active today',
  data,
  defaultOpen = false,
}: {
  title?: string
  data: ActiveTodayGroup | null | undefined
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const active = data?.active ?? 0
  const total = data?.total ?? 0
  const roster = data?.roster ?? []
  const empty = total === 0

  return (
    <div className="bg-white/5 border border-token rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => !empty && setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-3.5 text-left"
        aria-expanded={open}
        disabled={empty}
      >
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-token-faint uppercase tracking-wider">{title}</p>
          <p className="text-xl font-bold text-token">
            {active} <span className="text-token-faint font-medium text-sm">of {total} active</span>
          </p>
        </div>
        {!empty && (
          <ChevronDown className={`w-4 h-4 text-token-faint transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && !empty && (
        <ul className="border-t border-token divide-y divide-white/5">
          {roster.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <CircleDot className={`w-3 h-3 shrink-0 ${p.active ? 'text-primary' : 'text-gray-600'}`} />
              <span className="flex-1 min-w-0 truncate text-sm text-token">{p.name || 'Unknown'}</span>
              <span className={`text-[11px] ${p.active ? 'text-token-faint' : 'text-gray-500'}`}>
                {p.active ? sinceLabel(p.lastActivity) : 'inactive'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
