import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tradeMarketingService } from '../../services/tradeMarketing.service'
import { CheckCircle, XCircle, AlertCircle, TrendingUp } from 'lucide-react'
import SearchableSelect from '../../components/ui/SearchableSelect'

export default function MerchandisingCompliancePage() {
  const [filter, setFilter] = useState({ page: 1, limit: 20, compliance_status: '' })
  const { data, isLoading, error } = useQuery({
    queryKey: ['merchandising-compliance', filter],
    queryFn: () => tradeMarketingService.getMerchandisingCompliance(filter)
  })

  const audits = data?.data || []
  const total = data?.total || 0

  const getComplianceBadge = (status: string) => {
    const colors = {
      compliant: 'bg-green-100 text-green-800',
      non_compliant: 'bg-red-100 text-red-800',
      partial: 'bg-yellow-100 text-yellow-800'
    }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>{status.replace('_', ' ').toUpperCase()}</span>
  }

  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">Failed to load compliance data.</p></div></div>
  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-64 bg-gray-200 rounded"></div></div></div>

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Merchandising Compliance</h1><p className="text-sm text-gray-600 mt-1">Monitor in-store compliance audits ({total} total)</p></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Audits</p><p className="text-2xl font-bold text-gray-900">{total}</p></div>
            <AlertCircle className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Compliant</p><p className="text-2xl font-bold text-green-600">{audits.filter(a => a.compliance_status === 'compliant').length}</p></div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Non-Compliant</p><p className="text-2xl font-bold text-red-600">{audits.filter(a => a.compliance_status === 'non_compliant').length}</p></div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Compliance Rate</p><p className="text-2xl font-bold text-gray-900">{audits.length > 0 ? ((audits.filter(a => a.compliance_status === 'compliant').length / audits.length) * 100).toFixed(1) : 0}%</p></div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <SearchableSelect
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'compliant', label: 'Compliant' },
            { value: 'non_compliant', label: 'Non-Compliant' },
            { value: 'partial', label: 'Partial' },
          ]}
          value={filter.compliance_status || null}
          placeholder="All Statuses"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Audit Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Auditor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issues</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {audits.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500"><AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-2" /><p>No compliance audits found</p></td></tr>
              ) : (
                audits.map(audit => (
                  <tr key={audit.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{audit.store_name}</div><div className="text-sm text-gray-500">{audit.store_location}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-900">{audit.brand_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{new Date(audit.audit_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">Agent #{audit.auditor_id?.substring(0,8)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[80px]">
                          <div className={`h-2 rounded-full ${audit.compliance_score >= 80 ? 'bg-green-600' : audit.compliance_score >= 60 ? 'bg-yellow-600' : 'bg-red-600'}`} style={{width: `${audit.compliance_score || 0}%`}}></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{audit.compliance_score || 0}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getComplianceBadge(audit.compliance_status)}</td>
                    <td className="px-6 py-4 text-sm text-red-600">{audit.issues_count || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > filter.limit && (
        <div className="flex justify-between items-center bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-700">Showing {(filter.page-1)*filter.limit+1} to {Math.min(filter.page*filter.limit,total)} of {total}</div>
          <div className="flex space-x-2">
            <button onClick={() => setFilter({...filter, page: filter.page-1})} disabled={filter.page<=1} className="px-4 py-2 border rounded-lg disabled:opacity-50">Previous</button>
            <button onClick={() => setFilter({...filter, page: filter.page+1})} disabled={filter.page*filter.limit>=total} className="px-4 py-2 border rounded-lg disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
