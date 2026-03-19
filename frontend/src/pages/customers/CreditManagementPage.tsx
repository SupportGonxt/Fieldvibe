import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../services/api.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'
import { DollarSign, AlertTriangle, CheckCircle, Users } from 'lucide-react'

export default function CreditManagementPage() {
  const [filter, setFilter] = useState<'all' | 'over_limit' | 'good'>('all')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customers-credit'],
    queryFn: () => apiClient.get('/customers').then(r => r.data)
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return <ErrorState title="Failed to load credit data" onRetry={refetch} />

  const customers = (data?.data || data || []) as any[]
  const customersWithCredit = customers.map((c: any) => ({
    ...c,
    credit_limit: c.credit_limit || 0,
    outstanding_balance: c.outstanding_balance || 0,
    available_credit: (c.credit_limit || 0) - (c.outstanding_balance || 0),
    utilization: c.credit_limit ? ((c.outstanding_balance || 0) / c.credit_limit * 100) : 0
  }))

  const filtered = filter === 'all' ? customersWithCredit
    : filter === 'over_limit' ? customersWithCredit.filter(c => c.outstanding_balance > c.credit_limit)
    : customersWithCredit.filter(c => c.outstanding_balance <= c.credit_limit)

  const totalCreditLimit = customersWithCredit.reduce((s: number, c: any) => s + c.credit_limit, 0)
  const totalOutstanding = customersWithCredit.reduce((s: number, c: any) => s + c.outstanding_balance, 0)
  const overLimitCount = customersWithCredit.filter((c: any) => c.outstanding_balance > c.credit_limit).length

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Credit Management</h1>
        <p className="text-gray-600">Monitor customer credit limits and outstanding balances</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-100">
          <div className="flex items-center gap-2 text-gray-600 text-sm mb-1"><Users className="w-4 h-4" /> Total Customers</div>
          <div className="text-2xl font-bold text-gray-900">{customersWithCredit.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-100">
          <div className="flex items-center gap-2 text-gray-600 text-sm mb-1"><DollarSign className="w-4 h-4" /> Total Credit</div>
          <div className="text-2xl font-bold text-blue-600">R {totalCreditLimit.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-100">
          <div className="flex items-center gap-2 text-gray-600 text-sm mb-1"><DollarSign className="w-4 h-4" /> Outstanding</div>
          <div className="text-2xl font-bold text-orange-600">R {totalOutstanding.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-100">
          <div className="flex items-center gap-2 text-gray-600 text-sm mb-1"><AlertTriangle className="w-4 h-4" /> Over Limit</div>
          <div className="text-2xl font-bold text-red-600">{overLimitCount}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'over_limit', 'good'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
            {f === 'all' ? 'All' : f === 'over_limit' ? 'Over Limit' : 'Good Standing'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit Limit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Available</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No customers found</td></tr>
            ) : filtered.slice(0, 50).map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{c.name}</div>
                  <div className="text-sm text-gray-500">{c.code || c.email || ''}</div>
                </td>
                <td className="px-6 py-4 text-right text-sm">R {c.credit_limit.toLocaleString()}</td>
                <td className="px-6 py-4 text-right text-sm font-medium">{c.outstanding_balance > 0 ? <span className="text-orange-600">R {c.outstanding_balance.toLocaleString()}</span> : <span className="text-gray-400">R 0</span>}</td>
                <td className="px-6 py-4 text-right text-sm">{c.available_credit >= 0 ? <span className="text-green-600">R {c.available_credit.toLocaleString()}</span> : <span className="text-red-600">-R {Math.abs(c.available_credit).toLocaleString()}</span>}</td>
                <td className="px-6 py-4 text-center">
                  {c.outstanding_balance > c.credit_limit ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700"><AlertTriangle className="w-3 h-3" /> Over Limit</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700"><CheckCircle className="w-3 h-3" /> Good</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
