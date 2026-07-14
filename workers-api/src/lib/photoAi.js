// Shared photo/AI helpers (P4). Moved verbatim from index.js.
// Used by routes AND the drainAiBacklog cron (Task 5 imports from here).
import { v4 as uuidv4 } from 'uuid';
import { clampSharePct } from '../services/goldrushVision.js';

// Match old format: https://fieldvibe-uploads.{tenantId}.r2.dev/{key}
const LEGACY_R2_URL_RE = /^https?:\/\/fieldvibe-uploads\.[^/]+\.r2\.dev\/(.+)$/;

// Rewrite old bad R2 URLs (fieldvibe-uploads.*.r2.dev) to API proxy URLs
function rewriteR2Url(url, reqUrl) {
  if (!url || typeof url !== 'string') return url;
  const match = url.match(LEGACY_R2_URL_RE);
  if (match) {
    try { return new URL('/api/uploads/' + match[1], reqUrl).href; } catch { return '/api/uploads/' + match[1]; }
  }
  return url;
}

// SSRF guard: true only for the legacy R2 host we wrote ourselves — the sole
// absolute-URL form the company-portal photo proxy is allowed to fetch().
function isLegacyR2PhotoUrl(url) {
  return typeof url === 'string' && LEGACY_R2_URL_RE.test(url);
}

// Compute SHA-256 hash of photo bytes for deduplication
async function computePhotoHash(bytes) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check if a photo with this hash already exists for the tenant
async function isPhotoHashDuplicate(db, tenantId, photoHash) {
  if (!photoHash) return false;
  const existing = await db.prepare(
    "SELECT id, visit_id FROM visit_photos WHERE tenant_id = ? AND photo_hash = ? LIMIT 1"
  ).bind(tenantId, photoHash).first();
  return !!existing;
}

