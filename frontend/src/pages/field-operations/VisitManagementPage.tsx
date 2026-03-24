import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import { Plus, Edit, Trash2, Calendar, Map, Settings, Store, User, X, Camera } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import LiveVisitMap from '../../components/maps/LiveVisitMap'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

interface VisitManagementPageProps {
  visitType?: 'store' | 'individual'
}

export default function VisitManagementPage({ visitType }: VisitManagementPageProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)
  const [filter, setFilter] = useState({ page: 1, limit: 20, status: '' })
  const [showMap, setShowMap] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()

  // Derive visitType from route if not passed as prop
  const activeType = visitType || (
    location.pathname.includes('/visits/stores') ? 'store' as const :
    location.pathname.includes('/visits/individuals') ? 'individual' as const :
    undefined
  )

  // Reset page to 1 when switching between visit type tabs
  useEffect(() => {
    setFilter(f => ({ ...f, page: 1 }))
  }, [activeType])

  const { data, isLoading, error } = useQuery({
    queryKey: ['visits', filter, activeType],
    queryFn: () => fieldOperationsService.getVisits({ ...filter, ...(activeType ? { visit_type: activeType } : {}) })
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.deleteVisit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits'] })
  })

  const filteredVisits = data?.data || []
  const total = data?.total || 0

  const pageTitle = activeType === 'store' ? 'Store Visits' :
    activeType === 'individual' ? 'Individual Visits' : 'Visit Management'
  const pageDesc = activeType === 'store' ? 'Store & business visits' :
    activeType === 'individual' ? 'Individual person visits' : 'Schedule and manage field visits'

  const getStatusBadge = (status: string) => {
    const colors = {
      planned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>{status?.toUpperCase()}</span>
  }

  const getTypeBadge = (visit: { visit_type?: string; visit_target_type?: string }) => {
    const type = (visit.visit_target_type || visit.visit_type || 'unknown').toLowerCase()
    if (type === 'store') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"><Store className="w-3 h-3" />Store</span>
    }
    if (type === 'individual') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800"><User className="w-3 h-3" />Individual</span>
    }
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{type}</span>
  }

  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">Failed to load visits.</p></div></div>
  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-64 bg-gray-200 rounded"></div></div></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{pageTitle}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{pageDesc} ({total} total)</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => navigate('/field-operations/visit-configurations')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>Configurations</span>
          </button>
          <button 
            onClick={() => setShowMap(!showMap)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Map className="h-4 w-4" />
            <span>{showMap ? 'Hide' : 'Show'} Map</span>
          </button>
          <button 
            onClick={() => navigate(`/field-operations/visits/create${activeType ? `?type=${activeType}` : ''}`)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>{activeType === 'store' ? 'New Store Visit' : activeType === 'individual' ? 'New Individual Visit' : 'Schedule Visit'}</span>
          </button>
        </div>
      </div>

      {/* Visit type tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate('/field-operations/visits')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${!activeType ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
          All Visits
        </button>
        <button
          onClick={() => navigate('/field-operations/visits/stores')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 ${activeType === 'store' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'}`}
        >
          <Store className="w-4 h-4" /> Store Visits
        </button>
        <button
          onClick={() => navigate('/field-operations/visits/individuals')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 ${activeType === 'individual' ? 'bg-cyan-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'}`}
        >
          <User className="w-4 h-4" /> Individual Visits
        </button>
      </div>

      {showMap && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4" style={{ height: '500px' }}>
          <LiveVisitMap 
            visits={filteredVisits.map((v: { id: string; customer_name?: string; agent_name?: string; status: string; latitude?: number; longitude?: number; visit_date: string }) => ({
              id: v.id,
              customer_name: v.customer_name,
              agent_name: v.agent_name || 'Unknown',
              status: v.status,
              lat: v.latitude,
              lng: v.longitude,
              visit_date: v.visit_date
            }))}
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <SearchableSelect
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'planned', label: 'Planned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            value={filter.status || null}
              onChange={(val) => setFilter(prev => ({...prev, status: val}))}
            placeholder="All Statuses"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-surface-secondary dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Photo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Customer / Individual</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredVisits.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  {activeType === 'store' ? <Store className="h-12 w-12 mx-auto text-gray-400 mb-2" /> :
                   activeType === 'individual' ? <User className="h-12 w-12 mx-auto text-gray-400 mb-2" /> :
                   <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-2" />}
                  <p>No {activeType ? `${activeType} ` : ''}visits found</p>
                </td></tr>
              ) : (
                filteredVisits.map((visit: { id: string; customer_name?: string; individual_first_name?: string; individual_last_name?: string; customer_id?: string; agent_id?: string; agent_name?: string; visit_date: string; check_in_time?: string; visit_type?: string; visit_target_type?: string; status: string; thumbnail_url?: string; photo_url?: string }) => (
                  <tr key={visit.id} className="hover:bg-surface-secondary dark:hover:bg-gray-700 cursor-pointer" onClick={() => navigate(`/field-operations/visits/${visit.id}`)}>
                    <td className="px-6 py-4">
                      {(visit.thumbnail_url || visit.photo_url) ? (
                        <button onClick={(e) => { e.stopPropagation(); setExpandedPhoto(visit.thumbnail_url || visit.photo_url || null); }} className="block">
                          <img
                            src={visit.thumbnail_url || visit.photo_url}
                            alt="Visit photo"
                            className="w-10 h-10 rounded object-cover border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
                          />
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs flex items-center gap-1"><Camera className="w-3 h-3" /> No photo</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {visit.customer_name || (visit.individual_first_name ? `${visit.individual_first_name} ${visit.individual_last_name || ''}`.trim() : 'N/A')}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">ID: {(visit.customer_id || visit.id)?.substring(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{visit.agent_name || `Agent #${visit.agent_id?.substring(0, 8)}`}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">{new Date(visit.visit_date).toLocaleDateString()}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{visit.check_in_time ? new Date(visit.check_in_time).toLocaleTimeString() : 'Not started'}</div>
                    </td>
                    <td className="px-6 py-4">{getTypeBadge(visit)}</td>
                    <td className="px-6 py-4">{getStatusBadge(visit.status)}</td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/field-operations/visits/${visit.id}/edit`); }} className="text-blue-600 hover:text-blue-900"><Edit className="h-4 w-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(visit.id); }} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > filter.limit && (
        <div className="flex justify-between items-center bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-700 dark:text-gray-300">Showing {(filter.page-1)*filter.limit+1} to {Math.min(filter.page*filter.limit,total)} of {total}</div>
          <div className="flex space-x-2">
            <button onClick={() => setFilter({...filter, page: filter.page-1})} disabled={filter.page<=1} className="px-4 py-2 border rounded-lg disabled:opacity-50">Previous</button>
            <button onClick={() => setFilter({...filter, page: filter.page+1})} disabled={filter.page*filter.limit>=total} className="px-4 py-2 border rounded-lg disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    
      {/* Photo expand modal */}
      {expandedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setExpandedPhoto(null)}>
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

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => { if (deleteConfirmId) { deleteMutation.mutate(deleteConfirmId); setDeleteConfirmId(null); } }}
        title="Confirm Delete"
        message="Delete?"
        confirmLabel="Confirm"
        variant="danger"
      />
    </div>
  )
}
