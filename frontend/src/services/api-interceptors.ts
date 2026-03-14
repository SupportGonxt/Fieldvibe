import { apiClient } from './api.service'
import { useAuthStore } from '../store/auth.store'

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(p => {
    if (error) p.reject(error)
    else if (token) p.resolve(token)
  })
  failedQueue = []
}

export function setupInterceptors() {
  // Request interceptor - add auth token
  apiClient.interceptors.request.use((config) => {
    const tokens = useAuthStore.getState().tokens
    if (tokens?.access_token && config.headers) {
      config.headers.Authorization = `Bearer ${tokens.access_token}`
    }
    return config
  })

  // Response interceptor - retry on 401, exponential backoff on 5xx
  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      if (!originalRequest) return Promise.reject(error)

      // Token refresh on 401
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          }).then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return apiClient(originalRequest)
          })
        }

        originalRequest._retry = true
        isRefreshing = true

        try {
          const refreshToken = useAuthStore.getState().tokens?.refresh_token
          if (!refreshToken) {
            useAuthStore.getState().logout()
            return Promise.reject(error)
          }
          const res = await apiClient.post('/auth/refresh', { refresh_token: refreshToken })
          const data = res.data as { data?: { access_token?: string; refresh_token?: string; expires_in?: number } }
          const newAccessToken = data.data?.access_token
          if (newAccessToken) {
            // Update tokens in the store directly via refreshToken action
            await useAuthStore.getState().refreshToken()
            processQueue(null, newAccessToken)
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
            return apiClient(originalRequest)
          }
        } catch (refreshError) {
          processQueue(refreshError, null)
          useAuthStore.getState().logout()
          return Promise.reject(refreshError)
        } finally {
          isRefreshing = false
        }
      }

      // Exponential backoff retry for 5xx (only idempotent methods to avoid duplicate mutations)
      const idempotentMethods = ['get', 'head', 'options']
      if (error.response?.status >= 500 && idempotentMethods.includes((originalRequest.method || '').toLowerCase()) && (!originalRequest._retryCount || originalRequest._retryCount < 3)) {
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1
        const delay = Math.pow(2, originalRequest._retryCount) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        return apiClient(originalRequest)
      }

      return Promise.reject(error)
    }
  )
}
