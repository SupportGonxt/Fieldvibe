import { describe, it, expect } from 'vitest';
import { makeD1 } from './helpers/d1sqlite.js';
import { drainBase64Backlog, BACKFILL_AI_STATUS } from '../../src/lib/base64Backlog.js';

const IMG = 'data:image/jpeg;base64,' + btoa('fake-jpeg-bytes');
const IMG2 = 'data:image/jpeg;base64,' + btoa('other-jpeg-bytes');

function setup() {
  const db = makeD1(`
    CREATE TABLE visits (id TEXT PRIMARY KEY, agent_id TEXT);
    CREATE TABLE visit_responses (id TEXT PRIMARY KEY, tenant_id TEXT, visit_id TEXT, visit_type TEXT, responses TEXT);
    CREATE TABLE visit_individuals (id TEXT PRIMARY KEY, tenant_id TEXT, visit_id TEXT, custom_field_values TEXT);
    CREATE TABLE visit_photos (id TEXT PRIMARY KEY, tenant_id TEXT, visit_id TEXT, photo_type TEXT, r2_key TEXT, r2_url TEXT,
      captured_at TEXT, photo_hash TEXT, uploaded_by TEXT, ai_analysis_status TEXT DEFAULT 'pending');
    INSERT INTO visits VALUES ('v1','a1'),('v2','a2'),('v3','a3');
  `);
  const ins = (sql, ...a) => db._sdb.prepare(sql).run(...a);
  ins("INSERT INTO visit_individuals VALUES ('i1','t','v1',?)", JSON.stringify({ goldrush_id: '123', id_passport_photo: IMG }));
  ins("INSERT INTO visit_individuals VALUES ('i2','t','v2','{not json data:image')");
  ins("INSERT INTO visit_individuals VALUES ('i3','t','v3',?)", JSON.stringify({ converted: 1 }));
  ins("INSERT INTO visit_responses VALUES ('r1','t','v2','store_custom_questions',?)",
    JSON.stringify({ audit: JSON.stringify([{ product: 'X', photo: IMG2 }]), note: 'ok' }));
  const puts = [];
  const bucket = { put: async (k) => { puts.push(k); } };
  return { db, bucket, puts, env: { DB: db, UPLOADS: bucket, SCAN_BASE_URL: 'https://api.test' } };
}

describe('drainBase64Backlog', () => {
  it('moves top-level and nested photos to R2, skips bad rows, resets the cursor', async () => {
    const { db, env, puts } = setup();
    const res = await drainBase64Backlog(env, 25);
    expect(res).toEqual({ migrated: 2, failed: 1 });
    expect(puts).toHaveLength(2);

    const i1 = JSON.parse(db._sdb.prepare("SELECT custom_field_values v FROM visit_individuals WHERE id='i1'").get().v);
    expect(i1.goldrush_id).toBe('123');
    expect(i1.id_passport_photo).toMatch(/^https:\/\/api\.test\/api\/uploads\/photos\/t\/v1\//);

    const r1 = JSON.parse(db._sdb.prepare("SELECT responses v FROM visit_responses WHERE id='r1'").get().v);
    const audit = JSON.parse(r1.audit);
    expect(audit[0]).toMatchObject({ product: 'X' });
    expect(audit[0].photo).toMatch(/^https:\/\/api\.test\/api\/uploads\//);

    const photos = db._sdb.prepare('SELECT uploaded_by, ai_analysis_status FROM visit_photos ORDER BY uploaded_by').all();
    expect(photos.map(p => ({ ...p }))).toEqual([
      { uploaded_by: 'a1', ai_analysis_status: BACKFILL_AI_STATUS },
      { uploaded_by: 'a2', ai_analysis_status: BACKFILL_AI_STATUS },
    ]);
    // Fewer rows than the batch: both cursors reset so failures are retried next pass.
    const cur = db._sdb.prepare('SELECT name, value FROM maintenance_cursors ORDER BY name').all();
    expect(cur.map(c => c.value)).toEqual(['', '']);
  });

  it('reuses an existing clean upload of the same image, never a legacy data-URL one', async () => {
    const { db, env, puts } = setup();
    await drainBase64Backlog(env, 25);
    // A new row with the same image as i1: no second upload, same URL.
    db._sdb.prepare("INSERT INTO visit_individuals VALUES ('i4','t','v1',?)").run(JSON.stringify({ photo: IMG }));
    await drainBase64Backlog(env, 25);
    expect(puts).toHaveLength(2);
    const i1 = JSON.parse(db._sdb.prepare("SELECT custom_field_values v FROM visit_individuals WHERE id='i1'").get().v);
    const i4 = JSON.parse(db._sdb.prepare("SELECT custom_field_values v FROM visit_individuals WHERE id='i4'").get().v);
    expect(i4.photo).toBe(i1.id_passport_photo);
  });

  it('advances the cursor past a full batch instead of re-reading the same rows', async () => {
    const { db, env } = setup();
    await drainBase64Backlog(env, 1);
    const cur = db._sdb.prepare("SELECT value FROM maintenance_cursors WHERE name = 'base64_backlog:visit_individuals'").get();
    expect(cur.value).toBe('i1');
  });
});
