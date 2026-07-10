-- Performance-issue ledger: the novel accountability layer on top of the existing
-- detect (kpiSignals) + remediate (kpi/remediate) + escalate (checkInactiveAgents) plumbing.
-- One open row per (subject, kind). Owner is who must act now; the SLA clock is owner_since,
-- and reactToIssues re-owns up the org chain when an owner sits on it past their SLA.

CREATE TABLE IF NOT EXISTS issues (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  company_id    TEXT,
  kind          TEXT NOT NULL,                 -- signal class: gone_quiet | below_target | dropped_vs_baseline | low_conversion | ...
  subject_id    TEXT NOT NULL,                 -- the underperforming user the issue is about
  subject_role  TEXT,
  owner_id      TEXT NOT NULL,                 -- who must act now (starts at the subject's team_lead/manager)
  owner_role    TEXT NOT NULL,
  severity      INTEGER NOT NULL DEFAULT 1,    -- higher = worse; drives worst-first ordering
  status        TEXT NOT NULL DEFAULT 'open',  -- open | acted | resolved
  detail        TEXT,                          -- JSON snapshot of the triggering signal(s)
  escalations   INTEGER NOT NULL DEFAULT 0,
  opened_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  owner_since   TEXT DEFAULT CURRENT_TIMESTAMP,-- SLA clock; reset on every re-own
  acted_at      TEXT,
  acted_by      TEXT,
  last_action   TEXT,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- At most one live issue per person (resolved rows don't block a fresh one). `kind` carries the
-- worst current signal and `detail` the full set, so a person never spawns a row per signal type.
CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_live ON issues(tenant_id, subject_id) WHERE status != 'resolved';
-- Owner inbox (my open issues, worst-first) and GM "who isn't acting" scans.
CREATE INDEX IF NOT EXISTS idx_issues_owner ON issues(tenant_id, owner_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_tenant ON issues(tenant_id, status, owner_role);
