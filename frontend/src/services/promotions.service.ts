import { ApiService } from './api.service'

export interface Promotion {
  id: string
  name: string
  description: string
  type: 'discount' | 'bogo' | 'bundle' | 'cashback' | 'loyalty'
  status: 'draft' | 'active' | 'paused' | 'expired'
  start_date: string
  end_date: string
  target_audience: string[]
  conditions: PromotionCondition[]
  rewards: PromotionReward[]
  budget: number
  spent: number
  usage_count: number
  usage_limit?: number
  created_at: string
  updated_at: string
  created_by: string
}

export interface PromotionCondition {
  type: 'minimum_purchase' | 'product_category' | 'customer_type' | 'location' | 'quantity'
  operator: 'equals' | 'greater_than' | 'less_than' | 'in' | 'not_in'
  value: string | number | string[]
}

export interface PromotionReward {
  type: 'percentage_discount' | 'fixed_discount' | 'free_product' | 'cashback' | 'points'
  value: number
  product_id?: string
  max_discount?: number
}

export interface PromotionFilter {
  search?: string
  status?: string
  type?: string
  start_date?: string
  end_date?: string
  created_by?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface PromotionStats {
  total_promotions: number
  active_promotions: number
  total_budget: number
  total_spent: number
  total_usage: number
  conversion_rate: number
  roi: number
  top_performing: Promotion[]
  performance_by_type: TypePerformance[]
  usage_trends: TimeSeries[]
}

export interface TypePerformance {
  type: string
  count: number
  budget: number
  spent: number
  usage: number
  roi: number
}

export interface TimeSeries {
  date: string
  value: number
  label?: string
}

export interface PromotionAnalytics {
  promotion_id: string
  impressions: number
  clicks: number
  conversions: number
  revenue_generated: number
  cost: number
  roi: number
  conversion_rate: number
  click_through_rate: number
  daily_performance: TimeSeries[]
  audience_breakdown: AudienceBreakdown[]
}

export interface AudienceBreakdown {
  segment: string
  impressions: number
  conversions: number
  revenue: number
}

class PromotionsService extends ApiService {
  private baseUrl = '/promotions'

  async getPromotions(filter: PromotionFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getPromotion(id: string) {
    const response = await this.get(`${this.baseUrl}/${id}`)
    return response.data?.data || response.data
  }

  async createPromotion(promotion: Omit<Promotion, 'id' | 'created_at' | 'updated_at' | 'usage_count' | 'spent'>) {
    const response = await this.post(this.baseUrl, promotion)
    return response.data?.data || response.data
  }

  async updatePromotion(id: string, promotion: Partial<Promotion>) {
    const response = await this.put(`${this.baseUrl}/${id}`, promotion)
    return response.data?.data || response.data
  }

  async deletePromotion(id: string) {
    const response = await this.delete(`${this.baseUrl}/${id}`)
    return response.data?.data || response.data
  }

  async activatePromotion(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/activate`)
    return response.data?.data || response.data
  }

  async deactivatePromotion(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/deactivate`)
    return response.data?.data || response.data
  }

  async pausePromotion(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/pause`)
    return response.data?.data || response.data
  }

  async getPromotionStats(filter: PromotionFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getPromotionAnalytics(id: string, filter: { start_date?: string; end_date?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/${id}/analytics?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getPromotionTrends(filter: { start_date?: string; end_date?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/trends?${params.toString()}`)
    return response.data?.data || response.data
  }

  async duplicatePromotion(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/duplicate`)
    return response.data?.data || response.data
  }

  async bulkUpdatePromotions(ids: string[], updates: Partial<Promotion>) {
    const response = await this.put(`${this.baseUrl}/bulk`, { ids, updates })
    return response.data?.data || response.data
  }

  async bulkDeletePromotions(ids: string[]) {
    const response = await this.delete(`${this.baseUrl}/bulk`, { data: { ids } })
    return response.data?.data || response.data
  }

  async exportPromotions(format: 'excel' | 'csv' = 'excel', filter: PromotionFilter = {}) {
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
    link.download = `promotions-export-${Date.now()}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  async importPromotions(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.post(`${this.baseUrl}/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data?.data || response.data
  }

  async validatePromotion(promotion: Partial<Promotion>) {
    const response = await this.post(`${this.baseUrl}/validate`, promotion)
    return response.data?.data || response.data
  }

  async getPromotionTemplates() {
    const response = await this.get(`${this.baseUrl}/templates`)
    return response.data?.data || response.data
  }

  async createFromTemplate(templateId: string, customizations: Partial<Promotion>) {
    const response = await this.post(`${this.baseUrl}/templates/${templateId}/create`, customizations)
    return response.data?.data || response.data
  }

  async exportPromotionReport(format: 'pdf' | 'excel' | 'csv' = 'excel', filter: any = {}) {
    const params = new URLSearchParams()
    params.append('format', format)
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/export?${params.toString()}`, {
      responseType: 'blob'
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `promotions-report.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    return response.data?.data || response.data
  }
}

export const promotionsService = new PromotionsService()