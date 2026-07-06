// workers-api/src/routes/field-ops/kpi.js
// Cockpit KPI endpoints. Pure helpers (resolveRoleKpiKey) unit-tested; DB endpoints
// aggregate-on-read via kpiSignals. Auth context: middleware sets userId/tenantId/role
// individually (no `auth` object, no companyId in token); companyId comes from ?company_id=.
import { Hono } from 'hono';
import { getConfig } from './config.js';
import { aggregateKpis, evaluateSignals } from '../../services/kpiSignals.js';
import { sendPush } from '../../lib/web-push.js';
import { requireRole } from '../../middleware/auth.js';
import { AGENT_ROLES } from '../../services/incentiveService.js';

export function resolveRoleKpiKey(role) {
  if (role === 'team_lead') return 'kpi.team_lead';
  if (role === 'manager') return 'kpi.manager';
  if (role === 'general_manager') return 'kpi.general_manager';
  return 'kpi.agent'; // agent, field_agent, sales_rep, and unknown
}

// Per-day rows for one agent over a window. company_id may be NULL (goldrush legacy).
async function dailyRows(db, tenantId, agentId, sinceDate) {
  return (await db.prepare(
    `SELECT v.visit_date date,
            COUNT(*) visits,
            SUM(CASE WHEN LOWER(v.visit_type)='individual' THEN 1 ELSE 0 END) signups,
            SUM(CASE WHEN JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 THEN 1 ELSE 0 END) qualified
     FROM visits v LEFT JOIN visit_individuals vi ON vi.visit_id=v.id
     WHERE v.tenant_id=? AND v.agent_id=? AND v.visit_date>=? AND v.status='completed'
     GROUP BY v.visit_date
     ORDER BY v.visit_date`
  ).bind(tenantId, agentId, sinceDate).all()).results ?? [];
}

// Aggregate one agent's KPIs + signals over a window. Shared by roster + tenant-signals.
async function agentSignals(db, tenantId, id, thresholds, since) {
  const rows = await dailyRows(db, tenantId, id, since);
  const actual = aggregateKpis(rows);
  const baseline = aggregateKpis(rows.slice(0, Math.ceil(rows.length / 2)));
  const lastVisit = rows.length ? rows[rows.length - 1].date : null;
  const daysSinceLastVisit = lastVisit
    ? Math.floor((Date.now() - Date.parse(lastVisit)) / 86400000) : 999;
  return { actual, signals: evaluateSignals({ actual, baseline, daysSinceLastVisit, thresholds }) };
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
  const since = new Date(Date.parse(c.req.query('today') || '') || Date.now());
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = await dailyRows(db, tenantId, userId, sinceStr);
  const actual = aggregateKpis(rows);
  // baseline = first half of window, recent = whole window (self-relative)
  const baseline = aggregateKpis(rows.slice(0, Math.ceil(rows.length / 2)));
  const lastVisit = rows.length ? rows[rows.length - 1].date : null;
  const daysSinceLastVisit = lastVisit
    ? Math.floor((Date.now() - Date.parse(lastVisit)) / 86400000) : 999;
  const signals = evaluateSignals({ actual, baseline, daysSinceLastVisit, thresholds });
  return c.json({ actual, thresholds, signals });
});

export function rankRoster(agents) {
  return [...agents].sort((x, y) => {
    const bySignals = (y.signals?.length || 0) - (x.signals?.length || 0);
    if (bySignals !== 0) return bySignals;
    return (x.actual?.signups_per_day || 0) - (y.actual?.signups_per_day || 0);
  });
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

app.get('/kpi/roster', async (c) => {
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
    const { actual, signals } = await agentSignals(db, tenantId, id, thresholds, since);
    const u = await db.prepare(`SELECT first_name||' '||last_name name FROM users WHERE id=?`).bind(id).first();
    agents.push({ agentId: id, name: u?.name || id, actual, signals });
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
    `SELECT id FROM users WHERE tenant_id=? AND is_active=1 AND role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND (agent_type IS NULL OR agent_type IN ('field_ops','both'))`
  ).bind(tenantId, ...AGENT_ROLES).all()).results ?? [];

  const counts = { below_target: 0, dropped_vs_baseline: 0, gone_quiet: 0, low_conversion: 0 };
  let flaggedAgents = 0;
  for (const { id } of agents) {
    const { signals } = await agentSignals(db, tenantId, id, thresholds, since);
    if (signals.length) flaggedAgents++;
    for (const s of signals) if (s.type in counts) counts[s.type]++;
  }
  return c.json({ counts, flaggedAgents, totalAgents: agents.length });
});

// --- Remediation (Task 2.5) ---
// Auth: individual c.get()s (no `auth` object). Live symbols verified against
// web-push.js (sendPush(env, sub, payload) → {ok,status}) and push_subscriptions
// (flat endpoint/p256dh/auth cols) — the plan's sendWebPush/subscription-JSON is stale.

// Pure: shapes a coaching_notes row. Unit-tested.
export function coachingNoteRow({ id, tenantId, companyId, managerId, agentId, signalType, action, note }) {
  return {
    id, tenant_id: tenantId, company_id: companyId ?? null,
    manager_id: managerId, agent_id: agentId,
    signal_type: signalType ?? null, action, note: note ?? null,
  };
}

// coaching_notes DDL lives in schema.sql (applied via db:migrate). Guard the write
// path so a not-yet-migrated D1 never 500s — mirrors Task 1.7's ensureCaptureFailures.
async function ensureCoachingNotes(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS coaching_notes (
       id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT,
       manager_id TEXT NOT NULL, agent_id TEXT NOT NULL, signal_type TEXT,
       action TEXT NOT NULL, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`
  ).run();
}

app.post('/kpi/remediate/note', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const companyId = c.req.query('company_id') || null;
  const b = await c.req.json();
  const row = coachingNoteRow({
    id: `cn-${userId}-${b.agentId}-${b.created_suffix || ''}`,
    tenantId, companyId, managerId: userId, agentId: b.agentId,
    signalType: b.signalType, action: b.action || 'note', note: b.note,
  });
  await ensureCoachingNotes(db);
  await db.prepare(
    `INSERT INTO coaching_notes (id, tenant_id, company_id, manager_id, agent_id, signal_type, action, note)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(row.id, row.tenant_id, row.company_id, row.manager_id, row.agent_id, row.signal_type, row.action, row.note).run();
  return c.json({ ok: true, id: row.id });
});

app.post('/kpi/remediate/nudge', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const b = await c.req.json();
  const subs = (await db.prepare(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id=? AND user_id=?`
  ).bind(tenantId, b.agentId).all()).results ?? [];
  if (!subs.length) return c.json({ ok: false, reason: 'no_subscription' }, 404);
  const payload = { title: 'Performance nudge', body: b.message || 'Check in with your manager.' };
  let delivered = 0;
  for (const sub of subs) {
    const { ok, status } = await sendPush(c.env, sub, payload);
    if (ok) delivered++;
    else if (status === 404 || status === 410) {
      await db.prepare(`DELETE FROM push_subscriptions WHERE tenant_id=? AND user_id=? AND endpoint=?`)
        .bind(tenantId, b.agentId, sub.endpoint).run();
    }
  }
  return c.json({ ok: delivered > 0, delivered });
});

app.post('/kpi/remediate/call', async (c) => {
  const b = await c.req.json();
  // Reuse the voice-call room path: return a room id the client opens.
  const roomId = `coach-${c.get('userId')}-${b.agentId}`;
  return c.json({ ok: true, roomId });
});

export default app;
