-- Per-company org: a person can hold a different role/hierarchy in each field_company.
-- NULL link columns fall back to the user's global users.* value in code.
ALTER TABLE agent_company_links ADD COLUMN role TEXT;
ALTER TABLE agent_company_links ADD COLUMN team_lead_id TEXT;
ALTER TABLE agent_company_links ADD COLUMN manager_id TEXT;

-- Backfill each existing link from the user's current global values so behavior is
-- identical until a per-company override is set.
UPDATE agent_company_links
   SET role         = COALESCE(role,         (SELECT u.role         FROM users u WHERE u.id = agent_company_links.agent_id)),
       team_lead_id = COALESCE(team_lead_id, (SELECT u.team_lead_id FROM users u WHERE u.id = agent_company_links.agent_id)),
       manager_id   = COALESCE(manager_id,   (SELECT u.manager_id   FROM users u WHERE u.id = agent_company_links.agent_id));

-- Widen live-issue uniqueness to include company so one subject can hold a live issue
-- per company. COALESCE(company_id,'') keeps tenant-level rows (BO admin, company_id NULL)
-- deduping — a bare NULL is distinct-per-row in a SQLite unique index.
DROP INDEX IF EXISTS idx_issues_live;
CREATE UNIQUE INDEX idx_issues_live
  ON issues(tenant_id, subject_id, COALESCE(company_id,''), polarity) WHERE status != 'resolved';
