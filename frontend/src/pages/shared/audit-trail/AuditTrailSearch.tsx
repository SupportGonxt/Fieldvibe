import { useState } from 'react'
import { Search, Clock, User } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

interface AuditTrailSearchProps {
  entityType: string
  entityId: string
}

export default function AuditTrailSearch({ entityType, entityId }: AuditTrailSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const { data: results, isLoading, isError } = useQuery({
    queryKey: ['audit-search', entityType, entityId, searchQuery],
    queryFn: async () => {
      if (!searchQuery) return []
      return [
        {
          id: '1',
          action: 'updated',
          description: 'Status updated from pending to approved',
          performed_by: 'John User',
          performed_at: '2024-01-20T10:00:00Z',
          relevance: 0.95,
        },
        {
          id: '2',
          action: 'approved',
          description: 'Record approved by manager',
          performed_by: 'Manager',
          performed_at: '2024-01-20T11:00:00Z',
          relevance: 0.85,
        },
      ]
    },
    enabled: searchQuery.length > 0,
  })

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Audit Trail</h2>
      
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search audit trail..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {isLoading && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">Searching...</p>
        </div>
      )}

      {!isLoading && searchQuery && results && results.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">No results found for "{searchQuery}"</p>
        </div>
      )}

      {!isLoading && results && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-4">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          {results.map((result) => (
            <div key={result.id} className="border rounded-lg p-4 hover:bg-surface-secondary cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">{result.description}</h3>
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                  {result.action}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {result.performed_by}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(result.performed_at).toLocaleString()}
                </div>
                <div className="ml-auto">
                  <span className="text-xs text-gray-500">
                    {(result.relevance * 100).toFixed(0)}% match
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
