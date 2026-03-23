import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, ChevronDown, ChevronUp, ChevronRight, Target, MapPin } from 'lucide-react'
import { apiClient } from '../../services/api.service'

interface AgentStat {
  id: string
  first_name: string
  last_name: string
  phone: string
  role: string
  today_visits: number
  month_visits: number
  today_registrations: number
  month_registrations: number
  target_visits: number
  actual_visits: number
  target_registrations: number
  actual_registrations: number
  achievement: number
}

function pctClass(pct: number): string {
  if (pct >= 100) return 'text-[#00E87B]'
  if (pct >= 75) return 'text-amber-400'
  return 'text-red-400'
}

function progressColor(pct: number): string {
  if (pct >= 100) return '#00E87B'
  if (pct >= 75) return '#F59E0B'
  return '#EF4444'
}

export default function ManagerTeamDetailPage() {
  const { teamLeadId } = useParams<{ teamLeadId: string }>()
  const navigate = useNavigate()
  const [teamLead, setTeamLead] = useState<{ id: string; first_name: string; last_name: string } | null>(null)
  const [agents, setAgents] = useState<AgentStat[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiClient.get(`/manager/team/${teamLeadId}/agents`)
        if (res.data?.success && res.data?.data) {
          setTeamLead(res.data.data.team_lead)
          setAgents(res.data.data.agents || [])
        }
      } catch (err) {
        console.error('Team detail fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    if (teamLeadId) fetchData()
  }, [teamLeadId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00E87B] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!teamLead) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
        <div className="text-center">
          <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Team not found</p>
          <button onClick={() => navigate(-1)} className="mt-3 text-[#00E87B] text-sm font-medium">Go back</button>
        </div>
      </div>
    )
  }

  const totalVisits = agents.reduce((s, a) => s + a.actual_visits, 0)
  const totalTarget = agents.reduce((s, a) => s + a.target_visits, 0)
  const teamAch = totalTarget > 0 ? Math.round((totalVisits / totalTarget) * 100) : 0

  return (
    <div className="min-h-screen bg-[#06090F] pb-24">
      {/* Header */}
      <div className="bg-[#0A1628] px-5 py-4 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 mb-3">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs">Back to Teams</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{teamLead.first_name} {teamLead.last_name}</h1>
            <p className="text-xs text-gray-500">Team Lead &middot; {agents.length} agents</p>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${pctClass(teamAch)}`}>{teamAch}%</span>
            <p className="text-[10px] text-gray-500">Team Ach.</p>
          </div>
        </div>
      </div>

      {/* Team Summary */}
      <div className="px-5 pt-4">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">{agents.length}</p>
            <p className="text-[10px] text-gray-500">Agents</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">{totalVisits}</p>
            <p className="text-[10px] text-gray-500">Month Visits</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">{totalTarget}</p>
            <p className="text-[10px] text-gray-500">Target</p>
          </div>
        </div>

        {/* Agent List */}
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Agent Performance</h2>
        {agents.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No agents in this team</p>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => {
              const isExpanded = expandedAgent === agent.id
              const agentVPct = agent.target_visits > 0 ? Math.min(100, Math.round((agent.actual_visits / agent.target_visits) * 100)) : 0
              const agentRPct = agent.target_registrations > 0 ? Math.min(100, Math.round((agent.actual_registrations / agent.target_registrations) * 100)) : 0
              return (
                <div key={agent.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                    className="w-full p-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-white">{(agent.first_name?.[0] || '') + (agent.last_name?.[0] || '')}</span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-white truncate">{agent.first_name} {agent.last_name}</p>
                      <p className="text-[10px] text-gray-500">{agent.today_visits} visits &middot; {agent.today_registrations} regs today</p>
                    </div>
                    <div className="text-right mr-1">
                      <span className={`text-xs font-bold ${pctClass(agent.achievement)}`}>
                        {agent.achievement}%
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-white/5">
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-[10px] text-gray-500">Month Visits</p>
                          <p className="text-sm font-semibold text-white">{agent.month_visits}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-[10px] text-gray-500">Month Regs</p>
                          <p className="text-sm font-semibold text-white">{agent.month_registrations}</p>
                        </div>
                      </div>
                      {/* Visit target progress */}
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-gray-500">Visit Target</span>
                          <span className="text-white">{agent.actual_visits}/{agent.target_visits} <span className={pctClass(agentVPct)}>({agentVPct}%)</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: agentVPct + '%', backgroundColor: progressColor(agentVPct) }} />
                        </div>
                      </div>
                      {/* Registration target progress */}
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-gray-500">Reg Target</span>
                          <span className="text-white">{agent.actual_registrations}/{agent.target_registrations} <span className={pctClass(agentRPct)}>({agentRPct}%)</span></span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: agentRPct + '%', backgroundColor: '#8B5CF6' }} />
                        </div>
                      </div>
                      {/* View Details button */}
                      <button
                        onClick={() => navigate(`/agent/agent-detail/${agent.id}`)}
                        className="w-full mt-3 py-2 bg-[#00E87B]/10 border border-[#00E87B]/20 rounded-lg text-xs font-semibold text-[#00E87B] flex items-center justify-center gap-1.5"
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
