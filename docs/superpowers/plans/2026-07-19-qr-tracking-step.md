# Spec — QR Tracking Step (single-use, per-visit, redirect + scan analytics)

**Author:** Luke • **Date:** 2026-07-19 • **Branch base:** `dev` (create topic branch `feat/qr-tracking-step`)
**Status:** SPEC ONLY — no code written. All open questions resolved (see §11). Ready for approval → Phase 4 (TDD implementation).

---

## 1. Summary

Add a new **QR** step type to Process Flows. When an admin builds a check-in or questionnaire
flow, they can add a "QR Code" step and attach a **destination URL**. At runtime, each visit
that runs this step generates a **unique, single-use** tracking code rendered as a scannable QR.
Members of the public scan it on **their own device**, get **redirected** to the destination URL,
and each scan is recorded. The first scan of a code = one tracked person (the code is then
"redeemed"); the agent generates a fresh code for the next person. Codes are **rerollable**.

Scan analytics (people reached / total scans, broken down by agent & company) are surfaced to
**admins and managers**, on the **process-flow admin view**, the **P&L dashboard**, the **GM
Overview**, and a **per-agent manager breakdown**.

### Decisions locked in (from clarifying Q&A, 2026-07-19)

| Axis | Decision |
|---|---|
| **Code lifecycle** | **One code = one single scan.** First scan redeems the code (counts as 1 person); code then dead for redemption. A new code is issued for the next person (manual "next" / reroll, optional auto-advance). |
| **Link & scope** | **Admin sets the destination URL on the step.** Each visit generates its own unique code(s) → analytics break down by agent / company / visit. |
| **Unique counting** | **Raw scan count, no device dedupe** (no cookies/fingerprinting). "Unique people" is enforced structurally by single-use codes (1 redeemed code = 1 person); `total_scans` counts every hit. |
| **Analytics surfaces** | All four: (a) per-step process-flow admin view, (b) P&L tile (`GMPnl`), (c) GM Overview (`GmOverviewPage` + mobile `GmOverview`), (d) manager per-agent breakdown. |

### The single-use ↔ raw-count reconciliation (explicit)

These two answers appear to conflict; the resolution baked into this spec:

- A code has status `active → redeemed → (revoked)`.
- **Every** hit on the scan URL inserts a `qr_scan_events` row and **always 302-redirects** to the
  destination (so a visitor who re-scans or refreshes is never stranded).
- Only the **first** hit flips `active→redeemed` and is flagged `is_redemption = 1`.
- **`people_reached` = count of redemptions.** **`total_scans` = count of all scan events.**
- **Resolved (Q3):** a re-hit of an already-**redeemed** code **still redirects** and is counted as a
  non-redemption scan (honors "the link works" + "raw scan count, refresh = +1"). A **revoked** code
  (deliberately rerolled) returns **410**. Unknown token → 404.

---

## 2. Grounding (verified `file:line`)

