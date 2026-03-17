import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { toast } from 'react-hot-toast'
import {
  Building2, Users, Target, TrendingUp, UserPlus, CheckCircle, ArrowLeft, Calendar,
  Download, BarChart3, Clock, Award, Activity, LogOut, PieChart as PieChartIcon
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'

export default function CompanyDashboardPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()

  const companyToken = localStorage.getItem('company_token')
  const isCompanyPortal = !window.location.pathname.startsWith('/field-operations/')
  const companyName = localStorage.getItem('company_name') || 'Company'

  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'registrations'>('overview')

  const { data: dashboard, isLoading: dashLoading, error: dashError } = useQuery({
    queryKey: ['company-dashboard', companyId, isCompanyPortal],
    queryFn: () => isCompanyPortal
      ? fieldOperationsService.getCompanyPortalDashboard()
      : fieldOperationsService.getCompanyDashboard(companyId!),
    enabled: (!!companyId || isCompanyPortal) && !(isCompanyPortal && !companyToken),
  })

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['company-brand-insights', dateRange, isCompanyPortal, companyId],
    queryFn: () => isCompanyPortal
      ? fieldOperationsService.getCompanyPortalBrandInsights(dateRange)
      : fieldOperationsService.getBrandInsights({ company_id: companyId, ...dateRange }),
    enabled: (!!companyId || isCompanyPortal) && activeTab !== 'overview' && !(isCompanyPortal && !companyToken),
  })

  // Redirect to login AFTER all hooks have been called (Rules of Hooks compliance)
  if (isCompanyPortal && !companyToken) {
    return <Navigate to="/company-login" replace />
  }

  const handleLogout = () => {
    localStorage.removeItem('company_token')
    localStorage.removeItem('company_id')
    localStorage.removeItem('company_name')
    navigate('/company-login')
  }

  const handleExport = async (type: 'visits' | 'registrations') => {
    try {
      const blob = await fieldOperationsService.exportCompanyPortalData(type, dateRange.start_date, dateRange.end_date)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_export_${dateRange.start_date}_to_${dateRange.end_date}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`${type} exported successfully`)
    } catch {
      toast.error('Export failed')
    }
  }

  if (dashLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  }

  if (dashError || !dashboard) {
    return (
      <div className="p-6">
        {!isCompanyPortal && (
          <button onClick={() => navigate('/field-operations/companies')} className="btn-outline mb-4 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Companies
          </button>
        )}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load company dashboard.
        </div>
      </div>
    )
  }

  const summary = insights?.kpis || {}
  const dailyTrends = insights?.visits_by_day || []
  const visitsByHour = insights?.visits_by_hour || []
  const visitsByDayOfWeek = insights?.visits_by_day_of_week || []
  const topAgents = insights?.agent_performance || []
  const conversionsByDay = insights?.conversions_by_day || []
  const targetVsActual = insights?.target_vs_actual || []
  const recentRegsInsights = insights?.recent_registrations || []

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {!isCompanyPortal && (
            <button onClick={() => navigate('/field-operations/companies')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard.company?.name || companyName} Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">{dashboard.company?.description || 'Brand owner performance overview & analytics'}</p>
            </div>
          </div>
        </div>
        {isCompanyPortal && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => handleExport('visits')} className="btn-outline text-sm flex items-center gap-1">
              <Download className="w-4 h-4" /> Visits CSV
            </button>
            <button onClick={() => handleExport('registrations')} className="btn-outline text-sm flex items-center gap-1">
              <Download className="w-4 h-4" /> Registrations CSV
            </button>
            <button onClick={handleLogout} className="btn-outline text-sm flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {(['overview', 'analytics', 'registrations'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'analytics' ? 'Deep Analytics' : 'Registrations'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Active Agents" value={dashboard.agents || 0} icon={<Users className="w-5 h-5 text-blue-600" />} bg="bg-blue-100 dark:bg-blue-900/30" />
            <KPICard title="Today's Visits" value={dashboard.today_visits || 0} icon={<Target className="w-5 h-5 text-green-600" />} bg="bg-green-100 dark:bg-green-900/30" />
            <KPICard title="Month Visits" value={dashboard.month_visits || 0} icon={<Calendar className="w-5 h-5 text-purple-600" />} bg="bg-purple-100 dark:bg-purple-900/30" />
            <KPICard title="Conversion Rate" value={`${dashboard.conversion_rate || 0}%`} icon={<TrendingUp className="w-5 h-5 text-yellow-600" />} bg="bg-yellow-100 dark:bg-yellow-900/30" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KPICard title="Total Registrations" value={dashboard.total_registrations || 0} icon={<UserPlus className="w-5 h-5 text-indigo-600" />} bg="bg-indigo-100 dark:bg-indigo-900/30" />
            <KPICard title="Total Conversions" value={dashboard.total_conversions || 0} icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-100 dark:bg-emerald-900/30" />
          </div>
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
        </>
      )}

      {/* Deep Analytics Tab — SSReports-style */}
      {activeTab === 'analytics' && (
        <>
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input type="date" value={dateRange.start_date} onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })} className="input text-sm" />
            <span className="text-gray-500">to</span>
            <input type="date" value={dateRange.end_date} onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })} className="input text-sm" />
          </div>

          {insightsLoading ? (
            <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
          ) : (
            <>
              {/* Analytics KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KPICard title="Total Visits" value={summary.total_visits || 0} icon={<Target className="w-5 h-5 text-blue-600" />} bg="bg-blue-100 dark:bg-blue-900/30" />
                <KPICard title="Active Agents" value={summary.active_agents || 0} icon={<Users className="w-5 h-5 text-cyan-600" />} bg="bg-cyan-100 dark:bg-cyan-900/30" />
                <KPICard title="Registrations" value={summary.total_registrations || 0} icon={<UserPlus className="w-5 h-5 text-green-600" />} bg="bg-green-100 dark:bg-green-900/30" />
                <KPICard title="Conversions" value={summary.total_conversions || 0} icon={<Award className="w-5 h-5 text-purple-600" />} bg="bg-purple-100 dark:bg-purple-900/30" />
                <KPICard title="Conversion Rate" value={`${summary.conversion_rate || 0}%`} icon={<TrendingUp className="w-5 h-5 text-yellow-600" />} bg="bg-yellow-100 dark:bg-yellow-900/30" />
              </div>

              {/* Daily Visit Trends + Registrations & Conversions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Visit Trends</h3>
                  </div>
                  {dailyTrends.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyTrends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="visit_date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })} />
                          <YAxis />
                          <Tooltip labelFormatter={(d) => new Date(d).toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' })} />
                          <defs>
                            <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="count" stroke="#3B82F6" fill="url(#visitGrad)" strokeWidth={2} name="Visits" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <div className="h-64 flex items-center justify-center text-gray-400">No visit trend data</div>}
                </div>

                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <PieChartIcon className="w-5 h-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Registrations & Conversions</h3>
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
                          <Bar dataKey="registrations" fill="#10B981" name="Registrations" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="conversions" fill="#8B5CF6" name="Conversions" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <div className="h-64 flex items-center justify-center text-gray-400">No conversion data</div>}
                </div>
              </div>

              {/* Visits by Hour + by Day of Week */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-cyan-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Visits by Hour of Day</h3>
                  </div>
                  {visitsByHour.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={visitsByHour}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                          <YAxis />
                          <Tooltip labelFormatter={(h) => `${h}:00 - ${h}:59`} />
                          <defs>
                            <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="count" stroke="#06B6D4" fill="url(#hourGrad)" strokeWidth={2} name="Visits" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <div className="h-64 flex items-center justify-center text-gray-400">No hourly data</div>}
                </div>

                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Visits by Day of Week</h3>
                  </div>
                  {visitsByDayOfWeek.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={visitsByDayOfWeek}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day_name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#3B82F6" name="Visits" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <div className="h-64 flex items-center justify-center text-gray-400">No day-of-week data</div>}
                </div>
              </div>

              {/* Conversion Pie + Target vs Actual */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Conversion Breakdown</h3>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Converted', value: summary.total_conversions || 0 },
                            { name: 'Pending', value: Math.max(0, (summary.total_registrations || 0) - (summary.total_conversions || 0)) },
                          ].filter(d => d.value > 0)}
                          cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value"
                        >
                          <Cell fill="#10B981" />
                          <Cell fill="#F59E0B" />
                        </Pie>
                        <Tooltip formatter={(value: number) => value.toLocaleString()} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-red-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Today's Target vs Actual</h3>
                  </div>
                  {targetVsActual.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={targetVsActual} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="agent_name" type="category" width={100} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="target_visits" fill="#E5E7EB" name="Target" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="actual_visits" fill="#3B82F6" name="Actual" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <div className="h-64 flex items-center justify-center text-gray-400">No daily targets configured</div>}
                </div>
              </div>

              {/* Top Agents Bar Chart + Leaderboard */}
              {topAgents.length > 0 && (
                <>
                  <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Performing Agents</h3>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topAgents.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="agent_name" type="category" width={120} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="visit_count" fill="#3B82F6" name="Visits" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="completed" fill="#10B981" name="Completed" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agent Leaderboard</h3>
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
                            <p className="font-medium text-gray-900 dark:text-white">{agent.agent_name}</p>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-right">
                              <p className="font-medium text-gray-900 dark:text-white">{agent.visit_count || 0}</p>
                              <p className="text-gray-500">visits</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-green-600">{agent.completed || 0}</p>
                              <p className="text-gray-500">completed</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-purple-600">
                                {agent.visit_count > 0 ? Math.round((agent.completed / agent.visit_count) * 100) : 0}%
                              </p>
                              <p className="text-gray-500">rate</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {!dailyTrends.length && !topAgents.length && !conversionsByDay.length && (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-lg font-medium">No analytics data available</p>
                  <p className="text-gray-400 text-sm">Data will appear once agents start making visits and registering individuals</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Registrations Tab */}
      {activeTab === 'registrations' && (
        <>
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input type="date" value={dateRange.start_date} onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })} className="input text-sm" />
            <span className="text-gray-500">to</span>
            <input type="date" value={dateRange.end_date} onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })} className="input text-sm" />
            {isCompanyPortal && (
              <button onClick={() => handleExport('registrations')} className="btn-outline text-sm flex items-center gap-1 ml-auto">
                <Download className="w-4 h-4" /> Export CSV
              </button>
            )}
          </div>

          {insightsLoading ? (
            <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
          ) : (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Individual Registrations ({recentRegsInsights.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {recentRegsInsights.map((reg: any) => (
                      <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{reg.first_name} {reg.last_name}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{reg.id_number || '-'}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{reg.phone || '-'}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{reg.agent_name || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${reg.converted ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                            {reg.converted ? 'Converted' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-sm">{reg.created_at ? new Date(reg.created_at).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                    {recentRegsInsights.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No registrations in selected period</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
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
          <p className="text-xl font-bold text-gray-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        </div>
      </div>
    </div>
  )
}
