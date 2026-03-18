import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '../services/auth.service'
import type { User, LoginCredentials, AuthTokens } from '../types/auth.types'

interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  hydrated: boolean
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  clearError: () => void
  initialize: () => void
  updateUser: (user: Partial<User>) => void
  setHydrated: (hydrated: boolean) => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hydrated: false,

      // Actions
      setHydrated: (hydrated: boolean) => {
        set({ hydrated })
      },
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await authService.login(credentials)
          
          set({
            user: response.user,
            tokens: response.tokens,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })

          // Set up token refresh timer
          scheduleTokenRefresh(response.tokens.expires_in)
        } catch (error: any) {
          set({
            user: null,
            tokens: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.message || 'Login failed',
          })
          throw error
        }
      },

      logout: () => {
        // Clear refresh timer
        clearTokenRefreshTimer()
        
        // Call logout API (fire and forget)
        authService.logout().catch(console.error)
        
        // Clear state
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
      },

      refreshToken: async () => {
        const { tokens } = get()
        
        if (!tokens?.refresh_token) {
          get().logout()
          return
        }

        try {
          const response = await authService.refreshToken(tokens.refresh_token)
          
          set({
            tokens: {
              ...tokens,
              access_token: response.access_token,
              expires_in: response.expires_in,
            },
          })

          // Schedule next refresh
          scheduleTokenRefresh(response.expires_in)
        } catch (error) {
          console.error('Token refresh failed:', error)
          get().logout()
        }
      },

      clearError: () => {
        set({ error: null })
      },

      initialize: () => {
        const { tokens, user } = get()
        
        if (tokens && user) {
          set({ isAuthenticated: true })
          
          // Check if token is expired
          const now = Date.now() / 1000
          const tokenExp = parseJWT(tokens.access_token)?.exp
          
          if (tokenExp && tokenExp < now) {
            // Token expired, try to refresh
            get().refreshToken()
          } else {
            // Schedule refresh for valid token
            const expiresIn = tokenExp ? (tokenExp - now) * 1000 : tokens.expires_in * 1000
            scheduleTokenRefresh(expiresIn / 1000)
          }
        }
      },

      updateUser: (userData: Partial<User>) => {
        const { user } = get()
        if (user) {
          set({
            user: { ...user, ...userData }
          })
        }
      },
    }),
    {
      name: 'fieldvibe-auth',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to hydrate auth store:', error)
        }
        if (state) {
          state.setHydrated(true)
        }
      },
    }
  )
)

// Token refresh timer
let refreshTimer: NodeJS.Timeout | null = null

function scheduleTokenRefresh(expiresIn: number) {
  clearTokenRefreshTimer()
  
  // Refresh token 5 minutes before expiry
  const refreshTime = Math.max((expiresIn - 300) * 1000, 60000) // At least 1 minute
  
  refreshTimer = setTimeout(() => {
    useAuthStore.getState().refreshToken()
  }, refreshTime)
}

function clearTokenRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

function parseJWT(token: string) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    return null
  }
}

// Export auth utilities
export const getAuthToken = () => {
  return useAuthStore.getState().tokens?.access_token
}

export const isAuthenticated = () => {
  return useAuthStore.getState().isAuthenticated
}

export const getCurrentUser = () => {
  return useAuthStore.getState().user
}

export const hasRole = (role: string) => {
  const user = getCurrentUser()
  return user?.role === role || user?.role === 'super_admin' || (user?.role === 'admin' && role !== 'super_admin')
}

export const hasPermission = (permission: string) => {
  const user = getCurrentUser()
  return user?.permissions?.includes(permission) || user?.role === 'admin' || user?.role === 'super_admin'
}
