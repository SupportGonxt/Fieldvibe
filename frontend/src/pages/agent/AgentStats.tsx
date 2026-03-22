import React, { useEffect, useState } from 'react'
import {
  TrendingUp, MapPin, Users, Target, Calendar, Award, BarChart3,
  DollarSign, Flame, Zap, Trophy, Clock, Shield, Star, UserCheck, Store, User
} from 'lucide-react'
import { apiClient } from '../../services/api.service'

interface VisitBreakdownItem {
  company_id: string
  company_name: string
  visit_type: string
  count: number
  today_count: number
  month_count: number
}

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
  visit_breakdown?: VisitBreakdownItem[]
  companies?: Array<{ id: string; name: string }>
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
    store_visits?: number
    individual_visits?: number
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
  commission_rules: Array<{
    id: string
    name: string
    source_type: string
    rate: number
    min_threshold: number
    max_cap: number | null
    effective_from: string | null
    effective_to: string | null
  }>
  commission_tiers: Array<{
    id: string
    tier_name: string
    min_achievement_pct: number
    max_achievement_pct: number | null
    commission_rate: number
    bonus_amount: number
    metric_type: string
  }>
  current_tier: {
    id: string
    tier_name: string
    min_achievement_pct: number
    max_achievement_pct: number | null
    commission_rate: number
    bonus_amount: number
    metric_type: string
  } | null
  team_performance: {
    team_lead_name: string
    member_count: number
    total_visits: number
    total_registrations: number
    target_visits: number
    actual_visits: number
    target_registrations: number
    actual_registrations: number
    achievement: number
  } | null
  manager_performance: {
    manager_name: string
    achievement: number
  } | null
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

