# FieldVibe Operations Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refocus FieldVibe on Goldrush individual signups — simplified agent PWA, configurable incentive engine, two new roles (GM, BO Admin), photo-OCR capture, inactivity escalation, and a mobile P&L — customer-generic, first customer Goldrush.

**Architecture:** Additive on the existing Cloudflare Workers (Hono monolith `api` at `workers-api/src/index.js:2781`) + D1 + R2 backend and React/Vite/Tailwind PWA. New backend logic lands in **new route modules under `workers-api/src/routes/field-ops/`** mounted on `api`, plus new services under `workers-api/src/services/`. New tables/columns via migration `0010` **and** mirrored into `schema.sql` (canonical). Frontend adds role-driven pages/nav; strips agent view to the signup flow. Every phase is independently deployable to dev.

**Tech Stack:** Cloudflare Workers (Hono, JS), D1 (SQLite), R2, Cron triggers; React 18 + Vite + Tailwind + MUI, Zustand, tesseract.js (on-device OCR), existing `offline-queue.service`, `CameraCapture`, `commissionService`.

## Global Constraints

- Customer-generic: everything keys on `tenant_id` + optional `company_id` (NULL = tenant default; company row overrides). Never hard-code "Goldrush" in logic; only in seed/config.
- New roles: `general_manager`, `backoffice_admin`. Roles are free-form strings on `users.role` + JWT `role`; authorize via `requireRole(...roles)` from `workers-api/src/middleware/auth.js`.
- Money base is **two-phase**: provisional counts feed pace/hero/leaderboard only; payable incentive uses **qualified** (`verification_status='qualified'`) counts after reconciliation. No clawback.
- Incentive shape: **step tiers** over **working days** — `avg≥20→R3500, ≥15→R2500, ≥10→R2000, <10→R0`, stored in `incentive_scales.tiers_json`, resolved per role/company. Working days exclude weekends + holiday calendar + approved leave.
- Timezone default `Africa/Johannesburg`; cron runs UTC, localizes before work-hours/training checks.
- Schema changes go in BOTH `migrations/0010_ops_redesign.sql` (numbered, applied to D1) and `workers-api/src/schema.sql` (canonical). Use `CREATE TABLE IF NOT EXISTS` and guard `ALTER` re-runs.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Publish to dev = push branch `dev` (triggers `.github/workflows/deploy-dev.yml`: wrangler `--env preview` + Pages). Apply migration to dev D1: `cd workers-api && npx wrangler d1 execute fieldvibe-dev --env preview --file=../migrations/0010_ops_redesign.sql --remote`.

---

## File Structure

**Backend (new):**
- `migrations/0010_ops_redesign.sql` — all net-new tables + column adds.
- `workers-api/src/services/incentiveService.js` — tier resolution, per-role metric calc, accrual, payable write.
- `workers-api/src/services/hierarchyService.js` — direct-reports / roll-up / drill-down given a node.
- `workers-api/src/services/reconciliationService.js` — parse import file, match on goldrush id, set verification status.
- `workers-api/src/services/inactivityService.js` — detect inactive users, escalation ladder, channel dispatch (stubbed providers).
- `workers-api/src/services/plService.js` — GM P&L computation.
- `workers-api/src/routes/field-ops/incentives.js` — incentive/hero/leaderboard endpoints.
- `workers-api/src/routes/field-ops/hierarchy.js` — roll-up/drill-down endpoints (TL/manager/GM).
- `workers-api/src/routes/field-ops/signups.js` — create/list signups (+ photo upload) — wraps `individual_registrations`.
- `workers-api/src/routes/field-ops/backoffice.js` — worklist, data-calls, training days, reconciliation import.
- `workers-api/src/routes/field-ops/gm.js` — P&L + BO oversight + totals.
- `workers-api/src/routes/field-ops/config.js` — `program_config` + `incentive_scales` CRUD (admin/GM).
- Modify `workers-api/src/index.js` — mount new modules on `api`; bump `last_activity_at` in a post-write hook; add cron handler branch.

