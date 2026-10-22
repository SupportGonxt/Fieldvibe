#!/usr/bin/env node
// Goldrush fake-photo back-test: current rule set ("before") vs candidate rules ("after")
// over the last N days of Goldrush individual check-ins. READ-ONLY: SELECTs and R2 gets.
//
//   cd workers-api && npx wrangler login      # or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
//   node scripts/goldrush-fraud-backtest.mjs --days 31 --out ../../goldrush-backtest
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

// ---------- main ----------
const LEVEL = { definite: 3, likely: 2, review: 1, pass: 0 };
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
    v.label = manual ? (manual.verdict === 'definite' ? 'fake' : 'genuine') : (v.verification === 'qualified' ? 'verified' : null);
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
    v.replay = evaluate({ analysis: v.analysis, statusMatches, now, typedId: v.goldrush_id, extractedId: null, frontier: idFrontier(recent) });
  }

  // ---- candidate rules ----
  const add = (v, code, level, detail) => v.newFlags.push({ code, level, detail });

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
  }

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
      const d = worstCellDiff(a.thumb, b.thumb);
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
