/**
 * Audit Service
 * Handles audit trail operations for all entity types
 */

import { apiClient } from './api.service'

export interface AuditEntry {
  id: string
  entity_type: string
  entity_id: string
  entity_name?: string
  action: string
  description: string
  performed_by: string
  performed_by_name?: string
  performed_at: string
  details?: Record<string, any>
  tenant_id: string
  created_at: string
  field_changed?: string
  old_value?: string
  new_value?: string
  changed_by?: string
  changed_by_role?: string
  changed_by_email?: string
  changed_at?: string
  ip_address?: string
  session_id?: string
  request_id?: string
  user_agent?: string
  location?: { latitude: number; longitude: number }
  notes?: string
  metadata?: Record<string, any>
}

class AuditService {
  private readonly baseUrl = '/audit'

  async getAuditTrail(entityType: string, entityId: string): Promise<AuditEntry[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${entityType}/${entityId}`)
      return response.data.data?.auditTrail || []
    } catch (error) {
      console.error('Failed to fetch audit trail:', error)
      return []
    }
  }

  async getAuditEntry(entityType: string, entityId: string, entryId: string): Promise<AuditEntry | null> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${entityType}/${entityId}/entries/${entryId}`)
      return response.data.data?.entry || null
    } catch (error) {
      console.error('Failed to fetch audit entry:', error)
      return null
    }
  }

  // Generic audit log listing (called by AuditLogPage)
  async getLogs(params?: any): Promise<AuditEntry[]> {
    try {
      const response = await apiClient.get('/audit-log', { params })
      return response.data.data || response.data || []
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
      return []
    }
  }
}

export const auditService = new AuditService()
