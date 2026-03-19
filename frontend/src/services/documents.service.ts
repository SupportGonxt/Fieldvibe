/**
 * Documents Service
 * Handles document relationships between entities
 */

import { apiClient } from './api.service'

export interface DocumentRelationship {
  id: string
  source_entity_type: string
  source_entity_id: string
  source_entity_number?: string
  relationship_type: string
  related_entity_type: string
  related_entity_id: string
  related_entity_number?: string
  created_by: string
  created_by_name?: string
  created_at: string
  description?: string
  tenant_id: string
}

class DocumentsService {
  private readonly baseUrl = '/documents'

  async getRelatedDocuments(entityType: string, entityId: string): Promise<DocumentRelationship[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${entityType}/${entityId}/relationships`)
      return response.data.data?.relationships || []
    } catch (error) {
      console.error('Failed to fetch related documents:', error)
      return []
    }
  }

  async getRelationship(entityType: string, entityId: string, relationshipId: string): Promise<DocumentRelationship | null> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${entityType}/${entityId}/relationships/${relationshipId}`)
      return response.data.data?.relationship || null
    } catch (error) {
      console.error('Failed to fetch relationship:', error)
      return null
    }
  }

  async createRelationship(data: Partial<DocumentRelationship>): Promise<DocumentRelationship> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/relationships`, data)
      return response.data.data?.relationship || response.data.data
    } catch (error) {
      console.error('Failed to create relationship:', error)
      throw error
    }
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/relationships/${relationshipId}`)
    } catch (error) {
      console.error('Failed to delete relationship:', error)
      throw error
    }
  }
}

export const documentsService = new DocumentsService()
