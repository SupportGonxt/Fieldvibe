// Goldrush check-in screenshot fraud rules.
//
// Pure pixel analysis — no OCR, no AI model — so the same code runs in the Worker
// at upload time and in Node for back-testing against the historic corpus.
//
// The reference ("golden") screenshot is the Goldrush profile page as Chrome on
// Android renders it: neutral grey page #414141, yellow #FFB500 ID card, Roboto in
// regular weight, balance shown as a small "R", a gap, then a large "0".
//
// Rules (see docs/goldrush-ai-scan-2026-10-06 for the evidence behind each):
//   definite  REUSED_STATUS_BAR  same phone status bar (clock, battery, icons) on 3+
//                                check-ins on different days / >15 min apart
//             GREEN_THEME        green page — Goldrush has no green theme
//             FUTURE_ID          the ID shown in the photo had not been issued yet
//   likely    FONT_MISMATCH      3+ of 5 typography checks fail vs golden
//             THEME_COLOUR       navy/teal-black or black page plus 2 typography fails
//   review    FONT_DEVIATION     2 typography fails
//             FUTURE_ID_ENTERED  typed ID beyond issued range, photo ID differs (typo?)
import jpeg from 'jpeg-js';
import { Buffer as NodeBuffer } from 'node:buffer';

// jpeg-js's encoder (status-bar crop) uses the global Buffer, which the Worker runtime
// only exposes as a node:buffer import under this compatibility date.
if (typeof globalThis.Buffer === 'undefined') globalThis.Buffer = NodeBuffer;

export const RULESET_VERSION = '2026-10-06.1';

export const FAKE_MESSAGE = 'This image has been detected as fake and fraudulent. You have been flagged.';

// Status-bar fingerprint geometry: strip height tied to width (status bar has a
// fixed CSS height), downsampled to FP_W x FP_H grey levels.
export const FP_W = 240;
export const FP_H = 18;
const FP_BLOCKS = 24;
// worst 10-px column block mean abs diff below this = same status bar
export const FP_MATCH_THRESHOLD = 12;

// Calibrated on the 9,799-photo back-test (Jul–Oct 2026): golden-rated screenshots vs the
// confirmed fakes. 3+ fails: 428/701 fakes, 13/5,305 golden. 4+ fails: 238 fakes, 0 golden.
export const THRESHOLDS = {
  r0Gap: 0.20,        // golden median 0.29 — below = "R0" collapsed
  r0Ratio: 0.70,      // golden median 0.60 — above = currency R too large
  labelStroke: 0.19,  // golden median 0.169 (accent-mask stroke)
  nameStroke: 0.14,   // golden median 0.118, fakes 0.159
  r0HeightRel: 1.80,  // golden median 1.63, fakes 2.0
};

// Status-bar fingerprints are only meaningful on a full-screen screenshot.
export const MIN_SCREEN_RATIO = 1.6;

// "9:27", "09:27", "09.27" -> "9:27"
export function normaliseClock(t) {
  const m = /(\d{1,2})[:.](\d{2})/.exec(String(t || ''));
  if (!m || Number(m[1]) > 23) return null;
  return `${Number(m[1])}:${m[2]}`;
}

// Top strip of the screenshot as a small JPEG data URL, for reading the clock.
export function statusBarCropDataUrl(img) {
  const { width: W, height: H, data } = img;
  const sh = Math.max(10, Math.min(H, Math.round(W * 0.075)));
  const enc = jpeg.encode({ data: data.subarray(0, W * sh * 4), width: W, height: sh }, 85);
  let bin = '';
  for (let i = 0; i < enc.data.length; i++) bin += String.fromCharCode(enc.data[i]);
  return 'data:image/jpeg;base64,' + btoa(bin);
}

export function decodeJpeg(bytes) {
  return jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 40, maxMemoryUsageInMB: 512 });
}

