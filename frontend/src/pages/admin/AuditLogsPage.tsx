import { useState, useEffect } from 'react'
import { Search, Filter, Download, Eye, Calendar, User, Activity, FileText, RefreshCw } from 'lucide-react'
import SearchableSelect from '../../components/ui/SearchableSelect'


interface AuditLog {
  id: string
  timestamp: string
  user: string
  action: string
  entity: string
  entityId: string
  details: string
  ipAddress: string
  userAgent: string
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterEntity, setFilterEntity] = useState('all')
  const [dateRange, setDateRange] = useState('7days')

  useEffect(() => {
    fetchLogs()
  }, [filterAction, filterEntity, dateRange])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      
      // Fetch audit logs from API
      const params: any = {}
      if (filterAction) params.action = filterAction
      if (filterEntity) params.entity = filterEntity
      if (dateRange[0]) params.startDate = dateRange[0]
      if (dateRange[1]) params.endDate = dateRange[1]
      
      const response = await api.get('/admin/audit-logs', { params })
      const logsData = response.data.data?.logs || response.data.data || []
      setLogs(Array.isArray(logsData) ? logsData : [])
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
      // In production, show empty state instead of mock data
      if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_MOCK_DATA === 'false') {
        setLogs([])
      }
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesAction = filterAction === 'all' || log.action === filterAction
    const matchesEntity = filterEntity === 'all' || log.entity === filterEntity
    
    return matchesSearch && matchesAction && matchesEntity
  })

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'Details', 'IP Address'].join(','),
      ...filteredLogs.map(log => [
        log.timestamp,
        log.user,
        log.action,
        log.entity,
        log.entityId,
        `"${log.details}"`,
        log.ipAddress
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800'
      case 'UPDATE': return 'bg-blue-100 text-blue-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      case 'LOGIN': return 'bg-purple-100 text-purple-800'
      case 'LOGOUT': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track all system activities and user actions
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchLogs}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportLogs}
            className="btn btn-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Actions</p>
              <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <User className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(logs.map(l => l.user)).size}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Entities</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(logs.map(l => l.entity)).size}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Today</p>
              <p className="text-2xl font-bold text-gray-900">
                {logs.filter(l => {
                  const logDate = new Date(l.timestamp)
                  const today = new Date()
                  return logDate.toDateString() === today.toDateString()
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <SearchableSelect
            options={[
              { value: 'all', label: 'All Actions' },
              { value: 'CREATE', label: 'Create' },
              { value: 'UPDATE', label: 'Update' },
              { value: 'DELETE', label: 'Delete' },
              { value: 'LOGIN', label: 'Login' },
              { value: 'LOGOUT', label: 'Logout' },
            ]}
            value={filterAction}
            placeholder="All Actions"
          />

          <SearchableSelect
            options={[
              { value: 'all', label: 'All Entities' },
              { value: 'User', label: 'Users' },
              { value: 'Customer', label: 'Customers' },
              { value: 'Order', label: 'Orders' },
              { value: 'Product', label: 'Products' },
              { value: 'Auth', label: 'Authentication' },
            ]}
            value={filterEntity}
            placeholder="All Entities"
          />

          <SearchableSelect
            options={[
              { value: 'today', label: 'Today' },
              { value: '7days', label: 'Last 7 Days' },
              { value: '30days', label: 'Last 30 Days' },
              { value: '90days', label: 'Last 90 Days' },
              { value: 'all', label: 'All Time' },
            ]}
            value={dateRange}
            placeholder="Today"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No logs found</h3>
            <p className="text-gray-600">
              {searchTerm || filterAction !== 'all' || filterEntity !== 'all'
                ? 'Try adjusting your filters'
                : 'No audit logs available'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-secondary border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {log.user}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.entity}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.details}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredLogs.length > 0 && (
        <div className="flex items-center justify-between card">
          <p className="text-sm text-gray-600">
            Showing {filteredLogs.length} of {logs.length} logs
          </p>
          <div className="flex gap-2">
            <button onClick={() => toast.success('Previous page')} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary">
              Previous
            </button>
            <button onClick={() => toast.success('Page 1')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              1
            </button>
            <button onClick={() => toast.success('Page 2')} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary">
              2
            </button>
            <button onClick={() => toast.success('Next page')} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
