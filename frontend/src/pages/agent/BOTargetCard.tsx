import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight } from 'lucide-react'
import { apiClient } from '../../services/api.service'

// BO Home KPI card: notifications received vs acted on (trailing 7d, from the issues
// ledger), taps through to the issue queue. Self-contained (fetches /issues/stats);
// renders nothing until data arrives so it never flashes an empty card.

type Stats = { received: number; acted: number }

export default function BOTargetCard() {
  const navigate = useNavigate()
  const [s, setS] = useState<Stats | null>(null)

  useEffect(() => {
    let live = true
    apiClient
      .get('/field-ops/issues/stats')
      .then((res) => { if (live && res?.data?.success) setS(res.data) })
      .catch(() => {})
    return () => { live = false }
  }, [])

  if (!s) return null
  const pct = Math.min(100, Math.round((s.acted / Math.max(1, s.received)) * 100))
  const outstanding = Math.max(0, s.received - s.acted)

  return (
    <button
      onClick={() => navigate('/agent/call-list')}
      className="w-full text-left bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 mb-4 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-2 mb-2">
        <Bell className="w-4 h-4 text-[#00E87B]" />
        <span className="text-xs text-gray-500 uppercase tracking-wide">Notifications acted on · 7d</span>
        <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-2xl font-bold text-white tabular-nums">{s.acted}</span>
        <span className="text-sm text-gray-500">/ {s.received} received</span>
        {outstanding > 0 && <span className="text-sm text-amber-400">· {outstanding} outstanding</span>}
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-[#00E87B] transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </button>
  )
}
