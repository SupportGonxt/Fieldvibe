#!/usr/bin/env node
// Goldrush fake-photo back-test: current rule set ("before") vs candidate rules ("after")
// over the last N days of Goldrush individual check-ins. READ-ONLY: SELECTs and R2 gets.
//
//   cd workers-api && npx wrangler login      # or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
//   node scripts/goldrush-fraud-backtest.mjs --days 31 --out ../../goldrush-backtest [--players players.csv]
//
// Output (contains customer PII — keep it out of git): report.md, flags.csv, agents.csv,
// photos/ (cache, safe to delete). Re-runs reuse the photo cache.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import {
  decodeJpeg, dataUrlToBytes, analyzeImage, evaluate, fingerprintDistance, fpFromBase64,
  FP_MATCH_THRESHOLD, idFrontier, RULESET_VERSION,
} from '../src/lib/imageFraud.js';

const run = promisify(execFile);
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const DAYS = Number(arg('days', 31));
const OUT = path.resolve(arg('out', 'goldrush-backtest-out'));
const DB = arg('db', 'fieldvibe-db');
const BUCKET = arg('bucket', 'fieldvibe-uploads');
const WRANGLER = process.env.WRANGLER_BIN || path.resolve('node_modules/.bin/wrangler');
const CONCURRENCY = Number(arg('concurrency', 8));
// Goldrush player export saved as CSV (Player ID in the first column): those IDs count as Goldrush-verified.
const PLAYERS = arg('players', null);
const playerIds = new Set(PLAYERS ? fs.readFileSync(PLAYERS, 'utf8').split('\n').map(l => l.split(',')[0].replace(/\D/g, '')).filter(Boolean) : []);
const SAST_MS = 2 * 3600e3;
const PHOTOS = path.join(OUT, 'photos');
fs.mkdirSync(PHOTOS, { recursive: true });

// ---------- I/O ----------
async function sql(q) {
  const { stdout } = await run(WRANGLER, ['d1', 'execute', DB, '--remote', '--json', '--command', q], { maxBuffer: 1 << 30 });
  const parsed = JSON.parse(stdout.slice(stdout.indexOf('[')));
  return parsed.flatMap(r => r.results || []);
}
async function sqlPaged(q, page = 1000) {
  const out = [];
  for (let off = 0; ; off += page) {
    const rows = await sql(`${q} LIMIT ${page} OFFSET ${off}`);
    out.push(...rows);
    process.stderr.write(`\r  ${out.length} rows`);
    if (rows.length < page) break;
  }
  process.stderr.write('\n');
  return out;
}
async function mapLimit(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}
const esc = s => String(s).replace(/'/g, "''");

async function photoBytes(p) {
  const file = path.join(PHOTOS, `${p.photo_id}.jpg`);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  try {
    await run(WRANGLER, ['r2', 'object', 'get', `${BUCKET}/${p.r2_key}`, '--remote', '--file', file], { maxBuffer: 1 << 26 });
    if (fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file);
  } catch { /* fall through: legacy rows keep the image in D1 */ }
  const [row] = await sql(`SELECT r2_url FROM visit_photos WHERE id = '${esc(p.photo_id)}'`);
  const bytes = dataUrlToBytes(row?.r2_url);
  if (bytes) fs.writeFileSync(file, bytes);
  return bytes;
}

// ---------- candidate rules (pure) ----------
const sast = t => { const ms = Date.parse(/Z|[+-]\d\d:?\d\d$/.test(t || '') ? t : `${t}Z`); return Number.isFinite(ms) ? new Date(ms + SAST_MS) : null; };
// Minutes between a status-bar clock "H:MM" and a timestamp, allowing a 12-hour clock.
export function clockDrift(clock, ts) {
  const d = sast(ts); const m = /^(\d{1,2}):(\d{2})$/.exec(clock || '');
  if (!d || !m) return null;
  const a = Number(m[1]) * 60 + Number(m[2]), b = d.getUTCHours() * 60 + d.getUTCMinutes();
  const diff = x => { const v = Math.abs(x) % 1440; return Math.min(v, 1440 - v); };
  return Math.min(diff(a - b), diff(a - b + 720), diff(a - b - 720));
}

// Native output sizes of common image generators (DALL-E/gpt-image, SD/SDXL, Midjourney,
// Imagen/Gemini), as they arrive after the app's 1280px-wide JPEG re-encode.
const AI_NATIVE = [[1024, 1024], [1024, 1536], [1536, 1024], [1024, 1792], [1792, 1024], [832, 1216], [1216, 832],
  [896, 1152], [1152, 896], [768, 1344], [1344, 768], [640, 1536], [512, 512], [768, 768], [2048, 2048],
  [896, 1280], [1280, 896], [768, 1408], [1408, 768], [816, 1456], [896, 1344], [1344, 896], [1152, 2048]];
const AI_SIZES = AI_NATIVE.map(([w, h]) => (w > 1280 ? [1280, Math.round(h * 1280 / w)] : [w, h]));
export const isAiCanvas = (w, h) => AI_SIZES.some(([a, b]) => Math.abs(a - w) <= 1 && Math.abs(b - h) <= 1);

// SA ID: 13 digits, valid date, Luhn. Returns { valid, age } (age null when invalid).
export function saId(raw, onDate) {
  const id = String(raw || '').trim();
  if (!/^\d{13}$/.test(id)) return { valid: false, age: null };
  let sum = 0;
  for (let i = 0; i < 13; i++) { let n = id.charCodeAt(12 - i) - 48; if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; }
  const yy = Number(id.slice(0, 2)), mm = Number(id.slice(2, 4)), dd = Number(id.slice(4, 6));
  const ref = new Date(onDate || Date.now());
  const year = 2000 + yy > ref.getUTCFullYear() ? 1900 + yy : 2000 + yy;
  const dob = new Date(Date.UTC(year, mm - 1, dd));
  const valid = sum % 10 === 0 && mm >= 1 && mm <= 12 && dob.getUTCDate() === dd && [0, 1].includes(id.charCodeAt(10) - 48);
  if (!valid) return { valid: false, age: null };
  let age = ref.getUTCFullYear() - year;
  if (ref.getUTCMonth() < mm - 1 || (ref.getUTCMonth() === mm - 1 && ref.getUTCDate() < dd)) age--;
  return { valid: true, age };
}

// Grey thumbnail + 64-bit dHash for near-duplicate search.
const TW = 90, TH = 180, GRID = 10;
function thumb(img) {
  const { width: W, height: H, data } = img; const t = new Uint8Array(TW * TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const i = (Math.floor(y * H / TH) * W + Math.floor(x * W / TW)) * 4;
    t[y * TW + x] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  return t;
}
function dhash(t) {
  let h = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = (xx) => t[Math.floor((y + 0.5) * TH / 8) * TW + Math.floor((xx + 0.5) * TW / 9)];
    h = (h << 1n) | (v(x) > v(x + 1) ? 1n : 0n);
  }
  return h;
}
// Worst grid-cell mean abs diff: small only when EVERY region (name, ID, clock) matches.
export function worstCellDiff(a, b) {
  let worst = 0; const cw = TW / GRID, ch = TH / GRID;
  for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
    let s = 0;
    for (let y = gy * ch; y < (gy + 1) * ch; y++) for (let x = gx * cw; x < (gx + 1) * cw; x++) s += Math.abs(a[y * TW + x] - b[y * TW + x]);
    worst = Math.max(worst, s / (cw * ch));
  }
  return worst;
}
const NEAR_DUP_MAX = 6;
// Template edit: identical everywhere (status bar included) except a few cells (name/ID typed over).
export function cellDiffs(a, b) {
  const out = []; const cw = TW / GRID, ch = TH / GRID;
  for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
    let s = 0;
    for (let y = gy * ch; y < (gy + 1) * ch; y++) for (let x = gx * cw; x < (gx + 1) * cw; x++) s += Math.abs(a[y * TW + x] - b[y * TW + x]);
    out.push(s / (cw * ch));
  }
  return out;
}

