import { Hono } from 'hono';
import { decodeDataUri } from '../lib/photoAi.js';
import { mapLimit } from '../lib/aggregates.js';

// One-off: move the inline base64 photos out of D1 and into R2.
//
// 6,326 of 8,758 visit_photos rows kept the whole JPEG in r2_url as a `data:` URI,
// ~85 KB each — roughly half the 1.44 GB database, and the reason /api/uploads/:key
// needs a D1 fallback at all. Every one of those rows already has an r2_key; the object
// was simply never written. This uploads the bytes under that key and rewrites r2_url to
// the same absolute /api/uploads/ form the non-legacy rows already use.
//
// Delete this route once `remaining` reports 0 on every environment.
//
// The endpoint mutates production photo data, so it is gated on a dedicated secret
// (BACKFILL_TOKEN) rather than on a user session, compared in constant time, and it
// refuses to run at all when that secret is unset. It never deletes a row, and it only
// rewrites r2_url after a HEAD against the bucket confirms the object exists with the
// exact byte length we decoded — so a failed or partial upload leaves the base64 in
// place to be retried, and the photo cannot be lost.
const app = new Hono();

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

app.post('/admin/backfill-photos', async (c) => {
  const expected = c.env.BACKFILL_TOKEN;
  if (!expected) return c.json({ ok: false, message: 'Backfill disabled' }, 404);
  if (!constantTimeEqual(c.req.header('x-backfill-token') || '', expected)) {
    return c.json({ ok: false, message: 'Forbidden' }, 403);
  }

  const db = c.env.DB;
  const bucket = c.env.UPLOADS;
  if (!db || !bucket) return c.json({ ok: false, message: 'DB or bucket not bound' }, 500);

  // 3 subrequests per row (put + head + update) against a 1000-per-invocation budget.
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10) || 50, 1), 200);
  const base = (c.env.SCAN_BASE_URL || new URL(c.req.url).origin).replace(/\/$/, '');

  const rows = await db.prepare(
    "SELECT id, r2_key, r2_url FROM visit_photos WHERE r2_key IS NOT NULL AND substr(r2_url, 1, 5) = 'data:' LIMIT ?"
  ).bind(limit).all();
  const batch = rows.results || [];

  let uploaded = 0;
  const failures = [];
  await mapLimit(batch, 5, async (row) => {
    const decoded = decodeDataUri(row.r2_url);
    if (!decoded) { failures.push({ id: row.id, reason: 'undecodable' }); return; }
    try {
      await bucket.put(row.r2_key, decoded.bytes, { httpMetadata: { contentType: decoded.contentType } });
      // Verify before dropping the only copy of the bytes.
      const head = await bucket.head(row.r2_key);
      if (!head || head.size !== decoded.bytes.length) {
        failures.push({ id: row.id, reason: `head mismatch: ${head ? head.size : 'missing'} vs ${decoded.bytes.length}` });
        return;
      }
      await db.prepare('UPDATE visit_photos SET r2_url = ? WHERE id = ?')
        .bind(`${base}/api/uploads/${row.r2_key}`, row.id).run();
      uploaded++;
    } catch (e) {
      failures.push({ id: row.id, reason: String(e?.message || e).slice(0, 120) });
    }
  });

  const left = await db.prepare(
    "SELECT COUNT(*) AS n FROM visit_photos WHERE r2_key IS NOT NULL AND substr(r2_url, 1, 5) = 'data:'"
  ).first();

  return c.json({ ok: true, processed: batch.length, uploaded, failed: failures.length, failures: failures.slice(0, 5), remaining: left?.n ?? null });
});

export default app;
