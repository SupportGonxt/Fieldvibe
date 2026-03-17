import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { BarChart3, Building2, Calendar, TrendingUp, Users, Target, Award, UserCheck, PieChart as PieChartIcon } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6']

export default function BrandInsightsPage() {
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })
  const [selectedCompany, setSelectedCompany] = useState('')

  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })

  const companies = companiesResp?.data || companiesResp || []

  const { data: insights, isLoading, error } = useQuery({
    queryKey: ['brand-insights', dateRange, selectedCompany],
    queryFn: () => fieldOperationsService.getBrandInsights({
      ...dateRange,
      company_id: selectedCompany || undefined
    }),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load brand insights.
        </div>
      </div>
    )
  }

  const summary = insights?.summary || {}
  const companyBreakdown = insights?.company_breakdown || []
  const dailyTrends = insights?.daily_trends || []
  const topAgents = insights?.top_agents || []
  const registrationsByCompany = insights?.registrations_by_company || []

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Brand Insights</h1>
          <p className="text-gray-600 dark:text-gray-400">Performance analytics per brand/company (SSReports-style)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="input text-sm"
          >
            <option value="">All Companies</option>
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Calendar className="w-4 h-4 text-gray-500" />
          <input type="date" value={dateRange.start_date} onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })} className="input text-sm" />
          <span className="text-gray-500">to</span>
          <input type="date" value={dateRange.end_date} onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })} className="input text-sm" />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Visits" value={summary.total_visits || 0} icon={<Target className="w-5 h-5 text-blue-600" />} bg="bg-blue-100 dark:bg-blue-900/30" />
        <KPICard title="Total Registrations" value={summary.total_registrations || 0} icon={<UserCheck className="w-5 h-5 text-green-600" />} bg="bg-green-100 dark:bg-green-900/30" />
        <KPICard title="Total Conversions" value={summary.total_conversions || 0} icon={<Award className="w-5 h-5 text-purple-600" />} bg="bg-purple-100 dark:bg-purple-900/30" />
        <KPICard title="Conversion Rate" value={`${summary.conversion_rate || 0}%`} icon={<TrendingUp className="w-5 h-5 text-yellow-600" />} bg="bg-yellow-100 dark:bg-yellow-900/30" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Breakdown Pie */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Registrations by Company</h3>
            <PieChartIcon className="w-5 h-5 text-gray-400" />
          </div>
          {registrationsByCompany.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={registrationsByCompany}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="company_name"
                  >
                    {registrationsByCompany.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No data available</div>
          )}
        </div>

        {/* Daily Trends Line */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Activity Trends</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          {dailyTrends.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="visits" stroke="#3B82F6" strokeWidth={2} name="Visits" />
                  <Line type="monotone" dataKey="registrations" stroke="#10B981" strokeWidth={2} name="Registrations" />
                  <Line type="monotone" dataKey="conversions" stroke="#8B5CF6" strokeWidth={2} name="Conversions" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No trend data available</div>
          )}
        </div>
      </div>

      {/* Company Breakdown Table */}
      {companyBreakdown.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Company Performance Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Agents</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Visits</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Registrations</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conversions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conv. Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Visits/Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {companyBreakdown.map((c: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {c.company_name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{c.agents || 0}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{c.visits || 0}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{c.registrations || 0}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{c.conversions || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${(c.conversion_rate || 0) >= 50 ? 'bg-green-100 text-green-800' : (c.conversion_rate || 0) >= 25 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {c.conversion_rate || 0}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {c.agents > 0 ? Math.round((c.visits || 0) / c.agents) : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Company Bar Chart */}
      {companyBreakdown.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Company Comparison</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={companyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="company_name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="visits" fill="#3B82F6" name="Visits" />
                <Bar dataKey="registrations" fill="#10B981" name="Registrations" />
                <Bar dataKey="conversions" fill="#8B5CF6" name="Conversions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Agents */}
      {topAgents.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Performing Agents</h3>
          <div className="space-y-3">
            {topAgents.slice(0, 10).map((agent: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                    index === 1 ? 'bg-gray-200 text-gray-800' :
                    index === 2 ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{agent.agent_name}</p>
                    <p className="text-sm text-gray-500">{agent.company_name || 'All Companies'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 dark:text-white">{agent.total_visits || agent.visits || 0} visits</p>
                  <p className="text-sm text-gray-500">{agent.conversions || 0} conversions</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!companyBreakdown.length && !dailyTrends.length && !topAgents.length && (
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">No brand insights data available</p>
          <p className="text-gray-400 text-sm">Data will appear once agents start registering individuals and making visits</p>
        </div>
      )}
    </div>
  )
}

function KPICard({ title, value, icon, bg }: { title: string; value: string | number; icon: React.ReactNode; bg: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  )
}
