/**
 * Field-Ops GM overview — one composed business KPI payload for the general_manager.
 * Pure composition over existing incentive/leaderboard/roster/bo_calls data; no new metric math.
 * Reused by GET /gm/overview (web + mobile) and generateGmDigest (thrice-daily email + notification).
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { computeIncentive, AGENT_ROLES } from '../../services/incentiveService.js';
import { getConfig } from './config.js';
import { ensureIssues } from './issues.js';
import { CONVERTED_SQL, NOT_REJECTED_SQL } from '../../services/funnelService.js';

const app = new Hono();

const NOT_REJECTED = NOT_REJECTED_SQL('vi');

// Test agents (seeded demo data) pollute every KPI — same convention as portal.
const NOT_TEST_V = `AND v.agent_id NOT LIKE 'agent-test-%'`;
const NOT_TEST_U = (alias) => `AND ${alias}.id NOT LIKE 'agent-test-%'`;

function nextMonthStart(period) {
  const [y, m] = period.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function addDay(dateStr) { return addDays(dateStr, 1); }
function minDate(a, b) { return a < b ? a : b; }
function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}
function round1(n) { return Math.round(n * 10) / 10; }

// Resolve [start, end) date bounds + today from a period keyword. end is exclusive.
// anchor (optional YYYY-MM-DD) selects a past day/week/month; clamped to today.
// prevStart/prevEnd is the equivalent window one period back, same elapsed length,
// so "vs previous" compares like-for-like even mid-period.
export function periodRange(period, nowIso, anchor) {
  const today = nowIso.slice(0, 10);
  let a = (anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) ? anchor : today;
  if (a > today) a = today;
  if (period === 'day') {
    return { start: a, end: addDay(a), today, mode: 'day', prevStart: addDays(a, -1), prevEnd: a };
  }
  if (period === 'week') {
    const d = new Date(`${a}T00:00:00Z`);
    const dow = d.getUTCDay();             // 0 Sun..6 Sat
    const back = dow === 0 ? 6 : dow - 1;  // days since Monday
    const monday = addDays(a, -back);
    const end = minDate(addDays(monday, 7), addDay(today)); // week-to-date when current
    return { start: monday, end, today, mode: 'week', prevStart: addDays(monday, -7), prevEnd: addDays(end, -7) };
  }
  const p = a.slice(0, 7);                 // month (default)
  const start = `${p}-01`;
  const end = minDate(nextMonthStart(p), addDay(today)); // month-to-date when current
  const [y, m] = p.split('-').map(Number);
  const pm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const prevStart = `${pm}-01`;
  const prevEnd = minDate(addDays(prevStart, daysBetween(start, end)), nextMonthStart(pm));
  return { start, end, today, mode: 'month', prevStart, prevEnd };
}

// SAST-hour -> digest slot label. Digest fires at 06/12/18 SAST only.
export function digestSlot(sastHour) {
  if (sastHour === 6) return 'morning';
  if (sastHour === 12) return 'midday';
  if (sastHour === 18) return 'evening';
  return null;
}

// Compose the GM overview. companyId scopes config (rate/salaries); null = tenant-wide.
// Each metric block is independently guarded so one failing query degrades to 0/[] not a 500.
export async function buildGmOverview(db, tenantId, companyId, period, anchor = null) {
  const now = new Date().toISOString();
  const { start, end, today, mode, prevStart, prevEnd } = periodRange(period, now, anchor);

  // Optional company scoping. null companyId = all companies (digest relies on this path).
  // (? IS NULL OR col = ?) keeps one SQL string; both placeholders bind companyId.
  const CO_V = `AND (? IS NULL OR v.company_id = ?)`;

  // Company-membership scoping for the team/management block. A real team_lead/
  // manager is linked to a company (agent_company_links / manager_company_links);
  // test & orphan users (e.g. Abigail Govender, test team lead, testman man) have
  // NO active link. Requiring one both splits the roster per selected company AND
  // drops the link-less users under "all companies" (companyId NULL) — one filter,
  // no name/email heuristic. Each helper binds companyId twice.
  const CO_ACL = (a) => `AND EXISTS (SELECT 1 FROM agent_company_links acl
      WHERE acl.agent_id = ${a}.id AND acl.tenant_id = ${a}.tenant_id AND acl.is_active = 1
        AND (? IS NULL OR acl.company_id = ?))`;
  const CO_MCL = (a) => `AND EXISTS (SELECT 1 FROM manager_company_links mcl
      WHERE mcl.manager_id = ${a}.id AND mcl.tenant_id = ${a}.tenant_id AND mcl.is_active = 1
        AND (? IS NULL OR mcl.company_id = ?))`;

  // Companies with visit data — feeds the customer selector.
  const { results: companies } = await db.prepare(
    `SELECT fc.id, fc.name FROM field_companies fc
     WHERE fc.tenant_id = ? AND fc.status = 'active'
       AND EXISTS (SELECT 1 FROM visits v WHERE v.company_id = fc.id AND v.tenant_id = fc.tenant_id)
     ORDER BY fc.name`
  ).bind(tenantId).all().catch(() => ({ results: [] }));

  // Funnel + revenue base (range aggregate — mirrors the pnl endpoint's agg query).
  const rate = (await getConfig(db, tenantId, companyId, 'commission_per_deposit').catch(() => 0)) || 0;
  const agg = await db.prepare(
    `SELECT COUNT(*) signups,
       SUM(CASE WHEN ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END) converted,
       SUM(CASE WHEN json_extract(vi.custom_field_values,'$.verification_status')='qualified' THEN 1 ELSE 0 END) qualified
     FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     WHERE v.tenant_id = ? AND vi.created_at >= ? AND vi.created_at < ? AND ${NOT_REJECTED} ${CO_V} ${NOT_TEST_V}`
  ).bind(tenantId, start, end, companyId, companyId).first().catch(() => null);
  const signups = agg?.signups || 0, converted = agg?.converted || 0, qualified = agg?.qualified || 0;
  // Revenue follows VERIFIED deposits, not the agent's optimistic `consumer_converted` mark.
  // A deposit only counts once the BO admin uploads its goldrush_id and reconcile matches it
  // onto a signup (verification_status='qualified'). `converted` != deposited — keep it distinct.
  const revenue = qualified * rate;

  // Same aggregate over the equivalent previous window — powers "vs previous" deltas.
  const prevAgg = await db.prepare(
    `SELECT COUNT(*) signups,
       SUM(CASE WHEN ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END) converted,
       SUM(CASE WHEN json_extract(vi.custom_field_values,'$.verification_status')='qualified' THEN 1 ELSE 0 END) qualified
     FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     WHERE v.tenant_id = ? AND vi.created_at >= ? AND vi.created_at < ? AND ${NOT_REJECTED} ${CO_V} ${NOT_TEST_V}`
  ).bind(tenantId, prevStart, prevEnd, companyId, companyId).first().catch(() => null);
  const prevSignups = prevAgg?.signups || 0, prevConverted = prevAgg?.converted || 0, prevQualified = prevAgg?.qualified || 0;

  // 14-day daily revenue trend, ending on the window's last displayed day (today for a
  // current window, the anchored day otherwise). Same table/filters as the agg query above;
  // deposits = verified-qualified signups per day, revenue = deposits × rate.
  let trend = [];
  try {
    const trendEnd = minDate(today, addDays(end, -1));
    const trendStart = addDays(trendEnd, -13);
    const { results: trendRows } = await db.prepare(
      `SELECT date(vi.created_at) d,
         SUM(CASE WHEN json_extract(vi.custom_field_values,'$.verification_status')='qualified' THEN 1 ELSE 0 END) deposits
       FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
       WHERE v.tenant_id = ? AND vi.created_at >= ? AND vi.created_at < ? AND ${NOT_REJECTED} ${CO_V} ${NOT_TEST_V}
       GROUP BY d`
    ).bind(tenantId, trendStart, addDay(trendEnd), companyId, companyId).all();
    const byDate = new Map((trendRows || []).map((r) => [r.d, r.deposits || 0]));
    for (let i = 0; i < 14; i++) {
      const date = addDays(trendStart, i);
      const deposits = byDate.get(date) || 0;
      trend.push({ date, deposits, revenue: round1(deposits * rate) });
    }
  } catch { trend = []; }

  // Costs are only coherent monthly (tiered per-agent avg + fixed salaries). Skip for day/week.
  let money = { revenue, incentiveCost: null, salaryCost: null, net: null, costsAvailable: false };
  if (mode === 'month') {
    try {
      const salaries = (await getConfig(db, tenantId, companyId, 'salaries')) || {};
      const salaryCost = Object.values(salaries).reduce((s, v) => s + (Number(v) || 0), 0);
      const monthKey = start.slice(0, 7);          // anchored month, not always current
      const refDate = minDate(today, addDays(end, -1)); // last displayed day
      const { results: ags } = await db.prepare(
        `SELECT DISTINCT v.agent_id id FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
         WHERE v.tenant_id = ? AND vi.created_at >= ? AND vi.created_at < ? ${CO_V} ${NOT_TEST_V}`
      ).bind(tenantId, start, end, companyId, companyId).all();
      let incentiveCost = 0;
      for (const { id } of ags || []) {
        const u = await db.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
        if (!u) continue;
        const inc = await computeIncentive(db, tenantId, companyId, id, u.role, monthKey, refDate);
        incentiveCost += inc.payable;
      }
      incentiveCost = round1(incentiveCost);
      money = { revenue, incentiveCost, salaryCost, net: round1(revenue - incentiveCost - salaryCost), costsAvailable: true };
    } catch { /* keep costs null on failure */ }
  }

  // Leaders (period-scoped signup leaderboard, top 5).
  const { results: leaders } = await db.prepare(
    `SELECT v.agent_id id, u.first_name||' '||u.last_name name, COUNT(*) signups,
       SUM(CASE WHEN ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END) converted
     FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id JOIN users u ON u.id = v.agent_id
     WHERE v.tenant_id = ? AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND vi.created_at >= ? AND vi.created_at < ? AND ${NOT_REJECTED} ${CO_V} ${NOT_TEST_V}
     GROUP BY v.agent_id ORDER BY signups DESC LIMIT 5`
  ).bind(tenantId, ...AGENT_ROLES, start, end, companyId, companyId).all().catch(() => ({ results: [] }));

  // Field force: active-today + roster (least active first, top 5 quiet).
  const { results: roster } = await db.prepare(
    `SELECT u.id, u.first_name||' '||u.last_name name, u.phone,
       COUNT(CASE WHEN date(vi.created_at)=? THEN 1 END) today, MAX(vi.created_at) last_activity
     FROM users u
     LEFT JOIN visits v ON v.agent_id = u.id AND v.tenant_id = u.tenant_id ${CO_V}
     LEFT JOIN visit_individuals vi ON vi.visit_id = v.id AND ${NOT_REJECTED}
     WHERE u.tenant_id = ? AND u.is_active = 1 AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND (u.agent_type IS NULL OR u.agent_type IN ('field_ops','both')) ${NOT_TEST_U('u')} ${CO_ACL('u')}
     GROUP BY u.id ORDER BY today ASC, last_activity ASC`
  ).bind(today, companyId, companyId, tenantId, ...AGENT_ROLES, companyId, companyId).all().catch(() => ({ results: [] }));
  const totalAgents = (roster || []).length;
  const activeAgents = (roster || []).filter((r) => (r.today || 0) > 0).length;
  // "Needs attention" = agents with zero activity today, not a bottom-5 ranking.
  const leastActive = (roster || []).filter((r) => (r.today || 0) === 0).slice(0, 5);

  // BO calls: agents contacted today vs summed daily targets (default 20 per BO admin).
  const contactedRow = await db.prepare(
    `SELECT COUNT(DISTINCT callee_id) c FROM bo_calls
     WHERE tenant_id = ? AND status='answered' AND date(started_at)=?
       AND (? IS NULL OR company_id = ?)`
  ).bind(tenantId, today, companyId, companyId).first().catch(() => null);
  const boCountRow = await db.prepare(
    `SELECT COUNT(*) c FROM users WHERE tenant_id = ? AND is_active = 1
       AND role IN ('admin','backoffice_admin')
       AND (agent_type IS NULL OR agent_type IN ('back_office','both'))`
  ).bind(tenantId).first().catch(() => null);
  const targetRow = await db.prepare(
    `SELECT COALESCE(SUM(daily_target),0) t FROM bo_call_targets
     WHERE tenant_id = ? AND (? IS NULL OR company_id = ?)`
  ).bind(tenantId, companyId, companyId).first().catch(() => null);
  const explicitTarget = targetRow?.t || 0;
  const target = explicitTarget > 0 ? explicitTarget : (boCountRow?.c || 0) * 20;
  const contacted = contactedRow?.c || 0;

  // Teams: agents grouped under their team_lead. Signups joined per-agent for the window,
  // plus the same rollup over the previous window for deltas.
  let teams = [];
  try {
    const agentRolePh = AGENT_ROLES.map(() => '?').join(',');
    const { results: teamRows } = await db.prepare(
      `SELECT tl.id, TRIM(tl.first_name||' '||COALESCE(tl.last_name,'')) name, tl.manager_id,
         COUNT(DISTINCT a.id) agents,
         COUNT(DISTINCT CASE WHEN vi.id IS NOT NULL THEN a.id END) active_agents,
         COUNT(vi.id) signups,
         SUM(CASE WHEN ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END) converted
       FROM users tl
       LEFT JOIN users a ON a.team_lead_id = tl.id AND a.is_active = 1
         AND a.role IN (${agentRolePh})
         AND (a.agent_type IS NULL OR a.agent_type IN ('field_ops','both')) ${NOT_TEST_U('a')}
         ${CO_ACL('a')}
       LEFT JOIN visits v ON v.agent_id = a.id AND v.tenant_id = tl.tenant_id ${CO_V}
       LEFT JOIN visit_individuals vi ON vi.visit_id = v.id
         AND vi.created_at >= ? AND vi.created_at < ? AND ${NOT_REJECTED}
       WHERE tl.tenant_id = ? AND tl.role = 'team_lead' AND tl.is_active = 1 ${CO_ACL('tl')}
       GROUP BY tl.id ORDER BY signups DESC, agents DESC`
    ).bind(...AGENT_ROLES, companyId, companyId, companyId, companyId, start, end, tenantId, companyId, companyId).all();
    const { results: prevTeamRows } = await db.prepare(
      `SELECT a.team_lead_id tid, COUNT(vi.id) signups,
         SUM(CASE WHEN ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END) converted
       FROM users a
       JOIN visits v ON v.agent_id = a.id AND v.tenant_id = a.tenant_id ${CO_V}
       JOIN visit_individuals vi ON vi.visit_id = v.id
         AND vi.created_at >= ? AND vi.created_at < ? AND ${NOT_REJECTED}
       WHERE a.tenant_id = ? AND a.team_lead_id IS NOT NULL ${NOT_TEST_U('a')}
       GROUP BY a.team_lead_id`
    ).bind(companyId, companyId, prevStart, prevEnd, tenantId).all().catch(() => ({ results: [] }));
    const prevByTeam = new Map((prevTeamRows || []).map((r) => [r.tid, r]));
    teams = (teamRows || []).map((t) => {
      const p = prevByTeam.get(t.id);
      const sign = t.signups || 0, conv = t.converted || 0;
      return {
        id: t.id, name: t.name, managerId: t.manager_id,
        agents: t.agents || 0, activeAgents: t.active_agents || 0,
        signups: sign, converted: conv,
        conversionRate: sign ? round1((conv / sign) * 100) : 0,
        prev: { signups: p?.signups || 0, converted: p?.converted || 0 },
      };
    });
  } catch { teams = []; }

  // Accountability column: open vs acted issues per person (as the issue's subject).
  // One grouped scan, joined in memory — cheaper than a correlated subquery per row.
  // ensureIssues guards a not-yet-migrated D1 (mirrors issues.js's own routes).
  try {
    await ensureIssues(db);
    const subjectIds = [...new Set([
      ...(leaders || []).map((r) => r.id),
      ...teams.map((t) => t.id),
    ].filter(Boolean))];
    let issuesBySubject = {};
    if (subjectIds.length) {
      const ph = subjectIds.map(() => '?').join(',');
      const { results: ic } = await db.prepare(
        `SELECT subject_id,
                SUM(CASE WHEN status = 'open'  THEN 1 ELSE 0 END) open_issues,
                SUM(CASE WHEN status = 'acted' THEN 1 ELSE 0 END) acted_issues
           FROM issues
          WHERE tenant_id = ? AND status != 'resolved' AND subject_id IN (${ph})
          GROUP BY subject_id`
      ).bind(tenantId, ...subjectIds).all();
      issuesBySubject = Object.fromEntries((ic || []).map((r) => [r.subject_id, r]));
    }
    for (const r of leaders || []) {
      const x = issuesBySubject[r.id] || {};
      r.open_issues = x.open_issues || 0;
      r.acted_issues = x.acted_issues || 0;
    }
    for (const t of teams) {
      const x = issuesBySubject[t.id] || {};
      t.open_issues = x.open_issues || 0;
      t.acted_issues = x.acted_issues || 0;
    }
  } catch { /* issues ledger unavailable — leaders/teams simply lack the accountability column */ }

  // Agents with no team lead — a coverage gap the GM should see.
  const unassignedRow = await db.prepare(
    `SELECT COUNT(*) c FROM users WHERE tenant_id = ? AND is_active = 1
       AND role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND (agent_type IS NULL OR agent_type IN ('field_ops','both'))
       AND team_lead_id IS NULL AND id NOT LIKE 'agent-test-%'`
  ).bind(tenantId, ...AGENT_ROLES).first().catch(() => null);
  const unassignedAgents = unassignedRow?.c || 0;

  // Managers: team-lead span plus rollup of their teams' output; lastSeen for activity.
  let managers = [];
  try {
    const { results: mgrRows } = await db.prepare(
      `SELECT m.id, TRIM(m.first_name||' '||COALESCE(m.last_name,'')) name,
         m.last_activity_at, m.last_login, COUNT(DISTINCT tl.id) team_leads
       FROM users m
       LEFT JOIN users tl ON tl.manager_id = m.id AND tl.is_active = 1 AND tl.role = 'team_lead'
         ${CO_ACL('tl')}
       WHERE m.tenant_id = ? AND m.role = 'manager' AND m.is_active = 1 ${CO_MCL('m')}
       GROUP BY m.id ORDER BY team_leads DESC`
    ).bind(companyId, companyId, tenantId, companyId, companyId).all();
    managers = (mgrRows || []).map((m) => {
      const own = teams.filter((t) => t.managerId === m.id);
      return {
        id: m.id, name: m.name, teamLeads: m.team_leads || 0,
        agents: own.reduce((s, t) => s + t.agents, 0),
        signups: own.reduce((s, t) => s + t.signups, 0),
        converted: own.reduce((s, t) => s + t.converted, 0),
        lastSeen: m.last_activity_at || m.last_login || null,
      };
    });
  } catch { managers = []; }

  // BO admins: call volume in the window from bo_calls (answered = contacted).
  let boAdmins = [];
  try {
    const { results: boRows } = await db.prepare(
      `SELECT u.id, TRIM(u.first_name||' '||COALESCE(u.last_name,'')) name,
         u.last_activity_at, u.last_login,
         COUNT(b.id) calls,
         SUM(CASE WHEN b.status='answered' THEN 1 ELSE 0 END) answered,
         COUNT(DISTINCT CASE WHEN b.status='answered' THEN b.callee_id END) reached,
         COALESCE(SUM(b.duration_s),0) duration_s
       FROM users u
       LEFT JOIN bo_calls b ON b.caller_id = u.id AND b.tenant_id = u.tenant_id
         AND b.started_at >= ? AND b.started_at < ?
         AND (? IS NULL OR b.company_id = ?)
       WHERE u.tenant_id = ? AND u.is_active = 1
         AND u.role IN ('admin','backoffice_admin')
         AND (u.agent_type IS NULL OR u.agent_type IN ('back_office','both'))
         ${CO_MCL('u')}
       GROUP BY u.id ORDER BY calls DESC, name ASC`
    ).bind(start, end, companyId, companyId, tenantId, companyId, companyId).all();
    boAdmins = (boRows || []).map((r) => ({
      id: r.id, name: r.name,
      calls: r.calls || 0, answered: r.answered || 0, reached: r.reached || 0,
      durationS: r.duration_s || 0,
      lastSeen: r.last_activity_at || r.last_login || null,
    }));
  } catch { boAdmins = []; }

  // Risk flags derived from the numbers above — no extra queries.
  const risks = [];
  const isCurrent = end > today;
  const convNow = signups ? (converted / signups) : 0;
  const convPrev = prevSignups ? (prevConverted / prevSignups) : 0;
  if (prevSignups >= 10 && signups >= 10 && convNow < convPrev * 0.7) {
    risks.push({
      id: 'conversion-drop', severity: 'high', label: 'Conversion rate dropping',
      detail: `${round1(convNow * 100)}% vs ${round1(convPrev * 100)}% previous period`,
    });
  }
  if (prevSignups >= 10 && signups < prevSignups * 0.75) {
    risks.push({
      id: 'signups-drop', severity: 'high', label: 'Signups well below previous period',
      detail: `${signups} vs ${prevSignups} previous period`,
    });
  }
  const quietTeams = teams.filter((t) => t.agents > 0 && t.signups === 0);
  if (quietTeams.length > 0) {
    risks.push({
      id: 'quiet-teams', severity: 'medium', label: `${quietTeams.length} team(s) with zero signups`,
      detail: quietTeams.slice(0, 3).map((t) => t.name).join(', ') + (quietTeams.length > 3 ? '…' : ''),
    });
  }
  if (isCurrent && totalAgents > 0 && (totalAgents - activeAgents) / totalAgents > 0.5) {
    risks.push({
      id: 'idle-agents', severity: 'medium', label: 'Over half the field force inactive today',
      detail: `${totalAgents - activeAgents} of ${totalAgents} agents with no signups today`,
    });
  }
  if (unassignedAgents > 0) {
    risks.push({
      id: 'unassigned-agents', severity: 'medium', label: `${unassignedAgents} agent(s) without a team lead`,
      detail: 'Unassigned agents are not covered by any team rollup',
    });
  }
  if (isCurrent && target > 0 && contacted < target * 0.5) {
    risks.push({
      id: 'bo-calls-behind', severity: 'medium', label: 'BO calling behind target',
      detail: `${contacted} contacted vs target ${target} today`,
    });
  }
  const staleCutoff = addDays(today, -7);
  const staleManagers = managers.filter((m) => !m.lastSeen || m.lastSeen.slice(0, 10) < staleCutoff);
  if (staleManagers.length > 0) {
    risks.push({
      id: 'managers-inactive', severity: 'medium',
      label: `${staleManagers.length} manager(s) not seen in 7+ days`,
      detail: staleManagers.slice(0, 3).map((m) => m.name).join(', ') + (staleManagers.length > 3 ? '…' : ''),
    });
  }

  return {
    period: mode,
    companyId: companyId || null,
    companies: companies || [],
    window: { start, end, prevStart, prevEnd, today, isCurrent: end > today },
    money: { ...money, prevRevenue: round1(prevQualified * rate) },
    trend,
    funnel: {
      signups, converted, qualified, commissionPerDeposit: rate,
      conversionRate: signups ? round1((converted / signups) * 100) : 0,
      prev: {
        signups: prevSignups, converted: prevConverted,
        conversionRate: prevSignups ? round1((prevConverted / prevSignups) * 100) : 0,
      },
    },
    field: { activeAgents, totalAgents, leastActive, unassignedAgents },
    leaders: leaders || [],
    calls: { contacted, target },
    teams,
    management: { managers, boAdmins },
    risks,
  };
}

