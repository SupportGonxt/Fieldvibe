# Offline Write Queue (Visit Submit) — Design Spec

**Date:** 2026-07-09
**Status:** Approved, ready for implementation plan
**Scope owner:** Offline resilience track of the PWA sweep

## Problem

Field sales agents submit visits in low/no-signal areas. Today a visit POST that
fails with a network error is lost — the agent sees an error and must re-enter
everything when signal returns. The offline queue infrastructure
(`frontend/src/utils/offline-storage.ts`) is fully built but 100% unwired.

This spec wires that queue for **one flow only**: the visit-workflow submit. It
is the only mutation with real server-side persistence *and* working idempotency
(`client_visit_id`). Van order create is a backend stub (no persistence), so it
is explicitly out of scope — queuing it would replay into a mock that saves
nothing.

## Goal

A visit submitted with no signal is queued locally and replays automatically on
reconnect, exactly once, with honest UI state throughout. No lost visits, no
double-counted insights.

## Non-Goals

- Van orders / returns / payments (backend stubs — nothing to persist to).
- Blanket "queue every failed mutation" interceptor (queues search-POSTs,
  hits stub routes, replays non-idempotent calls).
- Service-worker background sync (opaque; can't surface in-app pending/failed
  state to the agent).
- Offline *reads* / cache warming (separate concern; SWR cache already exists).

## Architecture

Explicit opt-in at the single visit-submit path. Reuse existing queue functions;
add no new queue infrastructure.

### Components

**1. Enqueue decision — `field-operations.service.ts` `createVisitWorkflow`**
Wrap the existing `this.post('/visits/workflow', data)`. On success, return as
today. On a `NETWORK_ERROR` (the code the axios interceptor's `!error.response`
branch already returns), call `addToSyncQueue` and return a sentinel:

```ts
async createVisitWorkflow(data) {
  try {
    const response = await this.post('/visits/workflow', data)
    return response.data || response
  } catch (err) {
    if (err?.code === 'NETWORK_ERROR') {
      await addToSyncQueue({ method: 'POST', url: '/visits/workflow', body: data })
      return { queued: true, client_visit_id: data.client_visit_id }
    }
    throw err   // real server/validation errors propagate as today
  }
}
```

Only `NETWORK_ERROR` enqueues. Every other error rethrows and surfaces as it
does today.

**2. Submit-handler UX — `VisitCreate.tsx`**
The submit handler already awaits `createVisitWorkflow`. Branch on the sentinel:
if `result.queued`, show a success-style toast — "No signal — visit saved.
It'll sync automatically when you're back online." — and navigate away exactly
as on a real success. `client_visit_id` is already generated
(`submitIdRef.current`, VisitCreate:1228), so the queued body carries it.

**3. Replay bootstrap — new small module `offline-sync.ts`**
Registered once at app mount:
- Runs `processSyncQueue` on mount (drains anything left from last session) and
  on every `online` event via the existing `onConnectivityChange`.
- **Single in-flight guard:** a module-level boolean so mount + online firing
  together don't run the drain concurrently.
- **Fresh token:** fetch a current token via the existing `getValidToken()`
  (which refreshes) at drain start, rather than a stale token captured earlier.
  If refresh fails (dead session), skip the drain and leave items `pending` —
  they drain after next login.

**4. Failure/pending surface — `MobileDashboard.tsx`**
`getSyncQueueCount()` is already consumed here (MobileDashboard:228). Extend to
also show a failed count and a dismissible "N visit(s) failed to sync — tap to
review" alert. No new dashboard.

## Data Flow

1. Agent submits visit offline → POST hits interceptor `!error.response`
   branch → `{ code: 'NETWORK_ERROR' }`.
2. `createVisitWorkflow` enqueues via `addToSyncQueue({ method:'POST',
   url:'/visits/workflow', body: payload })`, returns `{ queued: true }`.
