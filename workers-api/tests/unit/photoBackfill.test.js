import { describe, it, expect } from 'vitest';
import app from '../../src/routes/photoBackfill.js';
import { decodeDataUri } from '../../src/lib/photoAi.js';

const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const post = (env, headers = {}) =>
  app.fetch(new Request('https://x/admin/backfill-photos', { method: 'POST', headers }), env);

// Minimal D1 double: one row to migrate, then a count.
function makeEnv({ putResult = 'ok', size = 42 } = {}) {
  const updates = [];
  const puts = [];
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            all: async () => ({ results: [{ id: 'p1', r2_key: 'photos/a/b', r2_url: GIF }] }),
            first: async () => ({ n: 0 }),
            run: async () => { updates.push({ sql, args }); return { success: true }; },
          };
        },
        first: async () => ({ n: 0 }),
      };
    },
  };
  const bucket = {
    put: async (key, bytes) => {
      if (putResult === 'throw') throw new Error('r2 down');
      puts.push({ key, len: bytes.length });
    },
    head: async () => (putResult === 'missing' ? null : { size }),
  };
  return { env: { DB: db, UPLOADS: bucket, BACKFILL_TOKEN: 'secret', SCAN_BASE_URL: 'https://api.test' }, updates, puts };
}

describe('backfill auth gate', () => {
  it('404s when no token is configured, so the route is inert by default', async () => {
    const res = await post({ DB: {}, UPLOADS: {} });
    expect(res.status).toBe(404);
  });
  it('403s a missing or wrong token', async () => {
    const { env } = makeEnv();
    expect((await post(env)).status).toBe(403);
    expect((await post(env, { 'x-backfill-token': 'wrong!' })).status).toBe(403);
    expect((await post(env, { 'x-backfill-token': 'secre' })).status).toBe(403);
  });
});

describe('backfill behaviour', () => {
  it('uploads the bytes and rewrites r2_url to the absolute uploads path', async () => {
    const { env, updates, puts } = makeEnv();
    const res = await post(env, { 'x-backfill-token': 'secret' });
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, processed: 1, uploaded: 1, failed: 0, remaining: 0 });
    expect(puts).toEqual([{ key: 'photos/a/b', len: 42 }]);
    expect(updates[0].args[0]).toBe('https://api.test/api/uploads/photos/a/b');
  });

  it('leaves the base64 in place when HEAD cannot confirm the object', async () => {
    for (const bad of [{ putResult: 'missing' }, { size: 41 }, { putResult: 'throw' }]) {
      const { env, updates } = makeEnv(bad);
      const body = await post(env, { 'x-backfill-token': 'secret' }).then(r => r.json());
      expect(body.uploaded).toBe(0);
      expect(body.failed).toBe(1);
      expect(updates).toEqual([]); // the only copy of the bytes is never dropped
    }
  });
});

describe('decodeDataUri', () => {
  it('decodes base64 and rejects anything that is not a data: URI', () => {
    expect(decodeDataUri(GIF)).toMatchObject({ contentType: 'image/gif' });
    expect(decodeDataUri(GIF).bytes.length).toBe(42);
    expect(decodeDataUri('https://x/y.jpg')).toBeNull();
    expect(decodeDataUri(null)).toBeNull();
    expect(decodeDataUri('data:image/gif;base64,!!!!')).toBeNull();
  });
});
