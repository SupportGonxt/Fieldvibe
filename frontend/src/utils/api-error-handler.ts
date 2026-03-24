import { AxiosError } from 'axios'

/**
 * API Error Types
 */
export enum ApiErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * API Error Interface
 */
export interface ApiError {
  type: ApiErrorType
  message: string
  status?: number
  details?: any
  path?: string
  timestamp: string
}

/**
 * Convert Axios errors to typed ApiError
 */
export function handleApiError(error: unknown): ApiError {
  const timestamp = new Date().toISOString()
  
  if (error instanceof AxiosError) {
    const status = error.response?.status
    const data = error.response?.data as any
    
    // Network errors (no response)
    if (!error.response) {
      return {
        type: ApiErrorType.NETWORK_ERROR,
        message: 'Network error. Please check your connection.',
        timestamp,
      }
    }
    
    // Authentication errors
    if (status === 401 || status === 403) {
      return {
        type: ApiErrorType.AUTH_ERROR,
        message: data?.error || 'Authentication failed. Please log in again.',
        status,
        timestamp,
      }
    }
    
    // Validation errors
    if (status === 400 || status === 422) {
      return {
        type: ApiErrorType.VALIDATION_ERROR,
        message: data?.error || 'Validation failed. Please check your input.',
        status,
        details: data?.details || data?.errors,
        timestamp,
      }
    }
    
    // Not found errors
    if (status === 404) {
      return {
        type: ApiErrorType.NOT_FOUND,
        message: data?.error || 'Resource not found.',
        status,
        timestamp,
      }
    }
    
    // Server errors
    if (status >= 500) {
      return {
        type: ApiErrorType.SERVER_ERROR,
        message: 'Server error. Please try again later.',
        status,
        timestamp,
      }
    }
    
    // Default error
    return {
      type: ApiErrorType.UNKNOWN_ERROR,
      message: data?.error || 'An unexpected error occurred.',
      status,
      timestamp,
    }
  }
  
  // Non-Axios errors
  if (error instanceof Error) {
    return {
      type: ApiErrorType.UNKNOWN_ERROR,
      message: error.message,
      timestamp,
    }
  }
  
  // Unknown errors
  return {
    type: ApiErrorType.UNKNOWN_ERROR,
    message: 'An unknown error occurred.',
    timestamp,
  }
}

/**
 * Display error to user via toast/notification
 */
export function displayError(error: ApiError, showDetails = false): void {
  // Import toast dynamically to avoid circular dependency
  import('react-hot-toast').then(({ toast }) => {
    let message = error.message
    
    // Add details if available and requested
    if (showDetails && error.details) {
      if (typeof error.details === 'string') {
        message += ` (${error.details})`
      } else if (Array.isArray(error.details)) {
        message += `: ${error.details.join(', ')}`
      } else if (typeof error.details === 'object') {
        const keys = Object.keys(error.details)
        if (keys.length > 0) {
          message += ` (${keys[0]})`
        }
      }
    }
    
    toast.error(message, {
      duration: 5000,
      position: 'top-center',
    })
  }).catch(() => {
    // Fallback to console if toast not available
    console.error('API Error:', error)
  })
}

/**
 * Log error for debugging
 */
export function logError(error: ApiError, context?: string): void {
  console.error(`[${context || 'API'}] ${error.type}:`, {
    message: error.message,
    status: error.status,
    details: error.details,
    path: error.path,
    timestamp: error.timestamp,
  })
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: ApiError): boolean {
  return error.type === ApiErrorType.NETWORK_ERROR ||
         error.type === ApiErrorType.TIMEOUT_ERROR ||
         (error.status && error.status >= 500 && error.status < 503)
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: ApiError): string {
  switch (error.type) {
    case ApiErrorType.NETWORK_ERROR:
      return 'Unable to connect to server. Please check your internet connection.'
    case ApiErrorType.AUTH_ERROR:
      return 'Session expired. Please log in again.'
    case ApiErrorType.VALIDATION_ERROR:
      return error.details ? `Invalid input: ${error.details}` : 'Please check your input.'
    case ApiErrorType.NOT_FOUND:
      return 'The requested resource was not found.'
    case ApiErrorType.SERVER_ERROR:
      return 'Server is temporarily unavailable. Please try again later.'
    case ApiErrorType.TIMEOUT_ERROR:
      return 'Request timed out. Please try again.'
    default:
      return error.message
  }
}
