import { useQuery } from '@tanstack/react-query'
import { DollarSign, ShoppingCart, TrendingUp, Users } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { insightsService } from '../../services/insights.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function SalesInsights() {
  const { data, isLoading } = useQuery({
    queryKey: ['insights-sales'],
    queryFn: insightsService.getSalesDashboard,
  })

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  const d = data || {}

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Insights</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Revenue', value: `R ${(d.total_revenue || 0).toLocaleString()}`, icon: DollarSign, bg: 'bg-green-500' },
          { label: 'Total Orders', value: d.total_orders || 0, icon: ShoppingCart, bg: 'bg-blue-500' },
          { label: 'Avg Order Value', value: `R ${(d.avg_order_value || 0).toLocaleString()}`, icon: TrendingUp, bg: 'bg-purple-500' },
          { label: 'Active Customers', value: d.active_customers || 0, icon: Users, bg: 'bg-orange-500' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-2xl p-5 text-white`}>
            <div className="flex justify-between items-start">
              <div><p className="text-sm text-white/80">{s.label}</p><p className="text-2xl font-bold mt-1">{s.value}</p></div>
              <s.icon className="h-5 w-5 text-white/60" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue by Period</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.revenue_by_period || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#00E87B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Orders Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.orders_trend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#36A2EB" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Products</h3>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="table-header"><tr><th className="table-header-cell">Product</th><th className="table-header-cell">Qty Sold</th><th className="table-header-cell">Revenue</th></tr></thead>
            <tbody className="table-body">
              {(d.top_products || []).map((p: any, i: number) => (
                <tr key={i} className="table-row"><td className="table-cell">{p.product}</td><td className="table-cell font-data">{p.quantity}</td><td className="table-cell font-data">R {(p.revenue || 0).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
