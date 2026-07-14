// Role-access single source of truth. Pure — no DB, no IO.
// MIRRORED in frontend/src/lib/capabilities.ts — keep both in sync by hand
// (no monorepo linkage; same pattern as signalRegistry).

export const ADMIN_EQUIVALENT = ['admin', 'backoffice_admin', 'general_manager'];

// Field roles: see signup/verified/deposit COUNTS per day, never rand values
// on team/tenant data. Own incentive pay is exempt (self-scoped endpoints).
export const FIELD_ROLES = ['agent', 'field_agent', 'sales_rep', 'team_lead', 'manager'];

// Response keys that carry rand values. stripMonetary drops these for
// non-money roles — fail closed: drop, never zero-fill or pass through.
export const MONETARY_FIELDS = [
  'revenue', 'provRevenue', 'qualRevenue', 'payable', 'provisionalPace',
  'baseSalary', 'base_salary', 'amount', 'commission', 'commission_per_deposit',
  'payout', 'total_amount', 'rand_value', 'earnings', 'total_earnings',
];

export function roleAllows(role, allowedRoles) {
  if (!role) return false;
  if (role === 'super_admin') return true;
  if (ADMIN_EQUIVALENT.includes(role)) return true;
  return allowedRoles.includes(role);
}

export function canSeeMoney(role) {
  return role === 'super_admin' || ADMIN_EQUIVALENT.includes(role);
}

export function stripMonetary(value, role) {
  if (canSeeMoney(role)) return value;
  if (Array.isArray(value)) return value.map((v) => stripMonetary(v, role));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (MONETARY_FIELDS.includes(k)) continue;
      out[k] = stripMonetary(v, role);
    }
    return out;
  }
  return value;
}
