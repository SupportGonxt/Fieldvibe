import { useState, useEffect } from 'react'
import { MapPin, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import MobileCard from './MobileCard'
import MobileButton from './MobileButton'

interface GPSCaptureProps {
  onLocationCaptured: (latitude: number, longitude: number) => void
  targetLatitude?: number
  targetLongitude?: number
  radiusMeters?: number
  showValidation?: boolean
}

export default function GPSCapture({
  onLocationCaptured,
  targetLatitude,
  targetLongitude,
  radiusMeters = 10,
  showValidation = false,
}: GPSCaptureProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [isValid, setIsValid] = useState(false)

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  const captureLocation = () => {
    setLoading(true)
    setError(null)

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        
        setLocation({ lat, lng })
        
        if (showValidation && targetLatitude !== undefined && targetLongitude !== undefined) {
          const dist = calculateDistance(lat, lng, targetLatitude, targetLongitude)
          setDistance(dist)
          
          if (dist <= radiusMeters) {
            setIsValid(true)
            onLocationCaptured(lat, lng)
          } else {
            setIsValid(false)
            setError(`You are ${Math.round(dist)}m away from the customer location. Please move within ${radiusMeters}m.`)
          }
        } else {
          onLocationCaptured(lat, lng)
        }
        
        setLoading(false)
      },
      (err) => {
        setError(`Unable to get location: ${err.message}`)
        setLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  return (
    <MobileCard>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-info-100 rounded-full">
            <MapPin className="h-6 w-6 text-info-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">GPS Location</h3>
            <p className="text-sm text-gray-600">
              {showValidation 
                ? `Must be within ${radiusMeters}m of customer`
                : 'Capture your current location'}
            </p>
          </div>
        </div>

        {location && (
          <div className="bg-surface-secondary rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Latitude:</span>
              <span className="font-mono text-gray-900">{location.lat.toFixed(6)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Longitude:</span>
              <span className="font-mono text-gray-900">{location.lng.toFixed(6)}</span>
            </div>
            {distance !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Distance:</span>
                <span className={`font-semibold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.round(distance)}m
                </span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {isValid && (
          <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">
              Location verified! You are within the required radius.
            </p>
          </div>
        )}

        <MobileButton
          onClick={captureLocation}
          loading={loading}
          fullWidth
          icon={<MapPin className="h-5 w-5" />}
        >
          {location ? 'Refresh Location' : 'Capture Location'}
        </MobileButton>
      </div>
    </MobileCard>
  )
}
