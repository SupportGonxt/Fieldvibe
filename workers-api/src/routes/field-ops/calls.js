/**
 * Field-Ops in-app voice calls — BO admin calls field agents over WebRTC.
 * This module owns call lifecycle (bo_calls), signaling handoff to the CallRoom
 * DO, ICE server config, per-BO daily targets, and push-subscription storage.
 * Media is P2P; Web Push (Phase C) rings the agent. Auth is applied globally at
 * the /api mount, so c.get('tenantId'|'userId'|'role') are already populated.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { sendPush } from '../../lib/web-push.js';

const app = new Hono();

const DEFAULT_TARGET = 20;
const BO_ROLES = ['admin', 'backoffice_admin', 'general_manager', 'manager', 'team_lead', 'super_admin'];
const boOnly = requireRole(...BO_ROLES);

// --- ICE servers -------------------------------------------------------------
// STUN always (Google free). TURN only if Cloudflare Realtime secrets are set;
// otherwise STUN-only (symmetric-NAT calls may fail until secrets added).
// ponytail: STUN-only day 1, add TURN secrets to upgrade — no code change.
async function iceServers(env) {
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (env.TURN_KEY_ID && env.TURN_API_TOKEN) {
    try {
      const r = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ttl: 86400 }),
        }
      );
      if (r.ok) {
        const j = await r.json();
        if (j.iceServers) servers.push(j.iceServers);
      }
    } catch { /* fall back to STUN-only */ }
  }
  return servers;
}

app.get('/calls/ice', async (c) => {
  return c.json({ success: true, iceServers: await iceServers(c.env) });
});

// --- Signaling: WS upgrade forwarded to the CallRoom DO -----------------------
app.get('/calls/ws', async (c) => {
  const callId = c.req.query('callId');
  if (!callId) return c.json({ success: false, message: 'callId required' }, 400);
  const id = c.env.CALL_ROOM.idFromName(callId);
  const stub = c.env.CALL_ROOM.get(id);
  return stub.fetch(c.req.raw);
});

// --- Incoming poll -----------------------------------------------------------
// The callee polls this to discover a ringing call aimed at them. Web Push
// (Phase C) will make this instant; polling is the always-works fallback.
app.get('/calls/incoming', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  // Only recent rings — a stale row shouldn't ambush the agent minutes later.
  const cutoff = new Date(Date.now() - 60000).toISOString();
  const row = await db.prepare(
    `SELECT c.id, u.first_name || ' ' || u.last_name AS caller_name
     FROM bo_calls c LEFT JOIN users u ON u.id = c.caller_id
     WHERE c.tenant_id = ? AND c.callee_id = ? AND c.status = 'ringing' AND c.started_at > ?
     ORDER BY c.started_at DESC LIMIT 1`
  ).bind(tenantId, userId, cutoff).first();
  if (!row) return c.json({ success: true, call: null });
  return c.json({
    success: true,
    call: { callId: row.id, callerName: (row.caller_name || '').trim() || 'Back office' },
    iceServers: await iceServers(c.env),
  });
});

// --- Lifecycle ---------------------------------------------------------------
app.post('/calls/start', boOnly, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const callerId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const calleeId = body.callee_id;
  if (!calleeId) return c.json({ success: false, message: 'callee_id required' }, 400);

  const callId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO bo_calls (id, tenant_id, company_id, caller_id, callee_id, status, started_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'ringing', ?, ?)`
  ).bind(callId, tenantId, body.company_id ?? null, callerId, calleeId, now, now).run();

  // Ring the callee's devices via Web Push. Fire-and-forget: a push failure
  // must not fail the call — the caller still opens the room; the agent just
  // doesn't ring unless their app is already open (poller fallback covers it).
  const callerName = await callerDisplayName(db, tenantId, callerId);
  ringCallee(c, tenantId, calleeId, callId, callerName);

  return c.json({ success: true, callId, iceServers: await iceServers(c.env) });
});

async function callerDisplayName(db, tenantId, callerId) {
  const u = await db.prepare(
    `SELECT first_name || ' ' || last_name AS name FROM users WHERE id = ? AND tenant_id = ?`
  ).bind(callerId, tenantId).first();
  return (u?.name || '').trim() || 'Back office';
}

// Best-effort push ring to every subscription the callee has registered.
// Prunes subscriptions the push service reports gone (404/410).
async function ringCallee(c, tenantId, calleeId, callId, callerName) {
  const db = c.env.DB;
  const subs = await db.prepare(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id = ? AND user_id = ?`
  ).bind(tenantId, calleeId).all();
  const rows = subs.results || [];
  if (!rows.length) return;
  const payload = { type: 'incoming_call', callId, callerName };
  const work = Promise.all(rows.map(async (sub) => {
    const r = await sendPush(c.env, sub, payload);
    if (r && (r.status === 404 || r.status === 410)) {
      await db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(sub.endpoint).run();
    }
  }));
  // Keep the worker alive for the pushes without blocking the response.
  if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(work); else await work;
}