function VisitBreakdownSection({ breakdown, companies }: { breakdown: VisitBreakdownItem[]; companies: Array<{ id: string; name: string }> }) {
  // Group by company
  const byCompany: Record<string, { company_name: string; store_today: number; store_month: number; individual_today: number; individual_month: number; other_today: number; other_month: number }> = {}
  for (const item of breakdown) {
    const key = item.company_id || 'unassigned'
    if (!byCompany[key]) {
      byCompany[key] = { company_name: item.company_name || 'Unassigned', store_today: 0, store_month: 0, individual_today: 0, individual_month: 0, other_today: 0, other_month: 0 }
    }
    const vt = (item.visit_type || '').toLowerCase()
    if (vt === 'store') {
      byCompany[key].store_today += item.today_count || 0
      byCompany[key].store_month += item.month_count || 0
    } else if (vt === 'individual') {
      byCompany[key].individual_today += item.today_count || 0
      byCompany[key].individual_month += item.month_count || 0
    } else {
      byCompany[key].other_today += item.today_count || 0
      byCompany[key].other_month += item.month_count || 0
    }
  }

  const companyEntries = Object.entries(byCompany)
  if (companyEntries.length === 0) return null

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Visit Breakdown</h3>
      <div className="space-y-3">
        {companyEntries.map(([key, data]) => (
          <div key={key} className="bg-white/5 rounded-xl p-3">
            <p className="text-sm font-semibold text-white mb-2">{data.company_name}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <Store className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Store Visits</p>
                  <p className="text-sm text-white font-medium">
                    <span className="text-purple-400">{data.store_today}</span>
                    <span className="text-gray-600 text-xs"> today</span>
                    {' / '}
                    <span className="text-purple-300">{data.store_month}</span>
                    <span className="text-gray-600 text-xs"> month</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Individual</p>
                  <p className="text-sm text-white font-medium">
                    <span className="text-cyan-400">{data.individual_today}</span>
                    <span className="text-gray-600 text-xs"> today</span>
                    {' / '}
                    <span className="text-cyan-300">{data.individual_month}</span>
                    <span className="text-gray-600 text-xs"> month</span>
                  </p>
                </div>
              </div>
            </div>
            {(data.other_today > 0 || data.other_month > 0) && (
              <div className="mt-1 text-xs text-gray-500">
                Other: {data.other_today} today / {data.other_month} month
              </div>
            )}
          </div>
        ))}
      </div>
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

      {/* Visit breakdown by company and type */}
      {dashData?.visit_breakdown && dashData.visit_breakdown.length > 0 && (
        <VisitBreakdownSection breakdown={dashData.visit_breakdown} companies={dashData.companies || []} />
      )}

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

      {/* Current Tier + Team summary on Overview */}
      {perfData?.current_tier && (
        <div className={'bg-gradient-to-br border rounded-2xl p-3 flex items-center gap-3 ' + tierBg(perfData.current_tier.tier_name)}>
          <Star className={'w-5 h-5 ' + tierColor(perfData.current_tier.tier_name)} />
          <div className="flex-1">
            <p className={'text-sm font-bold ' + tierColor(perfData.current_tier.tier_name)}>{perfData.current_tier.tier_name} Tier</p>
            <p className="text-[10px] text-gray-400">{perfData.current_tier.commission_rate}% rate{perfData.current_tier.bonus_amount > 0 ? ` + R${perfData.current_tier.bonus_amount.toLocaleString()} bonus` : ''}</p>
          </div>
          {perfData.team_performance && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Team</p>
              <p className={'text-sm font-bold ' + (perfData.team_performance.achievement >= 100 ? 'text-[#00E87B]' : 'text-amber-400')}>{perfData.team_performance.achievement}%</p>
            </div>
          )}
        </div>
      )}

      {/* Hierarchy Scorecard: Agent → Team Lead → Manager */}
      {(perfData?.team_performance || perfData?.manager_performance) && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Hierarchy Scores
          </h3>
          <div className="space-y-2.5">
            {/* My Score */}
            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400">My Score</p>
                <p className="text-sm font-semibold text-white">Agent</p>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold ${pctClass(overallPct)}`}>{overallPct}%</span>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${overallPct >= 100 ? 'bg-[#00E87B]' : overallPct >= 75 ? 'bg-amber-400' : 'bg-red-400'}`} />
            </div>

            {/* Team Lead Score */}
            {perfData?.team_performance && (
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400">Team Lead</p>
                  <p className="text-sm font-semibold text-white">{perfData.team_performance.team_lead_name}</p>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold ${pctClass(perfData.team_performance.achievement)}`}>{perfData.team_performance.achievement}%</span>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${perfData.team_performance.achievement >= 100 ? 'bg-[#00E87B]' : perfData.team_performance.achievement >= 75 ? 'bg-amber-400' : 'bg-red-400'}`} />
              </div>
            )}

            {/* Manager Score */}
            {perfData?.manager_performance && (
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400">Manager</p>
                  <p className="text-sm font-semibold text-white">{perfData.manager_performance.manager_name}</p>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold ${pctClass(perfData.manager_performance.achievement)}`}>{perfData.manager_performance.achievement}%</span>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${perfData.manager_performance.achievement >= 100 ? 'bg-[#00E87B]' : perfData.manager_performance.achievement >= 75 ? 'bg-amber-400' : 'bg-red-400'}`} />
              </div>
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
                  {/* Store vs Individual breakdown */}
                  {(t.store_visits != null || t.individual_visits != null) && (t.store_visits || 0) + (t.individual_visits || 0) > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {(t.store_visits || 0) > 0 && (
                        <div className="bg-purple-500/10 rounded-lg p-2">
                          <div className="flex items-center gap-1 mb-0.5">
                            <Store className="w-3 h-3 text-purple-400" />
                            <span className="text-[10px] text-purple-300 font-medium">Store</span>
                          </div>
                          <p className="text-xs text-white font-semibold">{t.store_visits} visits</p>
                        </div>
                      )}
                      {(t.individual_visits || 0) > 0 && (
                        <div className="bg-cyan-500/10 rounded-lg p-2">
                          <div className="flex items-center gap-1 mb-0.5">
                            <User className="w-3 h-3 text-cyan-400" />
                            <span className="text-[10px] text-cyan-300 font-medium">Individual</span>
                          </div>
                          <p className="text-xs text-white font-semibold">{t.individual_visits} visits</p>
                        </div>
                      )}
                    </div>
                  )}
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

function tierColor(tierName: string): string {
  const lower = tierName.toLowerCase()
  if (lower === 'platinum') return 'text-purple-300'
  if (lower === 'gold') return 'text-amber-400'
  if (lower === 'silver') return 'text-gray-300'
  return 'text-orange-400'
}

function tierBg(tierName: string): string {
  const lower = tierName.toLowerCase()
  if (lower === 'platinum') return 'from-purple-500/20 to-purple-600/10 border-purple-500/20'
  if (lower === 'gold') return 'from-amber-500/20 to-amber-600/10 border-amber-500/20'
  if (lower === 'silver') return 'from-gray-400/20 to-gray-500/10 border-gray-400/20'
  return 'from-orange-500/20 to-orange-600/10 border-orange-500/20'
}