**Frontend (new):**
- `frontend/src/services/fieldOps.service.ts` — client for all field-ops endpoints.
- `frontend/src/services/incentive.service.ts` — hero/leaderboard/incentive.
- `frontend/src/pages/agent/AgentHomePage.tsx` — simplified hero + primary action.
- `frontend/src/pages/agent/NewSignupPage.tsx` — camera → OCR → edit → save.
- `frontend/src/pages/field-ops/TeamDashboardPage.tsx` — shared roll-up/drill (TL/manager/GM param by role).
- `frontend/src/pages/gm/GmPnlPage.tsx` — mobile P&L.
- `frontend/src/pages/gm/BoOversightPage.tsx` — BO performance dashboard.
- `frontend/src/pages/backoffice/WorklistPage.tsx` — inactivity worklist + data-call + click-to-dial.
- `frontend/src/pages/backoffice/ReconciliationPage.tsx` — file upload import.
- `frontend/src/pages/backoffice/TrainingDaysPage.tsx` — booking.
- `frontend/src/components/HeroIncentive.tsx` — reusable incentive hero (day/week/month + next-tier + rank).
- Modify `frontend/src/config/navigation.ts`, `routes.registry.ts`, `App.tsx` router, `store/auth.store.ts` (role gates).

---

## PHASE 1 — Foundation: schema, roles, config, hierarchy resolver

**Deliverable:** migration applied to dev; new roles authorize; `program_config` + `incentive_scales` readable/writable; hierarchy resolver returns direct reports. No UI yet.

### Task 1.1: Migration `0010_ops_redesign.sql`

**Files:**
- Create: `migrations/0010_ops_redesign.sql`
- Modify: `workers-api/src/schema.sql` (append same DDL, canonical)

**Interfaces — Produces:** tables `incentive_scales`, `program_config`, `inactivity_events`, `data_calls`, `training_days`, `goldrush_imports`; columns `users.gm_id`, `users.last_activity_at`, `tenants.timezone`, `individual_registrations.goldrush_id_photo_url|verification_status|verified_at`.

- [ ] **Step 1: Write migration DDL** (exact — reuse spec §4.1, §9, §11, §12):

```sql
-- 0010_ops_redesign.sql — Operations redesign: incentive engine, new roles, inactivity, P&L
CREATE TABLE IF NOT EXISTS incentive_scales (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT,
  role TEXT NOT NULL, metric TEXT NOT NULL, tiers_json TEXT NOT NULL,
  basis TEXT DEFAULT 'working_days', period TEXT DEFAULT 'month',
  active INTEGER DEFAULT 1, effective_from TEXT, effective_to TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE IF NOT EXISTS program_config (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT,
  key TEXT NOT NULL, value_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE IF NOT EXISTS inactivity_events (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL,
  detected_at TEXT NOT NULL, resolved_at TEXT, resolved_by TEXT, data_call_id TEXT,
  escalation_level INTEGER DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE IF NOT EXISTS data_calls (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  bo_admin_id TEXT NOT NULL, target_user_id TEXT NOT NULL,
  inactivity_event_id TEXT, trigger TEXT DEFAULT 'inactivity',
  channel TEXT, notes TEXT, outcome TEXT,
  alerted_at TEXT, actioned_at TEXT, resulted_in_activity INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE IF NOT EXISTS training_days (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL,
  date TEXT NOT NULL, reason TEXT, created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE IF NOT EXISTS goldrush_imports (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT,
  uploaded_by TEXT NOT NULL, source TEXT, row_count INTEGER,
  matched_count INTEGER, unmatched_count INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_incentive_scales_lookup ON incentive_scales(tenant_id, company_id, role, active);
CREATE INDEX IF NOT EXISTS idx_program_config_lookup ON program_config(tenant_id, company_id, key);
CREATE INDEX IF NOT EXISTS idx_inactivity_open ON inactivity_events(tenant_id, resolved_at);
CREATE INDEX IF NOT EXISTS idx_data_calls_target ON data_calls(tenant_id, target_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_training_days_lookup ON training_days(tenant_id, user_id, date);
-- Column adds (ignore "duplicate column" error on re-run)
ALTER TABLE users ADD COLUMN gm_id TEXT;
ALTER TABLE users ADD COLUMN last_activity_at TEXT;
ALTER TABLE tenants ADD COLUMN timezone TEXT DEFAULT 'Africa/Johannesburg';
ALTER TABLE individual_registrations ADD COLUMN goldrush_id_photo_url TEXT;
ALTER TABLE individual_registrations ADD COLUMN verification_status TEXT DEFAULT 'provisional';
ALTER TABLE individual_registrations ADD COLUMN verified_at TEXT;
```

