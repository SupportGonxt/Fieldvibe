// HAND-MIRRORED from workers-api/src/lib/capabilities.js (source of truth).
// No monorepo linkage exists — if you change one file, change both.

export const ADMIN_EQUIVALENT = ['admin', 'backoffice_admin', 'general_manager']

export const FIELD_ROLES = ['agent', 'field_agent', 'sales_rep', 'team_lead', 'manager']

export function roleAllows(role: string | undefined, allowedRoles: string[]): boolean {
  if (!role) return false
  if (role === 'super_admin') return true
  if (ADMIN_EQUIVALENT.includes(role)) return true
  return allowedRoles.includes(role)
}

export function canSeeMoney(role: string | undefined): boolean {
  return role === 'super_admin' || ADMIN_EQUIVALENT.includes(role ?? '')
}
