// Goldrush individual photo attempts: three tries per visit, then Back Office reviews.
//
// Every failed verification of a Goldrush system photo — AI check flag, no or wrong
// Goldrush ID, initials in the profile circle, duplicate image or ID, blurry photo,
// not a live camera capture — counts as one attempt. The agent gets the same three
// messages whatever failed, so they never learn which check caught them; the real
// reasons are stored here and shown only on the AI Check page.
//
// Attempts, the retake delay and the lock belong to one visit (the capture id the
// capture page creates when it opens). The third failure sends that visit for review
// and locks only that visit: the agent can start other individual visits meanwhile.
// A passing photo closes the visit's open attempts.
import { goldrushIdExists } from '../lib/goldrush.js';
import { isPhotoHashDuplicate } from '../lib/photoAi.js';

export const MAX_ATTEMPTS = 3;
// Short pause between attempts so a retake is a deliberate new photo, not a burst.
export const RETRY_DELAY_SECONDS = 10;
// Failed attempts older than this no longer count toward a lock.
const OPEN_WINDOW_HOURS = 12;
// A camera capture hands the page a file created moments ago; a gallery pick is older.
export const LIVE_CAPTURE_MAX_AGE_MS = 10 * 60 * 1000;

export const ATTEMPT_MESSAGES = [
  'We couldn’t verify this photo. Please retake it with the live camera, make sure the code on screen is fully visible, and check that the photo is clear and well lit. You have 2 attempts left.',
  'This photo still couldn’t be verified. Please make sure you’re holding your phone steady, and take the photo again. This is your last attempt.',
  'This visit couldn’t be verified and has been sent to your Team Lead for review. You can’t submit another photo for this visit until the review is done.',
];
export const LOCKED_MESSAGE = ATTEMPT_MESSAGES[2];

// Reviewer-facing labels for the stored reason codes. Never sent to the agent.
export const REASON_LABELS = {
  AI_FLAG: 'AI check: screenshot detected as fake or edited',
  AVATAR_INITIALS: 'Profile circle letters are not the first two letters of the name',
  CARD_COLOUR: 'ID card is not Goldrush mustard yellow',
  NO_ID: 'No 9-digit Goldrush ID could be read',
  BLURRY: 'Photo too blurry to read',
  DUPLICATE_IMAGE: 'Same photo already submitted on another visit',
  DUPLICATE_ID: 'Goldrush ID already used on another visit',
  NOT_LIVE_CAPTURE: 'Not a live camera capture (old image file)',
  REJECTED_PHOTO: 'Photo already rejected on review',
  FAILED_PHOTO_SUBMITTED: 'A photo that failed verification was submitted anyway',
};

