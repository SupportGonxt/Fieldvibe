// workers-api/src/routes/field-ops/kpi.js
// Cockpit KPI endpoints. Pure helpers (resolveRoleKpiKey) unit-tested; DB endpoints
// aggregate-on-read via kpiSignals. Auth context: middleware sets userId/tenantId/role
// individually (no `auth` object, no companyId in token); companyId comes from ?company_id=.
import { Hono } from 'hono';
import { getConfig } from './config.js';
import { aggregateKpis, evaluateSignals, signalBelowGate, evaluateBoSignals, SIGNAL_REGISTRY } from '../../services/kpiSignals.js';
import { rootCauseSignals } from '../../services/rootCauseSignals.js';
import { requireRole } from '../../middleware/auth.js';
import { AGENT_ROLES, computeIncentive } from '../../services/incentiveService.js';
import { severityOf } from '../../services/issueEngine.js';
import { coachingNoteRow, doNote, doNudge } from './issues.js';
import { CONVERTED_SQL } from '../../services/funnelService.js';

export function resolveRoleKpiKey(role) {
  if (role === 'team_lead') return 'kpi.team_lead';
  if (role === 'manager') return 'kpi.manager';
  if (role === 'general_manager') return 'kpi.general_manager';
  if (role === 'backoffice_admin') return 'kpi.backoffice_admin';
  return 'kpi.agent'; // agent, field_agent, sales_rep, and unknown
}

// backoffice_admin queue-health signals, sourced from their own issues.stats aggregate
// (response/open aging) — reconciliation aging is a separate deposits-table concern the
// caller (reactToIssues cron) supplies via oldestReconHours; this helper only shapes the query.
export async function boAdminSignals(db, tenantId, boAdminId, thresholds) {
  const row = await db.prepare(
    `SELECT AVG((julianday(COALESCE(acted_at, datetime('now'))) - julianday(opened_at)) * 1440) avg_response_mins,
            MAX((julianday('now') - julianday(opened_at)) * 24) oldest_open_hours
     FROM issues WHERE tenant_id = ? AND owner_id = ? AND status != 'resolved'`
  ).bind(tenantId, boAdminId).first();
  return evaluateBoSignals({
    avgResponseMins: row?.avg_response_mins ?? null,
    oldestOpenHours: row?.oldest_open_hours ?? null,
  }, thresholds);
}

// Per-day rows for one or more agents over a window (summed per date).
// company_id may be NULL (goldrush legacy).
async function dailyRows(db, tenantId, agentIds, sinceDate) {
  const ids = Array.isArray(agentIds) ? agentIds : [agentIds];
  if (!ids.length) return [];
  return (await db.prepare(
    // vi/vp pre-aggregated to one row per visit → the joins are 1:1, no fan-out.
    // surveys/qualified stay individual-grain (summed/OR-ed inside the vi subquery);
    // board placement + sample-board match score live on visit_photos, not visits —
    // vp rolls a visit's photos up to has_board + best match_score per visit.
    `SELECT v.visit_date date,
            COUNT(v.id) visits,
            SUM(CASE WHEN LOWER(v.visit_type)='individual' THEN 1 ELSE 0 END) signups,
            SUM(COALESCE(vi.qualified_flag, 0)) qualified,
            SUM(COALESCE(vp.has_board, 0)) boards,
            SUM(COALESCE(vi.surveys, 0)) surveys,
            SUM(CASE WHEN vp.match_score IS NOT NULL THEN vp.match_score ELSE 0 END) quality_sum,
            SUM(CASE WHEN vp.match_score IS NOT NULL THEN 1 ELSE 0 END) quality_n
     FROM visits v
     LEFT JOIN (
       SELECT visit_id,
              SUM(CASE WHEN survey_completed = 1 THEN 1 ELSE 0 END) surveys,
              MAX(CASE WHEN ${CONVERTED_SQL('visit_individuals')} THEN 1 ELSE 0 END) qualified_flag
       FROM visit_individuals GROUP BY visit_id
     ) vi ON vi.visit_id = v.id
     LEFT JOIN (
       SELECT visit_id,
              MAX(CASE WHEN board_placement_location IS NOT NULL THEN 1 ELSE 0 END) has_board,
              MAX(sample_board_match_score) match_score
       FROM visit_photos GROUP BY visit_id
     ) vp ON vp.visit_id = v.id
     WHERE v.tenant_id=? AND v.agent_id IN (${ids.map(() => '?').join(',')}) AND v.visit_date>=? AND v.status='completed'
     GROUP BY v.visit_date
     ORDER BY v.visit_date`
  ).bind(tenantId, ...ids, sinceDate).all()).results ?? [];
}

