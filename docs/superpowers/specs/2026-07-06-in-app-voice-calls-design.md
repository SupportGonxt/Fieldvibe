# In-App Voice Calls + BO Admin Productivity — Design

**Date:** 2026-07-06
**Status:** Approved (architecture decisions locked via user)

## Goal

Back-office (BO) admins call field agents **inside the app over data** (WebRTC
voice — no `tel:`, no WhatsApp), so every call is tracked and the BO admin's
outreach is measured against a daily target. Replaces the untracked `tel:`
handoff in `BackOfficeCallList.tsx`.

## Locked decisions

- **Call delivery:** full — Web Push wakes the agent's PWA even when closed/backgrounded, then WebRTC voice connects.
- **BO target metric:** distinct agents **contacted** (call answered) per day, vs a configurable daily target (default 20).

## Architecture

Peer-to-peer WebRTC audio. A Durable Object relays signaling (SDP + ICE) over
WebSocket between the two peers; media flows P2P. Web Push rings the agent.
D1 stores call logs, push subscriptions, and per-BO targets.

```
BO admin PWA ──WS──┐                    ┌──WS── Agent PWA
                   ├── CallRoom DO ──────┤
   RTCPeerConnection (audio) ── P2P ─────── RTCPeerConnection (audio)
        │                                          ▲
        │ POST /calls/start                        │ Web Push (VAPID)
        └──────────► workers-api ──────────────────┘
                     (D1: bo_calls, push_subscriptions, bo_call_targets)
```

### ICE / NAT
- STUN: Google public (`stun:stun.l.google.com:19302`) — free.
- TURN: Cloudflare Realtime TURN, credentials minted server-side, **secret-gated**.
  If `TURN_KEY_ID`/`TURN_API_TOKEN` secrets are absent, calls run STUN-only.
  - `ponytail:` STUN-only ships day 1; ~10-20% of calls on symmetric NAT fail
    until TURN secrets are set. Upgrade path = add the two secrets, no code change.

## Components / files

### Backend (`workers-api/`)
- **Migration** `migrations/0012_voice_calls.sql`:
  - `bo_calls(id, tenant_id, company_id, caller_id, callee_id, status, started_at, answered_at, ended_at, duration_s, created_at)` — `status` ∈ `ringing|answered|missed|declined|failed`.
  - `push_subscriptions(id, tenant_id, user_id, endpoint UNIQUE, p256dh, auth, created_at)`.
  - `bo_call_targets(tenant_id, company_id, user_id, daily_target, PRIMARY KEY(user_id))` — sparse; missing row = default 20.
  - Indexes: `bo_calls(callee_id, created_at)`, `bo_calls(caller_id, created_at)`.
- **Durable Object** `src/durable/CallRoom.js` — `CallRoom` class, WS hub keyed by `callId`. Relays JSON messages `{type: offer|answer|ice|bye}` between the ≤2 connected sockets. Bound in `wrangler.toml` (`[[durable_objects.bindings]]` + `[[migrations]] new_classes`), mirrored under `[env.preview]`.
- **Routes** `src/routes/field-ops/calls.js`, mounted at `/field-ops/calls`:
  - `POST /start {callee_id}` → insert `bo_calls` row (ringing), send Web Push to callee, return `{callId, iceServers}`.
  - `POST /:id/answer` → set `answered_at`, `status=answered`.
  - `POST /:id/decline` → `status=declined`.
  - `POST /:id/end {reason?}` → set `ended_at`, `duration_s`, finalize `status` (missed if never answered).
  - `GET /ice` → `{iceServers}` (STUN always; TURN if secrets present).
  - `GET /ws?callId=` → upgrade to the `CallRoom` DO WS.
  - `GET /history?limit=` → BO admin's recent calls.
  - `GET /target` → `{target, contacted, calls}` for today (contacted = distinct callee with status=answered).
  - `PUT /target {daily_target}` (manager+ or self) → upsert.
  - `POST /push/subscribe {subscription}` / `POST /push/unsubscribe {endpoint}`.
