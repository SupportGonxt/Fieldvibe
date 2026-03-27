#!/usr/bin/env node
/**
 * Migration Script: Backfill individual_registrations from historical visits
 * 
 * Cloudflare D1 Version - Run with wrangler
 * 
 * Usage: 
 *   npx wrangler d1 execute fieldvibe-db --file scripts/backfill-individual-registrations-d1.js
 * 
 * Or for dry run:
 *   DRY_RUN=true npx wrangler d1 execute fieldvibe-db --file scripts/backfill-individual-registrations-d1.js
 */

// This script will be executed by D1
// The actual migration logic is in SQL for D1 compatibility

export default {
  async fetch(request, env, ctx) {
    const db = env.DB;
    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dry_run') === 'true';
    
    try {
      console.log('='.repeat(60));
      console.log('Individual Registrations Backfill Migration (D1)');
      console.log('='.repeat(60));
      console.log(`Dry Run: ${dryRun}`);
      console.log('');
      
      // Step 1: Count visits to migrate
      const countQuery = `
        SELECT COUNT(*) as count
        FROM visits v
        LEFT JOIN individual_registrations ir ON v.id = ir.visit_id AND v.tenant_id = ir.tenant_id
        WHERE (v.visit_type = 'individual' OR v.visit_type = 'individual_visit')
          AND ir.id IS NULL
      `;
      
      const countResult = await db.prepare(countQuery).first();
      const totalToMigrate = countResult.count;
      
      console.log(`Step 1: Found ${totalToMigrate} individual visits without registrations`);
      
      if (totalToMigrate === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No visits need migration',
          migrated: 0
        }));
      }
      
      // Step 2: Perform migration
      console.log('');
      console.log('Step 2: Migrating visits to individual_registrations...');
      
      const migrateQuery = `
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
          AND ir.id IS NULL
      `;
      
      if (dryRun) {
        console.log('DRY RUN - Would execute migration but skipping');
        return new Response(JSON.stringify({
          success: true,
          message: 'Dry run completed',
          wouldMigrate: totalToMigrate,
          dryRun: true
        }));
      }
      
      const result = await db.prepare(migrateQuery).run();
      const migrated = result.meta?.rows_written || result.changes || totalToMigrate;
      
      console.log('');
      console.log('='.repeat(60));
      console.log('Migration Summary');
      console.log('='.repeat(60));
      console.log(`Total visits found: ${totalToMigrate}`);
      console.log(`Successfully migrated: ${migrated}`);
      console.log('');
      console.log('✅ Migration completed successfully!');
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Migration completed',
        migrated: migrated,
        totalFound: totalToMigrate
      }));
      
    } catch (err) {
      console.error('❌ Migration failed:', err.message);
      return new Response(JSON.stringify({
        success: false,
        error: err.message
      }), { status: 500 });
    }
  }
};
