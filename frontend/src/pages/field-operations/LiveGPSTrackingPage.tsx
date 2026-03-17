import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import { MapPin, Navigation, Clock, Activity } from 'lucide-react'

export default function LiveGPSTrackingPage() {
  const { data: locations, isLoading, isError, refetch } = useQuery({
    queryKey: ['live-locations'],
    queryFn: () => fieldOperationsService.getLiveLocations(),
    refetchInterval: 30000
  })

  useEffect(() => {
    const interval = setInterval(() => refetch(), 30000)
    return () => clearInterval(interval)
  }, [refetch])

  const agents = locations || []
  const activeAgents = agents.filter(a => a.status === 'active')
  const idleAgents = agents.filter(a => a.status === 'idle')

  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-96 bg-gray-200 rounded"></div></div></div>


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

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Live GPS Tracking</h1><p className="text-sm text-gray-600 mt-1">Real-time agent location tracking (updates every 30s)</p></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Agents</p><p className="text-2xl font-bold text-gray-900">{agents.length}</p></div>
            <MapPin className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Active</p><p className="text-2xl font-bold text-green-600">{activeAgents.length}</p></div>
            <Activity className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Idle</p><p className="text-2xl font-bold text-yellow-600">{idleAgents.length}</p></div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900">Agent Locations</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live</span>
          </div>
        </div>
        <div className="space-y-3">
          {agents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No agents currently tracked</p>
          ) : (
            agents.map(agent => (
              <div key={agent.agent_id} className="flex items-center space-x-4 p-4 border border-gray-100 rounded-lg">
                <div className={`w-3 h-3 rounded-full ${agent.status === 'active' ? 'bg-green-500' : agent.status === 'idle' ? 'bg-yellow-500' : 'bg-gray-400'}`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{agent.agent_name}</p>
                  <p className="text-xs text-gray-500">Lat: {agent.latitude.toFixed(6)}, Lng: {agent.longitude.toFixed(6)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Accuracy: {agent.accuracy}m</p>
                  <p className="text-xs text-gray-500">{new Date(agent.timestamp).toLocaleTimeString()}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${agent.status === 'active' ? 'bg-green-100 text-green-800' : agent.status === 'idle' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{agent.status}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Navigation className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Interactive Map Integration</p>
            <p className="text-sm text-blue-700 mt-1">Agent locations are displayed in the list above. For map visualization, integrate with Google Maps or Leaflet using the coordinate data.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