// Page-background flatness and ID-card colour. A real screenshot's page is one flat colour
// (#414141) and the card exactly #FFB500; generated images drift in hue and carry noise.
export function pagePixels(img) {
  const { width: W, height: H, data } = img;
  const lum = []; let r = 0, g = 0, b = 0;
  const xs = Math.max(2, Math.floor(W * 0.012)); // same margin lib/imageFraud.js samples
  for (let y = Math.floor(H * 0.4); y < Math.floor(H * 0.9); y += 2) for (let x = 0; x < xs; x++) {
    const i = (y * W + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; lum.push((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000);
  }
  const n = lum.length || 1, mean = lum.reduce((a, c) => a + c, 0) / n;
  const bgStd = Math.sqrt(lum.reduce((a, c) => a + (c - mean) ** 2, 0) / n);
  const acc = [];
  for (let y = 0; y < Math.floor(H * 0.45); y += 2) for (let x = 0; x < W; x += 2) {
    const i = (y * W + x) * 4; const R = data[i], G = data[i + 1], B = data[i + 2];
    if (R > 140 && R - B > 80 && G > 70 && G < R + 10) acc.push([R, G, B]);
  }
  const med = k => { const v = acc.map(p => p[k]).sort((a, c) => a - c); return v[v.length >> 1]; };
  return { bgStd, bgRgb: [r / n, g / n, b / n], card: acc.length > 200 ? [med(0), med(1), med(2)] : null };
}
const PHONE_ASPECTS = [16 / 9, 18 / 9, 18.5 / 9, 19 / 9, 19.5 / 9, 20 / 9, 21 / 9, 2.16, 2.17, 2.1667];
const PHONE_WIDTHS = [480, 540, 576, 600, 640, 720, 750, 768, 800, 828, 1080, 1125, 1170, 1179, 1242, 1280];

const haversine = (la1, lo1, la2, lo2) => {
  const R = Math.PI / 180, a = Math.sin((la2 - la1) * R / 2) ** 2 + Math.cos(la1 * R) * Math.cos(la2 * R) * Math.sin((lo2 - lo1) * R / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
};

// ---------- main ----------
const LEVEL = { definite: 3, likely: 2, review: 1, pass: 0, info: 0 };
// These fired more often on players Goldrush accepted (players_4-10-2026: 625 matched check-ins) than on
// check-ins missing from that list, so they track agent workflow, not fraud. Still reported, never scored.
const INFO_ONLY = new Set(['CLOCK_STALE', 'TEMPLATE_EDIT', 'CAPTURED_IN_FUTURE', 'OFF_HOURS', 'SHORT_VISIT', 'NOT_GOLDRUSH_PAGE', 'GPS_REPEAT', 'BG_NOT_FLAT']);
const worst = fl => fl.reduce((b, f) => (LEVEL[f.level] > LEVEL[b] ? f.level : b), 'pass');

async function main() {
  console.error(`Goldrush back-test: last ${DAYS} days, ruleset ${RULESET_VERSION}`);
  const since = `date('now','-${DAYS} day')`;
  const gr = "(SELECT id FROM field_companies WHERE LOWER(name) LIKE '%goldrush%')";
  console.error('visits…');
  const visits = await sqlPaged(`SELECT v.id visit_id, v.tenant_id, v.agent_id, u.first_name||' '||u.last_name agent, v.visit_date,
      v.check_in_time, v.check_out_time, v.created_at, v.latitude lat, v.longitude lng,
      i.first_name, i.last_name, i.id_number, i.phone,
      COALESCE(json_extract(CASE WHEN json_valid(vi.custom_field_values) THEN vi.custom_field_values END,'$.goldrush_id'),
               json_extract(CASE WHEN json_valid(vi.custom_field_values) THEN vi.custom_field_values END,'$.goldrush_id_entry')) goldrush_id,
      json_extract(CASE WHEN json_valid(vi.custom_field_values) THEN vi.custom_field_values END,'$.verification_status') verification,
      vp.id photo_id, vp.r2_key, vp.captured_at photo_captured_at, vp.width, vp.height
    FROM visits v
    LEFT JOIN users u ON u.id = v.agent_id
    LEFT JOIN visit_individuals vi ON vi.visit_id = v.id
    LEFT JOIN individuals i ON i.id = vi.individual_id
    LEFT JOIN visit_photos vp ON vp.id = (SELECT p.id FROM visit_photos p WHERE p.visit_id = v.id AND p.r2_key IS NOT NULL
         ORDER BY (p.photo_type = 'goldrush_individual') DESC, p.captured_at LIMIT 1)
    WHERE LOWER(v.visit_type) = 'individual' AND v.company_id IN ${gr} AND v.visit_date >= ${since}
    ORDER BY v.visit_date, v.id`);
  console.error('fingerprints…');
  const fps = await sqlPaged(`SELECT visit_id, agent_id, visit_date, captured_at, goldrush_id, fp, sb_clock, sb_battery, verdict
    FROM image_fingerprints WHERE captured_at >= datetime('now','-${DAYS + 90} day') ORDER BY captured_at, id`);
  console.error('flags…');
  const flagRows = await sqlPaged(`SELECT visit_id, stage, verdict, flags, source, created_at FROM image_fraud_flags
    WHERE visit_date >= ${since} ORDER BY created_at, id`);
  console.error('blocked uploads (never saved)…');
  const [blocked] = await sql(`SELECT COUNT(*) n FROM image_fraud_flags WHERE stage = 'blocked' AND visit_date >= ${since}`);

  const fpByVisit = new Map(fps.filter(f => f.visit_id).map(f => [f.visit_id, f]));
  const flagsByVisit = new Map();
  for (const f of flagRows) { if (!f.visit_id) continue; (flagsByVisit.get(f.visit_id) || flagsByVisit.set(f.visit_id, []).get(f.visit_id)).push(f); }

  // Labels: manual review on the AI Check page, and Goldrush's own verification.
  for (const v of visits) {
    const fl = flagsByVisit.get(v.visit_id) || [];
    const manual = fl.filter(f => f.source === 'manual').at(-1);
    v.label = manual ? (manual.verdict === 'definite' ? 'fake' : 'genuine') : (v.verification === 'qualified' || playerIds.has(String(v.goldrush_id || '').replace(/\D/g, '')) ? 'verified' : null);
    v.dbVerdict = worst(fl.filter(f => f.source !== 'manual').map(f => ({ level: f.verdict })));
    v.dbCodes = [...new Set(fl.filter(f => f.source !== 'manual').flatMap(f => { try { return JSON.parse(f.flags || '[]'); } catch { return []; } }))];
    v.newFlags = [];
  }

  // ---- photos: re-run the current rule set and collect pixel features ----
  console.error(`photos (${visits.filter(v => v.photo_id).length})…`);
  let done = 0, undecodable = 0;
  await mapLimit(visits.filter(v => v.photo_id), CONCURRENCY, async v => {
    try {
      const bytes = await photoBytes(v);
      if (!bytes) { v.photoMissing = true; return; }
      const img = decodeJpeg(bytes);
      v.w = img.width; v.h = img.height;
      v.analysis = analyzeImage(img);
      const t = thumb(img); v.thumb = t; v.hash = dhash(t);
      v.px = pagePixels(img);
    } catch { undecodable++; v.undecodable = true; }
    finally { if (++done % 50 === 0) process.stderr.write(`\r  ${done}`); }
  });
  process.stderr.write('\n');

  // Current rule set, replayed with the stored status-bar readings (no vision calls).
  for (const o of fps) o.t = Date.parse(o.captured_at);
  const byClock = new Map();
  for (const o of fps) if (o.sb_clock) (byClock.get(o.sb_clock) || byClock.set(o.sb_clock, []).get(o.sb_clock)).push(o);
  const withId = fps.filter(o => o.goldrush_id && Number.isFinite(o.t)); // sorted by captured_at
  for (const v of visits) {
    const f = fpByVisit.get(v.visit_id);
    const now = f?.captured_at || v.created_at;
    const tNow = Date.parse(now);
    let statusMatches = [];
    if (v.analysis && f?.sb_clock) {
      const fpA = v.analysis.fingerprint;
      statusMatches = (byClock.get(f.sb_clock) || []).filter(o => o.visit_id !== v.visit_id && o.t < tNow
        && (!f.sb_battery || !o.sb_battery || f.sb_battery === o.sb_battery)
        && fingerprintDistance(fpA, o.fpArr ||= fpFromBase64(o.fp)) < FP_MATCH_THRESHOLD);
    }
    const recent = withId.filter(o => o.t < tNow && o.t > tNow - 3 * 864e5).map(o => o.goldrush_id);
    v.frontier = idFrontier(recent);
    v.replay = evaluate({ analysis: v.analysis, statusMatches, now, typedId: v.goldrush_id, extractedId: null, frontier: v.frontier });
  }

  // ---- candidate rules ----
  const add = (v, code, level, detail) => v.newFlags.push({ code, level: INFO_ONLY.has(code) ? 'info' : level, detail });

  for (const v of visits) {
    const f = fpByVisit.get(v.visit_id);
    // 1. Status-bar clock vs when the photo was taken.
    if (f?.sb_clock) {
      const drift = Math.min(...[v.photo_captured_at, v.check_in_time, f.captured_at].map(t => clockDrift(f.sb_clock, t)).filter(x => x != null));
      v.clockDrift = Number.isFinite(drift) ? drift : null;
      if (v.clockDrift > 120) add(v, 'CLOCK_STALE', 'likely', `status-bar clock ${f.sb_clock} is ${v.clockDrift} min from capture time`);
      else if (v.clockDrift > 30) add(v, 'CLOCK_STALE', 'review', `status-bar clock ${f.sb_clock} is ${v.clockDrift} min from capture time`);
    }
    if (v.analysis) {
      // 2. Image is exactly an AI generator's canvas size.
      if (isAiCanvas(v.w, v.h)) add(v, 'AI_CANVAS_SIZE', 'likely', `image ${v.w}x${v.h} matches an AI image generator's output size`);
      // 3. Full-screen screenshot with the status bar cropped/blanked (hides clock, defeats reuse rule).
      if (v.analysis.fullScreen && v.analysis.statusBarLike === false) add(v, 'NO_STATUS_BAR', 'review', 'phone status bar missing or cropped');
      // 4. Not a Goldrush profile page at all.
      if (!v.analysis.layoutFound) add(v, 'NOT_GOLDRUSH_PAGE', 'review', 'Goldrush ID card / layout not found in the image');
    }
    // 5. SA ID number.
    if (v.id_number && /^\d{13}$/.test(String(v.id_number).trim())) {
      const s = saId(v.id_number, v.visit_date);
      if (!s.valid) add(v, 'SA_ID_INVALID', 'review', `SA ID ${v.id_number} fails date/checksum`);
      else if (s.age < 18) add(v, 'UNDERAGE', 'likely', `SA ID implies age ${s.age}`);
    }
    // 6. Visit too short to register a real customer.
    const ci = Date.parse(v.check_in_time), co = Date.parse(v.check_out_time);
    if (Number.isFinite(ci) && Number.isFinite(co) && co >= ci && co - ci < 60e3) add(v, 'SHORT_VISIT', 'review', `visit lasted ${Math.round((co - ci) / 1000)}s`);
    if (Number.isFinite(ci) && Number.isFinite(co) && co < ci) add(v, 'CHECKOUT_BEFORE_CHECKIN', 'review', 'check-out time is before check-in: device clock tampered');

    // ---- extended pixel rules ----
    if (v.px && v.analysis?.layoutFound) {
      if (v.px.bgStd > 4) add(v, 'BG_NOT_FLAT', v.px.bgStd > 10 ? 'likely' : 'review', `page background not flat (std ${v.px.bgStd.toFixed(1)}; screenshots ~0–2): rendered/edited or photo of a screen`);
      const [r, g, b] = v.px.bgRgb;
      if (Math.max(Math.abs(r - 65), Math.abs(g - 65), Math.abs(b - 65)) > 10 && !v.analysis.green) add(v, 'BG_COLOUR_OFF', 'review', `page background rgb(${r.toFixed(0)},${g.toFixed(0)},${b.toFixed(0)}) vs golden #414141`);
      if (v.px.card) {
        const [cr, cg, cb] = v.px.card; const dist = Math.hypot(cr - 255, cg - 181, cb - 0);
        if (dist > 30) add(v, 'CARD_COLOUR_OFF', dist > 60 ? 'likely' : 'review', `ID card rgb(${cr},${cg},${cb}) vs golden #FFB500 (distance ${dist.toFixed(0)})`);
      }
    }
    if (v.analysis?.fullScreen) {
      const ar = v.h / v.w;
      if (Math.min(...PHONE_ASPECTS.map(a => Math.abs(a - ar))) > 0.03) add(v, 'ODD_ASPECT', 'review', `aspect ${ar.toFixed(3)} matches no phone screen`);
      if (!PHONE_WIDTHS.includes(v.w) && !isAiCanvas(v.w, v.h)) add(v, 'ODD_WIDTH', 'review', `width ${v.w}px matches no phone screen`);
    }
    if (v.w && v.w < 480) add(v, 'LOW_RES', 'review', `only ${v.w}x${v.h}: forwarded/thumbnail copy, not a screenshot`);

    // ---- time rules ----
    const capT = sast(v.photo_captured_at || v.check_in_time || v.created_at);
    if (capT) {
      const hr = capT.getUTCHours();
      if (hr >= 21 || hr < 6) add(v, 'OFF_HOURS', 'review', `captured ${capT.toISOString().slice(11, 16)} SAST`);
      const created = sast(v.created_at);
      if (created && Math.abs(created - capT) > 36 * 3600e3) add(v, 'LATE_SUBMIT', 'review', `submitted ${Math.round((created - capT) / 3600e3)}h after capture`);
      if (created && capT - created > 10 * 60e3) add(v, 'CAPTURED_IN_FUTURE', 'likely', 'photo time is after the server received it: device clock tampered');
    }
    const pt = Date.parse(v.photo_captured_at), cit = Date.parse(v.check_in_time);
    if (Number.isFinite(pt) && Number.isFinite(cit) && cit - pt > 15 * 60e3) add(v, 'PHOTO_BEFORE_CHECKIN', 'likely', `photo taken ${Math.round((cit - pt) / 60e3)} min before arriving: pre-made image`);

    // ---- GPS rules ----
    if (v.lat == null || v.lng == null || (Math.abs(v.lat) < 1e-6 && Math.abs(v.lng) < 1e-6)) add(v, 'GPS_MISSING', 'review', 'no GPS fix');
    else {
      if (v.lat > -22 || v.lat < -35.5 || v.lng < 16 || v.lng > 33.5) add(v, 'GPS_OUTSIDE_SA', 'likely', `GPS ${v.lat},${v.lng} is outside South Africa`);
      const dec = x => (String(x).split('.')[1] || '').length;
      if (dec(v.lat) <= 3 && dec(v.lng) <= 3) add(v, 'GPS_ROUNDED', 'review', `GPS ${v.lat},${v.lng} has ≤3 decimals: typed or spoofed`);
    }

    // ---- identity rules ----
    const idn = String(v.id_number || '').trim();
    if (/^\d{13}$/.test(idn)) {
      const s = saId(idn, v.visit_date);
      if (s.valid && s.age > 90) add(v, 'AGE_IMPLAUSIBLE', 'review', `SA ID implies age ${s.age}`);
      if (/^(\d)\1{5}/.test(idn) || /(\d)\1{5}/.test(idn.slice(6))) add(v, 'ID_REPEATED_DIGITS', 'review', `SA ID ${idn} has long repeated-digit runs`);
    }
    const ph = String(v.phone || '').replace(/\D/g, '').replace(/^27/, '0');
    if (ph) {
      if (!/^0[6-8]\d{8}$/.test(ph)) add(v, 'PHONE_INVALID', 'review', `phone ${v.phone} is not a South African mobile number`);
      if (/(\d)\1{5}/.test(ph) || /0123456|1234567|2345678|3456789|9876543/.test(ph)) add(v, 'PHONE_PATTERN', 'likely', `phone ${v.phone} is a keyboard/repeat pattern`);
    }
    const nm = `${v.first_name || ''} ${v.last_name || ''}`.trim().toLowerCase();
    if (nm && (/\d|test|asdf|qwer|xxx|^(.)\1+$/.test(nm) || (v.first_name || '').trim().length < 2)) add(v, 'NAME_JUNK', 'review', `customer name "${nm}" looks invented`);
    if (nm && v.agent && nm === String(v.agent).trim().toLowerCase()) add(v, 'SELF_SIGNUP', 'likely', 'customer name is the agent\'s own name');
    const gid = String(v.goldrush_id || '').trim();
    if (gid && !/^\d{9}$/.test(gid)) add(v, 'GOLDRUSH_ID_FORMAT', 'review', `Goldrush ID "${gid}" is not 9 digits`);
    if (/^\d{9}$/.test(gid) && v.frontier && Number(gid) < v.frontier - 50_000_000) add(v, 'OLD_GOLDRUSH_ACCOUNT', 'review', `Goldrush ID ${gid} is far below IDs being issued now (~${v.frontier}): existing account, not a new sign-up`);
  }

  // Same Goldrush ID on more than one check-in.
  const byGid = new Map();
  for (const v of visits) { const g = String(v.goldrush_id || '').trim(); if (g) (byGid.get(g) || byGid.set(g, []).get(g)).push(v); }
  for (const [g, vs] of byGid) if (vs.length > 1) vs.forEach(v => add(v, 'DUPLICATE_GOLDRUSH_ID', 'definite', `Goldrush ID ${g} used on ${vs.length} check-ins`));

  // 7. Same picture submitted for different customers (re-encoded copies included).
  const withThumb = visits.filter(v => v.thumb);
  const buckets = new Map();
  for (const v of withThumb) for (let b = 0; b < 4; b++) {
    const k = `${b}:${(v.hash >> BigInt(b * 16)) & 0xffffn}`;
    (buckets.get(k) || buckets.set(k, []).get(k)).push(v);
  }
  const seenPair = new Set();
  for (const group of buckets.values()) {
    if (group.length < 2 || group.length > 400) continue;
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const a = group[i], b = group[j];
      const key = a.visit_id < b.visit_id ? `${a.visit_id}|${b.visit_id}` : `${b.visit_id}|${a.visit_id}`;
      if (seenPair.has(key)) continue; seenPair.add(key);
      if (Math.abs(a.w / a.h - b.w / b.h) > 0.01) continue;
      const cells = cellDiffs(a.thumb, b.thumb);
      const d = Math.max(...cells);
      const changed = cells.filter(x => x >= NEAR_DUP_MAX).length;
      if (d >= NEAR_DUP_MAX && changed <= 3 && cells.slice(0, GRID).every(x => x < NEAR_DUP_MAX)) {
        add(a, 'TEMPLATE_EDIT', 'likely', `same screenshot as visit ${b.visit_id} with only ${changed} region(s) changed (name/ID typed over)`);
        add(b, 'TEMPLATE_EDIT', 'likely', `same screenshot as visit ${a.visit_id} with only ${changed} region(s) changed (name/ID typed over)`);
      }
      if (d < NEAR_DUP_MAX) {
        add(a, 'DUPLICATE_PHOTO', 'definite', `same image as visit ${b.visit_id} (${b.agent}, ${b.visit_date})`);
        add(b, 'DUPLICATE_PHOTO', 'definite', `same image as visit ${a.visit_id} (${a.agent}, ${a.visit_date})`);
      }
    }
  }

  // 8–11. Per-agent patterns.
  const byAgent = new Map();
  for (const v of visits) (byAgent.get(v.agent_id) || byAgent.set(v.agent_id, []).get(v.agent_id)).push(v);
  for (const list of byAgent.values()) {
    const t = v => Date.parse(v.check_in_time || v.created_at);
    const sorted = [...list].sort((a, b) => t(a) - t(b));
    for (let i = 1; i < sorted.length; i++) {
      const gap = t(sorted[i]) - t(sorted[i - 1]);
      if (Number.isFinite(gap) && gap >= 0 && gap < 90e3) add(sorted[i], 'BURST', 'review', `${Math.round(gap / 1000)}s after the agent's previous sign-up`);
    }
    const seq = (key, code, maxGap) => {
      const s = list.filter(v => /^\d{6,}$/.test(String(v[key] || '').replace(/\D/g, '')))
        .map(v => ({ v, n: Number(String(v[key]).replace(/\D/g, '').slice(-9)) })).sort((a, b) => a.n - b.n);
      for (let i = 1; i < s.length; i++) if (s[i].n - s[i - 1].n > 0 && s[i].n - s[i - 1].n <= maxGap) {
        add(s[i].v, code, 'review', `${key} ${s[i].v[key]} is ${s[i].n - s[i - 1].n} from ${s[i - 1].v[key]} (same agent)`);
        add(s[i - 1].v, code, 'review', `${key} ${s[i - 1].v[key]} is ${s[i].n - s[i - 1].n} from ${s[i].v[key]} (same agent)`);
      }
    };
    seq('phone', 'SEQUENTIAL_PHONE', 3);
    seq('goldrush_id', 'SEQUENTIAL_GOLDRUSH_ID', 2);
    const names = new Map();
    for (const v of list) {
      const k = `${v.first_name || ''} ${v.last_name || ''}`.trim().toLowerCase();
      if (k.length > 3) (names.get(k) || names.set(k, []).get(k)).push(v);
    }
    for (const [n, vs] of names) if (new Set(vs.map(v => v.id_number)).size > 1) vs.forEach(v => add(v, 'SAME_NAME_NEW_ID', 'review', `"${n}" registered ${vs.length}x with different ID numbers`));
    // Generated SA IDs: same first 10 digits (DOB + sequence) with only the tail changed.
    const idPrefix = new Map();
    for (const v of list) { const id = String(v.id_number || '').trim(); if (/^\d{13}$/.test(id)) (idPrefix.get(id.slice(0, 10)) || idPrefix.set(id.slice(0, 10), []).get(id.slice(0, 10))).push(v); }
    for (const [p, vs] of idPrefix) if (vs.length > 1) vs.forEach(v => add(v, 'SEQUENTIAL_SA_ID', 'likely', `${vs.length} customers share SA ID prefix ${p} (same agent)`));
    const dob = new Map();
    for (const v of list) { const id = String(v.id_number || '').trim(); if (/^\d{13}$/.test(id)) (dob.get(id.slice(0, 6)) || dob.set(id.slice(0, 6), []).get(id.slice(0, 6))).push(v); }
    for (const [p, vs] of dob) if (vs.length >= 3) vs.forEach(v => add(v, 'DOB_CLUSTER', 'review', `${vs.length} of this agent's customers born on ${p}`));
    // Travel speed between consecutive check-ins.
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      if ([a.lat, a.lng, b.lat, b.lng].some(x => x == null)) continue;
      const km = haversine(a.lat, a.lng, b.lat, b.lng), hrs = (t(b) - t(a)) / 3600e3;
      if (km > 5 && hrs > 0 && km / hrs > 150) add(b, 'GPS_TELEPORT', 'likely', `${km.toFixed(0)} km from previous check-in in ${Math.round(hrs * 60)} min`);
    }
    // Days far above this agent's own norm.
    const perDay = new Map();
    for (const v of list) (perDay.get(v.visit_date) || perDay.set(v.visit_date, []).get(v.visit_date)).push(v);
    const counts = [...perDay.values()].map(x => x.length).sort((a, b) => a - b);
    const med = counts[counts.length >> 1] || 0;
    for (const [d, vs] of perDay) if (vs.length >= 15 && vs.length > 3 * med) vs.forEach(v => add(v, 'DAILY_SPIKE', 'review', `${vs.length} sign-ups on ${d} vs agent median ${med}/day`));
    // Agent already has confirmed fakes: everything else they submitted deserves a look.
    const fakes = list.filter(v => v.label === 'fake').length;
    if (fakes >= 3) list.filter(v => v.label !== 'fake').forEach(v => add(v, 'AGENT_HAS_FAKES', 'review', `agent has ${fakes} confirmed fakes in the period`));
  }

  // 12. Identical GPS (real GPS jitters) for different customers.
  const gps = new Map();
  for (const v of visits) {
    if (v.lat == null || v.lng == null || (Math.abs(v.lat) < 1e-6 && Math.abs(v.lng) < 1e-6)) continue;
    const k = `${Number(v.lat).toFixed(6)},${Number(v.lng).toFixed(6)}`;
    (gps.get(k) || gps.set(k, []).get(k)).push(v);
  }
  for (const [k, vs] of gps) {
    const days = new Set(vs.map(v => v.visit_date));
    if (vs.length >= 3 && days.size >= 2) vs.forEach(v => add(v, 'GPS_REPEAT', 'likely', `exact GPS ${k} reused for ${vs.length} customers on ${days.size} days`));
    else if (vs.length >= 5) vs.forEach(v => add(v, 'GPS_REPEAT', 'review', `exact GPS ${k} reused for ${vs.length} customers`));
  }

  // ---------- report ----------
  for (const v of visits) v.after = worst([{ level: v.dbVerdict }, { level: v.replay?.verdict === 'unverifiable' ? 'pass' : (v.replay?.verdict || 'pass') }, ...v.newFlags]);
  const n = visits.length;
  const cnt = (pred) => visits.filter(pred).length;
  const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : '–');
  const lab = vs => ({ fake: vs.filter(v => v.label === 'fake').length, genuine: vs.filter(v => v.label === 'genuine').length, verified: vs.filter(v => v.label === 'verified').length });

  const lines = [];
  lines.push(`# Goldrush fake-photo back-test`, '', `Period: last ${DAYS} days (${visits[0]?.visit_date || '–'} → ${visits.at(-1)?.visit_date || '–'}). Ruleset ${RULESET_VERSION}. Generated ${new Date().toISOString()}.`, '');
  lines.push(`- Individual check-ins: **${n}** (${cnt(v => v.photo_id)} with a photo; ${cnt(v => v.analysis)} analysed; ${undecodable} undecodable; ${cnt(v => v.photoMissing)} missing)`);
  lines.push(`- Uploads blocked at capture (never saved): **${blocked?.n ?? 0}**`);
  lines.push(`- Labels available: ${cnt(v => v.label === 'fake')} confirmed fake (manual), ${cnt(v => v.label === 'genuine')} cleared (manual), ${cnt(v => v.label === 'verified')} Goldrush-verified`, '');

  lines.push('## Before vs after', '', '| Verdict | Before (live flags) | After (live + new rules) |', '|---|---:|---:|');
  for (const l of ['definite', 'likely', 'review']) lines.push(`| ${l} | ${cnt(v => v.dbVerdict === l)} (${pct(cnt(v => v.dbVerdict === l), n)}) | ${cnt(v => v.after === l)} (${pct(cnt(v => v.after === l), n)}) |`);
  const newlyCaught = visits.filter(v => LEVEL[v.after] >= 2 && LEVEL[v.dbVerdict] < 2);
  lines.push('', `**Newly caught at likely/definite: ${newlyCaught.length}** check-ins the live system passed or only sent to review.`, '');

  lines.push('## Current rules (live flags in the period)', '', '| Rule | Check-ins |', '|---|---:|');
  const codeCount = new Map();
  for (const v of visits) for (const c of v.dbCodes) codeCount.set(c, (codeCount.get(c) || 0) + 1);
  for (const [c, k] of [...codeCount].sort((a, b) => b[1] - a[1])) lines.push(`| ${c} | ${k} |`);
  const replayDiff = cnt(v => v.replay && LEVEL[v.replay.verdict] >= 3 && LEVEL[v.dbVerdict] < 3);
  lines.push('', `Replaying the current rule set offline flags ${replayDiff} definite check-ins the live system did not (e.g. later status-bar matches, rules added mid-period).`, '');

  lines.push('## New rules', '', '| Rule | Level | Hits | Not flagged before | Confirmed fake | Cleared on review | Goldrush-verified | Why it indicates fraud |', '|---|---|---:|---:|---:|---:|---:|---|');
  const WHY = {
    DUPLICATE_PHOTO: 'Every region of the image (name, ID, clock) matches another customer\'s check-in: one screenshot reused.',
    CLOCK_STALE: 'The phone clock in the screenshot disagrees with when it was captured: an old/recycled or generated screenshot.',
    AI_CANVAS_SIZE: 'Phones never produce these sizes; image generators always do.',
    NO_STATUS_BAR: 'Status bar cropped or painted out, which hides the clock and defeats the reuse check.',
    NOT_GOLDRUSH_PAGE: 'No Goldrush ID card found: wrong screen, or a generated image that only resembles it.',
    SA_ID_INVALID: 'ID number fails the Home Affairs checksum/date: invented.',
    UNDERAGE: 'Customer would be under 18.',
    SHORT_VISIT: 'Under a minute on site: no real registration fits.',
    BURST: 'Sign-ups seconds apart: faster than a customer can register.',
    SEQUENTIAL_PHONE: 'Phone numbers one or two apart: made up in sequence.',
    SEQUENTIAL_GOLDRUSH_ID: 'Goldrush IDs consecutive for one agent: accounts mass-created together.',
    SAME_NAME_NEW_ID: 'Same person registered again under a different ID number.',
    TEMPLATE_EDIT: 'Another check-in\'s screenshot (same status bar) with only the name/ID area changed: edited template.',
    BG_NOT_FLAT: 'App backgrounds are one flat colour; noise/gradients come from AI rendering, editing or photographing a screen.',
    BG_COLOUR_OFF: 'Page colour differs from the real app.',
    CARD_COLOUR_OFF: 'ID-card yellow differs from the real app (#FFB500): generators get the brand colour slightly wrong.',
    ODD_ASPECT: 'Full-height image whose shape matches no phone screen: cropped, stitched or generated.',
    ODD_WIDTH: 'Width matches no phone screen: resized or generated.',
    LOW_RES: 'Tiny image: a forwarded copy or thumbnail rather than a screenshot.',
    CHECKOUT_BEFORE_CHECKIN: 'Visit times run backwards: device clock changed.',
    OFF_HOURS: 'Sign-up at night: unusual for field registrations.',
    LATE_SUBMIT: 'Submitted long after capture: time to prepare/edit the image.',
    CAPTURED_IN_FUTURE: 'Photo time later than server receipt: device clock tampered.',
    PHOTO_BEFORE_CHECKIN: 'Photo existed before the agent arrived: pre-made image.',
    GPS_MISSING: 'No location fix: location services disabled to hide where the agent was.',
    GPS_OUTSIDE_SA: 'Location outside South Africa: spoofed.',
    GPS_ROUNDED: 'Coordinates too round for a real GPS fix: typed or spoofed.',
    GPS_TELEPORT: 'Faster than 150 km/h between check-ins: spoofed location.',
    AGE_IMPLAUSIBLE: 'Customer older than 90: invented ID.',
    ID_REPEATED_DIGITS: 'ID with long repeated digit runs: invented.',
    SEQUENTIAL_SA_ID: 'Customers whose SA IDs differ only in the last digits: generated from one template.',
    DOB_CLUSTER: 'Many customers of one agent share a birth date: generated IDs.',
    PHONE_INVALID: 'Not a valid SA mobile number.',
    PHONE_PATTERN: 'Keyboard or repeated-digit phone number: invented.',
    NAME_JUNK: 'Placeholder or junk customer name.',
    SELF_SIGNUP: 'Agent registered themselves as the customer.',
    GOLDRUSH_ID_FORMAT: 'Goldrush IDs are 9 digits.',
    OLD_GOLDRUSH_ACCOUNT: 'Account was created long before the visit: not a new sign-up.',
    DUPLICATE_GOLDRUSH_ID: 'One Goldrush account claimed on several check-ins.',
    DAILY_SPIKE: 'Agent did far more sign-ups than their normal day.',
    AGENT_HAS_FAKES: 'Agent already has 3+ confirmed fakes; their other check-ins are at higher risk.',
    GPS_REPEAT: 'Identical coordinates to 6 decimals on different days: GPS is spoofed or replayed.',
  };
  const ruleStats = new Map();
  for (const v of visits) for (const f of v.newFlags) {
    const s = ruleStats.get(f.code) || ruleStats.set(f.code, { levels: new Set(), vs: new Set() }).get(f.code);
    s.levels.add(f.level); s.vs.add(v);
  }
  for (const [c, s] of [...ruleStats].sort((a, b) => b[1].vs.size - a[1].vs.size)) {
    const vs = [...s.vs]; const l = lab(vs);
    lines.push(`| ${c} | ${[...s.levels].join('/')} | ${vs.length} | ${vs.filter(v => v.dbVerdict === 'pass').length} | ${l.fake} | ${l.genuine} | ${l.verified} | ${WHY[c] || ''} |`);
  }
  lines.push('', '"Cleared on review" and "Goldrush-verified" hits are the likely false positives: use them to set each rule\'s level before it goes live.', '');

  const drifts = visits.map(v => v.clockDrift).filter(x => x != null).sort((a, b) => a - b);
  if (drifts.length) lines.push('## Clock drift distribution', '', `n=${drifts.length}; median ${drifts[drifts.length >> 1]} min; p90 ${drifts[Math.floor(drifts.length * 0.9)]} min; >30 min: ${drifts.filter(d => d > 30).length}; >120 min: ${drifts.filter(d => d > 120).length}`, '');

  lines.push('## Agents with the most newly flagged check-ins', '', '| Agent | Check-ins | Before (likely+) | After (likely+) | Top new rules |', '|---|---:|---:|---:|---|');
  const agentRows = [...byAgent.values()].map(list => ({
    agent: list[0].agent || list[0].agent_id, total: list.length,
    before: list.filter(v => LEVEL[v.dbVerdict] >= 2).length, after: list.filter(v => LEVEL[v.after] >= 2).length,
    rules: Object.entries(list.flatMap(v => v.newFlags.map(f => f.code)).reduce((m, c) => ((m[c] = (m[c] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, k]) => `${c} ${k}`).join(', '),
  })).sort((a, b) => (b.after - b.before) - (a.after - a.before));
  for (const a of agentRows.slice(0, 25)) lines.push(`| ${a.agent} | ${a.total} | ${a.before} | ${a.after} | ${a.rules} |`);

  lines.push('', '## Examples newly caught (first 40)', '', '| Visit | Date | Agent | After | Reasons |', '|---|---|---|---|---|');
  for (const v of newlyCaught.slice(0, 40)) lines.push(`| ${v.visit_id} | ${v.visit_date} | ${v.agent} | ${v.after} | ${v.newFlags.map(f => f.detail).join('; ').replace(/\|/g, '/')} |`);

  fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n') + '\n');
  const csv = rows => rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
  fs.writeFileSync(path.join(OUT, 'flags.csv'), csv([['visit_id', 'visit_date', 'agent', 'goldrush_id', 'label', 'before', 'after', 'live_rules', 'new_rules', 'details'],
    ...visits.filter(v => v.after !== 'pass').map(v => [v.visit_id, v.visit_date, v.agent, v.goldrush_id, v.label, v.dbVerdict, v.after, v.dbCodes.join(' '), [...new Set(v.newFlags.map(f => f.code))].join(' '), v.newFlags.map(f => f.detail).join('; ')])]));
  fs.writeFileSync(path.join(OUT, 'agents.csv'), csv([['agent', 'checkins', 'before_likely_plus', 'after_likely_plus', 'top_new_rules'], ...agentRows.map(a => [a.agent, a.total, a.before, a.after, a.rules])]));
  console.error(`Done: ${path.join(OUT, 'report.md')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
