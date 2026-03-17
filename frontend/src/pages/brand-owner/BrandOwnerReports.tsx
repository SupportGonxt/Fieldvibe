import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { tradeMarketingService } from '../../services/insights.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function BrandOwnerReports() {
  const [brandId] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('brand_id') || ''
  })

  const { data, isLoading } = useQuery({
    queryKey: ['brand-owner-reports', brandId],
    queryFn: () => tradeMarketingService.getBrandOwnerReports({ brand_id: brandId }),
    enabled: !!brandId,
  })

  if (!brandId) return <div className="p-8 text-center text-gray-500">No brand selected. Add ?brand_id=... to URL.</div>
  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  const d = data || {}

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Brand Owner Reports</h1>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Weekly Performance</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.weekly_performance || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avg_sov" fill="#00E87B" radius={[4, 4, 0, 0]} name="Avg SOV %" />
              <Bar dataKey="stores_visited" fill="#36A2EB" radius={[4, 4, 0, 0]} name="Stores Visited" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Compliance Scorecard</h3>
          <div className="space-y-3">
            {(d.compliance_scorecard || []).map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                <span className="text-sm font-medium text-gray-700">{c.status === 'meeting_target' ? 'Meeting Target' : 'Below Target'}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  c.status === 'meeting_target' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>{c.store_count} stores</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Competitor Intelligence</h3>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Brand</th>
                  <th className="table-header-cell">Avg SOV</th>
                  <th className="table-header-cell">Facings</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {(d.competitors || []).map((c: any, i: number) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell font-medium">{c.brand_name}</td>
                    <td className="table-cell font-data">{c.avg_sov}%</td>
                    <td className="table-cell font-data">{c.competitor_facings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
