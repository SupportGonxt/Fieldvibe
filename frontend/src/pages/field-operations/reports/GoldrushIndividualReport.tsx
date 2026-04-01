import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import { fieldOperationsService } from '../../../services/field-operations.service'
import SearchableSelect from '../../../components/ui/SearchableSelect'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { Download, Users, Search, CheckCircle, XCircle, AlertTriangle, Edit2, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'
import DateRangePresets from '../../../components/ui/DateRangePresets'

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

const GoldrushIndividualReport: React.FC = () => {
  const queryClient = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<string>('')

  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })
  const companies = companiesResp?.data || companiesResp || []

  useEffect(() => {
    if (Array.isArray(companies) && companies.length === 1 && !selectedCompany) {
      setSelectedCompany(companies[0].id)
    }
  }, [companies, selectedCompany])

  const companyParam = selectedCompany ? `${startDate || endDate ? '&' : '?'}company_id=${selectedCompany}` : ''

  const handleEditGoldrushId = (ind: GoldrushIndividual) => {
    setEditingId(ind.id)
    setEditValue(ind.goldrush_id || '')
  }

  const handleSaveGoldrushId = async (ind: GoldrushIndividual) => {
    if (!ind.visit_id) {
      toast.error('Cannot update: no visit linked to this record')
      return
    }
    setSaving(true)
    try {
      await fieldOperationsService.updateVisit(ind.visit_id, {
        custom_field_values: { goldrush_id: editValue.trim() }
      })
      toast.success('Goldrush ID updated')
      setEditingId(null)
      setEditValue('')
      queryClient.invalidateQueries({ queryKey: ['goldrush-individuals'] })
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

  const dateParams = startDate || endDate
    ? `?${startDate ? `startDate=${startDate}` : ''}${endDate ? `${startDate ? '&' : ''}endDate=${endDate}` : ''}`
    : ''

  const { data: individuals = [], isLoading, isError } = useQuery({
    queryKey: ['goldrush-individuals', startDate, endDate, selectedCompany],
    queryFn: async () => {
      const res = await apiClient.get(`/field-ops/reports/goldrush-individuals${dateParams}${companyParam}`)
      return (res.data?.data || []) as GoldrushIndividual[]
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })

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
  const conversionRate = individuals.length > 0
    ? ((totalConverted / individuals.length) * 100).toFixed(1)
    : '0'

  const exportToExcel = () => {
    setExporting(true)
    try {
      if (filtered.length === 0) {
        toast.error('No data to export')
        return
      }

      const headers = [
        'First Name', 'Last Name', 'ID Number', 'Phone', 'Email',
        'Goldrush ID', 'Converted', 'Conversion Date', 'Agent',
        'Gave Brand Info', 'Consumer Converted (Survey)', 'Betting Elsewhere',
        'Competitor Company', 'Used Goldrush Before', 'Goldrush Comparison',
        'Likes Goldrush', 'Platform Suggestions', 'Notes',
        'GPS Latitude', 'GPS Longitude', 'Date Registered'
      ]

      const rows = filtered.map(ind => [
        ind.first_name || '',
        ind.last_name || '',
        ind.id_number || '',
        ind.phone || '',
        ind.email || '',
        ind.goldrush_id || '',
        ind.converted ? 'Yes' : 'No',
        ind.conversion_date || '',
        ind.agent_name || '',
        ind.gave_brand_info || '',
        ind.consumer_converted || '',
        ind.betting_elsewhere || '',
        ind.competitor_company || '',
        ind.used_goldrush_before || '',
        ind.goldrush_comparison || '',
        ind.likes_goldrush || '',
        ind.platform_suggestions || '',
        ind.notes || '',
        ind.gps_latitude?.toString() || '',
        ind.gps_longitude?.toString() || '',
        ind.created_at || '',
      ])

      const csvContent = [
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      // Use BOM for Excel compatibility with special characters
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `goldrush-individual-report-${new Date().toISOString().slice(0, 10)}.csv`
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Goldrush Individual Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Individual visits and questionnaire data for Goldrush
          </p>
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
          <button onClick={exportToExcel} disabled={exporting || filtered.length === 0}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium">
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Total Individuals</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{individuals.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Converted</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalConverted}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Not Converted</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{individuals.length - totalConverted}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Conversion Rate</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{conversionRate}%</p>
        </div>
      </div>

      {/* Search */}
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

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Name</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">ID Number</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Phone</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Goldrush ID</th>
                <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Converted</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Agent</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Betting Elsewhere</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Used GR Before</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Likes GR</th>
                <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Date Registered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    {individuals.length === 0 ? 'No Goldrush individual records found' : 'No records match your search'}
                  </td>
                </tr>
              ) : filtered.map((ind) => (
                <tr key={ind.id} className="group border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 text-gray-900 dark:text-white font-medium whitespace-nowrap">
                    {ind.first_name} {ind.last_name}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{ind.id_number || '—'}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{ind.phone || '—'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {editingId === ind.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="w-28 px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                          placeholder="Goldrush ID"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveGoldrushId(ind); if (e.key === 'Escape') handleCancelEdit(); }}
                        />
                        <button onClick={() => handleSaveGoldrushId(ind)} disabled={saving} className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50" title="Save">
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={handleCancelEdit} className="p-1 text-gray-400 hover:text-gray-600" title="Cancel">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className={`font-medium ${ind.goldrush_id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                          {ind.goldrush_id || '—'}
                        </span>
                        <button onClick={() => handleEditGoldrushId(ind)} className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Edit Goldrush ID">
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      ind.converted ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {ind.converted ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{ind.agent_name || '—'}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{ind.betting_elsewhere || '—'}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{ind.used_goldrush_before || '—'}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{ind.likes_goldrush || '—'}</td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {ind.created_at ? new Date(ind.created_at).toLocaleDateString() : '—'}
                  </td>
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
    </div>
  )
}

export default GoldrushIndividualReport
