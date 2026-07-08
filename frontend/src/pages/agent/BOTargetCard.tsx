import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneCall, ChevronRight } from 'lucide-react'
import { apiClient } from '../../services/api.service'

// BO Home target card: today's contacted-vs-target at a glance, taps through to
// the call list. Self-contained (fetches /calls/target itself); renders nothing
// until data arrives so it never flashes an empty card on the dashboard.

type Target = { target: number; contacted: number; calls: number; missed?: number }

export default function BOTargetCard() {
  const navigate = useNavigate()
  const [t, setT] = useState<Target | null>(null)

  useEffect(() => {
    let live = true
    apiClient
      .get('/field-ops/calls/target')
      .then((res) => { if (live && res?.data?.success) setT(res.data) })
      .catch(() => {})
    return () => { live = false }
  }, [])

  if (!t) return null
  const pct = Math.min(100, Math.round((t.contacted / Math.max(1, t.target)) * 100))

  return (
    <button
      onClick={() => navigate('/agent/call-list')}
      className="w-full text-left bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 mb-4 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-2 mb-2">
        <PhoneCall className="w-4 h-4 text-[#00E87B]" />
        <span className="text-xs text-gray-500 uppercase tracking-wide">Agents contacted today</span>
        <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-2xl font-bold text-white tabular-nums">{t.contacted}</span>
        <span className="text-sm text-gray-500">/ {t.target} · {t.calls} calls</span>
        {(t.missed ?? 0) > 0 && <span className="text-sm text-amber-400">· {t.missed} missed</span>}
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-[#00E87B] transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </button>
  )
}
