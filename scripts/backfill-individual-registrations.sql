-- Migration: Backfill individual_registrations from historical visits
-- Run this SQL directly on your D1 database or SQLite database
-- 
-- Usage for D1:
--   npx wrangler d1 execute fieldvibe-db --file scripts/backfill-individual-registrations.sql
--
-- Usage for SQLite:
--   sqlite3 dev.db < scripts/backfill-individual-registrations.sql

-- Step 1: Check how many visits will be migrated
SELECT 
  'Visits to migrate' as description,
  COUNT(*) as count
FROM visits v
LEFT JOIN individual_registrations ir ON v.id = ir.visit_id AND v.tenant_id = ir.tenant_id
WHERE (v.visit_type = 'individual' OR v.visit_type = 'individual_visit')
  AND ir.id IS NULL;

-- Step 2: Perform the migration
-- This inserts individual_registrations records for all historical individual visits
INSERT INTO individual_registrations (
  id, tenant_id, agent_id, company_id, visit_id,
  first_name, last_name, id_number, phone, email,
  product_app_player_id, converted, conversion_date,
  notes, gps_latitude, gps_longitude, created_at, updated_at
)
SELECT 
  'mig-' || v.id || '-' || strftime('%s', 'now') as id,
  v.tenant_id,
  v.agent_id,
  v.company_id,
  v.id as visit_id,
  COALESCE(v.individual_name, '') as first_name,
  COALESCE(v.individual_surname, '') as last_name,
  v.individual_id_number as id_number,
  v.individual_phone as phone,
  NULL as email,
  NULL as product_app_player_id,
  0 as converted,
  NULL as conversion_date,
  NULL as notes,
  v.latitude as gps_latitude,
  v.longitude as gps_longitude,
  COALESCE(v.created_at, datetime('now')) as created_at,
  datetime('now') as updated_at
FROM visits v
LEFT JOIN individual_registrations ir ON v.id = ir.visit_id AND v.tenant_id = ir.tenant_id
WHERE (v.visit_type = 'individual' OR v.visit_type = 'individual_visit')
  AND ir.id IS NULL;

-- Step 3: Verify the migration
SELECT 
  'Migrated registrations' as description,
  COUNT(*) as count
FROM individual_registrations
WHERE visit_id IS NOT NULL;

-- Step 4: Show summary by tenant
SELECT 
  tenant_id,
  COUNT(*) as migrated_count,
  SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) as converted_count
FROM individual_registrations
WHERE visit_id IS NOT NULL
  AND id LIKE 'mig-%'
GROUP BY tenant_id
ORDER BY migrated_count DESC;
