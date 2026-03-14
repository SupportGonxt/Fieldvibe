import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiClient } from '../../services/api.service'
import { useGeolocation } from '../../hooks/useGeolocation'

interface RouteStop {
  customer_id: string
  customer_name: string
  address: string
  lat: number
  lng: number
  priority: string
  estimated_duration_min: number
}

export default function PlanMyDayPage() {
  const { position } = useGeolocation()
  const [optimizedRoute, setOptimizedRoute] = useState<RouteStop[]>([])

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/route-plans/suggest', {
        agent_lat: position?.latitude,
        agent_lng: position?.longitude,
        max_visits: 12,
      })
      return res.data
    },
    onSuccess: (data) => {
      setOptimizedRoute(data.stops || [])
    },
  })

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Plan My Day</h1>
          <p className="text-sm text-gray-400">AI-suggested route for maximum efficiency</p>
        </div>
        <button
          onClick={() => suggestMutation.mutate()}
          disabled={suggestMutation.isPending || !position?.latitude}
          className="px-4 py-2 bg-[#00E87B] text-black font-semibold rounded-lg hover:bg-[#00cc6a] disabled:opacity-50 min-h-[44px]"
          aria-label="Generate optimized route"
        >
          {suggestMutation.isPending ? 'Planning...' : 'Generate Route'}
        </button>
      </div>

      {!position?.latitude && (
        <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-3 mb-4 text-sm text-yellow-200" role="alert">
          Enable location services to get route suggestions based on your current position.
        </div>
      )}

      {suggestMutation.isError && (
        <div className="bg-red-900/50 border border-red-600 rounded-lg p-3 mb-4 text-sm text-red-200" role="alert">
          Failed to generate route. Please try again.
        </div>
      )}

      {optimizedRoute.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm text-gray-400 mb-2">
            {optimizedRoute.length} stops - Est. {optimizedRoute.reduce((a, s) => a + s.estimated_duration_min, 0)} minutes total
          </div>
          {optimizedRoute.map((stop, idx) => (
            <div key={stop.customer_id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#00E87B] text-black flex items-center justify-center font-bold text-sm flex-shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{stop.customer_name}</div>
                <div className="text-xs text-gray-400">{stop.address}</div>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>Priority: {stop.priority}</span>
                  <span>Est: {stop.estimated_duration_min}min</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No route planned yet</p>
          <p className="text-sm">Click "Generate Route" to get AI-optimized visit suggestions</p>
        </div>
      )}
    </div>
  )
}
