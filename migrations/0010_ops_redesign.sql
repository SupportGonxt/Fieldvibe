-- 0010_ops_redesign.sql — Operations redesign: incentive engine, new roles, inactivity, P&L
-- Net-new tables + column adds. Column ALTERs throw "duplicate column" on re-run; ignore those.

CREATE TABLE IF NOT EXISTS incentive_scales (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT,
  role TEXT NOT NULL, metric TEXT NOT NULL, tiers_json TEXT NOT NULL,
  basis TEXT DEFAULT 'working_days', period TEXT DEFAULT 'month',
  active INTEGER DEFAULT 1, effective_from TEXT, effective_to TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS program_config (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT,
  key TEXT NOT NULL, value_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS inactivity_events (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL,
  detected_at TEXT NOT NULL, resolved_at TEXT, resolved_by TEXT, data_call_id TEXT,
  escalation_level INTEGER DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS data_calls (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  bo_admin_id TEXT NOT NULL, target_user_id TEXT NOT NULL,
  inactivity_event_id TEXT, trigger TEXT DEFAULT 'inactivity',
  channel TEXT, notes TEXT, outcome TEXT,
  alerted_at TEXT, actioned_at TEXT, resulted_in_activity INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS training_days (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL,
  date TEXT NOT NULL, reason TEXT, created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS goldrush_imports (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT,
  uploaded_by TEXT NOT NULL, source TEXT, row_count INTEGER,
  matched_count INTEGER, unmatched_count INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_incentive_scales_lookup ON incentive_scales(tenant_id, company_id, role, active);
CREATE INDEX IF NOT EXISTS idx_program_config_lookup ON program_config(tenant_id, company_id, key);
CREATE INDEX IF NOT EXISTS idx_inactivity_open ON inactivity_events(tenant_id, resolved_at);
CREATE INDEX IF NOT EXISTS idx_data_calls_target ON data_calls(tenant_id, target_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_training_days_lookup ON training_days(tenant_id, user_id, date);

ALTER TABLE users ADD COLUMN gm_id TEXT;
ALTER TABLE users ADD COLUMN last_activity_at TEXT;
ALTER TABLE tenants ADD COLUMN timezone TEXT DEFAULT 'Africa/Johannesburg';
ALTER TABLE individual_registrations ADD COLUMN goldrush_id_photo_url TEXT;
ALTER TABLE individual_registrations ADD COLUMN verification_status TEXT DEFAULT 'provisional';
ALTER TABLE individual_registrations ADD COLUMN verified_at TEXT;
