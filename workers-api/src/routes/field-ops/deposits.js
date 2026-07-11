/**
 * Back-Office Goldrush deposit ingest — now a thin alias over the generalized metric rail.
 * POST /deposits normalizes its id-only inputs to deposit facts and forwards to ingestMetricFacts
 * with metric_key='deposits'. GET/DELETE read metric_facts; reconcile promotes signups that have a
 * deposit fact. The two-gate → N-gate engine reads these facts, so ingesting one clears the gate.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { extractGoldrushIds } from '../../services/incentiveService.js';
import { ingestMetricFacts } from './metricFacts.js';

const app = new Hono();
const boRoles = requireRole('admin', 'general_manager', 'backoffice_admin');
const GID = `COALESCE(json_extract(custom_field_values,'$.goldrush_id_entry'),
                      json_extract(custom_field_values,'$.goldrush_id'))`;

// POST /field-ops/deposits — legacy alias. Accepts {deposits:[{goldrush_id,amount}], goldrush_ids, csv}.
app.post('/deposits', boRoles, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  // Normalize every id path to a 9-digit subject_key; deposits are count-only (amount omitted).
  const seen = new Set();
  const facts = [];
  const add = (id) => {
    const m = String(id ?? '').match(/(?<!\d)\d{9}(?!\d)/);
    if (m && !seen.has(m[0])) { seen.add(m[0]); facts.push({ subject_key: m[0] }); }
  };
  // Legacy body.deposits[] may carry amount/deposit_date, but the metrics registry marks
  // 'deposits' count-only (config.js value:false) and the 0019 backfill hardcodes amount
  // NULL — dropped here on purpose, not lost.
  for (const d of Array.isArray(body.deposits) ? body.deposits : []) add(d.goldrush_id);
  for (const id of extractGoldrushIds({ goldrush_ids: body.goldrush_ids, csv: body.csv })) add(id);
  // Rebuild the request body the generalized ingest expects, then delegate.
  c.req.json = async () => ({ company_id: body.company_id ?? null, source_batch: body.source_batch || null, dry_run: !!body.dry_run, facts });
  return ingestMetricFacts(c, 'deposits');
});

// GET /field-ops/deposits — recent deposit facts with a matched flag (BO list screen).
app.get('/deposits', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.req.query('company_id') || null;
  const batch = c.req.query('batch') || null;
  const limit = Math.min(Number(c.req.query('limit')) || 200, 1000);
  const { results } = await db.prepare(
    `SELECT mf.id, mf.company_id, mf.subject_key AS goldrush_id, mf.source_batch, mf.created_at,
            (SELECT 1 FROM visit_individuals vi
              WHERE vi.tenant_id = mf.tenant_id AND ${GID.replace(/custom_field_values/g, 'vi.custom_field_values')} = mf.subject_key
              LIMIT 1) matched
       FROM metric_facts mf
      WHERE mf.tenant_id = ? AND mf.metric_key = 'deposits'
        AND (? IS NULL OR mf.company_id = ?)
        AND (? IS NULL OR mf.source_batch = ?)
      ORDER BY mf.created_at DESC LIMIT ?`
  ).bind(tenantId, companyId, companyId, batch, batch, limit).all();
  // Deposits are count-only by contract for every backoffice role; deposit RAND revenue is GM/admin-only (see gm.js).
  return c.json({ success: true, deposits: (results || []).map((r) => ({ ...r, amount: null, deposit_date: null, matched: !!r.matched })) });
});

// POST /field-ops/deposits/reconcile — promote provisional signups that now have a deposit fact.
app.post('/deposits/reconcile', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const res = await db.prepare(
    `UPDATE visit_individuals
        SET custom_field_values = json_set(COALESCE(custom_field_values,'{}'),'$.verification_status','qualified')
      WHERE tenant_id = ?
        AND COALESCE(json_extract(custom_field_values,'$.verification_status'),'provisional') = 'provisional'
        AND ${GID} IN (SELECT subject_key FROM metric_facts WHERE tenant_id = ? AND metric_key = 'deposits')`
  ).bind(tenantId, tenantId).run();
  return c.json({ success: true, qualified: res.meta?.changes ?? 0 });
});

// DELETE /field-ops/deposits/:id — remove a mistaken deposit fact.
app.delete('/deposits/:id', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const res = await db.prepare(`DELETE FROM metric_facts WHERE tenant_id = ? AND id = ? AND metric_key = 'deposits'`)
    .bind(tenantId, c.req.param('id')).run();
  return c.json({ success: true, deleted: res.meta?.changes ?? 0 });
});

export default app;
