import { useQuery } from '@tanstack/react-query'
import { TrendingUp, DollarSign, Users, MapPin, Package, BarChart3, Activity, Target } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { insightsService } from '../../services/insights.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'

const COLORS = ['#00E87B', '#36A2EB', '#9B59B6', '#F39C12', '#E91E63', '#00BCD4']

export default function ExecutiveDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['insights-executive'],
    queryFn: insightsService.getExecutiveDashboard,
    retry: 1,
  })

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Executive Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Platform-wide performance overview</p>
        </div>
        <div className="card p-8 text-center">
          <Activity className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Insights Data Unavailable</h3>
          <p className="text-gray-600 dark:text-gray-400">Analytics data could not be loaded. Data will populate as transactions are recorded.</p>
        </div>
      </div>
    )
  }

  const stats = data || {}

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Executive Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Platform-wide performance overview</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Revenue" value={`R ${(stats.total_revenue || 0).toLocaleString()}`} icon={DollarSign} color="green" />
        <MetricCard title="Active Customers" value={stats.active_customers || 0} icon={Users} color="blue" />
        <MetricCard title="Total Orders" value={stats.total_orders || 0} icon={Package} color="purple" />
        <MetricCard title="Total Visits" value={stats.total_visits || 0} icon={MapPin} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenue_trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#00E87B" fill="#00E87B" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Orders by Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.orders_by_status || []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label>
                  {(stats.orders_by_status || []).map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Agents</h3>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Rank</th>
                <th className="table-header-cell">Agent</th>
                <th className="table-header-cell">Orders</th>
                <th className="table-header-cell">Revenue</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {(stats.top_agents || []).map((agent: any, i: number) => (
                <tr key={i} className="table-row">
                  <td className="table-cell font-mono">{i + 1}</td>
                  <td className="table-cell font-medium">{agent.agent}</td>
                  <td className="table-cell font-data">{agent.orders}</td>
                  <td className="table-cell font-data">R {(agent.revenue || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon: Icon, color }: { title: string; value: any; icon: any; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-gradient-to-br from-pulse-500 to-pulse-600',
    blue: 'bg-gradient-to-br from-blue-500 to-blue-600',
    purple: 'bg-gradient-to-br from-purple-500 to-purple-600',
    orange: 'bg-gradient-to-br from-orange-500 to-orange-600',
  }
  return (
    <div className={`rounded-2xl p-6 text-white shadow-stat relative overflow-hidden ${colors[color]}`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-sm text-white/80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className="p-2 bg-white/20 rounded-xl"><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  )
}