// Per-visit rows (check-in time + GPS) for root-cause (GPS/time) signals.
// Separate from dailyRows: that sums per day and drops the timestamps/coords these need.
async function visitDetailRows(db, tenantId, agentIds, sinceDate) {
  const ids = Array.isArray(agentIds) ? agentIds : [agentIds];
  if (!ids.length) return [];
  return (await db.prepare(
    `SELECT visit_date, check_in_time, latitude, longitude
     FROM visits
     WHERE tenant_id=? AND agent_id IN (${ids.map(() => '?').join(',')})
       AND visit_date>=? AND status='completed' AND check_in_time IS NOT NULL
     ORDER BY visit_date, check_in_time`
  ).bind(tenantId, ...ids, sinceDate).all()).results ?? [];
}

// Aggregate one agent's KPIs + signals over a window. Shared by roster + tenant-signals + reactToIssues cron.
export async function agentSignals(db, tenantId, id, thresholds, since) {
  const rows = await dailyRows(db, tenantId, id, since);
  const actual = aggregateKpis(rows);
  const baseline = aggregateKpis(rows.slice(0, Math.ceil(rows.length / 2)));
  const lastVisit = rows.length ? rows[rows.length - 1].date : null;
  const daysSinceLastVisit = lastVisit
    ? Math.floor((Date.now() - Date.parse(lastVisit)) / 86400000) : 999;
  const signals = evaluateSignals({ actual, baseline, daysSinceLastVisit, thresholds });
  if (actual.days > 0)
    signals.push(...rootCauseSignals(await visitDetailRows(db, tenantId, id, since), thresholds));
  // baseline returned for the cron's v2 trend signals — same pair evaluateSignals reads.
  return { actual, baseline, signals };
}

const app = new Hono();

