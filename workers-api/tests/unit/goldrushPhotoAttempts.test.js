import { describe, it, expect } from 'vitest';
import { makeD1 } from './helpers/d1sqlite.js';
import {
  avatarLettersCheck, photoChecks, attemptState, recordFail, recordPass, submitGate, hashDataUrl,
  loadAttemptPhoto, reviewForPhoto,
  ATTEMPT_MESSAGES, LOCKED_MESSAGE, RETRY_DELAY_SECONDS, LIVE_CAPTURE_MAX_AGE_MS,
} from '../../src/services/goldrushPhotoAttempts.js';

// One database for the file: the service creates its tables once per isolate.
const db = makeD1(`
  CREATE TABLE users (id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, team_lead_id TEXT);
  CREATE TABLE visit_photos (id TEXT, tenant_id TEXT, visit_id TEXT, photo_hash TEXT);
  CREATE TABLE visit_individuals (id TEXT, tenant_id TEXT, visit_id TEXT, custom_field_values TEXT);
  INSERT INTO users VALUES ('tl1', 'Thandi', 'Lead', NULL);
`);
const puts = [];
const store = new Map();
const env = {
  DB: db,
  UPLOADS: {
    put: async (key, bytes, opts) => { puts.push(key); store.set(key, { bytes, contentType: opts?.httpMetadata?.contentType }); },
    get: async (key) => {
      const o = store.get(key);
      return o ? { arrayBuffer: async () => o.bytes.buffer.slice(o.bytes.byteOffset, o.bytes.byteOffset + o.bytes.byteLength), httpMetadata: { contentType: o.contentType } } : null;
    },
  },
};
const PHOTO = 'data:image/jpeg;base64,/9j/AAAA';
const at = (base, s) => new Date(Date.parse(base) + s * 1000).toISOString();
const fail = (agentId, nowIso, captureId = 'cap-1', dataUrl = PHOTO) => recordFail(env, {
  tenantId: 't1', agentId, captureId, hash: `h-${agentId}-${nowIso}`, dataUrl, nowIso,
  reasons: [{ code: 'AI_FLAG', detail: 'AI check: green page' }],
});

describe('avatarLettersCheck', () => {
  it('passes the first two letters of the first name', () => {
    expect(avatarLettersCheck({ avatar: 'CO', name: 'Collen Nkuta' })).toBeNull();
    expect(avatarLettersCheck({ avatar: 'co', name: 'collen nkuta' })).toBeNull();
  });
  it('reads a zero in the circle as the letter O', () => {
    expect(avatarLettersCheck({ avatar: 'C0', name: 'Collen Nkuta' })).toBeNull();
  });
  it('flags initials in the circle', () => {
    const f = avatarLettersCheck({ avatar: 'CN', name: 'Collen Nkuta' });
    expect(f.code).toBe('AVATAR_INITIALS');
    expect(f.detail).toContain('(the initials)');
    expect(f.detail).toContain('"CO"');
  });
  it('flags any other wrong letters', () => {
    expect(avatarLettersCheck({ avatar: 'XQ', name: 'Collen Nkuta' })?.code).toBe('AVATAR_INITIALS');
    expect(avatarLettersCheck({ avatar: 'C', name: 'Collen Nkuta' })?.code).toBe('AVATAR_INITIALS');
  });
  it('leaves a name whose first two letters are its initials alone', () => {
    expect(avatarLettersCheck({ avatar: 'SA', name: 'Sam Akeyo' })).toBeNull();
  });
  it('cannot judge without both the letters and the name', () => {
    expect(avatarLettersCheck({ avatar: null, name: 'Collen Nkuta' })).toBeNull();
    expect(avatarLettersCheck({ avatar: 'CN', name: null })).toBeNull();
  });
});

