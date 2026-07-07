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

// Two-gate tier: highest-amount tier where BOTH gates clear
// (avgSignups >= t.signups AND avgDeposits >= t.deposits), else 0. Because gate
// thresholds rise with amount, this naturally yields min(signup_tier, deposit_tier).
export function tierFor(tiers, avgSignups, avgDeposits) {
  return (tiers || [])
    .filter((t) => avgSignups >= t.signups && avgDeposits >= t.deposits)
    .sort((a, b) => b.amount - a.amount)[0]?.amount ?? 0;
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

// Next unreached tier → the tier itself plus the shortfall on each gate
// (needSignups/needDeposits, 0 on an already-met gate), or null if top reached.
export function nextGate(tiers, avgSignups, avgDeposits) {
  const t = (tiers || [])
    .filter((x) => !(avgSignups >= x.signups && avgDeposits >= x.deposits))
    .sort((a, b) => a.amount - b.amount)[0];
  if (!t) return null;
  return {
    ...t,
    needSignups: Math.max(0, t.signups - avgSignups),
    needDeposits: Math.max(0, t.deposits - avgDeposits),
  };
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
  // deposits = period signups whose canonical goldrush id has a BackOffice-confirmed
  // goldrush_deposits row. Canonical id: new capture writes goldrush_id_entry, legacy goldrush_id.
  const row = await db.prepare(
    `SELECT COUNT(*) c,
            SUM(CASE WHEN json_extract(vi.custom_field_values,'$.consumer_converted') = 'Yes' THEN 1 ELSE 0 END) converted,
            SUM(CASE WHEN gd.id IS NOT NULL THEN 1 ELSE 0 END) deposits
     FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     LEFT JOIN goldrush_deposits gd ON gd.tenant_id = v.tenant_id
       AND gd.goldrush_id = COALESCE(json_extract(vi.custom_field_values,'$.goldrush_id_entry'), json_extract(vi.custom_field_values,'$.goldrush_id'))
     WHERE v.tenant_id = ? AND v.agent_id = ?
       AND vi.created_at >= ? AND vi.created_at < ? ${statusClause}`
  ).bind(tenantId, agentId, start, end).first();
  return { count: row?.c || 0, converted: row?.converted || 0, deposits: row?.deposits || 0 };
}

// Agent metric: signups & deposits, each averaged per working day elapsed.
// avg === avgSignups (kept for callers that read .avg as the signup pace).
export async function agentMetric(db, tenantId, companyId, agentId, period, asOf, status) {
  const [{ count, converted, deposits }, wd] = await Promise.all([
    agentCount(db, tenantId, agentId, period, status),
    workingDaysElapsed(db, tenantId, companyId, period, asOf),
  ]);
  return { count, converted, deposits, avg: count / wd, avgSignups: count / wd, avgDeposits: deposits / wd, workingDays: wd };
}

// Team metric: mean of member agent avgs (each agent's own count/workingDays), both gates.
export async function teamMetric(db, tenantId, companyId, userId, role, period, asOf, status) {
  const agentIds = await subtreeAgentIds(db, tenantId, userId, role);
  if (!agentIds.length) return { avg: 0, avgSignups: 0, avgDeposits: 0, count: 0, converted: 0, deposits: 0, agents: 0 };
  const wd = await workingDaysElapsed(db, tenantId, companyId, period, asOf);
  let sumSignups = 0, sumDeposits = 0, totCount = 0, totConv = 0, totDep = 0;
  for (const id of agentIds) {
    const { count, converted, deposits } = await agentCount(db, tenantId, id, period, status);
    sumSignups += count / wd;
    sumDeposits += deposits / wd;
    totCount += count;
    totConv += converted;
    totDep += deposits;
  }
  const n = agentIds.length;
  return { avg: sumSignups / n, avgSignups: sumSignups / n, avgDeposits: sumDeposits / n, count: totCount, converted: totConv, deposits: totDep, agents: n };
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
  // Below the lowest gate the earner still gets a configurable per-role base salary.
  const bases = (await getConfig(db, tenantId, companyId, 'role_base_salary')) || {};
  const baseKey = isAgent ? 'agent' : role === 'manager' ? 'manager' : 'team_lead';
  const base = Number(bases[baseKey]) || 0;
  const withBase = (amt) => Math.max(amt, base);

  return {
    period,
    role,
    metricSignups: round1(qualified.avgSignups),
    metricDeposits: round1(qualified.avgDeposits),
    provisionalSignups: round1(provisional.avgSignups),
    provisionalDeposits: round1(provisional.avgDeposits),
    count: provisional.count,
    converted: provisional.converted,
    deposits: provisional.deposits,
    workingDaysInMonth: wdMonth,
    baseSalary: base,
    payable: withBase(tierFor(tiers, qualified.avgSignups, qualified.avgDeposits)),        // paid on reconciled/qualified only
    provisionalPace: withBase(tierFor(tiers, provisional.avgSignups, provisional.avgDeposits)), // on-track at current pace
    nextTier: nextGate(tiers, provisional.avgSignups, provisional.avgDeposits),
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
