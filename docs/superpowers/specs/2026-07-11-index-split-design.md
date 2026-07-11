# index.js Split — Design

**Date:** 2026-07-11
**Goal:** Shrink `workers-api/src/index.js` from 22,299 lines to a composition root (target ≤ ~1,500 lines) by mechanically extracting route domains, shared helpers, and cron jobs into focused modules. **Zero behavior change.**

## Why

- 22,299 lines, ~1,092 routes (43 on `app`, 1,049 on the `api` router), 14 cron functions, ~45 top-level helpers in one file.
- Edits to any domain load the whole file; review risk and merge conflicts scale with file size.
- Nine `routes/field-ops/*.js` modules already prove the extraction pattern (Hono sub-app, `export default app`, global middleware supplies `userId`/`tenantId`/`role` via `c.get()`).

## Approach (approved)

Incremental domain extraction on one branch, biggest-cohesion-first, run to completion (full shrink — includes the core-CRUD long tail). Each extraction is an independently testable, committed task; the branch is shippable after every task.

**Not chosen:** big-bang single diff (unreviewable, route-order risk concentrated in one change); minimal extraction stopping at ~12k lines (leaves the core problem).

## Target structure

```
workers-api/src/
  index.js                 # composition root: imports, middleware, mounts, scheduled dispatcher
  lib/                     # shared helpers (new)
    calendar.js            # resolveWorkingDaysConfig(+Batch), countWorkingDaysInMonth, DEFAULT_WD_CONFIG,
                           # buildFallbackMonthlyTargets, getUserMonthlyTargetFromRules,
                           # generateTargetsFromRules, computeTargetTotalsFromRules
    cache.js               # cachedD1Query, invalidateCache
    authUtils.js           # generateToken, normalizePhone
    idempotency.js         # checkIdempotency, saveIdempotency
    aggregates.js          # getCommissionTotals, getBulkAgentVisitCounts
  cron/
    jobs.js                # generateGmDigest, generatePerformanceSummaries, checkInactiveAgents,
                           # notify, reactToIssue(s), checkOverdueInvoices, checkLowStock,
                           # checkStaleVanLoads, closeCommissionPeriod, generateAgingReport,
                           # sendWeeklyGoldrushReports + Goldrush insight builders,
                           # drainAiBacklog, reapStuckAiProcessing, parseSqlUtc
    email.js               # sendEmailViaMailChannels, htmlEscape, tableHtml, kpiHtml
  routes/
    auth.js                # login, mobile-login, register, password reset, portal auth (app-level)
    mobileDashboards.js    # agent/team-lead/manager dashboards + drill-downs + PIN (app-level, ~1,600 lines)
    surveys.js             # /surveys/* incl. KYC, templates, insights (+ SA-ID/Goldrush-ID validators)
    vanSales.js            # /van-sales/*
    commissions.js         # /commissions/* + payouts + config
    fieldOperations.js     # /field-operations/* workflow + inline /field-ops/* settings/targets/tiers
    reports.js             # /field-ops/reports/* + report helpers (resolveReportCompanyId, tinyZip, empty*Insights)
    transactions.js        # /transactions/* + returns
    tradePromotions.js     # /trade-promotions/*
    activationsPosm.js     # /activations/* + /posm-materials/*
    cashRecon.js           # /cash-reconciliation*
    adminOps.js            # /admin/* seeding, migrations, super_admin (+ PRESET_ROLES if only used here)
    photos.js              # photo serving + upload helpers (rewriteR2Url, computePhotoHash, isPhotoHashDuplicate,
                           # analyzePhotoWithAI, materializeQuestionnairPhoto) — analyzePhotoWithAI exported for cron
    coreCrud/              # the ~400-route long tail, split by resource cluster:
      users.js             # /users/*
      companiesCustomers.js# /companies/*, /customers/*, /regions/*
      products.js          # /products/*, /brands/*, /competitors/*, /pricing/* (+ resolvePrice)
      visits.js            # /visits/*, questionnaires, boards, visit configs
      ordersPayments.js    # /sales-orders/*, /orders/*, /invoices/*, /payments/* (+ writePaymentLedgerEntries),
                           # /warehouses/*, /stock/*, /goals/*, /webhooks
```

