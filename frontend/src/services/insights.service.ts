import { apiClient } from './api.service'

export const insightsService = {
  getExecutiveDashboard: async () => {
    const res = await apiClient.get('/insights/executive')
    return res.data?.data || res.data
  },
  getSalesDashboard: async () => {
    const res = await apiClient.get('/insights/sales')
    return res.data?.data || res.data
  },
  getVanSalesDashboard: async () => {
    const res = await apiClient.get('/insights/van-sales')
    return res.data?.data || res.data
  },
  getFieldOpsDashboard: async () => {
    const res = await apiClient.get('/insights/field-ops')
    return res.data?.data || res.data
  },
  getTradePromotionsDashboard: async () => {
    const res = await apiClient.get('/insights/trade-promotions')
    return res.data?.data || res.data
  },
  getStockDashboard: async () => {
    const res = await apiClient.get('/insights/stock')
    return res.data?.data || res.data
  },
  getCommissionsDashboard: async () => {
    const res = await apiClient.get('/insights/commissions')
    return res.data?.data || res.data
  },
  getGoalsDashboard: async () => {
    const res = await apiClient.get('/insights/goals')
    return res.data?.data || res.data
  },
  getAnomaliesDashboard: async () => {
    const res = await apiClient.get('/insights/anomalies')
    return res.data?.data || res.data
  },
}

export const pricingService = {
  getPriceLists: async () => {
    const res = await apiClient.get('/price-lists')
    return res.data?.data || res.data
  },
  createPriceList: async (data: any) => {
    const res = await apiClient.post('/price-lists', data)
    return res.data?.data || res.data
  },
  resolvePrice: async (data: any) => {
    const res = await apiClient.post('/pricing/resolve', data)
    return res.data?.data || res.data
  },
}

export const tradePromotionsService = {
  getPromotions: async () => {
    const res = await apiClient.get('/trade-promotions')
    return res.data?.data || res.data
  },
  createPromotion: async (data: any) => {
    const res = await apiClient.post('/trade-promotions', data)
    return res.data?.data || res.data
  },
  getClaims: async () => {
    const res = await apiClient.get('/trade-promotion-claims')
    return res.data?.data || res.data
  },
  getROI: async (id: string) => {
    const res = await apiClient.get(`/trade-promotions/${id}/roi`)
    return res.data?.data || res.data
  },
}

export const territoryService = {
  getTerritories: async () => {
    const res = await apiClient.get('/territories')
    return res.data?.data || res.data
  },
  createTerritory: async (data: any) => {
    const res = await apiClient.post('/territories', data)
    return res.data?.data || res.data
  },
}

export const routePlanService = {
  getRoutePlans: async () => {
    const res = await apiClient.get('/route-plans')
    return res.data?.data || res.data
  },
  createRoutePlan: async (data: any) => {
    const res = await apiClient.post('/route-plans', data)
    return res.data?.data || res.data
  },
}

export const anomalyService = {
  getAnomalyFlags: async () => {
    const res = await apiClient.get('/anomaly-flags')
    return res.data?.data || res.data
  },
  runDetection: async (data: any) => {
    const res = await apiClient.post('/anomaly-detection/run', data)
    return res.data?.data || res.data
  },
}

export const webhookService = {
  getWebhooks: async () => {
    const res = await apiClient.get('/webhooks')
    return res.data?.data || res.data
  },
  createWebhook: async (data: any) => {
    const res = await apiClient.post('/webhooks', data)
    return res.data?.data || res.data
  },
  deleteWebhook: async (id: string) => {
    const res = await apiClient.delete(`/webhooks/${id}`)
    return res.data?.data || res.data
  },
}

export const apiKeyService = {
  getApiKeys: async () => {
    const res = await apiClient.get('/api-keys')
    return res.data?.data || res.data
  },
  createApiKey: async (data: any) => {
    const res = await apiClient.post('/api-keys', data)
    return res.data?.data || res.data
  },
  deleteApiKey: async (id: string) => {
    const res = await apiClient.delete(`/api-keys/${id}`)
    return res.data?.data || res.data
  },
}

export const exportImportService = {
  exportData: async (data: any) => {
    const res = await apiClient.post('/export', data)
    return res.data?.data || res.data
  },
  importData: async (data: any) => {
    const res = await apiClient.post('/import', data)
    return res.data?.data || res.data
  },
  getImportJobs: async () => {
    const res = await apiClient.get('/import-jobs')
    return res.data?.data || res.data
  },
}

export const reportService = {
  getSubscriptions: async () => {
    const res = await apiClient.get('/report-subscriptions')
    return res.data?.data || res.data
  },
  createSubscription: async (data: any) => {
    const res = await apiClient.post('/report-subscriptions', data)
    return res.data?.data || res.data
  },
  generateReport: async (data: any) => {
    const res = await apiClient.post('/reports/generate', data)
    return res.data?.data || res.data
  },
  getHistory: async () => {
    const res = await apiClient.get('/report-history')
    return res.data?.data || res.data
  },
}

export const seedService = {
  seedDemo: async () => {
    const res = await apiClient.post('/seed/demo')
    return res.data?.data || res.data
  },
  getSeedRuns: async () => {
    const res = await apiClient.get('/seed/runs')
    return res.data?.data || res.data
  },
}

export const errorLogService = {
  getLogs: async (params?: any) => {
    const res = await apiClient.get('/error-logs', { params })
    return res.data?.data || res.data
  },
}

export const auditLogService = {
  getLogs: async (params?: any) => {
    const res = await apiClient.get('/audit-log', { params })
    return res.data?.data || res.data
  },
}

