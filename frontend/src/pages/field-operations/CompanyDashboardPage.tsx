import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Building2, Users, Target, TrendingUp, UserPlus, CheckCircle, ArrowLeft, Calendar } from 'lucide-react'

export default function CompanyDashboardPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()

  // Check for company_token (company portal auth) or main app auth
  const companyToken = localStorage.getItem('company_token')
  const isCompanyPortal = !window.location.pathname.startsWith('/field-operations/')
  if (isCompanyPortal && !companyToken) {
    navigate('/company-login')
    return null
  }

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['company-dashboard', companyId],
    queryFn: () => fieldOperationsService.getCompanyDashboard(companyId!),
    enabled: !!companyId,
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  }

  if (error || !dashboard) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/field-operations/companies')} className="btn-outline mb-4 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Companies
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load company dashboard.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/field-operations/companies')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard.company?.name || 'Company'} Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">{dashboard.company?.description || 'Company performance overview'}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Active Agents" value={dashboard.agents || 0} icon={<Users className="w-6 h-6 text-blue-600" />} bg="bg-blue-100 dark:bg-blue-900/30" />
        <KPICard title="Today's Visits" value={dashboard.today_visits || 0} icon={<Target className="w-6 h-6 text-green-600" />} bg="bg-green-100 dark:bg-green-900/30" />
        <KPICard title="Month Visits" value={dashboard.month_visits || 0} icon={<Calendar className="w-6 h-6 text-purple-600" />} bg="bg-purple-100 dark:bg-purple-900/30" />
        <KPICard title="Conversion Rate" value={`${dashboard.conversion_rate || 0}%`} icon={<TrendingUp className="w-6 h-6 text-yellow-600" />} bg="bg-yellow-100 dark:bg-yellow-900/30" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KPICard title="Total Registrations" value={dashboard.total_registrations || 0} icon={<UserPlus className="w-6 h-6 text-indigo-600" />} bg="bg-indigo-100 dark:bg-indigo-900/30" />
        <KPICard title="Total Conversions" value={dashboard.total_conversions || 0} icon={<CheckCircle className="w-6 h-6 text-emerald-600" />} bg="bg-emerald-100 dark:bg-emerald-900/30" />
      </div>

      {/* Recent Registrations */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Registrations</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(dashboard.recent_registrations || []).map((reg: any) => (
                <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{reg.first_name} {reg.last_name}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{reg.agent_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{reg.phone || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${reg.converted ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                      {reg.converted ? 'Converted' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-sm">{reg.created_at ? new Date(reg.created_at).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
              {(dashboard.recent_registrations || []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No recent registrations</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KPICard({ title, value, icon, bg }: { title: string; value: string | number; icon: React.ReactNode; bg: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${bg}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  )
}
