// Runs the Goldrush screenshot rule set (lib/imageFraud.js) against live uploads,
// keeps the status-bar history it needs, and records verdicts for the AI Check page.
//
// Definite fakes are excluded from every report that already honours
// capture_failures (NOT EXISTS ... goldrush_upload_failures), so a flagged check-in
// stops counting without touching each report query.
import {
  decodeJpeg, dataUrlToBytes, analyzeImage, evaluate, fingerprintSignature,
  fingerprintDistance, FP_MATCH_THRESHOLD, fpToBase64, idFrontier, FAKE_MESSAGE, RULESET_VERSION, fpFromBase64,
  normaliseClock, statusBarCropDataUrl,
} from '../lib/imageFraud.js';
import { ensureCaptureFailures } from '../lib/goldrush.js';

const HISTORY_DAYS = 90;
const FRONTIER_DAYS = 3;
const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
export const FAKE_CAPTURE_REASON = 'AI check: image detected as fake and fraudulent';

let converged = false;
export async function ensureImageFraudTables(db) {
  if (converged) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS image_fingerprints (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, visit_id TEXT, photo_id TEXT, agent_id TEXT,
      visit_date TEXT, captured_at TEXT, goldrush_id TEXT, sig TEXT NOT NULL, fp TEXT NOT NULL,
      verdict TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    'CREATE INDEX IF NOT EXISTS idx_image_fp_tenant_time ON image_fingerprints(tenant_id, captured_at)',
    'CREATE INDEX IF NOT EXISTS idx_image_fp_visit ON image_fingerprints(visit_id)',
    'ALTER TABLE image_fingerprints ADD COLUMN sb_clock TEXT',
    'ALTER TABLE image_fingerprints ADD COLUMN sb_battery TEXT',
    'CREATE INDEX IF NOT EXISTS idx_image_fp_clock ON image_fingerprints(tenant_id, sb_clock)',
    `CREATE TABLE IF NOT EXISTS image_fraud_flags (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, visit_id TEXT, photo_id TEXT, agent_id TEXT,
      agent_name TEXT, visit_date TEXT, goldrush_id TEXT, stage TEXT NOT NULL, verdict TEXT NOT NULL,
      flags TEXT, detail TEXT, excluded INTEGER DEFAULT 0, source TEXT DEFAULT 'ruleset', ruleset TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    'CREATE INDEX IF NOT EXISTS idx_image_flags_tenant_date ON image_fraud_flags(tenant_id, visit_date)',
    'CREATE INDEX IF NOT EXISTS idx_image_flags_visit ON image_fraud_flags(visit_id)',
    // Manual review on the AI Check page (source 'manual'): who decided.
    'ALTER TABLE image_fraud_flags ADD COLUMN reviewed_by TEXT',
    'ALTER TABLE image_fraud_flags ADD COLUMN reviewed_by_name TEXT',
  ];
  for (const s of stmts) {
    try { await db.prepare(s).run(); }
    catch (e) { if (!/duplicate column/i.test(e.message)) console.error('ensureImageFraudTables:', e.message); }
  }
  converged = true;
}

// Read the phone's status-bar clock and battery with the vision model. Pixel similarity
// alone cannot tell 13:52 from 16:54 on the same phone; the clock text can.
// Back-test: clock gate + pixel match caught 585/830 known reuses with 5 hits on
// golden-rated screenshots. Returns nulls when the model is unavailable — the reuse
// rule then simply doesn't fire.
export async function readStatusBar(env, img) {
  if (!env.AI) return { clock: null, battery: null };
  try {
    const res = await env.AI.run(VISION_MODEL, {
      messages: [
        { role: 'system', content: 'You read phone status bars. Reply with ONLY one JSON object, no prose.' },
        { role: 'user', content: [
          { type: 'text', text: 'This is the top strip of a phone screenshot. First decide whether it shows the phone status bar (a clock plus signal/battery icons) or something else such as a browser address bar. Then read the clock time and battery percentage. Reply exactly as {"status_bar":true,"time":"HH:MM","battery":"NN"}. If there is no status bar set status_bar to false and time and battery to null. Use null for anything not clearly readable. Never guess.' },
          { type: 'image_url', image_url: { url: statusBarCropDataUrl(img) } },
        ] },
      ],
      max_tokens: 60,
      temperature: 0,
    });
    const raw = res?.response ?? res?.result?.response ?? '';
    const obj = typeof raw === 'object' && raw ? raw : (() => { const t = String(raw); const a = t.indexOf('{'), b = t.lastIndexOf('}'); try { return a >= 0 ? JSON.parse(t.slice(a, b + 1)) : {}; } catch { return {}; } })();
    if (obj.status_bar === false || obj.status_bar === 'false') return { clock: null, battery: null };
    const bat = obj.battery == null ? null : String(obj.battery).replace(/\D/g, '');
    return { clock: normaliseClock(obj.time), battery: bat && Number(bat) <= 100 ? bat : null };
  } catch (e) {
    console.error('readStatusBar failed:', e.message || e);
    return { clock: null, battery: null };
  }
}

// Earlier check-ins whose status bar shows the same clock (and battery, when both are
// known) and whose strip is pixel-identical within FP_MATCH_THRESHOLD.
async function findStatusMatches(db, tenantId, fp, sb, nowIso) {
  if (!sb.clock) return [];
  const since = new Date(Date.parse(nowIso) - HISTORY_DAYS * 864e5).toISOString();
  const rows = await db.prepare(
    'SELECT id, visit_id, visit_date, captured_at, agent_id, fp, sb_battery FROM image_fingerprints WHERE tenant_id = ? AND sb_clock = ? AND captured_at >= ?'
  ).bind(tenantId, sb.clock, since).all();
  return (rows.results || []).filter(r =>
    (!sb.battery || !r.sb_battery || sb.battery === r.sb_battery)
    && fingerprintDistance(fp, fpFromBase64(r.fp)) < FP_MATCH_THRESHOLD);
}

async function recentIdFrontier(db, tenantId, nowIso) {
  const since = new Date(Date.parse(nowIso) - FRONTIER_DAYS * 864e5).toISOString();
  const rows = await db.prepare(
    'SELECT goldrush_id FROM image_fingerprints WHERE tenant_id = ? AND captured_at >= ? AND goldrush_id IS NOT NULL'
  ).bind(tenantId, since).all();
  return idFrontier((rows.results || []).map(r => r.goldrush_id));
}

// Analyse one Goldrush photo. Never throws: an analysis failure returns verdict 'error'
// so a broken image or decoder bug can never block an agent's capture.
export async function checkGoldrushPhoto(env, { tenantId, dataUrl, typedId = null, extractedId = null, nowIso = new Date().toISOString() }) {
  try {
    await ensureImageFraudTables(env.DB);
    const bytes = dataUrlToBytes(dataUrl);
    if (!bytes) return { verdict: 'error', flags: [], reason: 'not a data URL' };
    const img = decodeJpeg(bytes);
    const analysis = analyzeImage(img);
    const sig = fingerprintSignature(analysis.fingerprint);
    const sb = analysis.fullScreen && analysis.statusBarLike && analysis.fpContrast >= 40 ? await readStatusBar(env, img) : { clock: null, battery: null };
    const statusMatches = await findStatusMatches(env.DB, tenantId, analysis.fingerprint, sb, nowIso);
    const frontier = await recentIdFrontier(env.DB, tenantId, nowIso);
    const result = evaluate({ analysis, statusMatches, now: nowIso, typedId, extractedId, frontier });
    if (result.verdict === 'pass' && !analysis.layoutFound) result.verdict = 'unverifiable';
    return { ...result, analysis, sig, sb, statusMatches, message: result.isFake ? FAKE_MESSAGE : null };
  } catch (e) {
    console.error('checkGoldrushPhoto failed:', e);
    return { verdict: 'error', flags: [], reason: String(e.message || e) };
  }
}

export function publicFraudResult(check) {
  if (!check || check.verdict === 'error') return null;
  return {
    flagged: !!check.isFake,
    verdict: check.verdict,
    message: check.isFake ? FAKE_MESSAGE : null,
    reasons: (check.flags || []).map(f => f.detail),
    ruleset: RULESET_VERSION,
  };
}

async function agentInfo(db, agentId) {
  const a = await db.prepare('SELECT first_name, last_name, team_lead_id FROM users WHERE id = ?').bind(agentId).first();
  let tl = null;
  if (a?.team_lead_id) tl = await db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').bind(a.team_lead_id).first();
  return {
    agentName: a ? `${a.first_name || ''} ${a.last_name || ''}`.trim() : null,
    teamLeadId: a?.team_lead_id || null,
    teamLeadName: tl ? `${tl.first_name || ''} ${tl.last_name || ''}`.trim() : null,
  };
}

// Exclude a visit from report totals (idempotent).
export async function excludeVisit(db, { tenantId, visitId, companyId = null, agentId, visitDate, goldrushId = null, reason }) {
  await ensureCaptureFailures(db);
  const already = await db.prepare(
    'SELECT 1 FROM capture_failures WHERE visit_id = ? AND error_photo_mismatch LIKE ? LIMIT 1'
  ).bind(visitId, 'AI check:%').first();
  if (already) return;
  const info = await agentInfo(db, agentId);
  await db.prepare(
    'INSERT INTO capture_failures (id, tenant_id, company_id, agent_id, agent_name, team_lead_id, team_lead_name, identifier_value, error_photo_mismatch, visit_id, visit_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime("now"))'
  ).bind(crypto.randomUUID(), tenantId, companyId, agentId, info.agentName, info.teamLeadId, info.teamLeadName,
    goldrushId, reason, visitId, visitDate).run();
}

export async function recordFlag(db, { tenantId, visitId = null, photoId = null, agentId, visitDate, goldrushId = null, stage, check, source = 'ruleset' }) {
  const info = await agentInfo(db, agentId);
  await db.prepare(
    'INSERT INTO image_fraud_flags (id, tenant_id, visit_id, photo_id, agent_id, agent_name, visit_date, goldrush_id, stage, verdict, flags, detail, excluded, source, ruleset) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(crypto.randomUUID(), tenantId, visitId, photoId, agentId, info.agentName, visitDate, goldrushId, stage, check.verdict,
    JSON.stringify((check.flags || []).map(f => f.code)), (check.flags || []).map(f => f.detail).join(' | ') || null,
    check.verdict === 'definite' && visitId ? 1 : 0, source, RULESET_VERSION).run();
}

// After the visit and photo rows exist: store the fingerprint, record the verdict,
// exclude a definite fake, and — when this upload completes a frozen-status-bar group —
// flag the earlier check-ins in that group too.
//
// A blocked upload (definite fake rejected before save) passes visitId null and stage
// 'blocked': no visit to exclude, but the fingerprint still feeds the frozen-status-bar
// history and earlier check-ins sharing the strip are still flagged.
export async function persistGoldrushCheck(env, { tenantId, visitId, photoId, agentId, companyId, visitDate, goldrushId, nowIso, check, stage = 'upload' }) {
  if (!check || check.verdict === 'error') return;
  const db = env.DB;
  try {
    await db.prepare(
      'INSERT INTO image_fingerprints (id, tenant_id, visit_id, photo_id, agent_id, visit_date, captured_at, goldrush_id, sig, fp, verdict, sb_clock, sb_battery) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(crypto.randomUUID(), tenantId, visitId, photoId, agentId, visitDate, nowIso, goldrushId,
      fpToBase64(check.sig), fpToBase64(check.analysis.fingerprint), check.verdict,
      check.sb?.clock || null, check.sb?.battery || null).run();
    if (check.verdict !== 'pass') await recordFlag(db, { tenantId, visitId, photoId, agentId, visitDate, goldrushId, stage, check });
    if (check.isFake && visitId) {
      await excludeVisit(db, { tenantId, visitId, companyId, agentId, visitDate, goldrushId, reason: `${FAKE_CAPTURE_REASON}: ${check.flags.filter(f => f.level === 'definite').map(f => f.code).join(', ')}` });
    }
    if (check.flags.some(f => f.code === 'REUSED_STATUS_BAR')) {
      for (const m of check.statusMatches) {
        if (!m.visit_id) continue;
        const flagged = await db.prepare("SELECT 1 FROM image_fraud_flags WHERE visit_id = ? AND (verdict = 'definite' OR source = 'manual') LIMIT 1").bind(m.visit_id).first();
        if (flagged) continue;
        const prior = { verdict: 'definite', flags: [{ code: 'REUSED_STATUS_BAR', level: 'definite', detail: visitId ? `Phone status bar identical to later check-in ${visitId}` : 'Phone status bar identical to a later upload that was blocked as fake' }] };
        await recordFlag(db, { tenantId, visitId: m.visit_id, agentId: m.agent_id, visitDate: m.visit_date, stage: 'retro', check: prior });
        await excludeVisit(db, { tenantId, visitId: m.visit_id, companyId, agentId: m.agent_id, visitDate: m.visit_date, reason: `${FAKE_CAPTURE_REASON}: REUSED_STATUS_BAR` });
        await db.prepare("UPDATE image_fingerprints SET verdict = 'definite' WHERE visit_id = ?").bind(m.visit_id).run();
      }
    }
  } catch (e) {
    console.error('persistGoldrushCheck failed:', e);
  }
}
