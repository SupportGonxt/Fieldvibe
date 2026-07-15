import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Target, Loader2, AlertCircle, ChevronRight } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { fieldOperationsService } from '../../services/field-operations.service'
import { useAuthStore } from '../../store/auth.store'
import { roleAllows } from '../../lib/capabilities'

// GM-only monthly target editor for the PWA. Reuses the desktop console's
// /field-ops/monthly-targets endpoints (now gated requireRole('admin') server-side).
// HARD RULE: counts only — never surface commission/monetary fields here.

interface AgentRow {
  id: string
  first_name: string
  last_name: string
}

interface TargetRow {
  id: string
  agent_id: string
  target_visits: number
  target_registrations: number
  target_conversions: number
}

export default function GmTargetsPage() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.user?.role)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [month, setMonth] = useState(currentMonth)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [targets, setTargets] = useState<TargetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<AgentRow | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [agentsRes, targetsRes] = await Promise.all([
        fieldOperationsService.getFieldAgents({ status: 'active' }),
        fieldOperationsService.getMonthlyTargets({ target_month: month }),
      ])
      setAgents(Array.isArray(agentsRes) ? agentsRes : agentsRes?.data || [])
      const rows = targetsRes?.data || targetsRes || []
      setTargets(Array.isArray(rows) ? rows : [])
    } catch (err) {
      console.error('GM targets fetch error:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { fetchData() }, [fetchData])

  if (!roleAllows(role, [])) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-6">
        <p className="text-token-muted text-sm">Targets can only be set by a General Manager.</p>
      </div>
    )
  }

  // ponytail: one row per agent+month assumed; multi-company rows edit the first.
  const rowFor = (agentId: string) => targets.find((t) => t.agent_id === agentId)

  const save = async (agent: AgentRow, values: { target_visits: number; target_registrations: number; target_conversions: number }) => {
    setEditing(null)
    try {
      const existing = rowFor(agent.id)
      if (existing) {
        await fieldOperationsService.updateMonthlyTarget(existing.id, values)
      } else {
        await fieldOperationsService.createMonthlyTarget({ agent_id: agent.id, target_month: month, ...values })
      }
      toast.success(`Target set for ${agent.first_name}`)
      fetchData()
    } catch (err) {
      console.error('Save target error:', err)
      toast.error('Failed to save target')
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-surface px-5 py-4 border-b border-token">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-token-muted mb-3">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs">Back</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-token">Agent Targets</h1>
            <p className="text-xs text-token-faint">Monthly visit counts per agent</p>
          </div>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="mt-3 w-full min-h-[44px] px-3 bg-white/5 border border-token rounded-lg text-sm text-token focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div className="px-5 pt-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : error ? (
          <div className="text-center py-16">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-token-muted text-sm">Couldn&apos;t load targets.</p>
            <button onClick={fetchData} className="mt-3 text-primary text-sm font-medium">Retry</button>
          </div>
        ) : agents.length === 0 ? (
          <p className="text-center text-sm text-token-faint py-16">No active agents</p>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => {
              const t = rowFor(agent.id)
              return (
                <button
                  key={agent.id}
                  onClick={() => setEditing(agent)}
                  className="w-full bg-white/5 border border-token rounded-xl p-3 flex items-center gap-3 text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-token">{(agent.first_name?.[0] || '') + (agent.last_name?.[0] || '')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-token truncate">{agent.first_name} {agent.last_name}</p>
                    <p className="text-[10px] text-token-faint">
                      {t
                        ? `${t.target_visits || 0} individual · ${t.target_registrations || 0} store · ${t.target_conversions || 0} conversions`
                        : 'No target set'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-primary flex items-center gap-0.5 flex-shrink-0">
                    Set target <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <TargetSheet
        agent={editing}
        existing={editing ? rowFor(editing.id) : undefined}
        month={month}
        onSave={save}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

// Bottom-sheet editor, NudgeSheet idiom: keyed remount so inputs re-seed per agent.
function TargetSheet({ agent, existing, month, onSave, onClose }: {
  agent: AgentRow | null
  existing?: TargetRow
  month: string
  onSave: (agent: AgentRow, values: { target_visits: number; target_registrations: number; target_conversions: number }) => void
  onClose: () => void
}) {
  if (!agent) return null
  return <SheetEditor key={agent.id + month} agent={agent} existing={existing} month={month} onSave={onSave} onClose={onClose} />
}

function SheetEditor({ agent, existing, month, onSave, onClose }: {
  agent: AgentRow
  existing?: TargetRow
  month: string
  onSave: (agent: AgentRow, values: { target_visits: number; target_registrations: number; target_conversions: number }) => void
  onClose: () => void
}) {
  const [visits, setVisits] = useState(String(existing?.target_visits ?? ''))
  const [stores, setStores] = useState(String(existing?.target_registrations ?? ''))
  const [conversions, setConversions] = useState(String(existing?.target_conversions ?? ''))
  const invalid = [visits, stores, conversions].some((v) => v !== '' && (!Number.isInteger(Number(v)) || Number(v) < 0))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md m-4 mb-6 p-4 bg-surface border border-token rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-token mb-1 flex items-center gap-1.5">
          <Target className="w-4 h-4 text-primary" /> Set target · {agent.first_name} {agent.last_name}
        </h3>
        <p className="text-[10px] text-token-faint mb-3">{month} · monthly counts</p>
        <NumField label="Individual visits" value={visits} onChange={setVisits} />
        <NumField label="Store visits" value={stores} onChange={setStores} />
        <NumField label="Conversions" value={conversions} onChange={setConversions} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="min-h-[44px] py-2 bg-white/5 border border-token rounded-lg text-xs font-semibold text-token-muted">
            Cancel
          </button>
          <button
            onClick={() => onSave(agent, {
              target_visits: Number(visits) || 0,
              target_registrations: Number(stores) || 0,
              target_conversions: Number(conversions) || 0,
            })}
            disabled={invalid}
            className="min-h-[44px] py-2 bg-primary/10 border border-primary/25 rounded-lg text-xs font-semibold text-primary disabled:opacity-50"
          >
            Save Target
          </button>
        </div>
      </div>
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block mb-2">
      <span className="text-xs text-token-muted">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="mt-1 w-full min-h-[44px] px-3 bg-white/5 border border-token rounded-lg text-sm text-token placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  )
}
