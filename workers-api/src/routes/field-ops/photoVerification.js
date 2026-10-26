/**
 * Photo verification reviews — Goldrush individual photos that failed verification
 * three times (services/goldrushPhotoAttempts.js). That visit is locked (the agent can
 * still do other individual visits) until Back Office or the GM decides, on the AI Check page:
 *
 * - approve (real): the last photo is accepted with the Goldrush ID and name the
 *   reviewer confirms; the agent's capture page picks it up and the visit can be submitted.
 * - reject (fake): the photo can never be used; the agent starts again with a new photo.
 *
 * Team Leads do not review. This is the only place that shows why each attempt failed.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { rewriteR2Url } from '../../lib/photoAi.js';
import { goldrushIdExists } from '../../lib/goldrush.js';
import { ensurePhotoAttemptTables, REASON_LABELS } from '../../services/goldrushPhotoAttempts.js';

const app = new Hono();

const photoUrl = (key, reqUrl) => (key ? rewriteR2Url('/api/uploads/' + key, reqUrl) : null);
const parseCodes = s => { try { return JSON.parse(s || '[]'); } catch { return []; } };

app.get('/photo-verification/reviews', requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  await ensurePhotoAttemptTables(db);
  const status = ['pending', 'approved', 'rejected'].includes(c.req.query('status')) ? c.req.query('status') : 'pending';
  // The AI Check page passes its period: decided reviews are limited to it, while
  // everything still waiting is always listed.
  const start = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('start') || '') ? c.req.query('start') : null;
  const end = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('end') || '') ? c.req.query('end') : null;
  const period = status !== 'pending' && start && end ? { sql: ' AND substr(r.created_at, 1, 10) BETWEEN ? AND ?', binds: [start, end] } : { sql: '', binds: [] };
  const rows = await db.prepare(
    `SELECT r.* FROM goldrush_photo_reviews r WHERE r.tenant_id = ? AND r.status = ?${period.sql} ORDER BY r.created_at DESC LIMIT 100`
  ).bind(tenantId, status, ...period.binds).all();
  const reviews = rows.results || [];
  const attempts = new Map();
  for (let i = 0; i < reviews.length; i += 50) {
    const ids = reviews.slice(i, i + 50).map(r => r.id);
    const a = await db.prepare(
      `SELECT id, review_id, stage, reasons, detail, extracted_id, first_name, last_name, photo_key, created_at FROM goldrush_photo_attempts WHERE review_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at`
    ).bind(...ids).all();
    for (const row of (a.results || [])) {
      if (!attempts.has(row.review_id)) attempts.set(row.review_id, []);
      attempts.get(row.review_id).push({
        id: row.id, created_at: row.created_at, stage: row.stage,
        reasons: parseCodes(row.reasons).map(code => REASON_LABELS[code] || code),
        detail: row.detail, extracted_id: row.extracted_id, first_name: row.first_name, last_name: row.last_name,
        photo_url: photoUrl(row.photo_key, c.req.url),
      });
    }
  }
  return c.json({
    success: true,
    status,
    total: reviews.length,
    reviews: reviews.map(r => ({
      id: r.id, status: r.status, created_at: r.created_at,
      agent_id: r.agent_id, agent_name: r.agent_name, team_lead_name: r.team_lead_name,
      goldrush_id: r.goldrush_id, first_name: r.first_name, last_name: r.last_name,
      photo_url: photoUrl(r.photo_key, c.req.url),
      reviewed_by_name: r.reviewed_by_name, reviewed_at: r.reviewed_at, note: r.note,
      attempts: attempts.get(r.id) || [],
    })),
  });
});

app.post('/photo-verification/reviews/:id', requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  await ensurePhotoAttemptTables(db);
  const { decision, note, goldrush_id: rawId, first_name: firstName, last_name: lastName } = await c.req.json().catch(() => ({}));
  if (!['approve', 'reject'].includes(decision)) {
    return c.json({ success: false, message: "decision ('approve' or 'reject') is required" }, 400);
  }
  const review = await db.prepare(
    `SELECT r.* FROM goldrush_photo_reviews r WHERE r.id = ? AND r.tenant_id = ?`
  ).bind(c.req.param('id'), tenantId).first();
  if (!review) return c.json({ success: false, message: 'Review not found' }, 404);
  if (review.status !== 'pending') return c.json({ success: false, message: 'This review has already been decided' }, 409);
  if (review.agent_id === userId) return c.json({ success: false, message: 'You cannot review your own photo' }, 403);

  const goldrushId = String(rawId || '').replace(/\D/g, '');
  if (decision === 'approve') {
    if (goldrushId.length !== 9) return c.json({ success: false, message: 'Enter the 9-digit Goldrush ID shown in the photo' }, 400);
    if (await goldrushIdExists(db, tenantId, goldrushId)) return c.json({ success: false, message: 'This Goldrush ID is already on another visit' }, 409);
  }
  const reviewer = await db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').bind(userId).first();
  const reviewerName = reviewer ? `${reviewer.first_name || ''} ${reviewer.last_name || ''}`.trim() : null;
  const clean = v => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null);
  await db.prepare(
    'UPDATE goldrush_photo_reviews SET status = ?, reviewed_by = ?, reviewed_by_name = ?, reviewed_at = ?, note = ?, goldrush_id = ?, first_name = ?, last_name = ? WHERE id = ?'
  ).bind(
    decision === 'approve' ? 'approved' : 'rejected', userId, reviewerName, new Date().toISOString(),
    typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null,
    decision === 'approve' ? goldrushId : review.goldrush_id,
    decision === 'approve' ? clean(firstName) : review.first_name,
    decision === 'approve' ? clean(lastName) : review.last_name,
    review.id,
  ).run();
  return c.json({ success: true, status: decision === 'approve' ? 'approved' : 'rejected' });
});

export default app;
