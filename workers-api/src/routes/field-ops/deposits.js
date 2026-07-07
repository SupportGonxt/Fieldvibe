/**
 * Back-Office Goldrush deposit ingest.
 * goldrush_deposits holds BO-confirmed deposits keyed by canonical goldrush_id.
 * The two-gate incentive engine LEFT JOINs this table to count an agent's deposit gate,
 * so ingesting a deposit here is what makes a signup's deposit "count" — no promotion step.
 * Match rule: a deposit maps to a signup when its goldrush_id equals the signup's canonical id
 * (custom_field_values.goldrush_id_entry, else .goldrush_id).
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { extractGoldrushIds } from '../../services/incentiveService.js';

const app = new Hono();
const boRoles = requireRole('admin', 'general_manager', 'backoffice_admin');

// Canonical goldrush id expression over visit_individuals.
const GID = `COALESCE(json_extract(custom_field_values,'$.goldrush_id_entry'),
                      json_extract(custom_field_values,'$.goldrush_id'))`;

// POST /field-ops/deposits — ingest confirmed deposits.
// body: { company_id?, deposits?: [{goldrush_id, deposit_date?, amount?}], goldrush_ids?: string[], csv?: string,
//         source_batch?, dry_run?: boolean }
// Structured `deposits` carry date/amount; goldrush_ids/csv are id-only (9-digit extraction).
// Idempotent: unique(tenant_id, goldrush_id) means re-uploading an id is a no-op.
app.post('/deposits', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const companyId = body.company_id ?? null;
  const batch = body.source_batch || null;

  // Normalize every input path to { goldrush_id, deposit_date, amount }.
  const rows = [];
  const seen = new Set();
  const add = (id, date, amount) => {
    const m = String(id ?? '').match(/(?<!\d)\d{9}(?!\d)/);
    if (!m || seen.has(m[0])) return;
    seen.add(m[0]);
    rows.push({ goldrush_id: m[0], deposit_date: date || null, amount: amount == null ? null : Number(amount) });
  };
  for (const d of Array.isArray(body.deposits) ? body.deposits : []) add(d.goldrush_id, d.deposit_date, d.amount);
  for (const id of extractGoldrushIds({ goldrush_ids: body.goldrush_ids, csv: body.csv })) add(id);

  if (rows.length === 0) {
    return c.json({ success: false, error: 'No 9-digit Goldrush IDs found in the upload' }, 400);
  }

  // Which deposits map to an existing signup? Report the rest for BO chasing.
  const placeholders = rows.map(() => '?').join(',');
  const { results: found } = await db.prepare(
    `SELECT DISTINCT ${GID} g FROM visit_individuals WHERE tenant_id = ? AND ${GID} IN (${placeholders})`
  ).bind(tenantId, ...rows.map((r) => r.goldrush_id)).all();
  const matched = new Set((found || []).map((r) => String(r.g)));
  const unmatched = rows.map((r) => r.goldrush_id).filter((id) => !matched.has(id));

  if (body.dry_run) {
    return c.json({ success: true, dry_run: true, uploaded: rows.length, matched: matched.size, unmatched });
  }

  // INSERT OR IGNORE against unique(tenant_id, goldrush_id) — re-uploads are inert.
  let inserted = 0;
  for (const r of rows) {
    const res = await db.prepare(
      `INSERT OR IGNORE INTO goldrush_deposits
         (id, tenant_id, company_id, goldrush_id, deposit_date, amount, source_batch, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), tenantId, companyId, r.goldrush_id, r.deposit_date, r.amount, batch, userId).run();
    inserted += res.meta?.changes ?? 0;
  }

  return c.json({
    success: true,
    uploaded: rows.length,
    inserted,
    duplicates: rows.length - inserted,
    matched: matched.size,
    unmatched,
  });
});

// GET /field-ops/deposits?company_id=&batch=&limit= — recent deposits with a matched flag.
app.get('/deposits', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.req.query('company_id') || null;
  const batch = c.req.query('batch') || null;
  const limit = Math.min(Number(c.req.query('limit')) || 200, 1000);

  // matched = 1 when a signup exists with this canonical goldrush id.
  const { results } = await db.prepare(
    `SELECT gd.*,
            (SELECT 1 FROM visit_individuals vi
              WHERE vi.tenant_id = gd.tenant_id AND ${GID.replace(/custom_field_values/g, 'vi.custom_field_values')} = gd.goldrush_id
              LIMIT 1) matched
       FROM goldrush_deposits gd
      WHERE gd.tenant_id = ?
        AND (? IS NULL OR gd.company_id = ?)
        AND (? IS NULL OR gd.source_batch = ?)
      ORDER BY gd.created_at DESC
      LIMIT ?`
  ).bind(tenantId, companyId, companyId, batch, batch, limit).all();
  return c.json({ success: true, deposits: (results || []).map((r) => ({ ...r, matched: !!r.matched })) });
});

// POST /field-ops/deposits/reconcile — promote signups that now have a confirmed deposit
// from provisional -> qualified. No clawback. Idempotent. body: { company_id? }
app.post('/deposits/reconcile', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const res = await db.prepare(
    `UPDATE visit_individuals
        SET custom_field_values = json_set(COALESCE(custom_field_values,'{}'),'$.verification_status','qualified')
      WHERE tenant_id = ?
        AND COALESCE(json_extract(custom_field_values,'$.verification_status'),'provisional') = 'provisional'
        AND ${GID} IN (SELECT goldrush_id FROM goldrush_deposits WHERE tenant_id = ?)`
  ).bind(tenantId, tenantId).run();
  return c.json({ success: true, qualified: res.meta?.changes ?? 0 });
});

// DELETE /field-ops/deposits/:id — remove a mistaken deposit row.
app.delete('/deposits/:id', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const res = await db.prepare(
    `DELETE FROM goldrush_deposits WHERE tenant_id = ? AND id = ?`
  ).bind(tenantId, c.req.param('id')).run();
  return c.json({ success: true, deleted: res.meta?.changes ?? 0 });
});

export default app;
