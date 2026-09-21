// Shelf analysis for the per-product audit photos agents capture during a store
// visit (Diplomat's product questionnaire). Separate from analyzePhotoWithAI in
// lib/photoAi.js: that one answers "which brands, how many facings, what share of
// wall" for Goldrush's board and share-of-voice reporting and writes onto
// visit_photos.ai_*. This one answers "where on the shelf is this product and how
// visible is it", and lands in its own shelf_photo_analysis table.
//
// The image is sent the way lib/photoAi.js established: an `image_url` content
// block holding a base64 data URI. Passing raw bytes (`image: Array.from(bytes)`)
// is what Cloudflare's older docs show and it is wrong for this model — Workers AI
// tokenizes the number array as text at ~2 tokens/byte and every photo blows the
// 128K context window. The vision encoder costs a flat ~1.1K visual tokens for an
// image_url, whatever the file size.
import { v4 as uuidv4 } from 'uuid';
import { extractJsonObject, bytesToDataUrl } from '../lib/photoAi.js';

export const SHELF_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

// Same defence-in-depth cap the other analyzer uses. Photos are compressed client
// side long before this, so anything larger is a sign something went wrong.
export const MAX_AI_IMAGE_BYTES = 4_000_000;

export const SHELF_LEVELS = ['top', 'eye_level', 'middle', 'bottom', 'floor', 'unclear'];
export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'];

// Bare-JSON instruction plus one worked example. The example matters more than the
// wording: given a filled-in sample the model returns parseable JSON far more often
// than it does from a schema alone.
export const SHELF_ANALYSIS_PROMPT = `You are a retail-merchandising auditor looking at a photo of one product on a shop shelf.

Return ONLY a single JSON object. No prose, no markdown, no code fences, no explanation before or after.

Fields:
- "shelf_level": where the product sits. One of: top, eye_level, middle, bottom, floor, unclear.
- "visibility_score": integer 1-10. 10 = unmissable to a shopper, 1 = effectively hidden.
- "obstructions": array of short strings describing anything blocking the product. [] if nothing blocks it.
- "estimated_facings": integer count of product units facing the shopper, or null if you cannot count them.
- "notes": one or two sentences describing what you see.
- "confidence": how sure you are overall. One of: low, medium, high.

Example of a valid reply:
{"shelf_level":"eye_level","visibility_score":7,"obstructions":["partially blocked by promo sign"],"estimated_facings":4,"notes":"Four facings at eye level on the middle rack, with a cardboard promo sign covering the left edge.","confidence":"medium"}

Now analyse the photo and reply with the JSON object only.`;

// Workers AI does not always throw an Error — it can throw a plain object, and
// String() on one of those records "[object Object]", which says nothing about what
// went wrong. Keep whatever detail is actually there.
function describeError(err) {
  if (err == null) return 'unknown error';
  if (typeof err === 'string') return err;
  if (err.message) return String(err.message);
  try { return JSON.stringify(err); } catch { return String(err); }
}

