import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Loader2, Search, RefreshCw, CircleDot, History, Check, PhoneOff, PhoneMissed } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { fieldOperationsService } from '../../services/field-operations.service'
import { useToast } from '../../components/ui/Toast'

// Back Office call list: every active field agent with their today's signup count
// and last activity. Sorted quietest-first by the API so the agents who need a
// nudge float to the top. Tapping a row starts an in-app WebRTC call to the agent.
// Header tracks today's contacted-vs-target; a panel shows recent call history.

type RosterRow = {
  id: string
  name: string
  phone: string | null
  today: number
  last_activity: string | null
}

type TargetInfo = { target: number; contacted: number; calls: number; missed?: number; contacted_ids?: string[] }

type CallRow = {
  id: string
  callee_id: string
  callee_name: string | null
  status: string
  started_at: string | null
  duration_s: number | null
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

function whenLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function durLabel(s: number | null): string {
  if (!s || s < 1) return ''
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

export default function BackOfficeCallList() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [roster, setRoster] = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [calling, setCalling] = useState<string | null>(null)
  const [target, setTarget] = useState<TargetInfo | null>(null)
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetDraft, setTargetDraft] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<CallRow[] | null>(null)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [company, setCompany] = useState<string | null>(null)

  async function startCall(r: RosterRow) {
    if (calling) return
    setCalling(r.id)
    try {
      const res = await apiClient.post('/field-ops/calls/start', { callee_id: r.id })
      const { callId, iceServers } = res.data
      navigate(`/agent/call/${callId}`, { state: { peerName: r.name || 'Agent', iceServers } })
    } catch {
      toast.error('Could not start call')
      setCalling(null)
    }
  }

  async function load() {
    setLoading(true)
    try {
      const [rosterRes, targetRes] = await Promise.all([
        apiClient.get(`/field-ops/incentives/roster${company ? `?company_id=${company}` : ''}`),
        apiClient.get('/field-ops/calls/target').catch(() => null),
      ])
      setRoster(rosterRes?.data?.roster || [])
      if (targetRes?.data?.success) {
        const d = targetRes.data
        setTarget({ target: d.target, contacted: d.contacted, calls: d.calls, missed: d.missed, contacted_ids: d.contacted_ids })
      }
    } catch {
      toast.error('Could not load agents')
    } finally {
      setLoading(false)
    }
  }

  async function saveTarget() {
    const dt = parseInt(targetDraft, 10)
    if (!Number.isFinite(dt) || dt < 1) { setEditingTarget(false); return }
    try {
      await apiClient.put('/field-ops/calls/target', { daily_target: dt })
      setTarget((t) => (t ? { ...t, target: dt } : t))
    } catch {
      toast.error('Could not save target')
    } finally {
      setEditingTarget(false)
    }
  }

  async function toggleHistory() {
    const next = !showHistory
    setShowHistory(next)
    if (next && history === null) {
      try {
        const res = await apiClient.get('/field-ops/calls/history?limit=50')
        setHistory(res?.data?.calls || [])
      } catch {
        setHistory([])
      }
    }
  }

  useEffect(() => {
    fieldOperationsService
      .getCompanies()
      .then((res: any) => setCompanies(res?.companies ?? res ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [company])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return roster
    return roster.filter((r) => r.name.toLowerCase().includes(term) || (r.phone || '').includes(term))
  }, [roster, q])

  const quiet = roster.filter((r) => r.today === 0).length
  const pct = target ? Math.min(100, Math.round((target.contacted / Math.max(1, target.target)) * 100)) : 0

  return (
    <div className="min-h-screen bg-[#06090F] px-4 pt-6 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-white">Agents</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleHistory}
              className={`p-3 rounded-xl border active:scale-95 transition-transform ${showHistory ? 'bg-[#00E87B]/15 border-[#00E87B]/40 text-[#00E87B]' : 'bg-white/[0.04] border-white/10 text-gray-400'}`}
              aria-label="Call history"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={load}
              className="p-3 rounded-xl bg-white/[0.04] border border-white/10 active:scale-95 transition-transform"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          {quiet > 0
            ? `${quiet} ${quiet === 1 ? 'agent has' : 'agents have'} no signups today — tap to call.`
            : 'Everyone has logged a signup today.'}
        </p>

        {/* Company scope — only shown when user manages more than one */}
        {companies.length > 1 && (
          <div className="flex gap-2 overflow-x-auto mb-4 -mx-4 px-4 scrollbar-hide">
            <CompanyChip label="All companies" active={company === null} onClick={() => setCompany(null)} />
            {companies.map((co) => (
              <CompanyChip key={co.id} label={co.name} active={company === co.id} onClick={() => setCompany(co.id)} />
            ))}
          </div>
        )}

        {/* Today's target progress */}
        {target && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Contacted today</span>
              {editingTarget ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">target</span>
                  <input
                    autoFocus
                    type="number"
                    inputMode="numeric"
                    value={targetDraft}
                    onChange={(e) => setTargetDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveTarget() }}
                    className="w-14 bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-[#00E87B]/50"
                  />
                  <button onClick={saveTarget} className="p-1 rounded-lg bg-[#00E87B]/15 text-[#00E87B]" aria-label="Save target">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setTargetDraft(String(target.target)); setEditingTarget(true) }}
                  className="text-xs text-gray-400 underline decoration-dotted underline-offset-2"
                >
                  target {target.target}
                </button>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-2xl font-bold text-white tabular-nums">{target.contacted}</span>
              <span className="text-sm text-gray-500">/ {target.target} agents · {target.calls} calls</span>
              {(target.missed ?? 0) > 0 && <span className="text-sm text-amber-400">· {target.missed} missed</span>}
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#00E87B] transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Call history panel */}
        {showHistory && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Recent calls</div>
            {history === null ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-[#00E87B] animate-spin" /></div>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-600 py-3">No calls yet.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {history.map((h) => {
                  const answered = h.status === 'answered'
                  return (
                    <div key={h.id} className="flex items-center gap-3 py-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${answered ? 'bg-[#00E87B]/15 text-[#00E87B]' : 'bg-white/[0.04] text-gray-500'}`}>
                        {answered ? <Phone className="w-4 h-4" /> : h.status === 'declined' ? <PhoneOff className="w-4 h-4" /> : <PhoneMissed className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm truncate">{h.callee_name || 'Agent'}</div>
                        <div className="text-[11px] text-gray-500 capitalize">{h.status}{durLabel(h.duration_s) ? ` · ${durLabel(h.duration_s)}` : ''}</div>
                      </div>
                      <div className="text-[11px] text-gray-600 shrink-0">{whenLabel(h.started_at)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

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
              const isCalling = calling === r.id
              return (
                <button
                  key={r.id}
                  onClick={() => startCall(r)}
                  disabled={!!calling}
                  className="flex items-center w-full text-left bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 active:scale-[0.99] transition-transform disabled:opacity-60"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="text-white font-medium truncate">{r.name || 'Unnamed agent'}</div>
                        {target?.contacted_ids?.includes(r.id) && <Check className="w-3.5 h-3.5 text-[#00E87B] shrink-0" />}
                      </div>
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
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#00E87B]/15 text-[#00E87B]">
                      {isCalling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function CompanyChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        active ? 'bg-[#00E87B] text-[#0A1628] border-[#00E87B]' : 'bg-white/[0.04] text-gray-400 border-white/10'
      }`}
    >
      {label}
    </button>
  )
}