- Step registry: `frontend/src/pages/field-operations/ProcessFlowManagementPage.tsx:118-128` (`AVAILABLE_STEPS`).
- Per-step config UI precedent (`survey` writes `config.questionnaire_id`): `ProcessFlowManagementPage.tsx:662-700`.
- Step add/remove/move/serialize: `ProcessFlowManagementPage.tsx:549-573`, save `:529-535`, load-parse `:511-514`.
- Runtime dispatch switch: `frontend/src/pages/field-operations/visits/VisitCreate.tsx:2970-2981`.
- Runtime validation switches: `VisitCreate.tsx:1130`, `:1243`; step config parse `parseStepConfig` `:213`; default step arrays `:140-196`.
- Step storage table `process_flow_steps(step_key, step_label, step_order, is_required, config JSON)`: `migrations/0001_baseline.sql:1231-1236` (no schema change needed to STORE the step).
- Step CRUD (generic passthrough, delete+reinsert on update): `workers-api/src/routes/platform.js:414-473`.
- Runtime flow fetch: `workers-api/src/routes/fieldOps.js:1122-1150` (`GET /visit-process-flow`).
- Public/unauth pattern to mirror: `workers-api/src/routes/companyPortal.js:22-42` (`hmacHex`, `timingSafeEqualStr`), public verifier mounted on `app` not `api` (`workers-api/src/index.js` app-level routes, e.g. `/api/uploads/:key` `index.js:235-263`).
- Auth mounting: `workers-api/src/index.js:128-131` (`api.use('*', authMiddleware)`), `api` mounted at `/api` `index.js:266`.
- Fact-store pattern to mirror (tenant/company scoping, NULL-safe unique index, `INSERT OR IGNORE`): `migrations/0019_metric_facts.sql`. Latest migration = `0021` → new one is **`0022`**.
- ID gen house style: `crypto.randomUUID()` / `crypto.getRandomValues` (e.g. `index.js:57,89`, `lib/web-push.js:72`).
- Roles: `workers-api/src/lib/capabilities.js` — `ADMIN_EQUIVALENT=['admin','backoffice_admin','general_manager']:5`, `FIELD_ROLES:9`, `roleAllows:19-24`; `requireRole` `lib/middleware.js:95-104`.
- P&L page: `frontend/src/pages/agent/GMPnl.tsx:71` ← `GET /field-ops/incentives/pnl`; backend `workers-api/src/routes/field-ops/incentives.js:230-233` (`requireRole('admin','general_manager')`).
- GM overview web: `frontend/src/pages/dashboard/GmOverviewPage.tsx:163-168` ← `field-ops/gm.js` `buildGmOverview():87`, `GET /gm/overview:567`; mobile `frontend/src/pages/agent/GmOverview.tsx:103`.
- Analytics aggregate-on-read pattern: `workers-api/src/routes/analytics.js:39-101`.
- DB = Cloudflare D1, binding `DB`, migrations at repo-root `migrations/`, **applied manually** (`docs/superpowers/plans/2026-07-12-per-company-fieldops.md:14`).
- Deploy: Worker API at `fieldvibe-api.vantax.co.za` (`workers-api/wrangler.toml:8-10`); frontend = CF Pages SPA (separate host). **No QR lib in either `package.json`** (verified).
- Tests: **vitest** both sides. Worker unit tests in `workers-api/tests/unit/*.test.js` (e.g. `gmOverview.test.js`); frontend vitest `^1.2.0`.

---

## 3. Data model — migration `migrations/0022_qr_tracking.sql`

Mirror the conventions in `0019_metric_facts.sql` (tenant/company scoping, explicit indexes).

```sql
-- One row per generated single-use code
CREATE TABLE IF NOT EXISTS qr_codes (
  id              TEXT PRIMARY KEY,           -- crypto.randomUUID()
  token           TEXT NOT NULL UNIQUE,       -- opaque unguessable scan token (getRandomValues, base32url)
  tenant_id       TEXT NOT NULL,
  company_id      TEXT,                        -- nullable, matches house multi-tenancy
  process_flow_id TEXT NOT NULL,
  step_key        TEXT NOT NULL DEFAULT 'qr',
  visit_id        TEXT,                        -- the visit instance that generated it (nullable pre-submit)
  agent_id        TEXT NOT NULL,               -- who displayed it (attribution)
  destination_url TEXT NOT NULL,               -- snapshot of admin URL at generation time
  status          TEXT NOT NULL DEFAULT 'active', -- active | redeemed | revoked
  redeemed_at     TEXT,
  superseded_by   TEXT,                        -- id of the code that replaced this one on reroll
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_by      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_qr_codes_tenant   ON qr_codes(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qr_codes_agent    ON qr_codes(tenant_id, agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qr_codes_flow     ON qr_codes(tenant_id, process_flow_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qr_codes_visit    ON qr_codes(visit_id);

-- One row per scan hit (raw count + audit trail)
CREATE TABLE IF NOT EXISTS qr_scan_events (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  company_id    TEXT,
  qr_code_id    TEXT NOT NULL,
  agent_id      TEXT NOT NULL,               -- denormalized from qr_codes for fast per-agent rollup
  process_flow_id TEXT NOT NULL,
  is_redemption INTEGER NOT NULL DEFAULT 0,  -- 1 only for the first scan of a code
  scanned_at    TEXT NOT NULL DEFAULT (datetime('now')),
  ip            TEXT,                        -- CF-Connecting-IP (audit only, not used for dedupe)
  user_agent    TEXT,
  referer       TEXT
);
CREATE INDEX IF NOT EXISTS idx_qr_scans_tenant ON qr_scan_events(tenant_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_qr_scans_agent  ON qr_scan_events(tenant_id, agent_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_qr_scans_code   ON qr_scan_events(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_flow   ON qr_scan_events(tenant_id, process_flow_id, scanned_at);
```

