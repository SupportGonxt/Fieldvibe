import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { commissionsService } from '../../services/commissions.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import ExportMenu from '../../components/export/ExportMenu'

export const CommissionDashboardPage: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['commission-stats', dateRange],
    queryFn: () => commissionsService.getCommissionStats(dateRange)
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

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


  const commissionStats = stats || {
    total_commissions: 0,
    pending_commissions: 0,
    approved_commissions: 0,
    paid_commissions: 0,
    total_amount: 0,
    pending_amount: 0,
    approved_amount: 0,
    paid_amount: 0,
    top_earners: [],
    commissions_by_type: []
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commission Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of commission earnings and payments
          </p>
        </div>
        <ExportMenu
          data={[
            { metric: 'Total Commissions', amount: commissionStats.total_amount, count: commissionStats.total_commissions },
            { metric: 'Pending', amount: commissionStats.pending_amount, count: commissionStats.pending_commissions },
            { metric: 'Approved', amount: commissionStats.approved_amount, count: commissionStats.approved_commissions },
            { metric: 'Paid', amount: commissionStats.paid_amount, count: commissionStats.paid_commissions },
          ]}
          columns={[
            { key: 'metric', label: 'Metric' },
            { key: 'amount', label: 'Amount' },
            { key: 'count', label: 'Count' },
          ]}
          filename="commission-report"
          title="Commission Report"
        />
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setDateRange({
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              end: new Date().toISOString().split('T')[0]
            })}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Commissions</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(commissionStats.total_amount)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(commissionStats.pending_amount)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Approved</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(commissionStats.approved_amount)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Paid</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(commissionStats.paid_amount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Commission Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Type */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Commissions by Type</h2>
          {(commissionStats?.commissions_by_type?.length ?? 0) === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No commission data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(commissionStats?.commissions_by_type || []).map((type: any, index: number) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{type.type}</span>
                    <span className="font-medium text-gray-900">{formatCurrency(type.amount)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${commissionStats.total_amount > 0
                          ? (type.amount / commissionStats.total_amount) * 100
                          : 0}%`
                      }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{type.count} transactions</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Earners */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Top Earners</h2>
          {(commissionStats?.top_earners?.length ?? 0) === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No earner data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {((commissionStats?.top_earners) || []).slice(0, 5).map((earner: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-medium text-sm">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{earner.name}</p>
                      <p className="text-sm text-gray-500">{earner.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(earner.total_commission)}</p>
                    <p className="text-sm text-gray-500">{earner.transaction_count} txns</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Commission Status Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">{commissionStats.pending_commissions}</div>
            <div className="text-sm text-gray-500 mt-1">Pending Approval</div>
            <div className="text-lg font-semibold text-gray-900 mt-2">
              {formatCurrency(commissionStats.pending_amount)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{commissionStats.approved_commissions}</div>
            <div className="text-sm text-gray-500 mt-1">Approved (Awaiting Payment)</div>
            <div className="text-lg font-semibold text-gray-900 mt-2">
              {formatCurrency(commissionStats.approved_amount)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{commissionStats.paid_commissions}</div>
            <div className="text-sm text-gray-500 mt-1">Paid</div>
            <div className="text-lg font-semibold text-gray-900 mt-2">
              {formatCurrency(commissionStats.paid_amount)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
