# GM KPIs + Daily Digest — Design Spec

**Date:** 2026-07-06
**Role in scope:** `general_manager` (GM)
**Requests:**
1. "The GM should have all the KPIs and measures on the [web] view and mobile app that are relevant to driving the business."
2. "She should have a summary mail at 6am, 12pm and 18:00 for the day, as well as notifications in-app."

## Goal

Give the GM a single business-driving KPI overview — rendered on both the web view and the mobile `/agent` app — plus a thrice-daily (06:00 / 12:00 / 18:00 SAST) email digest and matching in-app notification.

## Context (what already exists)

- **GM role is thin**: wired only into `workers-api/src/routes/field-ops/incentives.js` and the mobile `/agent` frontend. GM logs in and lands on `frontend/src/pages/agent/GMPnl.tsx` (`/agent/pnl`), which renders the P&L card from `GET /api/field-ops/incentives/pnl`. GM has no web presence and no cross-metric overview.
- **KPI sources (all present)**:
  - `GET /api/field-ops/incentives/pnl` — signups, converted, qualified, revenue, incentiveCost, salaryCost, net, projected/on-pace (incentives.js:226).
  - `GET /api/field-ops/incentives/roster` — field agents with today's signup count + last_activity, least-active first (incentives.js:292).
  - `GET /api/field-ops/leaderboard` — agents ranked by period signups+converted (incentives.js:112).
  - `workers-api/src/services/incentiveService.js` — `agentCount`, `computeIncentive`, `teamMetric`, `agentMetric`, working-days helpers.
  - `bo_calls` table (migration 0012) — BO call productivity: contacted/day.
- **Email**: `sendEmailViaMailChannels(env, {...})` at `workers-api/src/index.js:21047` (MailChannels HTTP `fetch`, no key, domain-locked). HTML helpers `htmlEscape` (:21071), `tableHtml` (:21075), `kpiHtml` (:21082). From `reports@fieldvibe.vantax.co.za`.
- **Cron**: `wrangler.toml` `[triggers] crons` already includes `"0 4 * * *"`, `"0 10 * * *"`, `"0 16 * * *"` (UTC) = **06:00 / 12:00 / 18:00 SAST**. The scheduled handler at `index.js:21374` branches on `getUTCHours()`. **No wrangler.toml change required.**
- **Notifications**: `notifications` table (id, tenant_id, user_id, type, title, message, is_read, related_type, related_id, created_at) from `migrations/0001_baseline.sql:491`. Endpoints `GET /api/notifications` (:4531), mark-read (:4548). Producer pattern: `generatePerformanceSummaries` inserts rows (:20882). Bell UI `frontend/src/components/ui/NotificationCenter.tsx` is rendered **only** in web `Header.tsx:95` — the mobile `/agent` layout has no bell.

## Decisions (locked)

- **Web scope**: Overview dashboard page only. GM stays otherwise mobile-first; no broad web role-wiring.
- **Digest recipients**: every user with role `general_manager` in the tenant (email + in-app notification each).
- **Cron slots**: reuse existing `0 4 / 0 10 / 0 16` UTC crons; branch in the scheduled handler.
- **No new tables**: reuse `notifications`. No new email provider. No `action_url` column.

## Architecture

### 1. One overview endpoint (backend)

New router `workers-api/src/routes/field-ops/gm.js`, mounted `api.route('/field-ops', gmRoutes)` in `index.js` (same pattern as calls/incentives). Global auth already covers it.

```
GET /api/field-ops/gm/overview?period=day|week|month   (requireRole('admin','general_manager'))
```

Returns a single composed payload (no new metric math — reuses existing queries/service fns):

```json
{
  "success": true,
  "period": "day",
  "money":   { "revenue": 0, "incentiveCost": 0, "salaryCost": 0, "net": 0 },
  "funnel":  { "signups": 0, "converted": 0, "qualified": 0, "conversionRate": 0, "onPace": 0, "target": 0 },
  "field":   { "activeAgents": 0, "totalAgents": 0, "visitsIndividual": 0, "visitsStore": 0,
               "leastActive": [ { "user_id": "", "name": "", "signups": 0, "last_activity": "" } ] },
  "leaders": [ { "user_id": "", "name": "", "score": 0 } ],
  "calls":   { "contacted": 0, "target": 0 }
}
```

