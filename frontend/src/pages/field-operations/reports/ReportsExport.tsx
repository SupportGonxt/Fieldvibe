import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { Download, FileSpreadsheet, FileText, BarChart3 } from 'lucide-react'
import DateRangePresets from '../../../components/ui/DateRangePresets'

const ReportsExport: React.FC = () => {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exporting, setExporting] = useState(false)

  const dateParams = `${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`

  const { data: agentPerf = [] } = useQuery({
    queryKey: ['export-agent-perf', startDate, endDate],
    queryFn: async () => {
      const dParams = startDate || endDate ? `?${startDate ? `startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}` : ''
      const res = await apiClient.get(`/field-ops/reports/agent-performance${dParams}`)
      return res.data?.data || []
    },
  })

  const { data: conversionStats } = useQuery({
    queryKey: ['export-conversions', startDate, endDate],
    queryFn: async () => {
      const dParams = startDate || endDate ? `?${startDate ? `startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}` : ''
      const res = await apiClient.get(`/field-ops/reports/conversion-stats${dParams}`)
      return res.data?.data || {}
    },
  })

  const exportToCSV = async (type: 'checkins' | 'agents' | 'conversions') => {
    setExporting(true)
    try {
      if (type === 'checkins') {
        const res = await apiClient.get(`/field-ops/reports/export/checkins?dummy=1${dateParams}`)
        const data = res.data?.data || []
        if (data.length === 0) { toast.error('No data to export'); return }
        const headers = Object.keys(data[0])
        const csv = [headers.join(','), ...data.map((row: Record<string, unknown>) => headers.map(h => `"${String(row[h] ?? '')}"`).join(','))].join('\n')
        downloadCSV(csv, `checkins-export-${new Date().toISOString().slice(0, 10)}.csv`)
        toast.success(`Exported ${data.length} check-in records`)
      } else if (type === 'agents') {
        if (agentPerf.length === 0) { toast.error('No agent data to export'); return }
        const headers = ['agent_name', 'checkin_count', 'conversions', 'conversion_rate']
        const csv = [headers.join(','), ...agentPerf.map((a: Record<string, unknown>) => headers.map(h => `"${String(a[h] ?? '')}"`).join(','))].join('\n')
        downloadCSV(csv, `agent-performance-${new Date().toISOString().slice(0, 10)}.csv`)
        toast.success(`Exported ${agentPerf.length} agent records`)
      } else if (type === 'conversions') {
        const cs = conversionStats || {}
        const headers = ['metric', 'value']
        const rows = Object.entries(cs).map(([k, v]) => `"${k}","${v}"`)
        const csv = [headers.join(','), ...rows].join('\n')
        downloadCSV(csv, `conversion-stats-${new Date().toISOString().slice(0, 10)}.csv`)
        toast.success('Exported conversion stats')
      }
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Export</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Export field operations data to CSV for analysis</p>
        </div>
        <DateRangePresets
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Check-ins Data</h3>
              <p className="text-xs text-gray-500">All check-in records with location, status, and conversion data</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Includes visit date, agent, shop, GPS coordinates, status, conversion status, and visit type.
          </p>
          <button onClick={() => exportToCSV('checkins')} disabled={exporting}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
            <Download className="h-4 w-4" /> Export Check-ins CSV
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <BarChart3 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Agent Performance</h3>
              <p className="text-xs text-gray-500">Agent check-in counts, conversions, and rates</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Summarized per-agent metrics: total check-ins, total conversions, and conversion rate percentage.
          </p>
          <button onClick={() => exportToCSV('agents')} disabled={exporting}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium">
            <Download className="h-4 w-4" /> Export Agent CSV
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Conversion Stats</h3>
              <p className="text-xs text-gray-500">Overall conversion and betting metrics</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Summary of conversion rates: converted vs not converted, store visits vs non-store visits.
          </p>
          <button onClick={() => exportToCSV('conversions')} disabled={exporting}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
            <Download className="h-4 w-4" /> Export Conversion CSV
          </button>
        </div>
      </div>

      {/* Agent Performance Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agent Performance Preview</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Agent</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Check-ins</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Conversions</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {agentPerf.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">No data for selected period</td></tr>
              ) : agentPerf.slice(0, 10).map((a: Record<string, unknown>, i: number) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2 px-3 text-gray-900 dark:text-white">{String(a.agent_name || 'Unknown')}</td>
                  <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{String(a.checkin_count)}</td>
                  <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{String(a.conversions)}</td>
                  <td className="py-2 px-3 text-right font-medium text-emerald-600">{String(a.conversion_rate)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ReportsExport
