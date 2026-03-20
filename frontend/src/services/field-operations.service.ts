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

  // ── Manager-Company Links ──
  async assignManagerToCompany(managerId: string, companyId: string) {
    const response = await this.post('/field-ops/hierarchy/manager-companies', { manager_id: managerId, company_id: companyId })
    return response.data || response
  }

  async unassignManagerFromCompany(linkId: string) {
    const response = await this.delete(`/field-ops/hierarchy/manager-companies/${linkId}`)
    return response.data || response
  }

  // ==================== MARKETING: HIERARCHY ====================
  async getMarketingHierarchy() {
    const response = await this.get('/marketing/hierarchy')
    return response.data || response
  }

  async assignMarketingHierarchy(userId: string, data: { manager_id?: string | null; team_lead_id?: string | null }) {
    const response = await this.put('/marketing/hierarchy/assign', { user_id: userId, ...data })
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

  // ==================== FIELD OPS: SETTINGS ====================
  async getFieldOpsSettings() {
    const response = await this.get('/field-ops/settings')
    return response.data || response
  }

  async updateFieldOpsSetting(key: string, value: string, description?: string) {
    const response = await this.put('/field-ops/settings', { setting_key: key, setting_value: value, description })
    return response.data || response
  }

  async bulkSaveFieldOpsSettings(settings: { setting_key: string; setting_value: string; description?: string }[]) {
    const response = await this.post('/field-ops/settings/bulk', { settings })
    return response.data || response
  }

  // ==================== FIELD OPS: WORKING DAYS CONFIG ====================
  async getWorkingDaysConfigs(filter: { company_id?: string; agent_id?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value) params.append(key, String(value))
    })
    const response = await this.get(`/field-ops/working-days?${params.toString()}`)
    return response.data || response
  }

  async createWorkingDaysConfig(data: {
    company_id?: string; agent_id?: string;
    monday?: number; tuesday?: number; wednesday?: number; thursday?: number;
    friday?: number; saturday?: number; sunday?: number;
    public_holidays?: string; effective_from?: string; effective_to?: string
  }) {
    const response = await this.post('/field-ops/working-days', data)
    return response.data || response
  }

  async updateWorkingDaysConfig(id: string, data: Record<string, unknown>) {
    const response = await this.put(`/field-ops/working-days/${id}`, data)
    return response.data || response
  }

  async deleteWorkingDaysConfig(id: string) {
    const response = await this.delete(`/field-ops/working-days/${id}`)
    return response.data || response
  }

  async getEffectiveWorkingDays(filter: { agent_id?: string; company_id?: string; month?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value) params.append(key, String(value))
    })
    const response = await this.get(`/field-ops/working-days/effective?${params.toString()}`)
    return response.data || response
  }

  // ==================== FIELD OPS: MONTHLY TARGETS ====================
  async getMonthlyTargets(filter: { agent_id?: string; company_id?: string; target_month?: string; status?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value) params.append(key, String(value))
    })
    const response = await this.get(`/field-ops/monthly-targets?${params.toString()}`)
    return response.data || response
  }

  async createMonthlyTarget(data: {
    agent_id: string; company_id?: string; target_month: string;
    target_visits?: number; target_conversions?: number; target_registrations?: number;
    working_days?: number; commission_rate?: number
  }) {
    const response = await this.post('/field-ops/monthly-targets', data)
    return response.data || response
  }

  async updateMonthlyTarget(id: string, data: Record<string, unknown>) {
    const response = await this.put(`/field-ops/monthly-targets/${id}`, data)
    return response.data || response
  }

  async deleteMonthlyTarget(id: string) {
    const response = await this.delete(`/field-ops/monthly-targets/${id}`)
    return response.data || response
  }

  async recalculateMonthlyTarget(id: string) {
    const response = await this.post(`/field-ops/monthly-targets/${id}/recalculate`)
    return response.data || response
  }

  // ==================== FIELD OPS: COMMISSION TIERS ====================
  async getCommissionTiers(filter: { company_id?: string; metric_type?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value) params.append(key, String(value))
    })
    const response = await this.get(`/field-ops/commission-tiers?${params.toString()}`)
    return response.data || response
  }

  async createCommissionTier(data: {
    company_id?: string; tier_name: string;
    min_achievement_pct: number; max_achievement_pct?: number;
    commission_rate: number; bonus_amount?: number; metric_type?: string
  }) {
    const response = await this.post('/field-ops/commission-tiers', data)
    return response.data || response
  }

  async updateCommissionTier(id: string, data: Record<string, unknown>) {
    const response = await this.put(`/field-ops/commission-tiers/${id}`, data)
    return response.data || response
  }

  async deleteCommissionTier(id: string) {
    const response = await this.delete(`/field-ops/commission-tiers/${id}`)
    return response.data || response
  }

  // Convenience: get visits for field ops with proper response shape
  async getVisits(filter: Record<string, string> = {}) {
    const params = new URLSearchParams(filter)
    const response = await this.get(`${this.baseUrl}/visits?${params.toString()}`)
    return response.data || response
  }

  // Alias for getLiveAgentLocations (called by LiveGPSTrackingPage)
  async getLiveLocations() {
    return this.getLiveAgentLocations()
  }

  // Alias for getFieldAgents (called by VisitCreate, ProductDistributionCreate)
  async getAgents() {
    const response = await this.get(`${this.baseUrl}/agents`)
    return response.data
  }

  // Get customers list (called by VisitCreate, ProductDistributionCreate)
  async getCustomers() {
    const response = await this.get('/customers')
    return response.data
  }

  // Get products list (called by ProductDistributionCreate)
  async getProducts() {
    const response = await this.get('/products')
    return response.data
  }

  // Get board types (called by BoardPlacementCreate)
  async getBoardTypes() {
    const response = await this.get('/boards')
    return response.data
  }

  // Visit CRUD (called by VisitCreate, VisitEdit, VisitManagementPage)
  async createVisit(data: any) {
    const response = await this.post(`${this.baseUrl}/visits`, data)
    return response.data
  }

  async getVisit(id: number | string) {
    const response = await this.get(`${this.baseUrl}/visits/${id}`)
    return response.data
  }

  async updateVisit(id: number | string, data: any) {
    const response = await this.put(`${this.baseUrl}/visits/${id}`, data)
    return response.data
  }

  async deleteVisit(id: string) {
    const response = await this.delete(`${this.baseUrl}/visits/${id}`)
    return response.data
  }

  // Visit history (called by VisitHistoryPage)
  async getVisitHistory(filter: Record<string, string> = {}) {
    const params = new URLSearchParams(filter)
    const response = await this.get(`${this.baseUrl}/visits?${params.toString()}`)
    return response.data
  }

  // Agent stats (called by FieldAgentDashboardPage)
  async getAgentStats() {
    const response = await this.get(`${this.baseUrl}/stats`)
    return response.data
  }

  // Commission methods (called by CommissionLedgerList, CommissionLedgerDetail)
  async getCommissions() {
    const response = await this.get('/field-commissions')
    return response.data
  }

  async getCommission(id: number | string) {
    const response = await this.get(`/field-commissions/${id}`)
    return response.data
  }

  // Product distribution methods (called by ProductDistributionsList, ProductDistributionDetail, ProductDistributionCreate)
  async getProductDistributions() {
    const response = await this.get('/product-distributions')
    return response.data
  }

  async getProductDistribution(id: number | string) {
    const response = await this.get(`/product-distributions/${id}`)
    return response.data
  }

  async createProductDistribution(data: any) {
    const response = await this.post('/product-distributions', data)
    return response.data
  }

  async reverseProductDistribution(id: number | string) {
    const response = await this.post(`/product-distributions/${id}/reverse`)
    return response.data
  }

  // ==================== VISIT WORKFLOW ====================

  // Check if a store was visited within the last 30 days
  async checkStoreRevisit(customerId: string) {
    const response = await this.post('/visits/check-store-revisit', { customer_id: customerId })
    return response.data || response
  }

  // Check for duplicate individual (ID number or phone)
  async checkIndividualDuplicate(data: { id_number?: string; phone?: string }) {
    const response = await this.post('/visits/check-individual-duplicate', data)
    return response.data || response
  }

  // Check for duplicate photo by hash
  async checkPhotoDuplicate(photoHash: string) {
    const response = await this.post('/visits/check-photo-duplicate', { photo_hash: photoHash })
    return response.data || response
  }

  // Get brand/company custom fields
  async getBrandCustomFields(companyId?: string, appliesTo?: string) {
    const params = new URLSearchParams()
    if (companyId) params.append('company_id', companyId)
    if (appliesTo) params.append('applies_to', appliesTo)
    const response = await this.get(`/brand-custom-fields?${params.toString()}`)
    return response.data || response
  }

  // Create brand custom field
  async createBrandCustomField(data: { company_id: string; field_name: string; field_label: string; field_type?: string; is_required?: boolean; field_options?: string; display_order?: number; applies_to?: string }) {
    const response = await this.post('/brand-custom-fields', data)
    return response.data || response
  }

  // Update brand custom field
  async updateBrandCustomField(id: string, data: Record<string, unknown>) {
    const response = await this.put(`/brand-custom-fields/${id}`, data)
    return response.data || response
  }

  // Delete (deactivate) brand custom field
  async deleteBrandCustomField(id: string) {
    const response = await this.delete(`/brand-custom-fields/${id}`)
    return response.data || response
  }

  // Get visit survey config per company
  async getVisitSurveyConfig(companyId?: string) {
    const params = new URLSearchParams()
    if (companyId) params.append('company_id', companyId)
    const response = await this.get(`/visit-survey-config?${params.toString()}`)
    return response.data || response
  }

  // Create visit survey config
  async createVisitSurveyConfig(data: { company_id: string; visit_target_type: string; survey_required: boolean; questionnaire_id?: string }) {
    const response = await this.post('/visit-survey-config', data)
    return response.data || response
  }

  // Create visit via full workflow (individual or store)
  async createVisitWorkflow(data: {
    visit_target_type: 'individual' | 'store';
    agent_id?: string;
    customer_id?: string;
    company_id?: string;
    brand_id?: string;
    checkin_latitude?: number;
    checkin_longitude?: number;
    individual_first_name?: string;
    individual_last_name?: string;
    individual_id_number?: string;
    individual_phone?: string;
    individual_email?: string;
    custom_field_values?: Record<string, string>;
    survey_responses?: Record<string, string>;
    questionnaire_id?: string;
    photos?: Array<{ photo_url?: string; photo_hash?: string; gps_latitude?: number; gps_longitude?: number; photo_type?: string; captured_at?: string }>;
    notes?: string;
    purpose?: string;
  }) {
    const response = await this.post('/visits/workflow', data)
    return response.data || response
  }

  // Complete a visit workflow
  async completeVisitWorkflow(visitId: string, data: {
    outcome?: string;
    completion_notes?: string;
    photos?: Array<{ photo_url?: string; photo_hash?: string; gps_latitude?: number; gps_longitude?: number; photo_type?: string }>;
  }) {
    const response = await this.post(`/visits/${visitId}/complete-workflow`, data)
    return response.data || response
  }

  // Get individuals for visit workflow
  async getVisitIndividuals(filter: { search?: string; company_id?: string; page?: number; limit?: number } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.append(key, String(value))
    })
    const response = await this.get(`/individuals?${params.toString()}`)
    return response.data || response
  }

  // Create individual for visit workflow
  async createVisitIndividual(data: { first_name: string; last_name: string; id_number?: string; phone?: string; email?: string; company_id?: string; gps_latitude?: number; gps_longitude?: number }) {
    const response = await this.post('/individuals', data)
    return response.data || response
  }

  // ==================== FIELD OPS: SURVEY INSIGHTS ====================
  async getSurveyInsights(filter: { company_id?: string; start_date?: string; end_date?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value) params.append(key, String(value))
    })
    const response = await this.get(`/field-ops/survey-insights?${params.toString()}`)
    return response.data || response
  }

  // ==================== VISIT SURVEY CONFIG ====================
  async getVisitSurveyConfigs(companyId?: string) {
    const params = companyId ? `?company_id=${companyId}` : ''
    const response = await this.get(`/visit-survey-config${params}`)
    return response.data || response
  }

  async updateVisitSurveyConfig(id: string, data: { visit_target_type?: string; survey_required?: boolean; questionnaire_id?: string }) {
    const response = await this.put(`/visit-survey-config/${id}`, data)
    return response.data || response
  }

  async deleteVisitSurveyConfig(id: string) {
    const response = await this.delete(`/visit-survey-config/${id}`)
    return response.data || response
  }

  // Get questionnaires for a visit type/brand
  async getQuestionnaires(filter: { visit_type?: string; brand_id?: string; target_type?: string; module?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value) params.append(key, String(value))
    })
    const response = await this.get(`/questionnaires?${params.toString()}`)
    return response.data || response
  }
}

export const fieldOperationsService = new FieldOperationsService()
