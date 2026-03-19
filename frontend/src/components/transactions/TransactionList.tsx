import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, RefreshCw, Inbox } from 'lucide-react'
import DataTable from '../ui/tables/DataTable'
import { Button } from '../ui/Button'
import ExportMenu from '../export/ExportMenu'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'

interface Column {
  key: string
  label: string
  sortable?: boolean
  render?: (value: any, row: any) => React.ReactNode
}

interface TransactionListProps {
  title: string
  columns: Column[]
  data: any[]
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  onExport?: () => void
  createPath?: string
  createLabel?: string
  filters?: React.ReactNode
  actions?: (row: any) => React.ReactNode
  emptyState?: React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
}

export default function TransactionList({
  title,
  columns,
  data,
  loading = false,
  error = null,
  onRefresh,
  onExport,
  createPath,
  createLabel = 'Create New',
  filters,
  actions,
  emptyState,
  emptyTitle,
  emptyDescription,
}: TransactionListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const safeData = Array.isArray(data) ? data : []
  const filteredData = safeData.filter(row => {
    if (!searchTerm) return true
    return Object.values(row).some(value =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const exportColumns = columns
    .filter(col => col.key !== 'actions')
    .map(col => ({ key: col.key, label: col.label }))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <ExportMenu
            data={filteredData}
            columns={exportColumns}
            filename={title.toLowerCase().replace(/\s+/g, '-')}
            title={title}
          />
          {createPath && (
            <Link to={createPath}>
              <Button variant="default" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                {createLabel}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <ErrorState
          title={`Failed to load ${title.toLowerCase()}`}
          message={error}
          onRetry={onRefresh}
        />
      )}

      {/* Search and Filters */}
      {!error && (
        <>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-night-50 rounded-lg bg-white dark:bg-night-50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            {filters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            )}
          </div>

          {/* Filters Panel */}
          {showFilters && filters && (
            <div className="bg-surface-secondary dark:bg-night-100 p-4 rounded-lg border border-gray-100 dark:border-night-100">
              {filters}
            </div>
          )}

          {/* Empty State */}
          {!loading && safeData.length === 0 && (
            emptyState || (
              <EmptyState
                icon={Inbox}
                title={emptyTitle || `No ${title.toLowerCase()} found`}
                description={emptyDescription || `${title} will appear here once they are created. Get started by creating your first record.`}
                action={createPath ? { label: createLabel, href: createPath } : undefined}
                variant="card"
              />
            )
          )}

          {/* No search results */}
          {!loading && safeData.length > 0 && filteredData.length === 0 && searchTerm && (
            <EmptyState
              icon={Search}
              title="No matching results"
              description={`No ${title.toLowerCase()} match "${searchTerm}". Try a different search term.`}
              action={{ label: 'Clear Search', onClick: () => setSearchTerm(''), variant: 'secondary' }}
              variant="card"
              size="sm"
            />
          )}

          {/* Data Table */}
          {(loading || filteredData.length > 0) && (
            <div className="bg-white dark:bg-night-50 rounded-lg shadow">
              <DataTable
                columns={columns.map(col => ({
                  ...col,
                  header: col.label
                }))}
                data={filteredData}
                loading={loading}
              />
            </div>
          )}

          {/* Summary */}
          {safeData.length > 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredData.length} of {safeData.length} records
            </div>
          )}
        </>
      )}
    </div>
  )
}
