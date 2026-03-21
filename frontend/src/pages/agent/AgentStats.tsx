import React, { useEffect, useState } from 'react'
import {
  TrendingUp, MapPin, Users, Target, Calendar, Award, BarChart3,
  DollarSign, Flame, Zap, Trophy, Clock
} from 'lucide-react'
import { apiClient } from '../../services/api.service'

interface DashboardData {
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

interface PerformanceData {
  month: string
  overall_achievement: number
  total_target_visits: number
  total_actual_visits: number
  total_target_registrations: number
  total_actual_registrations: number
  total_target_conversions: number
  total_actual_conversions: number
  monthly_targets: Array<{
    company_name: string
    target_visits: number
    actual_visits: number
    target_registrations: number
    actual_registrations: number
    target_conversions: number
    actual_conversions: number
    commission_rate: number
    commission_amount: number
    working_days: number
  }>
  commission_summary: {
    pending: number
    pending_count: number
    approved: number
    approved_count: number
    paid: number
    paid_count: number
    target_commission: number
  }
  recent_earnings: Array<{
    id: string
    amount: number
    status: string
    source_type: string
    created_at: string
    rule_name: string
  }>
  weekly_visits: Array<{ visit_date: string; count: number }>
  streak: number
}

function getBarBg(isToday: boolean, count: number): string {
  if (isToday) return 'linear-gradient(to top, #00E87B, #00D06E)'
  if (count > 0) return 'rgba(0, 232, 123, 0.3)'
  return 'rgba(255,255,255,0.05)'
}

function achievementColor(pct: number): string {
  if (pct >= 100) return '#00E87B'
  if (pct >= 75) return '#F59E0B'
  return '#EF4444'
}

function pctClass(pct: number): string {
  if (pct >= 100) return 'text-[#00E87B]'
  if (pct >= 75) return 'text-amber-400'
  return 'text-red-400'
}

function progressBg(pct: number, base: string): string {
  if (pct >= 100) return '#00E87B'
  if (pct >= 75) return '#F59E0B'
  return base
}

function earningBgClass(status: string): string {
  if (status === 'paid') return 'bg-green-500/10'
  if (status === 'approved') return 'bg-blue-500/10'
  return 'bg-yellow-500/10'
}

function earningIconClass(status: string): string {
  if (status === 'paid') return 'text-green-400'
  if (status === 'approved') return 'text-blue-400'
  return 'text-yellow-400'
}

function earningBadgeClass(status: string): string {
  if (status === 'paid') return 'bg-green-500/20 text-green-300'
  if (status === 'approved') return 'bg-blue-500/20 text-blue-300'
  return 'bg-yellow-500/20 text-yellow-300'
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
    </div>
  )
}

function ProgressRow({ label, actual, target, color }: { label: string; actual: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{actual}/{target} ({pct}%)</span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: pct + '%', backgroundColor: color }} />
      </div>
    </div>
  )
}

function CommissionRow({ label, amount, count, color }: { label: string; amount: number; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-300">{label}</span>
        {count > 0 && <span className="text-[10px] text-gray-500">({count})</span>}
      </div>
      <span className={'text-sm font-semibold ' + color}>R{amount.toLocaleString()}</span>
    </div>
  )
}

