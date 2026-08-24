-- Admin report load time: 25 min -> seconds.
--
-- Three measured problems, all index-shaped:
--
-- 1. `goldrush_upload_failures` is a compat VIEW over `capture_failures` (see
--    lib/goldrush.js ensureCaptureFailures). `capture_failures` was created with
--    only its PK, so the ~31 report sites that do
--      NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)
--    full-scan the whole failures table once per candidate visit row.
--    Measured on a 60k-visit / 3k-failure fixture: one KPI COUNT went
--    6498ms -> 68ms (95x) just from idx_capture_failures_visit.
--
-- 2. Reports filter `LOWER(v.visit_type) = 'individual'` (visit_type has mixed
--    case in prod), which makes every plain visit_type index unusable. SQLite
--    then fell back to idx_visits_date and read the entire tenant date range.
--    An expression index on LOWER(visit_type) restores the seek without
--    changing query semantics: 68ms -> 44ms and a full 4-column index seek.
--
-- 3. /field-ops/performance resolves targets per user, so the admin view fans
--    out to 5-6 D1 queries per agent. The batched replacement needs
--    target_month-leading and (tenant, agent, is_active) covering indexes.
--
-- All statements are idempotent and index-only: no data or schema semantics change.

-- ── 1. capture_failures (read through the goldrush_upload_failures view) ──────
-- Guarded CREATE TABLE: on a DB where ensureCaptureFailures has not run yet the
-- physical table does not exist, and CREATE INDEX would abort the migration.
-- Column list must stay in sync with lib/goldrush.js.
CREATE TABLE IF NOT EXISTS capture_failures (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT, agent_id TEXT, agent_name TEXT,
  team_lead_id TEXT, team_lead_name TEXT, first_name TEXT, last_name TEXT, id_number TEXT,
  identifier_value TEXT, phone TEXT, error_id_number TEXT, error_goldrush_id TEXT,
  error_photo_mismatch TEXT, error_no_btag TEXT, visit_id TEXT, visit_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- The single highest-impact index in this file. Covering, so the NOT EXISTS
-- probe never touches the table.
CREATE INDEX IF NOT EXISTS idx_capture_failures_visit ON capture_failures(visit_id);
-- Upload-failures report: WHERE tenant_id = ? AND visit_date BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_capture_failures_tenant_date ON capture_failures(tenant_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_capture_failures_tenant_agent ON capture_failures(tenant_id, agent_id);

-- ── 2. visits: company-scoped report seeks ───────────────────────────────────
-- Expression index matching the reports' literal predicate
-- `LOWER(v.visit_type) = 'individual' | 'store'`.
CREATE INDEX IF NOT EXISTS idx_visits_company_lowertype_date
  ON visits(tenant_id, company_id, LOWER(visit_type), visit_date);
-- Same shape ordered by created_at, for the reports that ORDER BY v.created_at DESC
-- (goldrush-individuals, goldrush-stores) so the sort is index-ordered.
CREATE INDEX IF NOT EXISTS idx_visits_company_lowertype_created
  ON visits(tenant_id, company_id, LOWER(visit_type), created_at DESC);
-- Company-scoped counts/paging that do not filter on visit_type
-- (checkins list, checkins-by-hour, checkins-by-day, shops/customers analytics).
CREATE INDEX IF NOT EXISTS idx_visits_tenant_company_date
  ON visits(tenant_id, company_id, visit_date, status);

-- ── 3. /field-ops/performance batched target resolution ──────────────────────
-- Batched form is WHERE tenant_id = ? AND target_month = ? AND agent_id IN (...)
CREATE INDEX IF NOT EXISTS idx_monthly_targets_tenant_month_agent
  ON monthly_targets(tenant_id, target_month, agent_id);
-- generateTargetsFromRules / company scoping walk agent_company_links by tenant.
CREATE INDEX IF NOT EXISTS idx_agent_company_links_tenant_agent
  ON agent_company_links(tenant_id, agent_id, is_active, company_id);
CREATE INDEX IF NOT EXISTS idx_agent_company_links_tenant_company
  ON agent_company_links(tenant_id, company_id, is_active, agent_id);