function clampInt(value, min, max) {
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function oneOf(value, allowed, fallback) {
  const v = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return allowed.includes(v) ? v : fallback;
}

// A model reply as something safe to put in a TEXT column. Never String(value) on an
// object: that yields the literal "[object Object]" and throws the actual reply away,
// which is exactly how the first real analysis lost its output.
function rawToText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

// Model output -> the row we are willing to store. Never throws: a reply that cannot
// be parsed comes back as analysis_failed with the raw text kept, so the failure can
// be read back later instead of disappearing into a log line.
//
// `raw` is whatever Workers AI put in `response`. Usually a string of JSON, but this
// model also hands back an already-parsed object — the same behaviour that makes
// analyzePhotoWithAI fail with D1_TYPE_ERROR on its numeric fields. Both are accepted.
export function parseShelfAnalysis(raw) {
  const parsed = (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? raw
    : extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { status: 'analysis_failed', raw_model_response: rawToText(raw) };
  }
  const rawText = rawToText(raw);

  const obstructions = Array.isArray(parsed.obstructions)
    ? parsed.obstructions
      .filter(o => typeof o === 'string' && o.trim())
      .map(o => o.trim().slice(0, 120))
      .slice(0, 6)
    : [];

  return {
    status: 'complete',
    shelf_level: oneOf(parsed.shelf_level, SHELF_LEVELS, 'unclear'),
    visibility_score: clampInt(parsed.visibility_score, 1, 10),
    obstructions,
    // A shelf you cannot count facings on is a legitimate answer, not a failure.
    estimated_facings: clampInt(parsed.estimated_facings, 0, 9999),
    notes: typeof parsed.notes === 'string' ? parsed.notes.trim().slice(0, 500) : '',
    confidence: oneOf(parsed.confidence, CONFIDENCE_LEVELS, 'low'),
    raw_model_response: rawText,
  };
}

/**
 * Run the vision model over one shelf photo and return a normalized result.
 * Never throws — a model or network failure comes back as analysis_failed so the
 * caller can record it without a try/catch of its own.
 *
 * @param {Ai} ai - the Workers AI binding (env.AI)
 * @param {Uint8Array} imageBytes - the photo, already compressed
 * @param {{ contentType?: string }} [options]
 * @returns {Promise<object>} parseShelfAnalysis shape
 */
export async function analyzeShelfPhoto(ai, imageBytes, options = {}) {
  if (!ai || typeof ai.run !== 'function') {
    return { status: 'analysis_failed', raw_model_response: 'Workers AI binding unavailable' };
  }
  if (!imageBytes || imageBytes.length === 0) {
    return { status: 'analysis_failed', raw_model_response: 'No image bytes to analyse' };
  }
  if (imageBytes.length > MAX_AI_IMAGE_BYTES) {
    return {
      status: 'analysis_failed',
      raw_model_response: `Image ${Math.round(imageBytes.length / 1024)}KB exceeds ${Math.round(MAX_AI_IMAGE_BYTES / 1024)}KB safety cap`,
    };
  }

  let response;
  try {
    const result = await ai.run(SHELF_MODEL, {
      messages: [
        { role: 'system', content: 'You are a strict retail-audit assistant. You always reply with ONLY a single JSON object matching the schema the user gives. No prose, no markdown, no code fences.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: SHELF_ANALYSIS_PROMPT },
            { type: 'image_url', image_url: { url: bytesToDataUrl(imageBytes, options.contentType || 'image/jpeg') } },
          ],
        },
      ],
      max_tokens: 400,
      temperature: 0,
    });
    // Handed to the parser as-is: it may be a JSON string or an already-parsed object.
    response = result?.response ?? '';
  } catch (err) {
    return { status: 'analysis_failed', raw_model_response: `Workers AI call failed: ${describeError(err)}` };
  }

  return parseShelfAnalysis(response);
}

// Turn a result into the bind values for an INSERT/UPDATE. Kept separate so the
// column order lives in one place.
function toRow(result) {
  const complete = result.status === 'complete';
  return {
    status: complete ? 'complete' : 'failed',
    shelf_level: complete ? result.shelf_level : null,
    visibility_score: complete ? result.visibility_score : null,
    obstructions: complete ? JSON.stringify(result.obstructions || []) : null,
    estimated_facings: complete ? result.estimated_facings : null,
    notes: complete ? result.notes : null,
    confidence: complete ? result.confidence : null,
    raw_model_response: result.raw_model_response || '',
  };
}

// Claim a photo for analysis by writing its pending row. Returns the row id, or null
// if this photo already has one (the unique index on photo_id makes that a no-op
// rather than a duplicate analysis, so a retried upload doesn't pay twice).
export async function queueShelfAnalysis(db, { tenantId, visitId, photoId, product }) {
  const id = uuidv4();
  try {
    const res = await db.prepare(
      `INSERT OR IGNORE INTO shelf_photo_analysis (id, tenant_id, visit_id, photo_id, product, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`
    ).bind(id, tenantId, visitId, photoId, product || null).run();
    return res?.meta?.changes === 0 ? null : id;
  } catch (err) {
    console.error('queueShelfAnalysis failed:', err?.message || err);
    return null;
  }
}

