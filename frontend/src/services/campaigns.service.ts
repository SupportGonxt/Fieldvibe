import { ApiService } from './api.service'

export interface Campaign {
  id: string
  tenant_id: string
  name: string
  description?: string
  type: 'promotion' | 'awareness' | 'product_launch' | 'seasonal' | 'loyalty'
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
  start_date: string
  end_date: string
  budget: number
  spent_amount: number
  target_audience?: string
  objectives: string[]
  kpis: CampaignKPI[]
  channels: string[]
  materials: CampaignMaterial[]
  created_by: string
  created_at: string
  updated_at: string
  performance_metrics: CampaignMetrics
}

export interface CampaignKPI {
  id: string
  name: string
  target_value: number
  current_value: number
  unit: string
  description?: string
}

export interface CampaignMaterial {
  id: string
  name: string
  type: 'image' | 'video' | 'document' | 'audio'
  url: string
  file_size: number
  created_at: string
}

export interface CampaignMetrics {
  impressions: number
  reach: number
  engagement_rate: number
  conversion_rate: number
  cost_per_acquisition: number
  return_on_investment: number
  clicks: number
  leads_generated: number
  sales_generated: number
}

export interface CampaignExecution {
  id: string
  campaign_id: string
  agent_id: string
  agent_name: string
  location: string
  latitude?: number
  longitude?: number
  execution_date: string
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  activities: CampaignActivity[]
  notes?: string
  photos: string[]
  created_at: string
  updated_at: string
}

export interface CampaignActivity {
  id: string
  type: 'board_placement' | 'product_demo' | 'sampling' | 'survey' | 'promotion'
  description: string
  duration_minutes: number
  participants_count: number
  materials_used: string[]
  results: any
  completed_at?: string
}

export interface CampaignFilter {
  search?: string
  type?: string
  status?: string
  created_by?: string
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface CampaignStats {
  total_campaigns: number
  active_campaigns: number
  completed_campaigns: number
  total_budget: number
  total_spent: number
  average_roi: number
  top_performing_campaigns: Campaign[]
}

class CampaignsService extends ApiService {
  private baseUrl = '/campaigns'

  async getCampaigns(filter: CampaignFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getCampaign(id: string) {
    const response = await this.get(`${this.baseUrl}/${id}`)
    return response.data?.data || response.data
  }

  async createCampaign(campaign: Partial<Campaign>) {
    const response = await this.post(this.baseUrl, campaign)
    return response.data?.data || response.data
  }

  async updateCampaign(id: string, campaign: Partial<Campaign>) {
    const response = await this.put(`${this.baseUrl}/${id}`, campaign)
    return response.data?.data || response.data
  }

  async deleteCampaign(id: string) {
    const response = await this.delete(`${this.baseUrl}/${id}`)
    return response.data?.data || response.data
  }

  async getCampaignStats() {
    const response = await this.get(`${this.baseUrl}/stats`)
    return response.data?.data || response.data
  }

  async getCampaignAnalytics(id: string) {
    const response = await this.get(`${this.baseUrl}/${id}/analytics`)
    return response.data?.data || response.data
  }

  async getCampaignExecutions(campaignId: string, filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/${campaignId}/executions?${params.toString()}`)
    return response.data?.data || response.data
  }

  async createCampaignExecution(campaignId: string, execution: Partial<CampaignExecution>) {
    const response = await this.post(`${this.baseUrl}/${campaignId}/executions`, execution)
    return response.data?.data || response.data
  }

  async updateCampaignExecution(campaignId: string, executionId: string, execution: Partial<CampaignExecution>) {
    const response = await this.put(`${this.baseUrl}/${campaignId}/executions/${executionId}`, execution)
    return response.data?.data || response.data
  }

  async uploadCampaignMaterial(campaignId: string, file: File, type: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    const response = await this.post(`${this.baseUrl}/${campaignId}/materials`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data?.data || response.data
  }

  async deleteCampaignMaterial(campaignId: string, materialId: string) {
    const response = await this.delete(`${this.baseUrl}/${campaignId}/materials/${materialId}`)
    return response.data?.data || response.data
  }

  async startCampaign(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/start`)
    return response.data?.data || response.data
  }

  async pauseCampaign(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/pause`)
    return response.data?.data || response.data
  }

  async completeCampaign(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/complete`)
    return response.data?.data || response.data
  }

  async cancelCampaign(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/cancel`)
    return response.data?.data || response.data
  }

  async duplicateCampaign(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/duplicate`)
    return response.data?.data || response.data
  }

  async exportCampaignReport(id: string, format: 'pdf' | 'excel' = 'pdf') {
    const response = await this.get(`${this.baseUrl}/${id}/export?format=${format}`, {
      responseType: 'blob'
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `campaign-report-${id}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
}

export const campaignsService = new CampaignsService()