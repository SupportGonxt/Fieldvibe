import { useQuery } from '@tanstack/react-query'
import { Package, AlertTriangle, DollarSign, ArrowUpDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { insightsService } from '../../services/insights.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function StockInsights() {
  const { data, isLoading } = useQuery({
    queryKey: ['insights-stock'],
    queryFn: insightsService.getStockDashboard,
  })
  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  const d = data || {}
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Insights</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Products', value: d.total_products || 0, icon: Package, bg: 'bg-blue-500' },
          { label: 'Total Stock', value: d.total_stock || 0, icon: ArrowUpDown, bg: 'bg-green-500' },
          { label: 'Low Stock Items', value: d.low_stock_items || 0, icon: AlertTriangle, bg: 'bg-red-500' },
          { label: 'Stock Value', value: `R ${(d.stock_value || 0).toLocaleString()}`, icon: DollarSign, bg: 'bg-purple-500' },
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Stock by Warehouse</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.stock_by_warehouse || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="warehouse" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="quantity" fill="#00E87B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
