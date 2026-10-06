import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import DateRangePresets from '../../../components/ui/DateRangePresets'
import { AlertTriangle, ShieldAlert, RefreshCw } from 'lucide-react'

// AI Check — Goldrush screenshot fraud statistics (GM + admins only).
// Definite fakes are excluded from every other report; they are counted only here.

type Verdict = 'definite' | 'likely' | 'review' | 'unverifiable' | 'not_profile' | 'pass'

interface Tally {
  key: string
  total: number
  definite: number
  likely: number
  review: number
  unverifiable: number
  not_profile: number
  pass: number
  counted: number
  flagged_pct: number
}

interface Summary {
  period: { start: string; end: string }
  totals: Tally
  by_agent: Tally[]
  by_month: Tally[]
  flag_counts: Record<string, number>
  precheck_attempts: { agent_id: string; agent_name: string | null; n: number }[]
  recent: {
    visit_id: string
    visit_date: string
    agent: string
    verdict: Verdict
    goldrush_id: string | null
    reasons: string
    source: string
    photo_url: string | null
  }[]
}

const SEGMENTS: { key: Verdict; label: string; color: string }[] = [
  { key: 'definite', label: 'Definite fake (excluded)', color: '#9B1C1C' },
  { key: 'likely', label: 'Likely AI / edited', color: '#E8590C' },
  { key: 'review', label: 'Review', color: '#3E6FB0' },
  { key: 'pass', label: 'Matches golden', color: '#2B8A5E' },
  { key: 'unverifiable', label: 'Unverifiable (crop / photo)', color: '#8A9099' },
  { key: 'not_profile', label: 'Not a Goldrush profile', color: '#B9BEC5' },
]

const FLAG_LABELS: Record<string, string> = {
  REUSED_STATUS_BAR: 'Frozen phone status bar (reused template)',
  GREEN_THEME: 'Green page — no such Goldrush theme',
  FUTURE_ID: 'Goldrush ID not issued yet (shown in photo)',
  PLACEHOLDER_TEXT: 'Placeholder text in name',
  FONT_MISMATCH: 'Font does not match golden (3+ checks)',
  THEME_COLOUR: 'Navy/black page + font deviation',
  GLYPH_ARTIFACT: 'AI glyph artifact in name',
  FONT_DEVIATION: 'Font deviation (2 checks)',
  ID_MISMATCH: 'Screenshot ID differs from typed ID',
  DUPLICATE_ID: 'Goldrush ID used more than once',
  FUTURE_ID_ENTERED: 'Typed ID beyond issued range (typo?)',
}

const Bar: React.FC<{ t: Tally }> = ({ t }) => (
  <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800" role="img" aria-label="verdict mix">
    {SEGMENTS.map(s => (t[s.key] > 0 ? (
      <span key={s.key} title={`${s.label}: ${t[s.key]}`} style={{ width: `${(100 * t[s.key]) / Math.max(t.total, 1)}%`, background: s.color }} />
    ) : null))}
  </div>
)

