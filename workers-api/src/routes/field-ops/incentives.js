/**
 * Field-Ops Incentives — hero display, personal incentive, leaderboard, period close.
 * All metrics come from incentiveService over the live visit_individuals model.
 * Period defaults to the current UTC month ('YYYY-MM'); asOf defaults to today.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { computeIncentive, AGENT_ROLES, writePayable, extractGoldrushIds } from '../../services/incentiveService.js';
import { getConfig } from './config.js';

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
       AND COALESCE(json_extract(vi.custom_field_values,'$.verification_status'),'provisional') != 'rejected'`
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
       AND COALESCE(json_extract(vi.custom_field_values,'$.verification_status'),'provisional') != 'rejected'`
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
         AND COALESCE(json_extract(vi.custom_field_values,'$.verification_status'),'provisional') != 'rejected'
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
      provisionalAvg: inc.provisionalAvg,
      provisionalPace: inc.provisionalPace, // R on track at current pace
      payable: inc.payable,                 // R already qualified
      nextTier: next,                        // { min, amount } | null
      toNextTier: next ? round1(next.min - inc.provisionalAvg) : null, // avg/day gap to next tier
      rank,
      totalPeers,
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
            SUM(CASE WHEN json_extract(vi.custom_field_values,'$.consumer_converted') = 'Yes' THEN 1 ELSE 0 END) AS converted
     FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     JOIN users u ON u.id = v.agent_id
     WHERE v.tenant_id = ? AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND vi.created_at >= ? AND vi.created_at < ?
       AND COALESCE(json_extract(vi.custom_field_values,'$.verification_status'),'provisional') != 'rejected'
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

// GET /incentives/roster — field agents with phone + today's signup count + last activity,
// for Back Office click-to-dial chasing. Sorted least-active first (quiet agents float up).
app.get('/incentives/roster', requireRole('admin', 'general_manager', 'backoffice_admin', 'manager', 'team_lead'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const today = new Date().toISOString().slice(0, 10);
  const { results } = await db.prepare(
    `SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.phone,
            COUNT(CASE WHEN date(vi.created_at) = ? THEN 1 END) AS today,
            MAX(vi.created_at) AS last_activity
     FROM users u
     LEFT JOIN visits v ON v.agent_id = u.id AND v.tenant_id = u.tenant_id
     LEFT JOIN visit_individuals vi ON vi.visit_id = v.id
       AND COALESCE(json_extract(vi.custom_field_values,'$.verification_status'),'provisional') != 'rejected'
     WHERE u.tenant_id = ? AND u.is_active = 1
       AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND (u.agent_type IS NULL OR u.agent_type IN ('field_ops','both'))
     GROUP BY u.id ORDER BY today ASC, last_activity ASC`
  ).bind(today, tenantId, ...AGENT_ROLES).all();
  return c.json({ success: true, roster: results || [] });
});

function nextMonthStart(period) {
  const [y, m] = period.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
function round1(n) { return Math.round(n * 10) / 10; }

export default app;
