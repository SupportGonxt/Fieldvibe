import apiClient from './api'

export const returnsService = {
  async getReturns(filter?: any) {
    try {
      const response = await apiClient.get('/returns', { params: filter })
      return response.data
    } catch (error) {
      console.error('Error fetching returns:', error)
      throw error
    }
  },

  async getReturnById(id: string) {
    try {
      const response = await apiClient.get(`/returns/${id}`)
      return response.data
    } catch (error) {
      console.error('Error fetching return:', error)
      throw error
    }
  },

  async createReturn(data: any) {
    try {
      const response = await apiClient.post('/returns', data)
      return response.data
    } catch (error) {
      console.error('Error creating return:', error)
      throw error
    }
  },

  async approveReturn(id: string) {
    try {
      const response = await apiClient.put(`/returns/${id}/approve`)
      return response.data
    } catch (error) {
      console.error('Error approving return:', error)
      throw error
    }
  },

  async rejectReturn(id: string, reason: string) {
    try {
      const response = await apiClient.put(`/returns/${id}/reject`, { reason })
      return response.data
    } catch (error) {
      console.error('Error rejecting return:', error)
      throw error
    }
  },

  async generateCreditNote(id: string) {
    try {
      const response = await apiClient.post(`/returns/${id}/credit-note`)
      return response.data
    } catch (error) {
      console.error('Error generating credit note:', error)
      throw error
    }
  }
}
