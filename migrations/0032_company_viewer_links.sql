-- company_viewer role: a client login (e.g. Diplomat) that may only read its own
-- company's Stores report. One row per viewer user; the auth gate in
-- workers-api/src/lib/companyViewer.js reads the company from here, never from the request.
-- CI never applies migrations: run this by hand on each D1 (fieldvibe-db, fieldvibe-dev).

CREATE TABLE IF NOT EXISTS company_viewer_links (
  user_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
