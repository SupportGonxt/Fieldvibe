/**
 * Incentive engine — Goldrush signups.
 * Source of truth: visit_individuals rows (one per signup), agent = visits.agent_id.
 * goldrush id: custom_field_values.goldrush_id_entry ; converted: consumer_converted='Yes'
 * verification_status lives in custom_field_values.verification_status
 *   ('provisional' default | 'qualified' | 'rejected'); reconciliation (Phase 4) flips it.
 * Metric = average signups per working day over the period; tier pays on that avg.
 */
import { getScale, getConfig } from '../routes/field-ops/config.js';
import { subtreeAgentIds } from './hierarchyService.js';

// Highest tier whose min <= value, else 0.
export function tierAmount(tiers, value) {
  return (tiers || [])
    .filter((t) => value >= t.min)
    .sort((a, b) => b.min - a.min)[0]?.amount ?? 0;
}

// Reconciliation upload → deduped list of 9-digit Goldrush IDs. Accepts an explicit
// array and/or a pasted CSV/text blob; pulls the first 9-digit run from each array cell
// and every 9-digit run from the blob. Order-stable, no duplicates.
export function extractGoldrushIds({ goldrush_ids, csv } = {}) {
  // exactly-9-digit runs, not flanked by other digits (so a 13-digit SA ID / phone
  // never yields a spurious 9-digit fragment)
  const NINE = /(?<!\d)\d{9}(?!\d)/g;
  const ids = new Set();
  for (const v of Array.isArray(goldrush_ids) ? goldrush_ids : []) {
    const m = String(v).match(NINE);
    if (m) ids.add(m[0]);
  }
  if (typeof csv === 'string') {
    for (const m of csv.matchAll(NINE)) ids.add(m[0]);
  }
  return [...ids];
}

// Inactivity escalation: given escalate_steps (each {after_min, to}) and how many
// minutes past the inactivity threshold an agent is, return the highest step now due
// (or null). Steps fire cumulatively across cron ticks: employee, then team_lead, then manager.
export function dueEscalation(steps, excessMin) {
  return (steps || [])
    .filter((s) => Number(s.after_min) <= excessMin)
    .sort((a, b) => Number(b.after_min) - Number(a.after_min))[0] ?? null;
}

// Next tier above the current value → { min, amount } or null if already top.
export function nextTier(tiers, value) {
  return (tiers || [])
    .filter((t) => t.min > value)
    .sort((a, b) => a.min - b.min)[0] ?? null;
}

// period 'YYYY-MM' (defaults handled by caller). Returns {start, end} ISO dates.
function monthBounds(period) {
  const [y, m] = period.split('-').map(Number);
  const start = `${period}-01`;
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { start, end, y, m };
}

// Weekdays from the 1st through `asOf` inclusive (asOf 'YYYY-MM-DD'); min 1.
// ponytail: weekends only; subtracts training_days rows in period. Add holiday_calendar when it exists.
export async function workingDaysElapsed(db, tenantId, companyId, period, asOf) {
  const { y, m } = monthBounds(period);
  const lastDay = asOf && asOf.startsWith(period) ? Number(asOf.slice(8, 10)) : daysInMonth(y, m);
  let wd = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) wd++;
  }
  wd -= await trainingDayCount(db, tenantId, companyId, period);
  return Math.max(1, wd);
}

export async function workingDaysInMonth(db, tenantId, companyId, period) {
  const cfg = await getConfig(db, tenantId, companyId, 'working_days_in_month');
  if (typeof cfg === 'number' && cfg > 0) return cfg;
  const { y, m } = monthBounds(period);
  let wd = 0;
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) wd++;
  }
  return Math.max(1, wd - (await trainingDayCount(db, tenantId, companyId, period)));
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

async function trainingDayCount(db, tenantId, companyId, period) {
  try {
    const { start, end } = monthBounds(period);
    const row = await db.prepare(
      `SELECT COUNT(*) n FROM training_days
       WHERE tenant_id = ? AND (company_id = ? OR company_id IS NULL)
         AND day >= ? AND day < ?`
    ).bind(tenantId, companyId ?? null, start, end).first();
    return row?.n || 0;
  } catch {
    return 0; // table may not exist in older envs
  }
}

