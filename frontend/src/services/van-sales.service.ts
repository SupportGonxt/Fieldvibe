import { ApiService } from './api.service'

export interface Van {
  id: string
  tenant_id: string
  code: string
  license_plate: string
  model: string
  year: number
  capacity: number
  status: 'active' | 'maintenance' | 'inactive'
  current_driver_id?: string
  current_driver_name?: string
  current_location?: Location
  last_updated: string
  created_at: string
}

export interface VanRoute {
  id: string
  tenant_id: string
  name: string
  code: string
  description?: string
  van_id: string
  driver_id: string
  status: 'active' | 'inactive' | 'completed'
  start_location: Location
  end_location: Location
  waypoints: Waypoint[]
  estimated_duration: number
  estimated_distance: number
  actual_duration?: number
  actual_distance?: number
  start_time?: string
  end_time?: string
  created_at: string
}

export interface Location {
  latitude: number
  longitude: number
  address?: string
  name?: string
}

export interface Waypoint {
  id: string
  customer_id: string
  customer_name: string
  location: Location
  visit_type: 'delivery' | 'collection' | 'sales' | 'service'
  estimated_arrival: string
  actual_arrival?: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  order_index: number
  notes?: string
}

export interface VanInventory {
  id: string
  van_id: string
  product_id: string
  product_name: string
  product_code: string
  current_stock: number
  loaded_stock: number
  sold_stock: number
  returned_stock: number
  unit_price: number
  total_value: number
  last_updated: string
}

export interface VanSale {
  id: string
  tenant_id: string
  van_id: string
  route_id: string
  customer_id: string
  customer_name: string
  agent_id: string
  agent_name: string
  sale_date: string
  items: VanSaleItem[]
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  payment_method: 'cash' | 'card' | 'mobile' | 'credit'
  payment_status: 'pending' | 'paid' | 'partial' | 'overdue'
  location: Location
  notes?: string
  created_at: string
}

export interface VanSaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  discount_amount: number
  total_amount: number
}

export interface VanExpense {
  id: string
  tenant_id: string
  van_id: string
  route_id?: string
  expense_type: 'fuel' | 'maintenance' | 'toll' | 'parking' | 'other'
  amount: number
  description: string
  receipt_url?: string
  expense_date: string
  created_by: string
  created_at: string
}

export interface VanPerformance {
  van_id: string
  van_code: string
  period_start: string
  period_end: string
  total_sales: number
  total_orders: number
  total_customers: number
  total_distance: number
  fuel_consumption: number
  efficiency_score: number
  customer_satisfaction: number
  on_time_delivery_rate: number
}

