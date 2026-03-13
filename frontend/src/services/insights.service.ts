import { apiClient } from './api.service'

export const insightsService = {
  getExecutiveDashboard: async () => {
    const res = await apiClient.get('/api/insights/executive')
    return res.data?.data || res.data
  },
  getSalesDashboard: async () => {
    const res = await apiClient.get('/api/insights/sales')
    return res.data?.data || res.data
  },
  getVanSalesDashboard: async () => {
    const res = await apiClient.get('/api/insights/van-sales')
    return res.data?.data || res.data
  },
  getFieldOpsDashboard: async () => {
    const res = await apiClient.get('/api/insights/field-ops')
    return res.data?.data || res.data
  },
  getTradePromotionsDashboard: async () => {
    const res = await apiClient.get('/api/insights/trade-promotions')
    return res.data?.data || res.data
  },
  getStockDashboard: async () => {
    const res = await apiClient.get('/api/insights/stock')
    return res.data?.data || res.data
  },
  getCommissionsDashboard: async () => {
    const res = await apiClient.get('/api/insights/commissions')
    return res.data?.data || res.data
  },
  getGoalsDashboard: async () => {
    const res = await apiClient.get('/api/insights/goals')
    return res.data?.data || res.data
  },
  getAnomaliesDashboard: async () => {
    const res = await apiClient.get('/api/insights/anomalies')
    return res.data?.data || res.data
  },
}

export const pricingService = {
  getPriceLists: async () => {
    const res = await apiClient.get('/api/price-lists')
    return res.data?.data || res.data
  },
  createPriceList: async (data: any) => {
    const res = await apiClient.post('/api/price-lists', data)
    return res.data
  },
  resolvePrice: async (data: any) => {
    const res = await apiClient.post('/api/pricing/resolve', data)
    return res.data
  },
}

export const tradePromotionsService = {
  getPromotions: async () => {
    const res = await apiClient.get('/api/trade-promotions')
    return res.data?.data || res.data
  },
  createPromotion: async (data: any) => {
    const res = await apiClient.post('/api/trade-promotions', data)
    return res.data
  },
  getClaims: async () => {
    const res = await apiClient.get('/api/trade-promotion-claims')
    return res.data?.data || res.data
  },
  getROI: async (id: string) => {
    const res = await apiClient.get(`/api/trade-promotions/${id}/roi`)
    return res.data?.data || res.data
  },
}

export const territoryService = {
  getTerritories: async () => {
    const res = await apiClient.get('/api/territories')
    return res.data?.data || res.data
  },
  createTerritory: async (data: any) => {
    const res = await apiClient.post('/api/territories', data)
    return res.data
  },
}

export const routePlanService = {
  getRoutePlans: async () => {
    const res = await apiClient.get('/api/route-plans')
    return res.data?.data || res.data
  },
  createRoutePlan: async (data: any) => {
    const res = await apiClient.post('/api/route-plans', data)
    return res.data
  },
}

export const anomalyService = {
  getAnomalyFlags: async () => {
    const res = await apiClient.get('/api/anomaly-flags')
    return res.data?.data || res.data
  },
  runDetection: async (data: any) => {
    const res = await apiClient.post('/api/anomaly-detection/run', data)
    return res.data
  },
}

export const webhookService = {
  getWebhooks: async () => {
    const res = await apiClient.get('/api/webhooks')
    return res.data?.data || res.data
  },
  createWebhook: async (data: any) => {
    const res = await apiClient.post('/api/webhooks', data)
    return res.data
  },
  deleteWebhook: async (id: string) => {
    const res = await apiClient.delete(`/api/webhooks/${id}`)
    return res.data
  },
}

export const apiKeyService = {
  getApiKeys: async () => {
    const res = await apiClient.get('/api/api-keys')
    return res.data?.data || res.data
  },
  createApiKey: async (data: any) => {
    const res = await apiClient.post('/api/api-keys', data)
    return res.data
  },
  deleteApiKey: async (id: string) => {
    const res = await apiClient.delete(`/api/api-keys/${id}`)
    return res.data
  },
}

export const exportImportService = {
  exportData: async (data: any) => {
    const res = await apiClient.post('/api/export', data)
    return res.data?.data || res.data
  },
  importData: async (data: any) => {
    const res = await apiClient.post('/api/import', data)
    return res.data?.data || res.data
  },
  getImportJobs: async () => {
    const res = await apiClient.get('/api/import-jobs')
    return res.data?.data || res.data
  },
}

export const reportService = {
  getSubscriptions: async () => {
    const res = await apiClient.get('/api/report-subscriptions')
    return res.data?.data || res.data
  },
  createSubscription: async (data: any) => {
    const res = await apiClient.post('/api/report-subscriptions', data)
    return res.data
  },
  generateReport: async (data: any) => {
    const res = await apiClient.post('/api/reports/generate', data)
    return res.data?.data || res.data
  },
  getHistory: async () => {
    const res = await apiClient.get('/api/report-history')
    return res.data?.data || res.data
  },
}

export const seedService = {
  seedDemo: async () => {
    const res = await apiClient.post('/api/seed/demo')
    return res.data
  },
  getSeedRuns: async () => {
    const res = await apiClient.get('/api/seed/runs')
    return res.data?.data || res.data
  },
}

export const errorLogService = {
  getLogs: async (params?: any) => {
    const res = await apiClient.get('/api/error-logs', { params })
    return res.data?.data || res.data
  },
}

export const auditLogService = {
  getLogs: async (params?: any) => {
    const res = await apiClient.get('/api/audit-log', { params })
    return res.data?.data || res.data
  },
}

export const rbacService = {
  getPermissions: async () => {
    const res = await apiClient.get('/api/rbac/permissions')
    return res.data?.data || res.data
  },
  getMyPermissions: async () => {
    const res = await apiClient.get('/api/rbac/my-permissions')
    return res.data?.data || res.data
  },
  getFeatureFlags: async () => {
    const res = await apiClient.get('/api/feature-flags')
    return res.data?.data || res.data
  },
}