- [ ] **Step 2: Mirror the same DDL into `workers-api/src/schema.sql`** (append at end; `CREATE TABLE IF NOT EXISTS` blocks only — omit `ALTER` since schema.sql defines columns inline; add the six columns to the `users`/`tenants`/`individual_registrations` CREATE blocks directly).

- [ ] **Step 3: Apply to LOCAL dev D1 and verify tables exist**

Run: `cd workers-api && npx wrangler d1 execute fieldvibe-dev --env preview --local --file=../migrations/0010_ops_redesign.sql`
Then: `npx wrangler d1 execute fieldvibe-dev --env preview --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('incentive_scales','program_config','data_calls','training_days','goldrush_imports','inactivity_events');"`
Expected: 6 rows.

- [ ] **Step 4: Commit** — `feat(db): 0010 ops-redesign migration (incentive/config/inactivity/import tables + column adds)`

### Task 1.2: Config service + routes (`program_config`, `incentive_scales`)

**Files:**
- Create: `workers-api/src/routes/field-ops/config.js`
- Modify: `workers-api/src/index.js` (mount `api.route('/field-ops/config', configRoutes)` near existing field-ops mounts)

**Interfaces — Produces:**
- `getConfig(db, tenantId, companyId, key) → parsedValue|null` (company row wins over `company_id IS NULL`).
- `getScale(db, tenantId, companyId, role) → {tiers:[{min,amount}], metric, basis, period}|null`.
- Export both as named exports from `config.js` for reuse by other services.
- REST: `GET/PUT /api/field-ops/config?company_id=` (bulk key/value), `GET/PUT /api/field-ops/incentive-scales` — `requireRole('admin','general_manager')`.

- [ ] **Step 1:** Write `getConfig`/`getScale` with the company-override query:

```js
export async function getConfig(db, tenantId, companyId, key) {
  const row = await db.prepare(
    `SELECT value_json FROM program_config
     WHERE tenant_id=? AND key=? AND (company_id=? OR company_id IS NULL)
     ORDER BY company_id IS NULL ASC LIMIT 1`
  ).bind(tenantId, key, companyId ?? null).first();
  return row ? JSON.parse(row.value_json) : null;
}
export async function getScale(db, tenantId, companyId, role) {
  const row = await db.prepare(
    `SELECT tiers_json, metric, basis, period FROM incentive_scales
     WHERE tenant_id=? AND role=? AND active=1 AND (company_id=? OR company_id IS NULL)
     ORDER BY company_id IS NULL ASC LIMIT 1`
  ).bind(tenantId, role, companyId ?? null).first();
  return row ? { tiers: JSON.parse(row.tiers_json), metric: row.metric, basis: row.basis, period: row.period } : null;
}
```

- [ ] **Step 2:** Add PUT handlers (upsert by tenant+company+key / tenant+company+role) and GET handlers. Use `crypto.randomUUID()` for ids, `requireRole('admin','general_manager')`.
- [ ] **Step 3:** Mount in `index.js`; add a test hitting `GET /api/field-ops/config` returns `{}` for empty tenant (200).
- [ ] **Step 4: Seed defaults** — add an idempotent seed (in `config.js` `POST /field-ops/config/seed-defaults`, admin-only) writing Goldrush defaults: agent/team_lead/manager scales `[{"min":10,"amount":2000},{"min":15,"amount":2500},{"min":20,"amount":3500}]`, BO scale `metric:reactivations` flat (`[{"min":1,"amount":50}]`), `commission_per_deposit:75`, `work_hours:{start:"08:00",end:"17:00"}`, `inactivity_minutes:60`, `working_days_in_month:22`, `reactivation_window:120`, `escalate_steps:[{after_min:0,to:"employee"},{after_min:30,to:"team_lead"},{after_min:60,to:"manager"}]`, `salaries:{manager:0,bo:0,gm:0}`, `leaderboard_visible:true`.
- [ ] **Step 5: Commit** — `feat(field-ops): program_config + incentive_scales service, routes, seed defaults`

### Task 1.3: Roles + hierarchy resolver