// Whole days since a D1 timestamp ('YYYY-MM-DD HH:MM:SS' UTC, no zone marker). null-safe.
export function ageDays(iso, nowMs = Date.now()) {
  if (!iso) return null;
  const t = Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return isNaN(t) ? null : Math.max(0, Math.floor((nowMs - t) / 86400000));
}

// Merge grouped 7d/30d metric rows (each keyed by uid) onto the BO-admin roster.
// Pure — unit-tested in gm.test.js. Rows carry *7/*30 columns from the SQL below.
export function shapeBoPerformance(admins, { photos = [], calls = [], issues = [] } = {}) {
  const by = (rows) => new Map((rows || []).map((r) => [r.uid, r]));
  const p = by(photos), c = by(calls), i = by(issues);
  return (admins || []).map((a) => {
    const ph = p.get(a.id) || {}, ca = c.get(a.id) || {}, is = i.get(a.id) || {};
    const win = (k) => {
      const photosApproved = ph[`approved${k}`] || 0, photosRejected = ph[`rejected${k}`] || 0;
      const boCalls = ca[`calls${k}`] || 0, answered = ca[`answered${k}`] || 0;
      const issuesActed = is[`acted${k}`] || 0;
      return {
        photosApproved, photosRejected, calls: boCalls, answered, issuesActed,
        total: photosApproved + photosRejected + boCalls + issuesActed,
      };
    };
    return { id: a.id, name: a.name, lastSeen: a.last_activity_at || a.last_login || null, d7: win(7), d30: win(30) };
  }).sort((x, y) => y.d30.total - x.d30.total || x.name.localeCompare(y.name));
}

