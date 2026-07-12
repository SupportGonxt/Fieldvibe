-- Seed Stellr (company_id 5b129b5b-92b1-43c2-8523-caa221179d33, tenant default-tenant-001)
-- with its own per-company metric registry + agent KPI thresholds. Goldrush is unaffected —
-- these rows are company-scoped, so getConfig() prefers them over the tenant-level defaults
-- only for Stellr subjects.
--
-- Shape mirrors POST /field-ops/config/seed-defaults exactly:
--   program_config(id, tenant_id, company_id, key, value_json), unique (tenant_id, company_id, key).
-- Deterministic ids (pc-stellr-<key>) + ON CONFLICT DO NOTHING = idempotent; safe to re-run.
--
-- Stellr does boards/surveys/board-quality/visit-coverage, NOT sign-ups. kpi.agent omits
-- signups_per_day so signalBelowTarget never flags a metric Stellr doesn't run.

-- Per-company metric registry (drives cockpit tiles, gate engine, GM view).
INSERT INTO program_config (id, tenant_id, company_id, key, value_json)
VALUES (
  'pc-stellr-metrics',
  'default-tenant-001',
  '5b129b5b-92b1-43c2-8523-caa221179d33',
  'metrics',
  '[{"key":"boards","label":"Boards","source":"internal","visibility":"all","gate":true,"value":false},{"key":"surveys","label":"Surveys","source":"internal","visibility":"all","gate":true,"value":false},{"key":"board_quality","label":"Board Quality","source":"internal","visibility":"all","gate":false,"value":false},{"key":"visits","label":"Visit Coverage","source":"internal","visibility":"all","gate":false,"value":false}]'
)
ON CONFLICT(tenant_id, company_id, key) DO NOTHING;

-- Per-company agent KPI thresholds (cockpit + cron signalBelowTarget).
INSERT INTO program_config (id, tenant_id, company_id, key, value_json)
VALUES (
  'pc-stellr-kpi.agent',
  'default-tenant-001',
  '5b129b5b-92b1-43c2-8523-caa221179d33',
  'kpi.agent',
  '{"visits_per_day":12,"boards_per_day":6,"surveys_per_day":8,"board_quality":0.7,"drop_pct":40,"quiet_days":2,"baseline_window_days":14,"min_days":3}'
)
ON CONFLICT(tenant_id, company_id, key) DO NOTHING;