app.get('/kpi/self', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');
  const companyId = c.req.query('company_id') || null;
  const key = resolveRoleKpiKey(role);
  const thresholds = (await getConfig(db, tenantId, companyId, key)) || {};
  const windowDays = thresholds.baseline_window_days || 14;
  // Parse 'today' once; a malformed value falls back to now for every derived date below.
  const todayMs = Date.parse(c.req.query('today') || '') || Date.now();
  const since = new Date(todayMs);
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().slice(0, 10);

  // team_lead/manager KPIs aggregate their people's visits, not their own
  const scopeIds = await kpiScopeIds(db, tenantId, userId, role);
  const rows = await dailyRows(db, tenantId, scopeIds, sinceStr);
  const actual = aggregateKpis(rows);
  // baseline = first half of window, recent = whole window (self-relative)
  const baseline = aggregateKpis(rows.slice(0, Math.ceil(rows.length / 2)));
  const lastVisit = rows.length ? rows[rows.length - 1].date : null;
  const daysSinceLastVisit = lastVisit
    ? Math.floor((Date.now() - Date.parse(lastVisit)) / 86400000) : 999;
  const signals = evaluateSignals({ actual, baseline, daysSinceLastVisit, thresholds });
  if (actual.days > 0)
    signals.push(...rootCauseSignals(await visitDetailRows(db, tenantId, scopeIds, sinceStr), thresholds));

  // Registry-driven metric tiles (visibility:'all' gate metrics) + below_gate pace signal.
  const registry = (await getConfig(db, tenantId, companyId, 'metrics')) || [];
  const gateMetrics = registry.filter((m) => m.gate && m.visibility === 'all');
  let metrics = [];
  if (gateMetrics.length && actual.days > 0) {
    // per-working-day averages + this person's next-tier shortfall, via the shared engine.
    const asOf = new Date(todayMs).toISOString().slice(0, 10);
    const period = c.req.query('period') || asOf.slice(0, 7);
    const inc = await computeIncentive(db, tenantId, companyId, userId, role, period, asOf);
    const avgByMetric = inc?.metricByKey || {};
    const ng = inc?.nextTier || null;
    metrics = gateMetrics.map((m) => ({
      key: m.key,
      label: m.label,
      value: avgByMetric[m.key] ?? 0,
      target: ng?.targets?.[m.key] ?? null,
      shortfall: ng?.shortfall?.[m.key] ?? 0,
    }));
    // nextTier.shortfall/targets come straight from incentive-scale tier config, unfiltered
    // by registry visibility — restrict to gate metrics (visibility:'all') before this reaches
    // signalBelowGate, so an admin-configured tier target on a gm-only metric can't surface here.
    const allowedKeys = new Set(gateMetrics.map((m) => m.key));
    const gatedNg = ng
      ? {
          ...ng,
          shortfall: Object.fromEntries(Object.entries(ng.shortfall || {}).filter(([k]) => allowedKeys.has(k))),
          targets: Object.fromEntries(Object.entries(ng.targets || {}).filter(([k]) => allowedKeys.has(k))),
        }
      : null;
    signals.push(...signalBelowGate({ nextGate: gatedNg }));
  }
  return c.json({ actual, thresholds, signals, metrics });
});

export function rankRoster(agents) {
  return [...agents].sort((x, y) => {
    const bySignals = (y.signals?.length || 0) - (x.signals?.length || 0);
    if (bySignals !== 0) return bySignals;
    return (x.actual?.signups_per_day || 0) - (y.actual?.signups_per_day || 0);
  });
}

// Visit scope for a user's own KPIs: team_lead → whole team's agents,
// manager → all agents under their team leads, else (or empty team) self.
async function kpiScopeIds(db, tenantId, userId, role) {
  let ids = [];
  if (role === 'team_lead') {
    ids = await teamMemberIds(db, tenantId, userId, 'team_lead');
  } else if (role === 'manager') {
    ids = (await db.prepare(
      `SELECT a.id FROM users a JOIN users tl ON a.team_lead_id=tl.id
       WHERE a.tenant_id=? AND tl.manager_id=?`
    ).bind(tenantId, userId).all()).results.map(r => r.id);
  }
  return ids.length ? ids : [userId];
}

async function teamMemberIds(db, tenantId, me, role) {
  if (role === 'team_lead') {
    return (await db.prepare(
      `SELECT id FROM users WHERE tenant_id=? AND team_lead_id=?`).bind(tenantId, me).all()
    ).results.map(r => r.id);
  }
  // manager: direct reports (manager_id); company links resolved via manager_id chain
  return (await db.prepare(
    `SELECT DISTINCT u.id FROM users u WHERE u.tenant_id=? AND u.manager_id=?`
  ).bind(tenantId, me).all()).results.map(r => r.id);
}

app.get('/kpi/roster', requireRole('team_lead', 'manager', 'admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');
  const companyId = c.req.query('company_id') || null;
  const memberIds = await teamMemberIds(db, tenantId, userId, role);
  const thresholds = (await getConfig(db, tenantId, companyId, 'kpi.agent')) || {};
  const windowDays = thresholds.baseline_window_days || 14;
  const since = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);

  const agents = [];
  for (const id of memberIds) {
    // manager roster rows = team leads, each scored by their whole team's output
    const scope = role === 'manager' ? await kpiScopeIds(db, tenantId, id, 'team_lead') : id;
    const { actual, signals } = await agentSignals(db, tenantId, scope, thresholds, since);
    const u = await db.prepare(`SELECT first_name||' '||last_name name FROM users WHERE id=?`).bind(id).first();
    const liveIssue = await db.prepare(
      `SELECT id FROM issues WHERE tenant_id=? AND subject_id=? AND status != 'resolved' ORDER BY severity DESC LIMIT 1`
    ).bind(tenantId, id).first();
    agents.push({ agentId: id, name: u?.name || id, actual, signals, issueId: liveIssue?.id ?? null });
  }
  return c.json({ roster: rankRoster(agents) });
});