export interface VanFilter {
  search?: string
  status?: string
  driver_id?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface VanRouteFilter {
  search?: string
  van_id?: string
  driver_id?: string
  status?: string
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface VanSaleFilter {
  search?: string
  van_id?: string
  route_id?: string
  customer_id?: string
  agent_id?: string
  payment_status?: string
  report_type?: string
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface VanStats {
  total_vans: number
  active_vans: number
  total_routes: number
  active_routes: number
  total_sales: number
  total_revenue: number
  average_efficiency: number
  top_performing_vans: VanPerformance[]
}

class VanSalesService extends ApiService {
  private baseUrl = '/van-sales'

  // Van Management
  async getVans(filter: VanFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/vans?${params.toString()}`)
    return response.data.data || response.data
  }

  // Van CRUD lives at /vans (not /van-sales/vans) — those are the real endpoints
  // backed by the `vans` table. /van-sales/vans is the list view used by drop-downs.
  async getVan(id: string) {
    const response = await this.get(`/vans/${id}`)
    return response.data.data || response.data
  }

  async createVan(van: Partial<Van>) {
    const response = await this.post(`/vans`, van)
    return response.data.data || response.data
  }

  async updateVan(id: string, van: Partial<Van>) {
    const response = await this.put(`/vans/${id}`, van)
    return response.data.data || response.data
  }

  async deleteVan(id: string) {
    const response = await this.delete(`/vans/${id}`)
    return response.data.data || response.data
  }

  async assignVanDriver(vanId: string, driver_id: string) {
    const response = await this.post(`/vans/${vanId}/assign-driver`, { driver_id })
    return response.data.data || response.data
  }

  // Route Management
  async getVanRoutes(filter: VanRouteFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/routes?${params.toString()}`)
    return response.data.data || response.data
  }

  async getVanRoute(id: string) {
    const response = await this.get(`${this.baseUrl}/routes/${id}`)
    return response.data.data || response.data
  }

  async createVanRoute(route: Partial<VanRoute>) {
    const response = await this.post(`${this.baseUrl}/routes`, route)
    return response.data.data || response.data
  }

  async updateVanRoute(id: string, route: Partial<VanRoute>) {
    const response = await this.put(`${this.baseUrl}/routes/${id}`, route)
    return response.data.data || response.data
  }

  async deleteVanRoute(id: string) {
    const response = await this.delete(`${this.baseUrl}/routes/${id}`)
    return response.data.data || response.data
  }

  async startVanRoute(id: string) {
    const response = await this.post(`${this.baseUrl}/routes/${id}/start`)
    return response.data.data || response.data
  }

  async completeVanRoute(id: string) {
    const response = await this.post(`${this.baseUrl}/routes/${id}/complete`)
    return response.data.data || response.data
  }

  async optimizeRoute(routeId: string) {
    const response = await this.post(`${this.baseUrl}/routes/${routeId}/optimize`)
    return response.data.data || response.data
  }

  // Inventory Management
  async getVanInventory(vanId: string) {
    const response = await this.get(`${this.baseUrl}/vans/${vanId}/inventory`)
    return response.data.data || response.data
  }

  async updateVanInventory(vanId: string, inventory: VanInventory[]) {
    const response = await this.put(`${this.baseUrl}/vans/${vanId}/inventory`, { inventory })
    return response.data.data || response.data
  }

  async loadVanInventory(vanId: string, items: { product_id: string; quantity: number }[]) {
    const response = await this.post(`${this.baseUrl}/vans/${vanId}/load`, { items })
    return response.data.data || response.data
  }

  async unloadVanInventory(vanId: string, items: { product_id: string; quantity: number }[]) {
    const response = await this.post(`${this.baseUrl}/vans/${vanId}/unload`, { items })
    return response.data.data || response.data
  }

  // Sales Management
  async getVanSales(filter: VanSaleFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}?${params.toString()}`)
    return response.data.data || response.data
  }

  async getVanSale(id: string) {
    const response = await this.get(`${this.baseUrl}/${id}`)
    return response.data.data || response.data
  }

  async createVanSale(sale: Partial<VanSale>) {
    const response = await this.post(`${this.baseUrl}/create`, sale)
    return response.data.data || response.data
  }

  async updateVanSale(id: string, sale: Partial<VanSale>) {
    const response = await this.put(`${this.baseUrl}/${id}`, sale)
    return response.data.data || response.data
  }

  // Van Loads - use authoritative endpoints with inventory movements
  async getVanLoads(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    const response = await this.get(`${this.baseUrl}/van-loads?${params.toString()}`)
    return response.data.data || response.data
  }

  async createVanLoad(data: any) {
    const response = await this.post(`${this.baseUrl}/van-loads/create`, data)
    return response.data.data || response.data
  }

  async transitionVanLoad(id: string, new_status: string, notes?: string) {
    const response = await this.post(`${this.baseUrl}/van-loads/${id}/transition`, { new_status, notes })
    return response.data.data || response.data
  }

  // Van Sales Returns - use authoritative endpoints with inventory movements
  async getVanSalesReturns(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    const response = await this.get(`${this.baseUrl}/returns?${params.toString()}`)
    return response.data.data || response.data
  }

  async createVanSalesReturn(data: any) {
    const response = await this.post(`${this.baseUrl}/returns/create`, data)
    return response.data.data || response.data
  }



  async processVanSalePayment(saleId: string, paymentData: any) {
    const response = await this.post(`${this.baseUrl}/sales/${saleId}/payment`, paymentData)
    return response.data.data || response.data
  }

  // Expense Management
  async getVanExpenses(vanId: string, filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/vans/${vanId}/expenses?${params.toString()}`)
    return response.data.data || response.data
  }