3. `VisitCreate` shows the queued toast, navigates away. Pending badge ticks up.
4. On reconnect (or next app mount), `offline-sync` runs `processSyncQueue`:
   fresh token → for each pending item, POST `${baseUrl}${item.url}` → remove on
   ok, mark `failed` on a real server rejection, leave `pending` on another
   network failure.

## Dedupe / Replay / Conflict

This is the risk surface; the queue is worthless if replay double-submits.

- **Dedupe authority = server, via `client_visit_id`.** The queued body carries
  the stable `client_visit_id`. The visit-workflow route short-circuits on a
  duplicate id (`SELECT id, status FROM visits WHERE tenant_id=? AND id=?`,
  workers-api/src/index.js ~9654) and returns the existing visit. So replaying
  an item twice — reconnect firing during a manual retry, two tabs, a crash
  mid-drain — is safe. No client-side dedupe logic required.
- **Replay guard:** single in-flight boolean in `offline-sync` prevents
  concurrent drains.
- **Token expiry:** fresh `getValidToken()` at drain start (see component 3).
- **Server rejection (4xx/5xx, not network):** mark item `failed`, never
  silent-drop. Surfaced via the dashboard alert so the agent can act.
- **Repeat network failure:** item stays `pending`, retried on next reconnect.

## Insight Accuracy (field sales)

A queued visit is **not yet a real visit** — it exists only in the browser's
IndexedDB until replay lands it server-side. Therefore:

- Queued visits MUST NOT count toward any server-computed KPI (visits/day,
  coverage, conversion). They can't, and won't: KPIs read the `visits` table,
  and the row only appears after successful replay. This spec must not add any
  client-side "optimistic count" that inflates a metric before the server
  confirms.
- The pending/failed **badge** is the one honest local signal: it reflects true
  IndexedDB queue state (`getSyncQueueCount` / failed count), not an estimate.
- Net effect on accuracy: a day's visit count may lag reality while items are
  queued, then self-correct on sync. Lagging-but-true is correct; inflated-now
  is not.

## User-Friendliness

- Queued state reads as success, not failure — the agent's work is safe. Copy is
  plain: "No signal — visit saved. It'll sync when you're back online."
- Pending badge gives at-a-glance "N waiting to sync".
- Failed items are visible and reviewable, never silently dropped.
- Zero extra taps: queuing and replay are automatic; the agent's flow is
  unchanged whether online or offline.

## Testing

**Unit:**
- Enqueue decision: `NETWORK_ERROR` → `addToSyncQueue` called + `{queued:true}`
  returned; any other error → rethrown, not enqueued.
- Replay guard: two concurrent `processSyncQueue` triggers run the drain once.

**Manual:**
- DevTools offline → submit visit → queued toast → badge = 1.
- Go online → badge clears → visit present server-side (single row).
- Replay twice (offline, online, manual retry) → still one server row
  (idempotency holds).
- Force a server 4xx on replay → item marked failed, alert shown, not dropped.

## Files

- Modify: `frontend/src/services/field-operations.service.ts` (`createVisitWorkflow`)
- Modify: `frontend/src/pages/field-operations/visits/VisitCreate.tsx` (submit handler)
- Create: `frontend/src/utils/offline-sync.ts` (replay bootstrap + guard)
- Modify: app mount (register bootstrap — `App.tsx` or existing root hook)
- Modify: `frontend/src/pages/mobile/MobileDashboard.tsx` (failed count + alert)
- Modify: `frontend/src/utils/offline-storage.ts` — `processSyncQueue` currently
  marks an item `failed` on *any* fetch error. Change it to distinguish: a
  network/fetch throw (offline again) leaves the item `pending`; only a real HTTP
  rejection (4xx/5xx response) marks it `failed`. Also add a failed-count getter
  if not already derivable from `getPendingSyncItems`.
- Reuse (no change): `addToSyncQueue`, `getSyncQueueCount`,
  `onConnectivityChange` in `offline-storage.ts`; `getValidToken` in
  `api.service.ts`
