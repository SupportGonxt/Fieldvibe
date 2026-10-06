-- AI check: Goldrush screenshot fraud rule set (workers-api/src/lib/imageFraud.js).
-- CI never applies migrations; services/imageFraudService.js ensureImageFraudTables()
-- creates the same tables at runtime. Kept here as the schema of record.

-- Status-bar fingerprint of every Goldrush check-in photo, so a screenshot reused as a
-- template (same clock, battery and icons on different days) can be recognised.
CREATE TABLE IF NOT EXISTS image_fingerprints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT,
  photo_id TEXT,
  agent_id TEXT,
  visit_date TEXT,
  captured_at TEXT,
  goldrush_id TEXT,
  sig TEXT NOT NULL,          -- 24 block means (base64), cheap prefilter
  fp TEXT NOT NULL,           -- 240x18 grey status-bar strip (base64)
  verdict TEXT,
  sb_clock TEXT,              -- status-bar clock read by the vision model, e.g. "13:08"
  sb_battery TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_image_fp_tenant_time ON image_fingerprints(tenant_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_image_fp_visit ON image_fingerprints(visit_id);
CREATE INDEX IF NOT EXISTS idx_image_fp_clock ON image_fingerprints(tenant_id, sb_clock);

-- One row per verdict (upload, pre-submit check, retroactive status-bar match, or the
-- historic scan backfill). Definite fakes are also written to capture_failures with an
-- 'AI check:' reason, which removes them from report totals.
CREATE TABLE IF NOT EXISTS image_fraud_flags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT,
  photo_id TEXT,
  agent_id TEXT,
  agent_name TEXT,
  visit_date TEXT,
  goldrush_id TEXT,
  stage TEXT NOT NULL,        -- upload | precheck | retro | backfill
  verdict TEXT NOT NULL,      -- definite | likely | review | unverifiable | not_profile
  flags TEXT,                 -- JSON array of rule codes
  detail TEXT,
  excluded INTEGER DEFAULT 0,
  source TEXT DEFAULT 'ruleset',
  ruleset TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_image_flags_tenant_date ON image_fraud_flags(tenant_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_image_flags_visit ON image_fraud_flags(visit_id);