// Analyse one queued photo and record the outcome. Swallows everything: this runs
// after the response has gone back to the agent, and a failure here must never be
// able to surface as a failed visit or a lost photo.
export async function runShelfAnalysis(env, { analysisId, photoId, r2Key }) {
  try {
    await env.DB.prepare("UPDATE shelf_photo_analysis SET status = 'processing' WHERE id = ?").bind(analysisId).run();

    let imageBytes = null;
    let contentType = 'image/jpeg';
    const object = env.UPLOADS ? await env.UPLOADS.get(r2Key) : null;
    if (object) {
      imageBytes = new Uint8Array(await object.arrayBuffer());
      contentType = object.httpMetadata?.contentType || contentType;
    }

    const result = imageBytes
      ? await analyzeShelfPhoto(env.AI, imageBytes, { contentType })
      : { status: 'analysis_failed', raw_model_response: `Photo ${photoId} not found in R2 at ${r2Key}` };

    const row = toRow(result);
    await env.DB.prepare(
      `UPDATE shelf_photo_analysis SET status = ?, shelf_level = ?, visibility_score = ?, obstructions = ?,
        estimated_facings = ?, notes = ?, confidence = ?, raw_model_response = ?, analysed_at = datetime('now')
       WHERE id = ?`
    ).bind(row.status, row.shelf_level, row.visibility_score, row.obstructions,
      row.estimated_facings, row.notes, row.confidence, row.raw_model_response, analysisId).run();
    return row.status;
  } catch (err) {
    console.error('runShelfAnalysis failed:', err?.message || err);
    try {
      await env.DB.prepare(
        "UPDATE shelf_photo_analysis SET status = 'failed', raw_model_response = ?, analysed_at = datetime('now') WHERE id = ?"
      ).bind(describeError(err), analysisId).run();
    } catch { /* the row stays pending and the cron will retry it */ }
    return 'failed';
  }
}

// Analyse a batch of queued photos one after another. Sequential on purpose: a visit
// with a dozen products would otherwise fire a dozen concurrent vision calls, and
// Workers AI rate-limits before the Worker's own budget does.
export async function runQueuedShelfAnalyses(env, queued, limit = 12) {
  for (const item of (queued || []).slice(0, limit)) {
    await runShelfAnalysis(env, item);
  }
}

// Cron safety net for rows the request-time pass didn't finish — a Worker that ran
// out of budget mid-batch, an R2 hiccup, a Workers AI rate limit.
const SHELF_DRAIN_BATCH_SIZE = 15;
export async function drainShelfAnalysisBacklog(env) {
  try {
    const rows = await env.DB.prepare(
      `SELECT spa.id, spa.photo_id, vp.r2_key FROM shelf_photo_analysis spa
         JOIN visit_photos vp ON vp.id = spa.photo_id
        WHERE spa.status = 'pending' AND vp.r2_key IS NOT NULL
        ORDER BY spa.created_at ASC LIMIT ?`
    ).bind(SHELF_DRAIN_BATCH_SIZE).all();
    const list = rows.results || [];
    if (list.length === 0) return;
    for (const r of list) {
      await runShelfAnalysis(env, { analysisId: r.id, photoId: r.photo_id, r2Key: r.r2_key });
    }
  } catch (err) {
    console.error('drainShelfAnalysisBacklog failed:', err?.message || err);
  }
}

// 'processing' rows older than 30 minutes belong to a run that died; put them back in
// the queue. Mirrors reapStuckAiProcessing for visit_photos.
export async function reapStuckShelfAnalyses(db) {
  try {
    await db.prepare(
      "UPDATE shelf_photo_analysis SET status = 'pending' WHERE status = 'processing' AND created_at < datetime('now', '-30 minutes')"
    ).run();
  } catch (err) {
    console.error('reapStuckShelfAnalyses failed:', err?.message || err);
  }
}
