import { API_CONFIG } from '../config/api.config'
import { apiClient } from './api.service'

/**
 * Reports Service
 * Handles report generation and analytics
 */

export interface Report {
  id: string
  tenant_id: string
  report_type: string
  report_name: string
  generated_by: string
  generated_at: string
  status: 'pending' | 'completed' | 'failed'
  file_path?: string
  file_size?: number
  parameters?: any
}

export interface ReportTemplate {
  id: string
  name: string
  type: string
  description: string
  parameters: any[]
  format: 'pdf' | 'excel' | 'csv'
}

export interface ReportStats {
  total_reports: number
  completed_reports: number
  pending_reports: number
  failed_reports: number
  recent_reports: Report[]
  popular_types: Array<{
    type: string
    count: number
  }>
}

class ReportsService {
  private readonly baseUrl = API_CONFIG.ENDPOINTS.REPORTS.BASE
  // Build full URL using centralized config

  async getReports(filter?: any): Promise<{ reports: Report[], total: number }> {
    try {
      const response = await apiClient.get(this.baseUrl, { params: filter })
      return {
        reports: response.data.data?.reports || response.data.data || [],
        total: response.data.data?.pagination?.total || 0
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error)
      throw error
    }
  }

  async getReport(id: string): Promise<Report> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${id}`)
      return response.data.data
    } catch (error) {
      console.error('Failed to fetch report:', error)
      throw error
    }
  }

  async generateReport(params: {
    report_type: string
    parameters?: any
    format?: 'pdf' | 'excel' | 'csv'
  }): Promise<Report> {
    try {
      const response = await apiClient.post(this.baseUrl, params)
      return response.data.data
    } catch (error) {
      console.error('Failed to generate report:', error)
      throw error
    }
  }

  async downloadReport(reportId: string): Promise<Blob> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${reportId}/download`, {
        responseType: 'blob'
      })
      return response.data
    } catch (error) {
      console.error('Failed to download report:', error)
      throw error
    }
  }

  async deleteReport(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id}`)
    } catch (error) {
      console.error('Failed to delete report:', error)
      throw error
    }
  }

  async getReportStats(): Promise<ReportStats> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/stats`)
      return response.data.data
    } catch (error) {
      console.error('Failed to fetch report stats:', error)
      throw error
    }
  }

  async getTemplates(): Promise<ReportTemplate[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/templates`)
      return response.data.data || []
    } catch (error) {
      console.error('Failed to fetch report templates:', error)
      return []
    }
  }

  async scheduleReport(params: {
    report_type: string
    schedule: string // cron expression
    parameters?: any
    format?: 'pdf' | 'excel' | 'csv'
    recipients?: string[]
  }): Promise<any> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/schedule`, params)
      return response.data.data
    } catch (error) {
      console.error('Failed to schedule report:', error)
      throw error
    }
  }

  // Specific report types
  async generateSalesReport(params: {
    date_from: string
    date_to: string
    group_by?: 'day' | 'week' | 'month'
  }): Promise<any> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/sales`, params)
      return response.data.data
    } catch (error) {
      console.error('Failed to generate sales report:', error)
      throw error
    }
  }

  async generateInventoryReport(params?: any): Promise<any> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/inventory`, params)
      return response.data.data
    } catch (error) {
      console.error('Failed to generate inventory report:', error)
      throw error
    }
  }

  async generateCustomerReport(params?: any): Promise<any> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/customers`, params)
      return response.data.data
    } catch (error) {
      console.error('Failed to generate customer report:', error)
      throw error
    }
  }

  async generateFinancialReport(params: {
    date_from: string
    date_to: string
    type: 'income' | 'expenses' | 'profit_loss' | 'balance_sheet'
  }): Promise<any> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/financial`, params)
      return response.data.data
    } catch (error) {
      console.error('Failed to generate financial report:', error)
      throw error
    }
  }

  async getSalesReport(reportType: string, filters: Record<string, any>): Promise<{ data: any[] }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/sales/${reportType}`, { params: filters })
      return { data: response.data.data || [] }
    } catch (error) {
      console.error(`Failed to fetch sales ${reportType} report:`, error)
      return { data: [] }
    }
  }

  async getFieldOperationsReport(reportType: string, filters: Record<string, any>): Promise<{ data: any[] }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/field-operations/${reportType}`, { params: filters })
      return { data: response.data.data || [] }
    } catch (error) {
      console.error(`Failed to fetch field operations ${reportType} report:`, error)
      return { data: [] }
    }
  }

  async getInventoryReport(reportType: string, filters: Record<string, any>): Promise<{ data: any[] }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/inventory/${reportType}`, { params: filters })
      return { data: response.data.data || [] }
    } catch (error) {
      console.error(`Failed to fetch inventory ${reportType} report:`, error)
      return { data: [] }
    }
  }

  async getFinanceReport(reportType: string, filters: Record<string, any>): Promise<{ data: any[] }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/finance/${reportType}`, { params: filters })
      return { data: response.data.data || [] }
    } catch (error) {
      console.error(`Failed to fetch finance ${reportType} report:`, error)
      return { data: [] }
    }
  }

  async exportReport(module: string, reportType: string, format: 'csv' | 'excel' | 'pdf', filters: Record<string, any>): Promise<void> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${module}/${reportType}/export`, {
        params: { ...filters, format },
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${module}-${reportType}-${Date.now()}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export report:', error)
      throw error
    }
  }
}

export const reportsService = new ReportsService()
