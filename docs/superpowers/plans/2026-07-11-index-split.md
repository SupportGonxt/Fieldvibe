# index.js Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink `workers-api/src/index.js` from 22,299 lines to a composition root (≤ ~1,500 lines) by mechanically extracting route domains, shared helpers, and cron jobs into focused modules — zero behavior change.

**Architecture:** Verbatim block moves into Hono sub-apps (pattern: `workers-api/src/routes/field-ops/issues.js`) mounted at the same relative registration position, plus `lib/` for shared helpers and `cron/` for scheduled jobs. A runtime route census (ordered `METHOD PATH` dump of `app.routes`) is the primary no-behavior-change proof, regenerated and diffed after every task.

**Tech Stack:** Cloudflare Workers, Hono, D1, vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-11-index-split-design.md`

## Global Constraints

- **Branch:** all work on `refactor/split-index-js` off main (`3df11cb`). Never commit to main.
- **Verbatim move.** Handler bodies, SQL, comments move unchanged. No renames, no cleanup, no "while I'm here" fixes.
- **Import direction is one-way:** `index.js` → `routes/*` / `cron/*` → `lib/` → (nothing local). **No module ever imports from `../index.js`.** If a moved block calls something still living in index.js, move that dependency to `lib/` in the same task and import it from both places.
- **Helper placement rule:** a helper with callers only inside the moved block moves with the block (module-private). A helper with callers in ≥2 modules (or block + index.js remainder) goes to `lib/` as a named export. Grep every helper's call sites (`grep -c "\bNAME(" src/index.js` plus `grep -rn "\bNAME(" src/routes src/cron src/lib`) before deciding.
- **Mount position:** the `api.route('/', mod)` / `app.route('/', mod)` line goes at the exact source position the removed block occupied, preserving Hono registration order.
- **Census gate (default):** after the task, `cd workers-api && node scripts/route-census.mjs > /tmp/census.txt && diff route-census.baseline.txt /tmp/census.txt` must be **empty**.
- **Sanctioned-reorder exception** (only for tasks explicitly marked CONSOLIDATION): moving a scattered domain's later segments up to its first segment reorders the census. Then the gate is: (a) `diff <(sort route-census.baseline.txt) <(sort /tmp/census.txt)` is empty (same route set), (b) the raw diff contains ONLY the domain's own routes changing position, (c) shadow check passes: for every moved route R and every route S that R jumped over, R and S must NOT have the same method (or ALL) with unifiable path patterns (compare segment-by-segment; a literal segment and a `:param` segment unify — that's a conflict; two different literals don't). Document the check in the task report. Then re-bless: `cp /tmp/census.txt route-census.baseline.txt` and commit the new baseline **in the same commit**, noting "census re-blessed (sanctioned reorder)" in the message.
- **Test gate:** `cd workers-api && npx vitest run` — pre-existing baseline is 8 failed test files (sandbox `undefined/auth/login` fetch + `EvalError: Code generation from strings disallowed`) and 1 failed test (`evaluateSignals collects all triggered` in kpiSignals.test.js): 8 failed / 13 passed files, 1 failed / 92 passed tests. Bar: **no NEW failures**. (vitest may hang on close — cosmetic; Ctrl-C/timeout after results print.)
- **Syntax gate:** `node --check` every touched `.js` file before running census.
- Deposit *revenue* (rand) stays GM/admin-only; deposit *counts* visible to all roles. No response-shape, auth, or cron-schedule change anywhere.
- `wrangler.toml` untouched; entry stays `src/index.js`. No new deps; no new tests beyond the census script.
- **Line numbers in this plan are from the pre-split file (22,299 lines) and are hints only.** They shift after every task. Always locate blocks by the grep anchors given in each task, never by line number.
- All commands below run from `/Users/reshigan/Fieldvibe-1/workers-api` unless a path says otherwise.

## Standard per-task procedure (referenced as "GATES" below)

1. `node --check src/index.js` and `node --check <each new/touched file>` — exit 0.
2. `node scripts/route-census.mjs > /tmp/census.txt && diff route-census.baseline.txt /tmp/census.txt` — empty (or sanctioned-reorder procedure if the task is marked CONSOLIDATION).
3. `npx vitest run` — no new failures vs baseline above.
4. `git add -A workers-api && git commit` with the task's message.

---

### Task 1: Route census script + baseline

**Files:**
- Create: `workers-api/scripts/route-census.mjs`
- Create: `workers-api/route-census.baseline.txt`
- Modify: `workers-api/src/index.js` (add one named export at the bottom)

**Interfaces:**
- Produces: `export { app }` from index.js (named export alongside the existing default export — every later task's gate depends on it); committed baseline file.

- [ ] **Step 1: Create branch**

```bash
cd /Users/reshigan/Fieldvibe-1 && git checkout -b refactor/split-index-js main
```

- [ ] **Step 2: Export the Hono app from index.js**

At the very bottom of `workers-api/src/index.js` (after the `export default {` block closes), add:

```js
export { app };
```

- [ ] **Step 3: Write the census script**

Create `workers-api/scripts/route-census.mjs`:

```js
// Prints every registered route/middleware as "METHOD PATH" in Hono
// registration order. Byte-identical output across a refactor proves the
// route table (and therefore matching order) is unchanged.
import { app } from '../src/index.js';

for (const r of app.routes) {
  console.log(`${r.method} ${r.path}`);
}
```

- [ ] **Step 4: Run it and inspect**

Run: `cd workers-api && node scripts/route-census.mjs | head -20 && node scripts/route-census.mjs | wc -l`
Expected: `METHOD PATH` lines (including `ALL` middleware entries), total in the ~1,100–1,300 range.

**If the import fails under node** (a Workers-only global at module top level), the spec's fallback census applies for the whole project instead: `grep -nE "^(app|api)\.(get|post|put|delete|patch|use|all)\(" src/index.js src/routes/**/*.js src/cron/*.js` concatenated in mount order via a small script — decide now, record the decision in the task report, and keep the same byte-identical-diff gate. Do NOT switch approaches mid-project.

- [ ] **Step 5: Capture baseline and commit**

```bash
cd workers-api && node scripts/route-census.mjs > route-census.baseline.txt
cd /Users/reshigan/Fieldvibe-1 && git add workers-api/scripts/route-census.mjs workers-api/route-census.baseline.txt workers-api/src/index.js
git commit -m "chore(split): route census script + baseline"
```

- [ ] **Step 6: Test-suite baseline sanity**

Run: `cd workers-api && npx vitest run`
Expected: exactly the pre-existing baseline (8 failed/13 passed files, 1 failed/92 passed tests). Record the exact counts in the task report — later tasks diff against them.

---

### Task 2: lib/cache.js, lib/idempotency.js, lib/authUtils.js

**Files:**
- Create: `workers-api/src/lib/cache.js`, `workers-api/src/lib/idempotency.js`, `workers-api/src/lib/authUtils.js`
- Modify: `workers-api/src/index.js` (delete moved code, add imports)

**Interfaces:**
- Produces: `lib/cache.js` exports `cachedD1Query`, `invalidateCache` (move the backing in-memory cache Map/state with them — grep near `cachedD1Query` for the module-level variable it closes over). `lib/idempotency.js` exports `checkIdempotency`, `saveIdempotency`. `lib/authUtils.js` exports `generateToken`, `normalizePhone` (plus any sibling token/JWT helper functions they call that live adjacent — move those too, exporting only what index.js or other blocks call).

- [ ] **Step 1: Locate blocks**

```bash
grep -n "function checkIdempotency\|function saveIdempotency\|function cachedD1Query\|function invalidateCache\|function normalizePhone\|function generateToken" src/index.js
```

Also grep for the cache state (`grep -n "CACHE" src/index.js | head`) and any helpers `generateToken` calls (read the function bodies; e.g. base64url/sign helpers must move together).

- [ ] **Step 2: Move verbatim; import back into index.js**

Each new file: plain ESM module, no Hono. Example header for `lib/cache.js`:

```js
// In-memory D1 query cache (per-isolate). Moved verbatim from index.js.
```

In index.js, add at the top imports:

```js
import { cachedD1Query, invalidateCache } from './lib/cache.js';
import { checkIdempotency, saveIdempotency } from './lib/idempotency.js';
import { generateToken, normalizePhone } from './lib/authUtils.js';
```

- [ ] **Step 3: GATES** (census must be byte-identical — helper moves touch no routes)

- [ ] **Step 4: Commit** — `refactor(split): extract cache/idempotency/auth helpers to lib/`

---

### Task 3: lib/calendar.js + lib/aggregates.js

**Files:**
- Create: `workers-api/src/lib/calendar.js`, `workers-api/src/lib/aggregates.js`
- Modify: `workers-api/src/index.js`

**Interfaces:**
- Produces: `lib/calendar.js` exports `DEFAULT_WD_CONFIG`, `resolveWorkingDaysConfig`, `resolveWorkingDaysConfigBatch`, `countWorkingDaysInMonth`, `buildFallbackMonthlyTargets`, `getUserMonthlyTargetFromRules`, `generateTargetsFromRules`, `computeTargetTotalsFromRules`. `lib/aggregates.js` exports `getCommissionTotals`, `getBulkAgentVisitCounts`.
- Note: `generateTargetsFromRules` / `computeTargetTotalsFromRules` are defined mid-dashboard-block (pre-split ~1,133/~1,208) but have 12/6 call sites across domains — they are shared, they go to lib/calendar.js now so Tasks 6+ can import them.

- [ ] **Step 1: Locate**

```bash
grep -n "function resolveWorkingDaysConfig\|function countWorkingDaysInMonth\|function buildFallbackMonthlyTargets\|function getUserMonthlyTargetFromRules\|function generateTargetsFromRules\|function computeTargetTotalsFromRules\|const DEFAULT_WD_CONFIG\|function getCommissionTotals\|function getBulkAgentVisitCounts" src/index.js
```

Read each body; if one calls another helper still in index.js, that helper moves too (same file) or to the lib file where it fits.

- [ ] **Step 2: Move verbatim; import back into index.js**

```js
import { DEFAULT_WD_CONFIG, resolveWorkingDaysConfig, resolveWorkingDaysConfigBatch, countWorkingDaysInMonth, buildFallbackMonthlyTargets, getUserMonthlyTargetFromRules, generateTargetsFromRules, computeTargetTotalsFromRules } from './lib/calendar.js';
import { getCommissionTotals, getBulkAgentVisitCounts } from './lib/aggregates.js';
```

- [ ] **Step 3: GATES** — census byte-identical.

- [ ] **Step 4: Commit** — `refactor(split): extract calendar/targets + aggregate helpers to lib/`

---

### Task 4: lib/photoAi.js (shared photo/AI helpers)

**Files:**
- Create: `workers-api/src/lib/photoAi.js`
- Modify: `workers-api/src/index.js`

**Interfaces:**
- Produces: exports `rewriteR2Url`, `computePhotoHash`, `isPhotoHashDuplicate`, `analyzePhotoWithAI`, `materializeQuestionnairPhoto`. These are called from routes AND cron (`drainAiBacklog`), which is why they live in lib/, not routes/photos.js — Task 5 (cron) imports them from here. (Deviation from the spec's target-structure sketch, authorized by spec rule 4: shared helpers go to lib/.)

- [ ] **Step 1: Locate + trace deps**

```bash
grep -n "function rewriteR2Url\|function computePhotoHash\|function isPhotoHashDuplicate\|function analyzePhotoWithAI\|function materializeQuestionnairPhoto" src/index.js
```

Read `analyzePhotoWithAI` and `materializeQuestionnairPhoto` fully; any private helper they call that has no other callers moves with them (unexported). If they call something shared (e.g. `cachedD1Query`), import it from the lib module created in Task 2.

- [ ] **Step 2: Move verbatim; import back into index.js**

```js
import { rewriteR2Url, computePhotoHash, isPhotoHashDuplicate, analyzePhotoWithAI, materializeQuestionnairPhoto } from './lib/photoAi.js';
```

- [ ] **Step 3: GATES** — census byte-identical.

- [ ] **Step 4: Commit** — `refactor(split): extract photo/AI helpers to lib/photoAi`

---

### Task 5: cron/email.js + cron/jobs.js

**Files:**
- Create: `workers-api/src/cron/email.js`, `workers-api/src/cron/jobs.js`
- Modify: `workers-api/src/index.js` (delete the cron block; rewire the `scheduled` handler and any route call sites)

**Interfaces:**
- Consumes: `analyzePhotoWithAI` from `lib/photoAi.js` (Task 4); existing field-ops imports already at the top of index.js (`buildGmOverview`, `digestSlot`, `agentSignals`, `ensureIssues`, `getConfig` etc.) — move those import lines to cron/jobs.js if the cron block is their only user (grep index.js remainder to confirm; if routes also use one, import it in both files).
- Produces: `cron/email.js` exports `sendEmailViaMailChannels`, `htmlEscape`, `tableHtml`, `kpiHtml`. `cron/jobs.js` exports `generateGmDigest`, `generatePerformanceSummaries`, `checkInactiveAgents`, `notify`, `reactToIssue`, `reactToIssues`, `checkOverdueInvoices`, `checkLowStock`, `checkStaleVanLoads`, `closeCommissionPeriod`, `generateAgingReport`, `sendWeeklyGoldrushReports`, `computeGoldrushIndividualInsights`, `computeGoldrushStoreInsights`, `buildGoldrushWeeklyHtml`, `drainAiBacklog`, `reapStuckAiProcessing`, `parseSqlUtc`.

- [ ] **Step 1: Locate the block**

The cron block is contiguous: starts at `async function generateGmDigest(env) {` and ends immediately before `async function resolvePrice(` / the `app.route('/api', api);` mount region. Verify with:

```bash
grep -n "async function generateGmDigest\|async function reapStuckAiProcessing\|async function resolvePrice\|app.route('/api', api)" src/index.js
```

(`resolvePrice` at pre-split ~22,186 sits INSIDE the cron region span but belongs to pricing — leave it in index.js this task; it moves with coreCrud/products.js in Task 19.)

- [ ] **Step 2: Split the block**

`cron/email.js` gets `sendEmailViaMailChannels`, `htmlEscape`, `tableHtml`, `kpiHtml` (verbatim). `cron/jobs.js` gets everything else, with:

```js
import { sendEmailViaMailChannels, htmlEscape, tableHtml, kpiHtml } from './email.js';
import { analyzePhotoWithAI } from '../lib/photoAi.js';
```

plus whichever field-ops service imports the block uses (copy the exact specifiers from index.js's top, path-adjusted `../routes/field-ops/...`).

- [ ] **Step 3: Rewire index.js**

In index.js: `import { generateGmDigest, generatePerformanceSummaries, checkInactiveAgents, reactToIssues, checkOverdueInvoices, checkLowStock, checkStaleVanLoads, closeCommissionPeriod, generateAgingReport, sendWeeklyGoldrushReports, drainAiBacklog, reapStuckAiProcessing } from './cron/jobs.js';` — the `scheduled` handler body stays verbatim. Then grep the index.js remainder for every other moved name (`notify(`, `parseSqlUtc(`, `htmlEscape(`, `tableHtml(`, `kpiHtml(`, `sendEmailViaMailChannels(`, `computeGoldrush*`, `generatePerformanceSummaries(`): any route still calling one adds it to the import list (from `./cron/jobs.js` or `./cron/email.js`).

- [ ] **Step 4: GATES** — census byte-identical (no routes moved). Cron schedules unchanged (the `scheduled` dispatcher body is untouched).

- [ ] **Step 5: Commit** — `refactor(split): extract cron jobs + email helpers to cron/`

---

### Task 6: routes/mobileDashboards.js (app-level, contiguous)

**Files:**
- Create: `workers-api/src/routes/mobileDashboards.js`
- Modify: `workers-api/src/index.js`

**Interfaces:**
- Consumes: `lib/calendar.js`, `lib/aggregates.js`, `lib/cache.js` exports (Tasks 2–3); `authMiddleware`, `rateLimiter`, `requireSuperAdmin` — if these middleware are defined in index.js, move them to `lib/middleware.js` (new, this task) as named exports and import them in BOTH index.js and this module; if already importable, just import.
- Produces: default export Hono sub-app; `lib/middleware.js` exports (if created) `authMiddleware`, `rateLimiter`, plus whatever role-guards the block uses — later route tasks import from it.

- [ ] **Step 1: Locate the block**

Contiguous run of `app.get/post('/api/agent/...')`, `/api/team-lead/...`, `/api/manager/...` routes: starts at `app.get('/api/agent/my-companies'` and ends after `app.post('/api/admin/seed-test-agents'` (the seed-test-agents route is inside the contiguous block — it moves with it, verbatim, to preserve order). The block does NOT include `app.post('/api/auth/mobile-login'` (stays for Task 7) nor `app.post('/api/auth/register'` (first route after the block).

```bash
grep -n "app\.\(get\|post\)('/api/\(agent\|team-lead\|manager\|admin/seed-test-agents\)" src/index.js
```

- [ ] **Step 2: Create sub-app; mount at block position**

Module skeleton (paths stay full — mount base is `/`):

```js
import { Hono } from 'hono';
// ...lib + middleware imports as needed by the block...

const app = new Hono();

// [moved routes, verbatim, same order]

export default app;
```

In index.js, at the exact position the block occupied:

```js
app.route('/', mobileDashboardRoutes);
```

with `import mobileDashboardRoutes from './routes/mobileDashboards.js';` at the top.

- [ ] **Step 3: GATES** — census byte-identical (contiguous move at same position).

- [ ] **Step 4: Commit** — `refactor(split): extract mobile dashboards to routes/mobileDashboards`

---

### Task 7: routes/auth.js — CONSOLIDATION

**Files:**
- Create: `workers-api/src/routes/auth.js`
- Modify: `workers-api/src/index.js`, `workers-api/route-census.baseline.txt` (re-bless)

**Interfaces:**
- Consumes: `generateToken`, `normalizePhone` (lib/authUtils.js), `rateLimiter`/`authMiddleware` (lib/middleware.js or Task 6's arrangement).
- Produces: default export Hono sub-app containing ALL auth routes: `/api/auth/login`, `/portal/auth/accept-invite`, `/portal/auth/login`, `/api/auth/mobile-login` (segment 1, pre-split ~552–691) and `/api/auth/register`, `/api/auth/me`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/verify-token`, `/api/auth/change-password` (segment 2, pre-split ~2,740–2,910).

- [ ] **Step 1: Locate both segments**

```bash
grep -n "app\.post('/api/auth\|app\.post('/portal/auth\|app\.get('/api/auth" src/index.js
```

- [ ] **Step 2: Move both segments into the module (segment 1 order first, then segment 2), mount at segment 1's position**

`app.route('/', authRoutes);` where segment 1 was. Segment 2's routes thereby register EARLIER than before (they jump over the mobile-dashboards mount — after Task 6 that's one mount line — and anything else between).

- [ ] **Step 3: Shadow check (required for CONSOLIDATION)**

Segment 2 paths all start with literal `/api/auth/…`; routes jumped over start with `/api/agent|team-lead|manager|admin/…` — different literal second segments, no `:param` in the first two segments on either side ⇒ no unifiable pair. Verify against the actual census diff: every line that moved must be an auth/portal-auth route; check each jumped-over line's first two path segments are literals differing from `auth`. Record in report.

- [ ] **Step 4: GATES with sanctioned-reorder procedure** — sorted diff empty; raw diff only auth routes moving; re-bless baseline in same commit.

- [ ] **Step 5: Commit** — `refactor(split): consolidate auth routes into routes/auth (census re-blessed, sanctioned reorder)`

---

### Task 8: routes/portal.js + routes/companyPortal.js (app-level, two contiguous blocks)

**Files:**
- Create: `workers-api/src/routes/portal.js`, `workers-api/src/routes/companyPortal.js`
- Modify: `workers-api/src/index.js`

**Interfaces:**
- Consumes: `rewriteR2Url` (lib/photoAi.js); `ensurePortalTables` moves into portal.js if its callers are portal-only — grep: if survey/report routes also call it, it goes to `lib/portalTables.js` instead (same task).
- Produces: `portal.js` default export: `/portal/overview`, `/portal/individuals`, `/portal/stores`, `/portal/insights`, `/portal/media/:id`, `/portal/ask` + `portalAuthMiddleware` if defined adjacent (or import from lib/middleware.js). `companyPortal.js` default export: `/api/field-ops/company-portal/*` (7 routes) + `/api/field-ops/company-auth/login` + `companyAuthMiddleware` per the same rule.

- [ ] **Step 1: Locate**

```bash
grep -n "app\.\(get\|post\)('/portal/\|company-portal\|company-auth\|function ensurePortalTables\|portalAuthMiddleware\|companyAuthMiddleware" src/index.js | head -40
```

- [ ] **Step 2: Two modules, each mounted at its own block's position** (`app.route('/', portalRoutes)` / `app.route('/', companyPortalRoutes)`) — two contiguous moves, NOT a consolidation, so order is preserved.

- [ ] **Step 3: GATES** — census byte-identical.

- [ ] **Step 4: Commit** — `refactor(split): extract portal + company-portal routes`

---

### Task 9: routes/cashRecon.js (api-level, contiguous)

**Files:**
- Create: `workers-api/src/routes/cashRecon.js`
- Modify: `workers-api/src/index.js`

**Interfaces:**
- Produces: default export Hono sub-app; all routes whose path contains `cash-reconciliation` (pre-split ~11,150–11,288), registered on the module with their original api-relative paths; mounted `api.route('/', cashReconRoutes);` at block position.

- [ ] **Step 1:** `grep -n "cash-reconciliation" src/index.js` — confirm the block is contiguous; if a straggler exists elsewhere, leave it for Task 23 (final sweep) rather than consolidating.
- [ ] **Step 2:** Move verbatim, mount at position.
- [ ] **Step 3: GATES** — census byte-identical.
- [ ] **Step 4: Commit** — `refactor(split): extract cash-reconciliation routes`

---

### Task 10: routes/transactions.js (api-level, contiguous)

Same procedure as Task 9.

- **Create:** `workers-api/src/routes/transactions.js`
- **Block:** routes under `/transactions` + returns (pre-split ~12,174–12,755). Locate: `grep -n "api\.\(get\|post\|put\|delete\|patch\)('/transactions\|'/returns" src/index.js`
- **Mount:** `api.route('/', transactionRoutes);` at block position.
- **GATES** byte-identical. **Commit:** `refactor(split): extract transactions routes`

---

### Task 11: routes/tradePromotions.js (api-level, contiguous)

- **Create:** `workers-api/src/routes/tradePromotions.js`
- **Block:** `/trade-promotions` (pre-split ~12,839–13,052). Locate: `grep -n "trade-promotions" src/index.js`
- **Mount:** `api.route('/', tradePromotionRoutes);` at block position.
- **GATES** byte-identical. **Commit:** `refactor(split): extract trade-promotions routes`

---

### Task 12: routes/activationsPosm.js (api-level, contiguous)

- **Create:** `workers-api/src/routes/activationsPosm.js`
- **Block:** `/activations` + `/posm-materials` (pre-split ~16,101–16,280; verify contiguity — campaigns/activations CRUD around ~4,447 belongs to whatever contiguous block it sits in, check whether those are `/campaigns` routes that stay for the sweep). Locate: `grep -n "'/activations\|posm-materials\|'/campaigns" src/index.js`
- **Mount:** `api.route('/', activationsPosmRoutes);` at block position.
- **GATES** byte-identical. **Commit:** `refactor(split): extract activations + POSM routes`

---

### Task 13: routes/adminOps.js (api-level, contiguous)

- **Create:** `workers-api/src/routes/adminOps.js`
- **Block:** `/admin/*` seeding/migrations/super_admin block including the webhook routes embedded in its range (pre-split ~13,344–14,461; webhooks ~14,131–14,165 move with the block verbatim — they're inside it). Locate: `grep -n "api\.\(get\|post\|put\|delete\)('/admin\|'/webhooks" src/index.js`
- **Note:** `PRESET_ROLES` (~17,699) and the roles routes near it are a separate segment — NOT this task; they go with coreCrud/users.js (Task 18).
- **Mount:** `api.route('/', adminOpsRoutes);` at block position.
- **GATES** byte-identical. **Commit:** `refactor(split): extract admin ops routes`

---

### Task 14: routes/fieldOperations.js (api-level; split into 14a + 14b if the block exceeds ~2,500 lines)

**Files:**
- Create: `workers-api/src/routes/fieldOperations.js` (and `fieldOperationsB.js` only if splitting; prefer one file/one task if ≤2,500 lines after Tasks 4/8 removed the photo-helper and portal chunks from the middle)
- Modify: `workers-api/src/index.js`

**Interfaces:**
- Consumes: lib/photoAi.js exports; lib/calendar.js exports; `ensureCaptureFailures` moves in as module-private if field-operations-only (grep callers; if surveys also call it → lib/, this task).
- Produces: default export(s); inline field-ops settings/working-days/targets/commission-tier routes (pre-split ~8,046–8,271) + `/field-operations/*` workflow routes (~8,271–10,919 minus already-extracted chunks) + `tinyZip` if its 2 callers are both in this block (else it goes to reports, Task 17).

- [ ] **Step 1:** `grep -n "field-operations\|api\.\(get\|post\|put\|delete\)('/field-ops" src/index.js | head -60` — map the real remaining block; note the 9 existing `api.route('/field-ops', …)` mounts stay in index.js untouched.
- [ ] **Step 2:** Move the contiguous block(s) verbatim; mount `api.route('/', fieldOperationsRoutes);` at position. If splitting, each half is its own contiguous sub-block with its own mount at its own position — order preserved, still not a consolidation.
- [ ] **Step 3: GATES** — census byte-identical. **Commit:** `refactor(split): extract field-operations routes`

---

### Task 15: routes/vanSales.js — CONSOLIDATION (if scattered; contiguous move otherwise)

- **Create:** `workers-api/src/routes/vanSales.js`
- **Block(s):** all routes under `/van-sales` (pre-split range ~4,230–7,372). Locate: `grep -n "van-sales" src/index.js`. If one contiguous block: plain move, byte-identical gate. If multiple segments: consolidation procedure (module keeps segments in original relative order; mount at first segment's position; shadow check every jumped-over route — `/van-sales` literal prefix vs jumped routes' prefixes; re-bless baseline).
- **Mount:** `api.route('/', vanSalesRoutes);`
- **Commit:** `refactor(split): extract van-sales routes` (+ census re-bless note if consolidation)

---

### Task 16: routes/commissions.js — CONSOLIDATION (same shape as Task 15)

- **Create:** `workers-api/src/routes/commissions.js`
- **Block(s):** routes under `/commissions` + payouts + commission config (pre-split ~4,490–7,434). Locate: `grep -n "'/commissions\|payout" src/index.js | head -40`. Consumes `getCommissionTotals` from lib/aggregates.js.
- **Mount:** `api.route('/', commissionRoutes);` at first segment position; consolidation procedure if scattered.
- **Commit:** `refactor(split): extract commissions routes`

---

### Task 17: routes/surveys.js — CONSOLIDATION

- **Create:** `workers-api/src/routes/surveys.js`
- **Block(s):** all `/surveys` routes incl. KYC, templates, insights (pre-split scattered ~6,586–14,727). Module-private helpers moving in: `surveyResponseScope`, `surveyVisitScope`, `validateSAIdNumber`, `validateGoldrushId`, `extractGoldrushId`, `goldrushIdExists` — CONFIRM each helper's callers are all inside the moved set (`grep -n "\bNAME(" src/index.js src/routes/*.js`); any with outside callers → `lib/kyc.js` (new, this task) instead. Locate routes: `grep -n "'/surveys" src/index.js`
- **Mount:** `api.route('/', surveyRoutes);` at first segment position. Shadow check: `/surveys` literal prefix vs every jumped-over route's prefix; re-bless baseline.
- **Commit:** `refactor(split): consolidate survey routes (census re-blessed, sanctioned reorder)`

---

### Task 18: routes/reports.js — CONSOLIDATION

- **Create:** `workers-api/src/routes/reports.js`
- **Block(s):** the ~20 `/field-ops/reports/*` routes (scattered ~7,434–19,710) + helpers `resolveReportCompanyId`, `emptyIndividualInsights`, `emptyStoreInsights`, `tinyZip` (if not taken by Task 14) — same caller-check rule; `resolveReportCompanyId` has 12 call sites, if any remain outside this module it goes to `lib/reportUtils.js` (new, this task). Locate: `grep -n "field-ops/reports" src/index.js`
- **Mount:** `api.route('/', reportRoutes);` at first segment position. Shadow check (`/field-ops/reports` literal prefix — note the existing 9 `api.route('/field-ops', …)` mounts: their modules' route paths must be compared too, e.g. a `GET /field-ops/:something` param route would conflict; grep `routes/field-ops/*.js` for first-segment params). Re-bless baseline.
- **Commit:** `refactor(split): consolidate field-ops reports routes (census re-blessed, sanctioned reorder)`

---

### Task 19: routes/coreCrud/products.js

- **Create:** `workers-api/src/routes/coreCrud/products.js`
- **Block(s):** `/products`, `/pricing`, `/brands`, `/competitors` routes + `resolvePrice` (moves module-private if its 2 call sites are in-block; else lib). Brands/competitors are scattered (~8,941–16,356): consolidation procedure if so. Locate: `grep -n "'/products\|'/pricing\|'/brands\|'/competitors" src/index.js`
- **Mount:** `api.route('/', productRoutes);` at first segment position.
- **Commit:** `refactor(split): extract products/brands/pricing routes`

---

### Task 20: routes/coreCrud/users.js

- **Create:** `workers-api/src/routes/coreCrud/users.js`
- **Block(s):** `/users` routes + `PRESET_ROLES` const + the roles routes near it (pre-split ~17,699 segment) — grep `PRESET_ROLES` usage (it's an object: `grep -n "PRESET_ROLES" src/index.js`). Consolidation if segments scattered. Consumes lib/calendar.js target helpers.
- **Mount:** `api.route('/', userRoutes);` at first segment position.
- **Commit:** `refactor(split): extract users + roles routes`

---

### Task 21: routes/coreCrud/companiesCustomers.js

- **Create:** `workers-api/src/routes/coreCrud/companiesCustomers.js`
- **Block(s):** `/companies`, `/customers`, `/regions` routes. Locate: `grep -n "'/companies\|'/customers\|'/regions" src/index.js`
- **Mount:** `api.route('/', companyCustomerRoutes);` at first segment position; consolidation procedure if scattered.
- **Commit:** `refactor(split): extract companies/customers/regions routes`

---

### Task 22: routes/coreCrud/visits.js

- **Create:** `workers-api/src/routes/coreCrud/visits.js`
- **Block(s):** `/visits`, questionnaires, boards, visit-config routes. Locate: `grep -n "'/visits\|questionnaire\|'/boards" src/index.js | head -60`. Consumes lib/photoAi.js.
- **Mount:** `api.route('/', visitRoutes);` at first segment position; consolidation procedure if scattered.
- **Commit:** `refactor(split): extract visits/questionnaires/boards routes`

---

### Task 23: routes/coreCrud/ordersPayments.js

- **Create:** `workers-api/src/routes/coreCrud/ordersPayments.js`
- **Block(s):** `/sales-orders`, `/orders`, `/invoices`, `/payments`, `/warehouses`, `/stock`, `/goals` routes + `writePaymentLedgerEntries` (module-private if all 4 call sites move in; else lib). Locate: `grep -n "'/sales-orders\|'/orders\|'/invoices\|'/payments\|'/warehouses\|'/stock\|'/goals" src/index.js | head -80`
- **Mount:** `api.route('/', orderPaymentRoutes);` at first segment position; consolidation procedure if scattered (likely — invoices/orders/payments interleave with van-sales range).
- **Commit:** `refactor(split): extract orders/payments/inventory routes`

---

### Task 24: Final sweep

**Files:**
- Modify: `workers-api/src/index.js`; possibly one `workers-api/src/routes/misc.js`

**Interfaces:** none new beyond an optional `misc.js` default export.

- [ ] **Step 1: Inventory the remainder**

```bash
wc -l src/index.js && grep -n -E "^(app|api)\.(get|post|put|delete|patch)\(" src/index.js
```

Remainder should be: imports, error handler, CORS/security/rate-limit middleware, `/` + `/health`, `/api/uploads/:key{.+}`, the mount lines, `scheduled` dispatcher, exports. Any straggler routes left by Tasks 9–23 move to `routes/misc.js` (consolidation procedure) or their domain module if trivial to place.

- [ ] **Step 2: Confirm ≤ ~1,500 lines.** If above, identify the largest remaining block and extract it with the standard procedure (one more commit).

- [ ] **Step 3: Full GATES** — census vs current blessed baseline; sorted census vs the ORIGINAL main baseline must also be identical (`git show <task-1-commit>:workers-api/route-census.baseline.txt | sort | diff - <(sort /tmp/census.txt)` — empty), proving no route was lost across all re-blessings.

- [ ] **Step 4: Commit** — `refactor(split): final sweep — index.js reduced to composition root`

---

## Self-Review

**1. Spec coverage:** census gate → Task 1; cron → Task 5; lib helpers → Tasks 2–4; app-level auth/mobileDashboards → Tasks 6–7 (+ portal Task 8, added: the spec's structure sketch omitted a home for `/portal/*` and company-portal — new files authorized by spec line "exact membership is settled per task"); api domains → Tasks 9–18; core CRUD → Tasks 19–23; final sweep → Task 24. Extraction rules 1–6 encoded in Global Constraints + GATES. Rollback rule lives in the spec and SDD ledger; unchanged.
**2. Placeholder scan:** no TBDs. Census script is complete code. Route blocks are content-anchored by design (the plan cannot embed 20k lines; the verbatim-move rule + grep anchors + census gate replace embedded code).
**3. Type consistency:** export names checked against actual index.js definitions (grep-verified this session): all function names in Tasks 2–5 match `src/index.js` definitions verbatim. `analyzePhotoWithAI` consumed in Task 5 from lib/photoAi.js produced in Task 4. Import path depth: `cron/jobs.js` → `../lib/photoAi.js`, `../routes/field-ops/*`; `routes/*` → `../lib/*`; `routes/coreCrud/*` → `../../lib/*`.

**Known deviation from spec sketch (documented):** photo/AI helpers land in `lib/photoAi.js` instead of `routes/photos.js` because they're shared by routes and cron (rule 4 governs; avoids any module importing from index.js or a cron→routes dependency). A dedicated `routes/photos.js` is therefore unnecessary — the `/api/uploads/:key` route stays in the composition root (single small route).
