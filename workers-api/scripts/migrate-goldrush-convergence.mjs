// Guarded normalize-in-place migration: snapshot → build config → normalize
// answers → 4-way equality gate over counts + money → commit or rollback.
// Pure helpers are exported for unit tests; run() wires them to a live D1 binding.
import { buildGoldrushConfig } from '../src/services/programConfig.js';

const GATE_FIELDS = ['signups', 'distinctIdentifiers', 'qualified', 'commissionSum'];

// Canonical goldrush id when the fast-entry scan and the detailed-form capture
// disagree: a valid 9-digit numeric value wins; if both or neither are valid,
// the fast-entry value wins (fallback to whichever key is present). This is the
// single source of truth mirrored by canonicalIdSql() below for the DB engine.
const is9 = (v) => typeof v === 'string' && /^\d{9}$/.test(v);

export function canonicalizeAnswer(cfv) {
  if (!cfv || typeof cfv !== 'object') return cfv;
  if (!('goldrush_id_entry' in cfv) && !('goldrush_id' in cfv)) return { ...cfv };
  const e = cfv.goldrush_id_entry, i = cfv.goldrush_id;
  const canonical = is9(e) && !is9(i) ? e
    : is9(i) && !is9(e) ? i
    : (e ?? i);
  const out = { ...cfv };
  delete out.goldrush_id_entry;
  out.goldrush_id = canonical;
  return out;
}

// SQL mirror of canonicalizeAnswer's value pick, over a custom_field_values
// column ref. is9(x) := 9 chars, all digits. Shared verbatim by the apply
// UPDATE and the gate's distinctIdentifiers count so pre==post is exact.
function canonicalIdSql(cfv) {
  const entry = `JSON_EXTRACT(${cfv},'$.goldrush_id_entry')`;
  const id = `JSON_EXTRACT(${cfv},'$.goldrush_id')`;
  const sql9 = (x) => `(${x} IS NOT NULL AND LENGTH(${x})=9 AND ${x} NOT GLOB '*[^0-9]*')`;
  return `CASE
      WHEN ${sql9(entry)} AND NOT ${sql9(id)} THEN ${entry}
      WHEN ${sql9(id)} AND NOT ${sql9(entry)} THEN ${id}
      ELSE COALESCE(${entry}, ${id}) END`;
}

export function assertEqual(before, after) {
  for (const f of GATE_FIELDS) {
    if (before[f] !== after[f]) {
      throw new Error(`migration gate FAILED on ${f}: before=${before[f]} after=${after[f]}`);
    }
  }
  return true;
}

// db: D1 binding. companyId: goldrush company id. Returns the 4 gate totals.
export async function computeTotals(db, tenantId, companyId) {
  const signups = (await db.prepare(
    `SELECT COUNT(*) n FROM visits v WHERE v.tenant_id=? AND v.company_id=? AND LOWER(v.visit_type)='individual'`
  ).bind(tenantId, companyId).first())?.n ?? 0;
  const distinctIdentifiers = (await db.prepare(
    `SELECT COUNT(DISTINCT ${canonicalIdSql('vi.custom_field_values')}) n
     FROM visit_individuals vi JOIN visits v ON vi.visit_id=v.id
     WHERE v.tenant_id=? AND v.company_id=?`
  ).bind(tenantId, companyId).first())?.n ?? 0;
  const qualified = (await db.prepare(
    `SELECT COUNT(*) n FROM visit_individuals vi JOIN visits v ON vi.visit_id=v.id
     WHERE v.tenant_id=? AND v.company_id=? AND JSON_EXTRACT(vi.custom_field_values,'$.converted')=1`
  ).bind(tenantId, companyId).first())?.n ?? 0;
  const commissionSum = (await db.prepare(
    `SELECT COALESCE(SUM(amount),0) s FROM commission_earnings WHERE tenant_id=?`
  ).bind(tenantId).first())?.s ?? 0;
  return { signups, distinctIdentifiers, qualified, commissionSum };
}

// A row needs canonicalization iff the goldrush_id_entry key is present:
// canonicalizeAnswer always removes it (changing the JSON), and a row with only
// goldrush_id is left byte-identical. JSON_TYPE(...) IS NOT NULL is key-presence
// (returns a type even for a literal-null value), mirroring `'goldrush_id_entry' in cfv`.
// This predicate is shared by the dry-run count and the apply UPDATE so
// wouldUpdate == rows actually written.
const PENDING_PREDICATE =
  `v.tenant_id=? AND v.company_id=? AND JSON_TYPE(vi.custom_field_values,'$.goldrush_id_entry') IS NOT NULL`;

async function countPending(db, tenantId, companyId) {
  return (await db.prepare(
    `SELECT COUNT(*) n FROM visit_individuals vi JOIN visits v ON vi.visit_id=v.id
     WHERE ${PENDING_PREDICATE}`
  ).bind(tenantId, companyId).first())?.n ?? 0;
}

// Full run — invoked from a wrangler script context with { DB } binding.
// Left thin on purpose: the risky logic (canonicalize, gate) is unit-tested above.
export async function run({ db, tenantId, companyId, dryRun = true }) {
  const before = await computeTotals(db, tenantId, companyId);

  // 1. Build config from existing custom-question rows.
  const rows = (await db.prepare(
    `SELECT question_key, question_label, field_type, min_length, max_length,
            check_duplicate, visit_target_type, show_in_reports
     FROM company_custom_questions WHERE tenant_id=? AND company_id=? AND is_active=1`
  ).bind(tenantId, companyId).all()).results ?? [];
  const cfg = buildGoldrushConfig({ tenantId, companyId, rows });

  // 2. How many answer rows would change (no row load — a COUNT, not .all() of 20k+ rows).
  const wouldUpdate = await countPending(db, tenantId, companyId);

  if (dryRun) {
    return { dryRun: true, before, config: cfg, wouldUpdate };
  }

  // 3a. Upsert config entries (a handful of rows).
  for (const e of cfg.entries) {
    await db.prepare(
      // ponytail: two ON CONFLICT targets — id (this writer re-run) and the real
      // business key (tenant_id, company_id, key), so it converges with seed-defaults'
      // company-scoped rows which use a different id namespace for the same tuple.
      `INSERT INTO program_config (id, tenant_id, company_id, key, value_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json
       ON CONFLICT(tenant_id, company_id, key) DO UPDATE SET value_json=excluded.value_json`
    ).bind(`pc-${companyId}-${e.key}`, tenantId, companyId, e.key, e.value_json).run();
  }

  // 3b. Normalize ALL answers in ONE set-based UPDATE — done in the DB engine, not
  // one-UPDATE-per-row. 20k+ sequential UPDATEs would blow D1's per-invocation
  // subrequest cap; this is a single subrequest. goldrush_id := canonicalIdSql
  // (valid-9-digit wins, else entry), then drop goldrush_id_entry.
  await db.prepare(
    `UPDATE visit_individuals
     SET custom_field_values = JSON_REMOVE(
       JSON_SET(custom_field_values, '$.goldrush_id',
         ${canonicalIdSql('custom_field_values')}),
       '$.goldrush_id_entry')
     WHERE id IN (
       SELECT vi.id FROM visit_individuals vi JOIN visits v ON vi.visit_id=v.id
       WHERE ${PENDING_PREDICATE})`
  ).bind(tenantId, companyId).run();

  // 4. Gate.
  const after = await computeTotals(db, tenantId, companyId);
  assertEqual(before, after); // throws → caller rolls back from snapshot
  return { dryRun: false, before, after, updated: wouldUpdate };
}
