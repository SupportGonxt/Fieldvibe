import { ApiService } from './api.service'

// ============================================================================
// Type Definitions
// ============================================================================

export interface Board {
  id: string
  tenant_id: string
  brand_id: string
  board_code: string
  board_name: string
  dimensions?: {
    width: number
    height: number
    unit: string
  }
  material_type?: string
  installation_type?: string
  commission_rate: number
  quality_multiplier_rules?: Record<string, number>
  min_coverage_percentage: number
  status: 'active' | 'inactive' | 'discontinued'
  total_available: number
  total_installed: number
  created_at: string
  updated_at: string
  created_by?: string
  brand_name?: string
}

export interface BoardInstallation {
  id: string
  tenant_id: string
  board_id: string
  agent_id: string
  customer_id: string
  visit_id?: string
  installation_location: string
  pre_installation_photo?: string
  post_installation_photo?: string
  coverage_percentage: number
  visibility_score: number
  quality_score: number
  gps_latitude: number
  gps_longitude: number
  gps_accuracy?: number
  installation_date: string
  removal_date?: string
  removal_reason?: string
  status: 'pending' | 'installed' | 'verified' | 'removed' | 'damaged'
  notes?: string
  verified_by?: string
  verified_at?: string
  created_at: string
  updated_at: string
  board_name?: string
  customer_name?: string
  agent_name?: string
}

export interface Product {
  id: string
  tenant_id: string
  brand_id: string
  product_code: string
  product_name: string
  product_type: 'sim_card' | 'mobile_phone' | 'feature_phone' | 'accessory' | 'promo_item'
  requires_serial_number: boolean
  requires_imei: boolean
  requires_id_document: boolean
  requires_signature: boolean
  commission_rate: number
  volume_bonus_rules?: Record<string, number>
  approval_required: boolean
  status: 'active' | 'inactive' | 'discontinued'
  created_at: string
  updated_at: string
  created_by?: string
  brand_name?: string
}

export interface ProductDistribution {
  id: string
  tenant_id: string
  product_id: string
  agent_id: string
  customer_id: string
  visit_id?: string
  recipient_name: string
  recipient_id_number?: string
  recipient_phone: string
  recipient_email?: string
  quantity: number
  serial_number?: string
  imei_number?: string
  batch_number?: string
  recipient_signature?: string
  recipient_photo?: string
  id_document_photo?: string
  form_data?: Record<string, any>
  gps_latitude: number
  gps_longitude: number
  gps_accuracy?: number
  distribution_date: string
  status: 'pending' | 'distributed' | 'verified' | 'returned' | 'faulty'
  return_reason?: string
  notes?: string
  verified_by?: string
  verified_at?: string
  created_at: string
  updated_at: string
  product_name?: string
  customer_name?: string
  agent_name?: string
}

export interface Commission {
  id: string
  tenant_id: string
  agent_id: string
  activity_type: 'board_installation' | 'product_distribution'
  activity_id: string
  base_amount: number
  bonus_amount: number
  penalty_amount: number
  total_amount: number
  calculation_details?: Record<string, any>
  status: 'pending' | 'info_requested' | 'approved' | 'rejected' | 'paid'
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  paid_at?: string
  payment_reference?: string
  payment_batch_id?: string
  notes?: string
  created_at: string
  updated_at: string
  agent_name?: string
  activity_description?: string
}

export interface GPSLocation {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  speed?: number
  bearing?: number
  timestamp?: string
}

export interface CustomerGPS {
  id: string
  tenant_id: string
  customer_id: string
  latitude: number
  longitude: number
  accuracy?: number
  captured_by: string
  captured_at: string
  is_current: boolean
  update_reason?: string
  previous_location?: {
    lat: number
    lon: number
  }
}

export interface VisitListItem {
  id: string
  tenant_id: string
  visit_id: string
  item_type: 'survey' | 'board_installation' | 'product_distribution' | 'store_audit' | 'competitor_check'
  item_id?: string
  item_name: string
  item_description?: string
  is_mandatory: boolean
  sort_order: number
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  completed_at?: string
  completed_data?: Record<string, any>
  created_at: string
}

export interface VisitStart {
  customer_id?: string
  customer_type: 'existing' | 'new'
  gps_latitude: number
  gps_longitude: number
  gps_accuracy?: number
  selected_brands?: string[]
  new_customer_data?: {
    name: string
    store_type: string
    contact_person?: string
    phone?: string
    address?: string
    storefront_photo?: string
  }
}

export interface CommissionSummary {
  total_pending: number
  total_approved: number
  total_paid: number
  total_rejected: number
  pending_commissions: Commission[]
  approved_commissions: Commission[]
  monthly_breakdown: {
    month: string
    total: number
    count: number
  }[]
}

