// Runtime convergence for the report indexes.
//
// migrations/0023_report_performance_indexes.sql is the declarative source of truth,
// but the deploy pipeline (.github/workflows/ci-cd.yml) only runs `wrangler deploy` —
// it never runs `wrangler d1 migrations apply` — so a migration file on its own never
// reaches the production database. The same reason lib/goldrush.js converges the
// capture_failures table/view at runtime applies here.
//
// Cost is one D1 batch per Worker isolate, once, on the first report request. Every
// statement is CREATE INDEX IF NOT EXISTS, so a database that already has them (via
// the migration, or a previous isolate) pays a no-op.
//
// Why these indexes: see the header of migration 0023. The short version is that
// `goldrush_upload_failures` is a view over capture_failures, capture_failures had no
// index on visit_id, and ~31 report queries filter visits with
//   NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)
// which without that index full-scans the failures table once per candidate visit row.

const STATEMENTS = [
  // capture_failures may not exist yet on a database that has never logged a capture
  // rejection; CREATE INDEX on a missing table would fail the whole batch.
  `CREATE TABLE IF NOT EXISTS capture_failures (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT, agent_id TEXT, agent_name TEXT,
    team_lead_id TEXT, team_lead_name TEXT, first_name TEXT, last_name TEXT, id_number TEXT,
    identifier_value TEXT, phone TEXT, error_id_number TEXT, error_goldrush_id TEXT,
    error_photo_mismatch TEXT, error_no_btag TEXT, visit_id TEXT, visit_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  'CREATE INDEX IF NOT EXISTS idx_capture_failures_visit ON capture_failures(visit_id)',
  'CREATE INDEX IF NOT EXISTS idx_capture_failures_tenant_date ON capture_failures(tenant_id, visit_date)',
  'CREATE INDEX IF NOT EXISTS idx_capture_failures_tenant_agent ON capture_failures(tenant_id, agent_id)',
  // Expression indexes: the reports compare LOWER(visit_type), which makes a plain
  // visit_type index unusable (visit_type has mixed case in production data).
  'CREATE INDEX IF NOT EXISTS idx_visits_company_lowertype_date ON visits(tenant_id, company_id, LOWER(visit_type), visit_date)',
  'CREATE INDEX IF NOT EXISTS idx_visits_company_lowertype_created ON visits(tenant_id, company_id, LOWER(visit_type), created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_visits_tenant_company_date ON visits(tenant_id, company_id, visit_date, status)',
  'CREATE INDEX IF NOT EXISTS idx_monthly_targets_tenant_month_agent ON monthly_targets(tenant_id, target_month, agent_id)',
  'CREATE INDEX IF NOT EXISTS idx_agent_company_links_tenant_agent ON agent_company_links(tenant_id, agent_id, is_active, company_id)',
  'CREATE INDEX IF NOT EXISTS idx_agent_company_links_tenant_company ON agent_company_links(tenant_id, company_id, is_active, agent_id)',
  // Covering index for the report thumbnail lookups. It MUST carry r2_key and id: a
  // SQLite secondary index stores the rowid, not a TEXT PRIMARY KEY, so without id in
  // the index the planner fetches the base row — and that row holds the ~85 KB base64
  // JPEG in r2_url, which is exactly the read these queries were changed to avoid.
  'CREATE INDEX IF NOT EXISTS idx_visit_photos_visit_key ON visit_photos(visit_id, tenant_id, r2_key, id)',
  // /api/uploads/:key falls back to the D1 blob when the bucket has no object (legacy
  // rows were never uploaded). That lookup is by r2_key.
  'CREATE INDEX IF NOT EXISTS idx_visit_photos_r2_key ON visit_photos(r2_key)',
];

// Per-isolate latch. Set before awaiting so concurrent first requests don't all issue
// the DDL; a failure just means the next isolate retries, which is the right tradeoff
// for something that must never block a report from rendering.
let converged = false;

async function ensureReportIndexes(db) {
  if (converged) return;
  converged = true;
  // Deliberately one statement at a time rather than db.batch(): a batch is a single
  // transaction, so one unexpected failure (a table missing on some environment) would
  // roll back all ten and leave idx_capture_failures_visit — the one that actually
  // matters — uncreated. Each statement is independent, so isolate the failures.
  for (const sql of STATEMENTS) {
    try {
      await db.prepare(sql).run();
    } catch (e) {
      // Never fail a report because an index could not be created; the query still
      // returns correct results, just slower.
      console.error('ensureReportIndexes:', sql.slice(0, 80), e?.message || e);
    }
  }
}

// Hono middleware form, for `app.use('*', reportIndexMiddleware)` at the top of a
// report route module.
async function reportIndexMiddleware(c, next) {
  // Do NOT await: this is ten sequential CREATE INDEX round trips, and awaiting them
  // added ten D1 latencies to the first report request every isolate served. The
  // indexes are already present in production, so every one of those round trips was
  // a no-op the user waited on. Kept as a background convergence for a fresh database.
  if (c.env?.DB) {
    const converging = ensureReportIndexes(c.env.DB);
    // c.executionCtx THROWS (it does not return undefined) when there is no
    // ExecutionContext, e.g. a unit test calling app.fetch(req) with no ctx.
    try { c.executionCtx.waitUntil(converging); } catch { /* no ctx: let it run unawaited */ }
  }
  return next();
}

export { ensureReportIndexes, reportIndexMiddleware };
