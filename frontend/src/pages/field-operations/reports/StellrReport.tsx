import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import { fieldOperationsService } from '../../../services/field-operations.service'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { Download, Store, Search, CheckCircle, AlertTriangle, RefreshCw, Camera, X } from 'lucide-react'
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
  // Stellr questionnaire fields
  product_range: string
  stock_availability: string
  shelf_position: string
  pos_material: string
  competitor_brands: string
  pricing_compliance: string
  brand_visibility: string
  cooler_installed: string
  outlet_type: string
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

  const totalWithPOS = visits.filter(v => v.pos_material === 'Yes').length
  const totalWithCooler = visits.filter(v => v.cooler_installed === 'Yes').length
  const totalPricingCompliant = visits.filter(v => v.pricing_compliance === 'Yes' || v.pricing_compliance === 'Compliant').length
  const posRate = visits.length > 0 ? ((totalWithPOS / visits.length) * 100).toFixed(1) : '0'

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Store className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Total Store Visits</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{visits.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">POS Material</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalWithPOS}</p>
          <p className="text-xs text-gray-400 mt-1">{posRate}% coverage</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Cooler Installed</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalWithCooler}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Pricing Compliant</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalPricingCompliant}</p>
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
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Photo</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Store</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Agent</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Outlet Type</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Product Range</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Stock Availability</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">POS Material</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Cooler</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Pricing</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Competitors</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Visit Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400">
                    {visits.length === 0 ? 'No Stellr visit records found' : 'No records match your search'}
                  </td>
                </tr>
              ) : filtered.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4">
                    {v.thumbnail_url ? (
                      <button onClick={() => setExpandedPhoto(v.thumbnail_url)} className="block">
                        <img
                          src={v.thumbnail_url}
                          alt="Visit photo"
                          className="w-10 h-10 rounded object-cover border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
                        />
                      </button>
                    ) : v.has_photos ? (
                      <button
                        onClick={() => handleViewPhotos(v.id)}
                        className="inline-flex items-center justify-center w-10 h-10 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
                        title="Click to view photos"
                      >
                        <Camera className="w-4 h-4 text-blue-500" />
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">No photo</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-gray-900 dark:text-white font-medium whitespace-nowrap">{v.store_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{v.store_address || ''}</p>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{v.agent_name || '—'}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{v.outlet_type || '—'}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{v.product_range || '—'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      v.stock_availability === 'Yes' || v.stock_availability === 'Available'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : v.stock_availability
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {v.stock_availability || 'N/A'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      v.pos_material === 'Yes'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {v.pos_material || 'N/A'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      v.cooler_installed === 'Yes'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400'
                    }`}>
                      {v.cooler_installed || 'N/A'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      v.pricing_compliance === 'Yes' || v.pricing_compliance === 'Compliant'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : v.pricing_compliance
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {v.pricing_compliance || 'N/A'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{v.competitor_brands || '—'}</td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {v.visit_date || (v.created_at ? new Date(v.created_at).toLocaleDateString() : '—')}
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
