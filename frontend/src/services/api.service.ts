import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { getAuthToken } from '../store/auth.store'
import { tenantService } from './tenant.service'
import { API_CONFIG } from '../config/api.config'
import { shouldRetry, getRetryDelay } from '../utils/api-retry'

// API Configuration
const API_BASE_URL = API_CONFIG.BASE_URL
const API_TIMEOUT = API_CONFIG.TIMEOUT

// Lightweight in-memory cache for GET requests (avoids refetching on tab navigation)
const responseCache = new Map<string, { data: AxiosResponse; timestamp: number }>()
const CACHE_TTL_MS = 30_000 // 30 seconds
const CACHEABLE_PATHS = ['/agent/dashboard', '/agent/performance', '/team-lead/dashboard', '/manager/dashboard']

export function invalidateApiCache(pathPrefix?: string) {
  if (pathPrefix) {
    for (const key of responseCache.keys()) {
      if (key.startsWith(pathPrefix)) responseCache.delete(key)
    }
  } else {
    responseCache.clear()
  }
}

// Create axios instance with baseURL
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

function getValidToken(): string | undefined {
  // Try to get token from Zustand store first
  const fromStore = getAuthToken()
  if (typeof fromStore === 'string' && fromStore && fromStore !== 'null' && fromStore !== 'undefined') {
    return fromStore
  }
  
  if (typeof window !== 'undefined') {
    try {
      const persisted = localStorage.getItem('fieldvibe-auth')
      if (persisted) {
        const parsed = JSON.parse(persisted)
        const token = parsed?.state?.tokens?.access_token
        if (typeof token === 'string' && token && token !== 'null' && token !== 'undefined') {
          return token
        }
      }
    } catch (error) {
      console.error('Failed to read token from localStorage:', error)
    }
  }
  
  return undefined
}

// Request interceptor to add auth token and tenant header
apiClient.interceptors.request.use(
  (config) => {
    const token = getValidToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    } else {
      delete config.headers.Authorization
    }
    // Add dynamic tenant header for multi-tenant support
    const tenantCode = tenantService.getTenantCode()
    config.headers['X-Tenant-Code'] = tenantCode
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Stale-while-revalidate cache for mobile dashboard endpoints
// Returns stale data instantly while refreshing in background; fresh within TTL returns immediately
const STALE_TTL_MS = 120_000 // serve stale data up to 2 minutes old while revalidating
const originalGet = apiClient.get.bind(apiClient)
apiClient.get = function cachedGet(url: string, config?: AxiosRequestConfig) {
  const isCacheable = CACHEABLE_PATHS.some(p => url.includes(p))
  if (isCacheable) {
    const cached = responseCache.get(url)
    if (cached) {
      const age = Date.now() - cached.timestamp
      if (age < CACHE_TTL_MS) {
        // Fresh — return immediately, no revalidation needed
        return Promise.resolve(cached.data)
      }
      if (age < STALE_TTL_MS) {
        // Stale — return cached data immediately, revalidate in background
        // Mark as background so interceptor skips logout/redirect on 401/403
        originalGet(url, { ...config, _backgroundRevalidation: true } as any).then((res: AxiosResponse) => {
          responseCache.set(url, { data: res, timestamp: Date.now() })
        }).catch(() => { /* background refresh failed, keep stale */ })
        return Promise.resolve(cached.data)
      }
    }
  }
  return originalGet(url, config).then((res: AxiosResponse) => {
    if (isCacheable) {
      responseCache.set(url, { data: res, timestamp: Date.now() })
    }
    return res
  })
} as typeof apiClient.get

// Response interceptor for error handling with retry logic
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any

    // Skip auth error handling for background SWR revalidation requests
    if (originalRequest._backgroundRevalidation) {
      return Promise.reject(error)
    }

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Try to refresh token
        const { useAuthStore } = await import('../store/auth.store')
        await useAuthStore.getState().refreshToken()
        
        // Retry original request with new token
        const token = getAuthToken()
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        const { useAuthStore } = await import('../store/auth.store')
        useAuthStore.getState().logout()
        
        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }
      }
    }

    // Handle 403 Forbidden - user doesn't have permission
    if (error.response?.status === 403) {
      console.error('Access Forbidden: Insufficient permissions')
      
      // Optionally show a toast/notification here
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
        // Store the attempted URL for potential redirect after re-login
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname)
        
        // Redirect to login with error message
        window.location.href = '/auth/login?error=forbidden'
      }
    }

    const method = originalRequest?.method?.toUpperCase()
    const isIdempotent = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
    
    if (isIdempotent && shouldRetry(error) && !originalRequest._retryCount) {
      originalRequest._retryCount = 0
    }
    
    if (isIdempotent && originalRequest._retryCount !== undefined && originalRequest._retryCount < 3) {
      originalRequest._retryCount++
      const delay = getRetryDelay(originalRequest._retryCount)
      
      
      await new Promise(resolve => setTimeout(resolve, delay))
      return apiClient(originalRequest)
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network Error: Unable to reach the server')
      return Promise.reject({
        message: 'Network error: Unable to connect to the server. Please check your internet connection.',
        code: 'NETWORK_ERROR',
        status: 0,
      })
    }

    // Handle other errors
    const errorMessage = error.response?.data?.message || error.message || 'An error occurred'
    const errorCode = error.response?.data?.code || 'UNKNOWN_ERROR'
    
    return Promise.reject({
      message: errorMessage,
      code: errorCode,
      status: error.response?.status,
      data: error.response?.data,
    })
  }
)

// Generic API service class
export class ApiService {
  protected client: AxiosInstance

  constructor() {
    this.client = apiClient
  }

  // GET request
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config)
  }

  // POST request
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config)
  }

  // PUT request
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config)
  }

  // PATCH request
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config)
  }

  // DELETE request
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config)
  }

  // Upload file
  async upload<T = any>(url: string, file: File, onProgress?: (progress: number) => void): Promise<AxiosResponse<T>> {
    const formData = new FormData()
    formData.append('file', file)

    return this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    })
  }

  // Download file
  async download(url: string, filename?: string): Promise<void> {
    const response = await this.client.get(url, {
      responseType: 'blob',
    })

    // Create download link
    const blob = new Blob([response.data])
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  }
}

// Export default instance
export const apiService = new ApiService()

// Utility functions
export const buildQueryString = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((item) => searchParams.append(key, String(item)))
      } else {
        searchParams.append(key, String(value))
      }
    }
  })
  
  return searchParams.toString()
}

export const buildUrl = (baseUrl: string, params?: Record<string, any>): string => {
  if (!params) return baseUrl
  
  const queryString = buildQueryString(params)
  return queryString ? `${baseUrl}?${queryString}` : baseUrl
}

// Error handling utilities
export const isApiError = (error: any): boolean => {
  return error && typeof error === 'object' && 'message' in error
}

export const getErrorMessage = (error: any): string => {
  if (isApiError(error)) {
    return error.message
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  return 'An unexpected error occurred'
}

export const getErrorCode = (error: any): string => {
  if (isApiError(error) && error.code) {
    return error.code
  }
  
  return 'UNKNOWN_ERROR'
}

// Request/Response logging (development only)
if (import.meta.env.DEV) {
  apiClient.interceptors.request.use((config) => {
    return config
  })

  apiClient.interceptors.response.use(
    (response) => {
      return response
    },
    (error) => {
      console.error(`API Error: ${error.response?.status} ${error.config?.url}`, {
        error: error.response?.data || error.message,
      })
      return Promise.reject(error)
    }
  )
}
