/**
 * Field-Ops calls — BO admin / team lead / manager reaches field agents.
 * Two-stage flow: an in-app WebRTC call rings first (bo_calls lifecycle +
 * CallRoom DO signaling + Web Push ring); if the agent doesn't answer, the
 * client fails over to a GSM dial-out (/calls/dial) — the caller's own phone
 * dialer opens with the agent's number, logged in bo_calls as 'dialed'.
 * This module also owns ICE config, per-BO daily targets, and
 * push-subscription storage (also used by nudges/news pushes). Auth is applied
 * globally at the /api mount, so c.get('tenantId'|'userId'|'role') are populated.
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

// --- GSM dial-out --------------------------------------------------------------
// Fallback stage of the call flow: when the in-app ring goes unanswered (or the
// caller taps "Call phone instead"), the client opens its OWN phone dialer via
// tel: — works regardless of whether the agent has data. This endpoint resolves
// the agent's number and logs the attempt as status 'dialed' (the call happens
// on the carrier network, so answered/duration are unknowable).
app.post('/calls/dial', boOnly, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const callerId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const calleeId = body.callee_id;
  if (!calleeId) return c.json({ success: false, message: 'callee_id required' }, 400);

  const callee = await db.prepare(
    `SELECT phone, TRIM(first_name || ' ' || last_name) AS name FROM users WHERE id = ? AND tenant_id = ?`
  ).bind(calleeId, tenantId).first();
  if (!callee) return c.json({ success: false, message: 'Unknown callee' }, 400);
  const phone = (callee.phone || '').trim();
  if (!phone) return c.json({ success: false, message: 'No phone number on file for this agent' }, 404);

  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO bo_calls (id, tenant_id, company_id, caller_id, callee_id, status, started_at, ended_at, duration_s, created_at)
     VALUES (?, ?, ?, ?, ?, 'dialed', ?, ?, 0, ?)`
  ).bind(crypto.randomUUID(), tenantId, body.company_id ?? null, callerId, calleeId, now, now, now).run();

  return c.json({ success: true, phone, name: callee.name || 'Agent' });
});

// --- Lifecycle ---------------------------------------------------------------
app.post('/calls/start', boOnly, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const callerId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const calleeId = body.callee_id;
  if (!calleeId) return c.json({ success: false, message: 'callee_id required' }, 400);

  const callee = await db.prepare(
    `SELECT phone FROM users WHERE id = ? AND tenant_id = ?`
  ).bind(calleeId, tenantId).first();
  if (!callee) return c.json({ success: false, message: 'Unknown callee' }, 400);
  // reachable = at least one device can be rung over push. False usually means
  // offline / notifications never enabled — the client shortens the in-app ring
  // and fails over to the GSM dial sooner. Best-effort probe: it must never
  // fail the call (a pre-0015 legacy table shape once 500'd this route).
  let subCount = null;
  try {
    subCount = await db.prepare(
      `SELECT COUNT(*) AS n FROM push_subscriptions WHERE tenant_id = ? AND user_id = ?`
    ).bind(tenantId, calleeId).first();
  } catch { /* unknown → treat as reachable */ }

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

  return c.json({
    success: true,
    callId,
    iceServers: await iceServers(c.env),
    callee_phone: (callee.phone || '').trim() || null,
    reachable: subCount ? (subCount.n ?? 0) > 0 : true,
  });
});

async function callerDisplayName(db, tenantId, callerId) {
  const u = await db.prepare(
    `SELECT first_name || ' ' || last_name AS name FROM users WHERE id = ? AND tenant_id = ?`
  ).bind(callerId, tenantId).first();
  return (u?.name || '').trim() || 'Back office';
}

