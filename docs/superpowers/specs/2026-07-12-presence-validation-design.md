# Presence Validation (GPS Attendance-Fraud Detection) — Design

## Problem

Suspicion that some field staff are home not working, or working a second job, while
reporting as active. Need location evidence to validate an agent/team-lead is physically
in their work area during work hours, and surface offenders to their overseers.

## Hard constraint (why this shape)

A PWA **cannot** sample GPS in the background. Browser geolocation requires the page to be
foreground + visible + permission granted; service workers have no geolocation API; Periodic
Background Sync (Chrome-only) cannot read location. Truly-covert background GPS needs a native
wrapper and even then the OS shows a location indicator. So Phase A is **opportunistic
foreground sampling**: capture a fix whenever the field PWA is open, score the day's scatter.
This still catches the described fraud — a staffer home all day either never opens the app
(no-show flag) or opens it from home (off-zone flag); a second-job staffer shows a stationary
cluster far from any customer.

Compliance: vantax.co.za is SA → POPIA. Posture is **disclosed passive** — staff get a
one-time in-app notice that location is recorded during work hours. Defensible and equally
effective (a dishonest staffer can't opt out of being where they're paid to be).

## Phase A — foreground sampling + insight (ship now, this spec)

### Capture (frontend)
- `usePresenceHeartbeat()` hook mounted in `AgentLayout` for TRACKED roles only
  (`field_agent`, `sales_rep`, `agent`, `team_lead`). While `document.visibilityState==='visible'`
  and consent granted, every ~5 min call `gpsService.getCurrentPosition` (low accuracy,
  `maximumAge` allowed to save battery) then reuse `field-marketing.service.logGPSLocation`
  to `POST /api/gps-location/log` with `activity_type:'presence'`. Throttle via a last-sent
  timestamp so remounts/visibility flaps don't spam. Silent-skip on permission denial or error.
- One-time disclosure notice (POPIA) shown once before first sample; consent flag in
  localStorage. No sampling until acknowledged.

### Scoring (backend)
- Pure `workers-api/src/services/presenceScore.js`, no DB/IO:
  `scoreAgentDay(points, customers, opts) -> { status, offZonePct, sampleCount, dominantCluster, lastSeenAt }`
  - `points: [{latitude, longitude, recorded_at}]`, `customers: [{latitude, longitude}]`,
    `opts: { offZoneRadiusM=2000, minSamples=3, workStartHour=8, workEndHour=17 }`.
  - Filter points to the work-hours window.
  - `status`: `no_show` (0 samples in window), `low_coverage` (`0 < n < minSamples`),
    `off_zone` (`offZonePct >= 60` with enough samples), else `ok`.
  - `offZonePct`: % of points whose nearest customer is > `offZoneRadiusM` (haversine).
  - `dominantCluster`: greedy cluster of points; largest cluster centroid + time-span hours +
    `nearCustomer` bool. An off-zone dominant cluster spanning several hours = strong
    "stationary elsewhere (home / other job)" signal.
  - `demo()` self-check: all-off-zone -> off_zone; all-near -> ok; empty -> no_show; 2 pts -> low_coverage.
- Route `GET /api/field-ops/presence/anomalies?date=YYYY-MM-DD` (default today, SAST).
  Role-gated to `manager|general_manager|backoffice_admin|admin|super_admin`. For each tracked
  agent expected to work that day (`working_days_config`), gather day's `agent_locations` +
  tenant customers with coords, run `scoreAgentDay`, return per-agent result. Response:
  `{ date, flaggedCount, agents: [{ agent_id, agent_name, role, status, offZonePct, sampleCount, dominantCluster, lastSeenAt }] }`.

### Insight surface (PWA)
- `PresenceAlerts.tsx` — self-contained card: fetches the anomalies endpoint, lists flagged
  agents (name, reason, off-zone %, last seen); renders null when none flagged. One component,
  mounted on the three viewer roles' landing pages: manager Stats, GM Overview, BO admin home.
  New service method on `field-operations.service.ts`.

### Rollout
Additive, no migration (reuses `agent_locations`). Merge one PR, auto-deploys to prod, validate
live: confirm heartbeats land in `agent_locations`, anomalies endpoint returns sane scores,
card visible to the three viewer roles only.

## Phase B — native background (later, needs user decisions)

Capacitor wrap of the PWA for true always-on background location. Requires: Apple/Google
developer accounts, native build toolchain, app-store review, disclosed always-on location
permission. Weeks of work; blocked on the user's store accounts + native-build choices.
Scope separately once Phase A scatter data shows foreground sampling is insufficient.

## Test
- `presenceScore.test.js` covering the four statuses + haversine off-zone + empty-window guard.
- Frontend: heartbeat throttle + consent-gate unit check.
