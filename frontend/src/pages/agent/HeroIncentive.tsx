import React, { useEffect, useState } from 'react'
import { Flame, Trophy, TrendingUp, Award } from 'lucide-react'
import { fieldOperationsService } from '../../services/field-operations.service'

interface Hero {
  period: string
  today: number
  week: number
  month: number
  converted: number
  deposits: number
  provisionalSignups: number   // avg signups/day
  provisionalDeposits: number  // avg deposits/day
  provisionalPace: number      // R on track at current pace
  payable: number              // R already qualified (no clawback)
  nextTier: { amount: number; targets: Record<string, number>; shortfall: Record<string, number> } | null
  toNextSignups: number | null // avg/day signup gap to next tier
  toNextDeposits: number | null // avg/day deposit gap to next tier
  rank: number | null
  totalPeers: number | null
  tiers?: { signups: number; deposits: number; amount: number }[]
}

const rand = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n || 0)

// Adaptive coaching — both tier gates (signups/day AND deposits/day) must be met.
function coach(h: Hero): { push: string; sub: string; hot: boolean } {
  if (h.nextTier) {
    const gs = Math.round((h.toNextSignups ?? 0) * 10) / 10
    const gd = Math.round((h.toNextDeposits ?? 0) * 10) / 10
    const parts = []
    if (gs > 0) parts.push(`+${gs} signups/day`)
    if (gd > 0) parts.push(`+${gd} deposits/day`)
    return {
      push: parts.length ? `${parts.join(' · ')} for ${rand(h.nextTier.amount)}` : `On the edge of ${rand(h.nextTier.amount)} — keep going.`,
      sub: h.provisionalPace > 0 ? "Don't stop now — push past this tier." : `Lift your daily average to unlock ${rand(h.nextTier.amount)}.`,
      hot: Math.max(gs, gd) <= 2, // within striking distance
    }
  }
  // top tier reached
  return {
    push: h.rank === 1 ? "You're #1 — defend it." : 'Top tier locked. Hold the pace.',
    sub: h.rank && h.rank > 1 ? `Close the gap to #1.` : "Don't ease off — every signup counts.",
    hot: true,
  }
}

// Goldrush hero card — pace, rank and next-tier gap. Fast-glance motivation for the fast-entry PWA.
export default function HeroIncentive({ companyId, team }: { companyId?: string; team?: boolean }) {
  const [hero, setHero] = useState<Hero | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true
    fieldOperationsService.getHero(companyId)
      .then((res: any) => { if (mounted) setHero(res?.hero || res) })
      .catch(() => { if (mounted) setError(true) })
    return () => { mounted = false }
  }, [companyId])

  if (error) return null
  if (!hero) {
    return (
      <div className="px-5 mb-4">
        <div className="bg-gradient-to-br from-[#0A1628] to-[#0E1D35] border border-white/10 rounded-2xl p-4 h-40 animate-pulse" />
      </div>
    )
  }

  const paceColor = hero.provisionalPace > 0 ? 'text-primary' : 'text-gray-400'
  const c = coach(hero)

  return (
    <div className="px-5 mb-4">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0A1628] to-[#0E1D35] border border-primary/20 rounded-2xl p-4">
        {/* rank badge */}
        {hero.rank != null && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1">
            <Trophy className={`w-3.5 h-3.5 ${hero.rank <= 3 ? 'text-amber-400' : 'text-gray-500'}`} />
            <span className="text-xs font-bold text-white">#{hero.rank}</span>
            {hero.totalPeers ? <span className="text-[10px] text-gray-500">/ {hero.totalPeers}</span> : null}
          </div>
        )}

        {/* pace headline */}
        <div className="flex items-center gap-2 mb-1">
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{team ? 'Team On Track This Month' : 'On Track This Month'}</span>
        </div>
        <p className={`text-3xl font-extrabold ${paceColor}`}>{rand(hero.provisionalPace)}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {hero.provisionalSignups}/day signups · {hero.provisionalDeposits}/day deposits{team ? ' (team avg)' : ''}
        </p>

        {/* coaching push — always prompts the agent to do better */}
        <div className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 border ${c.hot ? 'bg-orange-500/10 border-orange-500/30' : 'bg-primary/10 border-primary/20'}`}>
          {c.hot ? <Flame className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" /> : <TrendingUp className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />}
          <div>
            <p className={`text-sm font-bold ${c.hot ? 'text-orange-300' : 'text-primary'}`}>{c.push}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        </div>

        {/* qualified payable (already locked in) */}
        {hero.payable > 0 && (
          <div className="mt-2 flex items-center gap-2 px-1">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-xs text-gray-400">
              <span className="font-bold text-amber-400">{rand(hero.payable)}</span> qualified
            </p>
          </div>
        )}

        {/* criteria ladder — every role sees every gate, achieved rows lit */}
        {hero.tiers && hero.tiers.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Incentive Criteria (avg/day)</p>
            <div className="space-y-1">
              {hero.tiers.map((t) => {
                const hit = hero.provisionalSignups >= t.signups && hero.provisionalDeposits >= t.deposits
                const next = !hit && hero.nextTier?.amount === t.amount
                return (
                  <div
                    key={t.amount}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border text-xs ${
                      hit
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : next
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-white/[0.03] border-white/10 text-gray-500'
                    }`}
                  >
                    <span>{t.signups} signups + {t.deposits} deposits</span>
                    <span className="font-bold">{rand(t.amount)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* today / week counters */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-white/5 rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase">Today</p>
            <p className="text-lg font-bold text-white">{hero.today}</p>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase">This Week</p>
            <p className="text-lg font-bold text-white">{hero.week}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
