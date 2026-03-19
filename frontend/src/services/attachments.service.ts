/**
 * Attachments Service
 * Handles file attachments for all entity types
 */

import { apiClient } from './api.service'

export interface Attachment {
  id: string
  entity_type: string
  entity_id: string
  file_name: string
  file_type: string
  file_size: number
  file_url: string
  uploaded_by: string
  uploaded_by_name?: string
  uploaded_at: string
  description?: string
  tags?: string[]
  tenant_id: string
  created_at: string
}

class AttachmentsService {
  private readonly baseUrl = '/uploads'

  async getAttachments(entityType: string, entityId: string): Promise<Attachment[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${entityType}/${entityId}`)
      return response.data.data?.files || []
    } catch (error) {
      console.error('Failed to fetch attachments:', error)
      return []
    }
  }

  async getAttachment(entityType: string, entityId: string, attachmentId: string): Promise<Attachment | null> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${attachmentId}`)
      return response.data.data?.file || null
    } catch (error) {
      console.error('Failed to fetch attachment:', error)
      return null
    }
  }

  async uploadAttachment(entityType: string, entityId: string, file: File, metadata?: { description?: string; tags?: string[] }): Promise<Attachment> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entity_type', entityType)
      formData.append('entity_id', entityId)
      if (metadata?.description) {
        formData.append('description', metadata.description)
      }
      if (metadata?.tags) {
        formData.append('tags', JSON.stringify(metadata.tags))
      }

      const response = await apiClient.post(this.baseUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data.data?.file || response.data.data
    } catch (error) {
      console.error('Failed to upload attachment:', error)
      throw error
    }
  }

  async updateAttachmentMetadata(attachmentId: string, metadata: { description?: string; tags?: string[]; category?: string }): Promise<Attachment> {
    try {
      const response = await apiClient.patch(`${this.baseUrl}/${attachmentId}/metadata`, metadata)
      return response.data.data?.file || response.data.data
    } catch (error) {
      console.error('Failed to update attachment metadata:', error)
      throw error
    }
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/${attachmentId}`)
    } catch (error) {
      console.error('Failed to delete attachment:', error)
      throw error
    }
  }
}

export const attachmentsService = new AttachmentsService()
