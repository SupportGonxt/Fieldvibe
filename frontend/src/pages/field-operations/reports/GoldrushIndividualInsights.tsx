import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../../../services/api.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import DateRangePresets from '../../../components/ui/DateRangePresets'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Download, FileDown, Users, CheckCircle2, BadgeCheck, MessageSquareText, RefreshCw, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { buildInsightsPDF } from '../../../utils/insights-pdf'
import { captureCharts } from '../../../utils/capture-chart'

interface YesNoBucket { key: string; yes: number; no: number; other: number }
interface Insights {
  filters: { startDate: string | null; endDate: string | null }
  totals: { individuals: number; converted: number; with_id: number; with_suggestion: number; conversion_rate: number }
  visitsOverTime: Array<{ date: string; visits: number; conversions: number }>
  topAgents: Array<{ agent: string; visits: number; conversions: number; conversion_rate: number }>
  satisfaction: Record<string, YesNoBucket>
  competitors: Array<{ name: string; count: number }>
  productInterest: Array<{ name: string; count: number }>
  suggestionsTop: Array<{ visit_id: string; agent: string; suggestion: string }>
  geo: { with_gps: number; lat_min?: number; lat_max?: number; lng_min?: number; lng_max?: number }
}

const SAT_LABELS: Record<string, string> = {
  likes_goldrush: 'Likes Goldrush',
  used_goldrush_before: 'Used Goldrush before',
  betting_elsewhere: 'Bets elsewhere',
  goldrush_comparison: 'Prefers Goldrush vs competitor',
  gave_brand_info: 'Was given brand info',
  is_the_customer_interested: 'Customer interested',
}

const ACCENT = '#0ea5e9'
const ACCENT_2 = '#10b981'

