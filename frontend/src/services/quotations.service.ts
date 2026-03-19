import apiClient from './api'

export const quotationsService = {
  async getQuotations(filter?: any) {
    try {
      const response = await apiClient.get('/quotations', { params: filter })
      return response.data
    } catch (error) {
      console.error('Error fetching quotations:', error)
      throw error
    }
  },

  async getQuotationById(id: string) {
    try {
      const response = await apiClient.get(`/quotations/${id}`)
      return response.data
    } catch (error) {
      console.error('Error fetching quotation:', error)
      throw error
    }
  },

  async createQuotation(data: any) {
    try {
      const response = await apiClient.post('/quotations', data)
      return response.data
    } catch (error) {
      console.error('Error creating quotation:', error)
      throw error
    }
  },

  async updateQuotation(id: string, data: any) {
    try {
      const response = await apiClient.put(`/quotations/${id}`, data)
      return response.data
    } catch (error) {
      console.error('Error updating quotation:', error)
      throw error
    }
  },

  async approveQuotation(id: string) {
    try {
      const response = await apiClient.post(`/quotations/${id}/approve`)
      return response.data
    } catch (error) {
      console.error('Error approving quotation:', error)
      throw error
    }
  },

  async rejectQuotation(id: string, reason: string) {
    try {
      const response = await apiClient.post(`/quotations/${id}/reject`, { reason })
      return response.data
    } catch (error) {
      console.error('Error rejecting quotation:', error)
      throw error
    }
  },

  async convertToOrder(id: string) {
    try {
      const response = await apiClient.post(`/quotations/${id}/convert`)
      return response.data
    } catch (error) {
      console.error('Error converting quotation to order:', error)
      throw error
    }
  }
}