function OverviewTab({
  overallPct, totalEarnings, streak, weekDays, weeklyMax, perfData, dashData
}: {
  overallPct: number
  totalEarnings: number
  streak: number
  weekDays: string[]
  weeklyMax: number
  perfData: PerformanceData | null
  dashData: DashboardData | null
}) {
  const todayStr = new Date().toISOString().split('T')[0]
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <div className="relative w-14 h-14 mx-auto mb-2">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
              <circle cx="28" cy="28" r="22" fill="none" stroke="#00E87B" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={Math.min(overallPct, 100) * 1.382 + ' 138.2'} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{overallPct}%</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 uppercase">Target</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <DollarSign className="w-6 h-6 text-amber-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">R{totalEarnings.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 uppercase">Earnings</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <Flame className={'w-6 h-6 mx-auto mb-1 ' + (streak > 0 ? 'text-orange-400' : 'text-gray-600')} />
          <p className="text-lg font-bold text-white">{streak}</p>
          <p className="text-[10px] text-gray-500 uppercase">Streak</p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">This Week</h3>
        <div className="flex items-end justify-between gap-1 h-20">
          {weekDays.map(date => {
            const found = perfData?.weekly_visits?.find(w => w.visit_date === date)
            const count = found?.count || 0
            const height = weeklyMax > 0 ? (count / weeklyMax) * 100 : 0
            const isToday = date === todayStr
            return (
              <div key={date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-gray-500">{count || ''}</span>
                <div className="w-full rounded-t-md" style={{
                  height: Math.max(height, 4) + '%',
                  background: getBarBg(isToday, count),
                }} />
                <span className={'text-[9px] ' + (isToday ? 'text-[#00E87B] font-semibold' : 'text-gray-600')}>
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'narrow' })}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<MapPin className="w-5 h-5 text-blue-400" />} label="Today Visits" value={dashData?.today_visits || 0} />
        <StatCard icon={<Users className="w-5 h-5 text-purple-400" />} label="Today Regs" value={dashData?.today_registrations || 0} />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} label="Month Visits" value={dashData?.month_visits || 0} />
        <StatCard icon={<Award className="w-5 h-5 text-amber-400" />} label="Month Regs" value={dashData?.month_registrations || 0} />
      </div>

      {perfData && perfData.total_target_visits > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Monthly Achievement</h3>
          <div className="space-y-3">
            <ProgressRow label="Visits" actual={perfData.total_actual_visits} target={perfData.total_target_visits} color="#3B82F6" />
            <ProgressRow label="Registrations" actual={perfData.total_actual_registrations} target={perfData.total_target_registrations} color="#8B5CF6" />
            {perfData.total_target_conversions > 0 && (
              <ProgressRow label="Conversions" actual={perfData.total_actual_conversions} target={perfData.total_target_conversions} color="#10B981" />
            )}
          </div>
        </div>
      )}
    </>
  )
}