export function dataUrlToBytes(dataUrl) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || '');
  if (!m) return null;
  const bin = atob(m[3]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- helpers ----------
const lumAt = (d, i) => (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
// yellow/orange UI text and fills (golden yellow, orange-yellow); excludes white/grey
const isAccent = (r, g, b) => r > 140 && r - b > 80 && g > 70 && g < r + 10;

export function statusBarFingerprint(img) {
  const { width: W, height: H, data } = img;
  const sh = Math.max(10, Math.min(H, Math.round(W * 0.075)));
  const fp = new Uint8Array(FP_W * FP_H);
  for (let fy = 0; fy < FP_H; fy++) {
    const y0 = Math.floor(fy * sh / FP_H), y1 = Math.max(y0 + 1, Math.floor((fy + 1) * sh / FP_H));
    for (let fx = 0; fx < FP_W; fx++) {
      const x0 = Math.floor(fx * W / FP_W), x1 = Math.max(x0 + 1, Math.floor((fx + 1) * W / FP_W));
      let s = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += lumAt(data, (y * W + x) * 4); n++; }
      fp[fy * FP_W + fx] = Math.round(s / n);
    }
  }
  return fp;
}

export function fingerprintDistance(a, b) {
  const bw = FP_W / FP_BLOCKS;
  let worst = 0;
  for (let bx = 0; bx < FP_BLOCKS; bx++) {
    let s = 0;
    for (let y = 0; y < FP_H; y++) for (let x = bx * bw; x < (bx + 1) * bw; x++) s += Math.abs(a[y * FP_W + x] - b[y * FP_W + x]);
    const m = s / (bw * FP_H);
    if (m > worst) worst = m;
  }
  return worst;
}

// 24 column-block means. |mean(a)-mean(b)| <= mean|a-b| per block, so a block-mean
// gap >= FP_MATCH_THRESHOLD proves two fingerprints cannot match: an exact, cheap
// prefilter before the full comparison.
export function fingerprintSignature(fp) {
  const bw = FP_W / FP_BLOCKS, sig = new Uint8Array(FP_BLOCKS);
  for (let bx = 0; bx < FP_BLOCKS; bx++) {
    let s = 0;
    for (let y = 0; y < FP_H; y++) for (let x = bx * bw; x < (bx + 1) * bw; x++) s += fp[y * FP_W + x];
    sig[bx] = Math.round(s / (bw * FP_H));
  }
  return sig;
}

export function signatureMayMatch(a, b, threshold = FP_MATCH_THRESHOLD) {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) >= threshold + 1) return false; // +1 absorbs rounding
  return true;
}

// how "busy" the strip is; a blank strip (status bar cropped off) carries no clock
export function fingerprintContrast(fp) {
  let mn = 255, mx = 0;
  for (const v of fp) { if (v < mn) mn = v; if (v > mx) mx = v; }
  return mx - mn;
}

// Share of the strip's centre band that differs from its background. A phone status bar
// has an empty middle (clock left, icons right); a browser URL bar left at the top of a
// cropped screenshot fills it. Back-test: genuine status bars 0.00 median, URL-bar crops
// 0.53 — without this the vision model "reads" a clock (12:00, 100%) that is not there.
export const STATUS_BAR_CENTRE_MAX = 0.15;
export function centreFill(fp) {
  const edge = [];
  for (let y = 0; y < FP_H; y++) for (const x of [0, 1, 2, FP_W - 3, FP_W - 2, FP_W - 1]) edge.push(fp[y * FP_W + x]);
  edge.sort((a, b) => a - b);
  const bg = edge[edge.length >> 1];
  let n = 0, k = 0;
  for (let y = Math.floor(FP_H * 0.2); y < Math.ceil(FP_H * 0.8); y++) {
    for (let x = Math.floor(FP_W * 0.38); x < Math.ceil(FP_W * 0.62); x++) { n++; if (Math.abs(fp[y * FP_W + x] - bg) > 18) k++; }
  }
  return k / n;
}

// Share of strong ink in the clock zone (left of the strip). A status bar has clock
// digits there; a light browser URL bar left after cropping has only a faint pill edge.
export const CLOCK_INK_MIN = 0.03;
export function clockInk(fp) {
  const edge = [];
  for (let y = 0; y < FP_H; y++) for (const x of [0, 1, 2, FP_W - 3, FP_W - 2, FP_W - 1]) edge.push(fp[y * FP_W + x]);
  edge.sort((a, b) => a - b);
  const bg = edge[edge.length >> 1];
  let n = 0, k = 0;
  for (let y = Math.floor(FP_H * 0.2); y < Math.ceil(FP_H * 0.8); y++) {
    for (let x = Math.floor(FP_W * 0.04); x < Math.ceil(FP_W * 0.28); x++) { n++; if (Math.abs(fp[y * FP_W + x] - bg) > 60) k++; }
  }
  return k / n;
}

export const fpToBase64 = (fp) => { let s = ''; for (const v of fp) s += String.fromCharCode(v); return btoa(s); };
export const fpFromBase64 = (b64) => { const s = atob(b64); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };

function median3(arr) {
  const r = arr.map(p => p[0]).sort((a, b) => a - b), g = arr.map(p => p[1]).sort((a, b) => a - b), b = arr.map(p => p[2]).sort((a, b) => a - b);
  const m = arr.length >> 1;
  return [r[m], g[m], b[m]];
}

export function bgClass(c) {
  if (!c) return null;
  const [r, g, b] = c; const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (g - r > 15 && g >= b) return 'green';
  if (mn > 170) return 'light';
  if (b - r >= 6) return 'navy/teal-black';
  if (mx < 22) return 'black';
  if (r >= 55 && r <= 76 && mx - mn < 8) return 'golden grey';
  if (mx - mn < 10) return r < 55 ? 'darker grey' : 'lighter grey';
  return 'other tint';
}

// dominant colour of the page body (quantised), used as a second green test
function dominantBody(img) {
  const { width: W, height: H, data } = img;
  const counts = new Map();
  const step = Math.max(1, Math.floor(W / 120));
  for (let y = Math.floor(H * 0.1); y < Math.floor(H * 0.85); y += step) {
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      const k = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  let best = 0, bk = 0;
  for (const [k, n] of counts) if (n > best) { best = n; bk = k; }
  return [((bk >> 10) & 31) * 8 + 4, ((bk >> 5) & 31) * 8 + 4, (bk & 31) * 8 + 4];
}

// ---------- layout + typography ----------
// Rows of accent ink below the yellow ID card, grouped into text lines.
function findLayout(img) {
  const { width: W, height: H, data } = img;
  const rowFrac = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (isAccent(data[i], data[i + 1], data[i + 2])) n++; }
    rowFrac[y] = n / W;
  }
  // ID card: first run of >=8 rows with >55% accent in the top 45% of the page
  let cardTop = -1, cardBot = -1;
  for (let y = 0; y < H * 0.45; y++) {
    if (rowFrac[y] > 0.55) {
      let e = y; while (e < H && rowFrac[e] > 0.55) e++;
      if (e - y >= 8) { cardTop = y; cardBot = e; break; }
      y = e;
    }
  }
  if (cardTop < 0) return null;
  // text lines between card bottom and the first wide filled button (Deposit)
  const lines = [];
  let y = cardBot;
  const limit = Math.min(H, cardBot + Math.round(W * 1.4));
  while (y < limit) {
    if (rowFrac[y] > 0.45) break; // Deposit button
    if (rowFrac[y] > 0.003) {
      let e = y, gap = 0;
      while (e < limit && rowFrac[e] <= 0.45 && (rowFrac[e] > 0.003 || gap < 2)) { gap = rowFrac[e] > 0.003 ? 0 : gap + 1; e++; }
      const y1 = e - gap;
      // x extent of accent ink in this band
      let x0 = W, x1 = -1;
      for (let yy = y; yy < y1; yy++) for (let x = 0; x < W; x++) {
        const i = (yy * W + x) * 4; if (isAccent(data[i], data[i + 1], data[i + 2])) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      }
      if (y1 - y >= 4 && x1 > x0) lines.push({ y0: y, y1, x0, x1 });
      y = e;
    } else y++;
  }
  return { cardTop, cardBot, lines };
}

function inkStats(img, box) {
  // stroke width estimate 2*area/perimeter over accent ink, normalised by glyph height
  const { width: W, data } = img;
  const { y0, y1, x0, x1 } = box;
  const w = x1 - x0 + 1, h = y1 - y0;
  if (w < 3 || h < 3) return null;
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y0 + y) * W + (x0 + x)) * 4; ink[y * w + x] = isAccent(data[i], data[i + 1], data[i + 2]) ? 1 : 0;
  }
  let area = 0, per = 0, top = h, bot = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!ink[y * w + x]) continue;
    area++; if (y < top) top = y; if (y > bot) bot = y;
    const nb = (y > 0 ? ink[(y - 1) * w + x] : 0) & (y < h - 1 ? ink[(y + 1) * w + x] : 0) & (x > 0 ? ink[y * w + x - 1] : 0) & (x < w - 1 ? ink[y * w + x + 1] : 0);
    if (!nb) per++;
  }
  if (area < 10) return null;
  const gh = bot - top + 1;
  return { sw: 2 * area / Math.max(per, 1), swn: (2 * area / Math.max(per, 1)) / gh, gh };
}

