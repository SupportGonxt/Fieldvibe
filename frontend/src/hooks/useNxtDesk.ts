import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore, parseJWT } from '../store/auth.store'
import { isNxtDeskLoaded, loadNxtDesk, nxtDeskAllowed, unloadNxtDesk } from '../lib/nxtdesk'

/**
 * Loads the NXTDesk widget for NXTDESK_ROLES and removes it for everyone else
 * (signed out, or any other role). Re-runs when the user, role or tenant
 * changes, so logout, switching accounts and role changes need no reload.
 * Mount once, in App (inside the router).
 */
export function useNxtDesk() {
  const { pathname } = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.tokens?.access_token)

  // A FieldVibe user holds exactly one role: users.role. The JWT `role` claim
  // is preferred because every token refresh re-reads it from the database,
  // so a role change takes effect without a reload; the stored user's role
  // (set at login and never refreshed) is the fallback.
  const claims = accessToken ? parseJWT(accessToken) : null
  const role: string | null = claims?.role ?? user?.role ?? null
  const allowed = isAuthenticated && !!user && nxtDeskAllowed([role])

  const userId = user?.id ?? null
  // Sessions stored before tenant_id was kept on the user fall back to the JWT.
  const tenantId: string | null = user?.tenant_id ?? claims?.tenantId ?? null
  const tenantName: string | null = user?.company_name || null
  const email = user?.email ?? ''
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || email

  useEffect(() => {
    if (!allowed) {
      if (isNxtDeskLoaded() && window.NXTDesk) window.NXTDesk('identify', {})
      unloadNxtDesk()
      return
    }
    loadNxtDesk()
    // loadNxtDesk is a no-op without a widget key; then there is nothing to tell.
    if (!window.NXTDesk) return
    window.NXTDesk('identify', { name, email })
    window.NXTDesk('setContext', { tenantId, tenantName, role, route: pathname })
    // pathname is read here but only drives the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, userId, role, tenantId, tenantName, name, email])

  // Keep the route current so a ticket says which page it was raised from.
  useEffect(() => {
    if (allowed && window.NXTDesk) window.NXTDesk('setContext', { route: pathname })
  }, [allowed, pathname])
}
