// Guarded normalize-in-place migration: snapshot → build config → normalize
// answers → 4-way equality gate over counts + money → commit or rollback.
// Pure helpers are exported for unit tests; run() wires them to a live D1 binding.
import { buildGoldrushConfig } from '../src/services/programConfig.js';

const GATE_FIELDS = ['signups', 'distinctIdentifiers', 'qualified', 'commissionSum'];

export function canonicalizeAnswer(cfv) {
  if (!cfv || typeof cfv !== 'object') return cfv;
  if (!('goldrush_id_entry' in cfv) && !('goldrush_id' in cfv)) return { ...cfv };
  const canonical = cfv.goldrush_id_entry ?? cfv.goldrush_id;
  const out = { ...cfv };
  delete out.goldrush_id_entry;
  out.goldrush_id = canonical;
  return out;
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
    `SELECT COUNT(DISTINCT JSON_EXTRACT(vi.custom_field_values,'$.goldrush_id')) n
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

// Full run — invoked from a wrangler script context with { DB } binding.
// Left thin on purpose: the risky logic (canonicalize, gate) is unit-tested above.
export async function run({ db, tenantId, companyId, dryRun = true }) {
  const before = await computeTotals(db, tenantId, companyId);

  // 1. Build + upsert config from existing custom-question rows.
  const rows = (await db.prepare(
    `SELECT question_key, question_label, field_type, min_length, max_length,
            check_duplicate, visit_target_type, show_in_reports
     FROM company_custom_questions WHERE tenant_id=? AND company_id=? AND is_active=1`
  ).bind(tenantId, companyId).all()).results ?? [];
  const cfg = buildGoldrushConfig({ tenantId, companyId, rows });

  // 2. Normalize answers in place (collapse goldrush_id_entry → goldrush_id).
  const vis = (await db.prepare(
    `SELECT vi.id, vi.custom_field_values FROM visit_individuals vi
     JOIN visits v ON vi.visit_id=v.id WHERE v.tenant_id=? AND v.company_id=?`
  ).bind(tenantId, companyId).all()).results ?? [];
  const updates = [];
  for (const r of vis) {
    let cfv; try { cfv = JSON.parse(r.custom_field_values || '{}'); } catch { cfv = {}; }
    const next = canonicalizeAnswer(cfv);
    if (JSON.stringify(next) !== JSON.stringify(cfv)) {
      updates.push({ id: r.id, value: JSON.stringify(next) });
    }
  }

  if (dryRun) {
    return { dryRun: true, before, config: cfg, wouldUpdate: updates.length };
  }

  // 3. Apply config + normalized answers.
  for (const e of cfg.entries) {
    await db.prepare(
      `INSERT INTO program_config (id, tenant_id, company_id, key, value_json)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(`pc-${companyId}-${e.key}`, tenantId, companyId, e.key, e.value_json).run();
  }
  for (const u of updates) {
    await db.prepare(`UPDATE visit_individuals SET custom_field_values=? WHERE id=?`)
      .bind(u.value, u.id).run();
  }

  // 4. Gate.
  const after = await computeTotals(db, tenantId, companyId);
  assertEqual(before, after); // throws → caller rolls back from snapshot
  return { dryRun: false, before, after, updated: updates.length };
}
