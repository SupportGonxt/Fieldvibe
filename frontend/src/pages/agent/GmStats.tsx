import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, ArrowUpRight, ArrowDownRight, Minus, ChevronDown, ChevronLeft, ChevronRight,
  Users, Phone, UserX, ShieldAlert, CheckCircle2,
} from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { SIGNAL_REGISTRY, signalText, type Signal } from '../../lib/signalRegistry'
import { rand, PERIODS, shiftAnchor, windowLabel, type Overview, type Period } from './GmOverview'

// GM stats. /agent/overview answers *who* (teams, managers, individuals).
// This answers *what is driving the numbers*: the KPIs up top, then every
// underperformance signal firing across the field, worst-first, each one
// opening onto the agents triggering it.
//
// Two sources, both already GM-gated:
//   /field-ops/gm/overview   -> KPIs + prev-period comparison
//   /field-ops/kpi/tenant-signals -> per-signal agent roll-up (the drill-down)

type Flagged = { id: string; name: string; signals: Signal[]; severity: number }
type TenantSignals = {
  counts: Record<string, number>
  flaggedAgents: number
  totalAgents: number
  flagged: Flagged[]
}

const pctDelta = (now: number, prev: number): number | null =>
  prev > 0 ? ((now - prev) / prev) * 100 : null

