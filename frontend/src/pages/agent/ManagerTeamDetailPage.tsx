import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, ChevronDown, ChevronUp, ChevronRight, MapPin, AlertCircle } from 'lucide-react'
import { apiClient } from '../../services/api.service'

interface AgentStat {
  id: string
  first_name: string
  last_name: string
  phone: string
  role: string
  today_visits: number
  month_visits: number
  today_stores: number
  month_stores: number
  target_visits: number
  actual_visits: number
  target_stores: number
  actual_stores: number
  achievement: number
}

function pctClass(pct: number): string {
  if (pct >= 100) return 'text-primary'
  if (pct >= 75) return 'text-amber-400'
  return 'text-red-400'
}

function progressColor(pct: number): string {
  if (pct >= 100) return 'var(--color-primary)'
  if (pct >= 75) return '#F59E0B'
  return '#EF4444'
}

export default function ManagerTeamDetailPage() {
  const { teamLeadId } = useParams<{ teamLeadId: string }>()
  const navigate = useNavigate()
  const [teamLead, setTeamLead] = useState<{ id: string; first_name: string; last_name: string } | null>(null)
  const [agents, setAgents] = useState<AgentStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await apiClient.get(`/manager/team/${teamLeadId}/agents`)
      if (res.data?.success && res.data?.data) {
        setTeamLead(res.data.data.team_lead)
        setAgents(res.data.data.agents || [])
      } else {
        setError(true)
      }
    } catch (err) {
      console.error('Team detail fetch error:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [teamLeadId])

  useEffect(() => {
    if (teamLeadId) fetchData()
  }, [teamLeadId, fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-6">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-token-muted text-sm">Couldn't load this team.</p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <button onClick={() => fetchData()} className="text-primary text-sm font-medium">Retry</button>
            <button onClick={() => navigate(-1)} className="text-token-faint text-sm font-medium">Go back</button>
          </div>
        </div>
      </div>
    )
  }

  if (!teamLead) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-token-muted text-sm">Team not found</p>
          <button onClick={() => navigate(-1)} className="mt-3 text-primary text-sm font-medium">Go back</button>
        </div>
      </div>
    )
  }

  const totalVisits = agents.reduce((s, a) => s + a.actual_visits, 0)
  const totalTarget = agents.reduce((s, a) => s + a.target_visits, 0)
  const totalStores = agents.reduce((s, a) => s + a.actual_stores, 0)
  // Match the per-agent achievement rows shown below (server value), not a visits-only
  // ratio — a manager drilling in from Teams must see the same number, not a contradiction.
  const teamAch = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + (a.achievement || 0), 0) / agents.length)
    : 0

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Header */}
      <div className="bg-surface px-5 py-4 border-b border-token">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-token-muted mb-3">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs">Back to Teams</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-token">{teamLead.first_name} {teamLead.last_name}</h1>
            <p className="text-xs text-token-faint">Team Lead &middot; {agents.length} agents</p>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${pctClass(teamAch)}`}>{teamAch}%</span>
            <p className="text-[10px] text-token-faint">Team Ach.</p>
          </div>
        </div>
      </div>

      {/* Team Summary */}
      <div className="px-5 pt-4">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-white/5 border border-token rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-token">{agents.length}</p>
            <p className="text-[10px] text-token-faint">Agents</p>
          </div>
          <div className="bg-white/5 border border-token rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-token">{totalVisits}<span className="text-xs text-token-faint">/{totalTarget}</span></p>
            <p className="text-[10px] text-token-faint">Individual Visits</p>
          </div>
          <div className="bg-white/5 border border-token rounded-xl p-3 text-center col-span-2">
            <p className="text-lg font-bold text-token">{totalStores}</p>
            <p className="text-[10px] text-token-faint">Store Visits (month)</p>
          </div>
        </div>

        {/* Agent List */}
        <h2 className="text-xs font-semibold text-token-faint uppercase tracking-wider mb-3">Agent Performance</h2>
        {agents.length === 0 ? (
          <div className="bg-white/5 border border-token rounded-xl p-6 text-center">
            <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-token-faint">No agents in this team</p>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => {
              const isExpanded = expandedAgent === agent.id
              const agentVPct = agent.target_visits > 0 ? Math.min(100, Math.round((agent.actual_visits / agent.target_visits) * 100)) : 0
              const agentRPct = agent.target_stores > 0 ? Math.min(100, Math.round((agent.actual_stores / agent.target_stores) * 100)) : 0
              return (
                <div key={agent.id} className="bg-white/5 border border-token rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                    className="w-full p-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-token">{(agent.first_name?.[0] || '') + (agent.last_name?.[0] || '')}</span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-token truncate">{agent.first_name} {agent.last_name}</p>
                      <p className="text-[10px] text-token-faint">{agent.today_visits} individual &middot; {agent.today_stores} store today</p>
                    </div>
                    <div className="text-right mr-1">
                      <span className={`text-xs font-bold ${pctClass(agent.achievement)}`}>
                        {agent.achievement}%
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-token-faint" /> : <ChevronDown className="w-4 h-4 text-token-faint" />}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-token">
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-[10px] text-token-faint">Month Individual</p>
                          <p className="text-sm font-semibold text-token">{agent.month_visits}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-[10px] text-token-faint">Month Store</p>
                          <p className="text-sm font-semibold text-token">{agent.month_stores}</p>
                        </div>
                      </div>
                      {/* Visit target progress */}
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-token-faint">Individual Target</span>
                          <span className="text-token">{agent.actual_visits}/{agent.target_visits} <span className={pctClass(agentVPct)}>({agentVPct}%)</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: agentVPct + '%', backgroundColor: progressColor(agentVPct) }} />
                        </div>
                      </div>
                      {/* Store target progress */}
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-token-faint">Store Target</span>
                          <span className="text-token">{agent.actual_stores}/{agent.target_stores} <span className={pctClass(agentRPct)}>({agentRPct}%)</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: agentRPct + '%', backgroundColor: progressColor(agentRPct) }} />
                        </div>
                      </div>
                      {/* View Details button */}
                      <button
                        onClick={() => navigate(`/agent/agent-detail/${agent.id}`)}
                        className="w-full mt-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-xs font-semibold text-primary flex items-center justify-center gap-1.5"
                      >
                        <MapPin className="w-3.5 h-3.5" /> View Visit History
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