**Files:**
- Create: `workers-api/src/services/hierarchyService.js`
- Modify: `workers-api/src/routes/field-ops/hierarchy.js` (created here), `index.js` (mount), `users` create/update handler in `index.js` (allow new roles + `gm_id`)

**Interfaces — Produces:**
- `directReports(db, tenantId, userId, role) → users[]` — agents by `team_lead_id`, TLs by `manager_id`, managers by `gm_id`.
- `subtreeUserIds(db, tenantId, userId, role) → string[]` — all agent ids beneath a node (for metric roll-up).

- [ ] **Step 1:** Implement `directReports` (switch on role → column) and `subtreeUserIds` (recurse down to agents).
- [ ] **Step 2:** Grep `index.js` for the role whitelist in user create/update; add `general_manager`, `backoffice_admin`; accept `gm_id`. Run: `grep -n "team_lead'\|'manager'\|allowedRoles\|role ===" workers-api/src/index.js | head`.
- [ ] **Step 3:** `GET /api/field-ops/hierarchy/reports` returns direct reports for caller (or `?user_id=` for drill-down, authz: must be ancestor). Mount.
- [ ] **Step 4:** Test: seed a GM→manager→TL→agent chain in local D1, assert `subtreeUserIds(gm)` includes the agent.
- [ ] **Step 5: Commit** — `feat(field-ops): new roles + hierarchy resolver (direct reports, subtree)`

**PHASE 1 dev deploy:** merge to `dev`; apply migration remote (`--remote`); smoke `GET /api/field-ops/config`.

---

## PHASE 2 — Incentive engine

**Deliverable:** given a user + period, compute metric, tier, accrual, provisional pace, and payable (qualified) amount; write payable to `commission_earnings`.

### Task 2.1: `incentiveService.js` core math

**Files:** Create `workers-api/src/services/incentiveService.js`. Test: `workers-api/tests/unit/incentiveService.test.js`.

**Interfaces — Consumes:** `getScale`, `getConfig` (Task 1.2), `subtreeUserIds` (Task 1.3). **Produces:**
- `tierAmount(tiers, metricValue) → number` — highest `min` ≤ value, else 0.
- `workingDaysElapsed(db, tenantId, companyId, asOf) → int` and `workingDaysInMonth(...) → int` — exclude weekends + `holiday_calendar` config + `training_days`/leave.
- `agentMetric(db, tenantId, companyId, agentId, period, {status}) → {count, avg}` — `status='qualified'` for payable, `'provisional'` (all rows) for pace.
- `teamMetric(db, ..., userId, role, period) → {avg}` — mean of member agent avgs, excluding <3-working-day joiners.
- `computeIncentive(db, tenantId, companyId, userId, role, period) → {metricValue, monthlyTarget, accruedToDate, provisionalPace, payable}`.

- [ ] **Step 1: Write failing test for `tierAmount`:**

```js
import { tierAmount } from '../../src/services/incentiveService.js';
test('tierAmount steps', () => {
  const t = [{min:10,amount:2000},{min:15,amount:2500},{min:20,amount:3500}];
  expect(tierAmount(t, 9)).toBe(0);
  expect(tierAmount(t, 12)).toBe(2000);
  expect(tierAmount(t, 20)).toBe(3500);
  expect(tierAmount(t, 25)).toBe(3500);
});
```
- [ ] **Step 2:** Run `npx vitest run tests/unit/incentiveService.test.js` → FAIL.
- [ ] **Step 3:** Implement `tierAmount`: `tiers.filter(t=>v>=t.min).sort((a,b)=>b.min-a.min)[0]?.amount ?? 0`.
- [ ] **Step 4:** Implement `agentMetric` (COUNT of `individual_registrations` for agent in period; `status` maps to `verification_status`; `avg = count / workingDaysElapsed`), `teamMetric` (mean of member avgs w/ grace), `computeIncentive` (payable = `tierAmount(scale.tiers, qualifiedMetric)`; accrual per spec §4.4). Add tests for `agentMetric` avg and grace exclusion using seeded local D1 rows.
- [ ] **Step 5:** Run tests → PASS. **Commit** — `feat(field-ops): incentive engine (tiers, working days, agent/team metric, accrual)`

### Task 2.2: Payable write + month close

**Files:** Modify `incentiveService.js`; Create `workers-api/src/routes/field-ops/incentives.js`; mount in `index.js`.