**Metrics derived on read:**
- `people_reached` = `SELECT COUNT(*) FROM qr_scan_events WHERE is_redemption=1 AND ...`
- `total_scans` = `SELECT COUNT(*) FROM qr_scan_events WHERE ...`
- `codes_generated` = `SELECT COUNT(*) FROM qr_codes WHERE ...`
- `conversion` (optional) = `people_reached / codes_generated`.

**Step `config` shape** (stored in existing `process_flow_steps.config`, no migration needed):
```json
{ "destination_url": "https://…", "label": "Scan to enter", "auto_advance": false }
```

---

## 4. Backend — Worker API (`workers-api/`)

### 4.1 New route file `workers-api/src/routes/field-ops/qr.js` (mounted on **`api`**, authenticated)

| Method & path | Role gate | Purpose |
|---|---|---|
| `POST /field-ops/qr/issue` | field roles + admin (any authenticated agent running a visit) | Body `{ process_flow_id, step_key, visit_id? }`. Reads the step's `config.destination_url` from `process_flow_steps`, mints a `qr_codes` row (`token` via `getRandomValues`), returns `{ id, token, scan_url, destination_url }`. `scan_url = https://fieldvibe-api.vantax.co.za/s/<token>`. |
| `POST /field-ops/qr/:id/reroll` | issuing agent / admin | Revokes current code (`status='revoked'`, `superseded_by=<new id>`) and issues a fresh code for the same visit/step. Returns new code. Used both for "next person" and manual reroll. |
| `GET /field-ops/qr/step-stats` | `requireRole('admin','general_manager','manager','team_lead')` | Query `?process_flow_id=&period=&company_id=`. Returns totals for the flow's QR step: `codes_generated, people_reached, total_scans`, plus recent code history. Powers the **process-flow admin view**. |
| `GET /field-ops/qr/by-agent` | `requireRole('admin','general_manager','manager','team_lead')` | Query `?period=&company_id=`. Per-agent rows `{ agent_id, name, people_reached, total_scans }`. Powers **manager breakdown**. |
| `GET /field-ops/qr/summary` | `requireRole('admin','general_manager','manager','team_lead')` | Tenant/company/period totals + sparkline series. Consumed by the P&L tile and GM Overview. |

Mounting: add `api.route('/field-ops', qrRoutes)` alongside existing field-ops mounts in `workers-api/src/index.js` (same block as `gmRoutes`/`kpiRoutes`).

All queries **scope by `tenant_id`** (from `c.get('tenantId')`) per house convention; `company_id` filter optional. Use `db.prepare(...).bind(...)` prepared statements (see `analytics.js:59-101`).

### 4.2 New PUBLIC scan/redirect handler (mounted on **`app`**, NO auth)

In `workers-api/src/index.js`, alongside the existing app-level public routes (`/api/uploads/:key` at `index.js:235-263`):

```
GET /s/:token
```
Logic:
1. Look up `qr_codes` by `token`. Not found → 404 (generic).
2. Insert a `qr_scan_events` row (denormalize `agent_id`, `process_flow_id`, `company_id`, `tenant_id`; capture `CF-Connecting-IP`, UA, referer).
3. If `status='active'`: set `is_redemption=1`, flip `qr_codes.status='redeemed'`, set `redeemed_at`. If `status='redeemed'`: `is_redemption=0`. If `status='revoked'`: return **410** (do not redirect).
4. `302` redirect to `destination_url` for `active`/`redeemed` codes (see §1 reconciliation). **Revoked → 410** (Q3 resolved).

Notes:
- Path `/s/:token` is short (small QR, easier scan) and lives on the Worker origin (`fieldvibe-api.vantax.co.za`), so redirect is server-side and instant — no SPA load.
- No auth middleware. **Apply `rateLimiter` (`lib/middleware.js:4-39`) at ~60 req/min per IP on `/s/*`** → 429 on breach, no redirect (Q4 resolved). It returns a redirect/410, not JSON.
- `destination_url` is validated/sanitized at **issue** time (admin URL), so the redirect target is trusted; still enforce `https?://` scheme allowlist to avoid open-redirect to `javascript:`/`data:` (see §7 security).

### 4.3 Aggregation into existing dashboards

- **P&L** (`incentives.js` `GET /field-ops/incentives/pnl`, `:230-233`): add a `qr` block to the response (`people_reached`, `total_scans`, trend), OR let the frontend tile call `GET /field-ops/qr/summary` directly. **Recommend the latter** (keeps `pnl` money-math untouched, matches `gm.js` "no new metric math" ethos). 
- **GM Overview** (`gm.js` `buildGmOverview():87`): expose QR summary either via the same `/qr/summary` call from the frontend, or add a composed field. Recommend separate call to avoid touching `buildGmOverview`.

