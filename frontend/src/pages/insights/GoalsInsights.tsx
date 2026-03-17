import { useQuery } from '@tanstack/react-query'
import { Target, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { insightsService } from '../../services/insights.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function GoalsInsights() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['insights-goals'],
    queryFn: insightsService.getGoalsDashboard,
  })
  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  const d = data || {}

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Goals & Targets</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Active Goals', value: d.active_goals || 0, icon: Target, bg: 'bg-blue-500' },
          { label: 'On Track', value: d.on_track || 0, icon: TrendingUp, bg: 'bg-green-500' },
          { label: 'Achieved', value: d.achieved || 0, icon: CheckCircle, bg: 'bg-purple-500' },
          { label: 'At Risk', value: d.at_risk || 0, icon: AlertTriangle, bg: 'bg-red-500' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-2xl p-5 text-white`}>
            <div className="flex justify-between items-start">
              <div><p className="text-sm text-white/80">{s.label}</p><p className="text-2xl font-bold mt-1">{s.value}</p></div>
              <s.icon className="h-5 w-5 text-white/60" />
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Goal Progress</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.goal_progress || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="target" fill="#36A2EB" name="Target" />
              <Bar dataKey="actual" fill="#00E87B" name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