**Interfaces — Produces:** `writePayable(db, tenantId, userId, period, amount, sourceType)` → upserts `commission_earnings` (reuse existing columns: `earner_id`, `period`, `amount`, `status`, `source_type`). `GET /api/field-ops/incentives/me?period=` returns `computeIncentive` for caller. `POST /api/field-ops/incentives/close` (admin) — after import, compute payable for all earners in period, write, set `status='approved'`.

- [ ] **Step 1:** Implement `writePayable` (find existing earning for earner+period+source; update or insert; never lower an already-approved amount — true-up only up).
- [ ] **Step 2:** Endpoints + `requireRole`. Test `GET /incentives/me` returns shape `{metricValue, monthlyTarget, accruedToDate, provisionalPace, payable}`.
- [ ] **Step 3: Commit** — `feat(field-ops): payable write to commission_earnings + month-close endpoint`

**PHASE 2 dev deploy:** push `dev`; smoke `GET /api/field-ops/incentives/me`.

---

## PHASE 3 — Simplified agent PWA: capture + OCR + hero + leaderboard

**Deliverable:** agent logs in → sees hero (pace, R earned day/week/month, next-tier, rank) + one primary button → New Signup → camera → OCR autofills goldrush id → edit → save (offline-capable, photo stored). Non-Goldrush screens removed from agent nav.

### Task 3.1: Signups API + photo storage

**Files:** Create `workers-api/src/routes/field-ops/signups.js`; mount; uses R2 `UPLOADS` binding.

**Interfaces — Produces:** `POST /api/field-ops/signups` (body: first_name,last_name,product_app_player_id,phone,id_number,gps,photo_base64?) → inserts `individual_registrations` with `verification_status='provisional'`; if `photo_base64`, uploads to R2 key `goldrush-id/<tenant>/<id>.jpg`, sets `goldrush_id_photo_url`. `GET /api/field-ops/signups/me?period=` lists caller's signups with status. Reuse existing 9-digit + uniqueness enforcement (grep current validation, call same helper).

- [ ] **Step 1:** Grep existing signup insert path: `grep -n "individual_registrations\|product_app_player_id" workers-api/src/index.js | head`. Reuse its validation helper.
- [ ] **Step 2:** Implement POST (dedup via existing partial unique indexes → catch constraint error, return 409 with clear message) + GET. R2 put with base64 decode.
- [ ] **Step 3:** Test POST returns 201 + row has `verification_status='provisional'`; duplicate id_number returns 409.
- [ ] **Step 4: Commit** — `feat(field-ops): signup capture API + R2 photo storage + provisional status`

### Task 3.2: Hero + leaderboard endpoints

**Files:** Modify `incentives.js`.

**Interfaces — Produces:** `GET /api/field-ops/incentives/hero?period=` → `{today:{count}, week:{count}, month:{provisionalPace, payable, metricValue}, nextTier:{needPerDay, amount}, rank, totalPeers}`. `GET /api/field-ops/leaderboard?scope=team|company` (respects `leaderboard_visible` config).

- [ ] **Step 1:** Implement hero aggregation (today/week/month counts by `created_at`; nextTier = next tier `min` above current metric → `ceil(needed avg × workingDaysInMonth − currentCount)/remainingDays`). Leaderboard = agents ranked by provisional count in period.
- [ ] **Step 2:** Test hero returns numbers for seeded agent. **Commit** — `feat(field-ops): hero + leaderboard endpoints`

### Task 3.3: Frontend — service + hero component + agent home + signup page

**Files:** Create `frontend/src/services/fieldOps.service.ts`, `incentive.service.ts`, `components/HeroIncentive.tsx`, `pages/agent/AgentHomePage.tsx`, `pages/agent/NewSignupPage.tsx`. Modify `config/navigation.ts`, `routes.registry.ts`, `App.tsx`, offline queue registration.

**Interfaces — Consumes:** endpoints from 3.1/3.2. **Produces:** routes `/agent` (home), `/agent/signup` (new signup).