### 4.4 No QR image generation server-side
The code only needs the URL string. QR **image** is rendered client-side (see §5.3). Backend never generates images → no R2 storage, no new heavy dep.

---

## 5. Frontend (`frontend/`)

### 5.1 Register the step type — admin builder
`frontend/src/pages/field-operations/ProcessFlowManagementPage.tsx`
- Add to `AVAILABLE_STEPS` (`:118-128`):
  ```js
  { key: 'qr', label: 'QR Redirect', description: 'Show a unique one-time QR that redirects scanners and tracks reach' }
  ```
- Add per-step config UI (near the `survey`/`questionnaire` blocks `:662-700`): a **destination URL** input (`config.destination_url`, required, `https?://` validated), optional **label** (`config.label`), optional **auto-advance** toggle (`config.auto_advance`).
- No changes needed to serialize/load (`:511-514`, `:529-535`) — `config` passthrough already handles arbitrary JSON.

### 5.2 Admin analytics on the flow (surface **a**)
Same page — when a flow contains a `qr` step, render a stats panel (calls `GET /field-ops/qr/step-stats?process_flow_id=`): `codes_generated`, `people_reached`, `total_scans`, recent code list with status, and a **Reroll** action. Good-UX: a small card with the three numbers + a sparkline + "View history" drawer.

### 5.3 Runtime execution — the visit wizard
`frontend/src/pages/field-operations/visits/VisitCreate.tsx`
- Add `case 'qr': return renderQrStep()` to the dispatch switch (`:2970-2981`).
- Add `renderQrStep()`:
  1. On entering the step, call `POST /field-ops/qr/issue` → get `{ token, scan_url }`.
  2. Render the QR of `scan_url` using a client lib (**add `qrcode.react`** to `frontend/package.json`).
  3. Show the destination + big QR + helper copy ("Ask the customer to scan with their phone camera").
  4. Button **"New code for next person"** → `POST /field-ops/qr/:id/reroll` → render fresh QR. (This is the "reroll".)
  5. If `config.auto_advance`: poll `GET` code status every ~4s; when `redeemed`, auto-issue the next code. (Enhancement, behind the config flag.)
  6. Live counter for this visit: "N people reached so far."
