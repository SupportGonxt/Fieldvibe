-- AI shelf analysis for the per-product audit photos captured during a store visit
-- (Diplomat's product questionnaire). Kept out of visit_photos.ai_* on purpose: those
-- columns hold a different analysis — brands, facings, share of wall — that Goldrush's
-- board and share-of-voice reporting reads, and mixing two answer shapes into one row
-- would make both harder to query.
--
-- status: pending -> processing -> complete | failed.
-- A model reply that isn't valid JSON lands as 'failed' with the reply kept verbatim in
-- raw_model_response, so a bad prompt can be diagnosed after the fact rather than
-- vanishing into a log line. raw_model_response also holds the error text when the
-- Workers AI call itself failed.
CREATE TABLE IF NOT EXISTS shelf_photo_analysis (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  -- Which product's audit photo this is, as named in the company's product list.
  product TEXT,
  shelf_level TEXT,            -- top | eye_level | middle | bottom | floor | unclear
  visibility_score INTEGER,    -- 1-10
  obstructions TEXT,           -- JSON array of short strings
  estimated_facings INTEGER,   -- NULL when the model could not count them
  notes TEXT,
  confidence TEXT,             -- low | medium | high
  status TEXT NOT NULL DEFAULT 'pending',
  raw_model_response TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  analysed_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- One analysis per photo. Makes the queue insert idempotent (INSERT OR IGNORE), so a
-- retried upload cannot pay for the same photo twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_shelf_analysis_photo ON shelf_photo_analysis(photo_id);

-- Reading a visit's analyses back for the manager view.
CREATE INDEX IF NOT EXISTS idx_shelf_analysis_visit ON shelf_photo_analysis(tenant_id, visit_id);

-- The cron drain scans for pending work oldest-first.
CREATE INDEX IF NOT EXISTS idx_shelf_analysis_status ON shelf_photo_analysis(status, created_at);