  async createVanExpense(expense: Partial<VanExpense>) {
    const response = await this.post(`${this.baseUrl}/expenses`, expense)
    return response.data.data || response.data
  }

  async updateVanExpense(id: string, expense: Partial<VanExpense>) {
    const response = await this.put(`${this.baseUrl}/expenses/${id}`, expense)
    return response.data.data || response.data
  }

  async deleteVanExpense(id: string) {
    const response = await this.delete(`${this.baseUrl}/expenses/${id}`)
    return response.data.data || response.data
  }

  // Performance & Analytics
  async getVanStats() {
    const response = await this.get(`${this.baseUrl}/stats`)
    return response.data.data || response.data
  }

  async getVanPerformance(vanId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await this.get(`${this.baseUrl}/vans/${vanId}/performance?${params.toString()}`)
    return response.data.data || response.data
  }

  async getVanAnalytics(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/analytics?${params.toString()}`)
    return response.data.data || response.data
  }

  // Tracking & Location
  async getVanLocation(vanId: string) {
    const response = await this.get(`${this.baseUrl}/vans/${vanId}/location`)
    return response.data.data || response.data
  }

  async updateVanLocation(vanId: string, location: Location) {
    const response = await this.post(`${this.baseUrl}/vans/${vanId}/location`, location)
    return response.data.data || response.data
  }

  async getVanLocationHistory(vanId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await this.get(`${this.baseUrl}/vans/${vanId}/location-history?${params.toString()}`)
    return response.data.data || response.data
  }

  // Reports
  async exportVanSalesReport(format: 'pdf' | 'excel' = 'pdf', filter: VanSaleFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    params.append('format', format)

    const response = await this.get(`${this.baseUrl}/reports/sales?${params.toString()}`, {
      responseType: 'blob'
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `van-sales-report-${Date.now()}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  async exportVanPerformanceReport(format: 'pdf' | 'excel' = 'pdf', filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    params.append('format', format)

    const response = await this.get(`${this.baseUrl}/reports/performance?${params.toString()}`, {
      responseType: 'blob'
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `van-performance-report-${Date.now()}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  // Additional methods for missing functionality


  async getVanSalesMetrics(filter: VanSaleFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/metrics?${params.toString()}`)
    return response.data.data || response.data
  }

  async getVanSalesReports(type: string, filter: VanSaleFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    params.append('type', type)

    const response = await this.get(`${this.baseUrl}/reports?${params.toString()}`)
    return response.data.data || response.data
  }

  async getVanSalesInsights(filter: VanSaleFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/insights?${params.toString()}`)
    return response.data.data || response.data
  }

  // Additional missing methods
  async getVanSalesStats(dateRange?: any) {
    const params = new URLSearchParams()
    if (dateRange?.start_date) params.append('start_date', dateRange.start_date)
    if (dateRange?.end_date) params.append('end_date', dateRange.end_date)

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data.data || response.data
  }

  async getVanSalesAnalytics(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/analytics?${params.toString()}`)
    return response.data.data || response.data
  }

  async getVanSalesTrends(dateRange: any) {
    const params = new URLSearchParams()
    if (dateRange.start_date) params.append('start_date', dateRange.start_date)
    if (dateRange.end_date) params.append('end_date', dateRange.end_date)

    const response = await this.get(`${this.baseUrl}/trends?${params.toString()}`)
    return response.data.data || response.data
  }

  async getVanSalesData(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}?${params.toString()}`)
    return response.data.data || response.data
  }

  async deleteVanSale(id: string) {
    const response = await this.delete(`${this.baseUrl}/${id}`)
    return response.data.data || response.data
  }

  async bulkUpdateVanSales(ids: string[], updates: any) {
    const response = await this.put(`${this.baseUrl}/bulk`, { ids, updates })
    return response.data.data || response.data
  }

  async importVanSalesData(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.post(`${this.baseUrl}/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data.data || response.data
  }