const TallyTable: React.FC<{ rows: Tally[]; label: string }> = ({ rows, label }) => (
  <div className="overflow-x-auto">
    <table className="min-w-[760px] w-full text-sm">
      <thead>
        <tr className="border-b-2 border-gray-800 text-left text-xs text-gray-500 dark:border-gray-300 dark:text-gray-400">
          <th className="py-2 pr-2">{label}</th>
          <th className="px-2 text-right">Check-ins</th>
          <th className="px-2 text-right">Definite</th>
          <th className="px-2 text-right">Likely AI</th>
          <th className="px-2 text-right">Review</th>
          <th className="px-2 text-right">Match</th>
          <th className="px-2 text-right">Unverif.</th>
          <th className="px-2 text-right">Counted</th>
          <th className="px-2 text-right">Flagged %</th>
          <th className="w-40 pl-2"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.key} className="border-b border-gray-100 dark:border-gray-800">
            <td className="py-1.5 pr-2 text-gray-900 dark:text-gray-100">{r.key}</td>
            <td className="px-2 text-right tabular-nums">{r.total}</td>
            <td className="px-2 text-right tabular-nums text-red-700 dark:text-red-400">{r.definite || ''}</td>
            <td className="px-2 text-right tabular-nums text-orange-600 dark:text-orange-400">{r.likely || ''}</td>
            <td className="px-2 text-right tabular-nums">{r.review || ''}</td>
            <td className="px-2 text-right tabular-nums">{r.pass || ''}</td>
            <td className="px-2 text-right tabular-nums">{(r.unverifiable + r.not_profile) || ''}</td>
            <td className="px-2 text-right tabular-nums">{r.counted}</td>
            <td className="px-2 text-right font-semibold tabular-nums">{r.flagged_pct.toFixed(1)}%</td>
            <td className="pl-2"><Bar t={r} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const AiCheckPage: React.FC = () => {
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lightbox, setLightbox] = useState<string | null>(null)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['ai-check-summary', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/ai-check/summary?start=${startDate}&end=${endDate}`)
      return res.data as Summary
    },
    staleTime: 60000,
  })

  if (isLoading) return <LoadingSpinner />
  if (isError || !data) return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-red-400" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Could not load AI Check statistics. Try again, or check you are signed in as a GM or admin.</p>
    </div>
  )

  const t = data.totals
  const pct = (n: number) => (t.total ? `${((100 * n) / t.total).toFixed(1)}%` : '0%')
  const tiles = [
    { label: 'Definite fakes — excluded from totals', value: t.definite, sub: pct(t.definite), color: '#9B1C1C' },
    { label: 'Likely AI-generated / edited', value: t.likely, sub: pct(t.likely), color: '#E8590C' },
    { label: 'Need review', value: t.review, sub: pct(t.review), color: '#3E6FB0' },
    { label: 'Match the golden image', value: t.pass, sub: pct(t.pass), color: '#2B8A5E' },
    { label: 'Unverifiable / not a profile', value: t.unverifiable + t.not_profile, sub: pct(t.unverifiable + t.not_profile), color: '#8A9099' },
    { label: 'Check-ins counted in reports', value: t.counted, sub: `of ${t.total} captured`, color: '#1F2937' },
  ]
  const flagRows = Object.entries(data.flag_counts).sort((a, b) => b[1] - a[1])

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <ShieldAlert className="h-6 w-6 text-red-700" /> AI Check
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Every Goldrush check-in screenshot is compared with the golden Goldrush profile page when it is uploaded.
            Definite fakes are flagged, the agent is told, and the check-in is removed from all other report totals.
            They are counted only on this page.
          </p>
        </div>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 dark:border-gray-600 dark:hover:bg-gray-800">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <DateRangePresets startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(k => (
          <div key={k.label} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" style={{ borderLeft: `5px solid ${k.color}` }}>
            <div className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{k.value.toLocaleString()}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{k.label} · {k.sub}</div>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Statistics by agent</h2>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          {SEGMENTS.map(s => <span key={s.key} className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>)}
        </div>
        <TallyTable rows={data.by_agent} label="Agent" />
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Flagged % = (Definite + Likely AI) ÷ check-ins. Counted = check-ins still included in reports (all except definite fakes).</p>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">By month</h2>
        <TallyTable rows={data.by_month} label="Month" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">What was detected</h2>
          {flagRows.length === 0 ? <p className="text-sm text-gray-500">Nothing flagged in this period.</p> : (
            <table className="w-full text-sm">
              <tbody>
                {flagRows.map(([code, n]) => (
                  <tr key={code} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-1.5 pr-2">{FLAG_LABELS[code] || code}</td>
                    <td className="text-right tabular-nums">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="min-w-0 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Fake photos caught before submit</h2>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">The agent saw the warning while capturing. Counted per attempt.</p>
          {data.precheck_attempts.length === 0 ? <p className="text-sm text-gray-500">None in this period.</p> : (
            <table className="w-full text-sm">
              <tbody>
                {data.precheck_attempts.map(a => (
                  <tr key={a.agent_id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-1.5 pr-2">{a.agent_name || a.agent_id}</td>
                    <td className="text-right tabular-nums">{a.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Latest flagged check-ins</h2>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-800 text-left text-xs text-gray-500 dark:border-gray-300 dark:text-gray-400">
                <th className="py-2 pr-2">Photo</th><th className="px-2">Date</th><th className="px-2">Agent</th><th className="px-2">Goldrush ID</th><th className="px-2">Verdict</th><th className="px-2">Why</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map(r => (
                <tr key={r.visit_id} className="border-b border-gray-100 align-top dark:border-gray-800">
                  <td className="py-1.5 pr-2">
                    {r.photo_url ? (
                      <button onClick={() => setLightbox(r.photo_url)} className="block focus-visible:outline focus-visible:outline-2" aria-label="Open photo">
                        <img src={r.photo_url} alt="" loading="lazy" className="h-16 w-9 rounded border border-gray-200 object-cover object-top dark:border-gray-700" />
                      </button>
                    ) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 tabular-nums">{r.visit_date}</td>
                  <td className="px-2">{r.agent}</td>
                  <td className="px-2 tabular-nums">{r.goldrush_id || '—'}</td>
                  <td className={`px-2 font-semibold ${r.verdict === 'definite' ? 'text-red-700 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>{r.verdict === 'definite' ? 'Definite' : 'Likely AI'}</td>
                  <td className="px-2 text-xs text-gray-600 dark:text-gray-300">{r.reasons}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)} role="dialog" aria-label="Photo">
          <img src={lightbox} alt="Check-in screenshot" className="max-h-full max-w-full rounded" />
        </div>
      )}
    </div>
  )
}

export default AiCheckPage
