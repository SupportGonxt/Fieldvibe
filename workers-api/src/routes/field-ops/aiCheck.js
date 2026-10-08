/**
 * AI Check — Goldrush screenshot fraud statistics for the GM and admins.
 *
 * Every Goldrush individual check-in in the period gets one verdict: the most severe
 * row in image_fraud_flags (upload-time rule set, retroactive status-bar matches, or the
 * historic scan backfill). No row = the screenshot matched the golden reference.
 * A manual review (source 'manual', made with the Review button) overrides the rules:
 * the latest review decides whether the check-in is a fake or genuine.
 * Definite fakes are excluded from all other reports via capture_failures; this page is
 * the one place they are still counted.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { ensureImageFraudTables, excludeVisit, FAKE_CAPTURE_REASON } from '../../services/imageFraudService.js';
import { ensureCaptureFailures } from '../../lib/goldrush.js';
import { rewriteR2Url } from '../../lib/photoAi.js';

const app = new Hono();

export const VERDICT_ORDER = ['definite', 'likely', 'review', 'unverifiable', 'not_profile', 'pass'];
const RANK = Object.fromEntries(VERDICT_ORDER.map((v, i) => [v, VERDICT_ORDER.length - i]));

export function worstVerdict(verdicts) {
  let best = 'pass';
  for (const v of verdicts) if ((RANK[v] || 0) > RANK[best]) best = v;
  return best;
}

const latestManual = flags => flags.filter(f => f.source === 'manual')
  .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;

// Verdict for one check-in: the latest manual review if there is one, else the worst rule verdict.
export function visitVerdict(flags) {
  const manual = latestManual(flags);
  return manual ? manual.verdict : worstVerdict(flags.map(f => f.verdict));
}

export function tally(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, { key: k, total: 0, definite: 0, likely: 0, review: 0, unverifiable: 0, not_profile: 0, pass: 0 });
    const t = m.get(k); t.total++; t[r.verdict]++;
  }
  return [...m.values()].map(t => ({
    ...t,
    counted: t.total - t.definite,
    flagged_pct: t.total ? Math.round(1000 * (t.definite + t.likely) / t.total) / 10 : 0,
  }));
}

app.get('/ai-check/summary', requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  await ensureImageFraudTables(db);
  const end = c.req.query('end') || new Date().toISOString().slice(0, 10);
  const start = c.req.query('start') || new Date(Date.parse(end) - 90 * 864e5).toISOString().slice(0, 10);

  const visits = await db.prepare(`
    SELECT v.id, v.visit_date, v.agent_id, TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS agent
    FROM visits v LEFT JOIN users u ON u.id = v.agent_id
    WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ?
      AND v.agent_id NOT LIKE 'agent-test-%'
      AND (EXISTS (SELECT 1 FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.photo_type = 'goldrush_individual')
        -- July check-ins predate the goldrush_individual tag; count any visit the AI check analysed
        OR EXISTS (SELECT 1 FROM image_fingerprints fp WHERE fp.visit_id = v.id))
  `).bind(tenantId, start, end).all();
  const flags = await db.prepare(`
    SELECT f.visit_id, f.verdict, f.flags, f.detail, f.stage, f.source, f.goldrush_id, f.created_at, f.reviewed_by_name
    FROM image_fraud_flags f
    WHERE f.tenant_id = ? AND f.visit_id IS NOT NULL AND f.visit_date BETWEEN ? AND ?
  `).bind(tenantId, start, end).all();
  const byVisit = new Map();
  for (const f of (flags.results || [])) {
    if (!byVisit.has(f.visit_id)) byVisit.set(f.visit_id, []);
    byVisit.get(f.visit_id).push(f);
  }
  const rows = (visits.results || []).map(v => {
    const fl = byVisit.get(v.id) || [];
    return { ...v, agent: v.agent || 'Unknown', verdict: visitVerdict(fl), fl };
  });

  const codes = {};
  for (const r of rows) {
    const seen = new Set();
    for (const f of r.fl) { let arr = []; try { arr = JSON.parse(f.flags || '[]'); } catch { /* legacy row */ } arr.forEach(x => seen.add(x)); }
    seen.forEach(x => { codes[x] = (codes[x] || 0) + 1; });
  }

  const attempts = await db.prepare(`
    SELECT agent_id, agent_name, COUNT(*) AS n FROM image_fraud_flags
    WHERE tenant_id = ? AND stage IN ('precheck', 'blocked') AND verdict = 'definite' AND visit_date BETWEEN ? AND ?
    GROUP BY agent_id, agent_name ORDER BY n DESC
  `).bind(tenantId, start, end).all();

  // Most recent definite / likely check-ins with their photo, for spot checks — plus any
  // the rules flagged that were since cleared on review, so the decision stays visible.
  const ruleVerdict = r => worstVerdict(r.fl.filter(f => f.source !== 'manual').map(f => f.verdict));
  const flaggedIds = rows.filter(r => r.verdict === 'definite' || r.verdict === 'likely' || ruleVerdict(r) === 'definite' || ruleVerdict(r) === 'likely')
    .sort((a, b) => b.visit_date.localeCompare(a.visit_date)).slice(0, 200);
  const photos = new Map();
  for (let i = 0; i < flaggedIds.length; i += 50) {
    const chunk = flaggedIds.slice(i, i + 50).map(r => r.id);
    const ph = await db.prepare(
      `SELECT visit_id, r2_key FROM visit_photos WHERE photo_type IN ('goldrush_individual', 'general') AND visit_id IN (${chunk.map(() => '?').join(',')})`
    ).bind(...chunk).all();
    for (const p of (ph.results || [])) photos.set(p.visit_id, p.r2_key && !p.r2_key.startsWith('data:') ? rewriteR2Url('/api/uploads/' + p.r2_key, c.req.url) : null);
  }
  const recent = flaggedIds.map(r => ({
    visit_id: r.id, visit_date: r.visit_date, agent: r.agent, verdict: r.verdict,
    goldrush_id: r.fl.find(f => f.goldrush_id)?.goldrush_id || null,
    reasons: [...new Set(r.fl.filter(f => f.source !== 'manual').map(f => f.detail).filter(Boolean))].join(' | '),
    rule_verdict: ruleVerdict(r),
    review: (m => (m ? { decision: m.verdict === 'definite' ? 'fake' : 'genuine', by: m.reviewed_by_name || null, at: m.created_at, detail: m.detail || null } : null))(latestManual(r.fl)),
    source: [...new Set(r.fl.map(f => f.source))].join(', '),
    photo_url: photos.get(r.id) || null,
  }));

  const totals = tally(rows, () => 'all')[0] || { total: 0, definite: 0, likely: 0, review: 0, unverifiable: 0, not_profile: 0, pass: 0, counted: 0, flagged_pct: 0 };
  return c.json({
    success: true,
    period: { start, end },
    totals,
    by_agent: tally(rows, r => r.agent).sort((a, b) => b.flagged_pct - a.flagged_pct || b.total - a.total),
    by_month: tally(rows, r => r.visit_date.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key)),
    flag_counts: codes,
    precheck_attempts: attempts.results || [],
    recent,
  });
});

