import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PHOTO_URL_SQL, servePhotoFromD1, rewriteR2Url } from '../../src/lib/photoAi.js';

// 1x1 transparent GIF — small enough to inline, real enough to decode.
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const fakeDb = (row) => ({
  prepare: () => ({ bind: () => ({ first: async () => row }) })
});

describe('PHOTO_URL_SQL', () => {
  it('emits a key-based URL, never the r2_url column', () => {
    const sql = PHOTO_URL_SQL('vp');
    expect(sql).toBe("'/api/uploads/'||vp.r2_key");
    expect(sql).not.toContain('r2_url');
  });
});

describe('report queries never select visit_photos.r2_url', () => {
  // The whole point of the change: r2_url holds an ~85 KB base64 JPEG per row, so a
  // report selecting it at LIMIT 5000 killed the D1 isolate (code 7429). Guard the
  // list/report SQL against the column creeping back in.
  const files = [
    'src/routes/reports.js',
    'src/routes/mobileDashboards.js',
    'src/routes/portal.js',
    'src/routes/coreCrud/visits.js',
  ];
  for (const f of files) {
    it(`${f} selects no vp.r2_url in a list query`, () => {
      const src = readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
      expect(src).not.toMatch(/SELECT vp\.r2_url/);
      expect(src).not.toMatch(/vp\.r2_url as thumbnail_url/);
      expect(src).not.toMatch(/vp\.r2_url IS NOT NULL/);
    });
  }
});

describe('rewriteR2Url', () => {
  it('absolutizes the relative path PHOTO_URL_SQL produces', () => {
    expect(rewriteR2Url('/api/uploads/photos/a/b', 'https://api.example.com/api/x?y=1'))
      .toBe('https://api.example.com/api/uploads/photos/a/b');
  });
  it('leaves an already-absolute url alone', () => {
    const u = 'https://cdn.example.com/p.jpg';
    expect(rewriteR2Url(u, 'https://api.example.com/api/x')).toBe(u);
  });
  it('passes through null', () => {
    expect(rewriteR2Url(null, 'https://api.example.com/api/x')).toBe(null);
  });
});

describe('servePhotoFromD1', () => {
  it('decodes a data: URI row into image bytes with an immutable cache header', async () => {
    const res = await servePhotoFromD1(fakeDb({ r2_url: GIF }), 'migrated/x/y.jpg');
    expect(res).not.toBeNull();
    expect(res.headers.get('Content-Type')).toBe('image/gif');
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBe(42);
    expect(String.fromCharCode(...bytes.slice(0, 3))).toBe('GIF');
  });
  it('returns null when the row is an http url, so the caller can 404', async () => {
    expect(await servePhotoFromD1(fakeDb({ r2_url: 'https://x/y.jpg' }), 'k')).toBeNull();
  });
  it('returns null for a missing row, a missing key and a missing db', async () => {
    expect(await servePhotoFromD1(fakeDb(null), 'k')).toBeNull();
    expect(await servePhotoFromD1(fakeDb({ r2_url: GIF }), '')).toBeNull();
    expect(await servePhotoFromD1(null, 'k')).toBeNull();
  });
  it('returns null instead of throwing when the query fails', async () => {
    const boom = { prepare: () => ({ bind: () => ({ first: async () => { throw new Error('no such table'); } }) }) };
    expect(await servePhotoFromD1(boom, 'k')).toBeNull();
  });
});
