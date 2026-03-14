/**
 * Centralized API Configuration
 * Single source of truth for all API endpoints
 * Production-ready with environment detection
 */

/**
 * Get the correct API base URL based on environment
 * This ensures the frontend can connect to the backend in any deployment scenario
 */
const getApiBaseUrl = (): string => {
  // 1. Always prefer explicit environment variable
  if (import.meta.env.VITE_API_BASE_URL) {
    const url = import.meta.env.VITE_API_BASE_URL
    return url
  }
  
  // 2. Development: use relative path (proxied by Vite dev server)
  if (import.meta.env.DEV) {
    return '/api'
  }
  
  // 3. Production: MUST have a full URL - this is critical!
  if (import.meta.env.PROD) {
    console.error('❌ CRITICAL: VITE_API_BASE_URL not set in production!')
    console.error('❌ The frontend will NOT work without a proper backend URL!')
    console.error('❌ Please set VITE_API_BASE_URL in .env.production')
    console.error('💡 Example: VITE_API_BASE_URL=https://api.yourdomain.com/api')
    
    // Fallback: try same domain (works if backend is reverse-proxied)
    const fallback = window.location.origin + '/api'
    console.warn(`⚠️ Falling back to: ${fallback}`)
    return fallback
  }
  
  // Default fallback
  return '/api'
}

// API Base Configuration
export const API_CONFIG = {
  // Base URL - intelligent detection for development and production
  BASE_URL: getApiBaseUrl(),
  TIMEOUT: 30000,
  
  // All API endpoints in one place
  ENDPOINTS: {
    // Authentication
    AUTH: {
      LOGIN: '/auth/login',
      LOGOUT: '/auth/logout',
      REFRESH: '/auth/refresh',
      ME: '/auth/me',
    },
    
    // Customers
    CUSTOMERS: {
      BASE: '/customers',
      BY_ID: (id: string) => `/customers/${id}`,
      STATS: '/customers/stats',
      ORDERS: (id: string) => `/customers/${id}/orders`,
      TRANSACTIONS: (id: string) => `/customers/${id}/transactions`,
      VISITS: (id: string) => `/customers/${id}/visits`,
    },
    
    // Products
    PRODUCTS: {
      BASE: '/products',
      BY_ID: (id: string) => `/products/${id}`,
      CATEGORIES: '/products/categories',
      STATS: '/products/stats',
    },
    
    // Orders
    ORDERS: {
      BASE: '/orders',
      BY_ID: (id: string) => `/orders/${id}`,
      STATS: '/orders/stats',
      ITEMS: (id: string) => `/orders/${id}/items`,
    },
    
    // Dashboard
    DASHBOARD: {
      STATS: '/dashboard/stats',
      CHARTS: '/dashboard/charts',
      RECENT_ACTIVITY: '/dashboard/recent-activity',
    },
    
    // Transactions
    TRANSACTIONS: {
      BASE: '/transactions',
      BY_ID: (id: string) => `/transactions/${id}`,
      STATS: '/transactions/stats',
    },
    
    // Finance
    FINANCE: {
      INVOICES: '/finance/invoices',
      PAYMENTS: '/finance/payments',
      STATS: '/finance/stats',
    },
    
    // Field Operations
    FIELD_OPS: {
      AGENTS: '/field-operations/agents',
      VISITS: '/field-operations/visits',
      ROUTES: '/field-operations/routes',
    },
    
    // Reports
    REPORTS: {
      BASE: '/reports',
      GENERATE: '/reports/generate',
      BY_ID: (id: string) => `/reports/${id}`,
    },
    
    // Beat Routes
    BEAT_ROUTES: {
      BASE: '/beat-routes',
      BY_ID: (id: string) => `/beat-routes/${id}`,
    },
    
    // Commissions
    COMMISSIONS: {
      BASE: '/commissions',
      CALCULATE: '/commissions/calculate',
    },
    
    // Warehouses
    WAREHOUSES: {
      BASE: '/warehouses',
      BY_ID: (id: string) => `/warehouses/${id}`,
      INVENTORY: (id: string) => `/warehouses/${id}/inventory`,
    },
    
    PURCHASE_ORDERS: {
      BASE: '/purchase-orders',
      BY_ID: (id: string) => `/purchase-orders/${id}`,
      APPROVE: (id: string) => `/purchase-orders/${id}/approve`,
      RECEIVE: (id: string) => `/purchase-orders/${id}/receive`,
      STATS: '/purchase-orders/stats/summary',
    },
    
    INVENTORY_ENHANCED: {
      MULTI_LOCATION: '/inventory-enhanced/multi-location',
      TRANSFER: '/inventory-enhanced/transfer',
      TRANSACTIONS: '/inventory-enhanced/transactions',
      ADJUST: '/inventory-enhanced/adjust',
      ANALYTICS: '/inventory-enhanced/analytics',
    },
    
    // AI Services
    AI: {
      CHAT: '/ai/chat',
      ANALYZE: '/ai/analyze',
    },
  }
}

/**
 * Environment-specific configurations
 */
export const ENV_CONFIG = {
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  apiUrl: import.meta.env.VITE_API_BASE_URL,
}
