import api from './api'

export const salesService = {
  // Customers and Sales Reps
  getCustomers: () => api.get('/customers'),
  getSalesReps: () => api.get('/sales-reps'),
  
  // Orders - use authoritative endpoints with server-side pricing
  getOrders: () => api.get('/orders'),
  getOrder: async (id: string) => {
    const res = await api.get(`/orders/${id}`)
    // Unwrap {success, data} wrapper if present
    return { ...res, data: res.data?.data || res.data }
  },
  createOrder: (data: any) => api.post('/orders/create', data),
  updateOrder: (id: string, data: any) => api.put(`/orders/${id}`, data),
  transitionOrder: (id: string, new_status: string, notes?: string) => 
    api.post(`/orders/${id}/transition`, { new_status, notes }),
  getOrderTransitions: (id: string) => api.get(`/orders/${id}/transitions`),
  getOrderHistory: (id: string) => api.get(`/orders/${id}/history`),
  recalculateOrder: (id: string, items: any[]) => api.post(`/orders/${id}/recalculate`, { items }),
  
  // Invoices - use authoritative endpoints with server-side pricing
  getInvoices: () => api.get('/invoices'),
  getInvoice: (id: string) => api.get(`/invoices/${id}`),
  createInvoice: (data: any) => api.post('/invoices/create', data),
  transitionInvoice: (id: string, new_status: string, notes?: string) => 
    api.post(`/invoices/${id}/transition`, { new_status, notes }),
  getInvoiceTransitions: (id: string) => api.get(`/invoices/${id}/transitions`),
  
  // Payments
  getPayments: () => api.get('/sales/payments'),
  getPayment: (id: string) => api.get(`/sales/payments/${id}`),
  createPayment: (data: any) => api.post('/sales/payments', data),
  
  // Credit Notes - use authoritative endpoints with server-side pricing
  getCreditNotes: () => api.get('/credit-notes/list'),
  getCreditNote: (id: string) => api.get(`/credit-notes/${id}`),
  createCreditNote: (data: any) => api.post('/credit-notes/create', data),
  transitionCreditNote: (id: string, new_status: string, notes?: string) =>
    api.post(`/credit-notes/${id}/transition`, { new_status, notes }),
  // Apply: optional `amount` lets caller choose how much of the credit to apply against the order.
  // Without it, backend applies min(remaining_balance, order_outstanding).
  applyCreditNote: (id: string, order_id: string, amount?: number) =>
    api.post(`/credit-notes/${id}/apply`, amount != null ? { order_id, amount } : { order_id }),
  voidCreditNote: (id: string) => api.put(`/credit-notes/${id}/void`),
  
  // Returns - use authoritative endpoints with server-side pricing
  getReturns: () => api.get('/sales/returns'),
  getReturn: (id: string) => api.get(`/sales/returns/${id}`),
  createReturn: (data: any) => api.post('/sales/returns/create', data),
  transitionReturn: (id: string, new_status: string, notes?: string) => 
    api.post(`/sales/returns/${id}/transition`, { new_status, notes }),
}
