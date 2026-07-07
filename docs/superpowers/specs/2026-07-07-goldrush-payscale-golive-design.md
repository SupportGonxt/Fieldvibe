# Goldrush Pay-Scale Go-Live — Design

**Date:** 2026-07-07
**Status:** Approved (shape), ready for implementation plans (one per phase A–F)
**Initiative:** Ship the new Goldrush pay scale live-on-deploy: a two-gate (signups AND deposits) incentive engine fed by BO-reconciled deposit facts, with capture fully converged onto the standard fast-entry flow for both individuals and stores, OCR narrowed to id+btag, store visits gaining imagery-driven share-of-wall insights, and a standalone per-customer portal that surfaces their visit/individual data, imagery, and AI insights.

## Goal

Make the new pay scale the money truth at deploy time: agents/team-leads/management paid on a monthly salary tier gated by BOTH average signups/day AND average deposits/day, where a "deposit" is a Goldrush-confirmed fact (BO uploads/edits, matched by `goldrush_id`) — not the old self-reported `consumer_converted` flag. Along the way, finish converging goldrush + store capture onto the standard config-driven fast-entry flow, cut OCR to id+btag, and give store visits a board photo + wide store-front photo that a vision pass turns into share-of-wall and other customer-facing insights.

## North star

The pay numbers you gave are the numbers that go live. Exact tiers, both gates, lower-gate-wins, seeded at deploy and editable afterward by admin/GM. Everything else (deposits, capture, OCR, imagery) exists to feed those numbers honestly or to make the field capture that produces them one standard flow.

## Depends on / builds atop

**[2026-07-06 Goldrush → Standard Convergence](2026-07-06-goldrush-standard-convergence-design.md)** (approved). That spec owns the `program_config` + `capture_steps` foundation, the generic quick-entry screen, `qualification_identifier_key`, and retiring `company_custom_questions`. This spec:
- **Reuses** its config spine (`fast_entry_enabled`, `qualification_enabled`, `qualification_identifier_key`, `capture_steps`, `buildGoldrushConfig`).
- **Completes** the capture-screen consumption of `capture_steps` for goldrush individuals (Phase C) where not yet wired, and **extends** it to store visits.
- **Supersedes** its "commission unchanged" line: Phase B replaces the single-gate signup-average commission with the two-gate pay engine below.

## Non-goals

- Prod cutover autonomously. Ships to `dev`; prod D1 + `dev`→`main` only on explicit user go-ahead (same rule as the convergence spec).
- Per-agent target overrides. Tiers + base are per-role within a company, seeded and admin-editable — no individual bars.
- A separate metrics/event pipeline. Signups aggregate on read from `visit_individuals`; deposits are their own first-class table because they are an external fact, not a derived one.
- Multiple deposits per signup. One `goldrush_id` = at most one counted deposit (a signup deposits once). Enforced by a UNIQUE index.
- Agent-facing data in the customer portal. Phase F is read-only and company-scoped: visits, individuals, imagery, insights only — never agent identity, agent performance, pay, P&L, or other tenants' data (enforced server-side). The portal is NOT on the pay go-live critical path; it depends on nothing in A/B and can ship independently.

---

## Current state (why this is needed)

