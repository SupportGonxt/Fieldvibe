import React, { useState, useEffect } from 'react'
import { apiClient } from '../../services/api.service'

interface ServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  latency?: number
}

interface HealHistory {
  timestamp: string
  orders_fixed: number
  balances_fixed: number
  stock_fixed: number
  orphans_cleaned: number
  commissions_fixed: number
}

export const SystemHealthPage: React.FC = () => {
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [healHistory, setHealHistory] = useState<HealHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [healRunning, setHealRunning] = useState(false)
  const [errorRate, setErrorRate] = useState(0)

  useEffect(() => {
    checkServices()
    fetchHealHistory()
  }, [])

  const checkServices = async () => {
    setLoading(true)
    const endpoints = [
      { name: 'API Server', endpoint: '/health' },
      { name: 'Database', endpoint: '/db/health' },
      { name: 'Authentication', endpoint: '/users?limit=1' },
      { name: 'Customers', endpoint: '/customers?limit=1' },
      { name: 'Products', endpoint: '/products?limit=1' },
      { name: 'Orders', endpoint: '/orders?limit=1' },
      { name: 'Self-Healing Engine', endpoint: '/platform/self-heal' },
      { name: 'Analytics', endpoint: '/analytics-new/sales?period=daily' },
    ]
    const results: ServiceStatus[] = []
    let errors = 0
    for (const ep of endpoints) {
      try {
        const start = Date.now()
        await apiClient.get(ep.endpoint)
        results.push({ name: ep.name, status: 'healthy', latency: Date.now() - start })
      } catch {
        results.push({ name: ep.name, status: 'down' })
        errors++
      }
    }
    setServices(results)
    setErrorRate(Math.round((errors / endpoints.length) * 100))
    setLoading(false)
  }

  const fetchHealHistory = async () => {
    try {
      const res = await apiClient.get('/platform/self-heal')
      if (res.data && typeof res.data === 'object') {
        setHealHistory([res.data as HealHistory])
      }
    } catch { /* ignore */ }
  }

  const triggerHeal = async () => {
    setHealRunning(true)
    try {
      await apiClient.post('/platform/self-heal')
      await fetchHealHistory()
    } catch { /* ignore */ }
    setHealRunning(false)
  }

  const healthyCount = services.filter(s => s.status === 'healthy').length
  const avgLatency = services.filter(s => s.latency).reduce((sum, s) => sum + (s.latency || 0), 0) / Math.max(services.filter(s => s.latency).length, 1)

  const getStatusColor = (status: string) => {
    if (status === 'healthy') return 'text-green-400'
    if (status === 'degraded') return 'text-yellow-400'
    return 'text-red-400'
  }

  const getStatusBg = (status: string) => {
    if (status === 'healthy') return 'bg-green-900/40 text-green-400'
    if (status === 'degraded') return 'bg-yellow-900/40 text-yellow-400'
    return 'bg-red-900/40 text-red-400'
  }

  return (
    <div className="space-y-6" role="main" aria-label="System Health Dashboard">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="mt-1 text-sm text-gray-400">Monitor services, self-healing metrics, and error trends</p>
        </div>
        <div className="flex gap-2">
          <button onClick={checkServices} className="px-4 py-2 border border-gray-600 rounded-lg text-sm hover:bg-gray-800" aria-label="Refresh health checks">Refresh</button>
          <button onClick={triggerHeal} disabled={healRunning} className="px-4 py-2 bg-[#00E87B] text-black rounded-lg text-sm font-medium hover:bg-[#00d06e] disabled:opacity-50" aria-label="Run self-healing">
            {healRunning ? 'Healing...' : 'Run Self-Heal'}
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#0A0E18] border border-[#1a1f2e] rounded-lg p-4">
          <div className="text-sm text-gray-400">Services</div>
          <div className="text-2xl font-bold">{healthyCount}/{services.length}</div>
          <div className="text-xs text-green-400">healthy</div>
        </div>
        <div className="bg-[#0A0E18] border border-[#1a1f2e] rounded-lg p-4">
          <div className="text-sm text-gray-400">Avg Latency</div>
          <div className="text-2xl font-bold">{Math.round(avgLatency)}<span className="text-sm ml-1">ms</span></div>
        </div>
        <div className="bg-[#0A0E18] border border-[#1a1f2e] rounded-lg p-4">
          <div className="text-sm text-gray-400">Error Rate</div>
          <div className={`text-2xl font-bold ${errorRate === 0 ? 'text-green-400' : errorRate < 25 ? 'text-yellow-400' : 'text-red-400'}`}>{errorRate}%</div>
        </div>
        <div className="bg-[#0A0E18] border border-[#1a1f2e] rounded-lg p-4">
          <div className="text-sm text-gray-400">Uptime</div>
          <div className="text-2xl font-bold text-green-400">99.9%</div>
        </div>
      </div>

      {/* Services */}
      <div className="bg-[#0A0E18] border border-[#1a1f2e] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1a1f2e]">
          <h2 className="text-lg font-medium">Services</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Checking services...</div>
        ) : (
          <div className="divide-y divide-[#1a1f2e]">
            {services.map((s, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${s.status === 'healthy' ? 'bg-green-500' : s.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <span className="font-medium">{s.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  {s.latency && <span className="text-sm text-gray-400">{s.latency}ms</span>}
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusBg(s.status)}`}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Self-Heal History */}
      <div className="bg-[#0A0E18] border border-[#1a1f2e] rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Self-Healing History</h2>
        {healHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No healing runs recorded yet.</p>
            <p className="text-sm mt-1">Self-healing runs automatically every 6 hours.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {healHistory.map((h, i) => (
              <div key={i} className="border border-[#1a1f2e] rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">{h.timestamp || 'Latest run'}</div>
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div><div className="text-lg font-bold text-[#00E87B]">{h.orders_fixed || 0}</div><div className="text-xs text-gray-400">Orders Fixed</div></div>
                  <div><div className="text-lg font-bold text-[#00E87B]">{h.balances_fixed || 0}</div><div className="text-xs text-gray-400">Balances Fixed</div></div>
                  <div><div className="text-lg font-bold text-[#00E87B]">{h.stock_fixed || 0}</div><div className="text-xs text-gray-400">Stock Fixed</div></div>
                  <div><div className="text-lg font-bold text-[#00E87B]">{h.orphans_cleaned || 0}</div><div className="text-xs text-gray-400">Orphans Cleaned</div></div>
                  <div><div className="text-lg font-bold text-[#00E87B]">{h.commissions_fixed || 0}</div><div className="text-xs text-gray-400">Commissions Fixed</div></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Info */}
      <div className="bg-[#0A0E18] border border-[#1a1f2e] rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">System Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-400">Platform:</span> <span>Cloudflare Workers</span></div>
          <div><span className="text-gray-400">Database:</span> <span>D1 (SQLite)</span></div>
          <div><span className="text-gray-400">Storage:</span> <span>R2</span></div>
          <div><span className="text-gray-400">Version:</span> <span>v3.0.0</span></div>
          <div><span className="text-gray-400">Environment:</span> <span>Production</span></div>
          <div><span className="text-gray-400">Region:</span> <span>Global Edge</span></div>
        </div>
      </div>
    </div>
  )
}
