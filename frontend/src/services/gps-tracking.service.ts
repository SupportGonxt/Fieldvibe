import { ApiService, buildUrl } from './api.service'

export interface GPSLocation {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  heading?: number
  speed?: number
  timestamp?: string
}

export interface AgentLocation {
  id: string
  agent_id: string
  location: GPSLocation
  activity_type: 'traveling' | 'at_customer' | 'break' | 'offline'
  customer_id?: string
  recorded_at: string
}

export interface CustomerProximity {
  customer_id: string
  customer_name: string
  distance_meters: number
  within_radius: boolean
  last_visit_date?: string
}

export interface ProximityValidation {
  within_radius: boolean
  distance_meters: number
  required_radius: number
  customer: {
    id: string
    name: string
    address: string
    location: GPSLocation
  }
  agent_location: GPSLocation
  validation_timestamp: string
}

export interface AgentTrack {
  track: AgentLocation[]
  total_distance_meters: number
  total_points: number
  date_range: {
    from: string | null
    to: string | null
  }
}

export interface LiveAgent {
  id: string
  current_latitude: number
  current_longitude: number
  last_location_update: string
  current_activity: string
  agent_name: string
  agent_phone: string
  agent_email: string
  current_customer?: string
}

export interface GPSTrackingDashboard {
  trackingStats: {
    total_agents: number
    active_agents: number
    agents_at_customers: number
    agents_traveling: number
  }
  locationStats: {
    total_updates_today: number
    agents_updated_today: number
    avg_accuracy: number
  }
  activityBreakdown: Array<{
    current_activity: string
    count: number
  }>
  recentUpdates: Array<{
    recorded_at: string
    activity_type: string
    latitude: number
    longitude: number
    agent_name: string
    customer_name?: string
  }>
}

class GPSTrackingService extends ApiService {
  private readonly baseUrl = '/gps-tracking'

  // Update agent's current location
  async updateLocation(data: {
    agent_id: string
    location: GPSLocation
    activity_type?: string
    customer_id?: string
  }) {
    const response = await this.post(`${this.baseUrl}/location`, data)
    return response.data?.data || response.data
  }

  // Get agent's current location
  async getAgentLocation(agentId: string) {
    const response = await this.get<{ data: { location: any } }>(`${this.baseUrl}/agents/${agentId}/location`)
    return response.data.data.location
  }

  // Get customers near agent's current location
  async getNearbyCustomers(agentId: string, params?: {
    radius?: number
    limit?: number
  }) {
    const url = buildUrl(`${this.baseUrl}/agents/${agentId}/nearby-customers`, params)
    const response = await this.get<{ data: { nearby_customers: CustomerProximity[], agent_location: GPSLocation, search_radius: number } }>(url)
    return response.data.data
  }

  // Validate if agent is within required proximity of customer
  async validateProximity(data: {
    agent_id: string
    customer_id: string
    agent_location: GPSLocation
    required_radius?: number
  }) {
    const response = await this.post<{ data: ProximityValidation }>(`${this.baseUrl}/validate-proximity`, data)
    return response.data.data
  }

  // Get agent's location history/track
  async getAgentTrack(agentId: string, params?: {
    date_from?: string
    date_to?: string
    limit?: number
  }) {
    const url = buildUrl(`${this.baseUrl}/agents/${agentId}/track`, params)
    const response = await this.get<{ data: AgentTrack }>(url)
    return response.data.data
  }

  // Get all agents' current locations
  async getLiveAgents(params?: {
    active_only?: boolean
    activity_type?: string
  }) {
    const url = buildUrl(`${this.baseUrl}/live-agents`, params)
    const response = await this.get<{ data: { agents: LiveAgent[], total_agents: number, last_updated: string } }>(url)
    return response.data.data
  }

  // Get GPS tracking dashboard data
  async getDashboard() {
    const response = await this.get<{ data: GPSTrackingDashboard }>(`${this.baseUrl}/dashboard`)
    return response.data.data
  }

  // Utility functions for GPS calculations
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000 // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  static isWithinRadius(location1: GPSLocation, location2: GPSLocation, radiusMeters: number): boolean {
    const distance = this.calculateDistance(location1.latitude, location1.longitude, location2.latitude, location2.longitude)
    return distance <= radiusMeters
  }

  // Get current position using browser geolocation API
  static getCurrentPosition(options?: PositionOptions): Promise<GPSLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: new Date(position.timestamp).toISOString()
          })
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`))
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
          ...options
        }
      )
    })
  }

  // Watch position changes
  static watchPosition(
    callback: (location: GPSLocation) => void,
    errorCallback?: (error: Error) => void,
    options?: PositionOptions
  ): number {
    if (!navigator.geolocation) {
      if (errorCallback) {
        errorCallback(new Error('Geolocation is not supported by this browser'))
      }
      return -1
    }

    return navigator.geolocation.watchPosition(
      (position) => {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          timestamp: new Date(position.timestamp).toISOString()
        })
      },
      (error) => {
        if (errorCallback) {
          errorCallback(new Error(`Geolocation error: ${error.message}`))
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
        ...options
      }
    )
  }

  // Stop watching position
  static clearWatch(watchId: number): void {
    if (navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId)
    }
  }
}

export const gpsTrackingService = new GPSTrackingService()
export default gpsTrackingService