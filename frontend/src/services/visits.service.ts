import { ApiService } from './api.service'

export interface Visit {
  id: string
  tenant_id: string
  agent_id: string
  agent_name: string
  customer_id: string
  customer_name: string
  customer_code: string
  visit_type: 'sales' | 'service' | 'collection' | 'survey' | 'promotion' | 'relationship' | 'delivery'
  purpose: string
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  scheduled_date: string
  scheduled_time?: string
  actual_start_time?: string
  actual_end_time?: string
  duration_minutes?: number
  location: VisitLocation
  check_in_location?: VisitLocation
  check_out_location?: VisitLocation
  distance_from_customer?: number
  outcomes: VisitOutcome[]
  notes?: string
  internal_notes?: string
  photos: VisitPhoto[]
  attachments: VisitAttachment[]
  follow_up_required: boolean
  follow_up_date?: string
  follow_up_notes?: string
  rating?: number
  feedback?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface VisitLocation {
  latitude: number
  longitude: number
  address?: string
  accuracy?: number
  timestamp: string
}

export interface VisitOutcome {
  id: string
  type: 'sale' | 'order' | 'payment' | 'complaint' | 'feedback' | 'survey' | 'sample' | 'promotion' | 'other'
  description: string
  value?: number
  quantity?: number
  reference_id?: string
  reference_type?: string
  success: boolean
  notes?: string
}

export interface VisitPhoto {
  id: string
  url: string
  caption?: string
  type: 'before' | 'during' | 'after' | 'product' | 'location' | 'other'
  file_size: number
  uploaded_at: string
}

export interface VisitAttachment {
  id: string
  name: string
  type: 'document' | 'audio' | 'video' | 'other'
  url: string
  file_size: number
  uploaded_at: string
}

export interface VisitPlan {
  id: string
  tenant_id: string
  agent_id: string
  agent_name: string
  plan_date: string
  status: 'draft' | 'approved' | 'in_progress' | 'completed'
  total_visits: number
  completed_visits: number
  estimated_duration: number
  actual_duration?: number
  visits: PlannedVisit[]
  route_optimization: boolean
  optimized_route?: RoutePoint[]
  created_at: string
  updated_at: string
}

export interface PlannedVisit {
  customer_id: string
  customer_name: string
  visit_type: string
  purpose: string
  priority: string
  estimated_duration: number
  location: VisitLocation
  order_index: number
  status: 'pending' | 'completed' | 'skipped'
}

export interface RoutePoint {
  customer_id: string
  customer_name: string
  location: VisitLocation
  order_index: number
  estimated_arrival: string
  estimated_duration: number
  distance_from_previous: number
}

export interface VisitTemplate {
  id: string
  name: string
  description: string
  visit_type: string
  default_purpose: string
  default_duration: number
  required_outcomes: string[]
  optional_outcomes: string[]
  required_photos: string[]
  checklist_items: ChecklistItem[]
  is_active: boolean
  created_at: string
}

export interface ChecklistItem {
  id: string
  description: string
  required: boolean
  order_index: number
}

export interface VisitFilter {
  search?: string
  agent_id?: string
  customer_id?: string
  visit_type?: string
  status?: string
  priority?: string
  start_date?: string
  end_date?: string
  follow_up_required?: boolean
  rating?: number
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface VisitStats {
  total_visits: number
  completed_visits: number
  cancelled_visits: number
  no_show_visits: number
  completion_rate: number
  average_duration: number
  average_rating: number
  visits_by_type: TypeBreakdown[]
  visits_by_outcome: OutcomeBreakdown[]
  top_performing_agents: AgentVisitStats[]
}

export interface TypeBreakdown {
  type: string
  count: number
  percentage: number
  success_rate: number
}

export interface OutcomeBreakdown {
  outcome_type: string
  count: number
  percentage: number
  total_value: number
}

export interface AgentVisitStats {
  agent_id: string
  agent_name: string
  total_visits: number
  completed_visits: number
  completion_rate: number
  average_rating: number
  total_outcomes: number
}

class VisitsService extends ApiService {
  private baseUrl = '/visits'

