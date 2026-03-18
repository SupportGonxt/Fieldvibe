import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { vanSalesService } from '../../services/van-sales.service'
import { MapPin, Clock, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'

export default function VanRouteDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { data: route, isLoading, isError, error } = useQuery({
    queryKey: ['van-route', id],
    queryFn: () => vanSalesService.getRouteById(id!)
  })

  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="h-64 bg-gray-200 rounded"></div></div></div>
  if (error || !route) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-800">Failed to load route details.</p></div></div>


  const getStatusBadge = (status: string) => {
    const colors = {
      planned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>{status.replace('_', ' ').toUpperCase()}</span>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => window.history.back()} className="text-gray-600 hover:text-gray-900"><ArrowLeft className="h-6 w-6" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{route.route_name}</h1>
          <p className="text-sm text-gray-600 mt-1">{route.start_location} → {route.end_location}</p>
        </div>
        {getStatusBadge(route.status)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Van ID</p>
          <p className="text-lg font-bold text-gray-900">#{route.van_id?.substring(0, 8)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Driver ID</p>
          <p className="text-lg font-bold text-gray-900">#{route.driver_id?.substring(0, 8)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Route Date</p>
          <p className="text-lg font-bold text-gray-900">{new Date(route.route_date).toLocaleDateString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Progress</p>
          <p className="text-lg font-bold text-gray-900">{route.completed_stops}/{route.planned_stops} stops</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{width: `${(route.completed_stops/route.planned_stops)*100}%`}}></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Route Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Start Location</p>
            <p className="text-base font-medium text-gray-900">{route.start_location}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">End Location</p>
            <p className="text-base font-medium text-gray-900">{route.end_location}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Planned Stops</p>
            <p className="text-base font-medium text-gray-900">{route.planned_stops}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Completed Stops</p>
            <p className="text-base font-medium text-gray-900">{route.completed_stops}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Created At</p>
            <p className="text-base font-medium text-gray-900">{new Date(route.created_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-base font-medium text-gray-900">{route.status}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Route Stops</h2>
        <div className="space-y-3">
          {Array.from({ length: route.planned_stops }).map((_, idx) => (
            <div key={idx} className="flex items-center space-x-3 p-3 border border-gray-100 rounded-lg">
              {idx < route.completed_stops ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Clock className="h-5 w-5 text-gray-400" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Stop {idx + 1}</p>
                <p className="text-xs text-gray-500">{idx < route.completed_stops ? 'Completed' : 'Pending'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
