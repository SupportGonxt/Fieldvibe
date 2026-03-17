import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Shield, TrendingDown, DollarSign, MapPin } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { tradeMarketingService } from '../../services/insights.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function CompetitorInsights() {
  const [period, setPeriod] = useState('month')
  const { data, isLoading } = useQuery({
    queryKey: ['competitor-insights', period],
    queryFn: () => tradeMarketingService.getCompetitorInsights({ period }),
  })

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  const d = data || {}
  const topBrands = d.top_brands || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Competitor Intelligence</h1>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="quarter">Last 90 Days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Competitor Brands', value: topBrands.length, icon: Shield, bg: 'bg-red-500' },
          { label: 'Total Sightings', value: topBrands.reduce((s: number, b: any) => s + (b.sighting_count || 0), 0), icon: TrendingDown, bg: 'bg-orange-500' },
          { label: 'Avg Price', value: `R ${(topBrands[0]?.avg_price || 0).toFixed(2)}`, icon: DollarSign, bg: 'bg-yellow-500' },
          { label: 'Locations', value: (d.geo_data || []).length, icon: MapPin, bg: 'bg-blue-500' },
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Competitor Brands</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBrands.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="competitor_brand" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sighting_count" fill="#FF6384" radius={[4, 4, 0, 0]} name="Sightings" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Competitor Pricing Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.pricing_trends || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="avg_price" stroke="#FF9F40" strokeWidth={2} name="Avg Price" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Competitor Sightings</h3>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Brand</th>
                <th className="table-header-cell">Product</th>
                <th className="table-header-cell">Customer</th>
                <th className="table-header-cell">Price</th>
                <th className="table-header-cell">Facings</th>
                <th className="table-header-cell">Date</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {(d.recent_sightings || []).map((s: any, i: number) => (
                <tr key={i} className="table-row">
                  <td className="table-cell font-medium">{s.competitor_brand}</td>
                  <td className="table-cell">{s.competitor_product || '-'}</td>
                  <td className="table-cell">{s.customer_name || '-'}</td>
                  <td className="table-cell font-data">{s.observed_price ? `R ${s.observed_price.toFixed(2)}` : '-'}</td>
                  <td className="table-cell font-data">{s.facing_count || '-'}</td>
                  <td className="table-cell text-sm text-gray-500">{s.sighting_date?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