// Review button: a GM/admin confirms a flagged check-in as fake (excluded from every
// report) or clears it as genuine (counted again). Recorded as a manual flag row, which
// overrides the rule verdict on this page.
app.post('/ai-check/review', requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { visit_id: visitId, decision, note } = await c.req.json().catch(() => ({}));
  if (!visitId || !['fake', 'genuine'].includes(decision)) {
    return c.json({ success: false, message: "visit_id and decision ('fake' or 'genuine') are required" }, 400);
  }
  await ensureImageFraudTables(db);
  await ensureCaptureFailures(db);
  const visit = await db.prepare('SELECT id, agent_id, company_id, visit_date FROM visits WHERE id = ? AND tenant_id = ?').bind(visitId, tenantId).first();
  if (!visit) return c.json({ success: false, message: 'Visit not found' }, 404);

  const nameOf = async id => {
    const u = id ? await db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').bind(id).first() : null;
    return u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : null;
  };
  const reviewerName = await nameOf(userId);
  const prior = await db.prepare('SELECT goldrush_id FROM image_fraud_flags WHERE visit_id = ? AND goldrush_id IS NOT NULL LIMIT 1').bind(visitId).first();
  const goldrushId = prior?.goldrush_id || null;
  const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null;
  const fake = decision === 'fake';
  const detail = `${fake ? 'Confirmed fake' : 'Cleared as genuine'} on review by ${reviewerName || 'unknown'}${cleanNote ? `: ${cleanNote}` : ''}`;

  if (fake) {
    await excludeVisit(db, { tenantId, visitId, companyId: visit.company_id, agentId: visit.agent_id, visitDate: visit.visit_date, goldrushId, reason: `${FAKE_CAPTURE_REASON}: MANUAL_REVIEW` });
  } else {
    // Drop only the AI-check reason. A row that also carries other validation errors
    // stays, so the check-in remains excluded for those.
    await db.prepare(
      "DELETE FROM capture_failures WHERE visit_id = ? AND error_photo_mismatch LIKE 'AI check:%' AND error_id_number IS NULL AND error_goldrush_id IS NULL AND error_no_btag IS NULL"
    ).bind(visitId).run();
    await db.prepare(
      "UPDATE capture_failures SET error_photo_mismatch = NULL WHERE visit_id = ? AND error_photo_mismatch LIKE 'AI check:%'"
    ).bind(visitId).run();
    await db.prepare('UPDATE image_fraud_flags SET excluded = 0 WHERE visit_id = ?').bind(visitId).run();
  }
  await db.prepare(
    'INSERT INTO image_fraud_flags (id, tenant_id, visit_id, agent_id, agent_name, visit_date, goldrush_id, stage, verdict, flags, detail, excluded, source, reviewed_by, reviewed_by_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(crypto.randomUUID(), tenantId, visitId, visit.agent_id, await nameOf(visit.agent_id), visit.visit_date, goldrushId,
    'review', fake ? 'definite' : 'pass', JSON.stringify(fake ? ['MANUAL_REVIEW'] : []), detail, fake ? 1 : 0, 'manual', userId, reviewerName).run();

  return c.json({ success: true, decision, excluded: fake });
});

export default app;
