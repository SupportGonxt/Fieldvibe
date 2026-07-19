-- migrations/0022_qr_tracking.sql
-- QR tracking step for process flows. A single-use QR code redirects an anonymous
-- scanner to an admin-configured URL and records the hit. One code = one tracked person:
-- the first scan redeems the code (people_reached), a fresh code is issued for the next
-- person. Every hit is logged in qr_scan_events (raw total_scans); only the first hit of
-- each code carries is_redemption=1. Analytics break down by tenant/company/agent/flow.
-- Manual, forward-only (repo convention): apply via `wrangler d1 migrations apply` /
-- `wrangler d1 execute`, then verify with pragma_table_info.

-- One row per generated single-use code.
CREATE TABLE IF NOT EXISTS qr_codes (
  id              TEXT PRIMARY KEY,               -- crypto.randomUUID()
  token           TEXT NOT NULL UNIQUE,           -- opaque unguessable scan token (128-bit base64url)
  tenant_id       TEXT NOT NULL,
  company_id      TEXT,                           -- nullable, matches house multi-tenancy
  process_flow_id TEXT NOT NULL,
  step_key        TEXT NOT NULL DEFAULT 'qr',
  visit_id        TEXT,                           -- the visit that generated it; NULL pre-submit, backfilled on submit
  agent_id        TEXT NOT NULL,                  -- who displayed it (attribution)
  destination_url TEXT NOT NULL,                  -- snapshot of the admin URL at generation time
  status          TEXT NOT NULL DEFAULT 'active', -- active | redeemed | revoked
  redeemed_at     TEXT,
  superseded_by   TEXT,                           -- id of the code that replaced this one on reroll
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_qr_codes_tenant ON qr_codes (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qr_codes_agent  ON qr_codes (tenant_id, agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qr_codes_flow   ON qr_codes (tenant_id, process_flow_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qr_codes_visit  ON qr_codes (visit_id);

-- One row per scan hit (raw count + audit trail). agent_id/process_flow_id/company_id
-- are denormalized from qr_codes so per-agent/flow rollups need no join.
CREATE TABLE IF NOT EXISTS qr_scan_events (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  company_id      TEXT,
  qr_code_id      TEXT NOT NULL,
  agent_id        TEXT NOT NULL,
  process_flow_id TEXT NOT NULL,
  is_redemption   INTEGER NOT NULL DEFAULT 0,     -- 1 only for the first scan of a code
  scanned_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip              TEXT,                            -- CF-Connecting-IP (audit only, not used for dedupe)
  user_agent      TEXT,
  referer         TEXT
);
CREATE INDEX IF NOT EXISTS idx_qr_scans_tenant ON qr_scan_events (tenant_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_qr_scans_agent  ON qr_scan_events (tenant_id, agent_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_qr_scans_code   ON qr_scan_events (qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_flow   ON qr_scan_events (tenant_id, process_flow_id, scanned_at);
