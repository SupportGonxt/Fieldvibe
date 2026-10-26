// Overnight drain of photos still embedded as base64 inside answer JSON
// (visit_responses.responses, visit_individuals.custom_field_values).
//
// New captures already move their photos to R2 on save, but older rows still carry
// ~100 KB data URLs, and every report that reads an answer (JSON_EXTRACT, LIKE) parses
// those blobs on every run. Moving them to R2 shrinks the rows once, for every report.
//
// Walks each table by id with a stored cursor, so a row that cannot be cleaned (bad data,
// failed upload) is passed over instead of blocking every later run; once a table is
// exhausted the cursor resets and failures get another try.
import { decodeDataUri, computePhotoHash } from './photoAi.js';

const TABLES = [
  { table: 'visit_responses', col: 'responses' },
  { table: 'visit_individuals', col: 'custom_field_values' },
];
// drainAiBacklog only picks up NULL/''/pending/skipped, so historical photos are not
// sent through Workers AI again.
export const BACKFILL_AI_STATUS = 'backfill';

// Replace every data:image string (top level, nested, or inside a JSON-array string)
// with the URL `store` returns for it.
export async function externalise(v, store) {
  if (typeof v === 'string') {
    if (v.startsWith('data:image')) return (await store(v)) ?? v;
    if (v.includes('data:image') && v.trimStart().startsWith('[')) {
      try { return JSON.stringify(await externalise(JSON.parse(v), store)); } catch { return v; }
    }
    return v;
  }
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = await externalise(v[i], store); return v; }
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = await externalise(v[k], store); return v; }
  return v;
}

async function storePhoto(db, bucket, baseUrl, row, dataUrl) {
  const decoded = decodeDataUri(dataUrl);
  if (!decoded) return null;
  const hash = await computePhotoHash(decoded.bytes);
  // Reuse an existing upload of the same image, but never one whose stored URL is itself
  // a data URL (legacy rows) — that would leave the blob in place.
  const existing = await db.prepare("SELECT r2_url FROM visit_photos WHERE tenant_id = ? AND photo_hash = ? AND r2_url NOT LIKE 'data:%' LIMIT 1")
    .bind(row.tenant_id, hash).first();
  if (existing?.r2_url) return existing.r2_url;
  const photoId = crypto.randomUUID();
  const r2Key = `photos/${row.tenant_id}/${row.visit_id}/${photoId}.jpg`;
  await bucket.put(r2Key, decoded.bytes, { httpMetadata: { contentType: decoded.contentType } });
  await db.prepare("INSERT INTO visit_photos (id, tenant_id, visit_id, photo_type, r2_key, r2_url, captured_at, photo_hash, uploaded_by, ai_analysis_status) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)")
    .bind(photoId, row.tenant_id, row.visit_id, 'general', r2Key, `${baseUrl}/api/uploads/${r2Key}`, hash, row.agent_id || null, BACKFILL_AI_STATUS).run();
  return `${baseUrl}/api/uploads/${r2Key}`;
}

export async function drainBase64Backlog(env, perTable = 25) {
  const db = env.DB, bucket = env.UPLOADS;
  if (!db || !bucket) return { migrated: 0 };
  const baseUrl = env.SCAN_BASE_URL || 'https://fieldvibe-api.vantax.co.za';
  await db.prepare('CREATE TABLE IF NOT EXISTS maintenance_cursors (name TEXT PRIMARY KEY, value TEXT)').run();
  let migrated = 0, failed = 0;
  for (const { table, col } of TABLES) {
    const name = `base64_backlog:${table}`;
    const cur = (await db.prepare('SELECT value FROM maintenance_cursors WHERE name = ?').bind(name).first())?.value || '';
    // IDs only: the blobs are fetched one row at a time below.
    const ids = (await db.prepare(`SELECT r.id, r.visit_id, r.tenant_id, v.agent_id FROM ${table} r LEFT JOIN visits v ON v.id = r.visit_id
      WHERE r.id > ? AND r.${col} LIKE '%data:image%' ORDER BY r.id LIMIT ?`).bind(cur, perTable).all()).results || [];
    for (const row of ids) {
      try {
        const raw = (await db.prepare(`SELECT ${col} AS v FROM ${table} WHERE id = ?`).bind(row.id).first())?.v;
        let data; try { data = JSON.parse(raw); } catch { failed++; continue; }
        let stored = 0;
        const out = await externalise(data, async (u) => { const url = await storePhoto(db, bucket, baseUrl, row, u); if (url) stored++; return url; });
        if (stored) { await db.prepare(`UPDATE ${table} SET ${col} = ? WHERE id = ?`).bind(JSON.stringify(out), row.id).run(); migrated += stored; }
      } catch (e) { failed++; console.error('drainBase64Backlog row', table, row.id, e?.message || e); }
    }
    const next = ids.length < perTable ? '' : ids[ids.length - 1].id;
    await db.prepare('INSERT INTO maintenance_cursors (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value').bind(name, next).run();
  }
  console.log(`drainBase64Backlog: moved ${migrated} photos to R2, ${failed} rows failed`);
  return { migrated, failed };
}
