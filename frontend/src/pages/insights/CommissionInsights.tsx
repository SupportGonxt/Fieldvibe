import { useQuery } from '@tanstack/react-query'
import { DollarSign, Clock, CheckCircle, Users } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { insightsService } from '../../services/insights.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function CommissionInsights() {
  const { data, isLoading } = useQuery({
    queryKey: ['insights-commissions'],
    queryFn: insightsService.getCommissionsDashboard,
  })
  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  const d = data || {}
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commission Insights</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Earned', value: `R ${(d.total_earned || 0).toLocaleString()}`, icon: DollarSign, bg: 'bg-green-500' },
          { label: 'Pending', value: `R ${(d.pending_amount || 0).toLocaleString()}`, icon: Clock, bg: 'bg-yellow-500' },
          { label: 'Approved', value: `R ${(d.approved_amount || 0).toLocaleString()}`, icon: CheckCircle, bg: 'bg-blue-500' },
          { label: 'Active Earners', value: d.active_earners || 0, icon: Users, bg: 'bg-purple-500' },
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Commissions by Earner</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.by_earner || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="earner" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#00E87B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