- [ ] **Step 1:** `fieldOps.service.ts` + `incentive.service.ts` wrap the endpoints (follow `individuals.service.ts` pattern; use existing `api.service.ts`).
- [ ] **Step 2:** `HeroIncentive.tsx` — big R number (month payable), pace bar to next tier, day/week/month chips, rank badge. Tailwind/MUI per existing components.
- [ ] **Step 3:** `NewSignupPage.tsx` — reuse `CameraCapture` + `photo-compression`; run tesseract.js on captured image, regex `\b\d{9}\b` → autofill `product_app_player_id` (editable); other fields manual; submit via `fieldOps.service` → on offline, enqueue via `offline-queue.service` (counts locally immediately).
- [ ] **Step 4:** `AgentHomePage.tsx` — `HeroIncentive` + primary "New Goldrush Signup" button + recent signups list w/ status chips.
- [ ] **Step 5:** Strip agent nav: in `navigation.ts` gate trade-marketing/POS/board-placement items so `agent` role doesn't see them; agent sees Home + Signups only. Register routes in `routes.registry.ts` + `App.tsx`.
- [ ] **Step 6:** `npm run build` + `npm run typecheck` pass. **Commit** — `feat(agent): simplified home, hero, camera-OCR signup capture`

**PHASE 3 dev deploy:** push `dev`; log in as agent on dev, capture a signup, confirm hero updates.

---

## PHASE 4 — Reconciliation import → confirmed payout

**Deliverable:** BO/GM uploads Goldrush CSV/Excel; rows matched on goldrush id flip to `qualified`/`rejected`; month-close pays on qualified.

### Task 4.1: `reconciliationService.js` + import endpoint

**Files:** Create `workers-api/src/services/reconciliationService.js`; add import handler to `workers-api/src/routes/field-ops/backoffice.js` (create module); mount.

**Interfaces — Produces:** `parseImport(fileText, mime) → rows[{goldrush_id, status, deposited, deposit_date}]` (CSV via split; xlsx → require agents to export CSV in phase 1, `ponytail:` note). `applyImport(db, tenantId, companyId, rows, uploadedBy) → {matched, unmatched, rejected}` — updates `individual_registrations.verification_status`, `verified_at`, and on deposit `converted=1`+`conversion_date`; writes `goldrush_imports` summary row.

- [ ] **Step 1:** Implement CSV parse (header row → map `goldrush_id`/`status`/`deposit_date` columns, tolerant of naming). Test with a sample CSV string.
- [ ] **Step 2:** Implement `applyImport` (match on `product_app_player_id` within tenant; collect unmatched). Test: seed 2 provisional signups, import marks one qualified.
- [ ] **Step 3:** `POST /api/field-ops/reconciliation/import` (multipart or base64 text body), `requireRole('backoffice_admin','general_manager','admin')`. Returns summary.
- [ ] **Step 4: Commit** — `feat(field-ops): Goldrush reconciliation import (match on goldrush id, verification status)`

### Task 4.2: Frontend reconciliation page

**Files:** Create `frontend/src/pages/backoffice/ReconciliationPage.tsx`; register route `/backoffice/reconciliation`.

- [ ] **Step 1:** File picker → read as text → POST → show matched/unmatched/rejected summary + unmatched list. Build+typecheck pass. **Commit** — `feat(backoffice): reconciliation import UI`

**PHASE 4 dev deploy:** push `dev`; import a sample file, run month-close, confirm payable reflects qualified.

---

## PHASE 5 — Inactivity cron + escalation + channels + training days

**Deliverable:** cron every 15 min flags inactive users in work hours (skip training days), escalates per ladder, dispatches push (SMS/WhatsApp stubbed), creates BO worklist items.

### Task 5.1: `last_activity_at` bump

**Files:** Modify `index.js` — central post-auth write hook.

- [ ] **Step 1:** Add middleware after `authMiddleware` on mutating field-ops routes: on 2xx write, `UPDATE users SET last_activity_at=? WHERE id=?`. Grep for a shared write path; if none, bump inside signup/visit/check-in handlers. **Commit** — `feat(field-ops): bump users.last_activity_at on writes`

### Task 5.2: `inactivityService.js` + cron handler

**Files:** Create `workers-api/src/services/inactivityService.js`; modify `index.js` scheduled handler + `wrangler.toml` (cron already has 15-min-ish set; add `*/15 * * * *` if absent — current crons are hourly, add finer).

