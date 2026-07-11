/**
 * Generalized metric-fact ingest (the metric rail). A metric fact = one (metric_key, subject_key)
 * datum for a company: a confirmed deposit, an active user, a value-per-user number. Deposits are
 * the live case; other keys are seeded per-company via the metrics registry. Idempotent-additive:
 * INSERT OR IGNORE against UNIQUE(tenant,company,metric_key,subject,period) — re-upload is a no-op.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';

const app = new Hono();
const boRoles = requireRole('admin', 'general_manager', 'backoffice_admin');

// Canonical goldrush id expression over visit_individuals — used to flag which deposit facts
// map to an existing signup (BO chases the rest). Only meaningful for metric_key='deposits'.
const GID = `COALESCE(json_extract(custom_field_values,'$.goldrush_id_entry'),
                      json_extract(custom_field_values,'$.goldrush_id'))`;

// POST /field-ops/metric-facts — ingest facts for one metric_key.
export async function ingestMetricFacts(c, forcedKey) {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => ({}));
  const companyId = body.company_id ?? null;
  const metricKey = forcedKey || body.metric_key;
  const period = body.period ?? null;
  const batch = body.source_batch || null;
  if (!metricKey) return c.json({ success: false, error: 'metric_key required' }, 400);

  // Normalize facts: dedupe by subject_key, coerce amount.
  const rows = [];
  const seen = new Set();
  for (const f of Array.isArray(body.facts) ? body.facts : []) {
    const key = String(f.subject_key ?? '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push({ subject_key: key, amount: f.amount == null ? null : Number(f.amount) });
  }
  if (rows.length === 0) return c.json({ success: false, error: 'No facts in the upload' }, 400);

  // For deposits, report which subject_keys map to a signup so BO can chase the rest.
  let matched = new Set();
  if (metricKey === 'deposits') {
    const ph = rows.map(() => '?').join(',');
    const { results: found } = await db.prepare(
      `SELECT DISTINCT ${GID} g FROM visit_individuals WHERE tenant_id = ? AND ${GID} IN (${ph})`
    ).bind(tenantId, ...rows.map((r) => r.subject_key)).all();
    matched = new Set((found || []).map((r) => String(r.g)));
  }
  const unmatched = metricKey === 'deposits' ? rows.map((r) => r.subject_key).filter((k) => !matched.has(k)) : [];

  if (body.dry_run) {
    return c.json({ success: true, dry_run: true, uploaded: rows.length, matched: matched.size, unmatched });
  }

  // Cross-company fan-out guard: a subject_key already on file under a DIFFERENT company_id
  // (NULL/'' bucketed together, matching the unique index) would insert as a distinct row —
  // the unique index only collapses same-company re-uploads. agentCount's metric_facts join
  // has no company_id filter, so a second row for the same subject double-counts deposits on
  // the commission gate. One batch SELECT, skip the offending rows, report them as conflicts.
  const ph = rows.map(() => '?').join(',');
  const { results: crossCompany } = await db.prepare(
    `SELECT subject_key, company_id FROM metric_facts
      WHERE tenant_id = ? AND metric_key = ? AND subject_key IN (${ph})
        AND COALESCE(company_id,'') != COALESCE(?,'')`
  ).bind(tenantId, metricKey, ...rows.map((r) => r.subject_key), companyId).all();
  const conflictBySubject = new Map();
  for (const row of crossCompany || []) {
    if (!conflictBySubject.has(row.subject_key)) conflictBySubject.set(row.subject_key, row.company_id);
  }
  const conflicts = [...conflictBySubject].map(([subject_key, existing_company_id]) => ({ subject_key, existing_company_id }));
  const acceptedRows = rows.filter((r) => !conflictBySubject.has(r.subject_key));

  let inserted = 0;
  for (const r of acceptedRows) {
    const res = await db.prepare(
      `INSERT OR IGNORE INTO metric_facts (id, tenant_id, company_id, metric_key, subject_key, amount, period, source_batch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), tenantId, companyId, metricKey, r.subject_key, r.amount, period, batch).run();
    inserted += res.meta?.changes ?? 0;
  }
  return c.json({
    success: true,
    uploaded: rows.length,
    inserted,
    duplicates: acceptedRows.length - inserted,
    conflicts,
    matched: matched.size,
    unmatched,
  });
}

app.post('/metric-facts', boRoles, (c) => ingestMetricFacts(c));

// GET /field-ops/metric-facts?company_id=&metric_key=&batch=&limit=
app.get('/metric-facts', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.req.query('company_id') || null;
  const metricKey = c.req.query('metric_key') || null;
  const batch = c.req.query('batch') || null;
  const limit = Math.min(Number(c.req.query('limit')) || 200, 1000);
  const { results } = await db.prepare(
    `SELECT mf.*,
            (SELECT 1 FROM visit_individuals vi
              WHERE vi.tenant_id = mf.tenant_id AND ${GID.replace(/custom_field_values/g, 'vi.custom_field_values')} = mf.subject_key
              LIMIT 1) matched
       FROM metric_facts mf
      WHERE mf.tenant_id = ?
        AND (? IS NULL OR mf.company_id = ?)
        AND (? IS NULL OR mf.metric_key = ?)
        AND (? IS NULL OR mf.source_batch = ?)
      ORDER BY mf.created_at DESC
      LIMIT ?`
  ).bind(tenantId, companyId, companyId, metricKey, metricKey, batch, batch, limit).all();
  // Deposit/value rand amounts are GM-only; backoffice_admin sees the facts but not the money.
  const canSeeAmount = ['admin', 'general_manager'].includes(c.get('role'));
  return c.json({
    success: true,
    facts: (results || []).map((r) => ({ ...r, amount: canSeeAmount ? r.amount : null, matched: !!r.matched })),
  });
});

// DELETE /field-ops/metric-facts/:id
app.delete('/metric-facts/:id', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const res = await db.prepare(`DELETE FROM metric_facts WHERE tenant_id = ? AND id = ?`)
    .bind(tenantId, c.req.param('id')).run();
  return c.json({ success: true, deleted: res.meta?.changes ?? 0 });
});

export default app;
