/**
 * Commissions Service
 * Handles commission tracking and calculations
 */

import { apiClient } from './api.service'
import { API_CONFIG } from '../config/api.config'

export interface Commission {
  id: string
  tenant_id: string
  user_id: string
  order_id?: string
  commission_amount: number
  base_amount: number
  commission_rate: number
  status: 'pending' | 'paid' | 'cancelled'
  payment_date?: string
  notes?: string
  created_at: string
  user?: {
    id: string
    name: string
    role: string
  }
}

export interface CommissionRule {
  id: string
  tenant_id: string
  name: string
  rule_type: 'percentage' | 'fixed' | 'tiered'
  value: number
  conditions?: any
  status: 'active' | 'inactive'
  created_at: string
}

export interface CommissionStats {
  total_commissions: number
  pending_commissions: number
  approved_commissions: number
  paid_commissions: number
  total_amount: number
  pending_amount: number
  approved_amount: number
  paid_amount: number
  top_earners: Array<{
    name: string
    role: string
    total_commission: number
    transaction_count: number
  }>
  commissions_by_type: Array<{
    type: string
    amount: number
    count: number
  }>
}

class CommissionsService {
  private readonly baseUrl = API_CONFIG.ENDPOINTS.COMMISSIONS.BASE
  // Build full URL using centralized config

  async getCommissions(filter?: any): Promise<{ commissions: Commission[], total: number }> {
    try {
      const response = await apiClient.get(this.baseUrl, { params: filter })
      return {
        commissions: response.data.data?.commissions || response.data.data || [],
        total: response.data.data?.pagination?.total || 0
      }
    } catch (error) {
      console.error('Failed to fetch commissions:', error)
      throw error
    }
  }

