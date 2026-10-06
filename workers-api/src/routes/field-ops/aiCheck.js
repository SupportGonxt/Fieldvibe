/**
 * AI Check — Goldrush screenshot fraud statistics for the GM and admins.
 *
 * Every Goldrush individual check-in in the period gets one verdict: the most severe
 * row in image_fraud_flags (upload-time rule set, retroactive status-bar matches, or the
 * historic scan backfill). No row = the screenshot matched the golden reference.
 * Definite fakes are excluded from all other reports via capture_failures; this page is
 * the one place they are still counted.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { ensureImageFraudTables } from '../../services/imageFraudService.js';
import { rewriteR2Url } from '../../lib/photoAi.js';

const app = new Hono();

export const VERDICT_ORDER = ['definite', 'likely', 'review', 'unverifiable', 'not_profile', 'pass'];
const RANK = Object.fromEntries(VERDICT_ORDER.map((v, i) => [v, VERDICT_ORDER.length - i]));

export function worstVerdict(verdicts) {
  let best = 'pass';
  for (const v of verdicts) if ((RANK[v] || 0) > RANK[best]) best = v;
  return best;
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
      AND EXISTS (SELECT 1 FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.photo_type = 'goldrush_individual')
  `).bind(tenantId, start, end).all();
  const flags = await db.prepare(`
    SELECT f.visit_id, f.verdict, f.flags, f.detail, f.stage, f.source, f.goldrush_id, f.created_at
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
    return { ...v, agent: v.agent || 'Unknown', verdict: worstVerdict(fl.map(f => f.verdict)), fl };
  });

  const codes = {};
  for (const r of rows) {
    const seen = new Set();
    for (const f of r.fl) { let arr = []; try { arr = JSON.parse(f.flags || '[]'); } catch { /* legacy row */ } arr.forEach(x => seen.add(x)); }
    seen.forEach(x => { codes[x] = (codes[x] || 0) + 1; });
  }

  const attempts = await db.prepare(`
    SELECT agent_id, agent_name, COUNT(*) AS n FROM image_fraud_flags
    WHERE tenant_id = ? AND stage = 'precheck' AND verdict = 'definite' AND visit_date BETWEEN ? AND ?
    GROUP BY agent_id, agent_name ORDER BY n DESC
  `).bind(tenantId, start, end).all();

  // Most recent definite / likely check-ins with their photo, for spot checks.
  const flaggedIds = rows.filter(r => r.verdict === 'definite' || r.verdict === 'likely')
    .sort((a, b) => b.visit_date.localeCompare(a.visit_date)).slice(0, 200);
  const photos = new Map();
  for (let i = 0; i < flaggedIds.length; i += 50) {
    const chunk = flaggedIds.slice(i, i + 50).map(r => r.id);
    const ph = await db.prepare(
      `SELECT visit_id, r2_key FROM visit_photos WHERE photo_type = 'goldrush_individual' AND visit_id IN (${chunk.map(() => '?').join(',')})`
    ).bind(...chunk).all();
    for (const p of (ph.results || [])) photos.set(p.visit_id, p.r2_key && !p.r2_key.startsWith('data:') ? rewriteR2Url('/api/uploads/' + p.r2_key, c.req.url) : null);
  }
  const recent = flaggedIds.map(r => ({
    visit_id: r.id, visit_date: r.visit_date, agent: r.agent, verdict: r.verdict,
    goldrush_id: r.fl.find(f => f.goldrush_id)?.goldrush_id || null,
    reasons: [...new Set(r.fl.map(f => f.detail).filter(Boolean))].join(' | '),
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

export default app;