export const tradeMarketingService = {
  // Visit Photos
  uploadPhoto: async (formData: FormData) => {
    const res = await apiClient.post('/visit-photos/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    return res.data?.data || res.data
  },
  getVisitPhotos: async (params?: any) => {
    const res = await apiClient.get('/visit-photos', { params })
    return res.data?.data || res.data
  },
  getPhoto: async (id: string) => {
    const res = await apiClient.get(`/visit-photos/${id}`)
    return res.data?.data || res.data
  },
  reanalyzePhoto: async (id: string) => {
    const res = await apiClient.post(`/visit-photos/${id}/reanalyze`)
    return res.data?.data || res.data
  },
  // Share of Voice
  getShareOfVoice: async (params?: any) => {
    const res = await apiClient.get('/insights/share-of-voice', { params })
    return res.data?.data || res.data
  },
  // Survey Templates
  getSurveyTemplates: async (params?: any) => {
    const res = await apiClient.get('/survey-templates', { params })
    return res.data?.data || res.data
  },
  createSurveyTemplate: async (data: any) => {
    const res = await apiClient.post('/survey-templates', data)
    return res.data?.data || res.data
  },
  getSurveyTemplate: async (id: string) => {
    const res = await apiClient.get(`/survey-templates/${id}`)
    return res.data?.data || res.data
  },
  updateSurveyTemplate: async (id: string, data: any) => {
    const res = await apiClient.put(`/survey-templates/${id}`, data)
    return res.data?.data || res.data
  },
  // Activations
  startActivation: async (id: string, data: any) => {
    const res = await apiClient.post(`/activations/${id}/start`, data)
    return res.data?.data || res.data
  },
  completeTask: async (activationId: string, taskId: string, data: any) => {
    const res = await apiClient.post(`/activations/${activationId}/tasks/${taskId}/complete`, data)
    return res.data?.data || res.data
  },
  submitActivation: async (id: string) => {
    const res = await apiClient.post(`/activations/${id}/submit`)
    return res.data?.data || res.data
  },
  getActivationSummary: async (id: string) => {
    const res = await apiClient.get(`/activations/${id}/summary`)
    return res.data?.data || res.data
  },
  approveActivation: async (id: string) => {
    const res = await apiClient.post(`/activations/${id}/approve`)
    return res.data?.data || res.data
  },
  // POSM
  getPOSMMaterials: async (params?: any) => {
    const res = await apiClient.get('/posm-materials', { params })
    return res.data?.data || res.data
  },
  createPOSMMaterial: async (data: any) => {
    const res = await apiClient.post('/posm-materials', data)
    return res.data?.data || res.data
  },
  getPOSMInstallations: async (params?: any) => {
    const res = await apiClient.get('/posm-installations', { params })
    return res.data?.data || res.data
  },
  createPOSMInstallation: async (data: any) => {
    const res = await apiClient.post('/posm-installations', data)
    return res.data?.data || res.data
  },
  getPOSMAudits: async (params?: any) => {
    const res = await apiClient.get('/posm-audits', { params })
    return res.data?.data || res.data
  },
  createPOSMAudit: async (data: any) => {
    const res = await apiClient.post('/posm-audits', data)
    return res.data?.data || res.data
  },
  getPOSMDashboard: async () => {
    const res = await apiClient.get('/posm-materials/dashboard')
    return res.data?.data || res.data
  },
  // Brand Owner
  getBrandOwnerDashboard: async (params?: any) => {
    const res = await apiClient.get('/brand-owner/dashboard', { params })
    return res.data?.data || res.data
  },
  getBrandOwnerReports: async (params?: any) => {
    const res = await apiClient.get('/brand-owner/reports', { params })
    return res.data?.data || res.data
  },
  // Competitor Intelligence
  getCompetitorInsights: async (params?: any) => {
    const res = await apiClient.get('/insights/competitors', { params })
    return res.data?.data || res.data
  },
  createCompetitorSighting: async (data: any) => {
    const res = await apiClient.post('/competitor-sightings-enhanced', data)
    return res.data?.data || res.data
  },
  // Enhanced Checkout
  enhancedCheckout: async (visitId: string, data: any) => {
    const res = await apiClient.post(`/visits/${visitId}/checkout-enhanced`, data)
    return res.data?.data || res.data
  },
}

export const photoReviewService = {
  getAdminReview: async (params?: Record<string, string>) => {
    const res = await apiClient.get('/visit-photos/admin-review', { params })
    return res.data?.data || res.data
  },
  rejectPhoto: async (id: string, reason: string) => {
    const res = await apiClient.post(`/visit-photos/${id}/reject`, { reason })
    return res.data?.data || res.data
  },
  approvePhoto: async (id: string) => {
    const res = await apiClient.post(`/visit-photos/${id}/approve`)
    return res.data?.data || res.data
  },
  getNeedsReupload: async () => {
    const res = await apiClient.get('/visit-photos/needs-reupload')
    return res.data?.data || res.data
  },
  deletePhoto: async (id: string) => {
    const res = await apiClient.delete(`/visit-photos/${id}`)
    return res.data?.data || res.data
  },
  addReviewColumns: async () => {
    const res = await apiClient.post('/visit-photos/add-review-columns')
    return res.data?.data || res.data
  },
}

export const rbacService = {
  getPermissions: async () => {
    const res = await apiClient.get('/rbac/permissions')
    return res.data?.data || res.data
  },
  getMyPermissions: async () => {
    const res = await apiClient.get('/rbac/my-permissions')
    return res.data?.data || res.data
  },
  getFeatureFlags: async () => {
    const res = await apiClient.get('/feature-flags')
    return res.data?.data || res.data
  },
}
