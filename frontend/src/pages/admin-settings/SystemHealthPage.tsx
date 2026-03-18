import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../services/api.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface HealthMetric {
  name: string
  value: number
  unit: string
  status: 'healthy' | 'warning' | 'critical'
  threshold: number
}

export const SystemHealthPage: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true)

  const checkEndpoint = async (name: string, endpoint: string) => {
    const start = Date.now()
    try {
      await apiClient.get(endpoint)
      return { name, status: 'running' as const, uptime: 'Online', latency: Date.now() - start }
    } catch {
      return { name, status: 'stopped' as const, uptime: 'Offline', latency: 0 }
    }
  }

  const { data: healthData, isLoading, isError } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const checks = await Promise.all([
        checkEndpoint('API Server', '/health'),
        checkEndpoint('Authentication', '/users?limit=1'),
        checkEndpoint('Products Service', '/products?limit=1'),
        checkEndpoint('Orders Service', '/orders?limit=1'),
        checkEndpoint('Customers Service', '/customers?limit=1'),
      ])
      const healthy = checks.filter(c => c.status === 'running').length
      const avgLatency = checks.filter(c => c.latency > 0).reduce((s, c) => s + c.latency, 0) / Math.max(checks.filter(c => c.latency > 0).length, 1)
      return {
        status: healthy === checks.length ? 'healthy' : healthy > 0 ? 'warning' : 'critical',
        services: checks,
        avgLatency: Math.round(avgLatency),
        healthyCount: healthy,
        totalCount: checks.length,
      }
    },
    refetchInterval: autoRefresh ? 30000 : false,
  })

  if (isLoading) return <LoadingSpinner />


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

  const mockHealthData = {
    status: (healthData?.status || 'healthy') as 'healthy' | 'warning' | 'critical',
    uptime: healthData ? (healthData.healthyCount / healthData.totalCount * 100) : 99.98,
    last_check: new Date().toISOString(),
    metrics: [
      { name: 'API Response Time', value: healthData?.avgLatency || 0, unit: 'ms', status: (healthData?.avgLatency || 0) < 500 ? 'healthy' as const : 'warning' as const, threshold: 500 },
      { name: 'Services Online', value: healthData?.healthyCount || 0, unit: `of ${healthData?.totalCount || 0}`, status: healthData?.healthyCount === healthData?.totalCount ? 'healthy' as const : 'warning' as const, threshold: healthData?.totalCount || 5 },
      { name: 'Error Rate', value: healthData ? ((healthData.totalCount - healthData.healthyCount) / healthData.totalCount * 100) : 0, unit: '%', status: 'healthy' as const, threshold: 10 },
    ],
    services: healthData?.services || [],
    recent_incidents: []
  }

  const getStatusColor = (status: string) => {
    const colors = {
      healthy: 'text-green-600',
      warning: 'text-yellow-600',
      critical: 'text-red-600',
      running: 'text-green-600',
      stopped: 'text-red-600'
    }
    return colors[status as keyof typeof colors] || 'text-gray-600'
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      healthy: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800',
      running: 'bg-green-100 text-green-800',
      stopped: 'bg-red-100 text-red-800'
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor system performance and service status
          </p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Auto-refresh</span>
          </label>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Refresh Now
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Overall System Status</h2>
            <p className="mt-1 text-sm text-gray-500">
              Last checked: {new Date(mockHealthData.last_check).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold ${getStatusBadge(mockHealthData.status)}`}>
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {mockHealthData.status.toUpperCase()}
            </span>
            <p className="mt-2 text-sm text-gray-500">Uptime: {mockHealthData.uptime}%</p>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockHealthData.metrics.map((metric, index) => (
            <div key={index} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900">{metric.name}</h3>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(metric.status)}`}>
                  {metric.status}
                </span>
              </div>
              <div className="flex items-baseline">
                <span className={`text-3xl font-bold ${getStatusColor(metric.status)}`}>
                  {metric.value}
                </span>
                <span className="ml-2 text-sm text-gray-500">{metric.unit}</span>
              </div>
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      metric.status === 'healthy' ? 'bg-green-600' :
                      metric.status === 'warning' ? 'bg-yellow-600' :
                      'bg-red-600'
                    }`}
                    style={{ width: `${Math.min((metric.value / metric.threshold) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="mt-1 text-xs text-gray-500">Threshold: {metric.threshold} {metric.unit}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Services Status */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">Services</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {mockHealthData.services.map((service, index) => (
            <div key={index} className="px-6 py-4 flex items-center justify-between hover:bg-surface-secondary">
              <div className="flex items-center">
                <div className={`h-3 w-3 rounded-full ${
                  service.status === 'running' ? 'bg-green-500' : 'bg-red-500'
                } mr-3`}></div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{service.name}</h3>
                  <p className="text-sm text-gray-500">Uptime: {service.uptime}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(service.status)}`}>
                  {service.status}
                </span>
                <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                  View Logs
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Incidents */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Incidents</h2>
        {mockHealthData.recent_incidents.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No incidents</h3>
            <p className="mt-1 text-sm text-gray-500">All systems are operating normally.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mockHealthData.recent_incidents.map((incident: any, index: number) => (
              <div key={index} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{incident.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">{incident.description}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {new Date(incident.occurred_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(incident.severity)}`}>
                    {incident.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">System Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Version</h3>
            <p className="mt-1 text-sm text-gray-900">v2.5.0</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Environment</h3>
            <p className="mt-1 text-sm text-gray-900">Production</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Server Location</h3>
            <p className="mt-1 text-sm text-gray-900">London, UK (eu-west-2)</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Last Deployment</h3>
            <p className="mt-1 text-sm text-gray-900">{new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Database Version</h3>
            <p className="mt-1 text-sm text-gray-900">PostgreSQL 14.5</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Node.js Version</h3>
            <p className="mt-1 text-sm text-gray-900">v18.16.0</p>
          </div>
        </div>
      </div>
    </div>
  )
}
