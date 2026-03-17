import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { ArrowLeft, User, Target, TrendingUp, Calendar, Building2, ChevronRight, UserCheck, Award } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts'

export default function PerformanceDrillDownPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })

  const { data: drillDown, isLoading, error } = useQuery({
    queryKey: ['field-ops-drill-down', userId, dateRange],
    queryFn: () => fieldOperationsService.getDrillDown(userId!, dateRange),
    enabled: !!userId,
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  }

  if (error || !drillDown) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(-1)} className="btn-outline mb-4 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load drill-down data. The user may not exist or you may not have permission.
        </div>
      </div>
    )
  }

  const user = drillDown.user || {}
  const subordinates = drillDown.subordinates || []
  const dailyData = drillDown.daily_breakdown || []
  const companyData = drillDown.company_breakdown || []

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {user.first_name} {user.last_name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 capitalize">
            {(user.role || '').replace('_', ' ')} Performance Drill-Down
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input type="date" value={dateRange.start_date} onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })} className="input text-sm" />
          <span className="text-gray-500">to</span>
          <input type="date" value={dateRange.end_date} onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })} className="input text-sm" />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><Target className="w-5 h-5 text-blue-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Total Visits</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{drillDown.total_visits || 0}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30"><UserCheck className="w-5 h-5 text-green-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Registrations</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{drillDown.total_registrations || 0}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><Award className="w-5 h-5 text-purple-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Conversions</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{drillDown.total_conversions || 0}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30"><TrendingUp className="w-5 h-5 text-yellow-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Conversion Rate</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{drillDown.conversion_rate || 0}%</p>
          </div>
        </div>
      </div>

      {/* Daily Breakdown Chart */}
      {dailyData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="visits" fill="#3B82F6" name="Visits" />
                <Bar dataKey="registrations" fill="#10B981" name="Registrations" />
                <Bar dataKey="conversions" fill="#8B5CF6" name="Conversions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Company Breakdown */}
      {companyData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance by Company</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Visits</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Registrations</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conversions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {companyData.map((c: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" /> {c.company_name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{c.visits}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{c.registrations}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{c.conversions}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${c.conversion_rate >= 50 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {c.conversion_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subordinates */}
      {subordinates.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {user.role === 'manager' ? 'Team Leads' : 'Agents'}
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Visits</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Registrations</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conversions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {subordinates.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{sub.first_name} {sub.last_name}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 capitalize">{(sub.role || '').replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{sub.visits || 0}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{sub.registrations || 0}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{sub.conversions || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/field-operations/drill-down/${sub.id}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 justify-end"
                      >
                        Drill Down <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Target Performance */}
      {drillDown.targets && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Target Achievement</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TargetBar label="Visits" current={drillDown.total_visits || 0} target={drillDown.targets.visits || 20} />
            <TargetBar label="Registrations" current={drillDown.total_registrations || 0} target={drillDown.targets.registrations || 10} />
            <TargetBar label="Conversions" current={drillDown.total_conversions || 0} target={drillDown.targets.conversions || 5} />
          </div>
        </div>
      )}
    </div>
  )
}

function TargetBar({ label, current, target }: { label: string; current: number; target: number }) {
  const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0
  const colorClass = pct >= 80 ? 'bg-green-600' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-gray-500">{current}/{target} ({pct}%)</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
        <div className={`${colorClass} h-3 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
