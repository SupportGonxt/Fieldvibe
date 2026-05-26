import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import { fieldOperationsService } from '../../../services/field-operations.service'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { Download, Store, Search, AlertTriangle, RefreshCw, Camera, X, Eye, MapPin, User, Calendar, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'
import DateRangePresets from '../../../components/ui/DateRangePresets'

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
  // Mapped questionnaire fields
  product_range: string
  stock_availability: string
  shelf_position: string
  pos_material: string
  competitor_brands: string
  pricing_compliance: string
  brand_visibility: string
  cooler_installed: string
  outlet_type: string
  // Full raw questionnaire answers
  raw_responses: Record<string, string>
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function isPhotoUrl(val: string): boolean {
  if (!val || typeof val !== 'string') return false
  return val.startsWith('http') || val.startsWith('data:image')
}

const StellrReport: React.FC = () => {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)
  const [photoModalVisitId, setPhotoModalVisitId] = useState<string | null>(null)
  const [photoModalPhotos, setPhotoModalPhotos] = useState<Array<{ id: string; photo_type: string; label?: string; r2_url: string }>>([])
  const [photoModalLoading, setPhotoModalLoading] = useState(false)
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

  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })
  const companies = companiesResp?.data || companiesResp || []

  React.useEffect(() => {
    if (Array.isArray(companies) && companies.length === 1 && !selectedCompany) {
      setSelectedCompany(companies[0].id)
    }
  }, [companies, selectedCompany])

  const dateParams = startDate || endDate
    ? `?${startDate ? `startDate=${startDate}` : ''}${endDate ? `${startDate ? '&' : ''}endDate=${endDate}` : ''}`
    : ''
  const companyParam = selectedCompany ? `${startDate || endDate ? '&' : '?'}company_id=${selectedCompany}` : ''

  const { data: visits = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['stellr-visits', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/stellr${dateParams}${companyParam}`)
      return (res.data?.data || []) as StellrVisit[]
    },
    staleTime: 1000 * 60 * 5,
  })

  const filtered = visits.filter(v => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      v.store_name?.toLowerCase().includes(q) ||
      v.store_address?.toLowerCase().includes(q) ||
      v.agent_name?.toLowerCase().includes(q) ||
      v.outlet_type?.toLowerCase().includes(q) ||
      v.competitor_brands?.toLowerCase().includes(q)
    )
  })

  const exportToCSV = () => {
    setExporting(true)
    try {
      if (filtered.length === 0) {
        toast.error('No data to export')
        return
      }
      const headers = [
        'Store Name', 'Store Address', 'Visit Date', 'Agent', 'Status',
        'Outlet Type', 'Product Range', 'Stock Availability', 'Shelf Position',
        'POS Material', 'Brand Visibility', 'Cooler Installed',
        'Competitor Brands', 'Pricing Compliance',
        'Notes', 'GPS Latitude', 'GPS Longitude', 'Date Created',
      ]
      const rows = filtered.map(v => [
        v.store_name || '',
        v.store_address || '',
        v.visit_date || '',
        v.agent_name || '',
        v.status || '',
        v.outlet_type || '',
        v.product_range || '',
        v.stock_availability || '',
        v.shelf_position || '',
        v.pos_material || '',
        v.brand_visibility || '',
        v.cooler_installed || '',
        v.competitor_brands || '',
        v.pricing_compliance || '',
        v.notes || '',
        v.gps_latitude?.toString() || '',
        v.gps_longitude?.toString() || '',
        v.created_at || '',
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
      toast.success(`Exported ${filtered.length} records`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const totalAgents = new Set(visits.map(v => v.agent_name).filter(Boolean)).size

  if (isLoading) return <LoadingSpinner />
  if (isError) return (
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stellr Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Store visits and questionnaire data for Stellr
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Array.isArray(companies) && companies.length > 1 && (
            <SearchableSelect
              options={[
                { value: '', label: 'All Companies' },
                ...companies.map((c: any) => ({ value: c.id, label: c.name })),
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
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={exportToCSV}
            disabled={exporting || filtered.length === 0}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Store className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Total Store Visits</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{visits.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-indigo-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Total Agents</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalAgents}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by store name, address, agent, outlet type, or competitors..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
        />
      </div>

      {/* Data Table */}
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-gray-400">
                    {visits.length === 0 ? 'No Stellr visit records found' : 'No records match your search'}
                  </td>
                </tr>
              ) : filtered.map((v) => (
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
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
            Showing {filtered.length} of {visits.length} records
          </div>
        )}
      </div>

      {/* Visit Detail Modal */}
      {detailVisit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDetailVisit(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{detailVisit.store_name}</h2>
                {detailVisit.store_address && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" /> {detailVisit.store_address}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDetailVisit(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              {/* Visit Info */}
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
                    }`}>
                      {detailVisit.status || '—'}
                    </span>
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

              {/* Questionnaire Answers */}
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

              {/* Photo thumbnails from raw_responses */}
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
                            <img
                              src={String(url)}
                              alt={formatKey(key)}
                              className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
                            />
                          </button>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-center truncate">{formatKey(key)}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {detailVisit.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 rounded-lg px-4 py-3">{detailVisit.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 flex gap-3 justify-end">
              {detailVisit.has_photos && (
                <button
                  onClick={() => { setDetailVisit(null); handleViewPhotos(detailVisit.id) }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 text-sm font-medium"
                >
                  <Camera className="w-4 h-4" /> View All Photos
                </button>
              )}
              <button
                onClick={() => setDetailVisit(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Expand Modal */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
          onClick={() => setExpandedPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setExpandedPhoto(null)}
              className="absolute top-0 right-0 m-2 p-1 bg-white dark:bg-gray-800 rounded-full shadow-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={expandedPhoto}
              alt="Visit photo expanded"
              className="max-w-full max-h-[85vh] rounded-lg object-contain"
            />
          </div>
        </div>
      )}

      {/* Visit Photos Gallery Modal */}
      {photoModalVisitId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => { setPhotoModalVisitId(null); setPhotoModalPhotos([]) }}
        >
          <div
            className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Visit Photos</h3>
              <button
                onClick={() => { setPhotoModalVisitId(null); setPhotoModalPhotos([]) }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
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
                    <div key={photo.id} className="relative">
                      <button onClick={() => setExpandedPhoto(photo.r2_url)} className="block w-full">
                        <img
                          src={photo.r2_url}
                          alt={photo.label || photo.photo_type || 'Visit photo'}
                          className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
                        />
                      </button>
                      {photo.label && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-center truncate">{photo.label}</p>
                      )}
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

export default StellrReport
