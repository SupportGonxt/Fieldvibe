-- Tracks Goldrush individual captures that were rejected due to invalid SA ID number
-- or invalid Goldrush ID format, before any visit record is created.
-- Used by the Upload Failures report grouped by team lead and agent.

CREATE TABLE IF NOT EXISTS goldrush_upload_failures (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT,
  agent_id TEXT,
  agent_name TEXT,
  team_lead_id TEXT,
  team_lead_name TEXT,
  first_name TEXT,
  last_name TEXT,
  id_number TEXT,
  goldrush_id TEXT,
  phone TEXT,
  error_id_number TEXT,
  error_goldrush_id TEXT,
  visit_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_goldrush_failures_tenant ON goldrush_upload_failures(tenant_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_goldrush_failures_agent ON goldrush_upload_failures(tenant_id, agent_id);