// AI Photo Analysis function (runs async via waitUntil)
async function analyzePhotoWithAI(env, photoId, r2Key, tenantId, visitId, photoType) {
  try {
    const bucket = env.UPLOADS;
    const object = await bucket.get(r2Key);
    let imageBytes = null;

    // Hard cap as defence-in-depth. With image_url + base64 (below) the model
    // tokenizes images via its visual encoder (~1.1K tokens regardless of size),
    // so the byte size doesn't blow the context window — it just bounds the
    // request payload itself.
    const MAX_AI_IMAGE_BYTES = 4_000_000;
    if (object) {
      imageBytes = new Uint8Array(await object.arrayBuffer());
      if (imageBytes.length > MAX_AI_IMAGE_BYTES) {
        await env.DB.prepare("UPDATE visit_photos SET ai_analysis_status = 'skipped', ai_raw_response = ? WHERE id = ?").bind('Image ' + Math.round(imageBytes.length/1024) + 'KB exceeds ' + Math.round(MAX_AI_IMAGE_BYTES/1024) + 'KB safety cap', photoId).run();
        return;
      }
    }
    // If R2 has no object, this is a body.photos path (Goldrush store/individual
    // visits store the photo as a base64 data URL in visit_photos.r2_url and never
    // upload to R2). The stored data URL is resolved into `dataUrl` below.

    // Per-photo-type prompts. Tuned for parseable JSON output:
    //   - tight schema with example values
    //   - "Output JSON only — no prose, no markdown, no code fences"
    //   - empty-array fallbacks so a missing element doesn't break parsing
    //   - same shape across photo_types where possible (brands[], description)
    //     so downstream aggregation is consistent
    const SHELF_PROMPT = `You are a retail-merchandising auditor. Analyse this on-shelf photo and return ONLY a JSON object — no prose, no markdown, no code fences.
Schema:
{
  "brands": [ {"name": "Goldrush", "facings": 6, "position": "eye_level"} ],
  "total_facings": 24,
  "dominant_brand": "Goldrush",
  "gaps_detected": false,
  "compliance_score": 75,
  "compliance_issues": ["empty middle shelf"],
  "description": "Two shelves of mixed beverages with a Goldrush block on the left."
}
Rules: position must be one of eye_level | top | middle | bottom. compliance_score is 0–100. Return [] for arrays you cannot determine. Output JSON only.`;

    const COMPETITOR_PROMPT = `You are a retail auditor identifying competitors. Return ONLY a JSON object — no prose, no markdown, no code fences.
Schema:
{
  "brands": [ {"name": "BrandA", "facings": 4, "is_competitor": true, "position": "eye_level"} ],
  "competitors": [ {"brand": "BrandA", "product": "drink", "price_visible": "R29.99", "shelf_position": "eye_level"} ],
  "promotional_materials": ["BrandA shelf talker"],
  "description": "Three competitor brands on the middle shelf."
}
Output JSON only. Empty arrays ([]) if you cannot determine.`;

    const POSM_PROMPT = `You are a POS-material auditor. Return ONLY a JSON object — no prose, no markdown, no code fences.
Schema:
{
  "brand": "Goldrush",
  "material_type": "shelf_talker",
  "condition": "good",
  "visibility_score": 85,
  "placement_quality": "good",
  "description": "A Goldrush shelf talker mounted at eye level."
}
material_type ∈ poster | standee | shelf_talker | cooler | counter_display | banner | other. condition ∈ good | damaged | faded | missing. visibility_score 0–100. Output JSON only.`;

    const STORE_FRONT_PROMPT = `You are a retail auditor describing a store exterior. Return ONLY a JSON object — no prose, no markdown, no code fences.
Schema:
{
  "store_type": "convenience",
  "signage": [ {"brand": "Goldrush", "type": "fascia", "condition": "good"} ],
  "brand_visibility": [ {"brand": "Goldrush", "prominence": "high"} ],
  "estimated_traffic": "medium",
  "description": "Small informal convenience store with Goldrush fascia signage."
}
estimated_traffic ∈ low | medium | high. prominence ∈ low | medium | high. Output JSON only.`;

    const BOARD_PROMPT = `You are a retail-marketing auditor analysing a board/signage photo. Return ONLY a JSON object — no prose, no markdown, no code fences.
Schema:
{
  "board_detected": true,
  "brand": "Goldrush",
  "condition": "good",
  "visibility": "high",
  "board_type": "signage",
  "share_of_wall_pct": 40,
  "insights": ["Goldrush branding dominates the storefront wall", "Signage is clean and well-positioned at eye level"],
  "description": "A Goldrush metal sign mounted on the front wall, clearly visible."
}
board_type ∈ signage | poster | banner | shelf_talker | other. condition ∈ good | damaged | faded. visibility ∈ low | medium | high. share_of_wall_pct is 0–100: the estimated percentage of visible wall/signage space occupied by the brand's branding. insights is an array of up to 3 short, customer-facing observations about brand presence and merchandising. If no board is present, set board_detected false, brand "", share_of_wall_pct 0, insights []. Output JSON only.`;

    const GENERIC_PROMPT = `You are a retail-marketing auditor. Return ONLY a JSON object — no prose, no markdown, no code fences.
Schema:
{
  "board_detected": false,
  "brands": [ {"name": "Goldrush", "context": "shelf"} ],
  "competitors": [],
  "description": "What you see in plain English, one or two sentences."
}
Output JSON only. Use empty arrays ([]) if you cannot determine.`;

    let prompt = GENERIC_PROMPT;
    if (photoType === 'shelf' || photoType === 'compliance') prompt = SHELF_PROMPT;
    else if (photoType === 'competitor')  prompt = COMPETITOR_PROMPT;
    else if (photoType === 'posm')        prompt = POSM_PROMPT;
    else if (photoType === 'store_front') prompt = STORE_FRONT_PROMPT;
    else if (photoType === 'board')       prompt = BOARD_PROMPT;

    // ROOT-CAUSE FIX (earlier): previously passed `image: Array.from(imageBytes)` which
    // serialised the binary as a JSON number array. Workers AI tokenised that
    // as TEXT — at ~2 tokens/byte, every photo blew the 128K context window
    // (errors looked like "5021: tokens (235112) exceeded limit (128000)").
    //
    // The right format for Llama 3.2 Vision is `type: 'image_url'` with a
    // base64 data URL. The vision encoder consumes a fixed ~1.1K visual
    // tokens regardless of byte size, so a 1MB photo costs the same as a
    // 100KB photo in tokens.
    let dataUrl;
    if (imageBytes) {
      const contentType = (object && object.httpMetadata && object.httpMetadata.contentType) || 'image/jpeg';
      // btoa can't take giant strings on Workers — chunk to keep it stable.
      let binStr = '';
      const CHUNK = 32768;
      for (let i = 0; i < imageBytes.length; i += CHUNK) {
        binStr += String.fromCharCode.apply(null, imageBytes.subarray(i, i + CHUNK));
      }
      dataUrl = `data:${contentType};base64,${btoa(binStr)}`;
    } else {
      // body.photos path: use the base64 data URL stored on the row directly.
      const row = await env.DB.prepare('SELECT r2_url FROM visit_photos WHERE id = ?').bind(photoId).first();
      if (!row || !row.r2_url || !String(row.r2_url).startsWith('data:')) return;
      dataUrl = String(row.r2_url);
      // base64 length * 3/4 ≈ decoded byte size — same 4MB safety cap.
      const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      if (b64.length * 0.75 > MAX_AI_IMAGE_BYTES) {
        await env.DB.prepare("UPDATE visit_photos SET ai_analysis_status = 'skipped', ai_raw_response = ? WHERE id = ?").bind('Image exceeds ' + Math.round(MAX_AI_IMAGE_BYTES/1024) + 'KB safety cap', photoId).run();
        return;
      }
    }

    const aiResponse = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      messages: [
        { role: 'system', content: 'You are a strict retail-audit assistant. You always reply with ONLY a single JSON object that matches the schema given by the user. No prose, no markdown, no code fences, no explanations.' },
        { role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ]},
      ],
      max_tokens: 800,
      temperature: 0,
    });

    const responseText = aiResponse?.response || '';
    // Robust JSON extraction:
    //   - strip markdown code fences if the model added them anyway
    //   - find the largest balanced {...} block, not just the first one
    //   - try the full text first, then progressively fall back
    let parsed = {};
    function extractJson(raw) {
      if (!raw) return null;
      let s = String(raw).trim();
      // Strip ```json or ``` fences.
      s = s.replace(/^```(?:json)?\s*|```\s*$/g, '').trim();
      // Try direct parse.
      try { return JSON.parse(s); } catch (_) {}
      // Find the outermost {...} via brace counting.
      const start = s.indexOf('{');
      if (start === -1) return null;
      let depth = 0;
      for (let i = start; i < s.length; i++) {
        const ch = s[i];
        if (ch === '{') depth += 1;
        else if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            const candidate = s.slice(start, i + 1);
            try { return JSON.parse(candidate); } catch (_) { /* fall through */ }
          }
        }
      }
      return null;
    }
    parsed = extractJson(responseText) || {};

    let sovPct = 0; let totalFacings = 0; let brandFacings = 0;
    if (parsed.brands && Array.isArray(parsed.brands)) {
      totalFacings = parsed.brands.reduce((s, b) => s + (b.facings || 0), 0);
      const tenantBrands = await env.DB.prepare('SELECT name FROM brands WHERE tenant_id = ?').bind(tenantId).all();
      const tenantBrandNames = (tenantBrands.results || []).map(b => b.name.toLowerCase());
      brandFacings = parsed.brands.filter(b => b.name && tenantBrandNames.some(tb => b.name.toLowerCase().includes(tb))).reduce((s, b) => s + (b.facings || 0), 0);
      sovPct = totalFacings > 0 ? Math.round((brandFacings / totalFacings) * 1000) / 10 : 0;
    }
    // Board/storefront photos have no shelf facings — the model returns
    // share_of_wall_pct directly. Use it as the share-of-voice value.
    {
      const sow = clampSharePct(parsed.share_of_wall_pct);
      if (sow != null) sovPct = sow;
    }

    // Coerce values for D1 bind. The model occasionally returns a nested
    // object instead of a number for compliance_score (e.g. {value: 75}).
    // D1 only accepts primitives — passing an object throws
    // "D1_TYPE_ERROR: Type 'object' not supported for value '[object Object]'"
    // and we lose the analysis. Normalise here.
    function toFloatOrNull(v) {
      if (v == null) return null;
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      if (typeof v === 'string') { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
      if (typeof v === 'object') {
        // Try common keys.
        const candidate = v.value ?? v.score ?? v.percent ?? v.percentage;
        if (candidate != null) return toFloatOrNull(candidate);
      }
      return null;
    }
    const complianceScore = toFloatOrNull(parsed.compliance_score);
    const aiBrandsJson = JSON.stringify(Array.isArray(parsed.brands) ? parsed.brands : []);
    const aiLabelsJson = JSON.stringify(parsed || {});

    await env.DB.prepare(`UPDATE visit_photos SET ai_analysis_status = 'completed',
      ai_brands_detected = ?, ai_share_of_voice = ?, ai_facing_count = ?,
      ai_competitor_facings = ?, ai_compliance_score = ?, ai_labels = ?,
      ai_raw_response = ?, ai_processed_at = datetime('now')
      WHERE id = ?`).bind(
      aiBrandsJson, sovPct, brandFacings,
      totalFacings - brandFacings, complianceScore,
      aiLabelsJson, responseText, photoId).run();

    // If AI detected a board, update the board_installed field in store custom questions
    if (parsed.board_detected === true || (responseText && responseText.toLowerCase().includes('board_detected') && responseText.toLowerCase().includes('true'))) {
      try {
        const existingResp = await env.DB.prepare("SELECT id, responses FROM visit_responses WHERE visit_id = ? AND visit_type = 'store_custom_questions' LIMIT 1").bind(visitId).first();
        if (existingResp) {
          const respData = typeof existingResp.responses === 'string' ? JSON.parse(existingResp.responses) : existingResp.responses;
          if (respData.board_installed !== 'Yes') {
            respData.board_installed = 'Yes';
            respData.ai_board_detected = true;
            await env.DB.prepare("UPDATE visit_responses SET responses = ? WHERE id = ?").bind(JSON.stringify(respData), existingResp.id).run();
          }
        } else {
          // Only create store_custom_questions row for store visits (not individual/customer visits)
          const visitRow = await env.DB.prepare('SELECT visit_type FROM visits WHERE id = ?').bind(visitId).first();
          if (visitRow && visitRow.visit_type === 'store') {
            // Re-check to avoid race condition with concurrent AI analysis
            const recheck = await env.DB.prepare("SELECT id FROM visit_responses WHERE visit_id = ? AND visit_type = 'store_custom_questions' LIMIT 1").bind(visitId).first();
            if (!recheck) {
              try {
                const newId = crypto.randomUUID ? crypto.randomUUID() : uuidv4();
                await env.DB.prepare("INSERT INTO visit_responses (id, tenant_id, visit_id, visit_type, responses) VALUES (?, ?, ?, 'store_custom_questions', ?)").bind(
                  newId, tenantId, visitId, JSON.stringify({ board_installed: 'Yes', ai_board_detected: true })
                ).run();
              } catch (dupErr) { console.log('Concurrent board insert (expected):', dupErr.message); }
            }
          }
        }
      } catch (boardErr) { console.error('AI board update error:', boardErr); }
    }

    if (sovPct > 0) {
      const visit = await env.DB.prepare('SELECT customer_id, brand_id FROM visits WHERE id = ?').bind(visitId).first();
      if (visit) {
        const brand = await env.DB.prepare('SELECT name FROM brands WHERE id = ?').bind(visit.brand_id).first();
        await env.DB.prepare(`INSERT INTO share_of_voice_snapshots (id, tenant_id, customer_id, visit_id, photo_id, brand_id, brand_name, total_facings, brand_facings, share_percentage, snapshot_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'))`).bind(
          uuidv4(), tenantId, visit.customer_id, visitId, photoId, visit.brand_id || '', brand?.name || 'Unknown', totalFacings, brandFacings, sovPct).run();
      }
    }
  } catch (e) {
    console.error('AI analysis error:', e);
    await env.DB.prepare("UPDATE visit_photos SET ai_analysis_status = 'failed', ai_raw_response = ? WHERE id = ?").bind(e.message, photoId).run();
  }
}

