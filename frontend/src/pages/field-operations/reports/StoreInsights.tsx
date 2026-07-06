import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import { fieldOperationsService } from '../../../services/field-operations.service'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import DateRangePresets from '../../../components/ui/DateRangePresets'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts'
import {
  Download, FileDown, Store, ExternalLink, Sparkles, RefreshCw,
  Search, CheckCircle, XCircle, AlertTriangle, Edit2, Save, X, Camera, Loader2, Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { buildInsightsPDF } from '../../../utils/insights-pdf'
import { captureCharts } from '../../../utils/capture-chart'

// ── Insights types ──
interface YesNoBucket { key: string; yes: number; no: number; other: number }
interface StoreInsightsData {
  filters: { startDate: string | null; endDate: string | null }
  totals: {
    stores_visited: number; unique_stores: number; with_photos: number; with_ai_completed: number
    with_ai_failed: number; with_stock: number; with_advertising: number; board_installed: number; with_competitors: number
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

// ── Detail types ──
interface GoldrushStore {
  id: string; visit_date: string; status: string; store_name: string; store_address: string
  agent_name: string; goldrush_id: string; thumbnail_url: string; has_photos: boolean
  shop_exterior_photo: string; competitor_photo: string; ad_board_photo: string
  gps_latitude: number; gps_longitude: number; created_at: string; notes: string
  stock_source: string; competitors_in_store: string; competitor_stock_source: string
  competitor_products: string; competitor_prices: string; has_advertising: string
  other_ad_brands: string; board_installed: string
  ai_status: string; ai_board_detected: boolean; ai_photos_analyzed: number; ai_share_of_voice: number
  ai_brand: string; ai_condition: string; ai_visibility: string; ai_board_type: string; ai_description: string
}
interface StellrVisit {
  id: string; visit_date: string; status: string; store_name: string; store_address: string
  agent_name: string; thumbnail_url: string; has_photos: boolean
  gps_latitude: number; gps_longitude: number; created_at: string; notes: string
  product_range: string; stock_availability: string; shelf_position: string; pos_material: string
  competitor_brands: string; pricing_compliance: string; brand_visibility: string
  cooler_installed: string; outlet_type: string; raw_responses: Record<string, string>
}

const formatKey = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const isPhotoUrl = (val: any) => typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:image'))

const ACCENT = '#0ea5e9'
const GREEN = '#10b981'
const ORANGE = '#f59e0b'

export default function StoreInsights() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'insights' | 'detail'>('insights')

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
  const selectedCompanyObj = companies.find((c: any) => c.id === selectedCompany)
  const isStellr = !!selectedCompanyObj?.name?.toLowerCase().includes('stellr')

  const [cfg, setCfg] = useState<any>(null)
  useEffect(() => {
    apiClient.get('/field-ops/config', { params: selectedCompany ? { company_id: selectedCompany } : {} })
      .then(res => setCfg(res.data?.config || null))
      .catch(() => setCfg(null))
  }, [selectedCompany])
  // Extra store-target config columns beyond the fixed fields already rendered below.
  // ponytail: no current config defines these; wired so future capture_steps show up without code changes.
  const extraStoreColumns = useMemo(() => {
    const fixed = new Set(['stock_source', 'competitors_in_store', 'has_advertising', 'board_installed'])
    return (cfg?.capture_steps || []).filter((s: any) => s.show_in_reports && s.visit_target_type === 'store' && !fixed.has(s.key))
  }, [cfg])

  // ── Insights state ──
  const [data, setData] = useState<StoreInsightsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [insStartDate, setInsStartDate] = useState('')
  const [insEndDate, setInsEndDate] = useState('')
  const [pdfWorking, setPdfWorking] = useState(false)
  const visitsRef = useRef<HTMLDivElement>(null)
  const sovRef = useRef<HTMLDivElement>(null)
  const complianceRef = useRef<HTMLDivElement>(null)
  const aiBrandsRef = useRef<HTMLDivElement>(null)
  const competitorsRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (insStartDate) params.startDate = insStartDate
      if (insEndDate) params.endDate = insEndDate
      if (selectedCompany) params.company_id = selectedCompany // ponytail: company_id inert until report endpoints are parameterized
      const res = await apiClient.get('/field-ops/reports/goldrush-stores/insights', { params })
      setData(res.data?.data || null)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [insStartDate, insEndDate, selectedCompany])

  const exportCSV = () => {
    if (!data) return
    const lines: string[] = []
    const push = (...cells: any[]) => lines.push(cells.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    push('Goldrush Stores Insights')
    push('Period', data.filters.startDate || 'all', 'to', data.filters.endDate || 'all')
    push('')
    push('--- TOTALS ---')
    push('Store visits', data.totals.stores_visited)
    push('Unique stores', data.totals.unique_stores)
    push('With photos', data.totals.with_photos)
    push('AI analysis completed', data.totals.with_ai_completed)
    push('AI analysis failed', data.totals.with_ai_failed)
    push('Stocks product', data.totals.with_stock)
    push('Has advertising', data.totals.with_advertising)
    push('Board installed', data.totals.board_installed)
    push('Competitors present', data.totals.with_competitors)
    push('')
    push('--- VISITS BY DAY ---')
    push('Date', 'Visits')
    data.visitsOverTime.forEach(r => push(r.date, r.visits))
    push('')
    push('--- STOCK / ADVERTISING / BOARDS ---')
    push('Question', 'Yes', 'No', 'Other')
    ;[
      ['Stocks Goldrush product', data.stocksProduct], ['Has advertising', data.hasAdvertising],
      ['Competitors in store', data.competitorsInStore], ['Goldrush board installed', data.boardInstalled],
    ].forEach(([label, v]: any) => push(label, v.yes, v.no, v.other))
    push('')
    push('--- COMPETITORS BY FREQUENCY ---')
    data.competitors.forEach(c => push(c.name, c.count))
    push('')
    push('--- STOCK SOURCES ---')
    data.stockSources.forEach(s => push(s.name, s.count))
    push('')
    push('--- ADVERTISING BRANDS SEEN ---')
    data.adBrands.forEach(a => push(a.name, a.count))
    push('')
    push('--- AI BRANDS DETECTED IN PHOTOS ---')
    data.aiBrandsDetected.forEach(a => push(a.name, a.count))
    push('')
    push('--- AI SHARE OF VOICE OVER TIME ---')
    push('Date', 'Avg Share of Voice %', 'Max Share of Voice %')
    data.shareOfVoice.forEach(r => push(r.date, r.avg_share_of_voice, r.max_share_of_voice))
    push('')
    push('--- AI COMPLIANCE OVER TIME ---')
    push('Date', 'Avg Compliance %')
    data.compliance.forEach(r => push(r.date, r.avg_compliance))
    push('')
    push('--- TOP STORES BY VISITS ---')
    data.topStores.forEach(s => push(s.name, s.visits))
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
        { key: 'visits', el: visitsRef.current },
        { key: 'sov', el: sovRef.current },
        { key: 'compliance', el: complianceRef.current },
        { key: 'aiBrands', el: aiBrandsRef.current },
        { key: 'competitors', el: competitorsRef.current },
      ])
    } catch {
      // chart capture is best-effort
    }
    const period = `${data.filters.startDate || 'all time'} → ${data.filters.endDate || 'today'}`
    const sections: Parameters<typeof buildInsightsPDF>[0]['sections'] = []

    sections.push({ kind: 'kv', title: 'Headline numbers', rows: [
      ['Store visits', data.totals.stores_visited],
      ['Unique stores', data.totals.unique_stores],
      ['With photos', data.totals.with_photos],
      ['Stocks product', data.totals.with_stock],
      ['Has advertising', data.totals.with_advertising],
      ['Board installed', data.totals.board_installed],
    ]})

    if (data.totals.with_ai_failed > 0) {
      sections.push({ kind: 'paragraph', title: 'AI analysis', text: `${data.totals.with_ai_failed} store visit(s) failed AI photo analysis and may need a manual review or re-run.` })
    }

    if (charts.visits) sections.push({ kind: 'image', title: 'Store visits over time', dataUrl: charts.visits })
    if (data.visitsOverTime.length) {
      sections.push({ kind: 'table', title: 'Store visits by day', head: ['Date', 'Visits'], rows: data.visitsOverTime.map(r => [r.date, r.visits]), columnStyles: { 1: { halign: 'right' } } })
    }

    sections.push({
      kind: 'table', title: 'Compliance signals', head: ['Question', 'Yes', 'No', 'Other'],
      rows: [
        ['Stocks Goldrush product', data.stocksProduct.yes, data.stocksProduct.no, data.stocksProduct.other],
        ['Has advertising', data.hasAdvertising.yes, data.hasAdvertising.no, data.hasAdvertising.other],
        ['Competitors in store', data.competitorsInStore.yes, data.competitorsInStore.no, data.competitorsInStore.other],
        ['Goldrush board installed', data.boardInstalled.yes, data.boardInstalled.no, data.boardInstalled.other],
      ],
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    })

    if (charts.sov) sections.push({ kind: 'image', title: 'AI share of voice over time', dataUrl: charts.sov })
    if (data.shareOfVoice.length) {
      sections.push({ kind: 'table', title: 'AI share of voice by day', head: ['Date', 'Avg %', 'Max %'], rows: data.shareOfVoice.map(r => [r.date, r.avg_share_of_voice, r.max_share_of_voice]), columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } })
    }
    if (charts.compliance) sections.push({ kind: 'image', title: 'AI compliance over time', dataUrl: charts.compliance })
    if (data.compliance.length) {
      sections.push({ kind: 'table', title: 'AI compliance by day', head: ['Date', 'Avg compliance %'], rows: data.compliance.map(r => [r.date, r.avg_compliance]), columnStyles: { 1: { halign: 'right' } } })
    }
    if (charts.aiBrands) sections.push({ kind: 'image', title: 'AI-detected brands on shelf', dataUrl: charts.aiBrands })
    if (data.aiBrandsDetected.length) {
      sections.push({ kind: 'table', title: 'AI-detected brands', head: ['Brand', 'Count'], rows: data.aiBrandsDetected.map(a => [a.name, a.count]), columnStyles: { 1: { halign: 'right' } } })
    }
    if (charts.competitors) sections.push({ kind: 'image', title: 'Competitors in store', dataUrl: charts.competitors })
    if (data.competitors.length) {
      sections.push({ kind: 'table', title: 'Competitors mentioned', head: ['Competitor', 'Count'], rows: data.competitors.map(c => [c.name, c.count]), columnStyles: { 1: { halign: 'right' } } })
    }
    if (data.stockSources.length) {
      sections.push({ kind: 'table', title: 'Stock sources', head: ['Source', 'Count'], rows: data.stockSources.map(s => [s.name, s.count]), columnStyles: { 1: { halign: 'right' } } })
    }
    if (data.adBrands.length) {
      sections.push({ kind: 'table', title: 'Other advertising brands', head: ['Brand', 'Count'], rows: data.adBrands.map(a => [a.name, a.count]), columnStyles: { 1: { halign: 'right' } } })
    }
    if (data.topStores.length) {
      sections.push({ kind: 'table', title: 'Top stores by visits', head: ['Store', 'Visits'], rows: data.topStores.map(s => [s.name, s.visits]), columnStyles: { 1: { halign: 'right' } } })
    }

    buildInsightsPDF({
      title: 'Goldrush — Stores Insights',
      subtitle: 'Store visits & merchandising compliance report',
      filename: `goldrush-stores-insights-${data.filters.startDate || 'all'}-${data.filters.endDate || 'today'}.pdf`,
      meta: [['Period', period], ['Generated', new Date().toLocaleString()]],
      sections,
      footer: 'FieldVibe — Goldrush insights — confidential',
    })
    toast.success('PDF downloaded')
    setPdfWorking(false)
  }
  const printPDF = () => window.print()

  const radios = useMemo(() => data ? [
    { label: 'Stocks Goldrush product', v: data.stocksProduct, color: GREEN },
    { label: 'Has advertising', v: data.hasAdvertising, color: ACCENT },
    { label: 'Competitors in store', v: data.competitorsInStore, color: ORANGE },
    { label: 'Goldrush board installed', v: data.boardInstalled, color: GREEN },
  ] : [], [data])

  // ── Detail state ──
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)
  const [photoModalVisitId, setPhotoModalVisitId] = useState<string | null>(null)
  const [photoModalPhotos, setPhotoModalPhotos] = useState<Array<{ id: string; photo_type: string; label?: string; r2_url: string }>>([])
  const [photoModalLoading, setPhotoModalLoading] = useState(false)
  const [aiRunning, setAiRunning] = useState(false)
  const [aiStatus, setAiStatus] = useState<any>(null)
  const [migrating, setMigrating] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState('')
  const [detailVisit, setDetailVisit] = useState<StellrVisit | null>(null)

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

  const fetchAiStatus = async () => {
    try {
      const res = await apiClient.get('/visit-photos/ai-status')
      setAiStatus(res.data?.data || res.data || null)
    } catch {
      // best-effort, silent
    }
  }
  useEffect(() => { fetchAiStatus() }, [])

  const handleAiBackfill = async () => {
    setAiRunning(true)
    try {
      const res = await apiClient.post('/visit-photos/ai-backfill?limit=20')
      const d = res.data?.data || res.data || {}
      if (d.processed) toast.success(`Analyzed ${d.processed} photo${d.processed !== 1 ? 's' : ''}${d.total_pending ? `, ${d.total_pending} remaining` : ''}`)
      else toast('No pending photos to analyze')
      await fetchAiStatus()
      queryClient.invalidateQueries({ queryKey: ['goldrush-stores'] })
    } catch {
      toast.error('AI analysis failed')
    } finally {
      setAiRunning(false)
    }
  }

  const handleMigratePhotos = async () => {
    setMigrating(true)
    setMigrationStatus('Starting…')
    try {
      try { await apiClient.post('/visit-photos/fix-urls') } catch { /* optional, ignore failure */ }
      let totalMigrated = 0
      let totalSkipped = 0
      for (let i = 0; i < 50; i++) {
        const res = await apiClient.post('/visit-photos/migrate-base64?limit=20')
        const d = res.data?.data || res.data || {}
        const migrated = d.migrated || 0
        const skipped = d.skipped || 0
        totalMigrated += migrated
        totalSkipped += skipped
        setMigrationStatus(`Migrated ${totalMigrated}, skipped ${totalSkipped}…`)
        if (migrated === 0 && skipped === 0) break
      }
      toast.success(`Migration complete: ${totalMigrated} migrated, ${totalSkipped} skipped`)
      await fetchAiStatus()
      queryClient.invalidateQueries({ queryKey: ['goldrush-stores'] })
    } catch {
      toast.error('Photo migration failed')
    } finally {
      setMigrating(false)
      setMigrationStatus('')
    }
  }

  const dateParams = startDate || endDate
    ? `?${startDate ? `startDate=${startDate}` : ''}${endDate ? `${startDate ? '&' : ''}endDate=${endDate}` : ''}`
    : ''
  // ponytail: company_id inert until report endpoints are parameterized
  const companyParam = selectedCompany ? `${startDate || endDate ? '&' : '?'}company_id=${selectedCompany}` : ''

  const handleEditGoldrushId = (store: GoldrushStore) => { setEditingId(store.id); setEditValue(store.goldrush_id || '') }
  const handleSaveGoldrushId = async (store: GoldrushStore) => {
    setSaving(true)
    try {
      await fieldOperationsService.updateVisit(store.id, { custom_field_values: { goldrush_id: editValue.trim() } })
      toast.success('Goldrush ID updated')
      setEditingId(null); setEditValue('')
      queryClient.invalidateQueries({ queryKey: ['goldrush-stores'] })
    } catch {
      toast.error('Failed to update Goldrush ID')
    } finally { setSaving(false) }
  }
  const handleCancelEdit = () => { setEditingId(null); setEditValue('') }

  const { data: stores = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['goldrush-stores', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/goldrush-stores${dateParams}${companyParam}`)
      return (res.data?.data || []) as GoldrushStore[]
    },
    enabled: !isStellr,
    staleTime: 1000 * 60 * 5,
  })

  const { data: stellrVisits = [], isLoading: stellrLoading, isError: stellrIsError, refetch: refetchStellr } = useQuery({
    queryKey: ['stellr-visits', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/stellr${dateParams}${companyParam}`)
      return (res.data?.data || []) as StellrVisit[]
    },
    enabled: isStellr,
    staleTime: 1000 * 60 * 5,
  })

  const filtered = stores.filter(store => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      store.store_name?.toLowerCase().includes(s) ||
      store.store_address?.toLowerCase().includes(s) ||
      store.agent_name?.toLowerCase().includes(s) ||
      store.goldrush_id?.toLowerCase().includes(s) ||
      store.stock_source?.toLowerCase().includes(s) ||
      store.competitors_in_store?.toLowerCase().includes(s)
    )
  })
  const stellrFiltered = stellrVisits.filter(v => {
    if (!search) return true
    const s = search.toLowerCase()
    return v.store_name?.toLowerCase().includes(s) || v.store_address?.toLowerCase().includes(s) || v.agent_name?.toLowerCase().includes(s)
  })

  const totalWithAds = stores.filter(s => s.has_advertising === 'Yes' || s.has_advertising === 'true').length
  const totalBoardInstalled = stores.filter(s => s.board_installed === 'Yes' || s.board_installed === 'true' || s.ai_board_detected).length
  const totalAiAnalyzed = stores.filter(s => s.ai_status === 'completed').length
  const avgSov = totalAiAnalyzed > 0 ? (stores.filter(s => s.ai_status === 'completed').reduce((sum, s) => sum + (s.ai_share_of_voice || 0), 0) / totalAiAnalyzed) : 0
  const adRate = stores.length > 0 ? (totalWithAds / stores.length) * 100 : 0
  const totalStellrAgents = new Set(stellrVisits.map(v => v.agent_name)).size

  const exportToExcel = () => {
    setExporting(true)
    try {
      if (stores.length === 0) { toast.error('No data to export'); return }
      const headers = [
        'Store Name', 'Store Address', 'Visit Date', 'Agent', 'Goldrush ID', 'Status',
        'Stock Source', 'Competitors in Store', 'Competitor Stock Source', 'Competitor Products', 'Competitor Prices',
        'Has Advertising', 'Other Ad Brands', 'Board Installed',
        'AI Status', 'AI Board Detected', 'AI Brand', 'AI Condition', 'AI Visibility', 'AI Board Type', 'AI Share of Voice %', 'AI Description',
        'Notes', 'GPS Latitude', 'GPS Longitude', 'Date Created',
      ]
      const rows = stores.map(s => [
        s.store_name || '', s.store_address || '', s.visit_date || '', s.agent_name || '', s.goldrush_id || '', s.status || '',
        s.stock_source || '', s.competitors_in_store || '', s.competitor_stock_source || '', s.competitor_products || '', s.competitor_prices || '',
        s.has_advertising || '', s.other_ad_brands || '', s.board_installed || '',
        s.ai_status || '', s.ai_board_detected ? 'Yes' : 'No', s.ai_brand || '', s.ai_condition || '', s.ai_visibility || '', s.ai_board_type || '', s.ai_share_of_voice?.toString() || '', s.ai_description || '',
        s.notes || '', s.gps_latitude?.toString() || '', s.gps_longitude?.toString() || '', s.created_at || '',
      ])
      const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')
      const BOM = '﻿'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `goldrush-store-report-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${stores.length} records`)
    } catch {
      toast.error('Export failed')
    } finally { setExporting(false) }
  }

  const exportStellrToCSV = () => {
    setExporting(true)
    try {
      if (stellrVisits.length === 0) { toast.error('No data to export'); return }
      const headers = [
        'Store Name', 'Store Address', 'Visit Date', 'Agent', 'Status', 'Outlet Type',
        'Product Range', 'Stock Availability', 'Shelf Position', 'POS Material', 'Brand Visibility', 'Cooler Installed',
        'Competitor Brands', 'Pricing Compliance', 'Notes', 'GPS Latitude', 'GPS Longitude', 'Date Created',
      ]
      const rows = stellrVisits.map(v => [
        v.store_name || '', v.store_address || '', v.visit_date || '', v.agent_name || '', v.status || '', v.outlet_type || '',
        v.product_range || '', v.stock_availability || '', v.shelf_position || '', v.pos_material || '', v.brand_visibility || '', v.cooler_installed || '',
        v.competitor_brands || '', v.pricing_compliance || '', v.notes || '', v.gps_latitude?.toString() || '', v.gps_longitude?.toString() || '', v.created_at || '',
      ])
      const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')
      const BOM = '﻿'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stellr-report-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${stellrVisits.length} records`)
    } catch {
      toast.error('Export failed')
    } finally { setExporting(false) }
  }

  const activeLoading = isStellr ? stellrLoading : isLoading
  const activeError = isStellr ? stellrIsError : isError
  const activeRefetch = isStellr ? refetchStellr : refetch

  return (
    <div className="space-y-6 print:space-y-3">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Goldrush — Stores</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Store visits, merchandising compliance & questionnaire data.</p>
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
          {activeTab === 'detail' && (
            <DateRangePresets startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
          )}
          {activeTab === 'detail' && !isStellr && (
            <>
              <button onClick={handleMigratePhotos} disabled={migrating} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1">
                {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {migrating ? (migrationStatus || 'Migrating…') : 'Migrate Photos'}
              </button>
              <button onClick={handleAiBackfill} disabled={aiRunning} className="px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 inline-flex items-center gap-1">
                {aiRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {aiRunning ? 'Analyzing…' : 'Analyze Photos'}
              </button>
            </>
          )}
          <button
            onClick={() => activeTab === 'insights' ? load() : activeRefetch()}
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
          {activeTab === 'detail' && (
            <button onClick={isStellr ? exportStellrToCSV : exportToExcel} disabled={exporting} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium">
              <Download className="h-4 w-4" /> {isStellr ? 'Export CSV' : 'Export Excel'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit print:hidden">
        <button onClick={() => setActiveTab('insights')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'insights' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          <ExternalLink className="h-4 w-4" /> Insights
        </button>
        <button onClick={() => setActiveTab('detail')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'detail' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          <Store className="h-4 w-4" /> Detail Report
        </button>
      </div>

      {/* ── Insights tab ── */}
      {activeTab === 'insights' && loading && !data && <div className="p-12 flex justify-center"><LoadingSpinner /></div>}
      {activeTab === 'insights' && error && <div className="p-8 text-center text-red-600">{error}</div>}
      {activeTab === 'insights' && data && (() => {
        const aiCoveragePct = data.totals.with_photos > 0 ? Math.round((data.totals.with_ai_completed / data.totals.with_photos) * 1000) / 10 : 0
        const photoCoveragePct = data.totals.stores_visited > 0 ? Math.round((data.totals.with_photos / data.totals.stores_visited) * 1000) / 10 : 0
        const stockPct = data.totals.stores_visited > 0 ? Math.round((data.totals.with_stock / data.totals.stores_visited) * 1000) / 10 : 0
        const adPct = data.totals.stores_visited > 0 ? Math.round((data.totals.with_advertising / data.totals.stores_visited) * 1000) / 10 : 0
        const boardPct = data.totals.stores_visited > 0 ? Math.round((data.totals.board_installed / data.totals.stores_visited) * 1000) / 10 : 0
        return (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Tile icon={<Store className="w-5 h-5" />} label="Store visits" value={data.totals.stores_visited.toLocaleString()} sub={`${data.totals.unique_stores} unique stores`} tone="bg-blue-50 text-blue-800" />
              <Tile icon={<CheckCircle className="w-5 h-5" />} label="Stocks product" value={`${stockPct}%`} tone="bg-emerald-50 text-emerald-800" />
              <Tile icon={<CheckCircle className="w-5 h-5" />} label="Has advertising" value={`${adPct}%`} tone="bg-amber-50 text-amber-800" />
              <Tile icon={<CheckCircle className="w-5 h-5" />} label="Board installed" value={`${boardPct}%`} tone="bg-green-50 text-green-800" />
              <Tile icon={<Sparkles className="w-5 h-5" />} label="AI photo coverage" value={`${aiCoveragePct}%`} sub={`${photoCoveragePct}% of visits have photos`} tone="bg-purple-50 text-purple-800" />
            </div>

            {data.totals.with_ai_failed > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {data.totals.with_ai_failed} store visit(s) failed AI photo analysis — use Analyze Photos to retry.
              </div>
            )}

            <Card title="Store visits over time" subtitle="Daily visit volume">
              {data.visitsOverTime.length === 0 ? <Empty msg="No visits in this period." /> : (
                <div ref={visitsRef}>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={data.visitsOverTime} margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="visits" stroke={ACCENT} fill={ACCENT} fillOpacity={0.15} name="Visits" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="AI share of voice over time" subtitle="Average and max share of voice detected in photos">
                {data.shareOfVoice.length === 0 ? <Empty msg="No AI share-of-voice data yet." /> : (
                  <div ref={sovRef}>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={data.shareOfVoice} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} unit="%" />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="avg_share_of_voice" stroke={ACCENT} strokeWidth={2} dot={false} name="Avg SoV %" />
                        <Line type="monotone" dataKey="max_share_of_voice" stroke={ORANGE} strokeWidth={2} dot={false} name="Max SoV %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
              <Card title="AI compliance over time" subtitle="Average board/merchandising compliance detected">
                {data.compliance.length === 0 ? <Empty msg="No AI compliance data yet." /> : (
                  <div ref={complianceRef}>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={data.compliance} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} unit="%" />
                        <Tooltip />
                        <Line type="monotone" dataKey="avg_compliance" stroke={GREEN} strokeWidth={2} dot={false} name="Avg compliance %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="AI-detected brands on shelf" subtitle="From automated photo analysis">
                {data.aiBrandsDetected.length === 0 ? <Empty msg="No AI brand detections yet." /> : (
                  <div ref={aiBrandsRef}>
                    <ResponsiveContainer width="100%" height={Math.max(220, data.aiBrandsDetected.length * 22)}>
                      <BarChart data={data.aiBrandsDetected} layout="vertical" margin={{ top: 4, right: 16, left: 60, bottom: 4 }}>
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
              <Card title="Competitors in store" subtitle="Mentioned in questionnaire (top 20)">
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="Stock sources" subtitle="Where agents say stores source Goldrush product">
                {data.stockSources.length === 0 ? <Empty msg="No stock source data." /> : (
                  <ul className="divide-y divide-gray-100">
                    {data.stockSources.map(s => (
                      <li key={s.name} className="flex justify-between py-1.5 text-sm"><span className="text-gray-700">{s.name}</span><span className="font-semibold text-gray-900">{s.count}</span></li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Other advertising brands" subtitle="Non-Goldrush advertising seen in store">
                {data.adBrands.length === 0 ? <Empty msg="No other advertising brands captured." /> : (
                  <ul className="divide-y divide-gray-100">
                    {data.adBrands.map(a => (
                      <li key={a.name} className="flex justify-between py-1.5 text-sm"><span className="text-gray-700">{a.name}</span><span className="font-semibold text-gray-900">{a.count}</span></li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card title="Compliance signals" subtitle="Yes/no/other per question, all store visits in period">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {radios.map(row => (
                  <div key={row.label} className="bg-gray-50 rounded-md p-3">
                    <div className="text-sm font-medium text-gray-800 mb-2">{row.label}</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-green-100 rounded p-2"><div className="text-xs text-green-800">Yes</div><div className="text-xl font-bold text-green-900">{row.v.yes}</div></div>
                      <div className="bg-red-100 rounded p-2"><div className="text-xs text-red-800">No</div><div className="text-xl font-bold text-red-900">{row.v.no}</div></div>
                      <div className="bg-gray-200 rounded p-2"><div className="text-xs text-gray-700">Other</div><div className="text-xl font-bold text-gray-800">{row.v.other}</div></div>
                    </div>
                    {(row.v.yes + row.v.no) > 0 && (
                      <div className="mt-2 h-1.5 bg-gray-200 rounded">
                        <div className="h-full rounded" style={{ width: `${(row.v.yes / (row.v.yes + row.v.no)) * 100}%`, backgroundColor: row.color }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Top stores by visits" subtitle="Top 15 by visit count in period">
              {data.topStores.length === 0 ? <Empty msg="No stores to rank." /> : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><Th>Store</Th><Th>Visits</Th></tr></thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {data.topStores.map((s, i) => (
                        <tr key={s.name + i}><Td className="font-medium">{s.name}</Td><Td>{s.visits.toLocaleString()}</Td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <p className="text-xs text-gray-400 text-center print:hidden">FieldVibe — Goldrush stores insights</p>
          </>
        )
      })()}

      {/* ── Detail tab ── */}
      {activeTab === 'detail' && (
        <>
          {activeLoading ? <LoadingSpinner /> : activeError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Failed to load data</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Please try refreshing the page</p>
            </div>
          ) : isStellr ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2"><Store className="h-4 w-4 text-blue-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Total Store Visits</span></div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stellrVisits.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2"><CheckCircle className="h-4 w-4 text-purple-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Total Agents</span></div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalStellrAgents}</p>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by store, address, or agent..." className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400" />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Store</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Agent</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stellrFiltered.length === 0 ? (
                        <tr><td colSpan={3} className="py-12 text-center text-gray-400">{stellrVisits.length === 0 ? 'No store visits found' : 'No records match your search'}</td></tr>
                      ) : stellrFiltered.map(v => (
                        <tr key={v.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="py-3 px-4 text-gray-900 dark:text-white font-medium whitespace-nowrap">{v.store_name}<div className="text-xs text-gray-400 font-normal">{v.store_address}</div></td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{v.agent_name || '—'}</td>
                          <td className="py-3 px-4"><button onClick={() => setDetailVisit(v)} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100">View</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {stellrFiltered.length > 0 && (
                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">Showing {stellrFiltered.length} of {stellrVisits.length} records</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2"><Store className="h-4 w-4 text-blue-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Store Visits</span></div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stores.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2"><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Has Advertising</span></div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalWithAds}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2"><CheckCircle className="h-4 w-4 text-emerald-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Board Installed</span></div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalBoardInstalled}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2"><XCircle className="h-4 w-4 text-amber-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Ad Coverage %</span></div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{adRate.toFixed(1)}%</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4 text-purple-500" /><span className="text-xs text-gray-500 dark:text-gray-400">AI Analyzed</span></div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAiAnalyzed} <span className="text-sm font-normal text-gray-400">of {stores.length}</span></p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2"><CheckCircle className="h-4 w-4 text-sky-500" /><span className="text-xs text-gray-500 dark:text-gray-400">Avg Share of Voice</span></div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgSov.toFixed(1)}%</p>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by store, agent, Goldrush ID, stock source, or competitor..." className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400" />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Photo</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Store</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Goldrush ID</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Agent</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Stock Source</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Competitors</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Advertising</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Board</th>
                        {extraStoreColumns.map((col: any) => (
                          <th key={col.key} className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{col.label}</th>
                        ))}
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">AI Analysis</th>
                        <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Visit Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={10 + extraStoreColumns.length} className="py-12 text-center text-gray-400">{stores.length === 0 ? 'No Goldrush store records found' : 'No records match your search'}</td></tr>
                      ) : filtered.map((store) => (
                        <tr key={store.id} className="group border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="py-3 px-4">
                            {store.thumbnail_url ? (
                              <button onClick={() => setExpandedPhoto(store.thumbnail_url)} className="block">
                                <img src={store.thumbnail_url} alt="Visit photo" className="w-10 h-10 rounded object-cover border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity" />
                              </button>
                            ) : store.has_photos ? (
                              <button onClick={() => handleViewPhotos(store.id)} className="inline-flex items-center justify-center w-10 h-10 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors" title="Click to view photos">
                                <Camera className="w-4 h-4 text-blue-500" />
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">No photo</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-900 dark:text-white font-medium whitespace-nowrap">{store.store_name}<div className="text-xs text-gray-400 font-normal">{store.store_address}</div></td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {editingId === store.id ? (
                              <div className="flex items-center gap-1">
                                <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-28 px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500" placeholder="Goldrush ID" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveGoldrushId(store); if (e.key === 'Escape') handleCancelEdit(); }} />
                                <button onClick={() => handleSaveGoldrushId(store)} disabled={saving} className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50" title="Save"><Save className="w-3.5 h-3.5" /></button>
                                <button onClick={handleCancelEdit} className="p-1 text-gray-400 hover:text-gray-600" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className={`font-medium ${store.goldrush_id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>{store.goldrush_id || '—'}</span>
                                <button onClick={() => handleEditGoldrushId(store)} className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Edit Goldrush ID"><Edit2 className="w-3 h-3" /></button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{store.agent_name || '—'}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{store.stock_source || '—'}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{store.competitors_in_store || '—'}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${store.has_advertising === 'Yes' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{store.has_advertising || 'No'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${store.board_installed === 'Yes' || store.ai_board_detected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                              {store.board_installed === 'Yes' ? 'Yes' : store.ai_board_detected ? 'Yes (AI)' : 'No'}
                            </span>
                          </td>
                          {extraStoreColumns.map((col: any) => (
                            <td key={col.key} className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{(store as any)[col.key] || '—'}</td>
                          ))}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {store.ai_status === 'completed' ? (
                              <div className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
                                <div>Brand: <span className="font-medium">{store.ai_brand || '—'}</span></div>
                                <div>Condition: {store.ai_condition || '—'}</div>
                                <div>Visibility: {store.ai_visibility || '—'}</div>
                                <div>SoV: {store.ai_share_of_voice != null ? `${store.ai_share_of_voice}%` : '—'}</div>
                                <div>Type: {store.ai_board_type || '—'}</div>
                              </div>
                            ) : store.ai_status === 'processing' ? (
                              <span className="inline-flex items-center gap-1 text-xs text-blue-600"><Loader2 className="w-3 h-3 animate-spin" /> Processing…</span>
                            ) : store.ai_status === 'failed' ? (
                              <span className="text-xs text-red-600 font-medium">Failed</span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{store.visit_date ? new Date(store.visit_date).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filtered.length > 0 && (
                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">Showing {filtered.length} of {stores.length} records</div>
                )}
              </div>
            </>
          )}
        </>
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

      {/* Stellr Visit Detail Modal */}
      {detailVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setDetailVisit(null)}>
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{detailVisit.store_name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{detailVisit.store_address}</p>
              </div>
              <button onClick={() => setDetailVisit(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">Agent:</span> <span className="text-gray-900 dark:text-white font-medium">{detailVisit.agent_name || '—'}</span></div>
                <div><span className="text-gray-400">Visit Date:</span> <span className="text-gray-900 dark:text-white font-medium">{detailVisit.visit_date ? new Date(detailVisit.visit_date).toLocaleDateString() : '—'}</span></div>
                <div><span className="text-gray-400">Status:</span> <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{detailVisit.status || '—'}</span></div>
                <div><span className="text-gray-400">GPS:</span> <span className="text-gray-900 dark:text-white font-medium">{detailVisit.gps_latitude && detailVisit.gps_longitude ? `${detailVisit.gps_latitude.toFixed(4)}, ${detailVisit.gps_longitude.toFixed(4)}` : '—'}</span></div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Questionnaire Answers</h4>
                <div className="space-y-1.5">
                  {Object.entries(detailVisit.raw_responses || {}).filter(([, v]) => v != null && v !== '' && !isPhotoUrl(v)).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-sm border-b border-gray-50 dark:border-gray-700/50 pb-1">
                      <span className="text-gray-500 dark:text-gray-400">{formatKey(key)}</span>
                      <span className="text-gray-900 dark:text-white font-medium text-right ml-4">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {Object.entries(detailVisit.raw_responses || {}).some(([, v]) => isPhotoUrl(v)) && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Photos in Questionnaire</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(detailVisit.raw_responses || {}).filter(([, v]) => isPhotoUrl(v)).map(([key, val]) => (
                      <div key={key}>
                        <button onClick={() => setExpandedPhoto(val as string)} className="block w-full">
                          <img src={val as string} alt={formatKey(key)} className="w-full h-24 object-cover rounded border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity" />
                        </button>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-center truncate">{formatKey(key)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailVisit.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Notes</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{detailVisit.notes}</p>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              {detailVisit.has_photos && (
                <button onClick={() => { const id = detailVisit.id; setDetailVisit(null); handleViewPhotos(id); }} className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">View All Photos</button>
              )}
              <button onClick={() => setDetailVisit(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Tile({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className={`rounded-lg p-4 ${tone}`}>
      <div className="flex items-center gap-2 text-sm font-medium opacity-80">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
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
