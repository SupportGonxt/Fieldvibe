import React, { memo } from 'react'
import { ChevronRight, BarChart3, DollarSign, Flame, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface PerfSummary {
  overall_achievement: number
  streak: number
  commission_summary: {
    pending: number
    approved: number
    paid: number
  }
}

interface PerformanceSectionProps {
  perfSummary: PerfSummary
}

const PerformanceSection = memo(({ perfSummary }: PerformanceSectionProps) => {
  const navigate = useNavigate()

  return (
    <div className="px-5 mb-4">
      <button
        onClick={() => navigate('/agent/stats')}
        className="w-full bg-gradient-to-r from-[#0A1628] to-[#0E1D35] border border-white/10 rounded-2xl p-4 active:bg-white/5 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#00E87B]" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Performance</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="relative w-10 h-10 mx-auto mb-1">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                <circle cx="20" cy="20" r="16" fill="none" stroke="#00E87B" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={Math.min(perfSummary.overall_achievement, 100) * 1.005 + ' 100.5'} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{perfSummary.overall_achievement}%</span>
              </div>
            </div>
            <p className="text-[9px] text-gray-500">Target</p>
          </div>
          <div className="text-center">
            <DollarSign className="w-5 h-5 text-amber-400 mx-auto mb-0.5" />
            <p className="text-sm font-bold text-white">R{((perfSummary.commission_summary?.paid || 0) + (perfSummary.commission_summary?.approved || 0) + (perfSummary.commission_summary?.pending || 0)).toLocaleString()}</p>
            <p className="text-[9px] text-gray-500">Earnings</p>
          </div>
          <div className="text-center">
            <Flame className={'w-5 h-5 mx-auto mb-0.5 ' + (perfSummary.streak > 0 ? 'text-orange-400' : 'text-gray-600')} />
            <p className="text-sm font-bold text-white">{perfSummary.streak}</p>
            <p className="text-[9px] text-gray-500">Day Streak</p>
          </div>
        </div>
      </button>
    </div>
  )
})

PerformanceSection.displayName = 'PerformanceSection'

export default PerformanceSection
