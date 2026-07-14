/**
 * Field-Ops Incentives — hero display, personal incentive, leaderboard, period close.
 * All metrics come from incentiveService over the live visit_individuals model.
 * Period defaults to the current UTC month ('YYYY-MM'); asOf defaults to today.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { computeIncentive, AGENT_ROLES, writePayable, extractGoldrushIds, readTargets } from '../../services/incentiveService.js';
import { getConfig } from './config.js';
import { CONVERTED_SQL, VERIFIED_SQL, NOT_REJECTED_SQL } from '../../services/funnelService.js';

const app = new Hono();

// current month + today from an ISO now string passed by the request (Workers has Date at runtime)
function periodOf(iso) { return iso.slice(0, 7); }

// Resolve the company an agent captures for (most recent visit company), for config scoping.
async function agentCompany(db, tenantId, agentId) {
  const row = await db.prepare(
    `SELECT company_id FROM visits WHERE tenant_id = ? AND agent_id = ? AND company_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`
  ).bind(tenantId, agentId).first();
  return row?.company_id || null;
}

// GET /incentives/me?period=&company_id= — full incentive breakdown for the caller.
app.get('/incentives/me', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');
  const now = new Date().toISOString();
  const period = c.req.query('period') || periodOf(now);
  const asOf = c.req.query('as_of') || now.slice(0, 10);
  const companyId = c.req.query('company_id') || (await agentCompany(db, tenantId, userId));
  const inc = await computeIncentive(db, tenantId, companyId, userId, role, period, asOf);
  return c.json({ success: true, incentive: inc });
});

// GET /incentives/hero?company_id= — compact hero stats for the fast-entry PWA.
// today / week / month counts, provisional pace payable, next tier gap, and rank among peers.
app.get('/incentives/hero', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');
  const now = new Date().toISOString();
  const period = periodOf(now);
  const today = now.slice(0, 10);
  const companyId = c.req.query('company_id') || (await agentCompany(db, tenantId, userId));

  // month metric + tiers via the shared engine
  const inc = await computeIncentive(db, tenantId, companyId, userId, role, period, today);

  // today count: visit_individuals created today for this agent (non-rejected)
  const todayRow = await db.prepare(
    `SELECT COUNT(*) c FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     WHERE v.tenant_id = ? AND v.agent_id = ? AND date(vi.created_at) = ?
       AND ${NOT_REJECTED_SQL('vi')}`
  ).bind(tenantId, userId, today).first();

  // week count: since Monday of this week (UTC)
  const d = new Date(now);
  const dow = d.getUTCDay(); // 0 Sun..6 Sat
  const back = dow === 0 ? 6 : dow - 1;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back))
    .toISOString().slice(0, 10);
  const weekRow = await db.prepare(
    `SELECT COUNT(*) c FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     WHERE v.tenant_id = ? AND v.agent_id = ? AND date(vi.created_at) >= ?
       AND ${NOT_REJECTED_SQL('vi')}`
  ).bind(tenantId, userId, monday).first();

  // rank among peer agents for this period (only meaningful for agent roles)
  let rank = null, totalPeers = null;
  if (AGENT_ROLES.includes(role)) {
    const { start, end } = { start: `${period}-01`, end: nextMonthStart(period) };
    const { results } = await db.prepare(
      `SELECT v.agent_id, COUNT(*) c FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
       JOIN users u ON u.id = v.agent_id
       WHERE v.tenant_id = ? AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
         AND vi.created_at >= ? AND vi.created_at < ?
         AND ${NOT_REJECTED_SQL('vi')}
       GROUP BY v.agent_id ORDER BY c DESC`
    ).bind(tenantId, ...AGENT_ROLES, start, end).all();
    totalPeers = (results || []).length;
    const idx = (results || []).findIndex((r) => r.agent_id === userId);
    rank = idx >= 0 ? idx + 1 : null;
  }

  const next = inc.nextTier;
  return c.json({
    success: true,
    hero: {
      period,
      today: todayRow?.c || 0,
      week: weekRow?.c || 0,
      month: inc.count,
      converted: inc.converted,
      deposits: inc.deposits,
      provisionalSignups: inc.provisionalSignups, // avg signups/day
      provisionalDeposits: inc.provisionalDeposits, // avg deposits/day
      provisionalPace: inc.provisionalPace, // R on track at current pace
      payable: inc.payable,                 // R already qualified
      baseSalary: inc.baseSalary,
      nextTier: next,                        // { amount, targets, shortfall } | null
      toNextSignups: next ? round1(next.shortfall?.signups ?? 0) : null, // avg/day signup gap to next tier
      toNextDeposits: next ? round1(next.shortfall?.deposits ?? 0) : null, // avg/day deposit gap to next tier
      rank,
      totalPeers,
      tiers: (inc.tiers || []).map((t) => ({ amount: t.amount, ...readTargets(t) })), // wire shape stays flat {amount, signups, deposits}; readTargets normalizes new {targets:{…}} rows
    },
  });
});

// GET /leaderboard?period=&limit= — agents ranked by period signup count.
// Respects program_config.leaderboard_visible (default true); admins/managers always see it.
app.get('/leaderboard', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const now = new Date().toISOString();
  const period = c.req.query('period') || periodOf(now);
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);

  const visible = await getConfig(db, tenantId, null, 'leaderboard_visible');
  const privileged = ['admin', 'general_manager', 'manager', 'team_lead'].includes(role);
  if (visible === false && !privileged) {
    return c.json({ success: true, leaderboard: [], hidden: true });
  }

  const start = `${period}-01`;
  const end = nextMonthStart(period);
  const { results } = await db.prepare(
    `SELECT v.agent_id AS id, u.first_name || ' ' || u.last_name AS name, COUNT(*) AS signups,
            SUM(CASE WHEN ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END) AS converted
     FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     JOIN users u ON u.id = v.agent_id
     WHERE v.tenant_id = ? AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND vi.created_at >= ? AND vi.created_at < ?
       AND ${NOT_REJECTED_SQL('vi')}
     GROUP BY v.agent_id ORDER BY signups DESC LIMIT ?`
  ).bind(tenantId, ...AGENT_ROLES, start, end, limit).all();

  const board = (results || []).map((r, i) => ({ rank: i + 1, ...r }));
  return c.json({ success: true, period, leaderboard: board });
});

// POST /incentives/close  body: { period, company_id?, role? } — write provisional payables
// to commission_earnings for all agents (true-up only). Reconciliation (Phase 4) re-runs with qualified.
const adminOnly = requireRole('admin', 'general_manager');
app.post('/incentives/close', adminOnly, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => ({}));
  const now = new Date().toISOString();
  const period = body.period || periodOf(now);
  const companyId = body.company_id ?? null;
  const asOf = body.as_of || now.slice(0, 10);

  // every agent that produced a signup this period
  const start = `${period}-01`, end = nextMonthStart(period);
  const { results } = await db.prepare(
    `SELECT DISTINCT v.agent_id id FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     WHERE v.tenant_id = ? AND vi.created_at >= ? AND vi.created_at < ?`
  ).bind(tenantId, start, end).all();

  let written = 0;
  for (const { id } of results || []) {
    const u = await db.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
    if (!u) continue;
    const inc = await computeIncentive(db, tenantId, companyId, id, u.role, period, asOf);
    if (inc.payable > 0) {
      await writePayable(db, tenantId, id, period, inc.payable, 'incentive');
      written++;
    }
  }
  return c.json({ success: true, period, written });
});

// POST /incentives/reconcile — BO/admin uploads the Goldrush-confirmed IDs; promote matching
// signups provisional -> qualified. No clawback: only ever promotes, never demotes (already-paid
// qualified rows and BO-rejected rows are left untouched). Idempotent.
// body: { goldrush_ids?: string[], csv?: string, dry_run?: boolean }
app.post('/incentives/reconcile', requireRole('admin', 'general_manager', 'backoffice_admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => ({}));

  // Collect 9-digit Goldrush IDs from an explicit array and/or a pasted CSV/text blob.
  const list = extractGoldrushIds(body);
  if (list.length === 0) {
    return c.json({ success: false, error: 'No 9-digit Goldrush IDs found in the upload' }, 400);
  }

  // goldrush id lives at custom_field_values.goldrush_id_entry (fast-entry) or .goldrush_id (legacy)
  const gid = `COALESCE(json_extract(custom_field_values,'$.goldrush_id_entry'),
                        json_extract(custom_field_values,'$.goldrush_id'))`;
  const placeholders = list.map(() => '?').join(',');

  // Which uploaded IDs actually exist as signups? Report the rest back to BO for chasing.
  const { results: found } = await db.prepare(
    `SELECT DISTINCT ${gid} g FROM visit_individuals WHERE tenant_id = ? AND ${gid} IN (${placeholders})`
  ).bind(tenantId, ...list).all();
  const matchedIds = new Set((found || []).map((r) => String(r.g)));
  const unmatched = list.filter((id) => !matchedIds.has(id));

  if (body.dry_run) {
    return c.json({ success: true, dry_run: true, uploaded: list.length, matched: matchedIds.size, unmatched });
  }

  const res = await db.prepare(
    `UPDATE visit_individuals
     SET custom_field_values = json_set(COALESCE(custom_field_values,'{}'),'$.verification_status','qualified')
     WHERE tenant_id = ?
       AND COALESCE(json_extract(custom_field_values,'$.verification_status'),'provisional') = 'provisional'
       AND ${gid} IN (${placeholders})`
  ).bind(tenantId, ...list).run();

  return c.json({
    success: true,
    uploaded: list.length,
    matched: matchedIds.size,
    qualified: res.meta?.changes ?? 0,
    unmatched,
  });
});

// GET /incentives/pnl?period=&company_id= — GM mobile P&L for the period.
// Revenue = converted deposits x commission_per_deposit (provisional = all non-rejected,
// qualified = reconciled). Cost = tiered incentive payouts (per-agent, avg-based) + fixed salaries.
app.get('/incentives/pnl', requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const now = new Date().toISOString();
  const period = c.req.query('period') || periodOf(now);
  const companyId = c.req.query('company_id') || null;
  const asOf = c.req.query('as_of') || now.slice(0, 10);
  const start = `${period}-01`, end = nextMonthStart(period);

  const rate = (await getConfig(db, tenantId, companyId, 'commission_per_deposit')) || 0;
  const salaries = (await getConfig(db, tenantId, companyId, 'salaries')) || {};
  const salaryTotal = Object.values(salaries).reduce((s, v) => s + (Number(v) || 0), 0);
  const boAdminSalary = (await getConfig(db, tenantId, companyId, 'bo_admin_salary')) ?? 25000;
  const phonePerAgent = (await getConfig(db, tenantId, companyId, 'phone_cost_per_agent')) ?? 179;

  // Signups + converted deposits, split provisional (all non-rejected) vs qualified.
  const agg = await db.prepare(
    `SELECT
        COUNT(*) signups,
        SUM(CASE WHEN ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END) converted,
        SUM(CASE WHEN ${VERIFIED_SQL('vi')} THEN 1 ELSE 0 END) qualified_signups,
        SUM(CASE WHEN ${VERIFIED_SQL('vi')}
                  AND ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END) qualified_converted
     FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     WHERE v.tenant_id = ? AND vi.created_at >= ? AND vi.created_at < ?
       AND (? IS NULL OR v.company_id = ?) AND v.agent_id NOT LIKE 'agent-test-%'
       AND ${NOT_REJECTED_SQL('vi')}`
  ).bind(tenantId, start, end, companyId, companyId).first();

  // Tiered incentive cost: per-agent, avg-based — must run each agent through the engine.
  const { results: agents } = await db.prepare(
    `SELECT DISTINCT v.agent_id id FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     WHERE v.tenant_id = ? AND vi.created_at >= ? AND vi.created_at < ?
       AND (? IS NULL OR v.company_id = ?) AND v.agent_id NOT LIKE 'agent-test-%'`
  ).bind(tenantId, start, end, companyId, companyId).all();
  let incentiveQualified = 0, incentivePace = 0;
  for (const { id } of agents || []) {
    const u = await db.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
    if (!u || u.role === 'team_lead' || u.role === 'manager') continue; // team roles handled below
    const inc = await computeIncentive(db, tenantId, companyId, id, u.role, period, asOf);
    incentiveQualified += inc.payable;
    incentivePace += inc.provisionalPace;
  }
  // Team-lead/manager incentives are team-metric based — they never surface as visit agents.
  const { results: teamRoles } = await db.prepare(
    `SELECT id, role FROM users WHERE tenant_id = ? AND is_active = 1
       AND role IN ('team_lead','manager') AND id NOT LIKE 'agent-test-%'`
  ).bind(tenantId).all();
  for (const { id, role } of teamRoles || []) {
    const inc = await computeIncentive(db, tenantId, companyId, id, role, period, asOf);
    incentiveQualified += inc.payable;
    incentivePace += inc.provisionalPace;
  }

  // Fixed operating costs: BO admin headcount + phone allowance per field agent.
  // BO admins must be explicitly tagged back_office/both — legacy admins with NULL
  // agent_type are migration/test artifacts, not payroll.
  const boRow = await db.prepare(
    `SELECT COUNT(*) c FROM users WHERE tenant_id = ? AND is_active = 1
       AND role IN ('admin','backoffice_admin')
       AND agent_type IN ('back_office','both')`
  ).bind(tenantId).first();
  // ponytail: first_name='test' heuristic catches UUID-id test users the
  // 'agent-test-%' pattern misses; add is_test flag column if this ever bites.
  const agentRow = await db.prepare(
    `SELECT COUNT(*) c FROM users u WHERE tenant_id = ? AND is_active = 1
       AND role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND (agent_type IS NULL OR agent_type IN ('field_ops','both'))
       AND id NOT LIKE 'agent-test-%'
       AND LOWER(TRIM(first_name)) != 'test'
       AND (? IS NULL OR EXISTS (
         SELECT 1 FROM agent_company_links acl
         WHERE acl.agent_id = u.id AND acl.company_id = ?
           AND acl.tenant_id = u.tenant_id AND acl.is_active = 1))`
  ).bind(tenantId, ...AGENT_ROLES, companyId, companyId).first();
  const boAdminCount = boRow?.c || 0;
  const fieldAgentCount = agentRow?.c || 0;
  const boAdminCost = boAdminCount * boAdminSalary;
  const phoneCost = fieldAgentCount * phonePerAgent;
  const fixedCost = salaryTotal + boAdminCost + phoneCost;

  const provRevenue = (agg?.converted || 0) * rate;
  const qualRevenue = (agg?.qualified_converted || 0) * rate;
  return c.json({
    success: true,
    pnl: {
      period,
      commissionPerDeposit: rate,
      signups: agg?.signups || 0,
      converted: agg?.converted || 0,
      qualifiedSignups: agg?.qualified_signups || 0,
      qualifiedConverted: agg?.qualified_converted || 0,
      // qualified (confirmed) view — money that has cleared reconciliation
      revenue: qualRevenue,
      incentiveCost: round1(incentiveQualified),
      salaryCost: salaryTotal,
      boAdminCount,
      boAdminSalary,
      boAdminCost,
      fieldAgentCount,
      phonePerAgent,
      phoneCost,
      net: round1(qualRevenue - incentiveQualified - fixedCost),
      // provisional (on-pace) view — projection at current activity
      projectedRevenue: provRevenue,
      projectedIncentiveCost: round1(incentivePace),
      projectedNet: round1(provRevenue - incentivePace - fixedCost),
    },
  });
});

// GET /incentives/roster — field agents with phone + today's signup count + last activity,
// for Back Office click-to-dial chasing. Sorted least-active first (quiet agents float up).
app.get('/incentives/roster', requireRole('admin', 'general_manager', 'backoffice_admin', 'manager', 'team_lead'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');
  const today = new Date().toISOString().slice(0, 10);
  const companyId = c.req.query('company_id') || null;

  // Caller company scope — admins/GM see every agent; managers/team-leads/BO see only
  // agents in the companies they're assigned to (mirrors /field-ops/companies). The pill
  // (company_id) narrows within that set; without it, a scoped caller still can't see
  // agents outside their companies.
  let filterIds = null; // null = no company restriction
  if (!(role === 'admin' || role === 'super_admin' || role === 'general_manager')) {
    const linkRows = role === 'manager'
      ? await db.prepare("SELECT company_id FROM manager_company_links WHERE manager_id = ? AND tenant_id = ? AND is_active = 1").bind(userId, tenantId).all()
      : await db.prepare("SELECT company_id FROM agent_company_links WHERE agent_id = ? AND tenant_id = ? AND is_active = 1").bind(userId, tenantId).all();
    filterIds = (linkRows.results || []).map((r) => r.company_id);
  }
  if (companyId) {
    // Pill selection: honor only if within the caller's allowed set (or caller is unscoped).
    filterIds = filterIds && !filterIds.includes(companyId) ? [] : [companyId];
  }

  let companyClause = '';
  const companyBinds = [];
  if (filterIds !== null) {
    if (filterIds.length === 0) return c.json({ success: true, roster: [] });
    companyClause = `AND EXISTS (SELECT 1 FROM agent_company_links acl WHERE acl.agent_id = u.id AND acl.tenant_id = u.tenant_id AND acl.is_active = 1 AND acl.company_id IN (${filterIds.map(() => '?').join(',')}))`;
    companyBinds.push(...filterIds);
  }

  const { results } = await db.prepare(
    `SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.phone,
            COUNT(CASE WHEN date(vi.created_at) = ? THEN 1 END) AS today,
            MAX(vi.created_at) AS last_activity
     FROM users u
     LEFT JOIN visits v ON v.agent_id = u.id AND v.tenant_id = u.tenant_id
     LEFT JOIN visit_individuals vi ON vi.visit_id = v.id
       AND ${NOT_REJECTED_SQL('vi')}
     WHERE u.tenant_id = ? AND u.is_active = 1
       AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND (u.agent_type IS NULL OR u.agent_type IN ('field_ops','both'))
       AND u.id NOT LIKE 'agent-test-%'
       AND LOWER(TRIM(u.first_name)) != 'test'
       ${companyClause}
     GROUP BY u.id ORDER BY today ASC, last_activity ASC`
  ).bind(today, tenantId, ...AGENT_ROLES, ...companyBinds).all();
  return c.json({ success: true, roster: results || [] });
});

function nextMonthStart(period) {
  const [y, m] = period.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
function round1(n) { return Math.round(n * 10) / 10; }

export default app;