  // Route aliases (called by VanRoutesPage, RouteDetail, etc.)
  async getRoutes(filter: any = {}) {
    return this.getVanRoutes(filter)
  }

  async getRoute(id: string) {
    return this.getVanRoute(id)
  }

  async getRouteById(id: string) {
    return this.getVanRoute(id)
  }

  async deleteRoute(id: string) {
    return this.deleteVanRoute(id)
  }

  async getRouteStops(routeId: string) {
    const response = await this.get(`${this.baseUrl}/routes/${routeId}/stops`)
    return response.data.data || response.data
  }

  async getRouteExceptions(routeId: string) {
    const response = await this.get(`${this.baseUrl}/routes/${routeId}/exceptions`)
    return response.data.data || response.data
  }

  // Order aliases (called by VanOrderCreate, VanOrderDetail, etc.)
  async getOrders(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value as string))
      }
    })
    const response = await this.get(`${this.baseUrl}/orders?${params.toString()}`)
    return response.data.data || response.data
  }

  async getOrder(id: string) {
    const response = await this.get(`${this.baseUrl}/orders/${id}`)
    return response.data.data || response.data
  }

  async createOrder(data: any) {
    const response = await this.post(`${this.baseUrl}/orders/create`, data)
    return response.data.data || response.data
  }

  async createVanOrder(data: any) {
    return this.createOrder(data)
  }

  async updateOrder(id: string, data: any) {
    const response = await this.put(`${this.baseUrl}/orders/${id}`, data)
    return response.data.data || response.data
  }

  async reverseOrder(id: string) {
    const response = await this.post(`${this.baseUrl}/orders/${id}/reverse`)
    return response.data.data || response.data
  }

  async getVanOrders(filter: any = {}) {
    return this.getOrders(filter)
  }

  // Return aliases (called by VanReturnCreate, VanReturnDetail, etc.)
  async getReturns(filter: any = {}) {
    return this.getVanSalesReturns(filter)
  }

  async getReturn(id: string) {
    const response = await this.get(`${this.baseUrl}/returns/${id}`)
    return response.data.data || response.data
  }

  async createReturn(data: any) {
    return this.createVanSalesReturn(data)
  }

  // Customer & product lookups (called by VanOrderCreate, etc.)
  async getCustomers() {
    const response = await this.get('/customers')
    return response.data.data || response.data
  }

  async getProducts() {
    const response = await this.get('/products')
    return response.data.data || response.data
  }

  // Van load detail methods (called by VanLoadDetail, VanLoadConfirm, etc.)
  async getVanLoad(id: string) {
    const response = await this.get(`${this.baseUrl}/van-loads/${id}`)
    return response.data.data || response.data
  }

  async getVanLoadItems(loadId: string) {
    const response = await this.get(`${this.baseUrl}/van-loads/${loadId}/items`)
    return response.data.data || response.data
  }

  async confirmVanLoad(id: string, data?: any) {
    const response = await this.post(`${this.baseUrl}/van-loads/${id}/transition`, { new_status: 'confirmed', ...data })
    return response.data.data || response.data
  }

  // Cash reconciliation (called by CashReconciliation pages)
  async getCashReconciliations(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value as string))
      }
    })
    const response = await this.get(`${this.baseUrl}/cash-reconciliation?${params.toString()}`)
    return response.data.data || response.data
  }

  async getCashReconciliation(id: string) {
    const response = await this.get(`${this.baseUrl}/cash-reconciliation/${id}`)
    return response.data.data || response.data
  }

  async createCashReconciliation(data: any) {
    const response = await this.post(`${this.baseUrl}/cash-reconciliation`, data)
    return response.data.data || response.data
  }

  async getVanCashCollection(vanId: string) {
    const response = await this.get(`${this.baseUrl}/vans/${vanId}/cash-collection`)
    return response.data.data || response.data
  }
}

export const vanSalesService = new VanSalesService()
