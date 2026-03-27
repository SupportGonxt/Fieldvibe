/**
 * Database Migration Runner
 * Executes pending migrations in order
 */

import { readdir } from 'fs/promises';
import { join } from 'path';

const MIGRATIONS_DIR = './src/database/migrations';

/**
 * Get current schema version from database
 */
export async function getCurrentVersion(db) {
  try {
    const result = await db.prepare(
      'SELECT MAX(version) as version FROM schema_migrations'
    ).first();
    return result?.version || 0;
  } catch (error) {
    // Table doesn't exist yet
    return 0;
  }
}

/**
 * Get all migration files sorted by version
 */
export async function getMigrationFiles() {
  const files = await readdir(MIGRATIONS_DIR);
  return files
    .filter(f => f.endsWith('.sql'))
    .map(f => {
      const match = f.match(/^(\d+)_(.+)\.sql$/);
      if (!match) return null;
      return {
        version: parseInt(match[1]),
        name: match[2],
        filename: f
      };
    })
    .filter(f => f !== null)
    .sort((a, b) => a.version - b.version);
}

/**
 * Run all pending migrations
 */
export async function runMigrations(db) {
  console.log('Running database migrations...');
  
  const currentVersion = await getCurrentVersion(db);
  console.log(`Current schema version: ${currentVersion}`);
  
  const migrationFiles = await getMigrationFiles();
  const pendingMigrations = migrationFiles.filter(m => m.version > currentVersion);
  
  if (pendingMigrations.length === 0) {
    console.log('Database is up to date');
    return { migrated: 0, version: currentVersion };
  }
  
  console.log(`Found ${pendingMigrations.length} pending migration(s)`);
  
  let lastVersion = currentVersion;
  
  for (const migration of pendingMigrations) {
    console.log(`Running migration ${migration.version}: ${migration.name}`);
    
    const sqlPath = join(MIGRATIONS_DIR, migration.filename);
    const sql = await readFile(sqlPath, 'utf8');
    
    // Split SQL into individual statements and execute each
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      try {
        await db.prepare(statement).run();
      } catch (error) {
        // Ignore "already exists" errors for idempotent migrations
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }
    
    // Record migration
    await db.prepare(
      'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
    ).bind(migration.version, migration.name).run();
    
    lastVersion = migration.version;
    console.log(`✓ Migration ${migration.version} completed`);
  }
  
  console.log(`Database migrated to version ${lastVersion}`);
  return { migrated: pendingMigrations.length, version: lastVersion };
}

/**
 * Rollback last migration
 */
export async function rollbackMigration(db) {
  const currentVersion = await getCurrentVersion(db);
  
  if (currentVersion === 0) {
    console.log('No migrations to rollback');
    return { rolledBack: false };
  }
  
  const migration = await db.prepare(
    'SELECT * FROM schema_migrations WHERE version = ?'
  ).bind(currentVersion).first();
  
  if (!migration) {
    console.log('No migration record found');
    return { rolledBack: false };
  }
  
  console.log(`Rolling back migration ${currentVersion}: ${migration.name}`);
  
  // Look for rollback file
  const rollbackFile = join(
    MIGRATIONS_DIR,
    `${currentVersion}_${migration.name}_rollback.sql`
  );
  
  try {
    const sql = await readFile(rollbackFile, 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      await db.prepare(statement).run();
    }
    
    await db.prepare(
      'DELETE FROM schema_migrations WHERE version = ?'
    ).bind(currentVersion).run();
    
    console.log(`✓ Rollback completed`);
    return { rolledBack: true, version: currentVersion - 1 };
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('No rollback file found for this migration');
    }
    throw error;
  }
}

/**
 * Check if database needs migration
 */
export async function needsMigration(db) {
  const currentVersion = await getCurrentVersion(db);
  const migrationFiles = await getMigrationFiles();
  const latestVersion = migrationFiles[migrationFiles.length - 1]?.version || 0;
  return currentVersion < latestVersion;
}

/**
 * Get migration status
 */
export async function getMigrationStatus(db) {
  const currentVersion = await getCurrentVersion(db);
  const migrationFiles = await getMigrationFiles();
  const latestVersion = migrationFiles[migrationFiles.length - 1]?.version || 0;
  
  return {
    currentVersion,
    latestVersion,
    isUpToDate: currentVersion === latestVersion,
    pendingCount: migrationFiles.filter(m => m.version > currentVersion).length,
    totalMigrations: migrationFiles.length
  };
}

// Helper to read file (for Cloudflare Workers compatibility)
async function readFile(path, encoding) {
  if (typeof Deno !== 'undefined') {
    return await Deno.readTextFile(path);
  }
  const { readFile: fsReadFile } = await import('fs/promises');
  return await fsReadFile(path, encoding);
}