let converged = false;
export async function ensurePhotoAttemptTables(db) {
  if (converged) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS goldrush_photo_attempts (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, agent_id TEXT NOT NULL, company_id TEXT,
      photo_hash TEXT, outcome TEXT NOT NULL, stage TEXT NOT NULL, reasons TEXT, detail TEXT,
      extracted_id TEXT, first_name TEXT, last_name TEXT, photo_key TEXT,
      open INTEGER DEFAULT 0, review_id TEXT, created_at TEXT NOT NULL)`,
    'CREATE INDEX IF NOT EXISTS idx_gr_attempts_agent ON goldrush_photo_attempts(tenant_id, agent_id, open)',
    'CREATE INDEX IF NOT EXISTS idx_gr_attempts_hash ON goldrush_photo_attempts(tenant_id, photo_hash)',
    'CREATE INDEX IF NOT EXISTS idx_gr_attempts_review ON goldrush_photo_attempts(review_id)',
    `CREATE TABLE IF NOT EXISTS goldrush_photo_reviews (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, agent_id TEXT NOT NULL, agent_name TEXT,
      team_lead_id TEXT, team_lead_name TEXT, company_id TEXT, status TEXT NOT NULL DEFAULT 'pending',
      photo_hash TEXT, photo_key TEXT, goldrush_id TEXT, first_name TEXT, last_name TEXT,
      reviewed_by TEXT, reviewed_by_name TEXT, reviewed_at TEXT, note TEXT, created_at TEXT NOT NULL)`,
    'CREATE INDEX IF NOT EXISTS idx_gr_reviews_agent ON goldrush_photo_reviews(tenant_id, agent_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_gr_reviews_tl ON goldrush_photo_reviews(tenant_id, team_lead_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_gr_reviews_hash ON goldrush_photo_reviews(tenant_id, photo_hash)',
    // The visit (capture page session) the attempts and the lock belong to.
    'ALTER TABLE goldrush_photo_attempts ADD COLUMN capture_id TEXT',
    'ALTER TABLE goldrush_photo_reviews ADD COLUMN capture_id TEXT',
    'CREATE INDEX IF NOT EXISTS idx_gr_attempts_capture ON goldrush_photo_attempts(tenant_id, agent_id, capture_id, open)',
    'CREATE INDEX IF NOT EXISTS idx_gr_reviews_capture ON goldrush_photo_reviews(tenant_id, agent_id, capture_id, status)',
    // The visit an approved photo was finally submitted on; NULL = still unfinished.
    'ALTER TABLE goldrush_photo_reviews ADD COLUMN visit_id TEXT',
    // What the profile-circle read saw, on passes too, so a photo that got through can be checked.
    'ALTER TABLE goldrush_photo_attempts ADD COLUMN avatar_letters TEXT',
    'ALTER TABLE goldrush_photo_attempts ADD COLUMN profile_name TEXT',
  ];
  for (const s of stmts) {
    try { await db.prepare(s).run(); } catch (e) { if (!/duplicate column/i.test(e.message)) console.error('ensurePhotoAttemptTables:', e.message); }
  }
  converged = true;
}

// A capture id is a client-made UUID; anything else is treated as no id (an older
// capture page), which shares one bucket per agent.
export const cleanCaptureId = v => (typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : null);

// Same hash the capture page puts in visit_photos.photo_hash: SHA-256 of the data URL text.
export async function hashDataUrl(dataUrl) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataUrl));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// OCR reads a round "O" as zero and an "I" as one often enough to matter here.
const circleLetters = v => String(v || '').toUpperCase().replace(/0/g, 'O').replace(/1/g, 'I').replace(/[^A-Z]/g, '');

// A real Goldrush profile shows the first two letters of the first name in the circle
// ("Collen Nkuta" → CO). Any other letters — the initials (CN) or anything else — mean
// the screen was made by hand. Both the letters and the name under the circle must be
// readable to judge; when either is not, the check cannot say anything and passes.
export function avatarLettersCheck({ avatar, name }) {
  const letters = circleLetters(avatar);
  const words = String(name || '').trim().split(/\s+/).map(w => w.replace(/[^A-Za-z]/g, '').toUpperCase()).filter(Boolean);
  if (!letters || !words.length || words[0].length < 2) return null;
  const expected = words[0].slice(0, 2);
  if (letters === expected) return null;
  const initials = words.length > 1 ? words[0][0] + words[words.length - 1][0] : null;
  return {
    code: 'AVATAR_INITIALS',
    detail: `Profile circle shows "${letters}"${letters === initials ? ' (the initials)' : ''}; for "${String(name).trim()}" a real Goldrush profile shows "${expected}"`,
  };
}

const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

// A focused read of the profile header: the letters in the avatar circle and the name
// printed under it. Run on its own because the general OCR pass is busy with the ID and
// URL bar and often returns no name, which left the circle check with nothing to compare.
// Returns nulls when the model is unavailable or cannot read them.
export async function readProfileCircle(env, dataUrl) {
  if (!env.AI) return { letters: null, name: null };
  try {
    const res = await env.AI.run(VISION_MODEL, {
      messages: [
        { role: 'system', content: 'You copy text from images exactly as printed. Reply with ONLY one JSON object, no prose.' },
        { role: 'user', content: [
          { type: 'text', text: 'This shows a Goldrush player profile page. Near the top there is a round avatar circle with letters inside it, and the player\'s full name printed directly below the circle. Copy (1) the letters inside the circle and (2) the full name below the circle, exactly as printed. Never work the letters out from the name — copy what is in the circle even if it looks wrong. Reply exactly as {"circle_letters":"XX","name":"First Last"}. Use null for anything not clearly readable.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ] },
      ],
      max_tokens: 60,
      temperature: 0,
    });
    const raw = res?.response ?? res?.result?.response ?? '';
    const obj = typeof raw === 'object' && raw ? raw : (() => { const t = String(raw); const a = t.indexOf('{'), b = t.lastIndexOf('}'); try { return a >= 0 ? JSON.parse(t.slice(a, b + 1)) : {}; } catch { return {}; } })();
    const letters = circleLetters(obj.circle_letters);
    const name = typeof obj.name === 'string' && /^[A-Za-zÀ-ſ' -]{2,60}$/.test(obj.name.trim()) ? obj.name.trim() : null;
    return { letters: letters && letters.length <= 3 ? letters : null, name };
  } catch (e) {
    console.error('readProfileCircle failed:', e.message || e);
    return { letters: null, name: null };
  }
}

// Failures that come from the photo itself rather than the fraud rule set.
export async function photoChecks(db, { tenantId, hash, extractedId, blurry, aiRead, fileAgeMs, avatar, name }) {
  const out = [];
  if (Number.isFinite(fileAgeMs) && fileAgeMs > LIVE_CAPTURE_MAX_AGE_MS) {
    out.push({ code: 'NOT_LIVE_CAPTURE', detail: `Image file was ${Math.round(fileAgeMs / 60000)} min old when it was added — not taken with the live camera` });
  }
  if (hash && await isPhotoHashDuplicate(db, tenantId, hash)) {
    out.push({ code: 'DUPLICATE_IMAGE', detail: 'This exact photo was already submitted on another visit' });
  }
  if (aiRead && blurry === true) out.push({ code: 'BLURRY', detail: 'Photo too blurry to read the screen' });
  if (aiRead && !extractedId && blurry !== true) out.push({ code: 'NO_ID', detail: 'No 9-digit Goldrush ID could be read from the photo' });
  if (extractedId && await goldrushIdExists(db, tenantId, extractedId)) {
    out.push({ code: 'DUPLICATE_ID', detail: `Goldrush ID ${extractedId} is already on another visit` });
  }
  const avatarFlag = avatarLettersCheck({ avatar, name });
  if (avatarFlag) out.push(avatarFlag);
  return out;
}

const openSince = nowIso => new Date(Date.parse(nowIso) - OPEN_WINDOW_HOURS * 3600e3).toISOString();

// Where this visit stands: failed attempts still open, retake delay left, and its pending review.
export async function attemptState(db, { tenantId, agentId, captureId = null, nowIso = new Date().toISOString() }) {
  await ensurePhotoAttemptTables(db);
  const fails = await db.prepare(
    "SELECT created_at FROM goldrush_photo_attempts WHERE tenant_id = ? AND agent_id = ? AND capture_id IS ? AND open = 1 AND outcome = 'fail' AND created_at >= ? ORDER BY created_at DESC"
  ).bind(tenantId, agentId, captureId, openSince(nowIso)).all();
  const rows = fails.results || [];
  const pending = await db.prepare(
    "SELECT id, photo_hash, created_at FROM goldrush_photo_reviews WHERE tenant_id = ? AND agent_id = ? AND capture_id IS ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
  ).bind(tenantId, agentId, captureId).first();
  const lastFailAt = rows[0]?.created_at || null;
  const retryAfter = lastFailAt
    ? Math.max(0, Math.ceil(RETRY_DELAY_SECONDS - (Date.parse(nowIso) - Date.parse(lastFailAt)) / 1000))
    : 0;
  return { used: rows.length, attemptsLeft: Math.max(0, MAX_ATTEMPTS - rows.length), retryAfter, pending: pending || null };
}

// What the agent's screen gets. Deliberately carries no reasons.
export function lockedVerification(pending) {
  return { verified: false, locked: true, attempt: MAX_ATTEMPTS, attempts_left: 0, retry_after: 0, message: LOCKED_MESSAGE, review_id: pending?.id || null };
}

// A decided review for this exact photo by this agent (latest wins). An approved photo
// that has since been submitted on a visit no longer counts as approved.
export async function reviewForPhoto(db, { tenantId, agentId, hash }) {
  if (!hash) return null;
  await ensurePhotoAttemptTables(db);
  return db.prepare(
    "SELECT id, status, goldrush_id, first_name, last_name FROM goldrush_photo_reviews WHERE tenant_id = ? AND agent_id = ? AND photo_hash = ? AND status != 'pending' AND visit_id IS NULL ORDER BY reviewed_at DESC LIMIT 1"
  ).bind(tenantId, agentId, hash).first();
}

export async function lastOutcomeForPhoto(db, { tenantId, agentId, hash }) {
  if (!hash) return null;
  await ensurePhotoAttemptTables(db);
  const row = await db.prepare(
    'SELECT outcome FROM goldrush_photo_attempts WHERE tenant_id = ? AND agent_id = ? AND photo_hash = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(tenantId, agentId, hash).first();
  return row?.outcome || null;
}

// A passing photo: log it and close the visit's open attempts.
export async function recordPass(db, { tenantId, agentId, captureId = null, companyId = null, hash, stage = 'precheck', extractedId = null, firstName = null, lastName = null, avatarLetters = null, profileName = null, nowIso = new Date().toISOString() }) {
  await ensurePhotoAttemptTables(db);
  await db.prepare("UPDATE goldrush_photo_attempts SET open = 0 WHERE tenant_id = ? AND agent_id = ? AND capture_id IS ? AND open = 1").bind(tenantId, agentId, captureId).run();
  await db.prepare(
    "INSERT INTO goldrush_photo_attempts (id, tenant_id, agent_id, capture_id, company_id, photo_hash, outcome, stage, extracted_id, first_name, last_name, avatar_letters, profile_name, open, created_at) VALUES (?,?,?,?,?,?,'pass',?,?,?,?,?,?,0,?)"
  ).bind(crypto.randomUUID(), tenantId, agentId, captureId, companyId, hash, stage, extractedId, firstName, lastName, avatarLetters, profileName, nowIso).run();
}

// The stored attempt photo back as the data URL it was uploaded as, so a visit
// resumed after approval submits the very photo that was approved.
export async function loadAttemptPhoto(env, photoKey) {
  if (!photoKey || !env.UPLOADS) return null;
  const obj = await env.UPLOADS.get(photoKey);
  if (!obj) return null;
  const bytes = new Uint8Array(await obj.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${obj.httpMetadata?.contentType || 'image/jpeg'};base64,${btoa(bin)}`;
}

