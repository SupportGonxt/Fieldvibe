import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import { fieldOperationsService } from '../../../services/field-operations.service'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import DateRangePresets from '../../../components/ui/DateRangePresets'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import {
  Download, FileDown, Users, CheckCircle2, BadgeCheck, MessageSquareText, RefreshCw, ExternalLink,
  Search, CheckCircle, XCircle, AlertTriangle, Edit2, Save, X, Camera, Ban, RotateCcw, Tag,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { buildInsightsPDF } from '../../../utils/insights-pdf'
import { captureCharts } from '../../../utils/capture-chart'

// ── Insights types ──
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

// ── Detail types ──
interface NoBTagRecord {
  visit_id: string
  visit_date: string
  first_name: string
  last_name: string
  id_number: string
  goldrush_id: string
  agent_name: string
  team_lead_name: string | null
}
interface GoldrushIndividual {
  id: string
  visit_id: string
  first_name: string
  last_name: string
  id_number: string
  phone: string
  email: string
  product_app_player_id: string
  goldrush_id: string
  goldrush_id_rejected: boolean
  goldrush_id_rejection_reason: string
  thumbnail_url: string
  has_photos: boolean
  converted: number
  conversion_date: string
  agent_name: string
  gps_latitude: number
  gps_longitude: number
  created_at: string
  notes: string
  gave_brand_info: string
  consumer_converted: string
  betting_elsewhere: string
  competitor_company: string
  used_goldrush_before: string
  goldrush_comparison: string
  likes_goldrush: string
  platform_suggestions: string
}

// Fallback labels — used until program_config loads or for keys the config doesn't cover.
const SAT_LABELS_FALLBACK: Record<string, string> = {
  likes_goldrush: 'Likes Goldrush',
  used_goldrush_before: 'Used Goldrush before',
  betting_elsewhere: 'Bets elsewhere',
  goldrush_comparison: 'Prefers Goldrush vs competitor',
  gave_brand_info: 'Was given brand info',
  is_the_customer_interested: 'Customer interested',
}
const DEFAULT_INDIVIDUAL_COLUMNS = [
  { key: 'betting_elsewhere', label: 'Betting Elsewhere' },
  { key: 'used_goldrush_before', label: 'Used GR Before' },
  { key: 'likes_goldrush', label: 'Likes GR' },
]

const ACCENT = '#0ea5e9'
const ACCENT_2 = '#10b981'

export default function IndividualInsights() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'insights' | 'individuals' | 'no_btag'>('insights')

  // ── Shared: companies + program_config ──
  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })
  const companies = companiesResp?.data || companiesResp || []
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  useEffect(() => {
    if (Array.isArray(companies) && companies.length > 0 && !selectedCompany) {
      const goldrush = companies.find((c: any) => c.name?.toLowerCase().includes('goldrush'))
      if (goldrush) setSelectedCompany(goldrush.id)
      else if (companies.length === 1) setSelectedCompany(companies[0].id)
    }
  }, [companies, selectedCompany])

  const [cfg, setCfg] = useState<any>(null)
  useEffect(() => {
    apiClient.get('/field-ops/config', { params: selectedCompany ? { company_id: selectedCompany } : {} })
      .then(res => setCfg(res.data?.config || null))
      .catch(() => setCfg(null))
  }, [selectedCompany])
  const labelFor = (key: string) => cfg?.capture_steps?.find((s: any) => s.key === key)?.label || SAT_LABELS_FALLBACK[key] || key
  const individualColumns = useMemo(() => {
    const steps = (cfg?.capture_steps || []).filter((s: any) => s.show_in_reports && (!s.visit_target_type || s.visit_target_type === 'individual'))
    return steps.length ? steps.map((s: any) => ({ key: s.key, label: s.label })) : DEFAULT_INDIVIDUAL_COLUMNS
  }, [cfg])
  // Render unconditionally until config loads (matches old goldrush-only behavior); once loaded, gate strictly.
  const qualificationEnabled = cfg ? cfg.qualification_enabled === true : true

  // ── Insights state ──
  const [data, setData] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [insStartDate, setInsStartDate] = useState('')
  const [insEndDate, setInsEndDate] = useState('')
  const [pdfWorking, setPdfWorking] = useState(false)
  const visitsOverTimeRef = useRef<HTMLDivElement>(null)
  const competitorsRef = useRef<HTMLDivElement>(null)
  const productInterestRef = useRef<HTMLDivElement>(null)

  const loadInsights = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (insStartDate) params.startDate = insStartDate
      if (insEndDate) params.endDate = insEndDate
      if (selectedCompany) params.company_id = selectedCompany // ponytail: company_id inert until report endpoints are parameterized
      const res = await apiClient.get('/field-ops/reports/goldrush-individuals/insights', { params })
      setData(res.data?.data || null)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadInsights() }, [insStartDate, insEndDate, selectedCompany])

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
    Object.entries(data.satisfaction).forEach(([k, v]) => push(labelFor(k), v.yes, v.no, v.other))
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
        { key: 'visits', el: visitsOverTimeRef.current },
        { key: 'competitors', el: competitorsRef.current },
        { key: 'products', el: productInterestRef.current },
      ])
    } catch {
      // chart capture is best-effort
    }
    const period = `${data.filters.startDate || 'all time'} → ${data.filters.endDate || 'today'}`
    const sections: Parameters<typeof buildInsightsPDF>[0]['sections'] = []

    sections.push({ kind: 'kv', title: 'Headline numbers', rows: [
      ['Individuals visited', data.totals.individuals],
      ['Converted', data.totals.converted],
      ['Conversion rate', `${data.totals.conversion_rate.toFixed(1)}%`],
      ['Customers with Goldrush ID', data.totals.with_id],
      ['Left a suggestion', data.totals.with_suggestion],
    ]})

    if (charts.visits) sections.push({ kind: 'image', title: 'Visits and conversions over time', dataUrl: charts.visits })
    if (data.visitsOverTime.length) {
      sections.push({
        kind: 'table',
        title: 'Visits and conversions by day',
        head: ['Date', 'Visits', 'Conversions', 'Conv %'],
        rows: data.visitsOverTime.map(r => [r.date, r.visits, r.conversions, r.visits ? `${((r.conversions / r.visits) * 100).toFixed(1)}%` : '0.0%']),
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      })
    }
    if (Object.keys(data.satisfaction).length) {
      sections.push({
        kind: 'table',
        title: 'Satisfaction signals',
        head: ['Question', 'Yes', 'No', 'Other'],
        rows: Object.entries(data.satisfaction).map(([k, v]) => [labelFor(k), v.yes, v.no, v.other]),
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
    if (charts.competitors) sections.push({ kind: 'image', title: 'Competitors mentioned', dataUrl: charts.competitors })
    if (data.competitors.length) {
      sections.push({
        kind: 'table',
        title: 'Competitors mentioned',
        head: ['Competitor', 'Mentions'],
        rows: data.competitors.map(c => [c.name, c.count]),
        columnStyles: { 1: { halign: 'right' } },
      })
    }
    if (charts.products) sections.push({ kind: 'image', title: 'Product interest', dataUrl: charts.products })
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
      meta: [['Period', period], ['Generated', new Date().toLocaleString()]],
      sections,
      footer: 'FieldVibe — Goldrush insights — confidential',
    })
    toast.success('PDF downloaded')
    setPdfWorking(false)
  }
  const printPDF = () => window.print()
  const satisfactionRows = useMemo(() => Object.entries(data?.satisfaction || {}).map(([k, v]) => ({ label: labelFor(k), ...v })), [data, cfg])

  // ── Detail state ──
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset)
    return monday.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)
  const [photoModalVisitId, setPhotoModalVisitId] = useState<string | null>(null)
  const [photoModalPhotos, setPhotoModalPhotos] = useState<Array<{ id: string; photo_type: string; label?: string; r2_url: string }>>([])
  const [photoModalLoading, setPhotoModalLoading] = useState(false)
  const [rejectModal, setRejectModal] = useState<{ ind: GoldrushIndividual } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const handleViewPhotos = async (visitId: string) => {
    setPhotoModalVisitId(visitId)
    setPhotoModalLoading(true)
    setPhotoModalPhotos([])
    try {
      const res = await apiClient.get('/visits/' + visitId + '/photos')
      setPhotoModalPhotos(res.data?.data || [])
    } catch {
      toast.error('Failed to load photos')
    } finally {
      setPhotoModalLoading(false)
    }
  }

  const buildQueryUrl = () => {
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    if (selectedCompany) params.append('company_id', selectedCompany) // ponytail: company_id inert until report endpoints are parameterized
    const queryString = params.toString()
    return `/field-ops/reports/goldrush-individuals${queryString ? '?' + queryString : ''}`
  }

  const { data: individuals = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['goldrush-individuals', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(buildQueryUrl())
      return (res.data?.data || []) as GoldrushIndividual[]
    },
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
  })

  const { data: noBTagRecords = [], isLoading: noBTagLoading, refetch: refetchNoBTag } = useQuery({
    queryKey: ['goldrush-no-btag', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (selectedCompany) params.append('company_id', selectedCompany) // ponytail: company_id inert until report endpoints are parameterized
      const res = await apiClient.get(`/field-ops/reports/goldrush-no-btag?${params.toString()}`)
      return (res.data?.data || []) as NoBTagRecord[]
    },
    staleTime: 60000,
    enabled: activeTab === 'no_btag',
  })

  const handleEditGoldrushId = (ind: GoldrushIndividual) => { setEditingId(ind.id); setEditValue(ind.goldrush_id || '') }
  const handleSaveGoldrushId = async (ind: GoldrushIndividual) => {
    if (!ind.visit_id) { toast.error('Cannot update: no visit linked to this record'); return }
    setSaving(true)
    try {
      await fieldOperationsService.updateVisit(ind.visit_id, { custom_field_values: { goldrush_id: editValue.trim() } })
      toast.success('Goldrush ID updated')
      setEditingId(null); setEditValue('')
      queryClient.invalidateQueries({ queryKey: ['goldrush-individuals'] })
    } catch {
      toast.error('Failed to update Goldrush ID')
    } finally { setSaving(false) }
  }
  const handleCancelEdit = () => { setEditingId(null); setEditValue('') }
  const handleOpenReject = (ind: GoldrushIndividual) => { setRejectModal({ ind }); setRejectReason('') }
  const handleConfirmReject = async () => {
    if (!rejectModal) return
    const { ind } = rejectModal
    if (!ind.visit_id) { toast.error('Cannot reject: no visit linked to this record'); return }
    setRejecting(true)
    try {
      await fieldOperationsService.updateVisit(ind.visit_id, {
        custom_field_values: { goldrush_id_rejected: true, goldrush_id_rejection_reason: rejectReason.trim() }
      })
      toast.success('Goldrush ID rejected')
      setRejectModal(null)
      queryClient.invalidateQueries({ queryKey: ['goldrush-individuals'] })
    } catch {
      toast.error('Failed to reject Goldrush ID')
    } finally { setRejecting(false) }
  }
  const handleUnreject = async (ind: GoldrushIndividual) => {
    if (!ind.visit_id) return
    try {
      await fieldOperationsService.updateVisit(ind.visit_id, {
        custom_field_values: { goldrush_id_rejected: false, goldrush_id_rejection_reason: '' }
      })
      toast.success('Rejection removed')
      queryClient.invalidateQueries({ queryKey: ['goldrush-individuals'] })
    } catch {
      toast.error('Failed to remove rejection')
    }
  }

  const filtered = individuals.filter(ind => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      ind.first_name?.toLowerCase().includes(s) ||
      ind.last_name?.toLowerCase().includes(s) ||
      ind.id_number?.toLowerCase().includes(s) ||
      ind.phone?.toLowerCase().includes(s) ||
      ind.goldrush_id?.toLowerCase().includes(s) ||
      ind.agent_name?.toLowerCase().includes(s)
    )
  })
  const totalConverted = individuals.filter(i => i.converted === 1).length
  const conversionRate = individuals.length > 0 ? ((totalConverted / individuals.length) * 100).toFixed(1) : '0'

  const exportToExcel = () => {
    setExporting(true)
    try {
      if (individuals.length === 0) { toast.error('No data to export'); return }
      const headers = [
        'First Name', 'Last Name', 'ID Number', 'Phone', 'Email',
        'Goldrush ID', 'Converted', 'Conversion Date', 'Agent',
        'Gave Brand Info', 'Consumer Converted (Survey)', 'Betting Elsewhere',
        'Competitor Company', 'Used Goldrush Before', 'Goldrush Comparison',
        'Likes Goldrush', 'Platform Suggestions', 'Notes',
        'GPS Latitude', 'GPS Longitude', 'Date Registered'
      ]
      const rows = individuals.map(ind => [
        ind.first_name || '', ind.last_name || '', ind.id_number || '', ind.phone || '', ind.email || '',
        ind.goldrush_id || '', ind.converted ? 'Yes' : 'No', ind.conversion_date || '', ind.agent_name || '',
        ind.gave_brand_info || '', ind.consumer_converted || '', ind.betting_elsewhere || '',
        ind.competitor_company || '', ind.used_goldrush_before || '', ind.goldrush_comparison || '',
        ind.likes_goldrush || '', ind.platform_suggestions || '', ind.notes || '',
        ind.gps_latitude?.toString() || '', ind.gps_longitude?.toString() || '', ind.created_at || '',
      ])
      const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')
      const BOM = '﻿'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `goldrush-individual-report-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${individuals.length} records`)
    } catch {
      toast.error('Export failed')
    } finally { setExporting(false) }
  }

  const exportNoBTag = () => {
    setExporting(true)
    try {
      if (noBTagRecords.length === 0) { toast.error('No data to export'); return }
      const headers = ['Date', 'First Name', 'Last Name', 'ID Number', 'Goldrush ID', 'Agent', 'Team Lead']
      const rows = noBTagRecords.map(r => [r.visit_date || '', r.first_name || '', r.last_name || '', r.id_number || '', r.goldrush_id || '', r.agent_name || '', r.team_lead_name || ''])
      const BOM = '﻿'
      const csv = [headers.map(h => `"${h}"`).join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `goldrush-no-btag-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${noBTagRecords.length} records`)
    } catch { toast.error('Export failed') } finally { setExporting(false) }
  }

  if (loading && !data && activeTab === 'insights') return <div className="p-12 flex justify-center"><LoadingSpinner /></div>
  if (error && activeTab === 'insights') return <div className="p-8 text-center text-red-600">{error}</div>

  const emptyColSpan = 8 + individualColumns.length

  return (
    <div className="space-y-6 print:space-y-3">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Goldrush — Individuals</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Consumer engagement, conversion & questionnaire data for direct-to-consumer visits.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {Array.isArray(companies) && companies.length > 1 && (
            <SearchableSelect
              options={[{ value: '', label: 'All Companies' }, ...companies.map((c: any) => ({ value: c.id, label: c.name }))]}
              value={selectedCompany || null}
              onChange={(val) => setSelectedCompany(val || '')}
              placeholder="All Companies"
            />
          )}
          {activeTab === 'insights' && (
            <DateRangePresets startDate={insStartDate} endDate={insEndDate} onStartDateChange={setInsStartDate} onEndDateChange={setInsEndDate} />
          )}
          {activeTab !== 'insights' && (
            <DateRangePresets startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
          )}
          <button
            onClick={() => activeTab === 'insights' ? loadInsights() : activeTab === 'individuals' ? refetch() : refetchNoBTag()}
            className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          {activeTab === 'insights' && (
            <>
              <button onClick={exportCSV} className="px-3 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 inline-flex items-center gap-1"><Download className="w-4 h-4" /> CSV</button>
              <button onClick={downloadPDF} disabled={pdfWorking} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"><FileDown className="w-4 h-4" /> {pdfWorking ? 'Building…' : 'PDF'}</button>
              <button onClick={printPDF} title="Open the browser print dialog instead of downloading a PDF" className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-1">Print</button>
            </>
          )}
          {activeTab === 'individuals' && (
            <button onClick={exportToExcel} disabled={exporting || individuals.length === 0} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium">
              <Download className="h-4 w-4" /> Export Excel
            </button>
          )}
          {activeTab === 'no_btag' && (
            <button onClick={exportNoBTag} disabled={exporting || noBTagRecords.length === 0} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium">
              <Download className="h-4 w-4" /> Export No B-Tag
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit print:hidden">
        <button onClick={() => setActiveTab('insights')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'insights' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          <ExternalLink className="h-4 w-4" /> Insights
        </button>
        <button onClick={() => setActiveTab('individuals')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'individuals' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          <Users className="h-4 w-4" /> All Individuals
          <span className="ml-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full">{individuals.length}</span>
        </button>
        <button onClick={() => setActiveTab('no_btag')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'no_btag' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          <Tag className="h-4 w-4" /> No B-Tag
          {noBTagRecords.length > 0 && <span className="ml-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full">{noBTagRecords.length}</span>}
        </button>
      </div>

      {/* ── Insights tab ── */}
      {activeTab === 'insights' && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Tile icon={<Users className="w-5 h-5" />} label="Individuals visited" value={data.totals.individuals.toLocaleString()} tone="bg-blue-50 text-blue-800" />
            <Tile icon={<CheckCircle2 className="w-5 h-5" />} label="Converted" value={data.totals.converted.toLocaleString()} tone="bg-green-50 text-green-800" />
            <Tile icon={<CheckCircle2 className="w-5 h-5" />} label="Conversion rate" value={`${data.totals.conversion_rate.toFixed(1)}%`} tone="bg-emerald-50 text-emerald-800" />
            <Tile icon={<BadgeCheck className="w-5 h-5" />} label="With Goldrush ID" value={data.totals.with_id.toLocaleString()} tone="bg-amber-50 text-amber-800" />
            <Tile icon={<MessageSquareText className="w-5 h-5" />} label="Left a suggestion" value={data.totals.with_suggestion.toLocaleString()} tone="bg-purple-50 text-purple-800" />
          </div>

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

          {qualificationEnabled && (
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
          )}

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

          <Card title="Top agents" subtitle="Visits + conversion rate, top 15">
            {data.topAgents.length === 0 ? <Empty msg="No agents to rank." /> : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr><Th>Agent</Th><Th>Visits</Th><Th>Conversions</Th><Th>Conversion %</Th></tr>
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

          <Card title="Customer suggestions" subtitle={`${data.totals.with_suggestion} customers left feedback. Sample below.`}>
            {data.suggestionsTop.length === 0 ? <Empty msg="No suggestions captured." /> : (
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {data.suggestionsTop.map((s, i) => (
                  <li key={i} className="bg-blue-50 px-3 py-2 rounded text-sm text-gray-800">
                    <span className="text-blue-700 text-xs block mb-0.5">{s.agent}</span>
                    {s.suggestion}
                  </li>
                ))}
              </ul>
            )}
          </Card>

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
        </>
      )}

      {/* ── No B-Tag tab ── */}
      {activeTab === 'no_btag' && (
        <>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 flex items-start gap-3">
            <Tag className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Missing B-Tag (product_app_player_id)</p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">These captures have a valid Goldrush ID and SA ID number but no B-Tag assigned yet. Use Export to download for follow-up.</p>
            </div>
          </div>
          {noBTagLoading ? <LoadingSpinner /> : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Date</th>
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Name</th>
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">ID Number</th>
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Goldrush ID</th>
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Agent</th>
                      <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Team Lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noBTagRecords.length === 0 ? (
                      <tr><td colSpan={6} className="py-12 text-center text-gray-400 text-sm">No records missing a B-Tag in this date range</td></tr>
                    ) : noBTagRecords.map(r => (
                      <tr key={r.visit_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-orange-50/50 dark:hover:bg-orange-900/10">
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{r.visit_date ? new Date(r.visit_date).toLocaleDateString() : '—'}</td>
                        <td className="py-3 px-4 text-gray-900 dark:text-white font-medium whitespace-nowrap">{r.first_name} {r.last_name}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{r.id_number || '—'}</td>
                        <td className="py-3 px-4 text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">{r.goldrush_id || '—'}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{r.agent_name || '—'}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{r.team_lead_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {noBTagRecords.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                  {noBTagRecords.length} record{noBTagRecords.length !== 1 ? 's' : ''} missing B-Tag
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── All Individuals (detail) tab ── */}
      {activeTab === 'individuals' && (
        <>
          {isLoading ? <LoadingSpinner /> : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Failed to load data</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Please try refreshing the page</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-blue-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Total Individuals</span></div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{individuals.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2"><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Converted</span></div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalConverted}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2"><XCircle className="h-4 w-4 text-red-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Not Converted</span></div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{individuals.length - totalConverted}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-purple-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Conversion Rate</span></div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{conversionRate}%</p>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, ID, phone, Goldrush ID, or agent..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Photo</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Name</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">ID Number</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Phone</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Goldrush ID</th>
                        <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Converted</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Agent</th>
                        {individualColumns.map(col => (
                          <th key={col.key} className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{col.label}</th>
                        ))}
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Date Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={emptyColSpan} className="py-12 text-center text-gray-400">{individuals.length === 0 ? 'No Goldrush individual records found' : 'No records match your search'}</td></tr>
                      ) : filtered.map((ind) => (
                        <tr key={ind.id} className="group border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="py-3 px-4">
                            {ind.thumbnail_url ? (
                              <button onClick={() => setExpandedPhoto(ind.thumbnail_url)} className="block">
                                <img src={ind.thumbnail_url} alt="Visit photo" className="w-10 h-10 rounded object-cover border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity" />
                              </button>
                            ) : ind.has_photos ? (
                              <button onClick={() => handleViewPhotos(ind.visit_id || ind.id)} className="inline-flex items-center justify-center w-10 h-10 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors" title="Click to view photos">
                                <Camera className="w-4 h-4 text-blue-500" />
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">No photo</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-900 dark:text-white font-medium whitespace-nowrap">{ind.first_name} {ind.last_name}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{ind.id_number || '—'}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{ind.phone || '—'}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {editingId === ind.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value.replace(/[^0-9]/g, ''))}
                                  className="w-28 px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                                  placeholder="Goldrush ID"
                                  autoFocus
                                  onKeyDown={e => { if (e.key === 'Enter') handleSaveGoldrushId(ind); if (e.key === 'Escape') handleCancelEdit(); }}
                                />
                                <button onClick={() => handleSaveGoldrushId(ind)} disabled={saving} className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50" title="Save"><Save className="w-3.5 h-3.5" /></button>
                                <button onClick={handleCancelEdit} className="p-1 text-gray-400 hover:text-gray-600" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : ind.goldrush_id_rejected ? (
                              <div className="flex items-center gap-1.5">
                                <div>
                                  <span className="line-through text-gray-400 dark:text-gray-500 font-medium text-xs">{ind.goldrush_id || '—'}</span>
                                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Rejected</span>
                                  {ind.goldrush_id_rejection_reason && (
                                    <p className="text-xs text-gray-400 mt-0.5 max-w-[140px] truncate" title={ind.goldrush_id_rejection_reason}>{ind.goldrush_id_rejection_reason}</p>
                                  )}
                                </div>
                                <button onClick={() => handleUnreject(ind)} className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove rejection"><RotateCcw className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className={`font-medium ${ind.goldrush_id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>{ind.goldrush_id || '—'}</span>
                                <button onClick={() => handleEditGoldrushId(ind)} className="p-1 text-gray-400 hover:text-blue-600" title="Edit Goldrush ID"><Edit2 className="w-3 h-3" /></button>
                                <button onClick={() => handleOpenReject(ind)} className="p-1 text-gray-400 hover:text-red-600" title="Reject Goldrush ID"><Ban className="w-3 h-3" /></button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ind.converted ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {ind.converted ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{ind.agent_name || '—'}</td>
                          {individualColumns.map(col => (
                            <td key={col.key} className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{(ind as any)[col.key] || '—'}</td>
                          ))}
                          <td className="py-3 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{ind.created_at ? new Date(ind.created_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filtered.length > 0 && (
                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                    Showing {filtered.length} of {individuals.length} records
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Reject Goldrush ID Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setRejectModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><Ban className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Reject Goldrush ID</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Rejecting <span className="font-medium text-gray-700 dark:text-gray-300">{rejectModal.ind.goldrush_id}</span> for{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-300">{rejectModal.ind.first_name} {rejectModal.ind.last_name}</span>
                </p>
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Duplicate ID, Invalid number..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">Cancel</button>
              <button onClick={handleConfirmReject} disabled={rejecting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg flex items-center gap-2"><Ban className="w-4 h-4" />{rejecting ? 'Rejecting...' : 'Reject ID'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Expand Modal */}
      {expandedPhoto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={() => setExpandedPhoto(null)}>
          <div className="relative max-w-3xl max-h-[90vh] p-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => setExpandedPhoto(null)} className="absolute top-0 right-0 m-2 p-1 bg-white dark:bg-gray-800 rounded-full shadow-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 z-10"><X className="w-5 h-5" /></button>
            <img src={expandedPhoto} alt="Visit photo expanded" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
          </div>
        </div>
      )}

      {/* Visit Photos Gallery Modal */}
      {photoModalVisitId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => { setPhotoModalVisitId(null); setPhotoModalPhotos([]); }}>
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Visit Photos</h3>
              <button onClick={() => { setPhotoModalVisitId(null); setPhotoModalPhotos([]); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              {photoModalLoading ? (
                <div className="flex flex-col items-center py-12">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-500">Loading photos...</p>
                </div>
              ) : photoModalPhotos.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No photos found for this visit</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {photoModalPhotos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <button onClick={() => setExpandedPhoto(photo.r2_url)} className="block w-full">
                        <img src={photo.r2_url} alt={photo.label || photo.photo_type || 'Visit photo'} className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity" />
                      </button>
                      {photo.label && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-center truncate">{photo.label}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