- **Pay engine is single-gate.** [`incentiveService.js`](../../../workers-api/src/services/incentiveService.js): metric = average signups per working day (`agentMetric` 121-127); `tierAmount(tiers,value)` (13-17) picks a tier off one number. "Deposit" today = the self-reported `consumer_converted='Yes'` JSON flag summed in `agentCount` (106-118). No deposit gate, no both-gates logic. Config `salaries:{manager:0,bo:0,gm:0}` seeded to 0 ([`config.js`](../../../workers-api/src/routes/field-ops/config.js) 149).
- **No deposit facts.** `goldrush_imports` table (schema.sql:2163) is dead — never written. Reconcile ([`incentives.js`](../../../workers-api/src/routes/field-ops/incentives.js) 179-221) takes a pasted blob, extracts 9-digit IDs, and flips `verification_status` provisional→qualified — it does not persist deposits as rows.
- **BO admin is mobile-PWA-only.** Role `backoffice_admin` lands at `/agent/reconcile` ([`App.tsx`](../../../frontend/src/App.tsx) 494); tabs Home/Reconcile/Agents/Profile ([`AgentLayout.tsx`](../../../frontend/src/pages/agent/AgentLayout.tsx) 83-90). Reconcile is a paste-textarea sending `{csv,dry_run}` JSON ([`BackOfficeReconcile.tsx`](../../../frontend/src/pages/agent/BackOfficeReconcile.tsx) 29,57-63). No file upload, no editable deposit list.
- **Capture is two parallel systems.** `capture_steps` config exists (built by `buildGoldrushConfig` from `company_custom_questions`, [`programConfig.js`](../../../workers-api/src/services/programConfig.js) 50-78) but the capture screens are hardcoded and do not read it: [`GoldrushFastEntry.tsx`](../../../frontend/src/pages/agent/GoldrushFastEntry.tsx) hardcodes its fields; stores go through the heavier [`VisitCreate.tsx`](../../../frontend/src/pages/field-operations/visits/VisitCreate.tsx) "Company Questions" path (1797-1876).
- **OCR extracts too much.** [`verify-goldrush-photo`](../../../workers-api/src/index.js) (index.js:17952) prompt (17967-17985) pulls id + first_name + last_name + btag; returns all of them + match/confidence.

---

## Phase A — Deposits: first-class facts + BO ingest (foundation)

Deposits become rows. BO admin populates them two ways — CSV import and manual web edit — and they are matched to signups by `goldrush_id`. This is the deposit signal Phase B's pay gate reads.

### A1. Table

New `goldrush_deposits` (replaces dead `goldrush_imports`), added to `schema.sql` + `database/schema.js`:

| Column | Notes |
|---|---|
| `id` | PK |
| `tenant_id`, `company_id` | scope |
| `goldrush_id` | the 9-digit signup identifier this deposit is for |
| `deposit_date` | date the deposit occurred (from CSV, else import date) |
| `amount` | nullable — reserved; pay gate counts rows, not rands |
| `source` | `'csv'` \| `'manual'` |
| `matched_visit_individual_id` | nullable — the signup row this matched, if any |
| `matched_agent_id` | nullable — resolved from the matched signup's visit → agent |
| `created_by` | the BO user id |
| `created_at` | |

`UNIQUE(tenant_id, company_id, goldrush_id)` — one deposit per signup; a re-import or a manual add of an existing id is an upsert, never a duplicate.

**Matching rule (single source of truth):** a deposit is *matched* when a non-rejected `visit_individuals` row for the company has canonical `custom_field_values.goldrush_id` equal to the deposit's `goldrush_id`. Matching stamps `matched_visit_individual_id` + `matched_agent_id`. Unmatched deposits persist (BO can upload before the signup lands) and re-match lazily on read/re-import. Reuses the canonical goldrush key from the convergence migration — no `goldrush_id_entry`/`goldrush_id` fork.

### A2. Endpoints (`routes/field-ops/deposits.js`, role-gated backoffice_admin/admin/general_manager)

- `POST /field-ops/deposits/import` — body `{ csv, dry_run }` (same shape BO already sends). Parse rows; extract `goldrush_id` (reuse `extractGoldrushIds` 9-digit regex from `incentiveService.js`), optional `deposit_date`/`amount` columns. Upsert `goldrush_deposits`, run the match. Returns `{ inserted, updated, matched, unmatched, sample_unmatched[] }`. `dry_run` computes the same counts without writing.
- `GET /field-ops/deposits?company_id=&status=` — list deposits with match status (for the web table). Paged.
- `POST /field-ops/deposits` — body `{ company_id, goldrush_id, deposit_date?, amount? }`. Single manual add (`source='manual'`), upsert + match. This is the "update on the web" path.
- `DELETE /field-ops/deposits/:id` — remove a deposit (correction).

CSV parsing stays minimal: header-optional, first numeric-9 field per line is the `goldrush_id`; a second/third column, if present and parseable, is `deposit_date`/`amount`. No CSV library — split lines, reuse the regex. `ponytail:` line-split parser; swap for a real CSV parse only if BO files gain quoted commas.