describe('photoChecks', () => {
  it('flags an old file, blur and a missing ID only when the model read the photo', async () => {
    const codes = async (o) => (await photoChecks(db, { tenantId: 't1', hash: 'x', ...o })).map(r => r.code);
    expect(await codes({ fileAgeMs: LIVE_CAPTURE_MAX_AGE_MS + 1, aiRead: true, extractedId: '123456789' })).toEqual(['NOT_LIVE_CAPTURE']);
    expect(await codes({ aiRead: true, blurry: true })).toEqual(['BLURRY']);
    expect(await codes({ aiRead: true, extractedId: null })).toEqual(['NO_ID']);
    expect(await codes({ aiRead: false, extractedId: null })).toEqual([]);
  });
  it('flags a duplicate image and a Goldrush ID already used', async () => {
    db.exec("INSERT INTO visit_photos VALUES ('p1', 't1', 'v1', 'dup-hash')");
    db.exec(`INSERT INTO visit_individuals VALUES ('vi1', 't1', 'v1', '{"goldrush_id":"501841172"}')`);
    const out = await photoChecks(db, { tenantId: 't1', hash: 'dup-hash', aiRead: true, extractedId: '501841172' });
    expect(out.map(r => r.code)).toEqual(['DUPLICATE_IMAGE', 'DUPLICATE_ID']);
  });
});

describe('attempts', () => {
  const t0 = '2026-10-26T08:00:00.000Z';

  it('gives the three messages in order, then locks the agent', async () => {
    db.exec("INSERT INTO users VALUES ('a1', 'Collen', 'Nkuta', 'tl1')");
    const v1 = await fail('a1', t0);
    expect(v1).toMatchObject({ verified: false, locked: false, attempt: 1, attempts_left: 2, retry_after: RETRY_DELAY_SECONDS, message: ATTEMPT_MESSAGES[0] });
    const v2 = await fail('a1', at(t0, 40));
    expect(v2).toMatchObject({ attempt: 2, attempts_left: 1, message: ATTEMPT_MESSAGES[1] });
    const v3 = await fail('a1', at(t0, 80));
    expect(v3).toMatchObject({ locked: true, attempts_left: 0, message: LOCKED_MESSAGE });
    const review = await db.prepare("SELECT * FROM goldrush_photo_reviews WHERE agent_id = 'a1'").first();
    expect(review).toMatchObject({ status: 'pending', agent_name: 'Collen Nkuta', team_lead_id: 'tl1', team_lead_name: 'Thandi Lead' });
    const linked = await db.prepare('SELECT COUNT(*) AS n FROM goldrush_photo_attempts WHERE review_id = ?').bind(review.id).first();
    expect(linked.n).toBe(3);
    // Locked: another failure is not counted and the message stays the lock message.
    expect(await fail('a1', at(t0, 200))).toMatchObject({ locked: true, message: LOCKED_MESSAGE });
    // Only that visit is locked: another visit starts with fresh attempts.
    expect(await attemptState(db, { tenantId: 't1', agentId: 'a1', captureId: 'cap-2', nowIso: at(t0, 200) })).toMatchObject({ attemptsLeft: 3, retryAfter: 0, pending: null });
    expect(await fail('a1', at(t0, 210), 'cap-2')).toMatchObject({ locked: false, attempt: 1, message: ATTEMPT_MESSAGES[0] });
    expect(puts.filter(k => k.startsWith('goldrush-attempts/t1/')).length).toBeGreaterThanOrEqual(3);
  });

  it('every agent-facing message is the same whatever failed', () => {
    for (const m of ATTEMPT_MESSAGES) expect(m).not.toMatch(/\b(AI|fake|initials?|duplicate|GPS|blurry)\b/i);
  });

  it('enforces the delay between attempts', async () => {
    await fail('a2', t0);
    expect((await attemptState(db, { tenantId: 't1', agentId: 'a2', captureId: 'cap-1', nowIso: at(t0, 10) })).retryAfter).toBe(RETRY_DELAY_SECONDS - 10);
    expect((await attemptState(db, { tenantId: 't1', agentId: 'a2', captureId: 'cap-1', nowIso: at(t0, RETRY_DELAY_SECONDS) })).retryAfter).toBe(0);
  });

  it('a passing photo closes the open attempts', async () => {
    await fail('a3', t0);
    await fail('a3', at(t0, 40));
    await recordPass(db, { tenantId: 't1', agentId: 'a3', captureId: 'cap-1', hash: 'good', nowIso: at(t0, 80) });
    expect((await attemptState(db, { tenantId: 't1', agentId: 'a3', captureId: 'cap-1', nowIso: at(t0, 120) })).attemptsLeft).toBe(3);
  });

  it('old failures stop counting after the open window', async () => {
    await fail('a4', t0);
    expect((await attemptState(db, { tenantId: 't1', agentId: 'a4', captureId: 'cap-1', nowIso: at(t0, 13 * 3600) })).attemptsLeft).toBe(3);
  });
});

