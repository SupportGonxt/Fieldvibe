import { useEffect, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Camera, ChevronLeft, ChevronRight, Search, Store, User, Calendar, Clock, X } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { fieldOperationsService } from '../../services/field-operations.service'
import DateRangePresets from '../../components/ui/DateRangePresets'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { thumb } from '../../lib/thumb'

// Read-only photo review for a client company (company_viewer role): one card per
// visit with every photo of that visit side by side. Data: GET /field-ops/reports/visit-photos.

interface VisitPhoto { id: string; photo_type: string | null; url: string; created_at: string }
interface PhotoVisit {
  id: string
  visit_date: string
  check_in_time: string | null
  status: string | null
  store_name: string | null
  store_address: string | null
  agent_name: string | null
  photos: VisitPhoto[]
}
interface VisitPhotosResponse {
  visits: PhotoVisit[]
  agents: { agent_id: string; agent_name: string }[]
  pagination: { page: number; limit: number; total: number }
}

const PAGE_SIZE = 20
const typeLabel = (t: string | null) => (t || 'photo').replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())
const timeOf = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function CompanyPhotoReview() {
  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })
  const companies: any[] = (companiesResp as any)?.data || companiesResp || []
  const company = Array.isArray(companies) ? companies[0] : undefined

  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 8) + '01')
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [agentId, setAgentId] = useState('')
  const [page, setPage] = useState(1)
  const [viewer, setViewer] = useState<{ visit: PhotoVisit; index: number } | null>(null)

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['company-visit-photos', company?.id, startDate, endDate, search, agentId, page],
    queryFn: async () => {
      const params: Record<string, string> = { company_id: company.id, page: String(page), limit: String(PAGE_SIZE) }
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      if (search) params.search = search
      if (agentId) params.agent_id = agentId
      const res = await apiClient.get('/field-ops/reports/visit-photos', { params })
      return res.data?.data as VisitPhotosResponse
    },
    enabled: !!company?.id,
    placeholderData: keepPreviousData,
  })

  const visits = data?.visits || []
  const total = data?.pagination.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Lightbox keyboard: arrows move within the visit, Esc closes.
  useEffect(() => {
    if (!viewer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewer(null)
      if (e.key === 'ArrowRight') setViewer(v => v && { ...v, index: Math.min(v.index + 1, v.visit.photos.length - 1) })
      if (e.key === 'ArrowLeft') setViewer(v => v && { ...v, index: Math.max(v.index - 1, 0) })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewer])

  const resetPage = () => setPage(1)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Camera className="w-6 h-6" /> {company?.name ? `${company.name} — Photo Review` : 'Photo Review'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Every store visit with all of its photos. {total.toLocaleString()} visit{total === 1 ? '' : 's'} in this period.
          </p>
        </div>
        <DateRangePresets
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={(d: string) => { setStartDate(d); resetPage() }}
          onEndDateChange={(d: string) => { setEndDate(d); resetPage() }}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by store or agent..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white pl-9 pr-3 py-2"
          />
        </div>
        <select
          value={agentId}
          onChange={e => { setAgentId(e.target.value); resetPage() }}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-3 py-2"
        >
          <option value="">All agents</option>
          {(data?.agents || []).map(a => <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>)}
        </select>
      </div>

      {isLoading || !company ? (
        <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
      ) : isError ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-red-600">Could not load photos. Please refresh the page.</div>
      ) : visits.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No visits with photos match these filters</p>
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {visits.map(visit => (
            <div key={visit.id} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    <Store className="w-4 h-4 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{visit.store_name?.trim() || 'Unknown store'}</span>
                  </div>
                  {visit.store_address && <p className="text-xs text-gray-500 dark:text-gray-400 truncate ml-6">{visit.store_address}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                  <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" /> {visit.agent_name || 'Unknown agent'}</span>
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {visit.visit_date}</span>
                  {timeOf(visit.check_in_time) && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {timeOf(visit.check_in_time)}</span>}
                  <span className="text-gray-400">{visit.photos.length} photo{visit.photos.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {visit.photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    onClick={() => setViewer({ visit, index })}
                    className="group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700">
                      <img loading="lazy" decoding="async" src={thumb(photo.url, 480)} alt={typeLabel(photo.photo_type)} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                    </div>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 truncate">{typeLabel(photo.photo_type)}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page" className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page" className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {viewer && (() => {
        const photo = viewer.visit.photos[viewer.index]
        const count = viewer.visit.photos.length
        return (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={() => setViewer(null)}>
            <div className="flex items-center justify-between px-4 py-3 text-white text-sm" onClick={e => e.stopPropagation()}>
              <div className="min-w-0">
                <p className="font-medium truncate">{viewer.visit.store_name?.trim() || 'Unknown store'} · {typeLabel(photo.photo_type)}</p>
                <p className="text-white/60 text-xs">{viewer.visit.visit_date} · {viewer.visit.agent_name} · {viewer.index + 1} of {count}</p>
              </div>
              <button onClick={() => setViewer(null)} aria-label="Close" className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 flex items-center justify-center gap-2 px-2 pb-4 min-h-0">
              <button
                onClick={e => { e.stopPropagation(); setViewer({ ...viewer, index: viewer.index - 1 }) }}
                disabled={viewer.index === 0}
                aria-label="Previous photo"
                className="p-2 rounded-full text-white hover:bg-white/10 disabled:opacity-20"
              ><ChevronLeft className="w-7 h-7" /></button>
              <img src={photo.url} alt={typeLabel(photo.photo_type)} onClick={e => e.stopPropagation()} className="max-h-full max-w-full object-contain rounded" />
              <button
                onClick={e => { e.stopPropagation(); setViewer({ ...viewer, index: viewer.index + 1 }) }}
                disabled={viewer.index === count - 1}
                aria-label="Next photo"
                className="p-2 rounded-full text-white hover:bg-white/10 disabled:opacity-20"
              ><ChevronRight className="w-7 h-7" /></button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
