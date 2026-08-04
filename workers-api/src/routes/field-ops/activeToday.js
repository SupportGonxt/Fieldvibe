/**
 * Active Today KPI — GET /field-ops/active-today?company_id=
 * One role/company-scoped snapshot of who is active today, read by every
 * dashboard tile (Team Lead, Manager, Admin, Back Office). The definition lives
 * in services/activityToday.js so it stays identical to the cron nudge ladder.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { AGENT_ROLES } from '../../services/incentiveService.js';
import { workStartUtc, computeActiveToday } from '../../services/activityToday.js';

const app = new Hono();

// Company set the caller may see. null = unrestricted (admin/GM). An empty array
// means "scoped caller with no companies" -> sees nothing. Mirrors the scoping in
// incentives.js:/incentives/roster so the KPI agrees with the BO roster.
async function callerCompanyIds(db, { tenantId, userId, role, companyId }) {
  let ids = null; // null = no restriction
  if (!(role === 'admin' || role === 'super_admin' || role === 'general_manager')) {
    const linkRows = role === 'manager'
      ? await db.prepare('SELECT company_id FROM manager_company_links WHERE manager_id = ? AND tenant_id = ? AND is_active = 1').bind(userId, tenantId).all()
      : await db.prepare('SELECT company_id FROM agent_company_links WHERE agent_id = ? AND tenant_id = ? AND is_active = 1').bind(userId, tenantId).all();
    ids = (linkRows.results || []).map((r) => r.company_id);
  }
  if (companyId) {
    // Pill selection honored only within the caller's allowed set.
    ids = ids && !ids.includes(companyId) ? [] : [companyId];
  }
  return ids;
}

// EXISTS-on-agent_company_links scope for user alias u, matching gm.js CO_ACL.
// Team leads are linked via agent_company_links too, so this fits both rosters.
function companyScope(ids) {
  if (ids === null) return { sql: '', binds: [] };
  if (ids.length === 0) return { sql: 'AND 1 = 0', binds: [] };
  const sql = `AND EXISTS (SELECT 1 FROM agent_company_links acl
      WHERE acl.agent_id = u.id AND acl.tenant_id = u.tenant_id AND acl.is_active = 1
        AND acl.company_id IN (${ids.map(() => '?').join(',')}))`;
  return { sql, binds: [...ids] };
}

app.get('/active-today', requireRole('admin', 'general_manager', 'backoffice_admin', 'manager', 'team_lead'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');
  const companyId = c.req.query('company_id') || null;
  const now = new Date();
  const workStart = workStartUtc(now);

  let agentScope;
  let tlScope = null; // team-lead roster only for managers/admin/GM
  if (role === 'team_lead') {
    // A team lead sees only their own direct agents; no team-lead roster.
    agentScope = { sql: 'AND u.team_lead_id = ?', binds: [userId] };
  } else {
    const ids = await callerCompanyIds(db, { tenantId, userId, role, companyId });
    const scope = companyScope(ids);
    agentScope = scope;
    tlScope = scope;
  }

  const agents = await computeActiveToday(db, {
    tenantId, roles: AGENT_ROLES, workStart,
    scopeSql: agentScope.sql, scopeBinds: agentScope.binds,
  });
  const teamLeads = tlScope
    ? await computeActiveToday(db, {
        tenantId, roles: ['team_lead'], workStart,
        scopeSql: tlScope.sql, scopeBinds: tlScope.binds, fieldOpsOnly: false,
      })
    : { active: 0, total: 0, roster: [] };

  return c.json({ success: true, asOf: now.toISOString().slice(0, 10), agents, teamLeads });
});

export default app;
