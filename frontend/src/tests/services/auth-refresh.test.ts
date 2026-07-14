// Guards the three field-outage fixes in auth.store.refreshToken:
// 1. parallel callers share ONE /auth/refresh request (CGNAT per-IP rate limit),
// 2. the rotated refresh_token from the backend is persisted (7-day cliff),
// 3. transient failures (429/network/5xx) keep the session; only 401/403 end it.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../services/auth.service', () => ({
  authService: {
    refreshToken: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}))

import { authService } from '../../services/auth.service'
import { useAuthStore } from '../../store/auth.store'

const refreshMock = authService.refreshToken as ReturnType<typeof vi.fn>

const seed = () =>
  useAuthStore.setState({
    user: { id: 'u1', role: 'agent' } as any,
    tokens: { access_token: 'a0', refresh_token: 'r0', expires_in: 86400, token_type: 'Bearer' },
    isAuthenticated: true,
  })

describe('auth.store refreshToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seed()
  })

  it('dedupes parallel calls into one request and stores the rotated refresh token', async () => {
    refreshMock.mockResolvedValue({ access_token: 'a1', refresh_token: 'r1', expires_in: 86400 })
    const { refreshToken } = useAuthStore.getState()

    await Promise.all([refreshToken(), refreshToken(), refreshToken()])

    expect(refreshMock).toHaveBeenCalledTimes(1)
    const tokens = useAuthStore.getState().tokens
    expect(tokens?.access_token).toBe('a1')
    expect(tokens?.refresh_token).toBe('r1')
  })

  it('keeps the old refresh token when the response omits a rotated one', async () => {
    refreshMock.mockResolvedValue({ access_token: 'a1', expires_in: 86400 })
    await useAuthStore.getState().refreshToken()
    expect(useAuthStore.getState().tokens?.refresh_token).toBe('r0')
  })

  it('keeps the session on transient errors (429), ends it on 401', async () => {
    refreshMock.mockRejectedValue({ response: { status: 429 } })
    await expect(useAuthStore.getState().refreshToken()).rejects.toBeTruthy()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    refreshMock.mockRejectedValue({ response: { status: 401 } })
    await expect(useAuthStore.getState().refreshToken()).rejects.toBeTruthy()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})
