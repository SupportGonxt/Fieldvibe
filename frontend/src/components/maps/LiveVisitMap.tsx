import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Visit {
  id: string
  customer_name: string
  agent_name: string
  status: string
  lat?: number
  lng?: number
  visit_date: string
}

interface LiveVisitMapProps {
  visits: Visit[]
  center?: [number, number]
  zoom?: number
}

delete (Icon.Default.prototype as any)._getIconUrl
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const getMarkerIcon = (status: string) => {
  const colors: Record<string, string> = {
    planned: '#3B82F6',
    in_progress: '#F59E0B',
    completed: '#10B981',
    cancelled: '#EF4444'
  }
  
  const color = colors[status] || '#6B7280'
  
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    `)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  })
}

function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap()
  
  useEffect(() => {
    map.setView(center, zoom)
  }, [center, zoom, map])
  
  return null
}

export default function LiveVisitMap({ visits, center, zoom = 13 }: LiveVisitMapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>(center || [-26.2041, 28.0473]) // Default to Johannesburg
  const [mapZoom, setMapZoom] = useState(zoom)

  useEffect(() => {
    if (!center && visits.length > 0) {
      const visitsWithLocation = visits.filter(v => v.lat && v.lng)
      if (visitsWithLocation.length > 0) {
        const avgLat = visitsWithLocation.reduce((sum, v) => sum + (v.lat || 0), 0) / visitsWithLocation.length
        const avgLng = visitsWithLocation.reduce((sum, v) => sum + (v.lng || 0), 0) / visitsWithLocation.length
        setMapCenter([avgLat, avgLng])
        setMapZoom(12)
      }
    }
  }, [visits, center])

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      planned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return classes[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-gray-100 dark:border-night-100">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <MapUpdater center={mapCenter} zoom={mapZoom} />
        
        {/* Dark CartoDB tile layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {visits.filter(v => v.lat && v.lng).map(visit => (
          <Marker
            key={visit.id}
            position={[visit.lat!, visit.lng!]}
            icon={getMarkerIcon(visit.status)}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h3 className="font-semibold text-gray-900 mb-2">{visit.customer_name}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Agent:</span>
                    <span className="text-gray-900">{visit.agent_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="text-gray-900">{new Date(visit.visit_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Status:</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(visit.status)}`}>
                      {visit.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