function r0Stats(img, box) {
  const { width: W, data } = img;
  const { y0, y1, x0 } = box;
  const x1 = Math.min(box.x1, Math.floor(W * 0.6));
  const cols = [];
  for (let x = x0; x <= x1; x++) {
    let top = -1, bot = -1;
    for (let y = y0; y < y1; y++) { const i = (y * W + x) * 4; if (isAccent(data[i], data[i + 1], data[i + 2])) { if (top < 0) top = y; bot = y; } }
    cols.push(top < 0 ? null : [top, bot]);
  }
  const runs = []; let s = -1;
  for (let i = 0; i <= cols.length; i++) {
    const on = i < cols.length && cols[i];
    if (on && s < 0) s = i;
    if (!on && s >= 0) { runs.push([s, i]); s = -1; }
  }
  if (runs.length < 2) return null;
  const span = ([a, b]) => { let t = 1e9, bt = -1; for (let i = a; i < b; i++) if (cols[i]) { t = Math.min(t, cols[i][0]); bt = Math.max(bt, cols[i][1]); } return bt - t + 1; };
  const R = runs[0], Z = runs[1];
  const zh = span(Z);
  return { r_over_0: span(R) / zh, gap_over_0: (Z[0] - R[1]) / zh, zh };
}

export function typography(img, layout) {
  const L = layout === undefined ? findLayout(img) : layout;
  if (!L) return { found: false, reason: 'no ID card' };
  const W = img.width;
  const left = L.lines.filter(l => l.x0 < W * 0.22);
  const ai = L.lines.indexOf(left[0]);
  if (!left.length || left.length < 2) return { found: false, reason: 'labels not found' };
  const ab = left[0], r0 = left[1];
  const abBox = { ...ab, x1: Math.min(ab.x1, Math.floor(W * 0.7)) };
  const centred = L.lines.slice(0, ai).filter(l => Math.abs((l.x0 + l.x1) / 2 - W / 2) < W * 0.1 && l.x0 > W * 0.12);
  const name = centred.length ? centred[centred.length - 1] : null;
  const out = { found: true, ab: inkStats(img, abBox), r0: r0Stats(img, r0), name: name ? inkStats(img, name) : null };
  out.r0HeightRel = out.ab && out.r0 ? out.r0.zh / out.ab.gh : null;
  return out;
}

// left-margin page background beside the balance cards
function pageBackground(img, y) {
  const { width: W, height: H, data } = img;
  const xs = Math.max(2, Math.floor(W * 0.012));
  const px = [];
  for (let yy = Math.max(0, y); yy < Math.min(H, y + Math.round(W * 0.12)); yy += 2) for (let x = 1; x <= xs; x++) { const i = (yy * W + x) * 4; px.push([data[i], data[i + 1], data[i + 2]]); }
  return px.length ? median3(px) : null;
}

export function typographyIndicators(t, th = THRESHOLDS) {
  const ind = [];
  if (!t || !t.found) return ind;
  if (t.r0 && t.r0.gap_over_0 < th.r0Gap) ind.push({ code: 'R0_SPACING', detail: `'R 0' spacing collapsed (gap ${t.r0.gap_over_0.toFixed(2)} vs golden 0.30)` });
  if (t.r0 && t.r0.r_over_0 > th.r0Ratio) ind.push({ code: 'R_SIZE', detail: `currency R too large (${t.r0.r_over_0.toFixed(2)} vs golden 0.61)` });
  if (t.ab && t.ab.swn > th.labelStroke) ind.push({ code: 'LABEL_WEIGHT', detail: `label font too heavy (stroke ${t.ab.swn.toFixed(3)})` });
  if (t.name && t.name.swn > th.nameStroke) ind.push({ code: 'NAME_WEIGHT', detail: `customer name rendered bold (stroke ${t.name.swn.toFixed(3)})` });
  if (t.r0HeightRel != null && t.r0HeightRel > th.r0HeightRel) ind.push({ code: 'DIGIT_SIZE', detail: `balance digits oversized (${t.r0HeightRel.toFixed(2)}x label vs golden 1.57x)` });
  return ind;
}