async function storeAttemptPhoto(env, tenantId, attemptId, dataUrl) {
  const m = typeof dataUrl === 'string' ? dataUrl.match(/^data:([^;]+);base64,(.+)$/s) : null;
  if (!m || !env.UPLOADS) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const key = `goldrush-attempts/${tenantId}/${attemptId}.jpg`;
    await env.UPLOADS.put(key, bytes, { httpMetadata: { contentType: m[1] } });
    return key;
  } catch (e) {
    console.error('storeAttemptPhoto failed:', e.message || e);
    return null;
  }
}

async function userName(db, id) {
  const u = id ? await db.prepare('SELECT first_name, last_name, team_lead_id FROM users WHERE id = ?').bind(id).first() : null;
  return u ? { name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || null, teamLeadId: u.team_lead_id || null } : { name: null, teamLeadId: null };
}

// A failed photo: store it with the real reasons, count the attempt and, on the third,
// open the review that locks this visit. Returns what the agent's screen shows.
export async function recordFail(env, { tenantId, agentId, captureId = null, companyId = null, hash, dataUrl, stage = 'precheck', reasons, extractedId = null, firstName = null, lastName = null, avatarLetters = null, profileName = null, nowIso = new Date().toISOString() }) {
  const db = env.DB;
  const state = await attemptState(db, { tenantId, agentId, captureId, nowIso });
  if (state.pending) return lockedVerification(state.pending);
  const id = crypto.randomUUID();
  const photoKey = await storeAttemptPhoto(env, tenantId, id, dataUrl);
  await db.prepare(
    "INSERT INTO goldrush_photo_attempts (id, tenant_id, agent_id, capture_id, company_id, photo_hash, outcome, stage, reasons, detail, extracted_id, first_name, last_name, avatar_letters, profile_name, photo_key, open, created_at) VALUES (?,?,?,?,?,?,'fail',?,?,?,?,?,?,?,?,?,1,?)"
  ).bind(id, tenantId, agentId, captureId, companyId, hash, stage, JSON.stringify(reasons.map(r => r.code)),
    reasons.map(r => r.detail).join(' | ') || null, extractedId, firstName, lastName, avatarLetters, profileName, photoKey, nowIso).run();
  const attempt = state.used + 1;
  if (attempt < MAX_ATTEMPTS) {
    return { verified: false, locked: false, attempt, attempts_left: MAX_ATTEMPTS - attempt, retry_after: RETRY_DELAY_SECONDS, message: ATTEMPT_MESSAGES[attempt - 1] };
  }
  const reviewId = crypto.randomUUID();
  const agent = await userName(db, agentId);
  const tl = await userName(db, agent.teamLeadId);
  await db.prepare(
    "INSERT INTO goldrush_photo_reviews (id, tenant_id, agent_id, capture_id, agent_name, team_lead_id, team_lead_name, company_id, status, photo_hash, photo_key, goldrush_id, first_name, last_name, created_at) VALUES (?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?)"
  ).bind(reviewId, tenantId, agentId, captureId, agent.name, agent.teamLeadId, tl.name, companyId, hash, photoKey, extractedId, firstName, lastName, nowIso).run();
  await db.prepare(
    "UPDATE goldrush_photo_attempts SET open = 0, review_id = ? WHERE tenant_id = ? AND agent_id = ? AND capture_id IS ? AND open = 1 AND outcome = 'fail' AND created_at >= ?"
  ).bind(reviewId, tenantId, agentId, captureId, openSince(nowIso)).run();
  return lockedVerification({ id: reviewId });
}

// Gate for /visits/workflow: the photo being submitted must not bypass the attempts.
// Returns { approved } for a photo cleared on review, { verification } to reject the
// submit, or {} to carry on with the normal checks.
export async function submitGate(env, { tenantId, agentId, captureId = null, companyId = null, dataUrl, nowIso }) {
  const db = env.DB;
  const hash = await hashDataUrl(dataUrl);
  const review = await reviewForPhoto(db, { tenantId, agentId, hash });
  if (review?.status === 'approved') return { hash, approved: review };
  const state = await attemptState(db, { tenantId, agentId, captureId, nowIso });
  if (state.pending) return { hash, verification: lockedVerification(state.pending) };
  const code = review?.status === 'rejected' ? 'REJECTED_PHOTO'
    : (await lastOutcomeForPhoto(db, { tenantId, agentId, hash })) === 'fail' ? 'FAILED_PHOTO_SUBMITTED' : null;
  if (code) {
    const verification = await recordFail(env, { tenantId, agentId, captureId, companyId, hash, dataUrl, stage: 'submit', reasons: [{ code, detail: REASON_LABELS[code] }], nowIso });
    return { hash, verification };
  }
  return { hash };
}
