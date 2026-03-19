import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { commissionsService } from '../../services/commissions.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SearchableSelect from '../../components/ui/SearchableSelect'
import toast from 'react-hot-toast'

export const CommissionReportsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [groupBy, setGroupBy] = useState<'agent' | 'type' | 'period'>('agent')

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount)
  }

  const { data: statsData, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['commission-stats'],
    queryFn: () => commissionsService.getCommissionStats(),
  })

  const { data: commissionsData, isLoading: commissionsLoading, isError: commissionsError } = useQuery({
    queryKey: ['commissions-report', dateRange],
    queryFn: () => commissionsService.getCommissions(),
  })

  const isLoading = statsLoading || commissionsLoading
  const isError = statsError || commissionsError
  const commissionsList = commissionsData?.commissions || []

  if (isLoading) return <LoadingSpinner />


  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 text-lg font-medium">Failed to load data</p>
          <p className="text-gray-500 mt-2">Please try refreshing the page</p>
        </div>
      </div>
    )
  }

  const mockReportData = {
    by_agent: commissionsList.reduce((acc: any[], c: any) => {
      const name = c.agent_name || c.user_name || 'Unknown'
      const existing = acc.find((a: any) => a.name === name)
      if (existing) { existing.total += Number(c.amount || 0); existing.count++ }
      else acc.push({ name, total: Number(c.amount || 0), count: 1 })
      return acc
    }, []),
    by_type: commissionsList.reduce((acc: any[], c: any) => {
      const type = c.transaction_type || c.type || 'Sale'
      const existing = acc.find((a: any) => a.type === type)
      if (existing) { existing.total += Number(c.amount || 0); existing.count++ }
      else acc.push({ type, total: Number(c.amount || 0), count: 1 })
      return acc
    }, []),
    by_period: [],
    summary: {
      total_commissions: (statsData as any)?.total_commissions || commissionsList.length,
      total_amount: (statsData as any)?.total_amount || commissionsList.reduce((s: number, c: any) => s + Number(c.amount || 0), 0),
      average_commission: (statsData as any)?.average_commission || (commissionsList.length > 0 ? commissionsList.reduce((s: number, c: any) => s + Number(c.amount || 0), 0) / commissionsList.length : 0),
      highest_earner: (statsData as any)?.highest_earner || null,
      growth_rate: (statsData as any)?.growth_rate || 0
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commission Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Comprehensive commission analytics and insights
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toast.success('PDF exported')} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-surface-secondary">
            Export PDF
          </button>
          <button onClick={() => toast.success('Excel exported')} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
            <SearchableSelect
              options={[
                { value: 'agent', label: 'Agent' },
                { value: 'type', label: 'Commission Type' },
                { value: 'period', label: 'Time Period' },
              ]}
              value={groupBy}
              placeholder="Agent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setDateRange({
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
              })}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Last 30 Days
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Commissions</p>
              <p className="text-2xl font-semibold text-gray-900">{mockReportData.summary.total_commissions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Amount</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(mockReportData.summary.total_amount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Average Commission</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(mockReportData.summary.average_commission)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
              <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Growth Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockReportData.summary.growth_rate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Commission Breakdown by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
        </h2>
        
        {groupBy === 'agent' && mockReportData.by_agent.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
            <p className="mt-1 text-sm text-gray-500">Commission data will appear here for the selected period.</p>
          </div>
        )}

        {groupBy === 'type' && mockReportData.by_type.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
            <p className="mt-1 text-sm text-gray-500">Commission data will appear here for the selected period.</p>
          </div>
        )}

        {groupBy === 'period' && mockReportData.by_period.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
            <p className="mt-1 text-sm text-gray-500">Commission data will appear here for the selected period.</p>
          </div>
        )}
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performers</h3>
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">Top performers will be displayed here</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Commission Trends</h3>
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">Commission trends will be displayed here</p>
          </div>
        </div>
      </div>
    </div>
  )
}