// Best-effort push to every subscription a user has registered.
// Prunes subscriptions the push service reports gone (404/410).
async function pushToUser(c, tenantId, userId, payload) {
  const db = c.env.DB;
  const subs = await db.prepare(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id = ? AND user_id = ?`
  ).bind(tenantId, userId).all();
  const rows = subs.results || [];
  if (!rows.length) return;
  const work = Promise.all(rows.map(async (sub) => {
    const r = await sendPush(c.env, sub, payload);
    if (r && (r.status === 404 || r.status === 410)) {
      await db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(sub.endpoint).run();
    }
  }));
  // Keep the worker alive for the pushes without blocking the response.
  if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(work); else await work;
}

function ringCallee(c, tenantId, calleeId, callId, callerName) {
  return pushToUser(c, tenantId, calleeId, { type: 'incoming_call', callId, callerName });
}

// Broadcast a JSON message to whoever is connected to the call's signaling
// room — how REST lifecycle changes (decline/end) reach the waiting caller,
// who otherwise rings forever since the callee never opened a socket.
async function notifyRoom(env, callId, payload) {
  try {
    const id = env.CALL_ROOM.idFromName(callId);
    await env.CALL_ROOM.get(id).fetch('https://call-room/notify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch { /* best-effort */ }
}

app.post('/calls/:id/answer', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const now = new Date().toISOString();
  const res = await db.prepare(
    `UPDATE bo_calls SET status = 'answered', answered_at = ?
     WHERE id = ? AND tenant_id = ? AND status = 'ringing'`
  ).bind(now, id, tenantId).run();
  // active:false = the ring is stale (caller gave up / already finalized) —
  // the callee tapped a leftover notification and must not join an empty room.
  return c.json({ success: true, active: (res.meta?.changes ?? 0) > 0 });
});

app.post('/calls/:id/decline', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const now = new Date().toISOString();
  const res = await db.prepare(
    `UPDATE bo_calls SET status = 'declined', ended_at = ?
     WHERE id = ? AND tenant_id = ? AND status = 'ringing'`
  ).bind(now, id, tenantId).run();
  if ((res.meta?.changes ?? 0) > 0) {
    // Stop the caller's ringback, and clear the ring on the callee's other devices.
    await notifyRoom(c.env, id, { type: 'bye', reason: 'declined' });
    await pushToUser(c, tenantId, c.get('userId'), { type: 'call_cancelled', callId: id, outcome: 'declined' });
  }
  return c.json({ success: true });
});

app.post('/calls/:id/end', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const row = await db.prepare(
    `SELECT status, started_at, answered_at, ended_at, callee_id, caller_id
     FROM bo_calls WHERE id = ? AND tenant_id = ?`
  ).bind(id, tenantId).first();
  if (!row) return c.json({ success: false, message: 'call not found' }, 404);
  if (row.ended_at) return c.json({ success: true }); // already finalized

  const finalized = finalizeCall(row, new Date().toISOString(), body.reason);
  await db.prepare(
    `UPDATE bo_calls SET status = ?, ended_at = ?, duration_s = ? WHERE id = ? AND tenant_id = ?`
  ).bind(finalized.status, finalized.ended_at, finalized.duration_s, id, tenantId).run();

  await notifyRoom(c.env, id, { type: 'bye', reason: 'ended' });
  if (finalized.status === 'missed' || finalized.status === 'failed') {
    // Caller hung up before an answer — take down the still-ringing notification
    // on the callee's devices; on a plain miss leave a "Missed call" note behind.
    const callerName = await callerDisplayName(db, tenantId, row.caller_id);
    await pushToUser(c, tenantId, row.callee_id, {
      type: 'call_cancelled',
      callId: id,
      callerName,
      outcome: finalized.status,
    });
  }
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
  // contacted = distinct agents reached today: 'answered' (legacy in-app calls)
  // or 'dialed' (GSM dial-outs — the app can't observe whether those connected,
  // so the attempt is what we count). missed = in-app attempts that didn't
  // connect (declined/missed/failed).
  const rows = await db.prepare(
    `SELECT callee_id, status FROM bo_calls
     WHERE tenant_id = ? AND caller_id = ? AND substr(started_at, 1, 10) = ?`
  ).bind(tenantId, userId, today).all();
  const todayCalls = rows.results || [];
  const reached = todayCalls.filter((r) => r.status === 'answered' || r.status === 'dialed');
  const contactedIds = [...new Set(reached.map((r) => r.callee_id))];
  return c.json({
    success: true,
    target,
    contacted: contactedIds.length,
    calls: reached.length,
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
  // Manager+ can set anyone's target; others only their own. The target must be a real
  // user in the caller's tenant — bo_call_targets keys on user_id alone, so an unscoped
  // body.user_id would let a manager overwrite another tenant's target.
  let targetUser = userId;
  if (body.user_id && BO_ROLES.includes(role)) {
    const t = await db.prepare('SELECT id FROM users WHERE id = ? AND tenant_id = ?')
      .bind(body.user_id, tenantId).first();
    if (!t) return c.json({ success: false, message: 'Unknown user' }, 400);
    targetUser = body.user_id;
  }
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

// Send a test push to the caller's own devices — powers the "test notifications"
// button in the first-login tour. Mirrors ringCallee's send+prune loop.
app.post('/calls/push/test', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const subs = await db.prepare(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id = ? AND user_id = ?`
  ).bind(tenantId, userId).all();
  const rows = subs.results || [];
  if (!rows.length) return c.json({ success: false, message: 'no subscription' }, 400);
  const payload = { title: 'FieldVibe', body: 'Notifications are working ✅', url: '/agent' };
  let sent = 0;
  for (const sub of rows) {
    const r = await sendPush(c.env, sub, payload);
    if (r && r.ok) sent++;
    else if (r && (r.status === 404 || r.status === 410)) {
      await db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(sub.endpoint).run();
    }
  }
  return c.json({ success: sent > 0, sent });
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
