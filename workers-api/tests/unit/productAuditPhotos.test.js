import { describe, it, expect } from 'vitest';
import { offloadProductAuditPhotos } from '../../src/lib/photoAi.js';

// 1x1 gif, 42 bytes decoded
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const CTX = { tenantId: 't1', visitId: 'v1', userId: 'u1', reqUrl: 'https://api.test/api/visits' };

function bucket(puts, fail = false) {
  return { put: async (key, bytes, opts) => { if (fail) throw new Error('boom'); puts.push({ key, len: bytes.length, ct: opts?.httpMetadata?.contentType }); } };
}

// Minimal D1 double: no existing hashes, records every INSERT it is handed.
function db(inserts, existingUrl = null) {
  return {
    prepare(sql) {
      const binds = [];
      return {
        bind(...args) { binds.push(...args); return this; },
        async first() { return existingUrl ? { r2_url: existingUrl, id: 'p0' } : null; },
        async run() { inserts.push({ sql, binds }); return { success: true }; },
      };
    },
  };
}

const entry = (over = {}) => ({ product: 'Cola 500ml', stock: 'Yes', reps: 'Yes', delivery: 'Yes', challenge: 'price', photo: GIF, comments: '', ...over });

describe('offloadProductAuditPhotos', () => {
  it('uploads each product photo and swaps in its url', async () => {
    const puts = [];
    const inserts = [];
    const out = await offloadProductAuditPhotos(db(inserts), bucket(puts), JSON.stringify([entry(), entry({ product: 'Cola 1L' })]), CTX);
    const parsed = JSON.parse(out);

    expect(puts).toHaveLength(2);
    expect(puts[0].len).toBe(42);
    expect(puts[0].ct).toBe('image/gif');
    expect(puts[0].key).toMatch(/^photos\/t1\/v1\/[0-9a-f-]+\.jpg$/);
    expect(parsed[0].photo).toBe(`https://api.test/api/uploads/${puts[0].key}`);
    expect(parsed[1].photo).toBe(`https://api.test/api/uploads/${puts[1].key}`);
    // No base64 survives into what gets written to D1
    expect(out).not.toContain('data:image');
    expect(inserts).toHaveLength(2);
    expect(inserts[0].sql).toContain('INSERT INTO visit_photos');
  });

  it('keeps every other answer field intact', async () => {
    const out = await offloadProductAuditPhotos(db([]), bucket([]), JSON.stringify([entry({ challenge: 'shelf space', comments: 'end cap' })]), CTX);
    const parsed = JSON.parse(out);
    expect(parsed[0].product).toBe('Cola 500ml');
    expect(parsed[0].challenge).toBe('shelf space');
    expect(parsed[0].comments).toBe('end cap');
    expect(parsed[0].stock).toBe('Yes');
  });

  it('reuses the stored url for a photo already uploaded for the tenant', async () => {
    const puts = [];
    const out = await offloadProductAuditPhotos(db([], 'https://api.test/api/uploads/photos/t1/old/p.jpg'), bucket(puts), JSON.stringify([entry()]), CTX);
    expect(puts).toEqual([]);
    expect(JSON.parse(out)[0].photo).toBe('https://api.test/api/uploads/photos/t1/old/p.jpg');
  });

  it('leaves an out-of-stock entry (no photo) alone', async () => {
    const puts = [];
    const value = JSON.stringify([{ product: 'Cola 2L', stock: 'No', why_not: 'too slow moving', photo: '' }]);
    const out = await offloadProductAuditPhotos(db([]), bucket(puts), value, CTX);
    expect(puts).toEqual([]);
    expect(out).toBe(value);
  });

  it('keeps the photo inline when the R2 put fails, so it is never lost', async () => {
    const out = await offloadProductAuditPhotos(db([]), bucket([], true), JSON.stringify([entry()]), CTX);
    expect(JSON.parse(out)[0].photo).toBe(GIF);
  });

  it('keeps the photo inline when no bucket is bound', async () => {
    const value = JSON.stringify([entry()]);
    expect(await offloadProductAuditPhotos(db([]), null, value, CTX)).toBe(value);
  });

  it('passes through values that are not product-audit answers', async () => {
    expect(await offloadProductAuditPhotos(db([]), bucket([]), 'Yes', CTX)).toBe('Yes');
    expect(await offloadProductAuditPhotos(db([]), bucket([]), GIF, CTX)).toBe(GIF);
    expect(await offloadProductAuditPhotos(db([]), bucket([]), '[not json', CTX)).toBe('[not json');
    expect(await offloadProductAuditPhotos(db([]), bucket([]), undefined, CTX)).toBe(undefined);
  });
});
