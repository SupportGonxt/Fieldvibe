import { Activity } from 'lucide-react'

// At-a-glance good/bad strip. Each role's Home/Overview builds its own chips
// (pure, off already-loaded data) and hands them here. Worst-first ordering +
// "N good · N flagged" headline live here so every role reads the same way.
export type Tone = 'good' | 'warn' | 'bad'
export type Chip = { tone: Tone; label: string }

// Solid fills the light-mode index.css override never touches — contrast holds in both themes.
const TONE: Record<Tone, string> = {
  good: 'bg-primary text-[#052e1c]',
  warn: 'bg-amber-400 text-amber-950',
  bad: 'bg-red-500 text-white',
}
const toneRank = (t: Tone) => (t === 'bad' ? 0 : t === 'warn' ? 1 : 2)

export function PulseBar({ chips, title = 'Pulse' }: { chips: Chip[]; title?: string }) {
  if (!chips.length) return null
  const sorted = [...chips].sort((a, b) => toneRank(a.tone) - toneRank(b.tone))
  const good = chips.filter((c) => c.tone === 'good').length
  const attn = chips.length - good
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="text-xs text-gray-500 ml-auto tabular-nums">
          {good > 0 ? `${good} good` : ''}{good > 0 && attn > 0 ? ' · ' : ''}{attn > 0 ? `${attn} flagged` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {sorted.map((c, i) => (
          <span key={i} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${TONE[c.tone]}`}>{c.label}</span>
        ))}
      </div>
    </div>
  )
}
