import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { Download, AlertTriangle, RefreshCw, XCircle, Users, Image, Link } from 'lucide-react'
import toast from 'react-hot-toast'
import DateRangePresets from '../../../components/ui/DateRangePresets'

interface UploadFailure {
  id: string
  visit_id: string | null
  visit_date: string
  first_name: string
  last_name: string
  id_number: string
  goldrush_id: string
  agent_id: string
  agent_name: string
  team_lead_id: string | null
  team_lead_name: string | null
  photo_url: string | null
  errors: {
    id_number?: string
    goldrush_id?: string
    photo_mismatch?: string
    no_btag?: string
  }
  error_summary: string
}

const GoldrushUploadFailuresReport: React.FC = () => {
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset)
    return monday.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [exporting, setExporting] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const buildUrl = () => {
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    return `/field-ops/reports/goldrush-upload-failures?${params.toString()}`
  }

  const { data: failures = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['goldrush-upload-failures', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(buildUrl())
      return (res.data?.data || []) as UploadFailure[]
    },
    staleTime: 60000,
  })

  const uniqueAgents = new Set(failures.map(f => f.agent_id)).size
  const idErrors = failures.filter(f => f.errors?.id_number).length
  const grIdErrors = failures.filter(f => f.errors?.goldrush_id).length
  const photoMismatchErrors = failures.filter(f => f.errors?.photo_mismatch).length
  const noBtagErrors = failures.filter(f => f.errors?.no_btag).length

  // Group failures by team lead then agent
  const grouped = failures.reduce<Record<string, { teamLeadName: string; agents: Record<string, { agentName: string; records: UploadFailure[] }> }>>((acc, f) => {
    const tlKey = f.team_lead_id || 'no_team_lead'
    const tlName = f.team_lead_name || 'No Team Lead'
    if (!acc[tlKey]) acc[tlKey] = { teamLeadName: tlName, agents: {} }
    if (!acc[tlKey].agents[f.agent_id]) acc[tlKey].agents[f.agent_id] = { agentName: f.agent_name, records: [] }
    acc[tlKey].agents[f.agent_id].records.push(f)
    return acc
  }, {})

  const exportToExcel = () => {
    setExporting(true)
    try {
      if (failures.length === 0) { toast.error('No data to export'); return }
      const headers = ['Date', 'Team Lead', 'Agent', 'First Name', 'Last Name', 'ID Number', 'Goldrush ID', 'ID Number Error', 'Goldrush ID Error', 'Photo Mismatch', 'No B-Tag']
      const rows = failures.map(f => [
        f.visit_date || '',
        f.team_lead_name || '',
        f.agent_name || '',
        f.first_name || '',
        f.last_name || '',
        f.id_number || '',
        f.goldrush_id || '',
        f.errors?.id_number || '',
        f.errors?.goldrush_id || '',
        f.errors?.photo_mismatch || '',
        f.errors?.no_btag || '',
      ])
      const BOM = '﻿'
      const csv = [
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n')
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `goldrush-upload-failures-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${failures.length} records`)
    } catch { toast.error('Export failed') } finally { setExporting(false) }
  }

  if (isLoading) return <LoadingSpinner />
  if (isError) return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Failed to load data</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-8 right-0 text-white text-sm hover:text-gray-300"
            >
              Close ✕
            </button>
            <img
              src={lightboxUrl}
              alt="System photo"
              className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Failures Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Captures flagged due to invalid IDs, photo mismatches, or missing B-Tag numbers</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePresets startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
          <button onClick={() => refetch()} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={exportToExcel} disabled={exporting || failures.length === 0} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium">
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Total Failures</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{failures.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Agents Affected</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{uniqueAgents}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Invalid ID Numbers</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{idErrors}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Invalid Goldrush IDs</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{grIdErrors}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Image className="h-4 w-4 text-pink-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Photo Mismatches</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{photoMismatchErrors}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Link className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Missing B-Tags</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{noBtagErrors}</p>
        </div>
      </div>

      {failures.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <XCircle className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">No upload failures in this date range</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([tlKey, tlGroup]) => (
            <div key={tlKey} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Team Lead header */}
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Team Lead: {tlGroup.teamLeadName}
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  {Object.values(tlGroup.agents).reduce((s, a) => s + a.records.length, 0)} failures
                </span>
              </div>

              {Object.entries(tlGroup.agents).map(([agentId, agentGroup]) => (
                <div key={agentId}>
                  {/* Agent sub-header */}
                  <div className="px-4 py-2 bg-red-50 dark:bg-red-900/10 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-2">
                    <span className="text-xs font-medium text-red-700 dark:text-red-400">Agent: {agentGroup.agentName}</span>
                    <span className="ml-auto text-xs text-gray-400">{agentGroup.records.length} not loaded</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700/50">
                          <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">System Photo</th>
                          <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">Date</th>
                          <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">Name</th>
                          <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">ID Number</th>
                          <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">Goldrush ID</th>
                          <th className="text-left py-2 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium">Reason Not Loaded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentGroup.records.map(record => (
                          <tr key={record.id} className="border-b border-gray-50 dark:border-gray-700/30 hover:bg-red-50/50 dark:hover:bg-red-900/10">
                            {/* System Photo thumbnail */}
                            <td className="py-2 px-3">
                              {record.photo_url ? (
                                <button
                                  onClick={() => setLightboxUrl(record.photo_url!)}
                                  className="block"
                                  title="Click to enlarge"
                                >
                                  <img
                                    src={record.photo_url}
                                    alt="System photo"
                                    className="w-16 h-12 object-cover rounded border border-gray-200 dark:border-gray-600 hover:opacity-80 transition-opacity"
                                  />
                                </button>
                              ) : (
                                <div className="w-16 h-12 rounded border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                                  <Image className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              {record.visit_date ? new Date(record.visit_date).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-gray-900 dark:text-white font-medium whitespace-nowrap">
                              {record.first_name} {record.last_name}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={record.errors?.id_number ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-300'}>
                                {record.id_number || '—'}
                              </span>
                              {record.errors?.id_number && (
                                <p className="text-xs text-red-500 mt-0.5">{record.errors.id_number}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={record.errors?.goldrush_id ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-300'}>
                                {record.goldrush_id || '—'}
                              </span>
                              {record.errors?.goldrush_id && (
                                <p className="text-xs text-red-500 mt-0.5">{record.errors.goldrush_id}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col gap-1">
                                {record.errors?.photo_mismatch && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 whitespace-nowrap">
                                    <Image className="w-3 h-3" /> Photo mismatch
                                  </span>
                                )}
                                {record.errors?.no_btag && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 whitespace-nowrap">
                                    <Link className="w-3 h-3" /> No B-Tag number
                                  </span>
                                )}
                                {(record.errors?.id_number || record.errors?.goldrush_id) && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 whitespace-nowrap">
                                    <XCircle className="w-3 h-3" /> Invalid ID
                                  </span>
                                )}
                                {!record.errors?.photo_mismatch && !record.errors?.no_btag && !record.errors?.id_number && !record.errors?.goldrush_id && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 whitespace-nowrap">
                                    <XCircle className="w-3 h-3" /> Not Loaded
                                  </span>
                                )}
                              </div>
                              {record.error_summary && (
                                <p className="text-xs text-gray-400 mt-1 max-w-[260px]">{record.error_summary}</p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {failures.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {failures.length} failed capture{failures.length !== 1 ? 's' : ''} across {uniqueAgents} agent{uniqueAgents !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default GoldrushUploadFailuresReport