- `money` + `funnel`: reuse the pnl computation (extract its core into a shared helper the endpoint and digest both call).
- `field.leastActive`: reuse the roster query (top 3 least active).
- `leaders`: reuse the leaderboard query (top 3).
- `calls`: aggregate `bo_calls` — `COUNT(DISTINCT callee_id)` answered today across BO agents vs summed `bo_call_targets`.

**Shared assembly fn** (pure, testable): `buildGmOverview(db, tenantId, companyId, period)` — exported from `gm.js`, returns the payload above. The endpoint wraps it; the digest calls it directly.

### 2. Digest (backend)

New `generateGmDigest(env)` beside `generatePerformanceSummaries` in `index.js`. Flow:

1. For each tenant with ≥1 `general_manager` user (single query grouping GMs by tenant/company):
2. `buildGmOverview(env.DB, tenantId, companyId, 'day')`.
3. Build HTML via existing `kpiHtml`/`tableHtml`; `sendEmailViaMailChannels(env, { to: gmEmail, subject: 'FieldVibe daily summary — <slot>', html })` per GM.
4. Insert one `notifications` row per GM: `type='gm_digest'`, title `Daily summary (<slot>)`, message = one-line KPI recap.

Slot label derived from SAST hour (06:00→"morning", 12:00→"midday", 18:00→"evening").

**Scheduled handler** (`index.js:21374`): add
```js
if (hour === 4 || hour === 10 || hour === 16) await generateGmDigest(env);
```
(UTC hours = the three SAST slots). Wrapped in try/catch like the sibling jobs.

### 3. Web overview page (frontend)

New page `frontend/src/pages/dashboard/GmOverviewPage.tsx`, routed and gated to `general_manager` (reuse existing role-guard pattern in `App.tsx` / dashboard routing). Renders the `/gm/overview` payload as KPI cards grouped Money / Growth funnel / Field force / Top performers / BO calls, with a day|week|month period toggle. Reuses `DashboardPage.tsx` card/layout components.

### 4. Mobile overview + bell (frontend)

- Add an **Overview/Home** tab to the GM bottom-nav in `frontend/src/pages/agent/AgentLayout.tsx` (currently P&L / Stats / Profile). New `frontend/src/pages/agent/GmOverview.tsx` renders the same `/gm/overview` payload with the mobile `StatCard` components.
- Mount `NotificationCenter` (existing web bell component) into the mobile `AgentLayout` header so GM sees in-app notifications. If the component has web-only styling assumptions, wrap minimally; do not fork it.

## Data flow

```
scheduled(0 4|10|16 UTC) → generateGmDigest(env)
    → per tenant GM: buildGmOverview(DB) → kpiHtml → sendEmailViaMailChannels
                                        └→ INSERT notifications (type=gm_digest)

GET /gm/overview → buildGmOverview(DB) → JSON
    ├→ web  GmOverviewPage.tsx  (cards)
    └→ mobile GmOverview.tsx    (StatCards) + NotificationCenter bell
```

## Error handling

- `buildGmOverview` sub-queries wrapped so one failing metric returns `0`/`[]` for that block, not a 500 — the overview degrades gracefully.
- Digest: per-GM send wrapped in try/catch; a failed email is logged and does not abort the loop (mirrors `sendWeeklyGoldrushReports`). Notification insert independent of email success.
- Endpoint returns `403` for non-GM/non-admin (via `requireRole`).

## Testing

- **Pure unit** (`test:pure`, node env): `buildGmOverview` payload shape + `conversionRate`/`onPace`/`net` arithmetic against a stub DB (mock `.prepare().bind().all/first`). Digest slot-label mapping (hour → morning/midday/evening).
- Add test file to `workers-api/tests/unit/vitest.node.config.js` include list.

## Out of scope (YAGNI)

- No per-role notification preferences.
- No `action_url` deep-link column.
- No new email templating engine or provider.
- No historical/trend charts (KPIs are current-period snapshots).
- No broad GM web role-wiring beyond the overview page.
