import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Users, Package, DollarSign, Activity } from 'lucide-react';
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { apiClient } from '../../services/api.service'

const AnalyticsDashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMetrics(); }, []);

  const loadMetrics = async () => {
    try {
      const res = await fetch(`${apiClient.defaults.baseURL}/reports/analytics`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      if (res.ok) setMetrics(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const MetricCard: React.FC<{ title: string; value: string; change: number; icon: any }> = ({ title, value, change, icon: Icon }) => (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-blue-50 rounded-lg"><Icon className="w-6 h-6 text-blue-600" /></div>
        <div className={`flex items-center gap-1 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {Math.abs(change)}%
        </div>
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  );

  if (loading) return <div className="p-6 text-center"><LoadingSpinner size="md" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><Activity className="w-8 h-8 text-blue-600" /> Analytics Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard title="Total Revenue" value={`₹${(metrics.revenue || 0).toLocaleString()}`} change={metrics.revenueChange || 0} icon={DollarSign} />
        <MetricCard title="Active Agents" value={`${metrics.agents || 0}`} change={metrics.agentsChange || 0} icon={Users} />
        <MetricCard title="Boards Placed" value={`${metrics.boards || 0}`} change={metrics.boardsChange || 0} icon={Package} />
        <MetricCard title="Visits Completed" value={`${metrics.visits || 0}`} change={metrics.visitsChange || 0} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Top Performing Agents</h2>
          <div className="space-y-3">
            {(metrics.topAgents || []).map((agent: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-3 bg-surface-secondary rounded">
                <div>
                  <div className="font-medium">{agent.name}</div>
                  <div className="text-sm text-gray-600">{agent.visits} visits</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">₹{agent.commission?.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">commission</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {(metrics.recentActivity || []).map((activity: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-surface-secondary rounded">
                <div className="p-2 bg-blue-100 rounded"><Activity className="w-4 h-4 text-blue-600" /></div>
                <div className="flex-1">
                  <div className="font-medium">{activity.title}</div>
                  <div className="text-sm text-gray-600">{activity.description}</div>
                  <div className="text-xs text-gray-400 mt-1">{activity.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Sales Trend (Last 30 Days)</h2>
        <div className="h-64 flex items-end gap-2">
          {(metrics.salesTrend || []).map((day: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="w-full bg-blue-600 hover:bg-blue-700 transition rounded-t" style={{ height: `${(day.value / Math.max(...(metrics.salesTrend || []).map((d: any) => d.value))) * 100}%` }}></div>
              <div className="text-xs text-gray-600 mt-2">{day.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboardPage;
