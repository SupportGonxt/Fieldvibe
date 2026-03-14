import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiClient } from '../../services/api.service'
import { useGeolocation } from '../../hooks/useGeolocation'

interface NearbyCustomer {
  id: string
  name: string
  address: string
  distance_km: number
}

export default function QuickVisitPage() {
  const navigate = useNavigate()
  const { position } = useGeolocation()
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)
  const [purpose, setPurpose] = useState('sales_call')
  const [step, setStep] = useState(1)

  const { data: nearbyData, isLoading: loadingNearby } = useQuery({
    queryKey: ['nearby-customers', position?.latitude, position?.longitude],
    queryFn: async () => {
      if (!position?.latitude || !position?.longitude) return { customers: [] }
      const res = await apiClient.get(`/api/visits/nearby-customers?lat=${position.latitude}&lng=${position.longitude}&radius=5`)
      return res.data
    },
    enabled: !!position?.latitude && !!position?.longitude,
    staleTime: 60000,
  })

  const startVisitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/visits/quick-start', {
        customer_id: selectedCustomer,
        purpose,
        latitude: position?.latitude,
        longitude: position?.longitude,
      })
      return res.data
    },
    onSuccess: () => {
      navigate('/field-operations/visits')
    },
  })

  const nearby: NearbyCustomer[] = nearbyData?.customers || []
  const purposes = [
    { value: 'sales_call', label: 'Sales Call' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'collection', label: 'Collection' },
    { value: 'merchandising', label: 'Merchandising' },
    { value: 'survey', label: 'Survey' },
    { value: 'complaint', label: 'Complaint' },
  ]

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-1">Quick Visit</h1>
      <p className="text-sm text-gray-400 mb-4">Start a visit in under 30 seconds</p>

      <div className="flex items-center gap-2 mb-6" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}>
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              s === step ? 'bg-[#00E87B] text-black' : s < step ? 'bg-green-800 text-green-200' : 'bg-gray-700 text-gray-400'
            }`}>
              {s < step ? '\u2713' : s}
            </div>
            {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-green-600' : 'bg-gray-700'}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 className="font-semibold mb-3">Select Customer</h2>
          {loadingNearby ? (
            <div className="text-center py-8 text-gray-400">Finding nearby customers...</div>
          ) : nearby.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No nearby customers found. Check your location settings.</div>
          ) : (
            <div className="space-y-2">
              {nearby.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c.id); setStep(2) }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedCustomer === c.id ? 'border-[#00E87B] bg-[#00E87B]/10' : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                  }`}
                  aria-label={`Select ${c.name}`}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-400">{c.address} - {c.distance_km?.toFixed(1)}km away</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="font-semibold mb-3">Visit Purpose</h2>
          <div className="grid grid-cols-2 gap-2">
            {purposes.map(p => (
              <button
                key={p.value}
                onClick={() => { setPurpose(p.value); setStep(3) }}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  purpose === p.value ? 'border-[#00E87B] bg-[#00E87B]/10' : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                }`}
                aria-label={`Purpose: ${p.label}`}
              >
                <div className="text-sm">{p.label}</div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="mt-3 text-sm text-gray-400 hover:text-white">Back</button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="font-semibold mb-3">Confirm & Start</h2>
          <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
            <div className="text-sm text-gray-400">Customer</div>
            <div className="font-medium">{nearby.find(c => c.id === selectedCustomer)?.name || 'Selected'}</div>
            <div className="text-sm text-gray-400 mt-2">Purpose</div>
            <div className="font-medium">{purposes.find(p => p.value === purpose)?.label}</div>
            {position?.latitude && position?.longitude && (
              <>
                <div className="text-sm text-gray-400 mt-2">Location</div>
                <div className="font-medium text-xs">{position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}</div>
              </>
            )}
          </div>
          <button
            onClick={() => startVisitMutation.mutate()}
            disabled={startVisitMutation.isPending}
            className="w-full py-3 bg-[#00E87B] text-black font-bold rounded-lg hover:bg-[#00cc6a] disabled:opacity-50 min-h-[44px]"
            aria-label="Start visit now"
          >
            {startVisitMutation.isPending ? 'Starting...' : 'Start Visit Now'}
          </button>
          {startVisitMutation.isError && (
            <p className="text-red-400 text-sm mt-2">Failed to start visit. Please try again.</p>
          )}
          <button onClick={() => setStep(2)} className="mt-3 text-sm text-gray-400 hover:text-white block mx-auto">Back</button>
        </div>
      )}
    </div>
  )
}
