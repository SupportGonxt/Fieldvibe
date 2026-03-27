-- Migration: 001_initial_schema
-- Created: 2026-03-27
-- Description: Initial modular schema with all core tables

-- Core visit tables
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  customer_id TEXT,
  visit_date TEXT NOT NULL,
  visit_type TEXT DEFAULT 'customer',
  check_in_time TEXT,
  check_out_time TEXT,
  latitude REAL,
  longitude REAL,
  brand_id TEXT,
  company_id TEXT,
  individual_name TEXT,
  individual_surname TEXT,
  individual_id_number TEXT,
  individual_phone TEXT,
  purpose TEXT,
  notes TEXT,
  questionnaire_id TEXT,
  status TEXT DEFAULT 'pending',
  outcome TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS individual_registrations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  company_id TEXT,
  visit_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  id_number TEXT,
  phone TEXT,
  email TEXT,
  product_app_player_id TEXT,
  converted INTEGER DEFAULT 0,
  conversion_date TEXT,
  notes TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS individuals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  id_number TEXT,
  phone TEXT,
  email TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  company_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'retail',
  customer_type TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Visit relationships
CREATE TABLE IF NOT EXISTS visit_individuals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  individual_id TEXT NOT NULL,
  custom_field_values TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visit_responses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  visit_type TEXT,
  responses TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visit_photos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  photo_type TEXT DEFAULT 'board',
  r2_key TEXT,
  r2_url TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  captured_at TEXT,
  photo_hash TEXT,
  board_placement_location TEXT,
  board_placement_position TEXT,
  board_condition TEXT,
  sample_board_id TEXT,
  uploaded_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User management
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'agent',
  team_lead_id TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS field_companies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Targets
CREATE TABLE IF NOT EXISTS monthly_targets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  company_id TEXT,
  target_month TEXT NOT NULL,
  target_visits INTEGER DEFAULT 0,
  target_registrations INTEGER DEFAULT 0,
  target_conversions INTEGER DEFAULT 0,
  actual_visits INTEGER DEFAULT 0,
  actual_registrations INTEGER DEFAULT 0,
  actual_conversions INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_targets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  target_date TEXT NOT NULL,
  target_visits INTEGER DEFAULT 0,
  target_registrations INTEGER DEFAULT 0,
  target_conversions INTEGER DEFAULT 0,
  actual_visits INTEGER DEFAULT 0,
  actual_registrations INTEGER DEFAULT 0,
  actual_conversions INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Commissions
CREATE TABLE IF NOT EXISTS commission_earnings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  earner_id TEXT NOT NULL,
  rule_id TEXT,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  source_type TEXT,
  source_id TEXT,
  notes TEXT,
  paid_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commission_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT,
  rate REAL DEFAULT 0,
  min_threshold REAL DEFAULT 0,
  max_cap REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  effective_from TEXT,
  effective_to TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_visits_agent ON visits(agent_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date, tenant_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ir_agent ON individual_registrations(agent_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ir_created ON individual_registrations(created_at, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ir_converted ON individual_registrations(converted, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ir_visit ON individual_registrations(visit_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_targets_agent ON monthly_targets(agent_id, target_month);
CREATE INDEX IF NOT EXISTS idx_commissions_earner ON commission_earnings(earner_id, tenant_id);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  executed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (1, '001_initial_schema');
