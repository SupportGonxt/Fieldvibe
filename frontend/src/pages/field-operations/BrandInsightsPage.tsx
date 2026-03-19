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
import SearchableSelect from '../../components/ui/SearchableSelect'

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

  const summary = insights?.kpis || {}
  const dailyTrends = insights?.visits_by_day || []
  const topAgents = insights?.agent_performance || []
  const conversionsByDay = insights?.conversions_by_day || []
  const visitsByHour = insights?.visits_by_hour || []

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Brand Insights</h1>
          <p className="text-gray-600 dark:text-gray-400">Performance analytics per brand/company</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect
            options={[
              { value: '', label: 'All Companies' },
              { value: 'c.id', label: '{c.name}' },
            ]}
            value={selectedCompany || null}
            placeholder="All Companies"
          />
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
        {/* Daily Visits Line */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Visit Trends</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          {dailyTrends.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="visit_date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} name="Visits" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No visit trend data available</div>
          )}
        </div>

        {/* Conversions by Day */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Registrations & Conversions</h3>
            <PieChartIcon className="w-5 h-5 text-gray-400" />
          </div>
          {conversionsByDay.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionsByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={(d) => new Date(d).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="registrations" fill="#10B981" name="Registrations" />
                  <Bar dataKey="conversions" fill="#8B5CF6" name="Conversions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">No conversion data available</div>
          )}
        </div>
      </div>

      {/* Visits by Hour */}
      {visitsByHour.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Visits by Hour of Day</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visitsByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                <YAxis />
                <Tooltip labelFormatter={(h) => `${h}:00 - ${h}:59`} />
                <Bar dataKey="count" fill="#3B82F6" name="Visits" />
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
                    <p className="text-sm text-gray-500">{agent.completed || 0} completed</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 dark:text-white">{agent.visit_count || 0} visits</p>
                  <p className="text-sm text-gray-500">{agent.completed || 0} completed</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!dailyTrends.length && !topAgents.length && !conversionsByDay.length && (
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
