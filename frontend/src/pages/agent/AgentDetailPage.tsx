import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Clock, CheckCircle, XCircle, Store, User, Users, Target, Calendar, ChevronRight } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { useAuthStore } from '../../store/auth.store'

interface AgentInfo {
  id: string
  first_name: string
  last_name: string
  phone: string
  role: string
  team_lead_name?: string
}

interface AgentStats {
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

interface Visit {
  id: string
  visit_date: string
  visit_type: string
  visit_target_type: string
  status: string
  check_in_time: string
  check_out_time: string
  customer_name: string
  individual_name: string
  notes: string
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

function statusIcon(status: string) {
  switch (status) {
    case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />
    case 'in_progress': return <Clock className="w-4 h-4 text-blue-400" />
    case 'cancelled': return <XCircle className="w-4 h-4 text-red-400" />
    default: return <Clock className="w-4 h-4 text-gray-400" />
  }
}

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [agent, setAgent] = useState<AgentInfo | null>(null)
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const endpoint = user?.role === 'team_lead'
          ? `/team-lead/agent/${agentId}`
          : `/manager/agent/${agentId}`
        const res = await apiClient.get(endpoint)
        if (res.data?.success && res.data?.data) {
          setAgent(res.data.data.agent)
          setStats(res.data.data.stats)
          setVisits(res.data.data.recent_visits || [])
        }
      } catch (err) {
        console.error('Agent detail fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    if (agentId) fetchData()
  }, [agentId, user?.role])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00E87B] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!agent || !stats) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
        <div className="text-center">
          <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Agent not found</p>
          <button onClick={() => navigate(-1)} className="mt-3 text-[#00E87B] text-sm font-medium">Go back</button>
        </div>
      </div>
    )
  }

  const vPct = stats.target_visits > 0 ? Math.min(100, Math.round((stats.actual_visits / stats.target_visits) * 100)) : 0
  const rPct = stats.target_registrations > 0 ? Math.min(100, Math.round((stats.actual_registrations / stats.target_registrations) * 100)) : 0

  return (
    <div className="min-h-screen bg-[#06090F] pb-24">
      {/* Header */}
      <div className="bg-[#0A1628] px-5 py-4 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 mb-3">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs">Back</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{(agent.first_name?.[0] || '') + (agent.last_name?.[0] || '')}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{agent.first_name} {agent.last_name}</h1>
            <p className="text-xs text-gray-500">{agent.phone || agent.role}</p>
            {agent.team_lead_name && (
              <p className="text-[10px] text-gray-600">Team: {agent.team_lead_name}</p>
            )}
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${pctClass(stats.achievement)}`}>{stats.achievement}%</span>
            <p className="text-[10px] text-gray-500">Achievement</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-5 pt-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className="w-3 h-3 text-blue-400" />
              <p className="text-[10px] text-gray-500 uppercase">Today Individual</p>
            </div>
            <p className="text-xl font-bold text-white">{stats.today_visits}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Store className="w-3 h-3 text-purple-400" />
              <p className="text-[10px] text-gray-500 uppercase">Today Store</p>
            </div>
            <p className="text-xl font-bold text-white">{stats.today_registrations}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className="w-3 h-3 text-emerald-400" />
              <p className="text-[10px] text-gray-500 uppercase">Month Individual</p>
            </div>
            <p className="text-xl font-bold text-white">{stats.month_visits}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Store className="w-3 h-3 text-amber-400" />
              <p className="text-[10px] text-gray-500 uppercase">Month Store</p>
            </div>
            <p className="text-xl font-bold text-white">{stats.month_registrations}</p>
          </div>
        </div>

        {/* Target Progress */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Monthly Targets
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Individual Visits</span>
                <span className="text-white font-medium">{stats.actual_visits}/{stats.target_visits} <span className={pctClass(vPct)}>({vPct}%)</span></span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: vPct + '%', backgroundColor: progressColor(vPct) }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Store Visits</span>
                <span className="text-white font-medium">{stats.actual_registrations}/{stats.target_registrations} <span className={pctClass(rPct)}>({rPct}%)</span></span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: rPct + '%', backgroundColor: '#8B5CF6' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Visits */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Recent Visits ({visits.length})
          </h3>
          {visits.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <MapPin className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No visits found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visits.map((visit) => {
                const vType = (visit.visit_target_type || visit.visit_type || '').toLowerCase()
                return (
                  <div key={visit.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${visit.status === 'completed' ? 'bg-green-500/10' : visit.status === 'in_progress' ? 'bg-blue-500/10' : 'bg-gray-500/10'}`}>
                      {statusIcon(visit.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {visit.customer_name || visit.individual_name || 'Visit'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                          {vType === 'store' ? <Store className="w-2.5 h-2.5 text-purple-400" /> : <User className="w-2.5 h-2.5 text-cyan-400" />}
                          {vType === 'store' ? 'Store' : 'Individual'}
                        </span>
                        <span className="text-[8px] text-gray-600">&bull;</span>
                        <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />{visit.visit_date}
                        </span>
                        {visit.check_in_time && (
                          <>
                            <span className="text-[8px] text-gray-600">&bull;</span>
                            <span className="text-[10px] text-gray-500">{visit.check_in_time.substring(11, 16)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
