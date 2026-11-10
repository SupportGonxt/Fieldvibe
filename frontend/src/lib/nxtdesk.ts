import { useEffect } from 'react'
import { useAuthStore } from '../store/auth.store'

// NXTDesk is GoNXT's shared support queue. Its widget is one script that adds
// the "Report an issue" form; tickets land in the queue as FV-xxxx.
//
// It only loads when the build sets both variables (the dev deploy does, see
// .github/workflows/deploy-dev.yml), so a build without them ships nothing.
// The widget's own floating button is turned off (data-launcher="false"): the
// bottom-right corner already holds the Help button, the mobile quick-action
// button and the agent tab bar. Users open it from Help, More and Profile.
const SCRIPT_URL = import.meta.env.VITE_NXTDESK_URL
const WIDGET_KEY = import.meta.env.VITE_NXTDESK_KEY

type NxtDeskFn = ((method: string, ...args: unknown[]) => void) & { q?: unknown[][] }

declare global {
  interface Window {
    NXTDesk?: NxtDeskFn
  }
}

export const supportEnabled = Boolean(SCRIPT_URL && WIDGET_KEY)

function call(method: string, ...args: unknown[]) {
  if (!supportEnabled) return
  // Calls made before the script has loaded are queued and replayed by it.
  if (!window.NXTDesk) {
    const stub: NxtDeskFn = (...a: unknown[]) => {
      ;(stub.q = stub.q || []).push(a)
    }
    window.NXTDesk = stub
  }
  window.NXTDesk(method, ...args)
}

function loadWidget() {
  if (!supportEnabled || document.querySelector('script[data-nxtdesk]')) return
  const s = document.createElement('script')
  s.src = SCRIPT_URL!
  s.async = true
  s.setAttribute('data-nxtdesk', '')
  s.setAttribute('data-key', WIDGET_KEY!)
  s.setAttribute('data-launcher', 'false')
  s.setAttribute('data-app-version', __APP_VERSION__)
  document.body.appendChild(s)
}

/** Opens the "Report an issue" form, optionally prefilled. */
export function openSupport(prefill?: { title?: string; description?: string }) {
  // Without a view the widget reopens whatever it showed last (e.g. the ticket
  // list after "My tickets"), so ask for the form explicitly.
  call('open', { ...prefill, view: 'form' })
}

/** Opens the list of tickets this browser has raised. */
export function openMyTickets() {
  call('myTickets')
}

/**
 * Loads the widget once and keeps it told who is signed in, so the reporter's
 * name and email are filled in and the ticket carries the tenant and role.
 * Mount once, in App.
 */
export function useSupportWidget() {
  // The login response is camelCase (firstName, tenantId, companyName) even
  // though the User type says snake_case, so read both.
  const user = useAuthStore((s) => s.user) as Record<string, any> | null

  useEffect(loadWidget, [])

  const email: string | undefined = user?.email
  let payload: { identity: Record<string, string>; context: Record<string, unknown> }
  if (!user || !email) {
    // Signed out. setContext merges, so each key is cleared explicitly.
    payload = { identity: {}, context: { tenantId: null, companyName: null, role: null, userId: null } }
  } else {
    const first = user.firstName ?? user.first_name ?? ''
    const last = user.lastName ?? user.last_name ?? ''
    payload = {
      identity: { name: user.name || `${first} ${last}`.trim() || email, email, phone: user.phone || '' },
      context: {
        tenantId: user.tenantId ?? user.tenant_id ?? null,
        companyName: user.companyName ?? user.company_name ?? null,
        role: user.role ?? null,
        userId: user.id ?? null,
      },
    }
  }

  // Keyed on the serialised payload so it re-runs only when something changed.
  const key = JSON.stringify(payload)
  useEffect(() => {
    const { identity, context } = JSON.parse(key)
    call('identify', identity)
    call('setContext', context)
  }, [key])
}
