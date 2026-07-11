-- migrations/0019_metric_facts.sql
-- Generalized per-company metric rail. Replaces the Goldrush-specific goldrush_deposits
-- table with a metric-keyed fact store so any company's KPIs (deposits, active users,
-- value/user, …) share one shape. The incentive engine reads gate averages from here.
--   period NULL      = cumulative fact (a deposit exists / doesn't) — counted, never summed by month.
--   period 'YYYY-MM' = monthly fact (retention, active users) — one row per subject per month.
--   amount NULL      = count-only metric (deposits); a number for value metrics.
-- Idempotent-additive: the NULL-safe unique index blocks a duplicate fact; ingest uses INSERT OR IGNORE. No clawback.
CREATE TABLE IF NOT EXISTS metric_facts (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  company_id   TEXT,
  metric_key   TEXT NOT NULL,               -- 'deposits' | 'active_users' | 'value_per_user' | …
  subject_key  TEXT NOT NULL,               -- canonical id the fact is about (e.g. 9-digit goldrush_id)
  amount       REAL,                         -- NULL for count-only metrics; a value for value metrics
  period       TEXT,                         -- NULL = cumulative; 'YYYY-MM' = monthly
  source_batch TEXT,
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

-- NULL-safe uniqueness: SQLite treats NULL as distinct in UNIQUE constraints, so a plain
-- UNIQUE(...) never dedupes period-NULL (cumulative) or company-NULL rows. COALESCE to ''
-- makes INSERT OR IGNORE a true no-op for a re-uploaded fact.
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_facts_unique
  ON metric_facts (tenant_id, COALESCE(company_id,''), metric_key, subject_key, COALESCE(period,''));

-- Engine join: count facts for one metric_key scoped to a tenant/company/subject.
CREATE INDEX IF NOT EXISTS idx_metric_facts_lookup
  ON metric_facts (tenant_id, company_id, metric_key, subject_key);

-- Backfill: every confirmed Goldrush deposit becomes a deposits fact. period NULL (cumulative),
-- amount NULL (count-only gate), subject_key = the deposit's goldrush_id. INSERT OR IGNORE so
-- re-running the migration is inert and any duplicate (tenant,company,goldrush_id) collapses to one.
INSERT OR IGNORE INTO metric_facts
  (id, tenant_id, company_id, metric_key, subject_key, amount, period, source_batch, created_at)
SELECT
  gd.id, gd.tenant_id, gd.company_id, 'deposits', gd.goldrush_id, NULL, NULL, gd.source_batch, gd.created_at
FROM goldrush_deposits gd;
