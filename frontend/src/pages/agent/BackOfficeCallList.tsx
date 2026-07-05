import { useEffect, useMemo, useState } from 'react'
import { Phone, Loader2, Search, RefreshCw, CircleDot } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { useToast } from '../../components/ui/Toast'

// Back Office call list: every active field agent with their phone, today's signup
// count and last activity. Sorted quietest-first by the API so the agents who need
// a nudge float to the top. Tapping the row dials via tel: on the BO's device.

type RosterRow = {
  id: string
  name: string
  phone: string | null
  today: number
  last_activity: string | null
}

function sinceLabel(iso: string | null): string {
  if (!iso) return 'no signups yet'
  const t = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').getTime()
  if (isNaN(t)) return 'no signups yet'
  const mins = Math.floor((Date.now() - t) / 60000)
  if (mins < 1) return 'active now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function BackOfficeCallList() {
  const { toast } = useToast()
  const [roster, setRoster] = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await apiClient.get('/field-ops/incentives/roster')
      setRoster(res?.data?.roster || [])
    } catch {
      toast.error('Could not load agents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return roster
    return roster.filter((r) => r.name.toLowerCase().includes(term) || (r.phone || '').includes(term))
  }, [roster, q])

  const quiet = roster.filter((r) => r.today === 0).length

  return (
    <div className="min-h-screen bg-[#06090F] px-4 pt-6 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-white">Agents</h1>
          <button
            onClick={load}
            className="p-2 rounded-xl bg-white/[0.04] border border-white/10 active:scale-95 transition-transform"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          {quiet > 0
            ? `${quiet} ${quiet === 1 ? 'agent has' : 'agents have'} no signups today — tap to call.`
            : 'Everyone has logged a signup today.'}
        </p>

        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or number"
            className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-white text-base placeholder-gray-600 focus:outline-none focus:border-[#00E87B]/50"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#00E87B] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-600 py-16">No agents found.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const dialable = !!r.phone
              const inner = (
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{r.name || 'Unnamed agent'}</div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                      <CircleDot className={`w-3 h-3 ${r.today > 0 ? 'text-[#00E87B]' : 'text-gray-600'}`} />
                      {sinceLabel(r.last_activity)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-lg font-semibold tabular-nums ${r.today > 0 ? 'text-[#00E87B]' : 'text-gray-600'}`}>
                      {r.today}
                    </div>
                    <div className="text-[10px] text-gray-600 uppercase tracking-wide">today</div>
                  </div>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    dialable ? 'bg-[#00E87B]/15 text-[#00E87B]' : 'bg-white/[0.04] text-gray-700'
                  }`}>
                    <Phone className="w-5 h-5" />
                  </div>
                </div>
              )
              return dialable ? (
                <a
                  key={r.id}
                  href={`tel:${r.phone}`}
                  className="flex items-center bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 active:scale-[0.99] transition-transform"
                >
                  {inner}
                </a>
              ) : (
                <div
                  key={r.id}
                  className="flex items-center bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 opacity-70"
                  title="No phone number on file"
                >
                  {inner}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