export default function GoldrushIndividualInsights() {
  const [data, setData] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pdfWorking, setPdfWorking] = useState(false)
  const visitsOverTimeRef = useRef<HTMLDivElement>(null)
  const competitorsRef    = useRef<HTMLDivElement>(null)
  const productInterestRef= useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (startDate) params.startDate = startDate
      if (endDate)   params.endDate   = endDate
      const res = await apiClient.get('/field-ops/reports/goldrush-individuals/insights', { params })
      setData(res.data?.data || null)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [startDate, endDate])

  const exportCSV = () => {
    if (!data) return
    const lines: string[] = []
    const push = (...cells: any[]) => lines.push(cells.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    push('Goldrush Individuals Insights')
    push('Period', data.filters.startDate || 'all', 'to', data.filters.endDate || 'all')
    push('')
    push('--- TOTALS ---')
    push('Individuals visited', data.totals.individuals)
    push('Converted', data.totals.converted)
    push('Conversion rate (%)', data.totals.conversion_rate)
    push('With Goldrush ID', data.totals.with_id)
    push('Left a suggestion', data.totals.with_suggestion)
    push('')
    push('--- VISITS BY DAY ---')
    push('Date', 'Visits', 'Conversions')
    data.visitsOverTime.forEach(r => push(r.date, r.visits, r.conversions))
    push('')
    push('--- TOP AGENTS ---')
    push('Agent', 'Visits', 'Conversions', 'Conversion %')
    data.topAgents.forEach(a => push(a.agent, a.visits, a.conversions, a.conversion_rate))
    push('')
    push('--- SATISFACTION SIGNALS ---')
    push('Question', 'Yes', 'No', 'Other')
    Object.entries(data.satisfaction).forEach(([k, v]) => push(SAT_LABELS[k] || k, v.yes, v.no, v.other))
    push('')
    push('--- COMPETITORS MENTIONED ---')
    data.competitors.forEach(c => push(c.name, c.count))
    push('')
    push('--- PRODUCT INTEREST ---')
    data.productInterest.forEach(p => push(p.name, p.count))
    push('')
    push('--- TOP SUGGESTIONS (sample) ---')
    push('Agent', 'Suggestion')
    data.suggestionsTop.forEach(s => push(s.agent, s.suggestion))
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `goldrush-individuals-insights-${data.filters.startDate || 'all'}-${data.filters.endDate || 'all'}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const downloadPDF = async () => {
    if (!data || pdfWorking) return
    setPdfWorking(true)
    let charts: Record<string, string | null> = {}
    try {
      charts = await captureCharts([
        { key: 'visits',     el: visitsOverTimeRef.current },
        { key: 'competitors',el: competitorsRef.current },
        { key: 'products',   el: productInterestRef.current },
      ])
    } catch {
      // chart capture is best-effort
    }
    const period = `${data.filters.startDate || 'all time'} → ${data.filters.endDate || 'today'}`
    const sections: Parameters<typeof buildInsightsPDF>[0]['sections'] = []

    sections.push({ kind: 'kv', title: 'Headline numbers', rows: [
      ['Individuals visited',     data.totals.individuals],
      ['Converted',               data.totals.converted],
      ['Conversion rate',         `${data.totals.conversion_rate.toFixed(1)}%`],
      ['Customers with Goldrush ID', data.totals.with_id],
      ['Left a suggestion',       data.totals.with_suggestion],
    ]})

    if (charts.visits) {
      sections.push({ kind: 'image', title: 'Visits and conversions over time', dataUrl: charts.visits })
    }
    if (data.visitsOverTime.length) {
      sections.push({
        kind: 'table',
        title: 'Visits and conversions by day',
        head: ['Date', 'Visits', 'Conversions', 'Conv %'],
        rows: data.visitsOverTime.map(r => [
          r.date,
          r.visits,
          r.conversions,
          r.visits ? `${((r.conversions / r.visits) * 100).toFixed(1)}%` : '0.0%',
        ]),
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      })
    }

    if (Object.keys(data.satisfaction).length) {
      sections.push({
        kind: 'table',
        title: 'Satisfaction signals',
        head: ['Question', 'Yes', 'No', 'Other'],
        rows: Object.entries(data.satisfaction).map(([k, v]) => [SAT_LABELS[k] || k, v.yes, v.no, v.other]),
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      })
    }

    if (data.topAgents.length) {
      sections.push({
        kind: 'table',
        title: 'Top agents',
        head: ['Agent', 'Visits', 'Conversions', 'Conv %'],
        rows: data.topAgents.map(a => [a.agent, a.visits, a.conversions, `${a.conversion_rate.toFixed(1)}%`]),
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      })
    }

    if (charts.competitors) {
      sections.push({ kind: 'image', title: 'Competitors mentioned', dataUrl: charts.competitors })
    }
    if (data.competitors.length) {
      sections.push({
        kind: 'table',
        title: 'Competitors mentioned',
        head: ['Competitor', 'Mentions'],
        rows: data.competitors.map(c => [c.name, c.count]),
        columnStyles: { 1: { halign: 'right' } },
      })
    }

    if (charts.products) {
      sections.push({ kind: 'image', title: 'Product interest', dataUrl: charts.products })
    }
    if (data.productInterest.length) {
      sections.push({
        kind: 'table',
        title: 'Product interest',
        head: ['Product', 'Mentions'],
        rows: data.productInterest.map(p => [p.name, p.count]),
        columnStyles: { 1: { halign: 'right' } },
      })
    }

    if (data.suggestionsTop.length) {
      sections.push({
        kind: 'table',
        title: 'Customer suggestions (sample)',
        head: ['Agent', 'Suggestion'],
        rows: data.suggestionsTop.map(s => [s.agent || '—', s.suggestion]),
        columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 380 } },
      })
    }

    buildInsightsPDF({
      title: 'Goldrush — Individuals Insights',
      subtitle: 'Consumer engagement & conversion report',
      filename: `goldrush-individuals-insights-${data.filters.startDate || 'all'}-${data.filters.endDate || 'today'}.pdf`,
      meta: [
        ['Period',       period],
        ['Generated',    new Date().toLocaleString()],
      ],
      sections,
      footer: 'FieldVibe — Goldrush insights — confidential',
    })
    toast.success('PDF downloaded')
    setPdfWorking(false)
  }
  const printPDF = () => window.print()

  const satisfactionRows = useMemo(() => Object.entries(data?.satisfaction || {}).map(([k, v]) => ({ label: SAT_LABELS[k] || k, ...v })), [data])

  if (loading && !data) return <div className="p-12 flex justify-center"><LoadingSpinner /></div>
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>
  if (!data) return null

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goldrush — Individuals Insights</h1>
          <p className="text-sm text-gray-500 mt-1">Conversion, satisfaction signals and competitor share for direct-to-consumer visits.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={load} className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 inline-flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={exportCSV} className="px-3 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 inline-flex items-center gap-1"><Download className="w-4 h-4" /> CSV</button>
          <button onClick={downloadPDF} disabled={pdfWorking} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"><FileDown className="w-4 h-4" /> {pdfWorking ? 'Building…' : 'PDF'}</button>
          <button onClick={printPDF} title="Open the browser print dialog instead of downloading a PDF" className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 inline-flex items-center gap-1">Print</button>
          <Link to="/field-operations/reports/goldrush-individuals" className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 inline-flex items-center gap-1"><ExternalLink className="w-4 h-4" /> Open detail report</Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-4 print:hidden">
        <DateRangePresets startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
        <div className="text-xs text-gray-500 ml-auto">
          {data.filters.startDate ? `From ${data.filters.startDate}` : 'All time'}
          {data.filters.endDate ? ` to ${data.filters.endDate}` : ''}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Tile icon={<Users className="w-5 h-5" />} label="Individuals visited" value={data.totals.individuals.toLocaleString()} tone="bg-blue-50 text-blue-800" />
        <Tile icon={<CheckCircle2 className="w-5 h-5" />} label="Converted" value={data.totals.converted.toLocaleString()} tone="bg-green-50 text-green-800" />
        <Tile icon={<CheckCircle2 className="w-5 h-5" />} label="Conversion rate" value={`${data.totals.conversion_rate.toFixed(1)}%`} tone="bg-emerald-50 text-emerald-800" />
        <Tile icon={<BadgeCheck className="w-5 h-5" />} label="With Goldrush ID" value={data.totals.with_id.toLocaleString()} tone="bg-amber-50 text-amber-800" />
        <Tile icon={<MessageSquareText className="w-5 h-5" />} label="Left a suggestion" value={data.totals.with_suggestion.toLocaleString()} tone="bg-purple-50 text-purple-800" />
      </div>

      {/* Visits over time */}
      <Card title="Visits & conversions over time" subtitle="Daily volume + conversions by date">
        {data.visitsOverTime.length === 0 ? <Empty msg="No visits in this period." /> : (
          <div ref={visitsOverTimeRef}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.visitsOverTime} margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="visits" stroke={ACCENT} strokeWidth={2} dot={false} name="Visits" />
              <Line type="monotone" dataKey="conversions" stroke={ACCENT_2} strokeWidth={2} dot={false} name="Conversions" />
            </LineChart>
          </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Satisfaction signals */}
      <Card title="Satisfaction signals" subtitle="Yes/no/other per question, all individuals in period">
        {satisfactionRows.length === 0 ? <Empty msg="No survey responses captured." /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {satisfactionRows.map(row => (
              <div key={row.key} className="bg-gray-50 rounded-md p-3">
                <div className="text-sm font-medium text-gray-800 mb-2">{row.label}</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-green-100 rounded p-2"><div className="text-xs text-green-800">Yes</div><div className="text-xl font-bold text-green-900">{row.yes}</div></div>
                  <div className="bg-red-100 rounded p-2"><div className="text-xs text-red-800">No</div><div className="text-xl font-bold text-red-900">{row.no}</div></div>
                  <div className="bg-gray-200 rounded p-2"><div className="text-xs text-gray-700">Other</div><div className="text-xl font-bold text-gray-800">{row.other}</div></div>
                </div>
                {(row.yes + row.no) > 0 && (
                  <div className="mt-2 h-1.5 bg-gray-200 rounded">
                    <div className="h-full bg-green-500 rounded" style={{ width: `${(row.yes / (row.yes + row.no)) * 100}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Two-column: competitors + product interest */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Competitors mentioned" subtitle="From customer answers (top 20)">
          {data.competitors.length === 0 ? <Empty msg="No competitor mentions." /> : (
            <div ref={competitorsRef}>
            <ResponsiveContainer width="100%" height={Math.max(220, data.competitors.length * 22)}>
              <BarChart data={data.competitors} layout="vertical" margin={{ top: 4, right: 16, left: 60, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={140} />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Product interest" subtitle="Top items from 'which products interest you'">
          {data.productInterest.length === 0 ? <Empty msg="No product interest captured." /> : (
            <div ref={productInterestRef}>
            <ResponsiveContainer width="100%" height={Math.max(220, data.productInterest.length * 22)}>
              <BarChart data={data.productInterest} layout="vertical" margin={{ top: 4, right: 16, left: 60, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={140} />
                <Tooltip />
                <Bar dataKey="count" fill={ACCENT} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Top agents table */}
      <Card title="Top agents" subtitle="Visits + conversion rate, top 15">
        {data.topAgents.length === 0 ? <Empty msg="No agents to rank." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Agent</Th><Th>Visits</Th><Th>Conversions</Th><Th>Conversion %</Th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data.topAgents.map((a, i) => (
                  <tr key={a.agent + i}>
                    <Td className="font-medium">{a.agent}</Td>
                    <Td>{a.visits.toLocaleString()}</Td>
                    <Td>{a.conversions.toLocaleString()}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        {a.conversion_rate.toFixed(1)}%
                        <span className="block w-24 h-1.5 bg-gray-200 rounded">
                          <span className="block h-full bg-green-500 rounded" style={{ width: `${Math.min(100, a.conversion_rate)}%` }} />
                        </span>
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Suggestions sample */}
      <Card title="Customer suggestions" subtitle={`${data.totals.with_suggestion} customers left feedback. Sample below.`}>
        {data.suggestionsTop.length === 0 ? <Empty msg="No suggestions captured." /> : (
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {data.suggestionsTop.map((s, i) => (
              <li key={i} className="border-l-4 border-blue-400 bg-blue-50 px-3 py-2 rounded text-sm text-gray-800">
                <span className="text-gray-500 text-xs block mb-0.5">{s.agent}</span>
                {s.suggestion}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Geo summary */}
      <Card title="Geographic spread" subtitle={`${data.geo.with_gps} of ${data.totals.individuals} visits had GPS captured`}>
        {data.geo.with_gps === 0 ? <Empty msg="No GPS coordinates captured." /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Min latitude" value={data.geo.lat_min?.toFixed(4)} />
            <Stat label="Max latitude" value={data.geo.lat_max?.toFixed(4)} />
            <Stat label="Min longitude" value={data.geo.lng_min?.toFixed(4)} />
            <Stat label="Max longitude" value={data.geo.lng_max?.toFixed(4)} />
          </div>
        )}
      </Card>
    </div>
  )
}

function Tile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-lg p-4 ${tone}`}>
      <div className="flex items-center gap-2 text-sm font-medium opacity-80">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  )
}
function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
function Empty({ msg }: { msg: string }) { return <div className="text-sm text-gray-500 py-6 text-center">{msg}</div> }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{children}</th> }
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <td className={`px-4 py-3 text-sm text-gray-700 ${className}`}>{children}</td> }
function Stat({ label, value }: { label: string; value: any }) {
  return <div className="bg-gray-50 rounded p-2"><div className="text-xs text-gray-500">{label}</div><div className="text-lg font-semibold text-gray-900">{value ?? '—'}</div></div>
}
