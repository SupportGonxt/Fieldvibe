import { ApiService } from './api.service'

export interface FieldAgent {
  id: string
  tenant_id: string
  user_id: string
  employee_code: string
  first_name: string
  last_name: string
  email: string
  phone: string
  status: 'active' | 'inactive' | 'on_leave' | 'terminated'
  role: 'field_agent' | 'supervisor' | 'team_lead'
  team_id?: string
  team_name?: string
  supervisor_id?: string
  supervisor_name?: string
  hire_date: string
  territory: Territory
  performance_metrics: AgentPerformanceMetrics
  current_location?: Location
  last_activity: string
  created_at: string
}

export interface Territory {
  id: string
  name: string
  code: string
  boundaries: GeoBoundary[]
  customers: number
  potential_customers: number
  area_size: number
}

export interface GeoBoundary {
  latitude: number
  longitude: number
}

export interface Location {
  latitude: number
  longitude: number
  address?: string
  timestamp: string
}

export interface AgentPerformanceMetrics {
  total_visits: number
  successful_visits: number
  visit_success_rate: number
  total_sales: number
  total_revenue: number
  average_order_value: number
  customer_acquisition: number
  customer_retention_rate: number
  productivity_score: number
  last_updated: string
}

export interface FieldTask {
  id: string
  tenant_id: string
  title: string
  description: string
  type: 'visit' | 'delivery' | 'collection' | 'survey' | 'promotion' | 'maintenance' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  assigned_to: string
  assigned_agent_name: string
  customer_id?: string
  customer_name?: string
  location: Location
  scheduled_date: string
  due_date: string
  estimated_duration: number
  actual_duration?: number
  completion_notes?: string
  attachments: TaskAttachment[]
  created_by: string
  created_at: string
  updated_at: string
}

export interface TaskAttachment {
  id: string
  name: string
  type: 'image' | 'document' | 'audio' | 'video'
  url: string
  file_size: number
  uploaded_at: string
}

export interface FieldVisit {
  id: string
  tenant_id: string
  agent_id: string
  agent_name: string
  customer_id: string
  customer_name: string
  visit_type: 'sales' | 'service' | 'collection' | 'survey' | 'promotion' | 'relationship'
  purpose: string
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_date: string
  actual_start_time?: string
  actual_end_time?: string
  duration_minutes?: number
  location: Location
  check_in_location?: Location
  check_out_location?: Location
  outcomes: VisitOutcome[]
  notes?: string
  photos: string[]
  created_at: string
}

export interface VisitOutcome {
  type: 'sale' | 'order' | 'payment' | 'complaint' | 'feedback' | 'survey' | 'other'
  description: string
  value?: number
  reference_id?: string
}

export interface TeamPerformance {
  team_id: string
  team_name: string
  supervisor_id: string
  supervisor_name: string
  agent_count: number
  total_visits: number
  successful_visits: number
  total_sales: number
  total_revenue: number
  average_performance_score: number
  top_performers: AgentPerformance[]
  performance_trend: PerformanceTrend[]
}

export interface AgentPerformance {
  agent_id: string
  agent_name: string
  visits: number
  sales: number
  revenue: number
  performance_score: number
}

export interface PerformanceTrend {
  date: string
  visits: number
  sales: number
  revenue: number
  performance_score: number
}

export interface FieldOperationsStats {
  total_agents: number
  active_agents: number
  total_tasks: number
  pending_tasks: number
  completed_tasks: number
  total_visits: number
  successful_visits: number
  visit_success_rate: number
  total_revenue: number
  average_performance_score: number
}

