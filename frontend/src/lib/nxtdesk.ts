// NXTDesk "Report an issue" widget (GoNXT's shared support queue).
//
// The script is NOT in index.html: it is injected at runtime only for the
// roles in NXTDESK_ROLES (see hooks/useNxtDesk.ts), so other roles never
// download it, never get #nxtdesk-widget in the DOM and never call NXTDesk.
// The widget has no hide/destroy command, so unloadNxtDesk() removes it.

const SCRIPT_URL = import.meta.env.VITE_NXTDESK_WIDGET_URL || 'https://intake.gonxt.tech/widget.js'
const WIDGET_KEY = import.meta.env.VITE_NXTDESK_WIDGET_KEY || ''

/**
 * The ONLY place that decides who gets the widget. Values are FieldVibe's real
 * users.role identifiers (same strings as the JWT `role` claim and
 * lib/capabilities.ts): GM = general_manager, BO = backoffice_admin.
 * Exact match: no admin-equivalence expansion, so adding a role here is the
 * only way to widen it.
 */
export const NXTDESK_ROLES: readonly string[] = ['general_manager', 'backoffice_admin', 'super_admin', 'admin']

/** True if ANY of the given roles may see the widget. */
export function nxtDeskAllowed(roles: ReadonlyArray<string | null | undefined>): boolean {
  return roles.some((r) => !!r && NXTDESK_ROLES.includes(r))
}

type NxtDeskFn = ((command: string, ...args: unknown[]) => unknown) & { q?: IArguments[] }

declare global {
  interface Window {
    NXTDesk?: NxtDeskFn
    /** Set by widget.js itself; it refuses to start a second time while set. */
    __nxtdeskLoaded?: boolean
  }
}

const SCRIPT_SELECTOR = 'script[data-nxtdesk]'

export function isNxtDeskLoaded(): boolean {
  return !!document.querySelector(SCRIPT_SELECTOR)
}

export function loadNxtDesk(): void {
  if (!WIDGET_KEY || isNxtDeskLoaded()) return

  // Commands issued before the script arrives are queued and replayed by it.
  window.NXTDesk =
    window.NXTDesk ||
    function () {
      // eslint-disable-next-line prefer-rest-params
      ;(window.NXTDesk!.q = window.NXTDesk!.q || []).push(arguments)
    }

  const s = document.createElement('script')
  s.async = true
  s.src = SCRIPT_URL
  s.setAttribute('data-key', WIDGET_KEY)
  s.setAttribute('data-nxtdesk', '')
  // If this tag was removed (unloadNxtDesk) while it was still downloading, the
  // browser runs it anyway. unloadNxtDesk strips data-key so it bails before
  // mounting; this cleans up whatever it left so a later load starts clean.
  // `load` fires synchronously right after the script runs.
  s.addEventListener(
    'load',
    () => {
      if (s.isConnected) return
      document.getElementById('nxtdesk-widget')?.remove()
      delete window.__nxtdeskLoaded
    },
    { once: true },
  )
  document.body.appendChild(s)
}

export function unloadNxtDesk(): void {
  document.getElementById('nxtdesk-widget')?.remove()
  document.querySelectorAll<HTMLScriptElement>(SCRIPT_SELECTOR).forEach((s) => {
    s.removeAttribute('data-key')
    s.remove()
  })
  delete window.NXTDesk
  delete window.__nxtdeskLoaded
}
