import { useState, useEffect, useMemo } from 'react'
import { Download, Filter, Save, Calendar, RefreshCw } from 'lucide-react'

interface ReportColumn {
  key: string
  label: string
  type?: 'text' | 'number' | 'currency' | 'date' | 'percentage'
  sortable?: boolean
}

interface ReportFilter {
  key: string
  label: string
  type: 'text' | 'select' | 'date' | 'daterange'
  options?: { value: string; label: string }[]
  defaultValue?: any
}

interface ReportPageProps {
  title: string
  description?: string
  columns: ReportColumn[]
  filters: ReportFilter[]
  data: any[]
  loading: boolean
  onRefresh: () => void
  onExport: (format: 'csv' | 'excel' | 'pdf') => void
  onFilterChange: (filters: Record<string, any>) => void
  periodOptions?: { value: string; label: string }[]
  showPeriodSelector?: boolean
}

export default function ReportPage({
  title,
  description,
  columns,
  filters,
  data,
  loading,
  onRefresh,
  onExport,
  onFilterChange,
  periodOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'wtd', label: 'Week to Date' },
    { value: 'mtd', label: 'Month to Date' },
    { value: 'qtd', label: 'Quarter to Date' },
    { value: 'ytd', label: 'Year to Date' },
    { value: 'custom', label: 'Custom Range' }
  ],
  showPeriodSelector = true
}: ReportPageProps) {
  const [filterValues, setFilterValues] = useState<Record<string, any>>({})
  const [showFilters, setShowFilters] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState('mtd')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    const defaultFilters: Record<string, any> = {}
    filters.forEach(filter => {
      if (filter.defaultValue !== undefined) {
        defaultFilters[filter.key] = filter.defaultValue
      }
    })
    setFilterValues(defaultFilters)
  }, [filters])

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filterValues, [key]: value }
    setFilterValues(newFilters)
    onFilterChange(newFilters)
  }

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    handleFilterChange('period', period)
  }

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  const formatValue = (value: any, type?: string) => {
    if (value === null || value === undefined) return '-'
    
    switch (type) {
      case 'currency':
        return `R ${Number(value).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case 'number':
        return Number(value).toLocaleString('en-ZA')
      case 'percentage':
        return `${Number(value).toFixed(2)}%`
      case 'date':
        return new Date(value).toLocaleDateString('en-ZA')
      default:
        return value
    }
  }

  // Sort re-ran on every render (typing, hover, any state change) even when
  // data/sort were unchanged — memo keys it to what actually affects order.
  const sortedData = useMemo(() => [...data].sort((a, b) => {
    if (!sortColumn) return 0

    const aVal = a[sortColumn]
    const bVal = b[sortColumn]

    if (aVal === bVal) return 0
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1

    const comparison = aVal < bVal ? -1 : 1
    return sortDirection === 'asc' ? comparison : -comparison
  }), [data, sortColumn, sortDirection])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-surface-secondary disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-surface-secondary flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <div className="relative">
              <button
                onClick={() => onExport('excel')}
                className="px-4 py-2 text-sm font-medium text-white bg-info-600 rounded-lg hover:bg-info-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        {showPeriodSelector && (
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Period:</span>
            <div className="flex gap-2">
              {periodOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => handlePeriodChange(option.value)}
                  className={`px-3 py-1 text-sm font-medium rounded-lg ${
                    selectedPeriod === option.value
                      ? 'bg-info-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-surface-secondary rounded-lg mb-4">
            {filters.map(filter => (
              <div key={filter.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {filter.label}
                </label>
                {filter.type === 'select' ? (
                  <select
                    value={filterValues[filter.key] || ''}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info-500 focus:border-transparent"
                  >
                    <option value="">All</option>
                    {filter.options?.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : filter.type === 'date' ? (
                  <input
                    type="date"
                    value={filterValues[filter.key] || ''}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info-500 focus:border-transparent"
                  />
                ) : (
                  <input
                    type="text"
                    value={filterValues[filter.key] || ''}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    placeholder={`Filter by ${filter.label.toLowerCase()}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info-500 focus:border-transparent"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                {columns.map(column => (
                  <th
                    key={column.key}
                    onClick={() => column.sortable !== false && handleSort(column.key)}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      column.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {column.label}
                      {column.sortable !== false && sortColumn === column.key && (
                        <span className="text-info-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500">
                    Loading report data...
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500">
                    No data available for the selected period and filters
                  </td>
                </tr>
              ) : (
                sortedData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-secondary">
                    {columns.map(column => (
                      <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatValue(row[column.key], column.type)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && sortedData.length > 0 && (
          <div className="px-6 py-4 bg-surface-secondary border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{sortedData.length}</span> records
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
