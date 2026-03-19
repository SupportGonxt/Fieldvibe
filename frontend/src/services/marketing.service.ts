import api from './api'

export const marketingService = {
  getCampaigns: () => api.get('/campaigns'),
  getCampaign: (id: number | string) => api.get(`/campaigns/${id}`),
  createCampaign: (data: any) => api.post('/campaigns', data),
  updateCampaign: (id: number | string, data: any) => api.put(`/campaigns/${id}`, data),
  deleteCampaign: (id: number | string) => api.delete(`/campaigns/${id}`),
  getCampaignDashboard: () => api.get('/campaigns/dashboard'),
  getCampaignStats: () => api.get('/campaigns/stats'),
  
  getEvents: () => api.get('/events'),
  getEvent: (id: number | string) => api.get(`/events/${id}`),
  createEvent: (data: any) => api.post('/events', data),
  updateEvent: (id: number | string, data: any) => api.put(`/events/${id}`, data),
  deleteEvent: (id: number | string) => api.delete(`/events/${id}`),
  
  getPromotions: () => api.get('/trade-promotions'),
  getPromotion: (id: number | string) => api.get(`/trade-promotions/${id}`),
  createPromotion: (data: any) => api.post('/trade-promotions', data),
  updatePromotion: (id: number | string, data: any) => api.put(`/trade-promotions/${id}`, data),
  
  getActivations: () => api.get('/activations'),
  getActivation: (id: number | string) => api.get(`/activations/${id}`),
  createActivation: (data: any) => api.post('/activations', data),
  updateActivation: (id: number | string, data: any) => api.put(`/activations/${id}`, data),
  
  getAgents: () => api.get('/field-agents'),
}