- Add validation entries in the switches at `:1130` and `:1243`: QR step is informational/optional and **not required by default**. If admin marks it required, require **≥1 code issued** for the visit (never ≥1 redemption — agent can't control scans) (Q5 resolved).
- **Offline (Q7 resolved):** issuing a code needs the server. When offline, render a "Connect to generate a QR code" state; the step is skippable offline and never blocks an offline submit.
- **Backfill (Q8 resolved):** codes are issued with `visit_id=null`; the visit submit handler backfills `visit_id` on all codes issued during that visit.
- Add to default step arrays `:140-196` **only if** it should appear by default → **no** (opt-in only).
- Runtime is used by both check-in and questionnaire flows (both run through `VisitCreate`), satisfying "check-in or questionnaire."

### 5.4 P&L tile (surface **b**)
`frontend/src/pages/agent/GMPnl.tsx` — add a **QR Engagement** card (`people_reached`, `total_scans`, period trend) fed by `GET /field-ops/qr/summary`. Gate identical to page (admin/general_manager).

### 5.5 GM Overview (surface **c**)
`frontend/src/pages/dashboard/GmOverviewPage.tsx` (web) + `frontend/src/pages/agent/GmOverview.tsx` (mobile) — add a KPI/stat entry for QR reach alongside existing signals, fed by `/field-ops/qr/summary`.

### 5.6 Manager per-agent breakdown (surface **d**)
A section/table (reuse existing table components) fed by `GET /field-ops/qr/by-agent`, rendered as a **tab/section within the process-flow analytics panel** (§5.2), visible to manager+ roles (Q6 resolved). No separate dashboard.

### 5.7 Service layer
`frontend/src/services/field-operations.service.ts` — add `issueQrCode`, `rerollQrCode`, `getQrStepStats`, `getQrByAgent`, `getQrSummary` (mirror existing `getProcessFlows` etc. `:1319-1347`). Use `apiClient` from `services/api.service.ts`.

---

## 6. Exact end-to-end flow

**Admin build time**
1. Admin → Process Flows → edit/create a flow → **+ Add Step → "QR Redirect"**.
2. Enters destination URL (e.g. `https://promo.brand.com/signup`), optional label, saves.
3. Backend stores the step row with `config.destination_url` (generic `platform.js` passthrough).

**Field runtime**
4. Agent runs a visit whose flow includes the QR step; reaches it in `VisitCreate`.
5. Frontend `POST /field-ops/qr/issue` → mints code #1, returns `scan_url` (`…/s/<token>`).
6. Agent shows the QR on their device. **Customer scans with their own phone.**
7. Customer's phone hits `GET /s/<token>` on the Worker → event recorded, code redeemed (people_reached +1), **302 → destination URL** opens on the customer's phone.
8. Agent taps **"New code for next person"** (or auto-advance) → code #2 minted → repeat 6–7.
9. Agent (or admin) can **Reroll** any time to invalidate a leaked/stale code.

**Analytics**
10. Admin sees per-step totals on the Process Flow page. Manager sees per-agent breakdown. GM/admin sees QR tile on P&L and a KPI on GM Overview. All scoped by tenant, filterable by company & period.

---

## 7. Edge cases & security

- **Open redirect:** validate `destination_url` scheme (`http`/`https` only) at issue time AND before redirecting; reject `javascript:`, `data:`, relative, and internal hosts if desired. (No existing sanitizer found — add a tiny allowlist check.)
- **Token guessing:** use ≥128-bit `getRandomValues` token, base32url; `UNIQUE` on `token`. 404 (not 403) on unknown token to avoid enumeration.
- **Scan flooding / abuse:** `rateLimiter` on `/s/*` at ~60/min per IP (Q4 resolved). Raw count means a refresher inflates `total_scans` — acceptable per decision; `people_reached` is protected by single-use.
- **Offline visits:** `VisitCreate` supports offline sync (`frontend/src/services/offline-sync.ts`). Issuing a code needs the network → **QR step requires connectivity**; show a "connect to generate" state when offline; step is skippable offline (Q7 resolved).
- **Revoked/redeemed re-scan:** redeemed → still redirect + count non-redemption; revoked → 410 (Q3 resolved, §4.2).
- **Multi-tenancy:** every read/write scoped by `tenant_id`; `by-agent`/`step-stats` must never leak across tenants.
- **Visit not yet saved:** issue codes with `visit_id=null`; backfill `visit_id` on submit (Q8 resolved, §4.1/§5.3).
- **Money visibility:** QR counts are engagement, not money → no `canSeeMoney` gating needed, but keep it off screens where only money is hidden if it feels out of place.

---

## 8. Testing

### Backend (vitest, `workers-api/tests/unit/`)
Follow `gmOverview.test.js` / `capabilities.test.js` style (in-memory / mocked D1).
1. `qrIssue.test.js` — issuing creates a code with a unique token, snapshots `destination_url`, scopes tenant/agent.
2. `qrScan.test.js` — first hit on `/s/:token`: inserts scan event, `is_redemption=1`, flips status to `redeemed`, 302 to destination. Second hit: `is_redemption=0`, still 302. Unknown token → 404. `javascript:`/`data:` destination rejected/never redirected.
3. `qrReroll.test.js` — reroll revokes old (`status=revoked`, `superseded_by` set) and issues new; old token no longer redeems.
4. `qrStats.test.js` — `step-stats`/`by-agent`/`summary` compute `people_reached` (=redemptions), `total_scans` (=all events), `codes_generated`; strict tenant isolation (a second tenant's data must not appear); period filter correctness.
5. Role gate tests: analytics endpoints reject field-only roles per `requireRole`; `/s/:token` needs no auth.

### Frontend (vitest, `frontend/`)
6. `ProcessFlowManagementPage` — "QR Redirect" appears in add-step menu; destination URL required + validated; config round-trips through save/load.
7. `VisitCreate` renderQrStep — renders a QR for the issued `scan_url`; "New code" calls reroll and re-renders; required-QR blocks submit only when configured and only on ≥1 code issued (Q5); offline shows the connect-to-generate state.
8. Tile components (`GMPnl`, `GmOverviewPage`) render the QR summary and handle empty/zero state.

### Manual / integration (staging)
9. Deploy Worker + Pages to **preview** (`fieldvibe-api-preview`, `fieldvibe-dev` D1). Apply `0022` migration manually (`wrangler d1 migrations apply` / `d1 execute`, then verify with `pragma_table_info` per repo convention).
10. Build a flow with a QR step; run a visit on a phone; scan the QR from a **second** physical device; confirm redirect works and counters increment; reroll; confirm old code dead; confirm analytics on all four surfaces; confirm a second tenant sees nothing.

---

## 9. Rollout & risk

- **Migration `0022` is manual and forward-only** (repo convention). Two new tables, no changes to existing tables → low blast radius, easy rollback (drop tables). Verify with `pragma_table_info` after apply.
- **New dep** `qrcode.react` (frontend only) — **approved (Q7/dep)**. Client-side rendering, no server image gen, no R2.
- **New public endpoint** `/s/:token` on the Worker — first unauthenticated non-portal route family; keep logic minimal, rate-limited, open-redirect-safe.
- **Existing dashboards** (`incentives.js` pnl, `gm.js`) are **not modified** if frontend tiles call `/qr/summary` directly — this is the recommended, lowest-risk path and matches the "no new metric math" ethos in `gm.js:1-4`.
- Deploy order: migration → Worker (routes + `/s`) → frontend (Pages). Feature is opt-in (step only appears when an admin adds it), so shipping is safe even before any flow uses it.

---

## 10. Acceptance criteria (mapped to request)

- [ ] Admin can add a **QR step** to a check-in/questionnaire flow's steps section and attach a **destination link**. *(§5.1)*
- [ ] Each scan **redirects** the scanner to that link. *(§4.2)*
- [ ] Each generated code is **unique and single-use** (first scan redeems). *(§3, §4.2)*
- [ ] Codes can be **rerolled** by the user. *(§4.1 reroll, §5.3)*
- [ ] Scans from **other devices** are **tracked/counted**. *(§4.2, §3)*
- [ ] **Admins and managers** can see the analytics. *(§4.1 role gates, §5.2/5.6)*
- [ ] The **P&L dashboard** shows the analytics somewhere, in a good-UX section. *(§5.4)*
- [ ] Analytics also appear on GM Overview + per-agent breakdown. *(§5.5, §5.6)*
- [ ] Tenant isolation, open-redirect safety, and test coverage per §7–§8.

---

## 11. Resolved decisions (closed 2026-07-19)

All previously-open questions are now decided. These are binding for implementation.

1. **Q3 — Redeemed/revoked re-scan:** **Redeemed → still 302-redirect**, recorded as a non-redemption scan (`is_redemption=0`). **Revoked → 410** "code expired" page (revoked = deliberately rerolled/leaked, so it must die). Unknown token → 404. *(Updates §4.2 step 4, §7.)*
2. **Q4 — Rate-limit `/s/:token`:** **Yes.** Apply the existing `rateLimiter` (`workers-api/src/lib/middleware.js:4-39`) at ~**60 requests/min per IP** on `/s/*`. Return 429 on breach (no redirect). *(Updates §4.2.)*
3. **Q5 — Required QR step:** If an admin marks the step required, submit requires **≥1 code issued** for the visit (NOT ≥1 redemption — the agent can't control whether a customer scans). Default `is_required=false`. *(Updates §5.3.)*
4. **Q6 — Manager per-agent breakdown:** Rendered as a **tab/section inside the process-flow analytics panel** (§5.2), visible to manager+ roles — no separate dashboard. Summary numbers still appear on P&L (§5.4) and GM Overview (§5.5). *(Updates §5.6.)*
5. **Q7 — Offline:** **QR step requires connectivity.** When offline, `renderQrStep` shows a "Connect to generate a QR code" state; the step is skippable offline (never blocks an offline submit). *(Updates §5.3, §7.)*
6. **Q8 — Pre-submit visits:** **Issue codes with `visit_id=null` and backfill `visit_id` on visit submit.** Codes are valid immediately (tied to agent+flow+tenant); the submit handler updates `qr_codes.visit_id` for that visit's issued codes. *(Updates §4.1, §5.3, §7.)*
7. **Dep approval:** **Approved** — add `qrcode.react` to `frontend/package.json` (client-side QR rendering; no server-side image gen, no R2). *(Confirms §4.4, §5.3, §9.)*
8. **Scope:** **Process Flows only for v1** (the "steps section"; backs both check-ins and in-visit questionnaires). Adding a QR to the standalone Survey/Questionnaire builder (`SurveyBuilderPage.tsx`, question-based, no steps) is a **deferred follow-up**, not in this scope.

### Follow-ups (out of scope for v1)
- QR question type inside the standalone Survey/Questionnaire builder (`SurveyBuilderPage.tsx`).
- Optional device dedupe (cookie/IP) if `total_scans` proves too noisy in practice.
- Batch/printable code sheets for high-throughput events.
```