function TargetsTab({ perfData, dashData }: { perfData: PerformanceData | null; dashData: DashboardData | null }) {
  const ach = perfData?.overall_achievement || 0
  return (
    <>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-5">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke={achievementColor(ach)} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={Math.min(ach, 100) * 2.136 + ' 213.6'} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{ach}%</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Monthly Achievement</p>
          <p className="text-xs text-gray-500 mt-0.5">{perfData?.total_actual_visits || 0} of {perfData?.total_target_visits || 0} visits</p>
          <p className="text-xs text-gray-500">{perfData?.total_actual_registrations || 0} of {perfData?.total_target_registrations || 0} registrations</p>
          {ach >= 100 && (
            <p className="text-xs text-[#00E87B] font-semibold mt-1 flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Target exceeded!
            </p>
          )}
        </div>
      </div>

      {perfData?.monthly_targets && perfData.monthly_targets.length > 0 ? (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Company Targets</h2>
          <div className="space-y-2">
            {perfData.monthly_targets.map((t, i) => {
              const vPct = t.target_visits > 0 ? Math.min(100, Math.round((t.actual_visits / t.target_visits) * 100)) : 0
              const rPct = t.target_registrations > 0 ? Math.min(100, Math.round((t.actual_registrations / t.target_registrations) * 100)) : 0
              return (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-white">{t.company_name}</p>
                    {t.commission_amount > 0 && (
                      <span className="text-xs text-amber-400 font-medium">R{t.commission_amount.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Visits</span>
                        <span className="text-white font-medium">{t.actual_visits}/{t.target_visits} <span className={pctClass(vPct)}>({vPct}%)</span></span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: vPct + '%', background: progressBg(vPct, '#3B82F6') }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Registrations</span>
                        <span className="text-white font-medium">{t.actual_registrations}/{t.target_registrations} <span className={pctClass(rPct)}>({rPct}%)</span></span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: rPct + '%', background: progressBg(rPct, '#8B5CF6') }} />
                      </div>
                    </div>
                  </div>
                  {t.commission_rate > 0 && (
                    <p className="text-[10px] text-gray-500 mt-2">Commission rate: {t.commission_rate}%</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <Target className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No targets set for this month</p>
          <p className="text-xs text-gray-600 mt-1">Contact your manager to set targets</p>
        </div>
      )}

      {dashData?.daily_targets && dashData.daily_targets.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Today&apos;s Targets</h2>
          <div className="space-y-2">
            {dashData.daily_targets.map((t, i) => {
              const visitPct = t.target_visits > 0 ? Math.min(100, Math.round((t.actual_visits / t.target_visits) * 100)) : 0
              return (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{t.company_name}</span>
                    <span className={'text-xs font-semibold ' + (visitPct >= 100 ? 'text-[#00E87B]' : 'text-amber-400')}>{visitPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#00E87B] to-[#00D06E] rounded-full transition-all" style={{ width: visitPct + '%' }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-gray-500">Visits: {t.actual_visits}/{t.target_visits}</span>
                    <span className="text-[10px] text-gray-500">Regs: {t.actual_registrations}/{t.target_registrations}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

function EarningsTab({ perfData, totalEarnings }: { perfData: PerformanceData | null; totalEarnings: number }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 rounded-2xl p-4">
          <DollarSign className="w-5 h-5 text-amber-400 mb-1" />
          <p className="text-xl font-bold text-white">R{totalEarnings.toLocaleString()}</p>
          <p className="text-[10px] text-amber-300/70 uppercase">Total Earnings</p>
        </div>
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/20 rounded-2xl p-4">
          <Zap className="w-5 h-5 text-green-400 mb-1" />
          <p className="text-xl font-bold text-white">R{(perfData?.commission_summary?.paid || 0).toLocaleString()}</p>
          <p className="text-[10px] text-green-300/70 uppercase">Paid Out</p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Commission Breakdown</h3>
        <div className="space-y-3">
          <CommissionRow label="Pending" amount={perfData?.commission_summary?.pending || 0} count={perfData?.commission_summary?.pending_count || 0} color="text-yellow-400" />
          <CommissionRow label="Approved" amount={perfData?.commission_summary?.approved || 0} count={perfData?.commission_summary?.approved_count || 0} color="text-blue-400" />
          <CommissionRow label="Paid" amount={perfData?.commission_summary?.paid || 0} count={perfData?.commission_summary?.paid_count || 0} color="text-green-400" />
        </div>
        {(perfData?.commission_summary?.target_commission || 0) > 0 && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Target Commission</span>
              <span className="text-sm font-bold text-[#00E87B]">R{(perfData?.commission_summary?.target_commission || 0).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Earnings</h2>
        {perfData?.recent_earnings && perfData.recent_earnings.length > 0 ? (
          <div className="space-y-2">
            {perfData.recent_earnings.map((earning) => (
              <div key={earning.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className={'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ' + earningBgClass(earning.status)}>
                  <DollarSign className={'w-5 h-5 ' + earningIconClass(earning.status)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {earning.rule_name || earning.source_type || 'Commission'}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(earning.created_at).toLocaleDateString('en-ZA')}
                    <span className={'ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium ' + earningBadgeClass(earning.status)}>{earning.status}</span>
                  </p>
                </div>
                <p className="text-sm font-bold text-white flex-shrink-0">R{earning.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <DollarSign className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No earnings yet</p>
            <p className="text-xs text-gray-600 mt-1">Complete visits and meet targets to earn commissions</p>
          </div>
        )}
      </div>
    </>
  )
}

export default function AgentStats() {
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [perfData, setPerfData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'targets' | 'earnings'>('overview')

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [dashRes, perfRes] = await Promise.all([
          apiClient.get('/agent/dashboard'),
          apiClient.get('/agent/performance'),
        ])
        if (dashRes.data?.success && dashRes.data?.data) setDashData(dashRes.data.data)
        if (perfRes.data?.success && perfRes.data?.data) setPerfData(perfRes.data.data)
      } catch (err) {
        console.error('Stats fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06090F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00E87B] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalTargetVisits = dashData?.daily_targets?.reduce((s, t) => s + (t.target_visits || 0), 0) || 0
  const totalActualVisits = dashData?.daily_targets?.reduce((s, t) => s + (t.actual_visits || 0), 0) || 0
  const overallPct = totalTargetVisits > 0 ? Math.round((totalActualVisits / totalTargetVisits) * 100) : 0

  const totalEarnings = (perfData?.commission_summary?.paid || 0) + (perfData?.commission_summary?.approved || 0) + (perfData?.commission_summary?.pending || 0)
  const streak = perfData?.streak || 0

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
  const weeklyMax = Math.max(1, ...weekDays.map(date => {
    const found = perfData?.weekly_visits?.find(w => w.visit_date === date)
    return found?.count || 0
  }))

  const tabClass = (tab: string) =>
    'flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all ' +
    (activeTab === tab ? 'bg-[#00E87B] text-[#0A1628]' : 'text-gray-400')

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

      <div className="px-5 pt-3">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {(['overview', 'targets', 'earnings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={tabClass(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        {activeTab === 'overview' && (
          <OverviewTab
            overallPct={overallPct}
            totalEarnings={totalEarnings}
            streak={streak}
            weekDays={weekDays}
            weeklyMax={weeklyMax}
            perfData={perfData}
            dashData={dashData}
          />
        )}
        {activeTab === 'targets' && (
          <TargetsTab perfData={perfData} dashData={dashData} />
        )}
        {activeTab === 'earnings' && (
          <EarningsTab perfData={perfData} totalEarnings={totalEarnings} />
        )}
      </div>
    </div>
  )
}