### A3. Frontend — Deposits page

[`BackOfficeReconcile.tsx`](../../../frontend/src/pages/agent/BackOfficeReconcile.tsx) grows into a Deposits management page (or a sibling `DepositsPage.tsx` it redirects to):
- **Import block:** the existing paste textarea **plus** a native `<input type="file" accept=".csv,.txt">` — read the file client-side with `FileReader` to text and POST the same `{csv,dry_run}` JSON. No multipart endpoint. Dry-run preview shows matched/unmatched before commit.
- **Manage block:** a table of deposits (goldrush_id, date, matched agent, status) with an add-one form (goldrush_id + optional date) and a delete action per row, wired to `POST`/`DELETE /field-ops/deposits`.
- New **"Deposits"** tab in the BO `getTabsForRole('backoffice_admin')` list ([`AgentLayout.tsx`](../../../frontend/src/pages/agent/AgentLayout.tsx) 83-90).

### A4. Tests (node env, appended to `vitest.node.config.js`)
- CSV parse: extracts 9-digit ids, ignores non-numeric/short lines, picks date/amount columns when present.
- Match: a deposit matches exactly the signup with the same canonical `goldrush_id`; unmatched persists; UNIQUE upsert never double-counts a re-imported id.

---

## Phase B — Two-gate pay engine + live-on-deploy

Replaces the single-gate signup-average commission with the exact pay scale you gave. Monthly salary = the highest tier whose BOTH gates clear, on averages-per-working-day. Depends on A for the deposit facts.

### B1. The pay scale (the numbers that go live — verbatim)

Tier config shape becomes `[{ signups, deposits, amount }]` (was `[{ threshold, amount }]`). Qualification: a role qualifies for a tier iff `avgSignupsPerDay >= tier.signups` **AND** `avgDepositsPerDay >= tier.deposits`. Pay = the highest qualifying tier's `amount`, i.e. `tier = min(signup_tier, deposit_tier)` — the lower gate governs. If no tier qualifies, pay = the role's configured **base salary**.

**Agent (individual) and Team Lead (team average) — same thresholds:**

| Salary | avg signups/day | avg deposits/day |
|---|---|---|
| R1500 | ≥8 | ≥5 |
| R2500 | ≥10 | ≥8 |
| R3500 | ≥15 | ≥10 |
| R4500 | ≥20 | ≥15 |

**Management (org average):**

| Salary | avg signups/day | avg deposits/day |
|---|---|---|
| R10000 | ≥8 | ≥5 |
| R20000 | ≥10 | ≥8 |
| R35000 | ≥15 | ≥10 |
| R45000 | ≥20 | ≥15 |

Below the lowest tier's gates → the role's **base salary** (configurable, seeded 0 unless set).

### B2. Metrics

- **avg/day** = period total ÷ `working_days_in_month` (config, currently 22).
- **Signups** = non-rejected `visit_individuals` count for the agent over the period (unchanged source).
- **Deposits** = count of **matched `goldrush_deposits`** rows attributable to the agent over the period (`matched_agent_id = agent`, deposit_date in period). This replaces `consumer_converted` as the pay deposit signal. `consumer_converted` remains as report data but no longer drives pay.
- **Team Lead** = average across their leaf agents of each agent's `avgSignupsPerDay`, and separately average of each agent's `avgDepositsPerDay` (two independent team averages, each gated). Reuses `hierarchyService.subtreeAgentIds`.
- **Management** = the same two averages across all agents in the org (org average), gated against the management tiers.

### B3. Engine changes (`services/incentiveService.js`)

- `agentMetric(...)` → returns `{ signups, deposits, avgSignups, avgDeposits }`.
- New `depositCount(period, agentIds)` querying `goldrush_deposits` matched rows.
- `tierAmount(tiers, value)` → `tierFor(tiers, avgSignups, avgDeposits)` returning the min-gate tier (or null).
- `computeIncentive(...)` → `amount = tierFor(...)?.amount ?? baseSalary(role)`.
- `writePayable` unchanged — still upserts `commission_earnings` (source_type='incentive').
- P&L ([`incentives.js`](../../../workers-api/src/routes/field-ops/incentives.js) `/pnl` 226): **cost** side switches to the new tiered salaries (what B pays); **revenue** side stays converted×rate, unchanged this initiative. Deliberate split — pay counts matched deposits, revenue still counts `consumer_converted`; no new deposit-based revenue line here. Revenue realignment is explicitly out of scope for Phase B.