describe('submitGate', () => {
  const t0 = '2026-10-26T09:00:00.000Z';

  it('rejects a photo that already failed, as a new attempt', async () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/BBBB';
    const hash = await hashDataUrl(dataUrl);
    await recordFail(env, { tenantId: 't1', agentId: 'b1', captureId: 'cap-1', hash, dataUrl, nowIso: t0, reasons: [{ code: 'NO_ID', detail: 'x' }] });
    const gate = await submitGate(env, { tenantId: 't1', agentId: 'b1', captureId: 'cap-1', dataUrl, nowIso: at(t0, 60) });
    expect(gate.verification).toMatchObject({ attempt: 2, message: ATTEMPT_MESSAGES[1] });
  });

  it('blocks a locked agent and lets an approved photo through', async () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/CCCC';
    const hash = await hashDataUrl(dataUrl);
    await fail('b2', t0);
    await fail('b2', at(t0, 40));
    await recordFail(env, { tenantId: 't1', agentId: 'b2', captureId: 'cap-1', hash, dataUrl, nowIso: at(t0, 80), reasons: [{ code: 'AI_FLAG', detail: 'x' }] });
    expect((await submitGate(env, { tenantId: 't1', agentId: 'b2', captureId: 'cap-1', dataUrl, nowIso: at(t0, 100) })).verification).toMatchObject({ locked: true });
    await db.prepare("UPDATE goldrush_photo_reviews SET status = 'approved', reviewed_at = ?, goldrush_id = '123456789' WHERE agent_id = 'b2'").bind(at(t0, 200)).run();
    const gate = await submitGate(env, { tenantId: 't1', agentId: 'b2', captureId: 'cap-1', dataUrl, nowIso: at(t0, 300) });
    expect(gate.approved).toMatchObject({ status: 'approved', goldrush_id: '123456789' });
    expect(gate.verification).toBeUndefined();
  });

  it('lets an unseen photo carry on to the normal checks', async () => {
    const gate = await submitGate(env, { tenantId: 't1', agentId: 'b3', dataUrl: 'data:image/jpeg;base64,/9j/DDDD', nowIso: t0 });
    expect(gate).toEqual({ hash: await hashDataUrl('data:image/jpeg;base64,/9j/DDDD') });
  });
});

describe('resuming an approved visit', () => {
  const t0 = '2026-10-26T10:00:00.000Z';

  it('hands back the exact photo that was approved, until it is used on a visit', async () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U';
    const hash = await hashDataUrl(dataUrl);
    await fail('c1', t0, 'cap-r');
    await fail('c1', at(t0, 40), 'cap-r');
    await recordFail(env, { tenantId: 't1', agentId: 'c1', captureId: 'cap-r', hash, dataUrl, nowIso: at(t0, 80), reasons: [{ code: 'NO_ID', detail: 'x' }] });
    const review = await db.prepare("SELECT * FROM goldrush_photo_reviews WHERE agent_id = 'c1'").first();
    expect(review.capture_id).toBe('cap-r');
    expect(await loadAttemptPhoto(env, review.photo_key)).toBe(dataUrl);

    await db.prepare("UPDATE goldrush_photo_reviews SET status = 'approved', reviewed_at = ? WHERE id = ?").bind(at(t0, 200), review.id).run();
    expect(await reviewForPhoto(db, { tenantId: 't1', agentId: 'c1', hash })).toMatchObject({ status: 'approved' });
    await db.prepare("UPDATE goldrush_photo_reviews SET visit_id = 'v-done' WHERE id = ?").bind(review.id).run();
    expect(await reviewForPhoto(db, { tenantId: 't1', agentId: 'c1', hash })).toBeNull();
  });
});
