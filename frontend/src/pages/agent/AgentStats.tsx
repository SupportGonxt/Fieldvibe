import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, MapPin, Users, Target, Calendar, Award, BarChart3 } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'

interface StatsData {
  today_visits: number
  month_visits: number
  today_registrations: number
  month_registrations: number
  daily_targets: Array<{
    company_name: string
    target_visits: number
    actual_visits: number
    target_registrations: number
    actual_registrations: number
  }>
}

export default function AgentStats() {
  const navigate = useNavigate()
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = useAuthStore.getState().tokens?.access_token || localStorage.getItem('token')
        if (!token) { navigate('/auth/mobile-login'); return }
        const apiUrl = import.meta.env.VITE_API_URL || ''
        const res = await fetch(`${apiUrl}/api/agent/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const json = await res.json()
        if (json.success && json.data) setData(json.data)
      } catch (err) {
        console.error('Stats fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00E87B] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalTargetVisits = data?.daily_targets?.reduce((s, t) => s + (t.target_visits || 0), 0) || 0
  const totalActualVisits = data?.daily_targets?.reduce((s, t) => s + (t.actual_visits || 0), 0) || 0
  const totalTargetRegs = data?.daily_targets?.reduce((s, t) => s + (t.target_registrations || 0), 0) || 0
  const totalActualRegs = data?.daily_targets?.reduce((s, t) => s + (t.actual_registrations || 0), 0) || 0
  const overallPct = totalTargetVisits > 0 ? Math.round((totalActualVisits / totalTargetVisits) * 100) : 0

  return (
    <div className="min-h-screen bg-[#06090F] pb-24">
      <div className="bg-[#0A1628] px-5 pt-5 pb-4 border-b border-white/5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#00E87B]" /> My Performance
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          <Calendar className="w-3 h-3 inline mr-1" />
          {new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="px-5 pt-4 space-y-4">
        {/* Overall Progress Ring */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-5">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="#00E87B" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${Math.min(overallPct, 100) * 2.136} 213.6`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-white">{overallPct}%</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Overall Achievement</p>
            <p className="text-xs text-gray-500 mt-0.5">{totalActualVisits} of {totalTargetVisits} visits</p>
            <p className="text-xs text-gray-500">{totalActualRegs} of {totalTargetRegs} registrations</p>
          </div>
        </div>

        {/* Today Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <MapPin className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{data?.today_visits || 0}</p>
            <p className="text-[10px] text-gray-500 uppercase">Today Visits</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <Users className="w-5 h-5 text-purple-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{data?.today_registrations || 0}</p>
            <p className="text-[10px] text-gray-500 uppercase">Today Regs</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{data?.month_visits || 0}</p>
            <p className="text-[10px] text-gray-500 uppercase">Month Visits</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <Award className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{data?.month_registrations || 0}</p>
            <p className="text-[10px] text-gray-500 uppercase">Month Regs</p>
          </div>
        </div>

        {/* Per-Company Breakdown */}
        {data?.daily_targets && data.daily_targets.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Company Targets</h2>
            <div className="space-y-2">
              {data.daily_targets.map((t, i) => {
                const vPct = t.target_visits > 0 ? Math.min(100, Math.round((t.actual_visits / t.target_visits) * 100)) : 0
                const rPct = t.target_registrations > 0 ? Math.min(100, Math.round((t.actual_registrations / t.target_registrations) * 100)) : 0
                return (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-sm font-semibold text-white mb-3">{t.company_name}</p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Visits</span>
                          <span className="text-white font-medium">{t.actual_visits}/{t.target_visits}</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${vPct}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Registrations</span>
                          <span className="text-white font-medium">{t.actual_registrations}/{t.target_registrations}</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${rPct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
