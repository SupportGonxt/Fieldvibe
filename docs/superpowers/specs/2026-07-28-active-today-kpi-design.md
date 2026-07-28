# Active Today KPI — Design

Status: **Shipped** (dev) · Author: Claude Code · Date: 2026-07-28

## Problem

"Is this person working today?" had **four different, contradictory answers** across the app,
none of them shared. A team lead, a manager, an admin, and a back-office agent each looked at a
different signal, so the same person could read "active" on one screen and "quiet" on another.
Worse, the auto-nudge cron used yet another definition, so an agent could be told they're idle
while a dashboard showed them active.

The four pre-existing notions of "active":

| # | Where | Definition | Problem |
|---|-------|-----------|---------|
| 1 | Cron idle/nudge ladder — [`cron/jobs.js`](../../../workers-api/src/cron/jobs.js) | minutes since `MAX(visit_individuals.created_at)` today | signup-only; ignores GPS |
| 2 | GM roster "lastSeen" — [`field-ops/gm.js`](../../../workers-api/src/routes/field-ops/gm.js) | `COALESCE(users.last_activity_at, users.last_login)` | **`last_activity_at` is a dead column, never written** → really just `last_login` |
| 3 | GM overview / BO roster "active today" — `gm.js`, [`incentives.js`](../../../workers-api/src/routes/field-ops/incentives.js) | count of today's non-rejected `visit_individuals` | signup-only |
| 4 | GPS presence — [`presenceScore.js`](../../../workers-api/src/services/presenceScore.js) via `agent_locations.recorded_at` | last GPS fix | surfaced only on the anomalies screen; never joined to rosters |

Goal: **one** definition, computed **once** on the backend, read by **all four** dashboards, and
**kept identical to the cron** so "active today" and "nudge decisions" can never disagree.

## Definition (the decision)

> A person is **Active Today** if, since today's work-start, they have **either**
> (A) logged ≥1 non-rejected visit/signup, **or** (B) sent ≥1 GPS presence heartbeat.

- **Work-start floor:** `YYYY-MM-DD 06:00:00` UTC = 08:00 SAST — byte-for-byte identical to the
  cron's floor, so the KPI window and the nudge window are the same.
- **Applies uniformly to agents and team leads.** Both are GPS-tracked field roles
  ([`usePresenceHeartbeat.ts`](../../../frontend/src/hooks/usePresenceHeartbeat.ts) `TRACKED_ROLES`)
  and both can log signups. Managers/admins are *viewers* of the KPI, never subjects.
- **`lastActivity`** = the later of the last signup and the last GPS ping.

### Decision history
Initially scoped as "signup OR GPS" **without** touching the cron. That was upgraded mid-build to
**also align the cron** (option C), because leaving the cron on signup-only would let a GPS-only
agent read "active" on the tile while still being nudged as idle — violating the "must agree with
nudge decisions" acceptance criterion. Aligning the cron closes that gap.

### Accepted trade-offs
- GPS is **consent-gated** (5-min foreground pings, POPIA disclosed-passive). A person who never
  grants consent and logs no signup reads inactive — inherent to the definition.
- The dead `users.last_activity_at` column and the GM "lastSeen" (`last_login`) surface are **left
  as-is**; only the four target dashboards + the cron converge on the new definition. Converging
  `/gm/overview` and the GM roster is a clean follow-up.
- GPS pings' `activity_type` tag stays ignored server-side; every ping counts as presence.

## Solution

### Backend — single source of truth

**`workers-api/src/services/activityToday.js`** (new) — the ONE place the definition lives.
- `workStartUtc(now)` → the shared work-start floor.
- `notTestUserSql(alias)` → standardized test/demo exclusion (`agent-test-%` id prefix +
  `first_name != 'test'`), lifted from the BO roster. The app has no `is_test` flag; this is now
  the agreed heuristic for the KPI.
- `buildActivitySql({ roles, scopeSql, fieldOpsOnly })` → the query. Signup signal via a
  LEFT JOIN on `visit_individuals` (filter in the JOIN clause to keep signup-less people in the
  result); GPS signal via a **correlated subquery** on `agent_locations` (avoids a
  `visit_individuals × agent_locations` fan-out).
- `mapActivityRow` / `summarize` → pure mappers: `active = signupLast || gpsLast`,
  `lastActivity = max(signupLast, gpsLast)`, roster sorted **inactive-first** (who needs a nudge),
  then alphabetical.
- `computeActiveToday(db, opts)` → binds + runs + summarizes.

**`workers-api/src/routes/field-ops/activeToday.js`** (new) — `GET /field-ops/active-today?company_id=`
- Role-gated (`admin, general_manager, backoffice_admin, manager, team_lead`).
- Scoping mirrors the existing BO roster ([`incentives.js`](../../../workers-api/src/routes/field-ops/incentives.js) `/incentives/roster`):
  - **team_lead** → only their own agents (`u.team_lead_id = self`); no team-lead roster.
  - **manager / backoffice_admin** → company-link scoped (their companies, narrowed by the pill).
  - **admin / general_manager** → tenant-wide.
