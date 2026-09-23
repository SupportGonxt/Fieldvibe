import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { offloadProductAuditPhotos, PRODUCT_AUDIT_AI_STATUS } from '../../src/lib/photoAi.js';

// Product-audit photos are analysed by the shelf-analysis pipeline as they are stored.
// If the generic analyzer's cron drain also picks them up, every one of them costs two
// Workers AI calls instead of one. These tests pin both halves of that: what the insert
// writes, and what the drain query actually selects.

const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const CTX = { tenantId: 't1', visitId: 'v1', userId: 'u1', reqUrl: 'https://api.test/api/visits' };

// Captures every statement so the INSERT's bind values can be inspected.
function recordingDb(log) {
  return {
    prepare(sql) {
      const binds = [];
      return {
        bind(...args) { binds.push(...args); return this; },
        async first() { return null; },
        async run() { log.push({ sql, binds }); return { success: true, meta: { changes: 1 } }; },
      };
    },
  };
}

const jobsSource = readFileSync(fileURLToPath(new URL('../../src/cron/jobs.js', import.meta.url)), 'utf8');

// Pull the real WHERE clause out of the cron source rather than restating it here —
// a copy would keep passing after someone edited the query it is meant to guard.
function extractSql(startMarker, endMarker) {
  const start = jobsSource.indexOf(startMarker);
  expect(start, `could not find ${startMarker} in cron/jobs.js`).toBeGreaterThan(-1);
  const end = jobsSource.indexOf(endMarker, start);
  expect(end, `could not find ${endMarker} after ${startMarker}`).toBeGreaterThan(-1);
  // The query is written as adjacent string literals joined by +; strip the quoting.
  return jobsSource.slice(start, end + endMarker.length)
    .replace(/"\s*\+\s*\n?\s*"/g, ' ')
    .replace(/^"|"$/g, '');
}

function seededDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE visit_photos (
    id TEXT PRIMARY KEY, tenant_id TEXT, visit_id TEXT, photo_type TEXT, r2_key TEXT,
    photo_hash TEXT, ai_analysis_status TEXT DEFAULT 'pending', ai_processed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`);
  const insert = db.prepare("INSERT INTO visit_photos (id, tenant_id, visit_id, photo_type, r2_key, photo_hash, ai_analysis_status, created_at) VALUES (?, 't1', 'v1', 'general', ?, ?, ?, datetime('now','-1 day'))");
  insert.run('p-pending', 'photos/a.jpg', 'h1', 'pending');
  insert.run('p-null', 'photos/b.jpg', 'h2', null);
  insert.run('p-empty', 'photos/c.jpg', 'h3', '');
  insert.run('p-skipped', 'photos/d.jpg', 'h4', 'skipped');
  insert.run('p-completed', 'photos/e.jpg', 'h5', 'completed');
  insert.run('p-product-audit', 'photos/f.jpg', 'h6', PRODUCT_AUDIT_AI_STATUS);
  return db;
}

describe('product-audit photo insert', () => {
  it('writes ai_analysis_status explicitly instead of leaving it at the pending default', async () => {
    const log = [];
    await offloadProductAuditPhotos(recordingDb(log), { put: async () => {} },
      JSON.stringify([{ product: 'Cola 500ml', stock: 'Yes', photo: GIF }]), CTX);

    const insert = log.find(l => l.sql.includes('INSERT INTO visit_photos'));
    expect(insert, 'no visit_photos insert was made').toBeTruthy();
    expect(insert.sql).toContain('ai_analysis_status');
    expect(insert.binds).toContain(PRODUCT_AUDIT_AI_STATUS);
    expect(insert.binds).not.toContain('pending');
  });

  it('writes one such row per product photo', async () => {
    const log = [];
    await offloadProductAuditPhotos(recordingDb(log), { put: async () => {} }, JSON.stringify([
      { product: 'Cola 500ml', stock: 'Yes', photo: GIF },
      { product: 'Cola 1L', stock: 'Yes', photo: GIF },
    ]), CTX);
    const inserts = log.filter(l => l.sql.includes('INSERT INTO visit_photos'));
    expect(inserts).toHaveLength(2);
    expect(inserts.every(i => i.binds.includes(PRODUCT_AUDIT_AI_STATUS))).toBe(true);
  });
});

describe("drainAiBacklog's real query", () => {
  const drainSql = extractSql('SELECT id, r2_key, tenant_id, visit_id, photo_type FROM visit_photos', 'ORDER BY created_at DESC LIMIT ?');

  it('does not select product-audit photos, so the generic analyzer never double-pays', () => {
    const db = seededDb();
    const rows = db.prepare(drainSql.replace('LIMIT ?', 'LIMIT 25')).all();
    const ids = rows.map(r => r.id);
    expect(ids).not.toContain('p-product-audit');
  });

  it('still selects every status it was already draining', () => {
    const db = seededDb();
    const ids = db.prepare(drainSql.replace('LIMIT ?', 'LIMIT 25')).all().map(r => r.id);
    expect(ids).toEqual(expect.arrayContaining(['p-pending', 'p-null', 'p-empty', 'p-skipped']));
    expect(ids).not.toContain('p-completed');
  });

  // 'skipped' means "could not manage it this time" here — analyzePhotoWithAI sets it for
  // oversized images and the drain deliberately retries those. Using it for product-audit
  // photos would not have stopped anything.
  it("proves 'skipped' would NOT have fixed the double analysis", () => {
    expect(drainSql).toContain("ai_analysis_status = 'skipped'");
    expect(PRODUCT_AUDIT_AI_STATUS).not.toBe('skipped');
  });

  it('does not mention the product-audit status at all', () => {
    expect(drainSql).not.toContain(PRODUCT_AUDIT_AI_STATUS);
  });
});

describe("reapStuckAiProcessing's real query", () => {
  const reapSql = extractSql("UPDATE visit_photos SET ai_analysis_status = 'pending'", "AND created_at < datetime('now', '-30 minutes')");

  it("only resets rows stuck in 'processing', so it cannot resurrect a product-audit photo", () => {
    expect(reapSql).toContain("ai_analysis_status = 'processing'");
    expect(reapSql).not.toContain(PRODUCT_AUDIT_AI_STATUS);

    const db = seededDb();
    db.exec(reapSql);
    const row = db.prepare('SELECT ai_analysis_status s FROM visit_photos WHERE id = ?').get('p-product-audit');
    expect(row.s).toBe(PRODUCT_AUDIT_AI_STATUS);
  });

  it('still reaps a genuinely stuck row', () => {
    const db = seededDb();
    db.exec("INSERT INTO visit_photos (id, tenant_id, r2_key, ai_analysis_status, ai_processed_at, created_at) VALUES ('p-stuck', 't1', 'photos/g.jpg', 'processing', datetime('now','-2 hours'), datetime('now','-2 hours'))");
    db.exec(reapSql);
    expect(db.prepare('SELECT ai_analysis_status s FROM visit_photos WHERE id = ?').get('p-stuck').s).toBe('pending');
  });
});
