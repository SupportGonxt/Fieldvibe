// Agent-set scoping for report queries.
//
// D1 caps a single statement at 100 bound parameters. Several report queries used to
// resolve an agent set in JS and then inline it as `agent_id IN (?,?,?...)`, one
// parameter per agent. That works until a company or team crosses ~97 members, at
// which point the statement exceeds the limit and D1 rejects the query outright — the
// report does not get slower, it fails. Goldrush is already well past that line.
//
// Expressing the same set as a subquery keeps the parameter count constant no matter
// how many agents there are, and lets SQLite resolve the set through an index instead
// of materialising a long IN list. It also removes the separate round trip that existed
// only to fetch the ids.
//
// Each helper returns { sql, binds } so a call site can splice both into an existing
// WHERE clause without disturbing the order of the surrounding parameters.

// Agents linked to one company. Mirrors:
//   SELECT agent_id FROM agent_company_links WHERE tenant_id = ? AND company_id = ? AND is_active = 1
// Used where a report is scoped by company via the link table rather than
// visits.company_id (Goldrush visits can have a NULL company_id).
function companyAgentScope(tenantId, companyId) {
  return {
    sql: '(SELECT acl.agent_id FROM agent_company_links acl WHERE acl.tenant_id = ? AND acl.company_id = ? AND acl.is_active = 1)',
    binds: [tenantId, companyId],
  };
}

// A team lead plus their active direct reports. Mirrors the old
//   [leadId, ...(SELECT id FROM users WHERE team_lead_id = leadId AND is_active = 1)]
// including the detail that the lead is included unconditionally, whether or not the
// lead's own row is active.
function teamMemberScope(tenantId, leadId) {
  return {
    sql: '(SELECT ? UNION SELECT u2.id FROM users u2 WHERE u2.tenant_id = ? AND u2.team_lead_id = ? AND u2.is_active = 1)',
    binds: [leadId, tenantId, leadId],
  };
}

export { companyAgentScope, teamMemberScope };
