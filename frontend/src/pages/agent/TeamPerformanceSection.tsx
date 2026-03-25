import React, { memo } from 'react'
import { Users } from 'lucide-react'

interface TeamPerformance {
  team_lead_name: string
  member_count: number
  total_visits: number
  total_registrations: number
  target_visits: number
  actual_visits: number
  target_registrations: number
  actual_registrations: number
  achievement: number
}

interface TeamPerformanceSectionProps {
  teamPerformance: TeamPerformance
}

const TeamPerformanceSection = memo(({ teamPerformance }: TeamPerformanceSectionProps) => {
  return (
    <div className="px-5 mb-4">
      <div className="bg-gradient-to-r from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-300 uppercase">Team Performance</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-white">
            <span className="font-semibold">{teamPerformance.team_lead_name}</span>
            <span className="text-gray-400"> • {teamPerformance.member_count} members</span>
          </p>
          <span className={`text-sm font-bold ${teamPerformance.achievement >= 100 ? 'text-[#00E87B]' : teamPerformance.achievement >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
            {teamPerformance.achievement}%
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 uppercase">Visits</p>
            <p className="text-sm font-bold text-white">{teamPerformance.actual_visits}<span className="text-gray-500">/{teamPerformance.target_visits}</span></p>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 uppercase">Regs</p>
            <p className="text-sm font-bold text-white">{teamPerformance.actual_registrations}<span className="text-gray-500">/{teamPerformance.target_registrations}</span></p>
          </div>
        </div>
      </div>
    </div>
  )
})

TeamPerformanceSection.displayName = 'TeamPerformanceSection'

export default TeamPerformanceSection