// Count of an agent's signups in the period. status: 'qualified' | 'provisional' | undefined(all non-rejected).
export async function agentCount(db, tenantId, agentId, period, status) {
  const { start, end } = monthBounds(period);
  let statusClause = "AND COALESCE(json_extract(vi.custom_field_values,'$.verification_status'),'provisional') != 'rejected'";
  if (status === 'qualified') statusClause = "AND json_extract(vi.custom_field_values,'$.verification_status') = 'qualified'";
  const row = await db.prepare(
    `SELECT COUNT(*) c,
            SUM(CASE WHEN json_extract(vi.custom_field_values,'$.consumer_converted') = 'Yes' THEN 1 ELSE 0 END) converted
     FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     WHERE v.tenant_id = ? AND v.agent_id = ?
       AND vi.created_at >= ? AND vi.created_at < ? ${statusClause}`
  ).bind(tenantId, agentId, start, end).first();
  return { count: row?.c || 0, converted: row?.converted || 0 };
}

// Agent metric: {count, converted, avg} — avg = count / working days elapsed.
export async function agentMetric(db, tenantId, companyId, agentId, period, asOf, status) {
  const [{ count, converted }, wd] = await Promise.all([
    agentCount(db, tenantId, agentId, period, status),
    workingDaysElapsed(db, tenantId, companyId, period, asOf),
  ]);
  return { count, converted, avg: count / wd, workingDays: wd };
}

// Team metric: mean of member agent avgs (each agent's own count/workingDays).
export async function teamMetric(db, tenantId, companyId, userId, role, period, asOf, status) {
  const agentIds = await subtreeAgentIds(db, tenantId, userId, role);
  if (!agentIds.length) return { avg: 0, count: 0, converted: 0, agents: 0 };
  const wd = await workingDaysElapsed(db, tenantId, companyId, period, asOf);
  let sumAvg = 0, totCount = 0, totConv = 0;
  for (const id of agentIds) {
    const { count, converted } = await agentCount(db, tenantId, id, period, status);
    sumAvg += count / wd;
    totCount += count;
    totConv += converted;
  }
  return { avg: sumAvg / agentIds.length, count: totCount, converted: totConv, agents: agentIds.length };
}

// Full incentive for a user (agent uses own metric; team roles use team avg).
const AGENT_ROLES = ['agent', 'field_agent', 'sales_rep'];
export async function computeIncentive(db, tenantId, companyId, userId, role, period, asOf) {
  const scale = await getScale(db, tenantId, companyId, role);
  const tiers = scale?.tiers || [];
  const isAgent = AGENT_ROLES.includes(role);

  const provisional = isAgent
    ? await agentMetric(db, tenantId, companyId, userId, period, asOf)
    : await teamMetric(db, tenantId, companyId, userId, role, period, asOf);
  const qualified = isAgent
    ? await agentMetric(db, tenantId, companyId, userId, period, asOf, 'qualified')
    : await teamMetric(db, tenantId, companyId, userId, role, period, asOf, 'qualified');

  const wdMonth = await workingDaysInMonth(db, tenantId, companyId, period);
  const projectedAvg = provisional.avg; // pace already normalised per working day
  return {
    period,
    role,
    metricValue: round1(qualified.avg),
    provisionalAvg: round1(provisional.avg),
    count: provisional.count,
    converted: provisional.converted,
    workingDaysInMonth: wdMonth,
    payable: tierAmount(tiers, qualified.avg),        // paid on reconciled/qualified only
    provisionalPace: tierAmount(tiers, projectedAvg), // on-track amount at current pace
    nextTier: nextTier(tiers, provisional.avg),
    tiers,
  };
}

function round1(n) { return Math.round(n * 10) / 10; }

// Upsert payable into commission_earnings; true-up only (never lowers an approved amount).
// period 'YYYY-MM' maps to period_start/period_end; rate/base_amount are NOT NULL columns.
export async function writePayable(db, tenantId, userId, period, amount, sourceType = 'incentive') {
  const { start, end } = monthBounds(period);
  const existing = await db.prepare(
    `SELECT id, amount, status FROM commission_earnings
     WHERE tenant_id = ? AND earner_id = ? AND period_start = ? AND source_type = ?`
  ).bind(tenantId, userId, start, sourceType).first();
  if (existing) {
    if (existing.status === 'approved' && amount <= existing.amount) return existing.id; // no clawback
    await db.prepare(`UPDATE commission_earnings SET amount = ?, base_amount = ? WHERE id = ?`)
      .bind(amount, amount, existing.id).run();
    return existing.id;
  }
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO commission_earnings (id, tenant_id, earner_id, source_type, rate, base_amount, amount, status, period_start, period_end)
     VALUES (?, ?, ?, ?, 0, ?, ?, 'pending', ?, ?)`
  ).bind(id, tenantId, userId, sourceType, amount, amount, start, end).run();
  return id;
}

export { AGENT_ROLES };
