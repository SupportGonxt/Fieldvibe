/**
 * Field-Ops GM overview — one composed business KPI payload for the general_manager.
 * Pure composition over existing incentive/leaderboard/roster/bo_calls data; no new metric math.
 * Reused by GET /gm/overview (web + mobile) and generateGmDigest (thrice-daily email + notification).
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { computeIncentive, AGENT_ROLES } from '../../services/incentiveService.js';
import { getConfig } from './config.js';

const app = new Hono();

const NOT_REJECTED =
  `COALESCE(json_extract(vi.custom_field_values,'$.verification_status'),'provisional') != 'rejected'`;

function nextMonthStart(period) {
  const [y, m] = period.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
function addDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function round1(n) { return Math.round(n * 10) / 10; }

// Resolve [start, end) date bounds + today from a period keyword. end is exclusive.
export function periodRange(period, nowIso) {
  const today = nowIso.slice(0, 10);
  if (period === 'day') return { start: today, end: addDay(today), today, mode: 'day' };
  if (period === 'week') {
    const d = new Date(nowIso);
    const dow = d.getUTCDay();             // 0 Sun..6 Sat
    const back = dow === 0 ? 6 : dow - 1;  // days since Monday
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back))
      .toISOString().slice(0, 10);
    return { start: monday, end: addDay(today), today, mode: 'week' };
  }
  const p = today.slice(0, 7);             // month (default)
  return { start: `${p}-01`, end: nextMonthStart(p), today, mode: 'month' };
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
export async function buildGmOverview(db, tenantId, companyId, period) {
  const now = new Date().toISOString();
  const { start, end, today, mode } = periodRange(period, now);

  // Funnel + revenue base (range aggregate — mirrors the pnl endpoint's agg query).
  const rate = (await getConfig(db, tenantId, companyId, 'commission_per_deposit').catch(() => 0)) || 0;
  const agg = await db.prepare(
    `SELECT COUNT(*) signups,
       SUM(CASE WHEN json_extract(vi.custom_field_values,'$.consumer_converted')='Yes' THEN 1 ELSE 0 END) converted,
       SUM(CASE WHEN json_extract(vi.custom_field_values,'$.verification_status')='qualified' THEN 1 ELSE 0 END) qualified
     FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     WHERE v.tenant_id = ? AND vi.created_at >= ? AND vi.created_at < ? AND ${NOT_REJECTED}`
  ).bind(tenantId, start, end).first().catch(() => null);
  const signups = agg?.signups || 0, converted = agg?.converted || 0, qualified = agg?.qualified || 0;
  const revenue = converted * rate;

  // Costs are only coherent monthly (tiered per-agent avg + fixed salaries). Skip for day/week.
  let money = { revenue, incentiveCost: null, salaryCost: null, net: null, costsAvailable: false };
  if (mode === 'month') {
    try {
      const salaries = (await getConfig(db, tenantId, companyId, 'salaries')) || {};
      const salaryCost = Object.values(salaries).reduce((s, v) => s + (Number(v) || 0), 0);
      const monthKey = today.slice(0, 7);
      const { results: ags } = await db.prepare(
        `SELECT DISTINCT v.agent_id id FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
         WHERE v.tenant_id = ? AND vi.created_at >= ? AND vi.created_at < ?`
      ).bind(tenantId, start, end).all();
      let incentiveCost = 0;
      for (const { id } of ags || []) {
        const u = await db.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
        if (!u) continue;
        const inc = await computeIncentive(db, tenantId, companyId, id, u.role, monthKey, today);
        incentiveCost += inc.payable;
      }
      incentiveCost = round1(incentiveCost);
      money = { revenue, incentiveCost, salaryCost, net: round1(revenue - incentiveCost - salaryCost), costsAvailable: true };
    } catch { /* keep costs null on failure */ }
  }

  // Leaders (period-scoped signup leaderboard, top 5).
  const { results: leaders } = await db.prepare(
    `SELECT v.agent_id id, u.first_name||' '||u.last_name name, COUNT(*) signups,
       SUM(CASE WHEN json_extract(vi.custom_field_values,'$.consumer_converted')='Yes' THEN 1 ELSE 0 END) converted
     FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id JOIN users u ON u.id = v.agent_id
     WHERE v.tenant_id = ? AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND vi.created_at >= ? AND vi.created_at < ? AND ${NOT_REJECTED}
     GROUP BY v.agent_id ORDER BY signups DESC LIMIT 5`
  ).bind(tenantId, ...AGENT_ROLES, start, end).all().catch(() => ({ results: [] }));

  // Field force: active-today + roster (least active first, top 5 quiet).
  const { results: roster } = await db.prepare(
    `SELECT u.id, u.first_name||' '||u.last_name name, u.phone,
       COUNT(CASE WHEN date(vi.created_at)=? THEN 1 END) today, MAX(vi.created_at) last_activity
     FROM users u
     LEFT JOIN visits v ON v.agent_id = u.id AND v.tenant_id = u.tenant_id
     LEFT JOIN visit_individuals vi ON vi.visit_id = v.id AND ${NOT_REJECTED}
     WHERE u.tenant_id = ? AND u.is_active = 1 AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND (u.agent_type IS NULL OR u.agent_type IN ('field_ops','both'))
     GROUP BY u.id ORDER BY today ASC, last_activity ASC`
  ).bind(today, tenantId, ...AGENT_ROLES).all().catch(() => ({ results: [] }));
  const totalAgents = (roster || []).length;
  const activeAgents = (roster || []).filter((r) => (r.today || 0) > 0).length;
  const leastActive = (roster || []).slice(0, 5);

  // BO calls: agents contacted today vs summed daily targets (default 20 per BO admin).
  const contactedRow = await db.prepare(
    `SELECT COUNT(DISTINCT callee_id) c FROM bo_calls
     WHERE tenant_id = ? AND status='answered' AND date(started_at)=?`
  ).bind(tenantId, today).first().catch(() => null);
  const boCountRow = await db.prepare(
    `SELECT COUNT(*) c FROM users WHERE tenant_id = ? AND is_active = 1
       AND role IN ('admin','backoffice_admin','general_manager','manager')
       AND (agent_type IS NULL OR agent_type IN ('back_office','both'))`
  ).bind(tenantId).first().catch(() => null);
  const targetRow = await db.prepare(
    `SELECT COALESCE(SUM(daily_target),0) t FROM bo_call_targets WHERE tenant_id = ?`
  ).bind(tenantId).first().catch(() => null);
  const explicitTarget = targetRow?.t || 0;
  const target = explicitTarget > 0 ? explicitTarget : (boCountRow?.c || 0) * 20;

  return {
    period: mode,
    money,
    funnel: {
      signups, converted, qualified, commissionPerDeposit: rate,
      conversionRate: signups ? round1((converted / signups) * 100) : 0,
    },
    field: { activeAgents, totalAgents, leastActive },
    leaders: leaders || [],
    calls: { contacted: contactedRow?.c || 0, target },
  };
}

// GET /gm/overview?period=day|week|month&company_id=
app.get('/gm/overview', requireRole('admin', 'general_manager'), async (c) => {
  const tenantId = c.get('tenantId');
  const period = c.req.query('period') || 'day';
  const companyId = c.req.query('company_id') || null;
  const overview = await buildGmOverview(c.env.DB, tenantId, companyId, period);
  return c.json({ success: true, ...overview });
});

export default app;