**Interfaces — Consumes:** `getConfig` (work_hours, inactivity_minutes, escalate_steps, timezone). **Produces:** `runInactivitySweep(db, env, nowUtc)` — for each active user: localize, check work hours + not training day + `now-last_activity_at>inactivity_minutes` → open/advance `inactivity_events`, dispatch per `escalate_steps`, create BO worklist (an unresolved `inactivity_event` IS the worklist item).

- [ ] **Step 1:** Implement timezone localize (Intl with tenant tz), work-hours check, training-day check (`training_days` for user+date). Test pure helpers with fixed `nowUtc` (no `Date.now()`).
- [ ] **Step 2:** Implement escalation: track `escalation_level` on event; each sweep advances if still inactive past next `after_min`. Channel dispatch: push via existing `push_subscriptions`; SMS/WhatsApp = `sendViaProvider()` stub that logs + records intent (`ponytail:` live key later).
- [ ] **Step 3:** Wire into scheduled handler branch keyed on cron. Add finer cron to `wrangler.toml` if needed.
- [ ] **Step 4:** Test sweep opens an event for an inactive seeded user and skips a training-day user. **Commit** — `feat(field-ops): inactivity sweep cron + escalation ladder + channel stubs`

### Task 5.3: Training days API + page

**Files:** Add handlers to `backoffice.js`; create `frontend/src/pages/backoffice/TrainingDaysPage.tsx`.

- [ ] **Step 1:** `GET/POST/DELETE /api/field-ops/training-days` (BO admin), route `/backoffice/training`. Build+typecheck. **Commit** — `feat(backoffice): training-day booking (suppresses inactivity)`

**PHASE 5 dev deploy:** push `dev`; force-age a dev user's `last_activity_at`, trigger cron (`wrangler dev` scheduled or wait), confirm event created.

---

## PHASE 6 — BO Admin PWA: worklist + data-calls + reactivation credit

**Deliverable:** BO admin sees inactivity worklist, taps call (tel:/wa.me) → logs data-call, records outcome; reactivation within window credits BO incentive.

### Task 6.1: Data-call API + reactivation credit

**Files:** Add to `backoffice.js`; modify `incentiveService.js` (reactivation count for BO metric).

