import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import { MapPin, CheckCircle, Clock, TrendingUp, Calendar } from 'lucide-react'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'

export default function FieldAgentDashboardPage() {
  const { data: todayVisits, isLoading, isError } = useQuery({
    queryKey: ['today-visits'],
    queryFn: () => fieldOperationsService.getVisits({ date: new Date().toISOString().split('T')[0] })
  })

  const { data: stats } = useQuery({
    queryKey: ['agent-stats'],
    queryFn: () => fieldOperationsService.getAgentStats()
  })

  const visits = todayVisits?.data || []
  const pending = visits.filter(v => v.status === 'planned')
  const inProgress = visits.filter(v => v.status === 'in_progress')
  const completed = visits.filter(v => v.status === 'completed')

  if (isLoading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/4"></div><div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded"></div>)}</div></div></div>


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
      <div><h1 className="text-2xl font-bold text-gray-900">Field Agent Dashboard</h1><p className="text-sm text-gray-600 mt-1">Today's visits and performance</p></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Visits</p><p className="text-2xl font-bold text-gray-900">{visits.length}</p></div>
            <Calendar className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Pending</p><p className="text-2xl font-bold text-yellow-600">{pending.length}</p></div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">In Progress</p><p className="text-2xl font-bold text-blue-600">{inProgress.length}</p></div>
            <MapPin className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Completed</p><p className="text-2xl font-bold text-green-600">{completed.length}</p></div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Today's Schedule</h2>
          <div className="space-y-3">
            {visits.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No visits scheduled for today</p>
            ) : (
              visits.map(visit => (
                <div key={visit.id} className="flex items-center space-x-3 p-3 border border-gray-100 rounded-lg">
                  {visit.status === 'completed' ? <CheckCircle className="h-5 w-5 text-green-500" /> : visit.status === 'in_progress' ? <MapPin className="h-5 w-5 text-blue-500" /> : <Clock className="h-5 w-5 text-gray-400" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{visit.customer_name}</p>
                    <p className="text-xs text-gray-500">{visit.visit_type} - {new Date(visit.visit_date).toLocaleTimeString()}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${visit.status === 'completed' ? 'bg-green-100 text-green-800' : visit.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{visit.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Performance Metrics</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600">Visit Completion Rate</span>
                <span className="text-sm font-bold text-gray-900">{stats?.completion_rate || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{width: `${stats?.completion_rate || 0}%`}}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600">On-Time Visits</span>
                <span className="text-sm font-bold text-gray-900">{stats?.on_time_rate || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{width: `${stats?.on_time_rate || 0}%`}}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600">Customer Satisfaction</span>
                <span className="text-sm font-bold text-gray-900">{stats?.satisfaction_rate || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{width: `${stats?.satisfaction_rate || 0}%`}}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
