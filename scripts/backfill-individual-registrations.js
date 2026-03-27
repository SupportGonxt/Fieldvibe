#!/usr/bin/env node
/**
 * Migration Script: Backfill individual_registrations from historical visits
 * 
 * This script finds all individual visits that don't have corresponding
 * individual_registrations records and creates them.
 * 
 * Usage: node scripts/backfill-individual-registrations.js
 */

const { Database } = require('better-sqlite3');
const path = require('path');

// Configuration - Update these for your environment
const CONFIG = {
  // For Cloudflare D1, you'll need to use wrangler or the API
  // For local SQLite testing:
  databasePath: process.env.DB_PATH || './dev.db',
  // Batch size for processing
  batchSize: 100,
  // Dry run mode (doesn't write to database)
  dryRun: process.env.DRY_RUN === 'true',
};

console.log('='.repeat(60));
console.log('Individual Registrations Backfill Migration');
console.log('='.repeat(60));
console.log(`Database: ${CONFIG.databasePath}`);
console.log(`Dry Run: ${CONFIG.dryRun}`);
console.log('');

function migrate() {
  let db;
  
  try {
    // Initialize database connection
    // For production with D1, you'll need to adapt this to use wrangler
    if (process.env.D1_DB) {
      console.log('Using D1 database from environment');
      // D1 connection would go here - adapt for your deployment
      throw new Error('D1 connection not implemented - use wrangler or adapt for your environment');
    } else {
      console.log('Using SQLite database (for testing)');
      db = new Database(CONFIG.databasePath);
      db.pragma('journal_mode = WAL');
    }

    // Step 1: Find individual visits without individual_registrations
    console.log('Step 1: Finding individual visits without registrations...');
    
    const findVisitsQuery = `
      SELECT 
        v.id as visit_id,
        v.tenant_id,
        v.agent_id,
        v.company_id,
        v.visit_date,
        v.individual_name as first_name,
        v.individual_surname as last_name,
        v.individual_id_number as id_number,
        v.individual_phone as phone,
        v.latitude as gps_latitude,
        v.longitude as gps_longitude,
        v.created_at,
        vi.individual_id
      FROM visits v
      LEFT JOIN visit_individuals vi ON v.id = vi.visit_id AND v.tenant_id = vi.tenant_id
      LEFT JOIN individual_registrations ir ON v.id = ir.visit_id AND v.tenant_id = ir.tenant_id
      WHERE v.visit_type = 'individual' 
        OR v.visit_type = 'individual_visit'
        OR vi.individual_id IS NOT NULL
        AND ir.id IS NULL
      ORDER BY v.created_at ASC
    `;

    const visitsToMigrate = db.prepare(findVisitsQuery).all();
    console.log(`Found ${visitsToMigrate.length} visits to migrate`);
    
    if (visitsToMigrate.length === 0) {
      console.log('✅ No visits need migration');
      return;
    }

    // Step 2: Check for existing individual_registrations to avoid duplicates
    console.log('');
    console.log('Step 2: Checking for existing registrations...');
    
    const existingRegsQuery = `
      SELECT COUNT(*) as count FROM individual_registrations 
      WHERE visit_id IS NOT NULL
    `;
    const existingCount = db.prepare(existingRegsQuery).get();
    console.log(`Existing individual_registrations with visit_id: ${existingCount.count}`);

    // Step 3: Migrate visits in batches
    console.log('');
    console.log('Step 3: Migrating visits to individual_registrations...');
    
    const insertQuery = `
      INSERT INTO individual_registrations (
        id, tenant_id, agent_id, company_id, visit_id,
        first_name, last_name, id_number, phone, email,
        product_app_player_id, converted, conversion_date,
        notes, gps_latitude, gps_longitude, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const insertStmt = db.prepare(insertQuery);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    const insertTx = db.transaction((visits) => {
      for (const visit of visits) {
        try {
          // Generate unique ID
          const regId = `mig-${visit.visit_id}-${Date.now()}`;
          
          // Determine if converted (check if individual has product_app_player_id or similar)
          const isConverted = 0; // Default to not converted for historical data
          const conversionDate = null;
          
          // Extract email if available (might be in notes or custom fields)
          const email = null;
          const productAppPlayerId = null;
          
          // Insert the registration
          if (!CONFIG.dryRun) {
            insertStmt.run(
              regId,
              visit.tenant_id,
              visit.agent_id,
              visit.company_id,
              visit.visit_id,
              visit.first_name || '',
              visit.last_name || '',
              visit.id_number || null,
              visit.phone || null,
              email,
              productAppPlayerId,
              isConverted,
              conversionDate,
              null, // notes
              visit.gps_latitude,
              visit.gps_longitude,
              visit.created_at || new Date().toISOString(),
              new Date().toISOString()
            );
          }
          
          migrated++;
          
          if (migrated % 100 === 0) {
            console.log(`  Progress: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
          }
        } catch (err) {
          console.error(`Error migrating visit ${visit.visit_id}:`, err.message);
          errors++;
        }
      }
    });
    
    // Process in batches
    for (let i = 0; i < visitsToMigrate.length; i += CONFIG.batchSize) {
      const batch = visitsToMigrate.slice(i, i + CONFIG.batchSize);
      insertTx(batch);
    }
    
    // Step 4: Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total visits found: ${visitsToMigrate.length}`);
    console.log(`Successfully migrated: ${migrated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Dry Run: ${CONFIG.dryRun}`);
    console.log('');
    
    if (!CONFIG.dryRun) {
      console.log('✅ Migration completed successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Verify the data in individual_registrations table');
      console.log('2. Check web reports to confirm data appears correctly');
      console.log('3. Monitor for any duplicate registration issues');
    } else {
      console.log('⚠️  DRY RUN MODE - No data was written');
      console.log('Set DRY_RUN=false to execute the migration');
    }
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Run migration
migrate();
