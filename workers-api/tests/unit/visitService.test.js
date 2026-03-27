/**
 * @vitest-environment miniflare
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVisit } from '../../src/services/visitService.js';

describe('VisitService', () => {
  let db;
  const tenantId = 'tenant-test-123';
  const userId = 'user-test-456';

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  describe('createVisit', () => {
    it('should create a store visit successfully', async () => {
      const visitData = {
        visit_target_type: 'store',
        store_name: 'Test Store',
        visit_date: '2026-03-27',
        purpose: 'Regular visit'
      };

      const result = await createVisit(db, tenantId, userId, visitData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status', 'completed');
    });

    it('should create individual registration for individual visits', async () => {
      const visitData = {
        visit_target_type: 'individual',
        individual_first_name: 'John',
        individual_last_name: 'Doe',
        individual_phone: '+27123456789',
        visit_date: '2026-03-27'
      };

      const result = await createVisit(db, tenantId, userId, visitData);

      // Verify individual_registrations record was created
      const reg = await db.prepare(
        'SELECT * FROM individual_registrations WHERE visit_id = ?'
      ).bind(result.id).first();
      
      expect(reg).toBeTruthy();
      expect(reg.first_name).toBe('John');
      expect(reg.agent_id).toBe(userId);
    });

    it('should mark conversion when product_app_player_id provided', async () => {
      const visitData = {
        visit_target_type: 'individual',
        individual_first_name: 'Jane',
        individual_last_name: 'Smith',
        product_app_player_id: 'player-123',
        visit_date: '2026-03-27'
      };

      const result = await createVisit(db, tenantId, userId, visitData);
      const reg = await db.prepare(
        'SELECT * FROM individual_registrations WHERE visit_id = ?'
      ).bind(result.id).first();

      expect(reg.converted).toBe(1);
      expect(reg.product_app_player_id).toBe('player-123');
    });

    it('should handle idempotency with client_visit_id', async () => {
      const clientVisitId = 'client-visit-123';
      const visitData = {
        client_visit_id: clientVisitId,
        visit_target_type: 'store',
        store_name: 'Test Store',
        visit_date: '2026-03-27'
      };

      const result1 = await createVisit(db, tenantId, userId, visitData);
      expect(result1.already_existed).toBeFalsy();

      const result2 = await createVisit(db, tenantId, userId, visitData);
      expect(result2.already_existed).toBe(true);
    });
  });
});

async function createTestDatabase() {
  const { D1Database } = await import('@cloudflare/vitest-pool-workers');
  const db = new D1Database();

  const tables = [
    `CREATE TABLE visits (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, agent_id TEXT NOT NULL,
      customer_id TEXT, visit_date TEXT NOT NULL, visit_type TEXT DEFAULT 'customer',
      check_in_time TEXT, check_out_time TEXT, status TEXT DEFAULT 'pending',
      individual_name TEXT, individual_surname TEXT, individual_id_number TEXT,
      individual_phone TEXT, purpose TEXT, notes TEXT, brand_id TEXT, company_id TEXT,
      latitude REAL, longitude REAL, questionnaire_id TEXT, outcome TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE individual_registrations (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, agent_id TEXT NOT NULL,
      company_id TEXT, visit_id TEXT, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      id_number TEXT, phone TEXT, email TEXT, product_app_player_id TEXT,
      converted INTEGER DEFAULT 0, conversion_date TEXT, notes TEXT,
      gps_latitude REAL, gps_longitude REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE individuals (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, first_name TEXT NOT NULL,
      last_name TEXT NOT NULL, id_number TEXT, phone TEXT, email TEXT,
      gps_latitude REAL, gps_longitude REAL, company_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE customers (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL,
      type TEXT DEFAULT 'retail', address TEXT, latitude REAL, longitude REAL,
      phone TEXT, email TEXT, status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE visit_individuals (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, visit_id TEXT NOT NULL,
      individual_id TEXT NOT NULL, custom_field_values TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE visit_responses (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, visit_id TEXT NOT NULL,
      visit_type TEXT, responses TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE users (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT, phone TEXT,
      first_name TEXT, last_name TEXT, role TEXT DEFAULT 'agent',
      team_lead_id TEXT, is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE field_companies (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE visit_photos (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, visit_id TEXT NOT NULL,
      photo_type TEXT DEFAULT 'board', r2_key TEXT, r2_url TEXT,
      gps_latitude REAL, gps_longitude REAL, captured_at TEXT, photo_hash TEXT,
      board_placement_location TEXT, board_placement_position TEXT,
      board_condition TEXT, sample_board_id TEXT, uploaded_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const table of tables) {
    await db.prepare(table).run();
  }

  return db;
}
