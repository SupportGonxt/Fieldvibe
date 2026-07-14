import React, { useEffect, useState } from 'react'
import { Medal } from 'lucide-react'
import { fieldOperationsService } from '../../services/field-operations.service'

interface Row {
  rank: number
  id: string
  name: string
  signups: number
  converted: number
}

// Goldrush team leaderboard — top agents by period signups. Self row highlighted.
export default function Leaderboard({ meId }: { meId?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true
    fieldOperationsService.getLeaderboard({ limit: 10 })
      .then((res: any) => { if (mounted) setRows(res?.leaderboard || []) })
      .catch(() => { if (mounted) setError(true) })
    return () => { mounted = false }
  }, [])

  if (error) return null
  if (!rows) {
    return (
      <div className="px-5 mb-4">
        <div className="bg-gradient-to-br from-surface to-[#0E1D35] border border-white/10 rounded-2xl p-4 h-40 animate-pulse" />
      </div>
    )
  }
  if (rows.length === 0) return null

  const medal = (rank: number) =>
    rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-orange-400' : ''

  return (
    <div className="px-5 mb-4">
      <div className="bg-gradient-to-br from-surface to-[#0E1D35] border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Medal className="w-4 h-4 text-amber-400" />
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Team Leaderboard</span>
        </div>
        <div className="space-y-1">
          {rows.map((r) => {
            const isMe = meId && r.id === meId
            return (
              <div
                key={r.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isMe ? 'bg-primary/10 border border-primary/30' : 'bg-white/[0.03]'}`}
              >
                <span className={`w-6 text-sm font-bold tabular-nums ${medal(r.rank) || 'text-gray-500'}`}>
                  {r.rank}
                </span>
                <span className={`flex-1 text-sm truncate ${isMe ? 'text-white font-semibold' : 'text-gray-300'}`}>
                  {r.name}{isMe ? ' (you)' : ''}
                </span>
                <span className="text-sm font-bold text-white tabular-nums">{r.signups}</span>
                <span className="text-[11px] text-gray-500 w-14 text-right">{r.converted} conv</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