// Tenant-wide signal roll-up for the GM overview cockpit tile. GM-only (mirrors gm.js gate).
// Counts, per signal type, how many active field agents are currently triggering it.
app.get('/kpi/tenant-signals', requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.req.query('company_id') || null;
  const thresholds = (await getConfig(db, tenantId, companyId, 'kpi.agent')) || {};
  const windowDays = thresholds.baseline_window_days || 14;
  const since = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);
  const agents = (await db.prepare(
    // NULL || x is NULL in SQLite — COALESCE both halves or a missing surname erases the whole name.
    // Company scope via agent_company_links (mirrors gm.js CO_ACL): without it totalAgents/
    // flaggedAgents/counts sum every field agent across all companies in the tenant (the "67" leak).
    // companyId NULL = all companies; still drops link-less test/orphan users, matching gm.js.
    `SELECT id, TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) name
       FROM users u WHERE tenant_id=? AND is_active=1 AND role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND (agent_type IS NULL OR agent_type IN ('field_ops','both'))
       AND EXISTS (SELECT 1 FROM agent_company_links acl
         WHERE acl.agent_id = u.id AND acl.tenant_id = u.tenant_id AND acl.is_active = 1
           AND (? IS NULL OR acl.company_id = ?))`
  ).bind(tenantId, ...AGENT_ROLES, companyId, companyId).all()).results ?? [];

  const counts = Object.fromEntries(Object.keys(SIGNAL_REGISTRY).map((k) => [k, 0]));
  const flagged = [];
  for (const { id, name } of agents) {
    const { signals } = await agentSignals(db, tenantId, id, thresholds, since);
    if (signals.length) flagged.push({ id, name, signals, severity: severityOf(signals.map((s) => s.type)) });
    for (const s of signals) if (s.type in counts) counts[s.type]++;
  }
  flagged.sort((a, b) => b.severity - a.severity); // worst-first, same ranking the issue ladder uses
  // counts/flaggedAgents/totalAgents kept verbatim — the web GmOverviewPage tile reads them.
  return c.json({ counts, flaggedAgents: flagged.length, totalAgents: agents.length, flagged });
});

// --- Remediation (Task 2.5) ---
// Thin wrappers over issues.js's action handlers/coachingNoteRow — kept at their original
// URL/body shape (agentId in body, no issue) so existing callers (TeamCockpit.tsx,
// useRemediate.ts) need zero changes. coachingNoteRow re-exported here for kpiRoster.test.js.
export { coachingNoteRow };

app.post(
  '/kpi/remediate/note',
  requireRole('admin', 'super_admin', 'manager', 'team_lead', 'backoffice_admin'),
  async (c) => {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const companyId = c.req.query('company_id') || null;
    const body = await c.req.json();
    const result = await doNote({ db, tenantId, companyId, userId, body, issue: null });
    const { httpStatus = 200, ...rest } = result;
    return c.json(rest, httpStatus);
  }
);

// Nudging writes a notification addressed to someone else, so it is a supervisor-only action.
app.post(
  '/kpi/remediate/nudge',
  requireRole('admin', 'super_admin', 'manager', 'team_lead', 'backoffice_admin'),
  async (c) => {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const body = await c.req.json();
    const result = await doNudge({ db, env: c.env, tenantId, userId, body, issue: null });
    const { httpStatus = 200, ...rest } = result;
    return c.json(rest, httpStatus);
  }
);

export default app;
