import { request, Page } from '@playwright/test'
import { ROLE_CREDS } from './roles'

const API = process.env.E2E_API_URL || 'https://fieldvibe-api.vantax.co.za'

// Login API is rate-limited to 5/15min per IP, so a suite that UI-logs-in per
// test (x retries) locks itself out. Log in ONCE per role via the API and seed
// the zustand persist blob (auth.store.ts `name: 'fieldvibe-auth'`) before the
// app boots; the store rehydrates and every page loads authenticated.
const sessions: Record<string, string> = {}

export async function seedSession(page: Page, role: string) {
  if (!sessions[role]) {
    const { email, password } = ROLE_CREDS[role]
    const ctx = await request.newContext()
    const res = await ctx.post(`${API}/api/auth/login`, { data: { email, password } })
    const body = await res.json()
    await ctx.dispose()
    if (!body.success) throw new Error(`API login failed for ${role}: ${res.status()} ${JSON.stringify(body)}`)
    const u = body.data.user
    sessions[role] = JSON.stringify({
      state: {
        user: {
          id: u.id,
          email: u.email,
          first_name: u.firstName,
          last_name: u.lastName,
          role: u.role,
          status: u.status,
          permissions: u.permissions || [],
          last_login: u.lastLogin,
          created_at: u.createdAt,
          updated_at: u.updatedAt || u.createdAt,
        },
        tokens: {
          access_token: body.data.tokens?.access_token || body.data.token,
          refresh_token: body.data.tokens?.refresh_token || body.data.refreshToken,
          expires_in: 86400,
          token_type: 'Bearer',
        },
        isAuthenticated: true,
      },
      version: 0,
    })
  }
  await page.addInitScript((auth: string) => localStorage.setItem('fieldvibe-auth', auth), sessions[role])
}
