import { ApiService } from './api.service'

export type SurveyModule = 'field_ops' | 'marketing' | 'promotions' | 'van_sales' | 'inventory' | 'general'

export interface Survey {
  id: string
  tenant_id: string
  title: string
  name?: string
  description?: string
  type: 'customer_satisfaction' | 'market_research' | 'product_feedback' | 'brand_awareness' | 'custom'
  module: SurveyModule
  is_mandatory: boolean
  questions: SurveyQuestion[]
  status: 'draft' | 'active' | 'completed' | 'archived'
  is_active?: boolean
  start_date?: string
  end_date?: string
  target_audience?: string
  target_type?: string
  target_responses?: number
  response_rate?: number
  created_by: string
  created_at: string
  updated_at: string
  response_count: number
  completion_rate: number
}

export interface SurveyQuestion {
  id: string
  survey_id: string
  question_text: string
  question_type: 'text' | 'multiple_choice' | 'rating' | 'yes_no' | 'date'
  options?: string[]
  required: boolean
  order_index: number
}

export interface SurveyResponse {
  id: string
  survey_id: string
  respondent_id: string
  respondent_name?: string
  answers: SurveyAnswer[]
  status: 'in_progress' | 'completed'
  started_at: string
  completed_at?: string
  completion_time_minutes?: number
}

export interface SurveyAnswer {
  question_id: string
  answer_text?: string
  answer_value?: number
  selected_options?: string[]
}

export interface SurveyFilter {
  search?: string
  status?: string
  type?: string
  created_by?: string
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface SurveyStats {
  total_surveys: number
  active_surveys: number
  completed_surveys: number
  total_responses: number
  average_completion_rate: number
  recent_surveys: Survey[]
}

class SurveysService extends ApiService {
  private baseUrl = '/surveys'

  async getSurveys(filter: SurveyFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getSurvey(id: string) {
    const response = await this.get(`${this.baseUrl}/${id}`)
    return response.data?.data || response.data
  }

  async createSurvey(survey: Partial<Survey>) {
    const response = await this.post(this.baseUrl, survey)
    return response.data?.data || response.data
  }

  async updateSurvey(id: string, survey: Partial<Survey>) {
    const response = await this.put(`${this.baseUrl}/${id}`, survey)
    return response.data?.data || response.data
  }

  async deleteSurvey(id: string) {
    const response = await this.delete(`${this.baseUrl}/${id}`)
    return response.data?.data || response.data
  }

  async getSurveyResponses(surveyId: string, filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/${surveyId}/responses?${params.toString()}`)
    return response.data?.data || response.data
  }

  async submitSurveyResponse(surveyId: string, response: Partial<SurveyResponse>) {
    const apiResponse = await this.post(`${this.baseUrl}/${surveyId}/responses`, response)
    return apiResponse.data
  }



  async exportSurveyResponses(surveyId: string, format: 'csv' | 'excel' = 'csv') {
    const response = await this.get(`${this.baseUrl}/${surveyId}/export?format=${format}`, {
      responseType: 'blob'
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `survey-responses-${surveyId}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  async duplicateSurvey(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/duplicate`)
    return response.data?.data || response.data
  }

  async publishSurvey(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/publish`)
    return response.data?.data || response.data
  }

  async archiveSurvey(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/archive`)
    return response.data?.data || response.data
  }

  // Additional methods for missing functionality
  async getSurveyStats(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getSurveyAnalytics(id: string, filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/${id}/analytics?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getSurveyTrends(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/trends?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getSurveyInsights(id: string) {
    const response = await this.get(`${this.baseUrl}/${id}/insights`)
    return response.data?.data || response.data
  }

  async getSurveyMetrics(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/metrics?${params.toString()}`)
    return response.data?.data || response.data
  }

  async getSurveyReports(type: string, filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    params.append('type', type)

    const response = await this.get(`${this.baseUrl}/reports?${params.toString()}`)
    return response.data?.data || response.data
  }

  async activateSurvey(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/activate`)
    return response.data?.data || response.data
  }

  async deactivateSurvey(id: string) {
    const response = await this.post(`${this.baseUrl}/${id}/deactivate`)
    return response.data?.data || response.data
  }

  async exportSurveyReport(surveyId: string, format: 'pdf' | 'excel' = 'pdf') {
    const response = await this.get(`${this.baseUrl}/${surveyId}/report?format=${format}`, {
      responseType: 'blob'
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `survey-report-${surveyId}-${Date.now()}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
}

export const surveysService = new SurveysService()