// ============================================================================
// Field Marketing Service
// ============================================================================

class FieldMarketingService {
  private api: ApiService

  constructor() {
    this.api = new ApiService()
  }

  // ==========================================================================
  // Board Management
  // ==========================================================================

  async getBoards(params?: { brand_id?: string; status?: string }) {
    return this.api.get<Board[]>('/boards', { params })
  }

  async getBoard(id: string) {
    return this.api.get<Board>(`/boards/${id}`)
  }

  async createBoard(data: Partial<Board>) {
    return this.api.post<Board>('/boards', data)
  }

  async updateBoard(id: string, data: Partial<Board>) {
    return this.api.put<Board>(`/boards/${id}`, data)
  }

  async deleteBoard(id: string) {
    return this.api.delete(`/boards/${id}`)
  }

  // ==========================================================================
  // Board Installations
  // ==========================================================================

  async getBoardInstallations(params?: { 
    agent_id?: string
    customer_id?: string
    board_id?: string
    status?: string
    from_date?: string
    to_date?: string
  }) {
    return this.api.get<BoardInstallation[]>('/board-installations', { params })
  }

  async getBoardInstallation(id: string) {
    return this.api.get<BoardInstallation>(`/board-installations/${id}`)
  }

  async createBoardInstallation(data: Partial<BoardInstallation>) {
    return this.api.post<BoardInstallation>('/board-installations', data)
  }

  async updateBoardInstallation(id: string, data: Partial<BoardInstallation>) {
    return this.api.put<BoardInstallation>(`/board-installations/${id}`, data)
  }

  async calculateCoverage(id: string, data: {
    pre_installation_photo: string
    post_installation_photo: string
  }) {
    return this.api.post<{
      coverage_percentage: number
      visibility_score: number
      quality_score: number
      analysis_details: any
    }>(`/board-installations/${id}/calculate-coverage`, data)
  }

  // ==========================================================================
  // Products
  // ==========================================================================

  async getProducts(params?: { brand_id?: string; product_type?: string; status?: string }) {
    return this.api.get<Product[]>('/products', { params })
  }

  async getProduct(id: string) {
    return this.api.get<Product>(`/products/${id}`)
  }

  async createProduct(data: Partial<Product>) {
    return this.api.post<Product>('/products', data)
  }

  async updateProduct(id: string, data: Partial<Product>) {
    return this.api.put<Product>(`/products/${id}`, data)
  }

  async deleteProduct(id: string) {
    return this.api.delete(`/products/${id}`)
  }

  // ==========================================================================
  // Product Distributions
  // ==========================================================================

  async getProductDistributions(params?: {
    agent_id?: string
    customer_id?: string
    product_id?: string
    status?: string
    from_date?: string
    to_date?: string
  }) {
    return this.api.get<ProductDistribution[]>('/product-distributions', { params })
  }

  async getProductDistribution(id: string) {
    return this.api.get<ProductDistribution>(`/product-distributions/${id}`)
  }

  async createProductDistribution(data: Partial<ProductDistribution>) {
    return this.api.post<ProductDistribution>('/product-distributions', data)
  }

  async updateProductDistribution(id: string, data: Partial<ProductDistribution>) {
    return this.api.put<ProductDistribution>(`/product-distributions/${id}`, data)
  }

  // ==========================================================================
  // GPS & Location
  // ==========================================================================

  async logGPSLocation(data: {
    visit_id?: string
    activity_type?: string
    activity_id?: string
    latitude: number
    longitude: number
    accuracy?: number
    altitude?: number
    speed?: number
    bearing?: number
    device_info?: any
  }) {
    return this.api.post('/gps-location/log', data)
  }

  async verifyCustomerLocation(data: {
    customer_id: string
    current_latitude: number
    current_longitude: number
    current_accuracy?: number
  }) {
    return this.api.post<{
      verified: boolean
      distance_meters: number
      status: 'perfect_match' | 'acceptable' | 'requires_explanation'
      customer_location: CustomerGPS
      message: string
    }>('/gps-location/verify-customer', data)
  }

  async getCustomerLocation(customer_id: string) {
    return this.api.get<CustomerGPS>(`/gps-location/customer/${customer_id}`)
  }

  async updateCustomerLocation(customer_id: string, data: {
    latitude: number
    longitude: number
    accuracy?: number
    update_reason: string
  }) {
    return this.api.put<CustomerGPS>(`/gps-location/customer/${customer_id}/update`, data)
  }

  // ==========================================================================
  // Field Agent Workflow
  // ==========================================================================