// GET /gm/bo-performance — per-BO-admin operational throughput, last 7 + 30 days.
// Only actor-attributable actions: photo reviews (visit_photos.reviewed_by), calls
// (bo_calls.caller_id), issue actions (issues.acted_by). Deposit ingest, reconcile
// promotions and commission approvals carry no actor column in D1, so they surface
// only as shared queue depth (unmatched deposits), never per admin.
app.get('/gm/bo-performance', requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const nowMs = Date.now();
  const d7 = new Date(nowMs - 7 * 86400000).toISOString().slice(0, 10);
  const d30 = new Date(nowMs - 30 * 86400000).toISOString().slice(0, 10);
  try {
    // Roster: same population as buildGmOverview's boAdmins block (active manager_company_link
    // required — drops test/orphan users without a name heuristic).
    const { results: admins } = await db.prepare(
      `SELECT u.id, TRIM(u.first_name||' '||COALESCE(u.last_name,'')) name, u.last_activity_at, u.last_login
       FROM users u
       WHERE u.tenant_id = ? AND u.is_active = 1
         AND u.role IN ('admin','backoffice_admin')
         AND (u.agent_type IS NULL OR u.agent_type IN ('back_office','both'))
         AND EXISTS (SELECT 1 FROM manager_company_links mcl
           WHERE mcl.manager_id = u.id AND mcl.tenant_id = u.tenant_id AND mcl.is_active = 1)
       ORDER BY name`
    ).bind(tenantId).all().catch(() => ({ results: [] }));

    // Each block guarded like buildGmOverview: a missing table/column degrades to zeros.
    // Photo review decisions (reviewed_at is datetime('now'); >= 'YYYY-MM-DD' compares fine).
    const { results: photos } = await db.prepare(
      `SELECT reviewed_by uid,
         SUM(CASE WHEN review_status='approved' THEN 1 ELSE 0 END) approved30,
         SUM(CASE WHEN review_status='rejected' THEN 1 ELSE 0 END) rejected30,
         SUM(CASE WHEN review_status='approved' AND reviewed_at >= ? THEN 1 ELSE 0 END) approved7,
         SUM(CASE WHEN review_status='rejected' AND reviewed_at >= ? THEN 1 ELSE 0 END) rejected7
       FROM visit_photos
       WHERE tenant_id = ? AND reviewed_by IS NOT NULL AND reviewed_at >= ?
       GROUP BY reviewed_by`
    ).bind(d7, d7, tenantId, d30).all().catch(() => ({ results: [] }));

    const { results: boCalls } = await db.prepare(
      `SELECT caller_id uid, COUNT(*) calls30,
         SUM(CASE WHEN status='answered' THEN 1 ELSE 0 END) answered30,
         SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) calls7,
         SUM(CASE WHEN status='answered' AND started_at >= ? THEN 1 ELSE 0 END) answered7
       FROM bo_calls WHERE tenant_id = ? AND started_at >= ?
       GROUP BY caller_id`
    ).bind(d7, d7, tenantId, d30).all().catch(() => ({ results: [] }));

    let issueRows = [];
    try {
      await ensureIssues(db);
      const { results } = await db.prepare(
        `SELECT acted_by uid, COUNT(*) acted30,
           SUM(CASE WHEN acted_at >= ? THEN 1 ELSE 0 END) acted7
         FROM issues WHERE tenant_id = ? AND acted_by IS NOT NULL AND acted_at >= ?
         GROUP BY acted_by`
      ).bind(d7, tenantId, d30).all();
      issueRows = results || [];
    } catch { /* issues ledger unavailable */ }

    // Shared queues (no per-admin assignment exists) — depth + oldest-item age.
    const photoQ = await db.prepare(
      `SELECT COUNT(*) depth, MIN(created_at) oldest FROM visit_photos
       WHERE tenant_id = ? AND review_status = 'pending'`
    ).bind(tenantId).first().catch(() => null);
    // Unmatched deposit facts = the BO "chase" queue (same GID expression as deposits.js).
    const GID_VI = `COALESCE(json_extract(vi.custom_field_values,'$.goldrush_id_entry'),
                             json_extract(vi.custom_field_values,'$.goldrush_id'))`;
    const depositQ = await db.prepare(
      `SELECT COUNT(*) depth, MIN(mf.created_at) oldest FROM metric_facts mf
       WHERE mf.tenant_id = ? AND mf.metric_key = 'deposits'
         AND NOT EXISTS (SELECT 1 FROM visit_individuals vi
           WHERE vi.tenant_id = mf.tenant_id AND ${GID_VI} = mf.subject_key)`
    ).bind(tenantId).first().catch(() => null);

    return c.json({
      success: true,
      since: { d7, d30 },
      admins: shapeBoPerformance(admins, { photos, calls: boCalls, issues: issueRows }),
      queues: {
        photoReview: { depth: photoQ?.depth || 0, oldestDays: ageDays(photoQ?.oldest, nowMs) },
        unmatchedDeposits: { depth: depositQ?.depth || 0, oldestDays: ageDays(depositQ?.oldest, nowMs) },
      },
    });
  } catch (error) {
    console.error(`Error building BO performance tenant=${tenantId}:`, error);
    return c.json({ success: false, error: 'Could not build BO performance' }, 500);
  }
});

// GET /gm/overview?period=day|week|month&anchor=YYYY-MM-DD&company_id=
app.get('/gm/overview', requireRole('admin', 'general_manager'), async (c) => {
  const tenantId = c.get('tenantId');
  const period = c.req.query('period') || 'day';
  const anchor = c.req.query('anchor') || null;
  const companyId = c.req.query('company_id') || null;
  try {
    const overview = await buildGmOverview(c.env.DB, tenantId, companyId, period, anchor);
    return c.json({ success: true, ...overview });
  } catch (error) {
    // buildGmOverview runs many sequential D1 queries; a single one throwing (e.g. a
    // large-tenant window hitting a query error) surfaced as an opaque 500 with no log,
    // reading as a random "Could not load" on the Business Overview page. Log the real
    // cause so wrangler tail names the failing query; the client already retries this 500.
    console.error(`Error building GM overview tenant=${tenantId} period=${period} company=${companyId}:`, error);
    return c.json({ success: false, error: 'Could not build the GM overview' }, 500);
  }
});

export default app;
