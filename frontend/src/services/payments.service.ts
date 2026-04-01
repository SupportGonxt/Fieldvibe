import { apiClient } from './api'

export interface Payment {
  id: string
  order_id?: string
  customer_id?: string
  amount: number
  payment_method: string
  payment_date: string
  reference?: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  processed_by?: string
  notes?: string
  order_total?: number
  created_at?: string
  updated_at?: string
}

export interface PaymentFormData {
  order_id?: string
  customer_id?: string
  amount: number
  payment_method: string
  payment_date: string
  reference?: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  notes?: string
}

export const paymentService = {
  async getPayments(params?: { order_id?: string; customer_id?: string; status?: string }): Promise<Payment[]> {
    const response = await apiClient.get('/payments', { params })
    return response.data?.data || response.data
  },

  async getPayment(id: string): Promise<Payment> {
    const response = await apiClient.get(`/payments/${id}`)
    return response.data?.data || response.data
  },

  async createPayment(data: PaymentFormData): Promise<Payment> {
    const response = await apiClient.post('/payments', data)
    return response.data?.data || response.data
  },

  async updatePayment(id: string, data: Partial<PaymentFormData>): Promise<Payment> {
    const response = await apiClient.put(`/payments/${id}`, data)
    return response.data?.data || response.data
  },

  async deletePayment(id: string): Promise<void> {
    await apiClient.delete(`/payments/${id}`)
  },
}
