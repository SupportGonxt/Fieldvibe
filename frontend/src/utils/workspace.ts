// Post-login destination logic for roles that can use BOTH the field PWA and
// the back-office dashboard. Field-only roles and pure back-office admins are
// unaffected — they route straight to their single surface.

// Roles with a real field surface AND back-office access. These land on the
// workspace chooser (in a browser) instead of being force-routed to one app.
export const DUAL_ACCESS_ROLES = ['manager', 'general_manager', 'backoffice_admin', 'admin', 'super_admin']

export const isDualAccess = (role?: string) => !!role && DUAL_ACCESS_ROLES.includes(role)

// Field PWA landing per role (mirrors the historic App.tsx routing).
export function fieldHome(role?: string): string {
  if (role === 'backoffice_admin') return '/agent/reconcile'
  if (role === 'general_manager') return '/agent/overview'
  return '/agent/dashboard'
}

// Back-office dashboard landing per role.
export function officeHome(role?: string): string {
  if (role === 'general_manager') return '/dashboard/gm'
  return '/dashboard'
}

// Where a freshly-authenticated user should land.
// standalone = installed PWA: skip the chooser, the field app is why it was installed.
export function postLoginTarget(role: string | undefined, standalone: boolean): string {
  if (isDualAccess(role)) return standalone ? fieldHome(role) : '/choose'
  // Field roles (agent/team_lead/field_agent/sales_rep) → PWA; everyone else → dashboard.
  const MOBILE_ONLY = ['agent', 'team_lead', 'field_agent', 'sales_rep']
  return role && MOBILE_ONLY.includes(role) ? fieldHome(role) : '/dashboard'
}