  async getCommission(id: string): Promise<Commission> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${id}`)
      return response.data.data
    } catch (error) {
      console.error('Failed to fetch commission:', error)
      throw error
    }
  }

  async createCommission(commission: Partial<Commission>): Promise<Commission> {
    try {
      const response = await apiClient.post(this.baseUrl, commission)
      return response.data.data
    } catch (error) {
      console.error('Failed to create commission:', error)
      throw error
    }
  }

  async updateCommission(id: string, updates: Partial<Commission>): Promise<Commission> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/${id}`, updates)
      return response.data.data
    } catch (error) {
      console.error('Failed to update commission:', error)
      throw error
    }
  }

  async deleteCommission(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id}`)
    } catch (error) {
      console.error('Failed to delete commission:', error)
      throw error
    }
  }

  async getCommissionStats(dateRange?: { start: string; end: string }): Promise<CommissionStats> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/stats`, { params: dateRange })
      return response.data.data
    } catch (error) {
      console.error('Failed to fetch commission stats:', error)
      throw error
    }
  }

  async getUserCommissions(userId: string, filter?: any): Promise<{ commissions: Commission[], total: number }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/user/${userId}`, { params: filter })
      return {
        commissions: response.data.data?.commissions || response.data.data || [],
        total: response.data.data?.pagination?.total || 0
      }
    } catch (error) {
      console.error('Failed to fetch user commissions:', error)
      throw error
    }
  }

  async calculateCommission(orderId: string): Promise<{ amount: number, details: any }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/calculate`, { order_id: orderId })
      return response.data.data
    } catch (error) {
      console.error('Failed to calculate commission:', error)
      throw error
    }
  }

  async payCommissions(commissionIds: string[]): Promise<void> {
    try {
      await apiClient.post(`${this.baseUrl}/pay`, { commission_ids: commissionIds })
    } catch (error) {
      console.error('Failed to pay commissions:', error)
      throw error
    }
  }

  // Commission Rules
  async getRules(): Promise<CommissionRule[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/rules`)
      return response.data.data || []
    } catch (error) {
      console.error('Failed to fetch commission rules:', error)
      return []
    }
  }

  async createRule(rule: Partial<CommissionRule>): Promise<CommissionRule> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/rules`, rule)
      return response.data.data
    } catch (error) {
      console.error('Failed to create commission rule:', error)
      throw error
    }
  }

  async updateRule(id: string, updates: Partial<CommissionRule>): Promise<CommissionRule> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/rules/${id}`, updates)
      return response.data.data
    } catch (error) {
      console.error('Failed to update commission rule:', error)
      throw error
    }
  }

  async deleteRule(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/rules/${id}`)
    } catch (error) {
      console.error('Failed to delete commission rule:', error)
      throw error
    }
  }

  async getPayoutLines(payoutId: string): Promise<any[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/payouts/${payoutId}/lines`)
      return response.data.data?.lines || []
    } catch (error) {
      console.error('Failed to fetch payout lines:', error)
      throw error
    }
  }

  async getPayoutAuditTrail(payoutId: string, lineId: string): Promise<any[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/payouts/${payoutId}/lines/${lineId}/audit`)
      return response.data.data?.audit || []
    } catch (error) {
      console.error('Failed to fetch payout audit trail:', error)
      throw error
    }
  }

  async getAgentCalculations(agentId: string): Promise<any[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/agents/${agentId}/calculations`)
      return response.data.data?.calculations || []
    } catch (error) {
      console.error('Failed to fetch agent calculations:', error)
      throw error
    }
  }

  async getPayoutSourceTransactions(payoutId: string, lineId: string): Promise<any[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/payouts/${payoutId}/lines/${lineId}/transactions`)
      return response.data.data?.transactions || []
    } catch (error) {
      console.error('Failed to fetch payout source transactions:', error)
      throw error
    }
  }

  // Commission Lifecycle Methods - matching new backend endpoints
  async getCommissionDetail(id: string): Promise<CommissionDetail> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${id}`)
      return response.data.data
    } catch (error) {
      console.error('Failed to fetch commission detail:', error)
      throw error
    }
  }

  async createCommissionRecord(data: {
    agent_id: string
    period_start: string
    period_end: string
    notes?: string
  }): Promise<Commission> {
    try {
      const response = await apiClient.post(this.baseUrl, data)
      return response.data.data
    } catch (error) {
      console.error('Failed to create commission record:', error)
      throw error
    }
  }

  async calculateCommissionRecord(id: string): Promise<Commission> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/${id}/calculate`)
      return response.data.data
    } catch (error) {
      console.error('Failed to calculate commission:', error)
      throw error
    }
  }

  async approveCommission(id: string): Promise<Commission> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/${id}/approve`)
      return response.data.data
    } catch (error) {
      console.error('Failed to approve commission:', error)
      throw error
    }
  }

  async payCommission(id: string, data: {
    payment_reference?: string
    payment_method?: string
    notes?: string
  }): Promise<Commission> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/${id}/pay`, data)
      return response.data.data
    } catch (error) {
      console.error('Failed to pay commission:', error)
      throw error
    }
  }

  async reverseCommission(id: string, reason: string): Promise<Commission> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/${id}/reverse`, { reversal_reason: reason })
      return response.data.data
    } catch (error) {
      console.error('Failed to reverse commission:', error)
      throw error
    }
  }

  // The /commission-earnings/* endpoints are the post-audit commission lifecycle surface
  // (dispute / reverse / reject with reason). They live alongside the older /commissions/*
  // family until that one is consolidated; both target commission_earnings rows.
  async getMyCommissionEarnings(status?: string): Promise<any[]> {
    try {
      const params: Record<string, string> = {}
      if (status) params.status = status
      const response = await apiClient.get('/commission-earnings/my', { params })
      const data = response.data?.data
      if (Array.isArray(data)) return data
      if (Array.isArray(data?.earnings)) return data.earnings
      return []
    } catch (error) {
      console.error('Failed to fetch my commission earnings:', error)
      throw error
    }
  }

  async disputeCommissionEarning(id: string, reason: string): Promise<void> {
    try {
      await apiClient.post(`/commission-earnings/${id}/dispute`, { reason })
    } catch (error) {
      console.error('Failed to dispute commission earning:', error)
      throw error
    }
  }

  async reverseCommissionEarning(id: string, reason: string): Promise<void> {
    try {
      await apiClient.post(`/commission-earnings/${id}/reverse`, { reason })
    } catch (error) {
      console.error('Failed to reverse commission earning:', error)
      throw error
    }
  }

  async getCommissionStatsSummary(): Promise<CommissionStatsSummary> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/stats`)
      return response.data.data
    } catch (error) {
      console.error('Failed to fetch commission stats:', error)
      throw error
    }
  }
}

// Additional interfaces for new endpoints
export interface CommissionDetail extends Omit<Commission, 'base_amount'> {
  items?: CommissionItem[]
  agent_name?: string
  period_start?: string
  period_end?: string
  base_amount?: number
  bonus_amount?: number
  deductions?: number
  total_amount?: number
  calculated_at?: string
  approved_by?: string
  approved_at?: string
  paid_by?: string
  paid_at?: string
  payment_reference?: string
  payment_method?: string
  reversal_reason?: string
  reversed_by?: string
  reversed_at?: string
}

export interface CommissionItem {
  id: string
  commission_id: string
  order_id?: string
  order_amount: number
  commission_rate: number
  commission_amount: number
  notes?: string
  created_at: string
}

export interface CommissionStatsSummary {
  total_commissions: number
  pending_count: number
  calculated_count: number
  approved_count: number
  paid_count: number
  reversed_count: number
  total_pending_amount: number
  total_paid_amount: number
}

export const commissionsService = new CommissionsService()