- **Web Push send** — VAPID JWT + AES128GCM payload encryption via WebCrypto
  (`ponytail:` hand-rolled ~60 lines over WebCrypto, no npm dep that assumes
  Node crypto; a Workers-compatible lib is the fallback if encryption is fiddly).
  Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

### Frontend (`frontend/`)
- **`public/push-sw.js`** — `push` handler (`showNotification`, `requireInteraction`, actions Answer/Decline) + `notificationclick` (focus/open PWA to `/agent/call/incoming?callId=`). Wired via `VitePWA.workbox.importScripts: ['/push-sw.js']`.
- **`src/services/webrtc.ts`** — thin `CallSession` helper: `RTCPeerConnection`, `getUserMedia({audio})`, WS to `/field-ops/calls/ws`, offer/answer/ICE plumbing, `onState`, `hangup()`.
- **`src/services/push.ts`** — register push subscription (guarded: only when `Notification`/`PushManager` exist and permission grantable), POST to `/push/subscribe`.
- **`src/pages/agent/CallScreen.tsx`** — active-call UI (caller + callee): avatar/name, ring/connecting/connected state, duration timer, mute, hangup. Reused for outgoing (BO) and incoming (agent).
- **Routes** `/agent/call/:callId` (outgoing) and `/agent/call/incoming` (agent answers). Full-screen, outside the tab chrome.
- **`BackOfficeCallList.tsx`** — replace `tel:` anchor with an initiate-call button → `POST /start` → navigate to `/agent/call/:callId`. Header shows target progress (`contacted/target`).
- **BO Home** — small target progress card (reuse `/target`).
- On agent login/app-open, best-effort `push.ts` subscribe (asks notification permission once).

## Data flow (one call)

1. BO taps agent → `POST /calls/start {callee_id}` → row `ringing`, Web Push sent, returns `{callId, iceServers}`.
2. BO opens `/agent/call/:callId` → WS to `CallRoom(callId)` → `getUserMedia(audio)` → creates & sends **offer**.
3. Agent's push fires → notification → tap Answer → PWA opens `/agent/call/incoming?callId` → WS same room → receives offer → `POST /answer` → `getUserMedia` → sends **answer** → ICE exchange → **connected**.
4. Hang up → `POST /end` sets `ended_at`/`duration_s`; both peers `bye` over WS; DO closes.
5. No answer within 35s → BO client `POST /end` → `status=missed`.

## Error handling
- Mic permission denied → inline error on CallScreen, `POST /end reason=no_mic`, no crash.
- Push unsupported (older iOS / not installed) → call still starts; agent simply doesn't ring unless app is open. `ponytail:` acceptable degradation, surfaced as "couldn't ring — agent may be offline".
- WS drop mid-call → 1 reconnect attempt to same room; else end call.
- DO room already has 2 peers → reject third with `busy`.

## Testing
- Backend pure unit (node config, the passing harness): call-status finalize logic (`missed` vs `answered` vs `duration`), target metric (distinct answered callees today), VAPID JWT sign shape. Table-driven, no Workers runtime.
- DO signaling relay: 2-socket message fan-out (unit against a fake WS pair).
- Manual: cross-device call BO↔agent on dev.

## Build phases (each deploys to dev)
- **A. Signaling + lifecycle:** migration, `CallRoom` DO, `/calls` lifecycle + `/target` + `/ice` endpoints, wrangler bindings. No media/push yet — endpoints testable.
- **B. WebRTC:** `webrtc.ts`, `CallScreen`, routes, wire `BackOfficeCallList` initiate. Online-to-online call works end to end (both apps open).
- **C. Web Push:** VAPID send, `push-sw.js`, `push.ts` subscribe, push on `/start`. Closed-app ring.
- **D. Tracking UI:** target progress on call-list + BO Home, call history, `PUT /target`.

## Out of scope (YAGNI)
- Group calls, video, call recording, in-call chat, agent→BO calls, hold/transfer.
