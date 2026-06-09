import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import DateRangePresets from '../../../components/ui/DateRangePresets'
import { Download, AlertTriangle, RefreshCw, Users } from 'lucide-react'
import toast from 'react-hot-toast'

interface TrackingRow {
  agent_id: string
  agent_name: string
  role: string
  team_lead_id: string | null
  team_lead_name: string | null
  total: number
  by_date: Record<string, number>
}

interface TrackingResponse {
  success: boolean
  dates: string[]
  rows: TrackingRow[]
  message?: string
}

const GoldrushTrackingReport: React.FC = () => {
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
  const [selectedTeamLead, setSelectedTeamLead] = useState('')
  const [selectedAgent, setSelectedAgent] = useState('')

  const { data, isLoading, isError, refetch } = useQuery<TrackingResponse>({
    queryKey: ['goldrush-tracking', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate)   params.append('endDate',   endDate)
      const res = await apiClient.get(`/field-ops/reports/goldrush-tracking?${params.toString()}`)
      return res.data as TrackingResponse
    },
    staleTime: 60000,
  })

  const dates = data?.dates ?? []
  const rows  = data?.rows  ?? []

  // Unique team leads derived from data
  const teamLeads = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach(r => {
      if (r.role === 'team_lead') map.set(r.agent_id, r.agent_name)
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  // Agents available under selected team lead (or all agents if no TL selected)
  const availableAgents = useMemo(() => {
    return rows
      .filter(r => r.role !== 'team_lead' && (!selectedTeamLead || r.team_lead_id === selectedTeamLead))
      .map(r => ({ id: r.agent_id, name: r.agent_name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, selectedTeamLead])

  const handleTeamLeadChange = (val: string) => {
    setSelectedTeamLead(val)
    setSelectedAgent('')
  }

  // Apply filters
  const visibleRows = useMemo(() => {
    let filtered = rows
    if (selectedTeamLead) {
      filtered = filtered.filter(r => r.agent_id === selectedTeamLead || r.team_lead_id === selectedTeamLead)
    }
    if (selectedAgent) {
      filtered = filtered.filter(r => r.agent_id === selectedAgent)
    }
    return filtered
  }, [rows, selectedTeamLead, selectedAgent])

  const formatDateLabel = (d: string) => {
    const dt = new Date(d + 'T00:00:00')
    const day = dt.toLocaleDateString('en-ZA', { weekday: 'short' })
    return `${day} ${dt.getDate()}`
  }

  const columnTotals: Record<string, number> = {}
  dates.forEach(d => {
    columnTotals[d] = visibleRows.reduce((sum, r) => sum + (r.by_date[d] ?? 0), 0)
  })
  const grandTotal = visibleRows.reduce((sum, r) => sum + r.total, 0)

  const exportToCSV = () => {
    if (visibleRows.length === 0) { toast.error('No data to export'); return }
    setExporting(true)
    try {
      const headers = ['Name', 'Role', 'Team Lead', 'Total', ...dates]
      const dataRows = visibleRows.map(r => [
        r.agent_name,
        r.role === 'team_lead' ? 'Team Lead' : 'Agent',
        r.team_lead_name ?? '',
        r.total,
        ...dates.map(d => r.by_date[d] ?? 0),
      ])
      const totalsRow = ['TOTAL', '', '', grandTotal, ...dates.map(d => columnTotals[d] ?? 0)]

      const csv = [
        headers.map(h => `"${h}"`).join(','),
        ...dataRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
        totalsRow.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      ].join('\n')

      const BOM = '﻿'
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `goldrush-tracking-${startDate || 'all'}-to-${endDate || 'all'}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${visibleRows.length} rows`)
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

  const selectClass = 'border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tracking GoldRush</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Individual sign-ups per agent / team lead by day
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            disabled={exporting || visibleRows.length === 0}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedTeamLead}
            onChange={e => handleTeamLeadChange(e.target.value)}
            className={selectClass}
          >
            <option value="">All Team Leads</option>
            {teamLeads.map(tl => (
              <option key={tl.id} value={tl.id}>{tl.name}</option>
            ))}
          </select>

          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            className={selectClass}
          >
            <option value="">All Agents</option>
            {availableAgents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {(selectedTeamLead || selectedAgent) && (
            <button
              onClick={() => { setSelectedTeamLead(''); setSelectedAgent('') }}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Total Sign-ups</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{grandTotal}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Agents / Team Leads</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{visibleRows.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Days in Period</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{dates.length}</p>
        </div>
      </div>

      {/* Pivot table */}
      {visibleRows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-400 text-sm">
            {rows.length === 0 ? 'No sign-up data found for the selected period' : 'No results match the selected filters'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap sticky left-0 bg-gray-50 dark:bg-gray-900/50 z-10 min-w-[180px]">
                    Name
                  </th>
                  <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap min-w-[80px]">
                    Role
                  </th>
                  <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap min-w-[140px]">
                    Team Lead
                  </th>
                  <th className="text-center py-3 px-3 text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap bg-gray-100 dark:bg-gray-800 min-w-[64px]">
                    Total
                  </th>
                  {dates.map(d => (
                    <th
                      key={d}
                      className="text-center py-3 px-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap min-w-[56px]"
                      title={d}
                    >
                      {formatDateLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => (
                  <tr
                    key={row.agent_id}
                    className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                      row.role === 'team_lead' ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-white whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">
                      {row.agent_name}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {row.role === 'team_lead' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          TL
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          Agent
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                      {row.team_lead_name ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900/30 whitespace-nowrap">
                      {row.total}
                    </td>
                    {dates.map(d => {
                      const val = row.by_date[d] ?? 0
                      return (
                        <td
                          key={d}
                          className={`py-2.5 px-3 text-center whitespace-nowrap ${
                            val > 0
                              ? 'text-gray-900 dark:text-white font-medium'
                              : 'text-gray-300 dark:text-gray-600'
                          }`}
                        >
                          {val > 0 ? val : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}

                {/* Totals row */}
                <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/50 font-semibold">
                  <td className="py-3 px-4 text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-gray-900/50 z-10">
                    TOTAL
                  </td>
                  <td className="py-3 px-3" />
                  <td className="py-3 px-3" />
                  <td className="py-3 px-3 text-center text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-800">
                    {grandTotal}
                  </td>
                  {dates.map(d => (
                    <td key={d} className="py-3 px-3 text-center text-gray-900 dark:text-white">
                      {columnTotals[d] > 0 ? columnTotals[d] : '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default GoldrushTrackingReport
