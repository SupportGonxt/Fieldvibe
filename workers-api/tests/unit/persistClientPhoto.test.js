import { describe, it, expect } from 'vitest';
import { persistClientPhoto } from '../../src/lib/photoAi.js';

// 1x1 gif, 42 bytes decoded
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function bucket(puts, fail = false) {
  return { put: async (key, bytes, opts) => { if (fail) throw new Error('boom'); puts.push({ key, len: bytes.length, ct: opts?.httpMetadata?.contentType }); } };
}

describe('persistClientPhoto', () => {
  it('uploads a data URI to R2 and returns the absolute url', async () => {
    const puts = [];
    const out = await persistClientPhoto(bucket(puts), { r2_url: GIF }, 'v1', 'p1', 'https://api.test/api/visits');
    expect(puts).toEqual([{ key: 'photos/v1/p1', len: 42, ct: 'image/gif' }]);
    expect(out).toEqual({ r2_key: 'photos/v1/p1', r2_url: 'https://api.test/api/uploads/photos/v1/p1' });
  });

  it('keeps a client-supplied key', async () => {
    const puts = [];
    const out = await persistClientPhoto(bucket(puts), { r2_key: 'photos/a/b', r2_url: GIF }, 'v1', 'p1', 'https://api.test/x');
    expect(puts[0].key).toBe('photos/a/b');
    expect(out.r2_key).toBe('photos/a/b');
  });

  it('passes through an http url untouched', async () => {
    const puts = [];
    const out = await persistClientPhoto(bucket(puts), { r2_url: 'https://cdn/x.jpg' }, 'v1', 'p1', 'https://api.test/x');
    expect(puts).toEqual([]);
    expect(out.r2_url).toBe('https://cdn/x.jpg');
  });

  it('falls back to the inline data URI when the put fails, so the photo is never lost', async () => {
    const puts = [];
    const out = await persistClientPhoto(bucket(puts, true), { r2_url: GIF }, 'v1', 'p1', 'https://api.test/x');
    expect(out.r2_url).toBe(GIF);
  });

  it('falls back when no bucket is bound', async () => {
    const out = await persistClientPhoto(null, { r2_url: GIF, photo_url: null }, 'v1', 'p1', 'https://api.test/x');
    expect(out).toEqual({ r2_key: 'photos/v1/p1', r2_url: GIF });
  });

  it('never reuses a data: uri as the key', async () => {
    const puts = [];
    const out = await persistClientPhoto(bucket(puts), { r2_key: GIF, r2_url: GIF }, 'v1', 'p1', 'https://api.test/x');
    expect(out.r2_key).toBe('photos/v1/p1');
  });
});