File names/groupings above follow the investigator's line map; exact membership is settled per task by reading the actual block — a route stays with its contiguous block's module when the map's grouping is ambiguous.

## Extraction rules (every task)

1. **Verbatim move.** Handler bodies, SQL, comments move unchanged. No renames, no cleanup, no "while I'm here" fixes.
2. **Sub-app pattern** (copy `routes/field-ops/issues.js`): `const app = new Hono()`, register with the same paths relative to the mount prefix, `export default app`. App-level modules (auth, mobileDashboards, photos) mount on `app`; api-level modules mount on `api`.
3. **Mount at the same relative position** where the first moved route was registered, so Hono's registration order — and therefore route matching — is preserved. Where a domain's routes are scattered (surveys, reports), consolidating changes relative order: the task must verify no moved route and no route it jumps over share a method + overlapping path pattern (param segments like `:id` are the hazard). Census diff (rule 5) plus this shadow check gates the move.
4. **Helpers move with their only caller; shared helpers go to `lib/`** and are imported everywhere used (including back into index.js while other users remain inline). Cron-called functions (`analyzePhotoWithAI`, `buildGmOverview`-style) are named exports alongside the default app.
5. **Route census gate.** `scripts/route-census.mjs` (new, added in Task 1) prints every registered route as `METHOD PATH` in registration order by instrumenting Hono route registration at runtime (import the built app, walk `app.routes` — Hono exposes the registered route table). Captured once on main as `route-census.baseline.txt` (committed); after every task, regenerate and `diff` — must be byte-identical. This is the primary no-behavior-change proof.
6. **Per-task verification:** `node --check` every touched file → route census diff empty → `npx vitest run` matches baseline (8 files fail pre-existing from sandbox fetch/EvalError, 1 pre-existing test failure in kpiSignals.test.js; bar is no NEW failures) → commit.

## Constraints

- Deposit revenue (rand) stays GM/admin-only; deposit counts visible to all roles. Extraction must not alter any response shape.
- Deploy via git push → CI only.
- No new dependencies. No new tests beyond the census script (moves don't create logic; existing suite + census carry the proof).
- `wrangler.toml` / build config untouched — entry point stays `src/index.js`.

## Task order (waves)

1. **Census script + baseline** — the gate everything else uses.
2. **Cron block → `cron/`** (~950 lines; zero route-order risk; imports from field-ops services already exist).
3. **Shared helpers → `lib/`** (~600 lines; unblocks all route extractions).
4. **App-level routes:** auth.js, mobileDashboards.js (~1,800 lines combined).
5. **Api-level domains, contiguous-first:** vanSales, commissions, transactions, tradePromotions, activationsPosm, cashRecon, adminOps, fieldOperations, photos, surveys, reports.
6. **Core CRUD long tail:** users, companiesCustomers, products, visits, ordersPayments.
7. **Final sweep:** index.js reduced to imports/middleware/mounts/scheduled dispatcher; confirm ≤ ~1,500 lines; full census + suite.

Each wave item = one plan task (some may split if a block exceeds ~2,500 lines). Any task can be the branch's last — the file just shrinks less.

## Error handling / rollback

- A task whose census diff or test run fails is fixed or reverted (`git reset --hard` to previous task's commit) before the next task starts; the ledger records the revert.
- If Hono's route table proves unwalkable for the census (API difference), fallback census = grep-based extraction of `\.(get|post|put|delete|patch)\(` paths per file concatenated in mount order — decided in Task 1, not mid-stream.

## Success criteria

- `workers-api/src/index.js` ≤ ~1,500 lines.
- Route census byte-identical to main baseline.
- Test suite: zero new failures vs baseline.
- No response-shape, auth, or cron-schedule changes anywhere.
