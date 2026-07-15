import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle, Loader2, CheckCircle2, Pencil } from 'lucide-react'
import { apiClient } from '../../services/api.service'

// Mobile adaptation of field-operations/reports/CaptureFailuresReport — same
// endpoint, grouped team lead → agent, dark PWA skin. Reached from the
// AgentDashboard leader tile and BOActionQueue tap-through.
// ponytail: no company/date pickers — fixed Monday→today window like the
// desktop default; add filters when someone asks for history.

type UploadFailure = {
  id: string
  visit_date: string
  first_name: string
  last_name: string
  id_number: string | null
  goldrush_id: string | null
  agent_name: string
  team_lead_name: string | null
  photo_url: string | null
  error_summary: string
  customer_id: string | null
}

const mondayOfWeek = () => {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - ((day + 6) % 7))
  return d.toISOString().split('T')[0]
}

export default function BOUploadFailures() {
  const navigate = useNavigate()
  const [lightbox, setLightbox] = useState<string | null>(null)
  const start = mondayOfWeek()
  const end = new Date().toISOString().split('T')[0]

  const { data, isLoading } = useQuery({
    queryKey: ['bo-upload-failures', start, end],
    queryFn: () =>
      apiClient
        .get(`/field-ops/reports/goldrush-upload-failures?startDate=${start}&endDate=${end}`)
        .then((r) => (r.data?.data || []) as UploadFailure[]),
  })

  const rows = data || []

  const grouped = useMemo(() => {
    const byLead = new Map<string, Map<string, UploadFailure[]>>()
    for (const r of rows) {
      const lead = r.team_lead_name || 'No team lead'
      if (!byLead.has(lead)) byLead.set(lead, new Map())
      const byAgent = byLead.get(lead)!
      if (!byAgent.has(r.agent_name)) byAgent.set(r.agent_name, [])
      byAgent.get(r.agent_name)!.push(r)
    }
    return [...byLead.entries()].map(([lead, agents]) => ({
      lead,
      agents: [...agents.entries()].map(([agent, items]) => ({ agent, items })),
    }))
  }, [rows])

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button onClick={() => navigate('/agent/dashboard')} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Upload failures</h1>
          <p className="text-xs text-gray-500">{rows.length} not loaded · {start} → {end}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="mx-5 flex items-center gap-3 bg-primary/[0.06] border border-primary/20 rounded-2xl px-4 py-4">
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          <span className="text-sm text-white">Everything loaded this week.</span>
        </div>
      ) : (
        <div className="px-5 space-y-4">
          {grouped.map((g) => (
            <div key={g.lead}>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{g.lead}</div>
              <div className="space-y-2">
                {g.agents.map((a) => (
                  <div key={a.agent} className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-white font-medium flex-1 truncate">{a.agent}</span>
                      <span className="text-xs text-red-300 shrink-0">{a.items.length}</span>
                    </div>
                    <ul className="divide-y divide-white/5">
                      {a.items.map((f) => (
                        <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                          {f.photo_url && (
                            <button onClick={() => setLightbox(f.photo_url)} className="shrink-0">
                              <img src={f.photo_url} alt="signup" className="w-10 h-10 rounded-lg object-cover" loading="lazy" />
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">
                              {f.first_name} {f.last_name}
                              {f.goldrush_id && <span className="text-gray-500"> · GR {f.goldrush_id}</span>}
                            </div>
                            <div className="text-xs text-red-300/80 truncate">{f.error_summary}</div>
                          </div>
                          <span className="text-[11px] text-gray-600 shrink-0">{f.visit_date?.slice(5)}</span>
                          {f.customer_id && (
                            <button
                              onClick={() => navigate(`/agent/customer-edit/${f.customer_id}`)}
                              className="shrink-0 min-h-[44px] min-w-[44px] -my-2 flex items-center justify-center text-gray-500 active:text-primary"
                              title="Fix customer record"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <button onClick={() => setLightbox(null)} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <img src={lightbox} alt="full" className="max-w-full max-h-full object-contain rounded-xl" />
        </button>
      )}
    </div>
  )
}
