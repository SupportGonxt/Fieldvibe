import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Eye, TrendingUp, BarChart3, Store } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { tradeMarketingService } from '../../services/insights.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SearchableSelect from '../../components/ui/SearchableSelect'

const COLORS = ['#00E87B', '#36A2EB', '#FFCE56', '#FF6384', '#9966FF', '#FF9F40', '#4BC0C0']

export default function ShareOfVoiceInsights() {
  const [period, setPeriod] = useState('month')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sov-insights', period],
    queryFn: () => tradeMarketingService.getShareOfVoice({ period }),
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

  const summary = d.summary || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Share of Voice</h1>
        <SearchableSelect
          options={[
            { value: 'week', label: 'Last 7 Days' },
            { value: 'month', label: 'Last 30 Days' },
            { value: 'quarter', label: 'Last 90 Days' },
          ]}
          value={period}
          placeholder="Last 7 Days"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Average SOV', value: `${summary.avg_sov || 0}%`, icon: Eye, bg: 'bg-green-500' },
          { label: 'Measurements', value: summary.measurements || 0, icon: BarChart3, bg: 'bg-blue-500' },
          { label: 'Best SOV', value: `${summary.max_sov || 0}%`, icon: TrendingUp, bg: 'bg-purple-500' },
          { label: 'Lowest SOV', value: `${summary.min_sov || 0}%`, icon: Store, bg: 'bg-orange-500' },
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">SOV Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.trend || []}>
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Brand Share Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.by_brand || []} dataKey="total_facings" nameKey="brand_name" cx="50%" cy="50%" outerRadius={80} label>
                  {(d.by_brand || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">SOV by Customer</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={(d.by_customer || []).slice(0, 15)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis dataKey="customer" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="sov" fill="#36A2EB" radius={[0, 4, 4, 0]} name="SOV %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bottom 10 Customers (Improvement Targets)</h3>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="table-header"><tr><th className="table-header-cell">Customer</th><th className="table-header-cell">SOV %</th><th className="table-header-cell">Visits</th></tr></thead>
            <tbody className="table-body">
              {(d.by_customer || []).slice(-10).reverse().map((c: any, i: number) => (
                <tr key={i} className="table-row">
                  <td className="table-cell">{c.customer}</td>
                  <td className="table-cell font-data"><span className={`px-2 py-1 rounded text-sm ${c.sov < 30 ? 'bg-red-100 text-red-700' : c.sov < 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{c.sov}%</span></td>
                  <td className="table-cell font-data">{c.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
