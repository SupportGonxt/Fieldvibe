// company_viewer: a read-only login for a client company (e.g. Diplomat) that may
// see ONLY that company's visit photos. Deny by default: authMiddleware calls
// companyViewerGate for every request carrying this role, and anything not on the
// allowlist below is a 403. The company comes from company_viewer_links, never
// from the request, so a viewer cannot ask for another company's data.

export const COMPANY_VIEWER_ROLE = 'company_viewer';

// GET-only allowlist. `scope` says how the company is checked:
//   none    — not company data (own profile, logout, the companies list, which
//             fieldOps.js narrows to the viewer's company itself)
//   query   — ?company_id= must be present and equal the viewer's company
// (Photo files themselves are served by the public /api/uploads/* route.)
const ALLOWED = [
  { method: 'GET', re: /^\/api\/auth\/me$/, scope: 'none' },
  { method: 'POST', re: /^\/api\/auth\/logout$/, scope: 'none' },
  { method: 'POST', re: /^\/api\/auth\/change-password$/, scope: 'none' },
  { method: 'GET', re: /^\/api\/field-ops\/companies$/, scope: 'none' },
  { method: 'GET', re: /^\/api\/field-ops\/reports\/visit-photos$/, scope: 'query' },
];

export async function viewerCompanyId(db, tenantId, userId) {
  const row = await db
    .prepare('SELECT company_id FROM company_viewer_links WHERE user_id = ? AND tenant_id = ?')
    .bind(userId, tenantId)
    .first();
  return row ? row.company_id : null;
}

// Returns null when the request may proceed, else a 403 Response.
export async function companyViewerGate(c) {
  const deny = () => c.json({ success: false, message: 'Insufficient permissions' }, 403);
  const method = c.req.method;
  const path = c.req.path;
  const rule = ALLOWED.find((r) => r.method === method && r.re.test(path));
  if (!rule) return deny();

  const tenantId = c.get('tenantId');
  let companyId = c.get('viewerCompanyId');
  if (!companyId) {
    companyId = await viewerCompanyId(c.env.DB, tenantId, c.get('userId'));
    if (!companyId) return deny();
    c.set('viewerCompanyId', companyId);
  }

  if (rule.scope === 'query' && c.req.query('company_id') !== companyId) return deny();
  return null;
}