**Interfaces — Produces:** `GET /api/field-ops/backoffice/worklist` (open `inactivity_events` in BO's pool + target contact). `POST /api/field-ops/backoffice/data-calls` (target_user_id, channel, notes, inactivity_event_id) → stamps `alerted_at`/`actioned_at`, links event. Reactivation: a scheduled/inline check — if target `last_activity_at` advances within `reactivation_window` of a data-call, set `resulted_in_activity=1` + resolve event. BO incentive metric = COUNT data_calls `resulted_in_activity=1` in period.

- [ ] **Step 1:** Implement worklist query (join event→user, filter BO pool — pool = users where assigned BO; phase-1 pool = all in tenant, `ponytail:` per-BO assignment later). 
- [ ] **Step 2:** Implement data-call create (stamps times). Reactivation resolver runs in the inactivity sweep (compare event's target activity vs data-call time). Add `reactivations(db,tenant,boId,period)` to `incentiveService`.
- [ ] **Step 3:** Test: create data-call, bump target activity, sweep sets `resulted_in_activity=1`. **Commit** — `feat(field-ops): data-calls + reactivation credit`

### Task 6.2: Worklist page + click-to-dial

**Files:** Create `frontend/src/pages/backoffice/WorklistPage.tsx`; BO nav + `HeroIncentive` (reactivation basis).

- [ ] **Step 1:** Worklist rows with target name/phone + Call button (`tel:`) + WhatsApp button (`https://wa.me/`) → onClick POSTs data-call then opens link; outcome form. BO home shows reactivation hero. Build+typecheck. **Commit** — `feat(backoffice): inactivity worklist + click-to-dial data-calls + reactivation hero`

**PHASE 6 dev deploy:** push `dev`; action a worklist item on dev.

---

## PHASE 7 — GM PWA: roll-up drill-down + totals + P&L + BO oversight

**Deliverable:** GM sees manager averages → drill to TL → agent (same metric); total signups; Goldrush revenue; mobile P&L; BO performance dashboard.

### Task 7.1: `plService.js` + GM endpoints

**Files:** Create `workers-api/src/services/plService.js`; create `workers-api/src/routes/field-ops/gm.js`; mount.

**Interfaces — Consumes:** `getConfig` (salaries, commission_per_deposit), `hierarchyService`, `incentiveService`. **Produces:** `computePnl(db,tenant,companyId,range) → {revenue, deposits, signups, conversionRate, costs:{manager,bo,gm}, net, incentiveMemo}`. Endpoints: `GET /api/field-ops/gm/pnl?company_id=&from=&to=`, `GET /api/field-ops/gm/totals`, `GET /api/field-ops/gm/rollup` (managers' metric, drillable via `?user_id=`), `GET /api/field-ops/gm/bo-performance?from=&to=` (per BO: alerts_assigned, actioned, response_rate, avg_time_to_action, reactivations, reactivation_rate). `requireRole('general_manager','admin')`.

- [ ] **Step 1:** Implement `computePnl` (revenue = `commission_per_deposit × count(converted=1 AND conversion_date in range)`; conversionRate = deposits/signups; net = revenue − sum salaries; incentiveMemo = sum confirmed `commission_earnings` in period). Test with seeded data.
- [ ] **Step 2:** Implement rollup (managers → mean of their metric via `teamMetric`; drill-down authz: caller must be ancestor). BO-performance aggregation from `data_calls`/`inactivity_events`.
- [ ] **Step 3:** Endpoints + tests. **Commit** — `feat(field-ops): GM P&L + rollup + BO-performance endpoints`

### Task 7.2: GM pages

**Files:** Create `frontend/src/pages/field-ops/TeamDashboardPage.tsx` (shared roll-up/drill, param by role), `pages/gm/GmPnlPage.tsx`, `pages/gm/BoOversightPage.tsx`; GM nav + routes.

- [ ] **Step 1:** `TeamDashboardPage` — list reports with avg + tap to drill (recursive to agent). Used by TL/manager/GM (role picks starting node).
- [ ] **Step 2:** `GmPnlPage` — mobile cards: revenue, deposits, conversion %, costs breakdown, net (big), incentive memo; company selector + date range.
- [ ] **Step 3:** `BoOversightPage` — table per BO admin with the 6 KPIs; training-days visibility. Build+typecheck. **Commit** — `feat(gm): rollup dashboard + mobile P&L + BO oversight`

**PHASE 7 dev deploy:** push `dev`; view P&L as GM on dev.

---

## PHASE 8 — Team lead / manager dashboards + store visits

**Deliverable:** TL gets Store Visits (reuse `VisitWorkflow`) + team dashboard + own incentive; manager gets TL roll-up + own incentive.

### Task 8.1: Wire TL/manager nav + reuse TeamDashboard + store visits

**Files:** Modify `navigation.ts`, `routes.registry.ts`, `App.tsx`; reuse `TeamDashboardPage` (7.2) and existing `VisitWorkflowPage.tsx`.

- [ ] **Step 1:** Add nav for `team_lead` (Home hero on team avg, Team Dashboard, Store Visits → existing `/field-operations` visit workflow, own signups) and `manager` (Team Dashboard on TLs, own incentive). Ensure `incentives/me` + `hero` work for TL/manager metric (Phase 2 `teamMetric` already covers).
- [ ] **Step 2:** Confirm TL store-visit route reuses `VisitWorkflowPage` unchanged. Build+typecheck. **Commit** — `feat(team-lead,manager): dashboards, team-avg hero, store-visits wiring`

**PHASE 8 dev deploy:** push `dev`; full role walkthrough on dev.

---

## Self-Review notes

- **Spec coverage:** §4 incentive → P1.2/P2; §5 roles/hierarchy → P1.3; §6 PWAs → P3/P6/P7/P8; §7 capture/OCR → P3; §8 inactivity → P5; §9 data-calls/reactivation/oversight → P6/P7.1; §10 P&L → P7.1; §11 config → P1.2; §12 import → P4; §13 schema → P1.1. All sections mapped.
- **Two-phase money:** provisional at capture (P3.1), qualified at import (P4.1), payable uses qualified (P2.2). Consistent.
- **Deploy:** each phase pushes `dev`; migration applied `--remote` once in P1.
- **Naming consistency:** `getScale`/`getConfig`/`directReports`/`subtreeUserIds`/`tierAmount`/`agentMetric`/`teamMetric`/`computeIncentive`/`computePnl` used consistently across tasks.