export interface AgentFilter {
  search?: string
  status?: string
  role?: string
  team_id?: string
  supervisor_id?: string
  territory_id?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface TaskFilter {
  search?: string
  type?: string
  priority?: string
  status?: string
  assigned_to?: string
  customer_id?: string
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface VisitFilter {
  search?: string
  agent_id?: string
  customer_id?: string
  visit_type?: string
  status?: string
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

class FieldOperationsService extends ApiService {
  private baseUrl = '/field-operations'

  // Agent Management
  async getFieldAgents(filter: AgentFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/agents?${params.toString()}`)
    return response.data
  }

  async getFieldAgent(id: string) {
    const response = await this.get(`${this.baseUrl}/agents/${id}`)
    return response.data
  }

  async createFieldAgent(agent: Partial<FieldAgent>) {
    const response = await this.post(`${this.baseUrl}/agents`, agent)
    return response.data
  }

  async updateFieldAgent(id: string, agent: Partial<FieldAgent>) {
    const response = await this.put(`${this.baseUrl}/agents/${id}`, agent)
    return response.data
  }

  async deleteFieldAgent(id: string) {
    const response = await this.delete(`${this.baseUrl}/agents/${id}`)
    return response.data
  }

  async getAgentPerformance(agentId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await this.get(`${this.baseUrl}/stats?agent_id=${agentId}&${params.toString()}`)
    return response.data
  }

  async getAgentLocation(agentId: string) {
    const response = await this.get(`${this.baseUrl}/live-locations?agent_id=${agentId}`)
    return response.data
  }

  async updateAgentLocation(agentId: string, location: Location) {
    const response = await this.post(`${this.baseUrl}/agents/${agentId}/location`, location)
    return response.data
  }

  async getAgentLocationHistory(agentId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await this.get(`${this.baseUrl}/live-locations?agent_id=${agentId}&${params.toString()}`)
    return response.data
  }

  // Task Management
  async getFieldTasks(filter: TaskFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`/visits?${params.toString()}`)
    return response.data
  }

  async getFieldTask(id: string) {
    const response = await this.get(`/visits/${id}`)
    return response.data
  }

  async createFieldTask(task: Partial<FieldTask>) {
    const response = await this.post(`/visits`, task)
    return response.data
  }

  async updateFieldTask(id: string, task: Partial<FieldTask>) {
    const response = await this.put(`/visits/${id}`, task)
    return response.data
  }

  async deleteFieldTask(id: string) {
    const response = await this.delete(`/visits/${id}`)
    return response.data
  }

  async assignTask(taskId: string, agentId: string) {
    const response = await this.put(`/visits/${taskId}`, { agent_id: agentId })
    return response.data
  }

  async startTask(taskId: string) {
    const response = await this.post(`${this.baseUrl}/visits/${taskId}/check-in`, { location: { latitude: 0, longitude: 0, timestamp: new Date().toISOString() } })
    return response.data
  }

  async completeTask(taskId: string, notes?: string, attachments?: File[]) {
    const formData = new FormData()
    if (notes) formData.append('notes', notes)
    if (attachments) {
      attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file)
      })
    }

    const response = await this.post(`${this.baseUrl}/visits/${taskId}/check-out`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async cancelTask(taskId: string, reason?: string) {
    const response = await this.put(`/visits/${taskId}`, { status: 'cancelled', notes: reason })
    return response.data
  }

  // Visit Management
  async getFieldVisits(filter: VisitFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/visits?${params.toString()}`)
    return response.data
  }

  async getFieldVisit(id: string) {
    const response = await this.get(`${this.baseUrl}/visits/${id}`)
    return response.data
  }

  async createFieldVisit(visit: Partial<FieldVisit>) {
    const response = await this.post(`${this.baseUrl}/visits`, visit)
    return response.data
  }

  async updateFieldVisit(id: string, visit: Partial<FieldVisit>) {
    const response = await this.put(`${this.baseUrl}/visits/${id}`, visit)
    return response.data
  }

  async checkInVisit(visitId: string, location: Location) {
    const response = await this.post(`${this.baseUrl}/visits/${visitId}/check-in`, { location })
    return response.data
  }

  async checkOutVisit(visitId: string, location: Location, outcomes: VisitOutcome[], notes?: string, photos?: File[]) {
    const formData = new FormData()
    formData.append('location', JSON.stringify(location))
    formData.append('outcomes', JSON.stringify(outcomes))
    if (notes) formData.append('notes', notes)
    if (photos) {
      photos.forEach((file, index) => {
        formData.append(`photo_${index}`, file)
      })
    }

    const response = await this.post(`${this.baseUrl}/visits/${visitId}/check-out`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async cancelVisit(visitId: string, reason?: string) {
    const response = await this.put(`/visits/${visitId}`, { status: 'cancelled', notes: reason })
    return response.data
  }

  // Team Management
  async getTeamPerformance(teamId?: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (teamId) params.append('team_id', teamId)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data
  }

  async getTeamStats(teamId?: string) {
    const params = new URLSearchParams()
    if (teamId) params.append('team_id', teamId)

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data
  }

  // Territory Management
  async getTerritories() {
    const response = await this.get(`/territories`)
    return response.data
  }

  async getTerritory(id: string) {
    const response = await this.get(`/territories/${id}`)
    return response.data
  }

  async createTerritory(territory: Partial<Territory>) {
    const response = await this.post(`/territories`, territory)
    return response.data
  }

  async updateTerritory(id: string, territory: Partial<Territory>) {
    const response = await this.put(`/territories/${id}`, territory)
    return response.data
  }

  async deleteTerritory(id: string) {
    const response = await this.delete(`/territories/${id}`)
    return response.data
  }

  // Analytics & Reporting
  async getFieldOperationsStats(dateRange?: any) {
    const params = new URLSearchParams()
    if (dateRange?.start_date) params.append('start_date', dateRange.start_date)
    if (dateRange?.end_date) params.append('end_date', dateRange.end_date)

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data
  }

  async getPerformanceAnalytics(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data
  }

  async getProductivityAnalytics(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data
  }

  async exportFieldOperationsReport(format: 'pdf' | 'excel' = 'pdf', filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    params.append('format', format)

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`, {
      responseType: 'blob'
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `field-operations-report-${Date.now()}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  // Real-time Operations
  async getLiveAgentLocations() {
    const response = await this.get(`${this.baseUrl}/live-locations`)
    return response.data
  }

  async getActiveVisits() {
    const response = await this.get(`${this.baseUrl}/visits?status=in_progress`)
    return response.data
  }

  async getPendingTasks() {
    const response = await this.get(`/visits?status=planned`)
    return response.data
  }

  async getRealtimeMetrics() {
    const response = await this.get(`${this.baseUrl}/stats`)
    return response.data
  }

  // Bulk Operations
  async bulkAssignTasks(taskIds: string[], agentId: string) {
    const response = await this.put(`/visits/bulk-update`, {
      task_ids: taskIds,
      agent_id: agentId
    })
    return response.data
  }

  async bulkUpdateTaskStatus(taskIds: string[], status: string) {
    const response = await this.put(`/visits/bulk-update`, {
      task_ids: taskIds,
      status
    })
    return response.data
  }

  // Additional methods for missing functionality
  async getFieldOperationsAnalytics(dateRange: any) {
    const params = new URLSearchParams()
    if (dateRange.start_date) params.append('start_date', dateRange.start_date)
    if (dateRange.end_date) params.append('end_date', dateRange.end_date)

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data
  }

  async getFieldOperationsTrends(dateRange: any) {
    const params = new URLSearchParams()
    if (dateRange.start_date) params.append('start_date', dateRange.start_date)
    if (dateRange.end_date) params.append('end_date', dateRange.end_date)

    const response = await this.get(`/dashboard/revenue-trends?${params.toString()}`)
    return response.data
  }

  async getRouteOptimization(agentId: string, date: string) {
    const response = await this.get(`${this.baseUrl}/routes?agent_id=${agentId}&date=${date}`)
    return response.data
  }

  async getFieldInsights(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data
  }

  async getOperationalMetrics(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data
  }

  // Board Placements
  async getBoardPlacements(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/beats?${params.toString()}`)
    return response.data
  }

  async getBoardPlacement(id: string) {
    const response = await this.get(`${this.baseUrl}/beats/${id}`)
    return response.data
  }

  async createBoardPlacement(data: any) {
    const response = await this.post(`${this.baseUrl}/beats`, data)
    return response.data
  }

  async updateBoardPlacement(id: string, data: any) {
    const response = await this.put(`${this.baseUrl}/beats/${id}`, data)
    return response.data
  }

  async reverseBoardPlacement(id: string | number) {
    const response = await this.post(`${this.baseUrl}/beats/${id}/reverse`)
    return response.data
  }

  async deleteBoardPlacement(id: string) {
    const response = await this.delete(`${this.baseUrl}/beats/${id}`)
    return response.data
  }

  // Dashboard
  async getDashboard(dateRange?: any) {
    const params = new URLSearchParams()
    if (dateRange?.start_date) params.append('start_date', dateRange.start_date)
    if (dateRange?.end_date) params.append('end_date', dateRange.end_date)

    const response = await this.get(`/dashboard/stats?${params.toString()}`)
    return response.data
  }

  // ==================== FIELD OPS: COMPANIES ====================
  async getCompanies() {
    const response = await this.get('/field-ops/companies')
    return response.data || response
  }

  async getCompany(id: string) {
    const response = await this.get(`/field-ops/companies/${id}`)
    return response.data || response
  }

  async createCompany(data: { name: string; code?: string; description?: string; contact_email?: string; contact_phone?: string; logo_url?: string }) {
    const response = await this.post('/field-ops/companies', data)
    return response.data || response
  }

  async updateCompany(id: string, data: Record<string, unknown>) {
    const response = await this.put(`/field-ops/companies/${id}`, data)
    return response.data || response
  }

  async deleteCompany(id: string) {
    const response = await this.delete(`/field-ops/companies/${id}`)
    return response.data || response
  }

  // ==================== FIELD OPS: AGENT-COMPANY LINKS ====================
  async getAgentCompanies(agentId: string) {
    const response = await this.get(`/field-ops/agent-companies/${agentId}`)
    return response.data || response
  }

  async linkAgentToCompany(agentId: string, companyId: string) {
    const response = await this.post('/field-ops/agent-companies', { agent_id: agentId, company_id: companyId })
    return response.data || response
  }

  async unlinkAgentFromCompany(linkId: string) {
    const response = await this.delete(`/field-ops/agent-companies/${linkId}`)
    return response.data || response
  }

  // ==================== FIELD OPS: DAILY TARGETS ====================
  async getDailyTargets(filter: { agent_id?: string; company_id?: string; date?: string; start_date?: string; end_date?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value) params.append(key, String(value))
    })
    const response = await this.get(`/field-ops/daily-targets?${params.toString()}`)
    return response.data || response
  }

  async createDailyTarget(data: { agent_id: string; company_id?: string; target_visits?: number; target_conversions?: number; target_registrations?: number; target_date: string }) {
    const response = await this.post('/field-ops/daily-targets', data)
    return response.data || response
  }

  async updateDailyTarget(id: string, data: Record<string, unknown>) {
    const response = await this.put(`/field-ops/daily-targets/${id}`, data)
    return response.data || response
  }

  async deleteDailyTarget(id: string) {
    const response = await this.delete(`/field-ops/daily-targets/${id}`)
    return response.data || response
  }

  async bulkCreateDailyTargets(data: { agent_ids: string[]; company_id?: string; target_visits?: number; target_conversions?: number; target_registrations?: number; target_date: string }) {
    const response = await this.post('/field-ops/daily-targets/bulk', data)
    return response.data || response
  }

  // ==================== FIELD OPS: INDIVIDUAL REGISTRATIONS ====================
  async getIndividuals(filter: { agent_id?: string; company_id?: string; converted?: string; search?: string; page?: number; limit?: number } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.append(key, String(value))
    })
    const response = await this.get(`/field-ops/individuals?${params.toString()}`)
    return response.data || response
  }

  async getIndividual(id: string) {
    const response = await this.get(`/field-ops/individuals/${id}`)
    return response.data || response
  }

  async registerIndividual(data: { first_name: string; last_name: string; id_number?: string; phone?: string; email?: string; product_app_player_id?: string; company_id?: string; visit_id?: string; notes?: string; gps_latitude?: number; gps_longitude?: number; converted?: boolean }) {
    const response = await this.post('/field-ops/individuals/register', data)
    return response.data || response
  }

  async updateIndividual(id: string, data: Record<string, unknown>) {
    const response = await this.put(`/field-ops/individuals/${id}`, data)
    return response.data || response
  }

  async convertIndividual(id: string, productAppPlayerId?: string) {
    const response = await this.post(`/field-ops/individuals/${id}/convert`, { product_app_player_id: productAppPlayerId })
    return response.data || response
  }

  // ==================== FIELD OPS: HIERARCHY ====================
  async getHierarchy() {
    const response = await this.get('/field-ops/hierarchy')
    return response.data || response
  }

  async assignHierarchy(userId: string, data: { manager_id?: string | null; team_lead_id?: string | null }) {
    const response = await this.put('/field-ops/hierarchy/assign', { user_id: userId, ...data })
    return response.data || response
  }

  // ==================== FIELD OPS: PERFORMANCE (ROLE-BASED) ====================
  async getPerformance(filter: { date?: string; start_date?: string; end_date?: string; company_id?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value) params.append(key, String(value))
    })
    const response = await this.get(`/field-ops/performance?${params.toString()}`)
    return response.data || response
  }

  // ==================== FIELD OPS: DRILL-DOWN ====================
  async getDrillDown(userId: string, filter: { start_date?: string; end_date?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value) params.append(key, String(value))
    })
    const response = await this.get(`/field-ops/drill-down/${userId}?${params.toString()}`)
    return response.data || response
  }

  // ==================== FIELD OPS: COMPANY AUTH ====================
  async companyLogin(email: string, password: string) {
    // Use plain axios.post() to bypass the shared apiClient's 401 interceptor,
    // which would try to refresh the main app token and redirect to /auth/login
    const { default: axios } = await import('axios')
    const { API_CONFIG } = await import('../config/api.config')
    const response = await axios.post(`${API_CONFIG.BASE_URL}/field-ops/company-auth/login`, { email, password })
    return response.data || response
  }

  async getCompanyDashboard(companyId: string) {
    // Admin users access via main auth token; company portal users use getCompanyPortalDashboard() instead
    const response = await this.get(`/field-ops/company-dashboard?company_id=${companyId}`)
    return response.data || response
  }

  // ==================== COMPANY PORTAL ENDPOINTS (company_token auth) ====================
  private async companyPortalGet(path: string) {
    const { default: axios } = await import('axios')
    const { API_CONFIG } = await import('../config/api.config')
    const token = localStorage.getItem('company_token')
    const response = await axios.get(`${API_CONFIG.BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    return response.data || response
  }

  async getCompanyPortalDashboard() {
    return this.companyPortalGet('/field-ops/company-portal/dashboard')
  }

  async getCompanyPortalBrandInsights(filter: { start_date?: string; end_date?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value) params.append(key, String(value))
    })
    return this.companyPortalGet(`/field-ops/company-portal/brand-insights?${params.toString()}`)
  }

  async exportCompanyPortalData(type: 'visits' | 'registrations', startDate?: string, endDate?: string) {
    const { default: axios } = await import('axios')
    const { API_CONFIG } = await import('../config/api.config')
    const token = localStorage.getItem('company_token')
    const params = new URLSearchParams()
    params.append('type', type)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    const response = await axios.get(`${API_CONFIG.BASE_URL}/field-ops/company-portal/export?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      responseType: 'blob',
    })
    return response.data
  }

  // ==================== FIELD OPS: BRAND INSIGHTS ====================
  async getBrandInsights(filter: { company_id?: string; start_date?: string; end_date?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value) params.append(key, String(value))
    })
    const response = await this.get(`/field-ops/brand-insights?${params.toString()}`)
    return response.data || response
  }

  // ==================== FIELD OPS: COMPANY LOGINS MANAGEMENT ====================
  async getCompanyLogins(companyId?: string) {
    const params = companyId ? `?company_id=${companyId}` : ''
    const response = await this.get(`/field-ops/company-logins${params}`)
    return response.data || response
  }

  async createCompanyLogin(data: { company_id: string; email: string; password: string; name: string; role?: string }) {
    const response = await this.post('/field-ops/company-logins', data)
    return response.data || response
  }

  async deleteCompanyLogin(id: string) {
    const response = await this.delete(`/field-ops/company-logins/${id}`)
    return response.data || response
  }

  // Convenience: get visits for field ops with proper response shape
  async getVisits(filter: Record<string, string> = {}) {
    const params = new URLSearchParams(filter)
    const response = await this.get(`${this.baseUrl}/visits?${params.toString()}`)
    return response.data || response
  }
}

export const fieldOperationsService = new FieldOperationsService()