### B4. Live-on-deploy seed

The exact B1 values are written by the seed path so a deploy that runs the seed makes them live:
- `POST /field-ops/config/seed-defaults` ([`config.js`](../../../workers-api/src/routes/field-ops/config.js) 109-179) seeds `incentive_scales` rows per role with the new `[{signups,deposits,amount}]` tiers and a `base` salary per role, plus `working_days_in_month`.
- Values stay editable post-deploy via the existing `PUT /field-ops/incentive-scales` (admin/GM). Logic (two-gate) is code; numbers are seeded config.

### B5. Tests
- `tierFor`: fires at each boundary, lower-gate governs (20 signups + 8 deposits → R2500, not R4500), no tier below the floor → base.
- `agentMetric`/`depositCount`: deposits counted from matched `goldrush_deposits`, not `consumer_converted`.
- Team + management averages: mean of member avgs, each gate applied independently.
- Seed writes the exact eight agent/TL + four management tier amounts and the per-role base.

---

## Phase C — Capture convergence (goldrush + store → standard fast entry)

Finish and extend the convergence spec's capture work: the fast-entry screens read `capture_steps`; store questions join the standard flow.

- **Goldrush individuals:** [`GoldrushFastEntry.tsx`](../../../frontend/src/pages/agent/GoldrushFastEntry.tsx) renders from `capture_steps` (via `GET /field-ops/config`) — identifier + dynamic steps — instead of hardcoded fields. (Per convergence §1's generic quick-entry; this wires the screen to consume it.)
- **Stores:** a store fast-entry screen (same config-driven quick-entry, `visit_target_type:'store'`) renders the store's `capture_steps`. Store `company_custom_questions` migrate into `capture_steps` via `buildGoldrushConfig` extended to emit store-scoped steps (it already carries `visit_target_type` on non-identifier steps, 68) + the existing `migrate-goldrush-convergence.mjs` extended for store rows with the same before/after count assertions.
- Both write to the same `custom_field_values` path already used, so Phase A/B data sources are unchanged.

### C tests
- `buildGoldrushConfig` emits store steps with `visit_target_type:'store'`; migration asserts store answer counts unchanged before/after.
- Fast-entry renders the exact steps from a config fixture (individual and store).

---

## Phase D — OCR: goldrush_id + btag only

Narrow [`verify-goldrush-photo`](../../../workers-api/src/index.js) (index.js:17952):
- Prompt trimmed to extract only the 9-digit `goldrush_id` and the `btag`. Drop first_name/last_name extraction.
- Response → `{ extracted_id, extracted_btag, confidence }` (drop name fields + `match`).
- [`GoldrushFastEntry.tsx`](../../../frontend/src/pages/agent/GoldrushFastEntry.tsx) `onPhoto` (116-141) autofills `goldrushId` + `btag` only; name fields become manual entry (kept as normal capture_steps inputs, not auto-filled).

### D tests
- The vision response shape is `{extracted_id, extracted_btag, confidence}`; autofill sets only id + btag. (Prompt/model call itself is integration-covered, not unit; assert the response-mapping + autofill logic.)

---

## Phase E — Store imagery + share-of-wall insights

Store fast entry captures two photos and a vision pass turns them into customer-facing insights.

- **Capture:** store fast-entry (Phase C) adds two photo steps — `board_photo` (the promo board / shelf) and `storefront_photo` (wide store-front). Reuses the existing visit-photo storage mechanism used by goldrush OCR capture (same upload path/bucket — plan pins the exact storage call).
- **Analysis:** `POST /field-ops/analyze-store-photos` (Workers AI vision, same model family as OCR) → `{ share_of_wall_pct, insights[] }` where `share_of_wall_pct` is the brand's estimated share of visible shelf/wall space and `insights[]` are short structured observations (stock gaps, competitor presence, placement) valuable to the customer.
- **Persistence:** stored on the store visit (`visit_responses` for the store visit, or a small `store_insights` table if the shape outgrows a JSON blob — plan decides) and surfaced in the store report for the customer.

### E tests
- Analysis response maps to `{share_of_wall_pct, insights[]}` and persists to the store visit; report surfaces it. (Vision call integration-level; unit-test the mapping + persistence + report read.)

---

## Phase F — Customer portal (read-only, per-customer, dynamic)

A standalone customer-facing web app where each customer logs in to see **their** visit and individual data, imagery, and AI insights — scoped strictly to their company, with zero agent/staff/payroll data. The largest phase and the one most independent of A/B; depends on C/E for the capture config, insights, and photos it surfaces.

### F1. What it shows (and never shows)

- **Shows:** KPIs relative to visits + individuals (counts, trends over time, qualification rate, deposits-confirmed rate, store coverage, share-of-wall from Phase E); the individuals list with their captured fields (per `capture_steps`); the stores list; **imagery** — store `board_photo`/`storefront_photo` (E) and individual capture photos; AI insights (share-of-wall, store observations from E, plus roll-up narrative).
- **Never shows:** agent identities, agent/team/management performance, commission/pay/tiers, P&L, other tenants' data, internal reconcile/BO tooling. Enforced server-side — the portal API never selects agent identity or pay columns; every query is filtered by the portal user's `company_id`.

### F2. Auth — separate customer accounts + invite

New `portal_users` table (distinct from staff auth, no cross-over into internal roles):

| Column | Notes |
|---|---|
| `id` | PK |
| `tenant_id`, `company_id` | the one company this user may read |
| `email` | login identity, unique per tenant |
| `password_hash` | set on invite acceptance (nullable until accepted) |
| `invite_token`, `invite_expires_at` | one-time invite/magic-link |
| `status` | `invited` \| `active` \| `disabled` |
| `created_by` | staff user who invited |
| `created_at` | |

Flow: a staff admin invites an email → row created `status='invited'` with a token → customer opens the invite link, sets a password → `status='active'`. Portal sessions are their own JWT audience (`aud:'portal'`), read-only, carrying `company_id`; staff tokens are rejected by portal routes and vice-versa. Reuses the existing password-hash + JWT primitives — no new crypto.

### F3. Admin-curated dashboard config

New `portal_dashboard_config` (per company) — the admin picks which widgets a customer sees, so the portal is generic in code but per-customer in content:

- Shape: `{ company_id, widgets: [{ type, title, source, options }] }` stored as one `program_config`-style row (or its own table — plan decides). `type` ∈ `kpi` | `trend` | `individuals_table` | `stores_table` | `gallery` | `insights` | `ai_summary`. `source` references a `capture_steps` key, a store-insight field, or a built-in metric.
- Curated by staff (admin/GM) in the **existing frontend** via a new "Portal setup" screen: pick widgets, order, titles, which `capture_steps`/insights to expose. No customer sees a config they weren't granted.
- A sane **default config** is seeded per company (overview KPIs + individuals table + stores gallery + insights) so a newly-invited customer sees a useful portal before any curation.

### F4. "Dynamic based on the question" — AI insights

- An `ai_summary`/`insights` widget calls Workers AI (same family as OCR/store vision) over the customer's **scoped** data to produce a short narrative + notable observations (trends, share-of-wall standouts, coverage gaps).
- Optional **ask panel:** `POST /portal/ask { question }` runs a constrained NL query over the customer's scoped aggregates (not free SQL — a bounded set of metric intents the model maps the question onto) and returns a text answer + the chart/rows it used. `ponytail:` ship the fixed-widget dashboard first; the ask panel is a fast-follow within F, not a blocker — the dashboard is the deliverable, the ask box is the upgrade.

### F5. Portal API (`workers-api/src/routes/portal/*`, gated by portal-user session)

- `POST /portal/auth/accept-invite` `{ token, password }`; `POST /portal/auth/login` `{ email, password }`.
- `GET /portal/overview` — the widgets + KPI values per this company's `portal_dashboard_config`.
- `GET /portal/individuals` / `GET /portal/stores` — scoped lists with only customer-facing fields (no agent columns), paged.
- `GET /portal/insights` — store insights (E) + AI roll-up.
- `GET /portal/media/:id` — signed access to a store/individual photo, scoped to the company.
- `POST /portal/ask` — F4 ask panel (fast-follow).

Staff-side admin endpoints live under the existing `/field-ops/portal/*`: `POST/GET/DELETE /field-ops/portal/users` (invite/list/disable), `GET/PUT /field-ops/portal/dashboard-config`.

### F6. Delivery — standalone app

A new customer-portal web app (own Vite/React/Tailwind project + build/deploy, own domain/subdomain), reusing the shared API client shape and design tokens but not the staff PWA shell. Talks only to `/portal/*`. `ponytail:` scaffold from the existing `frontend` build config rather than greenfield tooling — same stack, new entry.

### F tests
- Portal session scoping: a portal token for company A cannot read company B's individuals/stores/media (403/empty); a staff token is rejected by `/portal/*`.
- Overview renders exactly the widgets in `portal_dashboard_config`; no agent/pay field is ever present in any `/portal/*` response (assert the serializer omits them).
- Invite flow: invite → accept sets password + `status='active'`; expired/one-time token rejected.

---

## Dependency + rollout order

```
A (deposits table + BO ingest)  ──▶  B (two-gate pay engine + seed)
C (capture convergence: individual + store)  ──▶  D (OCR id+btag)
                                              └──▶  E (store imagery)  ──▶  F (customer portal)
```

- A before B (B reads deposit facts). C before D and E (they extend the store/fast-entry screens C builds). F after C/E (it surfaces their capture config, insights, and photos); F is independent of A/B and can ship in parallel with them.
- Each phase ships and tests independently to `dev`. F is the largest phase — its implementation plan will likely split into F1 auth, F2 dashboard/config + API, F3 portal app, F4 AI ask.
- **Prod cutover NOT autonomous** — prod D1 migrations (`goldrush_deposits`, store questions, seed of the live pay scale) + `dev`→`main` only on explicit user go-ahead. The pay scale seed is the go-live moment: running `seed-defaults` (or its migration) on prod is what puts the numbers live.

---

## Files touched (map for the plans)

**Backend (`workers-api/src/`):**
- `schema.sql` + `database/schema.js` — new `goldrush_deposits` table (retire `goldrush_imports`); optional `store_insights` (E); `portal_users` + `portal_dashboard_config` (F).
- New `routes/field-ops/deposits.js` — import + CRUD (A).
- `services/incentiveService.js` — two-gate engine, `depositCount`, `tierFor`, base salary (B).
- `routes/field-ops/config.js` — seed new tier shape + per-role base + `working_days` (B).
- `routes/field-ops/incentives.js` — `/pnl` note; reconcile stays (B).
- `services/programConfig.js` — `buildGoldrushConfig` store steps (C).
- `scripts/migrate-goldrush-convergence.mjs` — extend for store rows (C).
- `index.js` — `verify-goldrush-photo` prompt/response trim (D); new `analyze-store-photos` (E).
- New `routes/portal/*` — customer portal API + portal-session auth middleware (F).
- New `routes/field-ops/portal.js` — staff-side portal-user invites + dashboard-config CRUD (F).

**Frontend (`frontend/src/`):**
- `pages/agent/BackOfficeReconcile.tsx` (+ maybe `DepositsPage.tsx`) — file input + editable deposit list (A).
- `pages/agent/AgentLayout.tsx` — Deposits tab (A).
- `pages/agent/GoldrushFastEntry.tsx` — read `capture_steps`; id+btag autofill only (C, D).
- New store fast-entry screen — config-driven quick-entry + two photos (C, E).
- New "Portal setup" admin screen — curate `portal_dashboard_config` + invite portal users (F).

**New customer-portal app (separate project):** standalone Vite/React/Tailwind app talking only to `/portal/*`; scaffolded from the existing `frontend` build config (F).

**Tests (`workers-api/tests/unit/`):** new files per phase, each appended to `vitest.node.config.js` include array.
