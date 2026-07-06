// workers-api/src/routes/field-ops/kpi.js
// Cockpit KPI endpoints. Pure helpers (resolveRoleKpiKey) unit-tested; DB endpoints
// aggregate-on-read via kpiSignals. Auth context: middleware sets userId/tenantId/role
// individually (no `auth` object, no companyId in token); companyId comes from ?company_id=.
import { Hono } from 'hono';
import { getConfig } from './config.js';
import { aggregateKpis, evaluateSignals } from '../../services/kpiSignals.js';

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
     GROUP BY v.visit_date`
  ).bind(tenantId, agentId, sinceDate).all()).results ?? [];
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

export default app;