// Everything that can be said about one image on its own.
export function analyzeImage(img) {
  const lay = findLayout(img);
  const t = typography(img, lay);
  const fp = statusBarFingerprint(img);
  // background beside the first balance card (fallback: 45% down the page)
  let bgY = Math.floor(img.height * 0.45);
  if (lay) { const l = lay.lines.find(x => x.x0 < img.width * 0.22); if (l) bgY = l.y0; }
  const bg = pageBackground(img, bgY);
  const dom = dominantBody(img);
  return {
    width: img.width, height: img.height, fullScreen: img.height / img.width >= MIN_SCREEN_RATIO,
    fingerprint: fp, fpContrast: fingerprintContrast(fp), statusBarLike: centreFill(fp) < STATUS_BAR_CENTRE_MAX && clockInk(fp) >= CLOCK_INK_MIN,
    bg, bgClass: bgClass(bg), dominant: dom,
    green: bgClass(bg) === 'green' || (dom[1] - dom[0] > 20 && dom[1] >= dom[2]),
    typography: t, indicators: typographyIndicators(t),
    layoutFound: !!lay,
  };
}

// Highest Goldrush ID plausibly issued by now: p90 of recent (unflagged) IDs.
// Highest Goldrush ID plausibly issued by now: 95th percentile of every ID captured in
// the last few days (all check-ins, flagged or not — excluding flagged ones made the
// estimate stall and flag genuine IDs). The FUTURE_ID margin sits on top of this.
export const FUTURE_ID_MARGIN = 20_000_000;
export function idFrontier(recentIds) {
  const v = recentIds.map(Number).filter(n => n >= 100000000 && n <= 999999999).sort((a, b) => a - b);
  if (v.length < 8) return null;
  return v[Math.ceil(v.length * 0.95) - 1];
}

// statusMatches: earlier check-ins whose fingerprint matched [{visit_date, captured_at, visit_id}]
export function evaluate({ analysis, statusMatches = [], now = new Date().toISOString(), typedId = null, extractedId = null, frontier = null }) {
  const flags = [];
  const a = analysis;
  if (a && a.green) flags.push({ code: 'GREEN_THEME', level: 'definite', detail: 'Page background is green; Goldrush has no green theme' });
  if (a && a.fullScreen && a.statusBarLike !== false && a.fpContrast >= 40 && statusMatches.length >= 2) {
    const dates = new Set([now.slice(0, 10), ...statusMatches.map(m => (m.visit_date || m.captured_at || '').slice(0, 10))]);
    const mins = [now, ...statusMatches.map(m => m.captured_at)].filter(Boolean).map(t => Date.parse(t)).filter(Number.isFinite);
    const spread = mins.length ? (Math.max(...mins) - Math.min(...mins)) / 60000 : 0;
    if (dates.size >= 2 || spread > 15) flags.push({ code: 'REUSED_STATUS_BAR', level: 'definite', detail: `Phone status bar identical to ${statusMatches.length} earlier check-in(s); a real phone clock cannot stand still` });
  }
  const tid = typedId && /^\d{9}$/.test(String(typedId)) ? Number(typedId) : null;
  if (tid && frontier && tid > frontier + FUTURE_ID_MARGIN) {
    if (extractedId && String(extractedId) === String(typedId)) flags.push({ code: 'FUTURE_ID', level: 'definite', detail: `Goldrush ID ${typedId} shown in the photo had not been issued yet (current ~${frontier})` });
    else flags.push({ code: 'FUTURE_ID_ENTERED', level: 'review', detail: `Goldrush ID ${typedId} is beyond the IDs issued so far (~${frontier}); check for a typo` });
  }
  const ind = a ? a.indicators : [];
  if (ind.length >= 4) flags.push({ code: 'FONT_MISMATCH', level: 'definite', detail: ind.map(i => i.detail).join('; ') });
  else if (ind.length === 3) flags.push({ code: 'FONT_MISMATCH', level: 'likely', detail: ind.map(i => i.detail).join('; ') });
  else if (ind.length === 2 && a && (a.bgClass === 'navy/teal-black' || a.bgClass === 'black')) flags.push({ code: 'THEME_COLOUR', level: 'likely', detail: `page background ${a.bgClass} (golden is grey #414141) plus ${ind.map(i => i.detail).join('; ')}` });
  else if (ind.length === 2) flags.push({ code: 'FONT_DEVIATION', level: 'review', detail: ind.map(i => i.detail).join('; ') });
  const order = { definite: 3, likely: 2, review: 1 };
  const verdict = flags.reduce((best, f) => (order[f.level] > (order[best] || 0) ? f.level : best), 'pass');
  return { verdict, flags, isFake: verdict === 'definite', ruleset: RULESET_VERSION };
}
