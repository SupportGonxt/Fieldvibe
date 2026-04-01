import apiClient from './api'

export const refundsService = {
  async getRefunds(filter?: any) {
    try {
      const response = await apiClient.get('/refunds', { params: filter })
      return response.data?.data || response.data
    } catch (error) {
      console.error('Error fetching refunds:', error)
      throw error
    }
  },

  async getRefundById(id: string) {
    try {
      const response = await apiClient.get(`/refunds/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      console.error('Error fetching refund:', error)
      throw error
    }
  },

  async createRefund(data: any) {
    try {
      const response = await apiClient.post('/refunds', data)
      return response.data?.data || response.data
    } catch (error) {
      console.error('Error creating refund:', error)
      throw error
    }
  },

  async processRefund(id: string, data: any) {
    try {
      const response = await apiClient.post(`/refunds/${id}/process`, data)
      return response.data?.data || response.data
    } catch (error) {
      console.error('Error processing refund:', error)
      throw error
    }
  }
}
