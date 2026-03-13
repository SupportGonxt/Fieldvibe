import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, MapPin, Eye, Shield } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { insightsService } from '../../services/insights.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function AnomalyInsights() {
  const { data, isLoading } = useQuery({
    queryKey: ['insights-anomalies'],
    queryFn: insightsService.getAnomaliesDashboard,
  })
  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  const d = data || {}
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Anomaly Detection</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Anomalies', value: d.total_anomalies || 0, icon: AlertTriangle, bg: 'bg-red-500' },
          { label: 'GPS Anomalies', value: d.gps_anomalies || 0, icon: MapPin, bg: 'bg-orange-500' },
          { label: 'Ghost Visits', value: d.ghost_visits || 0, icon: Eye, bg: 'bg-purple-500' },
          { label: 'Resolved', value: d.resolved || 0, icon: Shield, bg: 'bg-green-500' },
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Anomalies by Type</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.by_type || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="anomaly_type" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#E91E63" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Anomalies</h3>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="table-header"><tr><th className="table-header-cell">Type</th><th className="table-header-cell">Agent</th><th className="table-header-cell">Severity</th><th className="table-header-cell">Status</th><th className="table-header-cell">Date</th></tr></thead>
            <tbody className="table-body">
              {(d.recent_anomalies || []).map((a: any, i: number) => (
                <tr key={i} className="table-row">
                  <td className="table-cell">{a.anomaly_type}</td>
                  <td className="table-cell">{a.agent}</td>
                  <td className="table-cell"><span className={`badge ${a.severity === 'HIGH' ? 'badge-error' : a.severity === 'MEDIUM' ? 'badge-warning' : 'badge-info'}`}>{a.severity}</span></td>
                  <td className="table-cell"><span className={`badge ${a.status === 'RESOLVED' ? 'badge-success' : 'badge-warning'}`}>{a.status}</span></td>
                  <td className="table-cell text-sm">{a.detected_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
