import { AxiosError, AxiosRequestConfig } from 'axios'

interface RetryConfig {
  maxRetries?: number
  retryDelay?: number
  retryableStatuses?: number[]
  retryableErrors?: string[]
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH']
}

export function shouldRetry(error: AxiosError, config: RetryConfig = {}): boolean {
  const { retryableStatuses, retryableErrors } = { ...DEFAULT_RETRY_CONFIG, ...config }
  
  if (!error.response) {
    return retryableErrors.some(code => error.code === code || error.message.includes(code))
  }
  
  const status = error.response.status
  return retryableStatuses.includes(status)
}

export function getRetryDelay(retryCount: number, baseDelay: number = 1000): number {
  const exponentialDelay = baseDelay * Math.pow(2, retryCount)
  const jitter = Math.random() * 1000
  return Math.min(exponentialDelay + jitter, 30000) // Max 30 seconds
}

export async function retryRequest<T>(
  requestFn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, retryDelay } = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: any
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn()
    } catch (error: any) {
      lastError = error
      
      if (attempt === maxRetries) {
        break
      }
      
      if (!shouldRetry(error, config)) {
        break
      }
      
      const delay = getRetryDelay(attempt, retryDelay)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

export function addRetryToAxiosConfig(config: AxiosRequestConfig, retryConfig?: RetryConfig): AxiosRequestConfig {
  return {
    ...config,
    // @ts-ignore - custom axios-retry config property
    'axios-retry': retryConfig || DEFAULT_RETRY_CONFIG
  }
}
