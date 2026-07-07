/**
 * Org hierarchy resolver.
 * Chain (top->bottom): general_manager -> manager (users.gm_id)
 *                       manager -> team_lead (users.manager_id)
 *                       team_lead -> agent (users.team_lead_id)
 * Agent roles: agent | field_agent | sales_rep.
 */
const AGENT_ROLES = ['agent', 'field_agent', 'sales_rep'];

// Which FK column links a report to a parent of the given role.
function childLinkColumn(role) {
  switch (role) {
    case 'general_manager': return 'gm_id';       // managers point up via gm_id
    case 'manager': return 'manager_id';          // team_leads via manager_id
    case 'team_lead': return 'team_lead_id';      // agents via team_lead_id
    default: return null;                         // agents/others have no reports
  }
}

// Immediate reports of userId (rows: id, role, first_name, last_name).
export async function directReports(db, tenantId, userId, role) {
  const col = childLinkColumn(role);
  if (!col) return [];
  const { results } = await db.prepare(
    `SELECT id, role, first_name, last_name FROM users
     WHERE tenant_id = ? AND ${col} = ? AND is_active = 1`
  ).bind(tenantId, userId).all();
  return results || [];
}

// All descendant user ids (inclusive=false by default), walking down the chain.
export async function subtreeUserIds(db, tenantId, userId, role, { includeSelf = false } = {}) {
  const acc = new Set();
  if (includeSelf) acc.add(userId);
  // BFS over the org tree; depth bounded by role chain (<=3) so this stays cheap.
  let frontier = [{ id: userId, role }];
  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      const reports = await directReports(db, tenantId, node.id, node.role);
      for (const r of reports) {
        if (acc.has(r.id)) continue;
        acc.add(r.id);
        if (!AGENT_ROLES.includes(r.role)) next.push({ id: r.id, role: r.role });
      }
    }
    frontier = next;
  }
  return [...acc];
}

// Agent ids under a subtree (leaf sales staff only) — the set that produces signups.
export async function subtreeAgentIds(db, tenantId, userId, role) {
  const ids = await subtreeUserIds(db, tenantId, userId, role);
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  const { results } = await db.prepare(
    `SELECT id FROM users WHERE tenant_id = ? AND id IN (${ph})
     AND role IN (${AGENT_ROLES.map(() => '?').join(',')})`
  ).bind(tenantId, ...ids, ...AGENT_ROLES).all();
  return (results || []).map((r) => r.id);
}

export { AGENT_ROLES };
