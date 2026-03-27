# Individual Registrations Backfill Migration

## Problem
Historical individual visits were not creating records in the `individual_registrations` table, causing all web reports to show 0 for individual-related metrics.

## Solution
Run the migration script to backfill `individual_registrations` for all historical individual visits.

## Migration Options

### Option 1: Cloudflare D1 (Production)

```bash
cd workers-api
npx wrangler d1 execute fieldvibe-db --file ../scripts/backfill-individual-registrations.sql --remote
```

### Option 2: Cloudflare D1 (Dry Run - Recommended First)

```bash
cd workers-api
npx wrangler d1 execute fieldvibe-db --file ../scripts/backfill-individual-registrations.sql --remote --dry-run
```

### Option 3: Direct SQL via Wrangler

```bash
cd workers-api
npx wrangler d1 execute fieldvibe-db --command "
INSERT INTO individual_registrations (
  id, tenant_id, agent_id, company_id, visit_id,
  first_name, last_name, id_number, phone, email,
  product_app_player_id, converted, conversion_date,
  notes, gps_latitude, gps_longitude, created_at, updated_at
)
SELECT 
  'mig-' || v.id || '-' || strftime('%s', 'now'),
  v.tenant_id, v.agent_id, v.company_id, v.id,
  COALESCE(v.individual_name, ''), COALESCE(v.individual_surname, ''),
  v.individual_id_number, v.individual_phone,
  NULL, NULL, 0, NULL, NULL,
  v.latitude, v.longitude,
  COALESCE(v.created_at, datetime('now')), datetime('now')
FROM visits v
LEFT JOIN individual_registrations ir ON v.id = ir.visit_id AND v.tenant_id = ir.tenant_id
WHERE (v.visit_type = 'individual' OR v.visit_type = 'individual_visit')
  AND ir.id IS NULL;
" --remote
```

### Option 4: Node.js Script (Local Testing)

```bash
cd scripts
DRY_RUN=true node backfill-individual-registrations.js
```

## Verification

After running the migration, verify the results:

```sql
-- Check how many records were migrated
SELECT COUNT(*) as migrated_count 
FROM individual_registrations 
WHERE id LIKE 'mig-%';

-- Check by tenant
SELECT tenant_id, COUNT(*) as count 
FROM individual_registrations 
WHERE id LIKE 'mig-%' 
GROUP BY tenant_id;

-- Verify reports now show data
-- Visit the web reports dashboard and check individual metrics
```

## What This Migrates

- All historical individual visits without `individual_registrations` records
- Sets `converted = 0` for historical data (conservative approach)
- Preserves all available data: names, phone, ID number, GPS coordinates
- Links to original visit via `visit_id` field

## Rollback (If Needed)

```sql
-- Remove migrated records (they all have 'mig-' prefix)
DELETE FROM individual_registrations WHERE id LIKE 'mig-%';
```

## Notes

- Migration is idempotent - safe to run multiple times
- Uses LEFT JOIN to avoid duplicating existing records
- Migrates both `visit_type = 'individual'` and visits linked via `visit_individuals` table
- Production migration should be done during low-traffic period