export default function GmStats() {
  const [period, setPeriod] = useState<Period>('month')
  const [anchor, setAnchor] = useState<string | null>(null)
  const [company, setCompany] = useState<string | null>(null)
  const [data, setData] = useState<Overview | null>(null)
  const [sig, setSig] = useState<TenantSignals | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    const co = company ? `&company_id=${company}` : ''
    const qs = `period=${period}${anchor ? `&anchor=${anchor}` : ''}${co}`
    Promise.all([
      apiClient.get(`/field-ops/gm/overview?${qs}`).then((r) => r?.data ?? null).catch(() => null),
      apiClient.get(`/field-ops/kpi/tenant-signals?${co.slice(1)}`).then((r) => r?.data ?? null).catch(() => null),
    ])
      .then(([o, s]) => { setData(o); setSig(s) })
      .finally(() => setLoading(false))
  }, [period, anchor, company])

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#00E87B] animate-spin" />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-[#06090F] px-4 pt-6 pb-24 text-center">
        <p className="text-sm text-gray-400 mt-20">Could not load performance stats.</p>
      </div>
    )
  }

  const { funnel, money, field, calls } = data
  const coverage = field.totalAgents > 0 ? Math.round((field.activeAgents / field.totalAgents) * 100) : 0

  // Signal types actually firing, biggest population first.
  const groups = Object.entries(sig?.counts || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="min-h-screen bg-[#06090F] px-4 pt-6 pb-24">
      <div className="max-w-md mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Performance</h1>
          <p className="text-sm text-gray-500">{windowLabel(data.window, period)}</p>
        </div>

        {data.companies.length > 1 && (
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
            <Chip active={!company} onClick={() => setCompany(null)}>All customers</Chip>
            {data.companies.map((c) => (
              <Chip key={c.id} active={company === c.id} onClick={() => setCompany(c.id)}>{c.name}</Chip>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex gap-2 flex-1">
            {PERIODS.map((p) => (
              <Chip key={p.key} active={period === p.key} onClick={() => { setPeriod(p.key); setAnchor(null) }}>
                {p.label}
              </Chip>
            ))}
          </div>
          <button
            onClick={() => setAnchor(shiftAnchor(anchor, period, -1))}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-white"
            aria-label="Previous period"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAnchor(shiftAnchor(anchor, period, 1))}
            disabled={data.window.isCurrent}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-white disabled:opacity-30"
            aria-label="Next period"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* The funnel, end to end. Signups -> converted -> qualified is the money path;
            revenue only books off qualified deposits. */}
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Signups" value={funnel.signups.toLocaleString()} delta={pctDelta(funnel.signups, funnel.prev.signups)} />
          <Kpi label="Converted" value={funnel.converted.toLocaleString()} delta={pctDelta(funnel.converted, funnel.prev.converted)} />
          <Kpi
            label="Conversion"
            value={`${funnel.conversionRate}%`}
            delta={funnel.prev.conversionRate > 0 ? funnel.conversionRate - funnel.prev.conversionRate : null}
            unit="pts"
          />
          <Kpi label="Revenue" value={rand(money.revenue)} delta={pctDelta(money.revenue, money.prevRevenue)} />
          <div className="col-span-2">
            {/* qualified has no prev in the payload — show it flat rather than fake a delta */}
            <Kpi label="Qualified deposits" value={funnel.qualified.toLocaleString()} delta={null} hint={`R${funnel.commissionPerDeposit} commission each`} />
          </div>
        </div>

        {/* Capacity: numbers can only move if agents are in the field and leads are being called. */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl divide-y divide-white/[0.06]">
          <Row
            icon={<Users className="w-4 h-4 text-[#00E87B]" />}
            label="Agents in the field"
            value={`${field.activeAgents}/${field.totalAgents}`}
            note={`${coverage}% coverage`}
            bad={coverage < 70}
          />
          {field.unassignedAgents > 0 && (
            <Row
              icon={<UserX className="w-4 h-4 text-amber-400" />}
              label="Unassigned agents"
              value={String(field.unassignedAgents)}
              note="no team lead — nobody is managing them"
              bad
            />
          )}
          <Row
            icon={<Phone className="w-4 h-4 text-[#00E87B]" />}
            label="Leads contacted"
            value={`${calls.contacted.toLocaleString()}${calls.target ? `/${calls.target.toLocaleString()}` : ''}`}
            note={calls.target ? `${Math.round((calls.contacted / calls.target) * 100)}% of target` : 'no call target set'}
            bad={calls.target > 0 && calls.contacted < calls.target * 0.7}
          />
        </div>

        {/* Why the numbers look like they do. Tap a signal to see who is triggering it. */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What&apos;s dragging performance</h2>
            {sig && (
              <span className="text-xs text-gray-500">{sig.flaggedAgents} of {sig.totalAgents} flagged</span>
            )}
          </div>

          {!groups.length ? (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-[#00E87B]/60 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No signals firing</p>
              <p className="text-xs text-gray-600 mt-1">Every active agent is inside their thresholds</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map(([type, count]) => {
                // severityWeight mirrors the old issueEngine.js KIND_WEIGHT — 2+ is a hard
                // outcome metric, 1 is root-cause texture that merely explains one.
                const heavy = (SIGNAL_REGISTRY[type]?.severityWeight ?? 0) >= 2
                const agents = (sig?.flagged || []).filter((a) => a.signals.some((s) => s.type === type))
                const isOpen = open === type
                return (
                  <div key={type} className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setOpen(isOpen ? null : type)}
                      className="w-full min-h-[56px] flex items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className={`w-1.5 h-8 rounded-full flex-shrink-0 ${heavy ? 'bg-red-500' : 'bg-amber-500'}`} />
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-white">{SIGNAL_REGISTRY[type]?.label ?? type.replace(/_/g, ' ')}</span>
                        <span className="block text-xs text-gray-500">
                          {count} agent{count === 1 ? '' : 's'}{heavy ? '' : ' · root cause'}
                        </span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                        {agents.map((a) => {
                          const s = a.signals.find((x) => x.type === type)!
                          return (
                            <li key={a.id}>
                              <button
                                onClick={() => navigate(`/agent/agent-detail/${a.id}`)}
                                className="w-full min-h-[56px] flex items-center gap-3 px-4 py-3 text-left active:bg-white/[0.03]"
                              >
                                <span className="flex-1 min-w-0">
                                  <span className="block text-sm font-medium text-white truncate">{a.name}</span>
                                  <span className="block text-xs text-gray-500 truncate">{signalText(s)}</span>
                                </span>
                                {a.signals.length > 1 && (
                                  <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-red-600 text-white flex-shrink-0">
                                    +{a.signals.length - 1}
                                  </span>
                                )}
                                <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {!sig && (
          <p className="text-xs text-gray-600 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Signals unavailable right now.
          </p>
        )}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[44px] whitespace-nowrap px-4 rounded-xl text-sm font-medium border ${
        active ? 'bg-[#00E87B] text-[#0A1628] border-transparent' : 'bg-white/[0.06] text-gray-300 border-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function Kpi({ label, value, delta, unit = '%', hint }: {
  label: string; value: string; delta: number | null; unit?: string; hint?: string
}) {
  const up = delta != null && delta > 0.5
  const down = delta != null && delta < -0.5
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums mt-1">{value}</p>
      {delta != null ? (
        <p className={`text-xs mt-1 flex items-center gap-0.5 ${up ? 'text-[#00E87B]' : down ? 'text-red-400' : 'text-gray-500'}`}>
          <Icon className="w-3 h-3" />
          {Math.abs(delta) < 0.05 ? '0' : Math.abs(delta).toFixed(unit === 'pts' ? 1 : 0)}{unit === 'pts' ? ' pts' : '%'}
          <span className="text-gray-600">vs prev</span>
        </p>
      ) : (
        <p className="text-xs text-gray-600 mt-1">{hint || 'no prior period'}</p>
      )}
    </div>
  )
}

function Row({ icon, label, value, note, bad }: {
  icon: React.ReactNode; label: string; value: string; note: string; bad?: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className={`text-xs ${bad ? 'text-amber-400' : 'text-gray-500'}`}>{note}</p>
      </div>
      <span className="text-lg font-bold text-white tabular-nums">{value}</span>
    </div>
  )
}
