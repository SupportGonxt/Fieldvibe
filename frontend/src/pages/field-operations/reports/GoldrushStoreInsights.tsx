import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../../../services/api.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import DateRangePresets from '../../../components/ui/DateRangePresets'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts'
import { Download, FileDown, Store, Image as ImageIcon, ShieldCheck, AlertTriangle, RefreshCw, ExternalLink, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { buildInsightsPDF } from '../../../utils/insights-pdf'
import { captureCharts } from '../../../utils/capture-chart'

interface YesNoBucket { key: string; yes: number; no: number; other: number }
interface StoreInsights {
  filters: { startDate: string | null; endDate: string | null }
  totals: {
    stores_visited: number
    unique_stores: number
    with_photos: number
    with_ai_completed: number
    with_ai_failed: number
    with_stock: number
    with_advertising: number
    board_installed: number
    with_competitors: number
  }
  visitsOverTime: Array<{ date: string; visits: number }>
  stocksProduct: YesNoBucket
  hasAdvertising: YesNoBucket
  competitorsInStore: YesNoBucket
  boardInstalled: YesNoBucket
  competitors: Array<{ name: string; count: number }>
  stockSources: Array<{ name: string; count: number }>
  adBrands: Array<{ name: string; count: number }>
  aiBrandsDetected: Array<{ name: string; count: number }>
  shareOfVoice: Array<{ date: string; avg_share_of_voice: number; max_share_of_voice: number }>
  compliance: Array<{ date: string; avg_compliance: number }>
  topStores: Array<{ name: string; visits: number }>
}

const ACCENT = '#0ea5e9'
const GREEN  = '#10b981'
const ORANGE = '#f59e0b'
const RED    = '#ef4444'

export default function GoldrushStoreInsights() {
  const [data, setData] = useState<StoreInsights | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pdfWorking, setPdfWorking] = useState(false)
  const visitsRef     = useRef<HTMLDivElement>(null)
  const sovRef        = useRef<HTMLDivElement>(null)
  const complianceRef = useRef<HTMLDivElement>(null)
  const aiBrandsRef   = useRef<HTMLDivElement>(null)
  const competitorsRef= useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (startDate) params.startDate = startDate
      if (endDate)   params.endDate   = endDate
      const res = await apiClient.get('/field-ops/reports/goldrush-stores/insights', { params })
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
    push('Goldrush Stores Insights')
    push('Period', data.filters.startDate || 'all', 'to', data.filters.endDate || 'all')
    push('')
    push('--- TOTALS ---')
    Object.entries(data.totals).forEach(([k, v]) => push(k.replace(/_/g, ' '), v))
    push('')
    push('--- VISITS BY DAY ---')
    push('Date', 'Visits')
    data.visitsOverTime.forEach(r => push(r.date, r.visits))
    push('')
    push('--- STOCK / ADVERTISING / BOARDS ---')
    push('Question', 'Yes', 'No', 'Other')
    const radios = [
      { label: 'Stocks Goldrush product',         v: data.stocksProduct },
      { label: 'Has advertising',                 v: data.hasAdvertising },
      { label: 'Competitors in store',            v: data.competitorsInStore },
      { label: 'Goldrush board installed',        v: data.boardInstalled },
    ]
    radios.forEach(r => push(r.label, r.v.yes, r.v.no, r.v.other))
    push('')
    push('--- COMPETITORS BY FREQUENCY ---')
    data.competitors.forEach(c => push(c.name, c.count))
    push('')
    push('--- STOCK SOURCES ---')
    data.stockSources.forEach(s => push(s.name, s.count))
    push('')
    push('--- ADVERTISING BRANDS SEEN ---')
    data.adBrands.forEach(b => push(b.name, b.count))
    push('')
    push('--- AI BRANDS DETECTED IN PHOTOS ---')
    data.aiBrandsDetected.forEach(b => push(b.name, b.count))
    push('')
    push('--- AI SHARE OF VOICE OVER TIME ---')
    push('Date', 'Avg SoV %', 'Max SoV %')
    data.shareOfVoice.forEach(s => push(s.date, s.avg_share_of_voice, s.max_share_of_voice))
    push('')
    push('--- AI COMPLIANCE OVER TIME ---')
    push('Date', 'Avg compliance score')
    data.compliance.forEach(c => push(c.date, c.avg_compliance))
    push('')
    push('--- TOP STORES BY VISITS ---')
    data.topStores.forEach(t => push(t.name, t.visits))
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `goldrush-stores-insights-${data.filters.startDate || 'all'}-${data.filters.endDate || 'all'}.csv`
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
        { key: 'visits',     el: visitsRef.current },
        { key: 'sov',        el: sovRef.current },
        { key: 'compliance', el: complianceRef.current },
        { key: 'aiBrands',   el: aiBrandsRef.current },
        { key: 'competitors',el: competitorsRef.current },
      ])
    } catch { /* best-effort */ }
    const period = `${data.filters.startDate || 'all time'} → ${data.filters.endDate || 'today'}`
    const sections: Parameters<typeof buildInsightsPDF>[0]['sections'] = []
    const t = data.totals
    const aiCovPct = t.stores_visited ? ((t.with_ai_completed / t.stores_visited) * 100).toFixed(1) + '%' : '0%'
    const stockPctStr = (data.stocksProduct.yes + data.stocksProduct.no) ? ((data.stocksProduct.yes / (data.stocksProduct.yes + data.stocksProduct.no)) * 100).toFixed(1) + '%' : '—'
    const adPctStr    = (data.hasAdvertising.yes + data.hasAdvertising.no) ? ((data.hasAdvertising.yes / (data.hasAdvertising.yes + data.hasAdvertising.no)) * 100).toFixed(1) + '%' : '—'
    const boardPctStr = (data.boardInstalled.yes + data.boardInstalled.no) ? ((data.boardInstalled.yes / (data.boardInstalled.yes + data.boardInstalled.no)) * 100).toFixed(1) + '%' : '—'

    sections.push({ kind: 'kv', title: 'Headline numbers', rows: [
      ['Store visits',                t.stores_visited],
      ['Unique stores',               t.unique_stores],
      ['Stores with photos',          t.with_photos],
      ['Stores with AI analysis',     t.with_ai_completed],
      ['AI photo coverage',           aiCovPct],
      ['Stocks product',              `${t.with_stock} (${stockPctStr})`],
      ['Has advertising',             `${t.with_advertising} (${adPctStr})`],
      ['Board installed',             `${t.board_installed} (${boardPctStr})`],
      ['Competitors observed',        t.with_competitors],
    ]})

    if (t.with_ai_failed > 0) {
      sections.push({ kind: 'paragraph', title: 'AI photo failures', text: `${t.with_ai_failed} store visits have one or more photos whose AI analysis failed. The hourly cron retries failures automatically. If the count stays high, check the ai_raw_response field on visit_photos.` })
    }

    if (charts.visits) {
      sections.push({ kind: 'image', title: 'Store visits over time', dataUrl: charts.visits })
    }
    if (data.visitsOverTime.length) {
      sections.push({
        kind: 'table',
        title: 'Store visits over time',
        head: ['Date', 'Visits'],
        rows: data.visitsOverTime.map(r => [r.date, r.visits]),
        columnStyles: { 1: { halign: 'right' } },
      })
    }

    sections.push({
      kind: 'table',
      title: 'Compliance signals',
      head: ['Question', 'Yes', 'No', 'Other'],
      rows: [
        ['Stocks Goldrush product', data.stocksProduct.yes,    data.stocksProduct.no,    data.stocksProduct.other],
        ['Has advertising',          data.hasAdvertising.yes,   data.hasAdvertising.no,   data.hasAdvertising.other],
        ['Competitors in store',     data.competitorsInStore.yes,data.competitorsInStore.no,data.competitorsInStore.other],
        ['Goldrush board installed', data.boardInstalled.yes,   data.boardInstalled.no,   data.boardInstalled.other],
      ],
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    })

    if (charts.sov) {
      sections.push({ kind: 'image', title: 'AI share of voice over time', dataUrl: charts.sov })
    }
    if (data.shareOfVoice.length) {
      sections.push({
        kind: 'table',
        title: 'AI share of voice over time (from photo analysis)',
        head: ['Date', 'Avg SoV %', 'Max SoV %'],
        rows: data.shareOfVoice.map(s => [s.date, s.avg_share_of_voice, s.max_share_of_voice]),
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      })
    }
    if (charts.compliance) {
      sections.push({ kind: 'image', title: 'AI compliance score over time', dataUrl: charts.compliance })
    }
    if (data.compliance.length) {
      sections.push({
        kind: 'table',
        title: 'AI compliance score over time',
        head: ['Date', 'Avg compliance score'],
        rows: data.compliance.map(c => [c.date, c.avg_compliance]),
        columnStyles: { 1: { halign: 'right' } },
      })
    }
    if (charts.aiBrands) {
      sections.push({ kind: 'image', title: 'AI-detected brands on shelf', dataUrl: charts.aiBrands })
    }
    if (data.aiBrandsDetected.length) {
      sections.push({
        kind: 'table',
        title: 'AI-detected brands on shelf',
        head: ['Brand', 'Photos'],
        rows: data.aiBrandsDetected.map(b => [b.name, b.count]),
        columnStyles: { 1: { halign: 'right' } },
      })
    }
    if (charts.competitors) {
      sections.push({ kind: 'image', title: 'Competitors in store', dataUrl: charts.competitors })
    }
    if (data.competitors.length) {
      sections.push({
        kind: 'table',
        title: 'Competitors in store (agent-reported)',
        head: ['Competitor', 'Mentions'],
        rows: data.competitors.map(c => [c.name, c.count]),
        columnStyles: { 1: { halign: 'right' } },
      })
    }
    if (data.stockSources.length) {
      sections.push({
        kind: 'table',
        title: 'Stock sources',
        head: ['Source', 'Mentions'],
        rows: data.stockSources.map(s => [s.name, s.count]),
        columnStyles: { 1: { halign: 'right' } },
      })
    }
    if (data.adBrands.length) {
      sections.push({
        kind: 'table',
        title: 'Other advertising brands seen',
        head: ['Brand', 'Mentions'],
        rows: data.adBrands.map(b => [b.name, b.count]),
        columnStyles: { 1: { halign: 'right' } },
      })
    }
    if (data.topStores.length) {
      sections.push({
        kind: 'table',
        title: 'Top stores by visits',
        head: ['Store', 'Visits'],
        rows: data.topStores.map(s => [s.name, s.visits]),
        columnStyles: { 1: { halign: 'right' } },
      })
    }

    buildInsightsPDF({
      title: 'Goldrush — Stores Insights',
      subtitle: 'Stock, advertising and AI photo analysis report',
      filename: `goldrush-stores-insights-${data.filters.startDate || 'all'}-${data.filters.endDate || 'today'}.pdf`,
      meta: [
        ['Period',    period],
        ['Generated', new Date().toLocaleString()],
      ],
      sections,
      footer: 'FieldVibe — Goldrush insights — confidential',
    })
    toast.success('PDF downloaded')
    setPdfWorking(false)
  }
  const printPDF = () => window.print()

  const radios = useMemo(() => data ? [
    { label: 'Stocks Goldrush product',  v: data.stocksProduct,    color: GREEN },
    { label: 'Has advertising',           v: data.hasAdvertising,   color: ACCENT },
    { label: 'Competitors in store',      v: data.competitorsInStore, color: ORANGE },
    { label: 'Goldrush board installed',  v: data.boardInstalled,   color: GREEN },
  ] : [], [data])

  if (loading && !data) return <div className="p-12 flex justify-center"><LoadingSpinner /></div>
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>
  if (!data) return null

  const aiCoveragePct = data.totals.stores_visited ? Math.round((data.totals.with_ai_completed / data.totals.stores_visited) * 1000) / 10 : 0
  const photoCoveragePct = data.totals.stores_visited ? Math.round((data.totals.with_photos / data.totals.stores_visited) * 1000) / 10 : 0
  const stockPct = (data.stocksProduct.yes + data.stocksProduct.no) ? Math.round((data.stocksProduct.yes / (data.stocksProduct.yes + data.stocksProduct.no)) * 1000) / 10 : 0
  const adPct = (data.hasAdvertising.yes + data.hasAdvertising.no) ? Math.round((data.hasAdvertising.yes / (data.hasAdvertising.yes + data.hasAdvertising.no)) * 1000) / 10 : 0
  const boardPct = (data.boardInstalled.yes + data.boardInstalled.no) ? Math.round((data.boardInstalled.yes / (data.boardInstalled.yes + data.boardInstalled.no)) * 1000) / 10 : 0

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goldrush — Stores Insights</h1>
          <p className="text-sm text-gray-500 mt-1">Stock availability, advertising compliance, board installations, and AI-driven share of voice from photo analysis.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={load} className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 inline-flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={exportCSV} className="px-3 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 inline-flex items-center gap-1"><Download className="w-4 h-4" /> CSV</button>
          <button onClick={downloadPDF} disabled={pdfWorking} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"><FileDown className="w-4 h-4" /> {pdfWorking ? 'Building…' : 'PDF'}</button>
          <button onClick={printPDF} title="Open the browser print dialog instead of downloading a PDF" className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 inline-flex items-center gap-1">Print</button>
          <Link to="/field-operations/reports/goldrush-stores" className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 inline-flex items-center gap-1"><ExternalLink className="w-4 h-4" /> Open detail report</Link>
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
        <Tile icon={<Store className="w-5 h-5" />}      label="Store visits"        value={data.totals.stores_visited.toLocaleString()} sub={`${data.totals.unique_stores} unique`} tone="bg-blue-50 text-blue-800" />
        <Tile icon={<ShieldCheck className="w-5 h-5" />} label="Stocks product"      value={`${stockPct.toFixed(1)}%`}                    sub={`${data.totals.with_stock} stores`}      tone="bg-green-50 text-green-800" />
        <Tile icon={<Sparkles className="w-5 h-5" />}    label="Has advertising"     value={`${adPct.toFixed(1)}%`}                       sub={`${data.totals.with_advertising} stores`} tone="bg-amber-50 text-amber-800" />
        <Tile icon={<ShieldCheck className="w-5 h-5" />} label="Board installed"     value={`${boardPct.toFixed(1)}%`}                    sub={`${data.totals.board_installed} stores`}  tone="bg-emerald-50 text-emerald-800" />
        <Tile icon={<ImageIcon className="w-5 h-5" />}   label="AI photo coverage"   value={`${aiCoveragePct.toFixed(1)}%`}               sub={`${data.totals.with_ai_completed} of ${data.totals.with_photos} with photos`} tone="bg-purple-50 text-purple-800" />
      </div>

      {data.totals.with_ai_failed > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2 print:hidden">
          <AlertTriangle className="w-5 h-5 text-red-700 mt-0.5" />
          <div className="text-sm text-red-800">
            <strong>{data.totals.with_ai_failed}</strong> store visits have at least one photo whose AI analysis failed. The cron retries failures hourly; if the count stays high, check ai_raw_response on visit_photos.
          </div>
        </div>
      )}

      {/* Visits over time */}
      <Card title="Store visits over time" subtitle="Daily store-visit volume">
        {data.visitsOverTime.length === 0 ? <Empty msg="No store visits in this period." /> : (
          <div ref={visitsRef}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.visitsOverTime} margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="visits" stroke={ACCENT} fill={ACCENT} fillOpacity={0.18} />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* AI share of voice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="AI share of voice over time" subtitle="Daily avg + max share-of-voice from on-shelf photo analysis">
          {data.shareOfVoice.length === 0 ? <Empty msg="No AI photo analysis yet for this period." /> : (
            <div ref={sovRef}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.shareOfVoice}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avg_share_of_voice" name="Avg SoV %" stroke={ACCENT}    strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="max_share_of_voice" name="Max SoV %" stroke={ORANGE}    strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="AI compliance over time" subtitle="Daily avg compliance score from photo analysis">
          {data.compliance.length === 0 ? <Empty msg="No compliance signals yet." /> : (
            <div ref={complianceRef}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.compliance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="avg_compliance" name="Avg compliance" stroke={GREEN} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* AI brands + competitors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="AI-detected brands on shelf" subtitle="Brands recognised by photo analysis (top 20)">
          {data.aiBrandsDetected.length === 0 ? <Empty msg="No AI brand detections yet." /> : (
            <div ref={aiBrandsRef}>
            <ResponsiveContainer width="100%" height={Math.max(220, data.aiBrandsDetected.length * 22)}>
              <BarChart data={data.aiBrandsDetected} layout="vertical" margin={{ top: 4, right: 16, left: 80, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={160} />
                <Tooltip />
                <Bar dataKey="count" fill={ACCENT} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Competitors in store" subtitle="Survey + AI signals combined (agent-reported)">
          {data.competitors.length === 0 ? <Empty msg="No competitor data." /> : (
            <div ref={competitorsRef}>
            <ResponsiveContainer width="100%" height={Math.max(220, data.competitors.length * 22)}>
              <BarChart data={data.competitors} layout="vertical" margin={{ top: 4, right: 16, left: 80, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={160} />
                <Tooltip />
                <Bar dataKey="count" fill={RED} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Stock sources + advertising brands */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Stock sources" subtitle="Where stockists are sourcing product">
          {data.stockSources.length === 0 ? <Empty msg="No stock-source data." /> : (
            <ul className="divide-y">
              {data.stockSources.map(s => (
                <li key={s.name} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-gray-800">{s.name}</span>
                  <span className="font-semibold text-gray-900">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Other advertising brands" subtitle="Non-Goldrush ad presence (agent-reported)">
          {data.adBrands.length === 0 ? <Empty msg="No third-party advertising recorded." /> : (
            <ul className="divide-y">
              {data.adBrands.map(b => (
                <li key={b.name} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-gray-800">{b.name}</span>
                  <span className="font-semibold text-gray-900">{b.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Compliance / yes-no breakdown */}
      <Card title="Compliance signals" subtitle="Agent-recorded answers across stocking, advertising, boards">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {radios.map(r => (
            <div key={r.label} className="bg-gray-50 rounded p-3">
              <div className="text-sm font-medium text-gray-800 mb-2">{r.label}</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-green-100 rounded p-2"><div className="text-xs text-green-800">Yes</div><div className="text-xl font-bold text-green-900">{r.v.yes}</div></div>
                <div className="bg-red-100 rounded p-2"><div className="text-xs text-red-800">No</div><div className="text-xl font-bold text-red-900">{r.v.no}</div></div>
                <div className="bg-gray-200 rounded p-2"><div className="text-xs text-gray-700">Other</div><div className="text-xl font-bold text-gray-800">{r.v.other}</div></div>
              </div>
              {(r.v.yes + r.v.no) > 0 && (
                <div className="mt-2 h-1.5 bg-gray-200 rounded">
                  <div className="h-full rounded" style={{ width: `${(r.v.yes / (r.v.yes + r.v.no)) * 100}%`, background: r.color }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Top stores by visits */}
      <Card title="Top stores by visits" subtitle="Most-visited stores in this period">
        {data.topStores.length === 0 ? <Empty msg="No store visits to rank." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr><Th>Store</Th><Th>Visits</Th></tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data.topStores.map((t) => (
                  <tr key={t.name}>
                    <Td className="font-medium">{t.name}</Td>
                    <Td>{t.visits.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-gray-400 mt-4 print:mt-2">
        Photo coverage: {photoCoveragePct.toFixed(1)}% of store visits had at least one photo. AI photo coverage: {aiCoveragePct.toFixed(1)}% had at least one AI-analysed photo.
      </p>
    </div>
  )
}

function Tile({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className={`rounded-lg p-4 ${tone}`}>
      <div className="flex items-center gap-2 text-sm font-medium opacity-80">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs opacity-75 mt-0.5">{sub}</div>}
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