// Materialise a questionnaire photo (synthetic id = "{vr_id}_{field}") into visit_photos and return the real id.
// Returns the real visit_photos id to use, or null if the source can't be found.
async function materializeQuestionnairPhoto(db, syntheticId, tenantId, uploadedBy) {
  const qrFields = ['shop_exterior_photo', 'ad_board_photo', 'competitor_photo'];
  const field = qrFields.find(f => syntheticId.endsWith('_' + f));
  if (!field) return null;
  const vrId = syntheticId.slice(0, syntheticId.length - field.length - 1);
  const vr = await db.prepare('SELECT id, visit_id, responses FROM visit_responses WHERE id = ? AND tenant_id = ?').bind(vrId, tenantId).first();
  if (!vr) return null;
  let responses = {};
  try { responses = typeof vr.responses === 'string' ? JSON.parse(vr.responses) : (vr.responses || {}); } catch { return null; }
  const url = responses[field];
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  // Check if already materialised
  const existing = await db.prepare("SELECT id FROM visit_photos WHERE visit_id = ? AND tenant_id = ? AND r2_url = ? LIMIT 1").bind(vr.visit_id, tenantId, url).first();
  if (existing) return existing.id;
  const photoTypeMap = { shop_exterior_photo: 'store_front', ad_board_photo: 'board', competitor_photo: 'competitor' };
  const newId = crypto.randomUUID();
  const r2Key = 'photos/' + tenantId + '/' + vr.visit_id + '/' + newId + '.jpg';
  await db.prepare(`INSERT INTO visit_photos (id, tenant_id, visit_id, photo_type, r2_key, r2_url, captured_at, uploaded_by, review_status)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, 'pending')`).bind(newId, tenantId, vr.visit_id, photoTypeMap[field], r2Key, url, uploadedBy).run();
  return newId;
}

export { rewriteR2Url, isLegacyR2PhotoUrl, computePhotoHash, isPhotoHashDuplicate, analyzePhotoWithAI, materializeQuestionnairPhoto };