  async startVisit(data: VisitStart) {
    return this.api.post<{
      visit_id: string
      customer_id: string
      gps_verified: boolean
      message: string
    }>('/field-agent-workflow/start-visit', data)
  }

  async generateVisitList(data: {
    visit_id: string
    customer_id: string
    brand_ids: string[]
    customer_type: 'existing' | 'new'
  }) {
    return this.api.post<{
      visit_id: string
      visit_list_items: VisitListItem[]
      message: string
    }>('/field-agent-workflow/generate-visit-list', data)
  }

  async getVisitList(visit_id: string) {
    return this.api.get<{
      visit_id: string
      visit_list_items: VisitListItem[]
      total_items: number
      completed_items: number
      mandatory_items: number
      mandatory_completed: number
    }>(`/field-agent-workflow/visit-list/${visit_id}`)
  }

  async completeVisitItem(data: {
    visit_list_item_id: string
    completed_data: Record<string, any>
    activity_id?: string
  }) {
    return this.api.post<VisitListItem>('/field-agent-workflow/complete-visit-item', data)
  }

  async completeVisit(data: {
    visit_id: string
    notes?: string
  }) {
    return this.api.post<{
      visit_id: string
      status: string
      completed_items: number
      total_items: number
      message: string
    }>('/field-agent-workflow/complete-visit', data)
  }

  async getAgentSummary(agent_id: string, params?: {
    from_date?: string
    to_date?: string
  }) {
    return this.api.get<{
      agent_id: string
      agent_name: string
      total_visits: number
      completed_visits: number
      total_board_installations: number
      total_product_distributions: number
      total_commissions_earned: number
      pending_commissions: number
      approved_commissions: number
      paid_commissions: number
      recent_activities: any[]
    }>('/field-agent-workflow/agent-summary', { params: { agent_id, ...params } })
  }

  // ==========================================================================
  // Commissions
  // ==========================================================================

  async getCommissions(params?: {
    agent_id?: string
    activity_type?: string
    status?: string
    from_date?: string
    to_date?: string
  }) {
    return this.api.get<Commission[]>('/field-commissions', { params })
  }

  async getCommission(id: string) {
    return this.api.get<Commission>(`/field-commissions/${id}`)
  }

  async approveCommission(id: string, data?: { notes?: string }) {
    return this.api.put<Commission>(`/field-commissions/${id}/approve`, data)
  }

  async rejectCommission(id: string, data: { rejection_reason: string }) {
    return this.api.put<Commission>(`/field-commissions/${id}/reject`, data)
  }

  async getAgentCommissionSummary(agent_id: string, params?: {
    from_date?: string
    to_date?: string
  }) {
    return this.api.get<CommissionSummary>(`/field-commissions/agent/${agent_id}/summary`, { params })
  }

  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula for calculating distance between two GPS coordinates
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }

  getDistanceStatus(distanceMeters: number): {
    status: 'perfect_match' | 'acceptable' | 'requires_explanation'
    color: string
    message: string
  } {
    if (distanceMeters <= 10) {
      return {
        status: 'perfect_match',
        color: 'green',
        message: `Within ${distanceMeters.toFixed(1)}m - Perfect match!`
      }
    } else if (distanceMeters <= 50) {
      return {
        status: 'acceptable',
        color: 'yellow',
        message: `${distanceMeters.toFixed(1)}m away - Acceptable but verify location`
      }
    } else {
      return {
        status: 'requires_explanation',
        color: 'red',
        message: `${distanceMeters.toFixed(1)}m away - Location update may be required`
      }
    }
  }

  async uploadPhoto(file: File, type: 'board_installation' | 'product_distribution' | 'storefront'): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    
    const response = await this.api.post<{ url: string }>('/upload-photo', formData)
    return response.data.url
  }

  // Board placement alias (called by BoardPlacementCreate page)
  async createBoardPlacement(data: Partial<BoardInstallation>) {
    return this.createBoardInstallation(data)
  }

  // Visit management (called by field marketing visit pages)
  async getVisits(params?: any) {
    return this.api.get('/visits', { params })
  }

  async createVisit(data: any) {
    return this.api.post('/visits', data)
  }

  // Customer search (called by field marketing pages)
  async searchCustomers(query: string) {
    return this.api.get('/customers', { params: { search: query } })
  }

  // GPS validation (called by field marketing GPS pages)
  async validateGPS(data: { latitude: number; longitude: number; accuracy?: number }) {
    return this.verifyCustomerLocation({
      customer_id: '',
      current_latitude: data.latitude,
      current_longitude: data.longitude,
      current_accuracy: data.accuracy,
    })
  }
}

export const fieldMarketingService = new FieldMarketingService()
