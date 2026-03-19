import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tradeMarketingService } from '../../services/tradeMarketing.service'
import { TrendingUp, DollarSign, Target, Users, Calendar, MapPin } from 'lucide-react'
import SearchableSelect from '../../components/ui/SearchableSelect'

export default function TradeMarketingAnalyticsPage() {
  const [filter, setFilter] = useState({ period: 'month' })
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['trade-marketing-analytics', filter],
    queryFn: () => tradeMarketingService.getTradeMarketingAnalytics(filter)
  })

  const stats = analytics || {}
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', {style: 'currency', currency: 'ZAR'}).format(amount)

  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded"></div>)}</div></div></div>
  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">Failed to load analytics.</p></div></div>

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Trade Marketing Analytics</h1><p className="text-sm text-gray-600 mt-1">Comprehensive trade marketing insights</p></div>

      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
        <SearchableSelect
          options={[
            { value: 'week', label: 'This Week' },
            { value: 'month', label: 'This Month' },
            { value: 'quarter', label: 'This Quarter' },
            { value: 'year', label: 'This Year' },
          ]}
          value={filter.period}
          placeholder="This Week"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Campaigns</p><p className="text-2xl font-bold text-gray-900">{stats.total_campaigns || 0}</p></div>
            <Target className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Budget</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_budget || 0)}</p></div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Activations</p><p className="text-2xl font-bold text-gray-900">{stats.total_activations || 0}</p></div>
            <Calendar className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Reach</p><p className="text-2xl font-bold text-gray-900">{stats.total_reach || 0}</p></div>
            <Users className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Campaign Performance</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600">Budget Utilization</span>
                <span className="text-sm font-bold text-gray-900">{stats.budget_utilization || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{width: `${stats.budget_utilization || 0}%`}}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600">Campaign Success Rate</span>
                <span className="text-sm font-bold text-gray-900">{stats.success_rate || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{width: `${stats.success_rate || 0}%`}}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600">Avg Engagement Rate</span>
                <span className="text-sm font-bold text-gray-900">{stats.avg_engagement_rate || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{width: `${stats.avg_engagement_rate || 0}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Board Installations</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Boards</span>
              <span className="text-sm font-bold text-gray-900">{stats.total_boards || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Installed</span>
              <span className="text-sm font-bold text-green-600">{stats.installed_boards || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending</span>
              <span className="text-sm font-bold text-yellow-600">{stats.pending_boards || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg Coverage</span>
              <span className="text-sm font-bold text-blue-600">{stats.avg_board_coverage || 0}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Compliance & Quality</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-100 rounded-lg">
            <p className="text-sm text-gray-600">Total Audits</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total_audits || 0}</p>
          </div>
          <div className="p-4 border border-gray-100 rounded-lg">
            <p className="text-sm text-gray-600">Compliance Rate</p>
            <p className="text-2xl font-bold text-green-600">{stats.compliance_rate || 0}%</p>
          </div>
          <div className="p-4 border border-gray-100 rounded-lg">
            <p className="text-sm text-gray-600">Avg Audit Score</p>
            <p className="text-2xl font-bold text-blue-600">{stats.avg_audit_score || 0}%</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Promoter Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 border border-gray-100 rounded-lg">
            <p className="text-sm text-gray-600">Total Promoters</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total_promoters || 0}</p>
          </div>
          <div className="p-4 border border-gray-100 rounded-lg">
            <p className="text-sm text-gray-600">Active Promoters</p>
            <p className="text-2xl font-bold text-green-600">{stats.active_promoters || 0}</p>
          </div>
          <div className="p-4 border border-gray-100 rounded-lg">
            <p className="text-sm text-gray-600">Avg Activations/Promoter</p>
            <p className="text-2xl font-bold text-blue-600">{stats.avg_activations_per_promoter || 0}</p>
          </div>
          <div className="p-4 border border-gray-100 rounded-lg">
            <p className="text-sm text-gray-600">Avg Performance Score</p>
            <p className="text-2xl font-bold text-purple-600">{stats.avg_promoter_score || 0}%</p>
          </div>
        </div>
      </div>
    </div>
  )
}