function EarningsTab({ perfData, totalEarnings }: { perfData: PerformanceData | null; totalEarnings: number }) {
  const currentTier = perfData?.current_tier
  const tiers = perfData?.commission_tiers || []
  const rules = perfData?.commission_rules || []
  const team = perfData?.team_performance

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

      {/* Current Tier Badge */}
      {currentTier && (
        <div className={'bg-gradient-to-br border rounded-2xl p-4 flex items-center gap-4 ' + tierBg(currentTier.tier_name)}>
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Star className={'w-6 h-6 ' + tierColor(currentTier.tier_name)} />
          </div>
          <div className="flex-1">
            <p className={'text-lg font-bold ' + tierColor(currentTier.tier_name)}>{currentTier.tier_name} Tier</p>
            <p className="text-xs text-gray-400">
              {currentTier.commission_rate}% commission rate
              {currentTier.bonus_amount > 0 && ` + R${currentTier.bonus_amount.toLocaleString()} bonus`}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Achievement: {currentTier.min_achievement_pct}%{currentTier.max_achievement_pct ? ` - ${currentTier.max_achievement_pct}%` : '+'}
            </p>
          </div>
        </div>
      )}

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

      {/* Commission Tiers */}
      {tiers.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Earning Tiers
          </h3>
          <div className="space-y-2">
            {tiers.map((tier) => {
              const isCurrent = currentTier?.id === tier.id
              return (
                <div key={tier.id} className={'flex items-center justify-between p-2.5 rounded-lg ' + (isCurrent ? 'bg-white/10 border border-white/20' : 'bg-white/[0.02]')}>
                  <div className="flex items-center gap-2">
                    <Star className={'w-4 h-4 ' + tierColor(tier.tier_name)} />
                    <div>
                      <p className={'text-sm font-medium ' + (isCurrent ? 'text-white' : 'text-gray-400')}>{tier.tier_name}</p>
                      <p className="text-[10px] text-gray-600">
                        {tier.min_achievement_pct}%{tier.max_achievement_pct ? ` - ${tier.max_achievement_pct}%` : '+'} achievement
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={'text-sm font-semibold ' + (isCurrent ? 'text-[#00E87B]' : 'text-gray-400')}>{tier.commission_rate}%</p>
                    {tier.bonus_amount > 0 && <p className="text-[10px] text-amber-400">+R{tier.bonus_amount.toLocaleString()}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Team Performance */}
      {team && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Team Performance
          </h3>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{team.team_lead_name}&apos;s Team</p>
              <p className="text-xs text-gray-500">{team.member_count} members</p>
            </div>
            <div className="ml-auto text-right">
              <p className={'text-lg font-bold ' + (team.achievement >= 100 ? 'text-[#00E87B]' : team.achievement >= 75 ? 'text-amber-400' : 'text-red-400')}>{team.achievement}%</p>
              <p className="text-[10px] text-gray-500">Team Target</p>
            </div>
          </div>
          <div className="space-y-2">
            <ProgressRow label="Team Visits" actual={team.actual_visits} target={team.target_visits} color="#3B82F6" />
            <ProgressRow label="Team Registrations" actual={team.actual_registrations} target={team.target_registrations} color="#8B5CF6" />
          </div>
          <p className="text-[10px] text-gray-600 mt-2">Team targets affect your commission tier and bonus eligibility</p>
        </div>
      )}

      {/* Commission Rules */}
      {rules.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Active Commission Rules</h3>
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                <div>
                  <p className="text-sm text-white">{rule.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {rule.source_type.replace(/_/g, ' ')}
                    {rule.min_threshold > 0 && ` | Min: R${rule.min_threshold.toLocaleString()}`}
                    {rule.max_cap && ` | Cap: R${rule.max_cap.toLocaleString()}`}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[#00E87B]">{rule.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
  const [showEarnings, setShowEarnings] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [dashRes, perfRes] = await Promise.all([
          apiClient.get('/agent/dashboard').catch(() => null),
          apiClient.get('/agent/performance').catch(() => null),
        ])
        if (dashRes?.data?.success && dashRes?.data?.data) setDashData(dashRes.data.data)
        if (perfRes?.data?.success && perfRes?.data?.data) setPerfData(perfRes.data.data)
        // Check if earnings tab is enabled via web config (settings API)
        try {
          const settingsRes = await apiClient.get('/settings').catch(() => null)
          const settings = settingsRes?.data?.data || settingsRes?.data || {}
          if (settings.mobile_show_earnings === 'true' || settings.mobile_show_earnings === true) {
            setShowEarnings(true)
          }
        } catch { /* default: hide earnings */ }
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

  const dailyTargetVisits = dashData?.daily_targets?.reduce((s, t) => s + (t.target_visits || 0), 0) || 0
  const dailyActualVisits = dashData?.daily_targets?.reduce((s, t) => s + (t.actual_visits || 0), 0) || 0
  const overallPct = perfData?.overall_achievement ?? (dailyTargetVisits > 0 ? Math.round((dailyActualVisits / dailyTargetVisits) * 100) : 0)

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
          {(['overview', 'targets', ...(showEarnings ? ['earnings'] : [])] as Array<'overview' | 'targets' | 'earnings'>).map(tab => (
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
