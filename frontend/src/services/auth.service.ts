import { apiClient } from './api.service'
import type {
  LoginCredentials,
  LoginResponse,
  RefreshTokenResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
} from '../types/auth.types'

class AuthService {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await apiClient.post('/auth/login', credentials)
    
    // Adapt the API response to match the expected format
    const apiData = response.data.data
    
    // Helper to convert expires_in to number (seconds)
    const parseExpiresIn = (value: any): number => {
      if (typeof value === 'number') return value
      if (typeof value === 'string') {
        const match = value.match(/^(\d+)([smhd])$/)
        if (match) {
          const [, num, unit] = match
          const multipliers = { s: 1, m: 60, h: 3600, d: 86400 }
          return parseInt(num) * (multipliers[unit as keyof typeof multipliers] || 3600)
        }
      }
      return 86400 // Default: 24 hours
    }
    
    return {
      user: {
        id: apiData.user.id,
        email: apiData.user.email,
        first_name: apiData.user.firstName,
        last_name: apiData.user.lastName,
        role: apiData.user.role,
        status: apiData.user.status,
        permissions: apiData.user.permissions || [],
        last_login: apiData.user.lastLogin,
        created_at: apiData.user.createdAt,
        updated_at: apiData.user.updatedAt || apiData.user.createdAt,
      },
      tokens: {
        access_token: apiData.tokens?.access_token || apiData.token,
        refresh_token: apiData.tokens?.refresh_token || apiData.refreshToken,
        expires_in: parseExpiresIn(apiData.tokens?.expires_in),
        token_type: (apiData.tokens?.token_type || 'Bearer') as 'Bearer',
      },
    }
  }

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await apiClient.post('/auth/refresh', {
      refresh_token: refreshToken,
    })
    
    const apiData = response.data.data || response.data
    
    return {
      access_token: apiData.token || apiData.access_token,
      expires_in: apiData.expires_in || 86400, // Default 24 hours
    }
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<void> {
    await apiClient.post('/auth/forgot-password', data)
  }

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    await apiClient.post('/auth/reset-password', data)
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await apiClient.post('/auth/change-password', data)
  }

  async verifyToken(token: string): Promise<boolean> {
    try {
      await apiClient.post('/auth/verify-token', { token })
      return true
    } catch {
      return false
    }
  }

  async getCurrentUser() {
    const response = await apiClient.get('/auth/me')
    return response.data
  }
}

export const authService = new AuthService()
