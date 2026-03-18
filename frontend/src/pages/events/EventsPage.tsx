import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Calendar, Users, MapPin, DollarSign, TrendingUp, Clock, Plus, Filter } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { apiClient } from '../../services/api.service'

interface Event {
  id: string
  title: string
  description: string
  type: 'product_launch' | 'trade_show' | 'training' | 'meeting' | 'campaign'
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  start_date: string
  end_date: string
  location: string
  latitude?: number
  longitude?: number
  budget: number
  max_participants?: number
  expected_attendees: number
  actual_attendees?: number
  organizer_name: string
  participant_count: number
  resource_count: number
}

interface EventMetrics {
  total_events: number
  completed_events: number
  active_events: number
  cancelled_events: number
  total_budget: number
  avg_budget: number
  total_participants: number
  attendance_rate: number
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [metrics, setMetrics] = useState<EventMetrics>({
    total_events: 0,
    completed_events: 0,
    active_events: 0,
    cancelled_events: 0,
    total_budget: 0,
    avg_budget: 0,
    total_participants: 0,
    attendance_rate: 0
  })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    status: '',
    type: '',
    start_date: '',
    end_date: ''
  })

  useEffect(() => {
    fetchEvents()
    fetchMetrics()
  }, [filter])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()
      
      if (filter.status) queryParams.append('status', filter.status)
      if (filter.type) queryParams.append('type', filter.type)
      if (filter.start_date) queryParams.append('start_date', filter.start_date)
      if (filter.end_date) queryParams.append('end_date', filter.end_date)

      const response = await apiClient.get(`/events?${queryParams.toString()}`)
      setEvents(response.data?.events || [])
    } catch (error) {
      console.error('Error fetching events:', error)
      // Fallback to mock data for demo
      setEvents([
          {
            id: '1',
            title: 'Product Launch Event - Summer Collection',
            description: 'Launch event for our new summer product line',
            type: 'product_launch',
            status: 'active',
            start_date: '2024-01-15T09:00:00Z',
            end_date: '2024-01-15T17:00:00Z',
            location: 'Cape Town Convention Centre',
            budget: 50000,
            max_participants: 200,
            expected_attendees: 180,
            actual_attendees: 165,
            organizer_name: 'Sarah Johnson',
            participant_count: 165,
            resource_count: 8
          },
          {
            id: '2',
            title: 'Sales Team Training Workshop',
            description: 'Quarterly sales training and strategy session',
            type: 'training',
            status: 'completed',
            start_date: '2024-01-10T08:00:00Z',
            end_date: '2024-01-12T16:00:00Z',
            location: 'Johannesburg Office',
            budget: 25000,
            max_participants: 50,
            expected_attendees: 45,
            actual_attendees: 42,
            organizer_name: 'Mike Chen',
            participant_count: 42,
            resource_count: 5
          },
          {
            id: '3',
            title: 'Trade Show - Food & Beverage Expo',
            description: 'Annual food and beverage industry trade show',
            type: 'trade_show',
            status: 'planned',
            start_date: '2024-02-20T08:00:00Z',
            end_date: '2024-02-22T18:00:00Z',
            location: 'Durban ICC',
            budget: 75000,
            max_participants: 300,
            expected_attendees: 280,
            organizer_name: 'Lisa Williams',
            participant_count: 0,
            resource_count: 12
          }
        ])
    } finally {
      setLoading(false)
    }
  }

  const fetchMetrics = async () => {
    try {
      const response = await apiClient.get('/events/analytics/summary')
      const data = response.data
      setMetrics({
        total_events: data?.event_stats?.total_events || 0,
        completed_events: data?.event_stats?.completed_events || 0,
        active_events: data?.event_stats?.active_events || 0,
        cancelled_events: data?.event_stats?.cancelled_events || 0,
        total_budget: data?.event_stats?.total_budget || 0,
        avg_budget: data?.event_stats?.avg_budget || 0,
        total_participants: data?.participation_stats?.total_participants || 0,
        attendance_rate: data?.participation_stats?.attendance_rate || 0
      })
    } catch (error) {
      console.error('Error fetching metrics:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'planned': return 'text-blue-600 bg-blue-100'
      case 'completed': return 'text-gray-600 bg-gray-100'
      case 'cancelled': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'product_launch': return 'text-purple-600 bg-purple-100'
      case 'trade_show': return 'text-blue-600 bg-blue-100'
      case 'training': return 'text-green-600 bg-green-100'
      case 'meeting': return 'text-orange-600 bg-orange-100'
      case 'campaign': return 'text-indigo-600 bg-indigo-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events Management</h1>
          <p className="text-gray-600">Manage product launches, trade shows, training sessions, and campaigns</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.total_events}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Events</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.active_events}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Participants</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.total_participants}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.attendance_rate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Budget</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.total_budget)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <Calendar className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.completed_events}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Events Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participants
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{event.title}</div>
                        <div className="text-sm text-gray-500">{event.description}</div>
                        <div className="text-xs text-gray-400 mt-1">Organizer: {event.organizer_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(event.type)}`}>
                        {event.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(event.status)}`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                          {formatDate(event.start_date)}
                        </div>
                        <div className="flex items-center mt-1">
                          <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                          <span className="text-xs text-gray-500">{event.location}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {event.actual_attendees || event.participant_count} / {event.expected_attendees}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="h-2 rounded-full bg-blue-600"
                          style={{ 
                            width: `${Math.min(100, ((event.actual_attendees || event.participant_count) / event.expected_attendees) * 100)}%` 
                          }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(event.budget)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