  // Visit Management
  async getVisits(filter: VisitFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getVisit(id: string) {
    const response = await this.get(`${this.baseUrl}/${id}`)
    return response.data?.data || response.data
  }

  async createVisit(visit: Partial<Visit>) {
    const response = await this.post(this.baseUrl, visit)
    return response.data?.data || response.data
  }

  async updateVisit(id: string, visit: Partial<Visit>) {
    const response = await this.put(`${this.baseUrl}/${id}`, visit)
    return response.data?.data || response.data
  }

  async deleteVisit(id: string) {
    const response = await this.delete(`${this.baseUrl}/${id}`)
    return response.data?.data || response.data
  }

  async duplicateVisit(id: string, newDate?: string) {
    const response = await this.post(`${this.baseUrl}/${id}/duplicate`, { new_date: newDate })
    return response.data?.data || response.data
  }

  // Visit Execution
  async checkInVisit(visitId: string, location: VisitLocation, notes?: string) {
    const response = await this.post(`${this.baseUrl}/${visitId}/check-in`, {
      location,
      notes
    })
    return response.data?.data || response.data
  }

  async checkOutVisit(visitId: string, data: {
    location: VisitLocation
    outcomes: VisitOutcome[]
    notes?: string
    internal_notes?: string
    follow_up_required?: boolean
    follow_up_date?: string
    follow_up_notes?: string
    rating?: number
    feedback?: string
  }) {
    const response = await this.post(`${this.baseUrl}/${visitId}/check-out`, data)
    return response.data?.data || response.data
  }

  async cancelVisit(visitId: string, reason: string, notes?: string) {
    const response = await this.post(`${this.baseUrl}/${visitId}/cancel`, {
      reason,
      notes
    })
    return response.data?.data || response.data
  }

  async markNoShow(visitId: string, reason?: string) {
    const response = await this.post(`${this.baseUrl}/${visitId}/no-show`, { reason })
    return response.data?.data || response.data
  }

  async rescheduleVisit(visitId: string, newDate: string, newTime?: string, reason?: string) {
    const response = await this.post(`${this.baseUrl}/${visitId}/reschedule`, {
      new_date: newDate,
      new_time: newTime,
      reason
    })
    return response.data?.data || response.data
  }

  // Visit Media
  async uploadVisitPhoto(visitId: string, file: File, type: string, caption?: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    if (caption) formData.append('caption', caption)

    const response = await this.post(`${this.baseUrl}/${visitId}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data?.data || response.data
  }

  async deleteVisitPhoto(visitId: string, photoId: string) {
    const response = await this.delete(`${this.baseUrl}/${visitId}/photos/${photoId}`)
    return response.data?.data || response.data
  }

  async uploadVisitAttachment(visitId: string, file: File, type: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    const response = await this.post(`${this.baseUrl}/${visitId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data?.data || response.data
  }

  async deleteVisitAttachment(visitId: string, attachmentId: string) {
    const response = await this.delete(`${this.baseUrl}/${visitId}/attachments/${attachmentId}`)
    return response.data?.data || response.data
  }

  // Visit Planning
  async getVisitPlans(agentId?: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (agentId) params.append('agent_id', agentId)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await this.get(`${this.baseUrl}/plans?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getVisitPlan(id: string) {
    const response = await this.get(`${this.baseUrl}/plans/${id}`)
    return response.data?.data || response.data
  }

  async createVisitPlan(plan: Partial<VisitPlan>) {
    const response = await this.post(`${this.baseUrl}/plans`, plan)
    return response.data?.data || response.data
  }

  async updateVisitPlan(id: string, plan: Partial<VisitPlan>) {
    const response = await this.put(`${this.baseUrl}/plans/${id}`, plan)
    return response.data?.data || response.data
  }

  async deleteVisitPlan(id: string) {
    const response = await this.delete(`${this.baseUrl}/plans/${id}`)
    return response.data?.data || response.data
  }

  async optimizeVisitRoute(planId: string) {
    const response = await this.post(`${this.baseUrl}/plans/${planId}/optimize`)
    return response.data?.data || response.data
  }

  async approveVisitPlan(planId: string) {
    const response = await this.post(`${this.baseUrl}/plans/${planId}/approve`)
    return response.data?.data || response.data
  }

  async startVisitPlan(planId: string) {
    const response = await this.post(`${this.baseUrl}/plans/${planId}/start`)
    return response.data?.data || response.data
  }

  async completeVisitPlan(planId: string) {
    const response = await this.post(`${this.baseUrl}/plans/${planId}/complete`)
    return response.data?.data || response.data
  }

  // Visit Templates
  async getVisitTemplates() {
    const response = await this.get(`${this.baseUrl}/templates`)
    return response.data?.data || response.data
  }

  async getVisitTemplate(id: string) {
    const response = await this.get(`${this.baseUrl}/templates/${id}`)
    return response.data?.data || response.data
  }

  async createVisitTemplate(template: Partial<VisitTemplate>) {
    const response = await this.post(`${this.baseUrl}/templates`, template)
    return response.data?.data || response.data
  }

  async updateVisitTemplate(id: string, template: Partial<VisitTemplate>) {
    const response = await this.put(`${this.baseUrl}/templates/${id}`, template)
    return response.data?.data || response.data
  }

  async deleteVisitTemplate(id: string) {
    const response = await this.delete(`${this.baseUrl}/templates/${id}`)
    return response.data?.data || response.data
  }

  async createVisitFromTemplate(templateId: string, data: {
    customer_id: string
    agent_id: string
    scheduled_date: string
    scheduled_time?: string
    purpose?: string
  }) {
    const response = await this.post(`${this.baseUrl}/templates/${templateId}/create-visit`, data)
    return response.data?.data || response.data
  }

  // Analytics & Reporting
  async getVisitStats(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getVisitAnalytics(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/analytics?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getAgentVisitPerformance(agentId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await this.get(`${this.baseUrl}/agents/${agentId}/performance?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getCustomerVisitHistory(customerId: string, limit?: number) {
    const params = new URLSearchParams()
    if (limit) params.append('limit', String(limit))

    const response = await this.get(`${this.baseUrl}/customers/${customerId}/history?${params.toString()}`)
    return response.data?.data || response.data
  }

  // Follow-ups
  async getFollowUpVisits(agentId?: string, dueDate?: string) {
    const params = new URLSearchParams()
    if (agentId) params.append('agent_id', agentId)
    if (dueDate) params.append('due_date', dueDate)

    const response = await this.get(`${this.baseUrl}/follow-ups?${params.toString()}`)
    return response.data?.data || response.data
  }

  async createFollowUpVisit(originalVisitId: string, data: {
    scheduled_date: string
    scheduled_time?: string
    purpose: string
    notes?: string
  }) {
    const response = await this.post(`${this.baseUrl}/${originalVisitId}/follow-up`, data)
    return response.data?.data || response.data
  }

  async markFollowUpComplete(visitId: string) {
    const response = await this.post(`${this.baseUrl}/${visitId}/follow-up-complete`)
    return response.data?.data || response.data
  }

  // Bulk Operations
  async bulkUpdateVisitStatus(visitIds: string[], status: string, notes?: string) {
    const response = await this.post(`${this.baseUrl}/bulk-update-status`, {
      visit_ids: visitIds,
      status,
      notes
    })
    return response.data?.data || response.data
  }

  async bulkRescheduleVisits(visitIds: string[], newDate: string, reason?: string) {
    const response = await this.post(`${this.baseUrl}/bulk-reschedule`, {
      visit_ids: visitIds,
      new_date: newDate,
      reason
    })
    return response.data?.data || response.data
  }

  async bulkCancelVisits(visitIds: string[], reason: string, notes?: string) {
    const response = await this.post(`${this.baseUrl}/bulk-cancel`, {
      visit_ids: visitIds,
      reason,
      notes
    })
    return response.data?.data || response.data
  }

  // Export & Import
  async exportVisitReport(format: 'csv' | 'excel' | 'pdf' = 'csv', filter: VisitFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    params.append('format', format)

    const response = await this.get(`${this.baseUrl}/export?${params.toString()}`, {
      responseType: 'blob'
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `visits-report-${Date.now()}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  async importVisits(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.post(`${this.baseUrl}/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data?.data || response.data
  }
}

export const visitsService = new VisitsService()