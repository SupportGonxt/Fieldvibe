import { useQuery } from '@tanstack/react-query'
import { Tag, DollarSign, TrendingUp, Users } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { insightsService } from '../../services/insights.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function TradePromoInsights() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['insights-trade-promotions'],
    queryFn: insightsService.getTradePromotionsDashboard,
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trade Promotions Insights</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Active Promotions', value: d.active_promotions || 0, icon: Tag, bg: 'bg-green-500' },
          { label: 'Total Budget', value: `R ${(d.total_budget || 0).toLocaleString()}`, icon: DollarSign, bg: 'bg-blue-500' },
          { label: 'Total Spent', value: `R ${(d.total_spent || 0).toLocaleString()}`, icon: TrendingUp, bg: 'bg-purple-500' },
          { label: 'Enrollments', value: d.total_enrollments || 0, icon: Users, bg: 'bg-orange-500' },
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Budget vs Spend by Promotion</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.promotions_detail || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="budget" fill="#36A2EB" name="Budget" />
              <Bar dataKey="spent" fill="#00E87B" name="Spent" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