- Returns:
  ```json
  { "success": true, "asOf": "2026-07-28",
    "agents":    { "active": N, "total": M, "roster": [{ "id","name","role","active","lastActivity" }] },
    "teamLeads": { "active": N, "total": M, "roster": [ ... ] } }
  ```
- Mounted in [`index.js`](../../../workers-api/src/index.js) at `/field-ops`.

**`workers-api/src/cron/jobs.js`** — `checkInactiveAgents` idle query changed so "last active" =
the later of `MAX(visit_individuals.created_at)` **and** `MAX(agent_locations.recorded_at)` since
work-start (one combined `UNION ALL` query). A GPS ping now resets the idle timer exactly like a
signup. Only agent roles are nudged; team leads are unaffected.

### Frontend — every dashboard reads the same value

**`frontend/src/services/field-operations.service.ts`** — `getActiveToday(companyId?)` + exported
types `ActiveTodayPerson / ActiveTodayGroup / ActiveTodayResponse`.

**`frontend/src/components/field-ops/ActiveTodayTile.tsx`** (new) — shared PWA tile:
"X of Y active today", tap to expand an inline roster with a per-person active/inactive dot. Reuses
the `BackOfficeCallList` row idiom (`CircleDot` + since-label) — no new list pattern.

Dashboard wiring (each fetches via `getActiveToday`, matching that page's existing fetch style):

| Dashboard | File | What it shows |
|-----------|------|---------------|
| Team Lead | [`agent/TeamTab.tsx`](../../../frontend/src/pages/agent/TeamTab.tsx) | one tile — own team's agents |
| Manager | [`agent/ManagerTeamsTab.tsx`](../../../frontend/src/pages/agent/ManagerTeamsTab.tsx) | two tiles — team leads + agents (company-scoped by the pill) |
| Back Office | [`agent/BackOfficeCallList.tsx`](../../../frontend/src/pages/agent/BackOfficeCallList.tsx) | tile + the existing headline repointed to the unified value ("N agents are not active today — tap to call") |
| Admin | [`admin/AdminDashboard.tsx`](../../../frontend/src/pages/admin/AdminDashboard.tsx) | native MUI `MetricCard` ("X of Y") + a drillable table split by team lead / agent (MUI, not the PWA tile) |

## How to test

### 1. Unit (backend)
```bash
cd workers-api
npx vitest run src/services/activityToday.test.js      # 13 tests: definition, sort, bind order
npm test                                                # full suite (workerd; slow)
```
`activityToday.test.js` covers: signup-only → active, GPS-only → active, neither → inactive,
`lastActivity` = later of the two, inactive-first sort, test-user SQL, and the exact bind order.

### 2. Typecheck / build (frontend)
```bash
cd frontend
npx tsc --noEmit        # must be clean
npm run build           # vite build
```

### 3. Endpoint by role (manual)
Run the worker (`cd workers-api && npm run dev`) and call the endpoint with each role's token,
with and without `?company_id=`:
```bash
curl -s "$BASE/api/field-ops/active-today"                -H "Authorization: Bearer $TL_TOKEN"    # team lead: own agents, teamLeads empty
curl -s "$BASE/api/field-ops/active-today?company_id=$CO" -H "Authorization: Bearer $MGR_TOKEN"   # manager: both rosters, company-scoped
curl -s "$BASE/api/field-ops/active-today"                -H "Authorization: Bearer $ADMIN_TOKEN" # admin: tenant-wide, both rosters
curl -s "$BASE/api/field-ops/active-today"                -H "Authorization: Bearer $BO_TOKEN"    # back office: company-scoped agents
```
Confirm: counts and scoping are correct, and a seeded test agent (`agent-test-*` / first name
"test") is **excluded**.

### 4. Signal check (the definition itself)
For one agent, within today's work window:
- **(a) Signup only** — insert a `visit_individuals` row today → agent appears **active**,
  `lastActivity` = that signup time.
- **(b) GPS only** — `POST /api/gps-location/log` a fix (no signup) → still **active**,
  `lastActivity` = the ping time.
- **(c) Neither** → **inactive**, `lastActivity: null`.
- **(d) Both** → `lastActivity` = the later timestamp.

### 5. Cron parity (the reason we aligned it)
Give an agent a recent GPS ping today but **no** signup, then invoke `checkInactiveAgents` during
work hours (08:00–17:00 SAST, Mon–Fri). Expect **no** inactivity nudge to fire — previously it
would have, because the old query saw only signups.

### 6. Frontend end-to-end
Load each of the four dashboards:
- Tile shows "X of Y active today"; tapping expands the roster with correct green/grey dots.
- Manager & Back Office: switching the company pill refetches and the counts change.
- Admin: the "Active Today" card shows the split subtitle; the drill-down table lists people with
  active/inactive chips grouped by role.
