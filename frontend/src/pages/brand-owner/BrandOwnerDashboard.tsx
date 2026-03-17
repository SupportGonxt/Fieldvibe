import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Store, Eye, CheckCircle, Camera } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { tradeMarketingService } from '../../services/insights.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function BrandOwnerDashboard() {
  const [brandId] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('brand_id') || ''
  })

  const { data, isLoading } = useQuery({
    queryKey: ['brand-owner-dashboard', brandId],
    queryFn: () => tradeMarketingService.getBrandOwnerDashboard({ brand_id: brandId }),
    enabled: !!brandId,
  })

  if (!brandId) return <div className="p-8 text-center text-gray-500">No brand selected. Add ?brand_id=... to URL.</div>
  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  const d = data || {}
  const kpi = d.kpi || {}

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Brand Owner Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Stores Carrying Brand', value: kpi.total_stores || 0, icon: Store, bg: 'bg-blue-500' },
          { label: 'Avg SOV %', value: `${kpi.avg_sov || 0}%`, icon: Eye, bg: 'bg-green-500' },
          { label: 'Compliance Score', value: `${kpi.compliance_score || 0}%`, icon: CheckCircle, bg: 'bg-purple-500' },
          { label: 'Photos This Month', value: kpi.photo_count || 0, icon: Camera, bg: 'bg-orange-500' },
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">SOV Trend (90 Days)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.sov_trend || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="sov" stroke="#00E87B" strokeWidth={2} name="SOV %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Store SOV Rankings</h3>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Store</th>
                <th className="table-header-cell">SOV %</th>
                <th className="table-header-cell">Measurements</th>
                <th className="table-header-cell">Status</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {(d.store_rankings || []).map((s: any, i: number) => (
                <tr key={i} className="table-row">
                  <td className="table-cell font-medium">{s.store_name}</td>
                  <td className="table-cell font-data">{s.sov}%</td>
                  <td className="table-cell font-data">{s.measurements}</td>
                  <td className="table-cell">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      s.sov >= 50 ? 'bg-green-100 text-green-700' : s.sov >= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>{s.sov >= 50 ? 'Good' : s.sov >= 30 ? 'Fair' : 'Low'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
