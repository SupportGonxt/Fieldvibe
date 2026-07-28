// Active Today — the single definition of "active today" shared by the four
// dashboard KPI tiles and the cron idle/nudge ladder. A person is active today
// if, since today's work-start, they have EITHER logged >=1 non-rejected
// visit/signup OR sent >=1 GPS presence heartbeat (agent_locations).
//
// This is the ONE place the definition lives — every consumer imports from here
// so "active today" and "nudge decisions" can never drift apart. Never inline
// the signup/GPS expressions again.
import { NOT_REJECTED_SQL } from './funnelService.js';

// Work-start floor for "today": 08:00 SAST = 06:00 UTC of the current UTC date.
// Deliberately identical to cron/jobs.js:checkInactiveAgents so the KPI and the
// nudge ladder measure the same window.
export function workStartUtc(now = new Date()) {
  return `${now.toISOString().slice(0, 10)} 06:00:00`;
}

// Standard test/demo user exclusion. Literal predicates (no binds). Matches the
// pair used by the Back Office roster (incentives.js) — the app has no is_test
// flag, so this id-prefix + first-name heuristic is the agreed standard.
export function notTestUserSql(alias = 'u') {
  return `AND ${alias}.id NOT LIKE 'agent-test-%' AND LOWER(TRIM(${alias}.first_name)) != 'test'`;
}

// Map a raw activity row to the public shape. Pure. signup_last / gps_last are
// SQLite UTC datetime strings ("YYYY-MM-DD HH:MM:SS"), so lexicographic order is
// chronological — the later of the two is the last activity.
export function mapActivityRow(row) {
  const signupLast = row.signup_last || null;
  const gpsLast = row.gps_last || null;
  const lastActivity = [signupLast, gpsLast].filter(Boolean).sort().pop() || null;
  return {
    id: row.id,
    name: (row.name || '').trim(),
    role: row.role,
    active: !!(signupLast || gpsLast),
    lastActivity,
  };
}

// Counts + roster from raw rows. Inactive float to the top (who needs a check-in),
// then alphabetical — mirrors the BO roster's "quiet first" convention.
export function summarize(rows) {
  const roster = (rows || []).map(mapActivityRow).sort((a, b) => {
    if (a.active !== b.active) return a.active ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  return { active: roster.filter((r) => r.active).length, total: roster.length, roster };
}

// Build the activity SQL for a set of roles + an optional scope clause on alias u.
// fieldOpsOnly restricts to field agents (agent_type); pass false for team leads,
// who are supervisors and may not carry an agent_type.
export function buildActivitySql({ roles, scopeSql = '', fieldOpsOnly = true }) {
  const rolePlaceholders = roles.map(() => '?').join(',');
  const agentType = fieldOpsOnly
    ? `AND (u.agent_type IS NULL OR u.agent_type IN ('field_ops','both'))`
    : '';
  return `
    SELECT u.id, TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')) AS name, u.role,
      MAX(vi.created_at) AS signup_last,
      (SELECT MAX(al.recorded_at) FROM agent_locations al
         WHERE al.agent_id = u.id AND al.tenant_id = u.tenant_id AND al.recorded_at >= ?) AS gps_last
    FROM users u
    LEFT JOIN visits v ON v.agent_id = u.id AND v.tenant_id = u.tenant_id
    LEFT JOIN visit_individuals vi ON vi.visit_id = v.id
       AND ${NOT_REJECTED_SQL('vi')} AND vi.created_at >= ?
    WHERE u.tenant_id = ? AND u.is_active = 1
      AND u.role IN (${rolePlaceholders})
      ${agentType}
      ${notTestUserSql('u')}
      ${scopeSql}
    GROUP BY u.id`;
}

// Run the activity query for one scope and return summarized counts + roster.
// Bind order follows the SQL text: gps subquery floor, signup join floor, tenant,
// roles..., then the caller-supplied scope binds.
export async function computeActiveToday(
  db,
  { tenantId, roles, workStart, scopeSql = '', scopeBinds = [], fieldOpsOnly = true }
) {
  const sql = buildActivitySql({ roles, scopeSql, fieldOpsOnly });
  const binds = [workStart, workStart, tenantId, ...roles, ...scopeBinds];
  const { results } = await db.prepare(sql).bind(...binds).all();
  return summarize(results);
}
