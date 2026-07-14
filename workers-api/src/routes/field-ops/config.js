/**
 * Field-Ops Program Config + Incentive Scales
 * program_config: arbitrary per-tenant/per-company key/value program settings.
 * incentive_scales: per-role step-tier incentive definitions.
 * Company row (company_id set) overrides the tenant default (company_id IS NULL).
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { canSeeMoney } from '../../lib/capabilities.js';
import { DEFAULT_CAPTURE_CONFIG } from '../../services/programConfig.js';

// ---- Reusable resolvers (imported by other services) ----
export async function getConfig(db, tenantId, companyId, key) {
  const row = await db.prepare(
    `SELECT value_json FROM program_config
     WHERE tenant_id = ? AND key = ? AND (company_id = ? OR company_id IS NULL)
     ORDER BY company_id IS NULL ASC LIMIT 1`
  ).bind(tenantId, key, companyId ?? null).first();
  return row ? JSON.parse(row.value_json) : null;
}

// Wire shape for a tier is flat {amount, signups, deposits, …}; rows seeded with the
// newer {amount, targets:{…}} shape are flattened here so every consumer reads one shape.
export const flatTier = (t) => (t && t.targets ? { amount: t.amount, ...t.targets } : t);

export async function getScale(db, tenantId, companyId, role) {
  const row = await db.prepare(
    `SELECT tiers_json, metric, basis, period FROM incentive_scales
     WHERE tenant_id = ? AND role = ? AND active = 1 AND (company_id = ? OR company_id IS NULL)
     ORDER BY company_id IS NULL ASC LIMIT 1`
  ).bind(tenantId, role, companyId ?? null).first();
  return row
    ? { tiers: (JSON.parse(row.tiers_json) || []).map(flatTier), metric: row.metric, basis: row.basis, period: row.period }
    : null;
}

const app = new Hono();
const adminOnly = requireRole('admin', 'general_manager');

// GET /field-ops/config?company_id= -> { key: value, ... }
app.get('/config', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.req.query('company_id') || null;
  const { results } = await db.prepare(
    `SELECT key, value_json, company_id FROM program_config
     WHERE tenant_id = ? AND (company_id = ? OR company_id IS NULL)
     ORDER BY company_id IS NULL ASC`
  ).bind(tenantId, companyId).all();
  // company row wins: iterate default-last so specific overwrites default
  const out = {};
  for (const r of results) out[r.key] = JSON.parse(r.value_json);
  // Field roles never see salary/commission config rand values (counts-only rule)
  const MONEY_CONFIG_KEYS = ['salaries', 'role_base_salary', 'bo_admin_salary', 'phone_cost_per_agent', 'commission_per_deposit'];
  if (!canSeeMoney(c.get('role'))) for (const k of MONEY_CONFIG_KEYS) delete out[k];
  return c.json({ success: true, config: out });
});

// PUT /field-ops/config  body: { company_id?, config: { key: value } }
app.put('/config', adminOnly, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const companyId = body.company_id ?? null;
  const entries = Object.entries(body.config || {});
  for (const [key, value] of entries) {
    const existing = await db.prepare(
      `SELECT id FROM program_config WHERE tenant_id = ? AND key = ? AND ${companyId === null ? 'company_id IS NULL' : 'company_id = ?'}`
    ).bind(...(companyId === null ? [tenantId, key] : [tenantId, key, companyId])).first();
    const json = JSON.stringify(value);
    if (existing) {
      await db.prepare(`UPDATE program_config SET value_json = ? WHERE id = ?`).bind(json, existing.id).run();
    } else {
      await db.prepare(
        `INSERT INTO program_config (id, tenant_id, company_id, key, value_json) VALUES (?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), tenantId, companyId, key, json).run();
    }
  }
  return c.json({ success: true, updated: entries.length });
});

// GET /field-ops/incentive-scales?company_id=
app.get('/incentive-scales', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.req.query('company_id') || null;
  const { results } = await db.prepare(
    `SELECT * FROM incentive_scales WHERE tenant_id = ? AND (company_id = ? OR company_id IS NULL)`
  ).bind(tenantId, companyId).all();
  return c.json({ success: true, scales: results.map((r) => ({ ...r, tiers: JSON.parse(r.tiers_json) })) });
});

// PUT /field-ops/incentive-scales  body: { company_id?, role, metric, tiers, basis?, period? }
app.put('/incentive-scales', adminOnly, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const b = await c.req.json();
  const companyId = b.company_id ?? null;
  const existing = await db.prepare(
    `SELECT id FROM incentive_scales WHERE tenant_id = ? AND role = ? AND ${companyId === null ? 'company_id IS NULL' : 'company_id = ?'}`
  ).bind(...(companyId === null ? [tenantId, b.role] : [tenantId, b.role, companyId])).first();
  const tiersJson = JSON.stringify(b.tiers);
  if (existing) {
    await db.prepare(
      `UPDATE incentive_scales SET metric = ?, tiers_json = ?, basis = ?, period = ?, active = 1 WHERE id = ?`
    ).bind(b.metric, tiersJson, b.basis || 'working_days', b.period || 'month', existing.id).run();
  } else {
    await db.prepare(
      `INSERT INTO incentive_scales (id, tenant_id, company_id, role, metric, tiers_json, basis, period, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).bind(crypto.randomUUID(), tenantId, companyId, b.role, b.metric, tiersJson, b.basis || 'working_days', b.period || 'month').run();
  }
  return c.json({ success: true, role: b.role });
});

// POST /field-ops/config/seed-defaults  body: { company_id? }  — idempotent Goldrush defaults
app.post('/config/seed-defaults', adminOnly, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => ({}));
  const companyId = body.company_id ?? null;

  // GOVERNING N-gate pay scale — live on deploy. Each tier clears only when EVERY gate metric's
  // per-working-day average meets its target (min-tier across gates). targets is keyed by metric_key
  // so adding a gate metric is config, not code. Agents (own metric) and Team Leads (team avg) share these.
  const fieldTiers = [
    { amount: 1500, targets: { signups: 8,  deposits: 5  } },
    { amount: 2500, targets: { signups: 10, deposits: 8  } },
    { amount: 3500, targets: { signups: 15, deposits: 10 } },
    { amount: 4500, targets: { signups: 20, deposits: 15 } },
  ];
  // Management (org average): same gates, management-scale amounts.
  const mgmtTiers = [
    { amount: 10000, targets: { signups: 8,  deposits: 5  } },
    { amount: 20000, targets: { signups: 10, deposits: 8  } },
    { amount: 35000, targets: { signups: 15, deposits: 10 } },
    { amount: 45000, targets: { signups: 20, deposits: 15 } },
  ];
  const scales = [
    { role: 'agent', metric: 'signups_deposits', tiers: fieldTiers },
    { role: 'team_lead', metric: 'team_avg_signups_deposits', tiers: fieldTiers },
    { role: 'manager', metric: 'org_avg_signups_deposits', tiers: mgmtTiers },
    { role: 'backoffice_admin', metric: 'reactivations', tiers: [{ min: 1, amount: 50 }] },
  ];
  for (const s of scales) {
    const exists = await db.prepare(
      `SELECT id FROM incentive_scales WHERE tenant_id = ? AND role = ? AND ${companyId === null ? 'company_id IS NULL' : 'company_id = ?'}`
    ).bind(...(companyId === null ? [tenantId, s.role] : [tenantId, s.role, companyId])).first();
    if (!exists) {
      await db.prepare(
        `INSERT INTO incentive_scales (id, tenant_id, company_id, role, metric, tiers_json, basis, period, active)
         VALUES (?, ?, ?, ?, ?, ?, 'working_days', 'month', 1)`
      ).bind(crypto.randomUUID(), tenantId, companyId, s.role, s.metric, JSON.stringify(s.tiers)).run();
    }
  }

  const configDefaults = {
    commission_per_deposit: 75,
    work_hours: { start: '08:00', end: '17:00' },
    inactivity_minutes: 60,
    working_days_in_month: 22,
    // Per-company metric registry (Approach A). Drives cockpit tiles, gate engine, GM view.
    // Goldrush is the live tenant default; Stellr admins override this key per-company via PUT /config
    // with its own placeholder array (active_users, value_per_user).
    metrics: [
      { key: 'signups',  label: 'Signups',  source: 'internal', visibility: 'all', gate: true, value: false },
      { key: 'deposits', label: 'Deposits', source: 'bo_file',  visibility: 'all', gate: true, value: false },
    ],
    reactivation_window: 120,
    escalate_steps: [
      { after_min: 0, to: 'employee' },
      { after_min: 30, to: 'team_lead' },
      { after_min: 60, to: 'manager' },
    ],
    salaries: { manager: 0, bo: 0, gm: 0 },
    // Below-lowest-gate floor per role (two-gate engine reads this). Editable post-deploy.
    role_base_salary: { agent: 0, team_lead: 0, manager: 0 },
    leaderboard_visible: true,
    // Inert capture-flag defaults (convergence): goldrush becomes config, not code.
    ...DEFAULT_CAPTURE_CONFIG,
  };
  for (const [key, value] of Object.entries(configDefaults)) {
    // ponytail: insert-once semantics — ON CONFLICT on the real business key
    // (tenant_id, company_id, key) replaces the racy exists-check+insert, and
    // converges with the migration bridge's company-scoped rows on that same tuple.
    await db.prepare(
      `INSERT INTO program_config (id, tenant_id, company_id, key, value_json) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, company_id, key) DO NOTHING`
    ).bind(crypto.randomUUID(), tenantId, companyId, key, JSON.stringify(value)).run();
  }

  // Cockpit: per-role KPI threshold defaults (tenant-level; company overrides via PUT /config).
  // Deterministic id + INSERT OR IGNORE = idempotent, no exists-check.
  const KPI_DEFAULTS = {
    'kpi.agent':          { visits_per_day: 20, signups_per_day: 10, conversion_floor_pct: 25, qualified_floor_pct: 50, drop_pct: 40, quiet_days: 2, baseline_window_days: 14 },
    'kpi.team_lead':      { visits_per_day: 18, signups_per_day: 9,  conversion_floor_pct: 25, qualified_floor_pct: 50, drop_pct: 40, quiet_days: 2, baseline_window_days: 14 },
    'kpi.manager':        { visits_per_day: 16, signups_per_day: 8,  conversion_floor_pct: 22, qualified_floor_pct: 48, drop_pct: 40, quiet_days: 3, baseline_window_days: 21 },
    'kpi.general_manager':{ visits_per_day: 15, signups_per_day: 7,  conversion_floor_pct: 20, qualified_floor_pct: 45, drop_pct: 40, quiet_days: 3, baseline_window_days: 30 },
    'kpi.backoffice_admin': { response_mins: 30, recon_hours: 24, stale_queue_hours: 48, improve_pct: 20 },
  };
  for (const [key, val] of Object.entries(KPI_DEFAULTS)) {
    await db.prepare(
      `INSERT OR IGNORE INTO program_config (id, tenant_id, company_id, key, value_json)
       VALUES (?, ?, NULL, ?, ?)`
    ).bind(`pc-default-${key}`, tenantId, key, JSON.stringify(val)).run();
  }
  return c.json({ success: true, seeded: true });
});

export default app;