app.post('/calls/:id/answer', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE bo_calls SET status = 'answered', answered_at = ?
     WHERE id = ? AND tenant_id = ? AND status = 'ringing'`
  ).bind(now, id, tenantId).run();
  return c.json({ success: true });
});

app.post('/calls/:id/decline', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE bo_calls SET status = 'declined', ended_at = ?
     WHERE id = ? AND tenant_id = ? AND status = 'ringing'`
  ).bind(now, id, tenantId).run();
  return c.json({ success: true });
});

app.post('/calls/:id/end', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const row = await db.prepare(
    `SELECT status, started_at, answered_at, ended_at FROM bo_calls WHERE id = ? AND tenant_id = ?`
  ).bind(id, tenantId).first();
  if (!row) return c.json({ success: false, message: 'call not found' }, 404);
  if (row.ended_at) return c.json({ success: true }); // already finalized

  const finalized = finalizeCall(row, new Date().toISOString(), body.reason);
  await db.prepare(
    `UPDATE bo_calls SET status = ?, ended_at = ?, duration_s = ? WHERE id = ? AND tenant_id = ?`
  ).bind(finalized.status, finalized.ended_at, finalized.duration_s, id, tenantId).run();
  return c.json({ success: true, status: finalized.status, duration_s: finalized.duration_s });
});

// --- Tracking ----------------------------------------------------------------
app.get('/calls/history', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10) || 50, 200);
  const rows = await db.prepare(
    `SELECT bc.id, bc.callee_id, bc.status, bc.started_at, bc.answered_at, bc.ended_at, bc.duration_s,
            TRIM(u.first_name || ' ' || u.last_name) AS callee_name
     FROM bo_calls bc
     LEFT JOIN users u ON u.id = bc.callee_id
     WHERE bc.tenant_id = ? AND bc.caller_id = ?
     ORDER BY bc.created_at DESC LIMIT ?`
  ).bind(tenantId, userId, limit).all();
  return c.json({ success: true, calls: rows.results || [] });
});

app.get('/calls/target', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const today = new Date().toISOString().slice(0, 10);
  const t = await db.prepare(
    `SELECT daily_target FROM bo_call_targets WHERE user_id = ? AND tenant_id = ?`
  ).bind(userId, tenantId).first();
  const target = t?.daily_target ?? DEFAULT_TARGET;
  // contacted = distinct agents actually reached (answered) today;
  // missed = attempts that didn't connect (declined/missed/failed).
  const rows = await db.prepare(
    `SELECT callee_id, status FROM bo_calls
     WHERE tenant_id = ? AND caller_id = ? AND substr(started_at, 1, 10) = ?`
  ).bind(tenantId, userId, today).all();
  const todayCalls = rows.results || [];
  const answered = todayCalls.filter((r) => r.status === 'answered');
  const contactedIds = [...new Set(answered.map((r) => r.callee_id))];
  return c.json({
    success: true,
    target,
    contacted: contactedIds.length,
    calls: answered.length,
    missed: todayCalls.filter((r) => ['declined', 'missed', 'failed'].includes(r.status)).length,
    contacted_ids: contactedIds,
  });
});

app.put('/calls/target', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const dt = parseInt(body.daily_target, 10);
  if (!Number.isFinite(dt) || dt < 1) return c.json({ success: false, message: 'daily_target must be >= 1' }, 400);
  // Manager+ can set anyone's target; others only their own.
  const targetUser = body.user_id && BO_ROLES.includes(role) ? body.user_id : userId;
  await db.prepare(
    `INSERT INTO bo_call_targets (user_id, tenant_id, company_id, daily_target)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET daily_target = excluded.daily_target`
  ).bind(targetUser, tenantId, body.company_id ?? null, dt).run();
  return c.json({ success: true, user_id: targetUser, daily_target: dt });
});

// --- Push subscriptions (storage now; send in Phase C) -----------------------
app.post('/calls/push/subscribe', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const sub = body.subscription || body;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return c.json({ success: false, message: 'invalid subscription' }, 400);
  await db.prepare(
    `INSERT INTO push_subscriptions (id, tenant_id, user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ).bind(crypto.randomUUID(), tenantId, userId, endpoint, p256dh, auth).run();
  return c.json({ success: true });
});

app.post('/calls/push/unsubscribe', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => ({}));
  if (!body.endpoint) return c.json({ success: false, message: 'endpoint required' }, 400);
  await db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND tenant_id = ?`)
    .bind(body.endpoint, tenantId).run();
  return c.json({ success: true });
});

/**
 * Pure call-finalization logic (unit-tested). Given the stored row, the end
 * timestamp, and an optional reason, decide final status + duration.
 * - answered → 'answered', duration = ended - answered
 * - never answered, reason=failed/no_mic → 'failed'
 * - never answered otherwise → 'missed', duration 0
 */
export function finalizeCall(row, endedAtIso, reason) {
  if (row.answered_at) {
    const dur = Math.max(0, Math.round((Date.parse(endedAtIso) - Date.parse(row.answered_at)) / 1000));
    return { status: 'answered', ended_at: endedAtIso, duration_s: dur };
  }
  const failed = reason === 'failed' || reason === 'no_mic';
  return { status: failed ? 'failed' : 'missed', ended_at: endedAtIso, duration_s: 0 };
}

export default app;
