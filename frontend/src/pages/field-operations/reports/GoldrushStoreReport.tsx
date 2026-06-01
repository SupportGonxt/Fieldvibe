import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import { fieldOperationsService } from '../../../services/field-operations.service'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { Download, Store, Search, CheckCircle, XCircle, AlertTriangle, Edit2, Save, X, Camera, Sparkles, Loader2, Upload, RefreshCw, Eye, User, MapPin, Calendar, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'
import DateRangePresets from '../../../components/ui/DateRangePresets'

interface GoldrushStore {
  id: string
  visit_date: string
  status: string
  store_name: string
  store_address: string
  agent_name: string
  goldrush_id: string
  thumbnail_url: string
  has_photos: boolean
  shop_exterior_photo: string
  competitor_photo: string
  ad_board_photo: string
  gps_latitude: number
  gps_longitude: number
  created_at: string
  notes: string
  stock_source: string
  competitors_in_store: string
  competitor_stock_source: string
  competitor_products: string
  competitor_prices: string
  has_advertising: string
  other_ad_brands: string
  board_installed: string
  ai_status: string | null
  ai_board_detected: boolean
  ai_photos_analyzed: number
  ai_share_of_voice: number
  ai_brand: string
  ai_condition: string
  ai_visibility: string
  ai_board_type: string
  ai_description: string
}

interface StellrVisit {
  id: string
  visit_date: string
  status: string
  store_name: string
  store_address: string
  agent_name: string
  thumbnail_url: string
  has_photos: boolean
  gps_latitude: number
  gps_longitude: number
  created_at: string
  notes: string
  product_range: string
  stock_availability: string
  shelf_position: string
  pos_material: string
  competitor_brands: string
  pricing_compliance: string
  brand_visibility: string
  cooler_installed: string
  outlet_type: string
  raw_responses: Record<string, string>
}

function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function isPhotoUrl(val: string): boolean {
  if (!val || typeof val !== 'string') return false
  return val.startsWith('http') || val.startsWith('data:image')
}

const GoldrushStoreReport: React.FC = () => {
  const queryClient = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)
  const [photoModalVisitId, setPhotoModalVisitId] = useState<string | null>(null)
  const [photoModalPhotos, setPhotoModalPhotos] = useState<Array<{ id: string; photo_type: string; label?: string; r2_url: string }>>([])
  const [photoModalLoading, setPhotoModalLoading] = useState(false)
  const [aiRunning, setAiRunning] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<{ migrated: number; skipped: number; total_remaining: number } | null>(null)
  const [detailVisit, setDetailVisit] = useState<StellrVisit | null>(null)
  const [allPhotosOpen, setAllPhotosOpen] = useState(false)

  const handleViewPhotos = async (visitId: string) => {
    setPhotoModalVisitId(visitId)
    setPhotoModalLoading(true)
    setPhotoModalPhotos([])
    try {
      const res = await apiClient.get("/visits/" + visitId + "/photos")
      setPhotoModalPhotos(res.data?.data || [])
    } catch {
      toast.error('Failed to load photos')
    } finally {
      setPhotoModalLoading(false)
    }
  }

  const fetchAiStatus = async () => {
    try {
      await apiClient.get('/visit-photos/ai-status')
    } catch { /* ignore */ }
  }

  const handleAiBackfill = async () => {
    setAiRunning(true)
    try {
      const res = await apiClient.post('/visit-photos/ai-backfill?limit=20')
      const data = res.data
      if (data.processed > 0) {
        toast.success(`AI analysis triggered for ${data.processed} photos (${data.total_pending} remaining)`)
      } else {
        toast.success('No unanalyzed photos found')
      }
      await fetchAiStatus()
      queryClient.invalidateQueries({ queryKey: ['goldrush-stores'] })
    } catch {
      toast.error('Failed to trigger AI analysis')
    } finally {
      setAiRunning(false)
    }
  }

  const handleMigratePhotos = async () => {
    setMigrating(true)
    try {
      try {
        await apiClient.post('/visit-photos/fix-urls')
      } catch { /* fix-urls is optional, continue with migration */ }

      let totalMigrated = 0
      let totalSkipped = 0
      let remaining = 1
      while (remaining > 0) {
        const res = await apiClient.post('/visit-photos/migrate-base64?limit=20')
        const data = res.data
        totalMigrated += data.migrated || 0
        totalSkipped += data.skipped || 0
        remaining = data.total_remaining || 0
        setMigrationStatus({ migrated: totalMigrated, skipped: totalSkipped, total_remaining: remaining })
        if ((data.migrated || 0) === 0 && (data.skipped || 0) === 0) break
      }
      if (totalMigrated > 0) {
        toast.success(`Migrated ${totalMigrated} photos to R2 (${totalSkipped} duplicates skipped)`)
      } else {
        toast.success('No base64 photos to migrate')
      }
      await fetchAiStatus()
      queryClient.invalidateQueries({ queryKey: ['goldrush-stores'] })
    } catch {
      toast.error('Failed to migrate photos')
    } finally {
      setMigrating(false)
    }
  }

  useEffect(() => { fetchAiStatus() }, [])

  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })
  const companies = companiesResp?.data || companiesResp || []

  useEffect(() => {
    if (Array.isArray(companies) && companies.length > 0 && !selectedCompany) {
      const goldrush = companies.find((c: any) => c.name?.toLowerCase().includes('goldrush'))
      if (goldrush) {
        setSelectedCompany(goldrush.id)
      } else if (companies.length === 1) {
        setSelectedCompany(companies[0].id)
      }
    }
  }, [companies, selectedCompany])

  const selectedCompanyObj = Array.isArray(companies) ? companies.find((c: any) => c.id === selectedCompany) : null
  const isStellr = !!selectedCompanyObj?.name?.toLowerCase().includes('stellr')

  const dateParams = startDate || endDate
    ? `?${startDate ? `startDate=${startDate}` : ''}${endDate ? `${startDate ? '&' : ''}endDate=${endDate}` : ''}`
    : ''
  const companyParam = selectedCompany ? `${startDate || endDate ? '&' : '?'}company_id=${selectedCompany}` : ''

  const handleEditGoldrushId = (store: GoldrushStore) => {
    setEditingId(store.id)
    setEditValue(store.goldrush_id || '')
  }

  const handleSaveGoldrushId = async (store: GoldrushStore) => {
    setSaving(true)
    try {
      await fieldOperationsService.updateVisit(store.id, {
        custom_field_values: { goldrush_id: editValue.trim() }
      })
      toast.success('Goldrush ID updated')
      setEditingId(null)
      setEditValue('')
      queryClient.invalidateQueries({ queryKey: ['goldrush-stores'] })
    } catch {
      toast.error('Failed to update Goldrush ID')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const { data: stores = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['goldrush-stores', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/goldrush-stores${dateParams}${companyParam}`)
      return (res.data?.data || []) as GoldrushStore[]
    },
    enabled: !isStellr,
    staleTime: 1000 * 60 * 5,
  })

  const { data: stellrVisits = [], isLoading: stellrLoading, isError: stellrError, refetch: stellrRefetch } = useQuery({
    queryKey: ['stellr-visits', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/stellr${dateParams}${companyParam}`)
      return (res.data?.data || []) as StellrVisit[]
    },
    enabled: isStellr,
    staleTime: 1000 * 60 * 5,
  })

  const filtered = stores.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.store_name?.toLowerCase().includes(q) ||
      s.store_address?.toLowerCase().includes(q) ||
      s.agent_name?.toLowerCase().includes(q) ||
      s.goldrush_id?.toLowerCase().includes(q) ||
      s.stock_source?.toLowerCase().includes(q) ||
      s.competitors_in_store?.toLowerCase().includes(q)
    )
  })

  const stellrFiltered = stellrVisits.filter(v => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      v.store_name?.toLowerCase().includes(q) ||
      v.store_address?.toLowerCase().includes(q) ||
      v.agent_name?.toLowerCase().includes(q)
    )
  })

  const allPhotos = filtered.flatMap(s => {
    const items: Array<{ url: string; label: string; store: string; agent: string; visit_date: string }> = []
    const push = (url: string | undefined | null, type: string) => {
      if (url && isPhotoUrl(url)) {
        items.push({ url, label: type, store: s.store_name || 'Unknown store', agent: s.agent_name || '', visit_date: s.visit_date || '' })
      }
    }
    push(s.shop_exterior_photo, 'Shop Exterior')
    push(s.ad_board_photo, 'Ad Board')
    push(s.competitor_photo, 'Competitor')
    // Fallback to thumbnail when none of the labelled photos exist
    if (items.length === 0) push(s.thumbnail_url, 'Visit photo')
    return items
  })

  const totalWithAds = stores.filter(s => s.has_advertising === 'Yes').length
  const totalBoardInstalled = stores.filter(s => s.board_installed === 'Yes' || s.ai_board_detected).length
  const totalAiAnalyzed = stores.filter(s => s.ai_status === 'completed' || s.ai_photos_analyzed > 0).length
  const avgSov = stores.length > 0 ? (stores.reduce((sum, s) => sum + (s.ai_share_of_voice || 0), 0) / Math.max(stores.filter(s => s.ai_share_of_voice > 0).length, 1)).toFixed(1) : '0'
  const adRate = stores.length > 0 ? ((totalWithAds / stores.length) * 100).toFixed(1) : '0'
  const totalStellrAgents = new Set(stellrVisits.map(v => v.agent_name).filter(Boolean)).size

  const exportToExcel = () => {
    setExporting(true)
    try {
      if (filtered.length === 0) { toast.error('No data to export'); return }
      const headers = [
        'Store Name', 'Store Address', 'Visit Date', 'Agent', 'Goldrush ID', 'Status',
        'Stock Source', 'Competitors in Store', 'Competitor Stock Source',
        'Competitor Products', 'Competitor Prices',
        'Has Advertising', 'Other Ad Brands', 'Board Installed',
        'AI Status', 'AI Board Detected', 'AI Brand', 'AI Condition', 'AI Visibility',
        'AI Board Type', 'AI Share of Voice %', 'AI Description',
        'Notes', 'GPS Latitude', 'GPS Longitude', 'Date Created'
      ]
      const rows = filtered.map(s => [
        s.store_name || '', s.store_address || '', s.visit_date || '', s.agent_name || '',
        s.goldrush_id || '', s.status || '', s.stock_source || '', s.competitors_in_store || '',
        s.competitor_stock_source || '', s.competitor_products || '', s.competitor_prices || '',
        s.has_advertising || '', s.other_ad_brands || '',
        s.board_installed === 'Yes' || s.ai_board_detected ? 'Yes' : (s.board_installed || ''),
        s.ai_status || '', s.ai_board_detected ? 'Yes' : 'No',
        s.ai_brand || '', s.ai_condition || '', s.ai_visibility || '', s.ai_board_type || '',
        s.ai_share_of_voice ? String(s.ai_share_of_voice) + '%' : '',
        s.ai_description || '', s.notes || '',
        s.gps_latitude?.toString() || '', s.gps_longitude?.toString() || '', s.created_at || '',
      ])
      const csvContent = [
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n')
      const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `goldrush-store-report-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${filtered.length} records`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const exportStellrToCSV = () => {
    setExporting(true)
    try {
      if (stellrFiltered.length === 0) { toast.error('No data to export'); return }
      const headers = [
        'Store Name', 'Store Address', 'Visit Date', 'Agent', 'Status',
        'Outlet Type', 'Product Range', 'Stock Availability', 'Shelf Position',
        'POS Material', 'Brand Visibility', 'Cooler Installed',
        'Competitor Brands', 'Pricing Compliance',
        'Notes', 'GPS Latitude', 'GPS Longitude', 'Date Created',
      ]
      const rows = stellrFiltered.map(v => [
        v.store_name || '', v.store_address || '', v.visit_date || '', v.agent_name || '',
        v.status || '', v.outlet_type || '', v.product_range || '', v.stock_availability || '',
        v.shelf_position || '', v.pos_material || '', v.brand_visibility || '',
        v.cooler_installed || '', v.competitor_brands || '', v.pricing_compliance || '',
        v.notes || '', v.gps_latitude?.toString() || '', v.gps_longitude?.toString() || '', v.created_at || '',
      ])
      const csvContent = [
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')
      const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stellr-report-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${stellrFiltered.length} records`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const activeLoading = isStellr ? stellrLoading : isLoading
  const activeError = isStellr ? stellrError : isError
  const activeRefetch = isStellr ? stellrRefetch : refetch

  if (activeLoading) return <LoadingSpinner />
  if (activeError) return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Failed to load data</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">Please try refreshing the page</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stores Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Store visits and questionnaire data</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Array.isArray(companies) && companies.length > 1 && (
            <SearchableSelect
              options={[
                { value: '', label: 'All Companies' },
                ...companies.map((c: any) => ({ value: c.id, label: c.name }))
              ]}
              value={selectedCompany || null}
              onChange={(val) => setSelectedCompany(val || '')}
              placeholder="All Companies"
            />
          )}
          <DateRangePresets
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
          {!isStellr && (
            <>
              <button onClick={handleMigratePhotos} disabled={migrating}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {migrating ? `Migrating${migrationStatus ? ` (${migrationStatus.migrated} done, ${migrationStatus.total_remaining} left)` : '...'}` : 'Migrate Photos'}
              </button>
              <button onClick={handleAiBackfill} disabled={aiRunning}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
                {aiRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiRunning ? 'Analyzing...' : 'Analyze Photos'}
              </button>
            </>
          )}
          <button onClick={() => activeRefetch()}
            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          {!isStellr && (
            <button onClick={() => setAllPhotosOpen(true)} disabled={allPhotos.length === 0}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
              title={allPhotos.length === 0 ? 'No photos available' : `View ${allPhotos.length} photos`}>
              <Camera className="h-4 w-4" /> View All Photos{allPhotos.length > 0 ? ` (${allPhotos.length})` : ''}
            </button>
          )}
          <button
            onClick={isStellr ? exportStellrToCSV : exportToExcel}
            disabled={exporting || (isStellr ? stellrFiltered.length === 0 : filtered.length === 0)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium">
            <Download className="h-4 w-4" /> Export {isStellr ? 'CSV' : 'Excel'}
          </button>
        </div>
      </div>

      {isStellr ? (
        <>
          {/* Stellr KPI Cards */}
          <div className="grid grid-cols-2 gap-4 max-w-xs">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Store className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Total Store Visits</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stellrVisits.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-indigo-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Total Agents</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalStellrAgents}</p>
            </div>
          </div>

          {/* Stellr Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by store name, address, or agent..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          {/* Stellr Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Store</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Agent</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stellrFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-gray-400">
                        {stellrVisits.length === 0 ? 'No store visit records found' : 'No records match your search'}
                      </td>
                    </tr>
                  ) : stellrFiltered.map((v) => (
                    <tr key={v.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-3 px-4">
                        <p className="text-gray-900 dark:text-white font-medium whitespace-nowrap">{v.store_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">{v.store_address || ''}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{v.agent_name || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setDetailVisit(v)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 text-xs font-medium transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stellrFiltered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                Showing {stellrFiltered.length} of {stellrVisits.length} records
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Goldrush KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Store className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Total Store Visits</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stores.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Has Advertising</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalWithAds}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Board Installed</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalBoardInstalled}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Ad Coverage</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{adRate}%</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">AI Analyzed</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAiAnalyzed}</p>
              <p className="text-xs text-gray-400 mt-1">of {stores.length} visits</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Avg Share of Voice</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgSov}%</p>
            </div>
          </div>

          {/* Goldrush Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by store name, address, agent, Goldrush ID, or stock source..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          {/* Goldrush Data Table */}
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
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Advertising</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Board</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">AI Analysis</th>
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Visit Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-400">
                        {stores.length === 0 ? 'No store visit records found' : 'No records match your search'}
                      </td>
                    </tr>
                  ) : filtered.map((s) => (
                    <tr key={s.id} className="group border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-3 px-4">
                        {s.thumbnail_url ? (
                          <button onClick={() => setExpandedPhoto(s.thumbnail_url)} className="block">
                            <img src={s.thumbnail_url} alt="Visit photo" className="w-10 h-10 rounded object-cover border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity" />
                          </button>
                        ) : s.has_photos ? (
                          <button onClick={() => handleViewPhotos(s.id)} className="inline-flex items-center justify-center w-10 h-10 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors" title="Click to view photos">
                            <Camera className="w-4 h-4 text-blue-500" />
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">No photo</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-900 dark:text-white font-medium whitespace-nowrap">{s.store_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{s.store_address || ''}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {editingId === s.id ? (
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
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveGoldrushId(s); if (e.key === 'Escape') handleCancelEdit(); }}
                            />
                            <button onClick={() => handleSaveGoldrushId(s)} disabled={saving} className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50" title="Save">
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={handleCancelEdit} className="p-1 text-gray-400 hover:text-gray-600" title="Cancel">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={`font-medium ${s.goldrush_id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                              {s.goldrush_id || '—'}
                            </span>
                            <button onClick={() => handleEditGoldrushId(s)} className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Edit Goldrush ID">
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{s.agent_name || '—'}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{s.stock_source || '—'}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{s.competitors_in_store || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.has_advertising === 'Yes' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {s.has_advertising || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.board_installed === 'Yes' || s.ai_board_detected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400'
                        }`}>
                          {s.board_installed === 'Yes' || s.ai_board_detected ? 'Yes' : (s.board_installed || 'N/A')}
                          {s.ai_board_detected && s.board_installed !== 'Yes' && <span className="ml-1 text-[10px] opacity-70">(AI)</span>}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {s.ai_status === 'completed' ? (
                          <div className="space-y-1">
                            {s.ai_brand && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400 uppercase">Brand:</span>
                                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{s.ai_brand}</span>
                              </div>
                            )}
                            {s.ai_condition && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400 uppercase">Condition:</span>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  s.ai_condition === 'good' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                  s.ai_condition === 'damaged' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                }`}>{s.ai_condition}</span>
                              </div>
                            )}
                            {s.ai_visibility && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400 uppercase">Visibility:</span>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  s.ai_visibility === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                  s.ai_visibility === 'low' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                }`}>{s.ai_visibility}</span>
                              </div>
                            )}
                            {s.ai_share_of_voice > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400 uppercase">SoV:</span>
                                <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">{s.ai_share_of_voice}%</span>
                              </div>
                            )}
                            {s.ai_board_type && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400 uppercase">Type:</span>
                                <span className="text-xs text-gray-600 dark:text-gray-400">{s.ai_board_type}</span>
                              </div>
                            )}
                            {!s.ai_brand && !s.ai_condition && !s.ai_visibility && s.ai_description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title={s.ai_description}>{s.ai_description}</p>
                            )}
                          </div>
                        ) : s.ai_status === 'processing' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <Loader2 className="w-3 h-3 animate-spin" /> Processing
                          </span>
                        ) : s.ai_status === 'failed' ? (
                          <span className="text-xs text-red-500">Failed</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {s.visit_date || (s.created_at ? new Date(s.created_at).toLocaleDateString() : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                Showing {filtered.length} of {stores.length} records
              </div>
            )}
          </div>
        </>
      )}

      {/* Photo Expand Modal */}
      {expandedPhoto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={() => setExpandedPhoto(null)}>
          <div className="relative max-w-3xl max-h-[90vh] p-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => setExpandedPhoto(null)} className="absolute top-0 right-0 m-2 p-1 bg-white dark:bg-gray-800 rounded-full shadow-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 z-10">
              <X className="w-5 h-5" />
            </button>
            <img src={expandedPhoto} alt="Visit photo expanded" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
          </div>
        </div>
      )}

      {/* All Photos Gallery Modal */}
      {allPhotosOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setAllPhotosOpen(false)}>
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Store Photos</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{allPhotos.length} photos across {filtered.length} visits</p>
              </div>
              <button onClick={() => setAllPhotosOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {allPhotos.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No photos available for the current filters</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {allPhotos.map((photo, idx) => (
                    <div key={`${photo.url}-${idx}`} className="relative group">
                      <button onClick={() => setExpandedPhoto(photo.url)} className="block w-full">
                        <img src={photo.url} alt={photo.label} loading="lazy" className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity" />
                      </button>
                      <div className="mt-1.5 text-xs">
                        <p className="text-gray-900 dark:text-white font-medium truncate" title={photo.store}>{photo.store}</p>
                        <p className="text-gray-500 dark:text-gray-400 truncate">
                          {photo.label}{photo.agent ? ` · ${photo.agent}` : ''}{photo.visit_date ? ` · ${photo.visit_date}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visit Photos Gallery Modal */}
      {photoModalVisitId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => { setPhotoModalVisitId(null); setPhotoModalPhotos([]) }}>
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Visit Photos</h3>
              <button onClick={() => { setPhotoModalVisitId(null); setPhotoModalPhotos([]) }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetailVisit(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{detailVisit.store_name}</h2>
                {detailVisit.store_address && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" /> {detailVisit.store_address}
                  </p>
                )}
              </div>
              <button onClick={() => setDetailVisit(null)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Agent</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{detailVisit.agent_name || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Visit Date</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {detailVisit.visit_date || (detailVisit.created_at ? new Date(detailVisit.created_at).toLocaleDateString() : '—')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      detailVisit.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : detailVisit.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>{detailVisit.status || '—'}</span>
                  </div>
                </div>
                {(detailVisit.gps_latitude || detailVisit.gps_longitude) && (
                  <div className="flex items-center gap-2 col-span-2 sm:col-span-3">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">GPS</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {Number(detailVisit.gps_latitude).toFixed(6)}, {Number(detailVisit.gps_longitude).toFixed(6)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  <ClipboardList className="w-4 h-4" /> Questionnaire Answers
                </h3>
                {detailVisit.raw_responses && Object.keys(detailVisit.raw_responses).length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {Object.entries(detailVisit.raw_responses)
                      .filter(([, val]) => val !== null && val !== undefined && val !== '' && !isPhotoUrl(String(val)))
                      .map(([key, val]) => (
                        <div key={key} className="flex items-start px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-48 shrink-0 pt-0.5">{formatKey(key)}</span>
                          <span className="text-sm text-gray-900 dark:text-white flex-1 break-words">{String(val)}</span>
                        </div>
                      ))}
                    {Object.entries(detailVisit.raw_responses).filter(([, val]) => val !== null && val !== undefined && val !== '' && !isPhotoUrl(String(val))).length === 0 && (
                      <p className="px-4 py-4 text-sm text-gray-400 text-center">No questionnaire answers recorded</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">No questionnaire answers recorded</p>
                )}
              </div>
              {detailVisit.raw_responses && Object.entries(detailVisit.raw_responses).some(([, v]) => isPhotoUrl(String(v))) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Camera className="w-4 h-4" /> Photos in Questionnaire
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(detailVisit.raw_responses)
                      .filter(([, v]) => isPhotoUrl(String(v)))
                      .map(([key, url]) => (
                        <div key={key}>
                          <button onClick={() => setExpandedPhoto(String(url))} className="block w-full">
                            <img src={String(url)} alt={formatKey(key)} className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity" />
                          </button>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-center truncate">{formatKey(key)}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {detailVisit.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 rounded-lg px-4 py-3">{detailVisit.notes}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 flex gap-3 justify-end">
              {detailVisit.has_photos && (
                <button
                  onClick={() => { setDetailVisit(null); handleViewPhotos(detailVisit.id) }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 text-sm font-medium"
                >
                  <Camera className="w-4 h-4" /> View All Photos
                </button>
              )}
              <button onClick={() => setDetailVisit(null)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GoldrushStoreReport
