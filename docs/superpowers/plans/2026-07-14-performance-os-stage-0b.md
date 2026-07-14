# Performance OS Stage 0b — Trust Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One source of truth for role access and funnel numbers, plus closing every financial-data privilege gap and known accuracy bug — the trust layer everything in the Performance OS spec (`docs/superpowers/specs/2026-07-13-performance-os-design.md`, §Layer 0) builds on.

**Architecture:** A pure backend `capabilities.js` (no DB/IO) becomes the single role-access authority; both `requireRole` implementations collapse onto it and the unverified-JWT middleware dies. A pure `funnelService.js` becomes the One-Number Rail: one SQL fragment for "converted", one for "verified", one SAST day function, one waterfall math function — all six disagreeing consumer sites converge on it. Endpoint hardening adds `requireRole` to financial routes that today only check "logged in". Portal hardening reuses the existing `rateLimiter` and `auditLogService`. Frontend gets a hand-mirrored `capabilities.ts` (same pattern as Stage 0a's `signalRegistry.ts` mirror — comments in both files point at each other).

**Tech Stack:** Cloudflare Workers (Hono, plain ESM JS), D1, vitest (`npm run test:pure` for pure modules), React+TS frontend, Playwright (bootstrap only in this stage).

## Global Constraints

- Field roles (`agent`, `field_agent`, `sales_rep`, `team_lead`, `manager`) see signup/verified/deposit **counts only** — never rand values on team-level or tenant-level data. An agent MAY see their **own** incentive pay (`/incentives/me`, `/incentives/hero` are self-scoped and stay as-is).
- Revenue = qualified deposits × `commission_per_deposit` from tenant `program_config` — never hardcode R75.
- "Verified is the currency": never rank agents on raw signups (spec §2).
- Admin-equivalence: `super_admin` passes everything; `admin`, `backoffice_admin`, `general_manager` pass every staff gate below super_admin (matches frontend `hasRole`, `frontend/src/store/auth.store.ts:217-224`).
- Zero-denominator waterfall factors return `null`, never `NaN`/`Infinity` (spec §6).
- Monetary stripping fails closed: unknown shape → strip the field, don't pass it through.
- No new dependencies. No new migration needed in this stage (rate_limits and audit_logs tables already exist).
- All backend work branches fresh off `origin/main` (NOT `feat/photo-review-goldrush-id` — that branch is docs-only and stale).
- Tests: run `npm test` in `workers-api/` before merging (CI test jobs are `continue-on-error`; tests are a human gate). Pure-module tests also run via `npm run test:pure`.
- Migrations are never run by CI. (This stage has none.)

## Pre-flight

```bash
git fetch origin && git checkout -b feat/stage-0b-trust-foundation origin/main
cd workers-api && npm test   # confirm green baseline before touching anything
```

---

### Task 1: capabilities.js — role-access single source of truth

**Files:**
- Create: `workers-api/src/lib/capabilities.js`
- Test: `workers-api/tests/unit/capabilities.test.js`

**Interfaces:**
- Produces: `ADMIN_EQUIVALENT: string[]`, `FIELD_ROLES: string[]`, `MONETARY_FIELDS: string[]`, `roleAllows(role, allowedRoles) → boolean`, `canSeeMoney(role) → boolean`, `stripMonetary(value, role) → value` (deep, fail-closed). Task 2 wires `roleAllows` into `requireRole`; Task 7 uses `stripMonetary`.

- [ ] **Step 1: Write the failing test**

```js
// workers-api/tests/unit/capabilities.test.js
import { describe, it, expect } from 'vitest';
import {
  roleAllows, canSeeMoney, stripMonetary, ADMIN_EQUIVALENT, FIELD_ROLES,
} from '../../src/lib/capabilities.js';

describe('roleAllows', () => {
  it('super_admin passes any gate', () => {
    expect(roleAllows('super_admin', ['team_lead'])).toBe(true);
  });
  it('admin-equivalents pass every staff gate below super_admin', () => {
    for (const r of ['admin', 'backoffice_admin', 'general_manager']) {
      expect(roleAllows(r, ['manager'])).toBe(true);
      expect(roleAllows(r, ['admin'])).toBe(true);
    }
  });
  it('field roles pass only when listed', () => {
    expect(roleAllows('team_lead', ['team_lead', 'manager'])).toBe(true);
    expect(roleAllows('agent', ['team_lead', 'manager'])).toBe(false);
  });
  it('company portal roles never pass staff gates', () => {
    expect(roleAllows('company_viewer', ['admin'])).toBe(false);
    expect(roleAllows('company_admin', ['manager'])).toBe(false);
  });
  it('unknown/missing role fails closed', () => {
    expect(roleAllows(undefined, ['admin'])).toBe(false);
    expect(roleAllows('', ['admin'])).toBe(false);
  });
});

describe('canSeeMoney', () => {
  it('GM and admin-equivalents see money', () => {
    for (const r of ['super_admin', 'admin', 'backoffice_admin', 'general_manager']) {
      expect(canSeeMoney(r)).toBe(true);
    }
  });
  it('field roles never see money — including manager and team_lead', () => {
    for (const r of FIELD_ROLES) expect(canSeeMoney(r)).toBe(false);
  });
});

describe('stripMonetary', () => {
  const payload = {
    signups: 12, verified: 8, deposits: 5,
    revenue: 375, payable: 1200,
    nested: { deposits: 5, amount: 75, list: [{ converted: 3, commission: 10 }] },
  };
  it('passes counts, strips rand fields deep, for field roles', () => {
    const out = stripMonetary(payload, 'team_lead');
    expect(out.signups).toBe(12);
    expect(out.deposits).toBe(5);
    expect(out.revenue).toBeUndefined();
    expect(out.payable).toBeUndefined();
    expect(out.nested.amount).toBeUndefined();
    expect(out.nested.deposits).toBe(5);
    expect(out.nested.list[0].commission).toBeUndefined();
    expect(out.nested.list[0].converted).toBe(3);
  });
  it('returns payload untouched for money-visible roles', () => {
    expect(stripMonetary(payload, 'general_manager')).toEqual(payload);
  });
  it('fails closed on unknown role — strips', () => {
    expect(stripMonetary(payload, 'company_viewer').revenue).toBeUndefined();
    expect(stripMonetary(payload, undefined).revenue).toBeUndefined();
  });
  it('handles primitives and arrays', () => {
    expect(stripMonetary(7, 'agent')).toBe(7);
    expect(stripMonetary([{ payable: 1, signups: 2 }], 'agent')).toEqual([{ signups: 2 }]);
  });
});

describe('role lists', () => {
  it('admin-equivalent and field lists are disjoint', () => {
    expect(ADMIN_EQUIVALENT.filter((r) => FIELD_ROLES.includes(r))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers-api && npx vitest run tests/unit/capabilities.test.js`
Expected: FAIL — `Cannot find module '../../src/lib/capabilities.js'`

- [ ] **Step 3: Write implementation**

```js
// workers-api/src/lib/capabilities.js
// Role-access single source of truth. Pure — no DB, no IO.
// MIRRORED in frontend/src/lib/capabilities.ts — keep both in sync by hand
// (no monorepo linkage; same pattern as signalRegistry).

export const ADMIN_EQUIVALENT = ['admin', 'backoffice_admin', 'general_manager'];

// Field roles: see signup/verified/deposit COUNTS per day, never rand values
// on team/tenant data. Own incentive pay is exempt (self-scoped endpoints).
export const FIELD_ROLES = ['agent', 'field_agent', 'sales_rep', 'team_lead', 'manager'];

// Response keys that carry rand values. stripMonetary drops these for
// non-money roles — fail closed: drop, never zero-fill or pass through.
export const MONETARY_FIELDS = [
  'revenue', 'provRevenue', 'qualRevenue', 'payable', 'provisionalPace',
  'baseSalary', 'base_salary', 'amount', 'commission', 'commission_per_deposit',
  'payout', 'total_amount', 'rand_value', 'earnings', 'total_earnings',
];

export function roleAllows(role, allowedRoles) {
  if (!role) return false;
  if (role === 'super_admin') return true;
  if (ADMIN_EQUIVALENT.includes(role)) return true;
  return allowedRoles.includes(role);
}

export function canSeeMoney(role) {
  return role === 'super_admin' || ADMIN_EQUIVALENT.includes(role);
}

export function stripMonetary(value, role) {
  if (canSeeMoney(role)) return value;
  if (Array.isArray(value)) return value.map((v) => stripMonetary(v, role));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (MONETARY_FIELDS.includes(k)) continue;
      out[k] = stripMonetary(v, role);
    }
    return out;
  }
  return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd workers-api && npx vitest run tests/unit/capabilities.test.js`
Expected: PASS (all suites)

- [ ] **Step 5: Commit**

```bash
git add workers-api/src/lib/capabilities.js workers-api/tests/unit/capabilities.test.js
git commit -m "feat(capabilities): role-access SSOT — roleAllows, canSeeMoney, stripMonetary"
```

---

### Task 2: Middleware consolidation — one requireRole, kill unverified JWT path

**Files:**
- Modify: `workers-api/src/lib/middleware.js:91-100` (requireRole)
- Rewrite: `workers-api/src/middleware/auth.js` (becomes re-export shim)
- Delete: `workers-api/src/api/v1/` (entire dir — never mounted in index.js, only importer of the signature-skipping authMiddleware)
- Delete: `workers-api/src/routes/field-ops/visits.js` (dead — only imported by src/api/v1, and its `'../middleware/auth.js'` import path resolves to a nonexistent `src/routes/middleware/`)
- Test: `workers-api/tests/unit/capabilities.test.js` (extend)

**Interfaces:**
- Consumes: `roleAllows` from Task 1.
- Produces: `requireRole(...roles)` in `src/lib/middleware.js` with admin-equivalence semantics; `src/middleware/auth.js` re-exports `{ authMiddleware, requireRole }` from `../lib/middleware.js` so the 8 field-ops modules importing `'../../middleware/auth.js'` keep working unchanged.

**Background for the implementer:** Two parallel middleware implementations exist. `src/lib/middleware.js` verifies the JWT HMAC signature; `src/middleware/auth.js` decodes the payload **without verifying the signature** (forged-token acceptance if ever mounted) and has different requireRole semantics (expands admin→GM+BO but does NOT auto-allow super_admin). The unverified one is only reachable via the unmounted `src/api/v1/` — delete both the dir and the vulnerable code so it can never be mounted by accident. `requireTenant` in auth.js has zero importers — delete it too.

- [ ] **Step 1: Write the failing test (extend capabilities.test.js)**

```js
// append to workers-api/tests/unit/capabilities.test.js
import { requireRole } from '../../src/lib/middleware.js';

describe('requireRole middleware (consolidated)', () => {
  const run = async (role, ...roles) => {
    let nexted = false;
    let jsonArgs = null;
    const c = {
      get: (k) => (k === 'role' ? role : undefined),
      json: (...a) => { jsonArgs = a; return 'json-response'; },
    };
    await requireRole(...roles)(c, async () => { nexted = true; });
    return { nexted, jsonArgs };
  };

  it('backoffice_admin passes an admin gate (equivalence)', async () => {
    expect((await run('backoffice_admin', 'admin')).nexted).toBe(true);
  });
  it('general_manager passes a manager gate', async () => {
    expect((await run('general_manager', 'manager')).nexted).toBe(true);
  });
  it('agent blocked from admin gate with 403', async () => {
    const { nexted, jsonArgs } = await run('agent', 'admin');
    expect(nexted).toBe(false);
    expect(jsonArgs[1]).toBe(403);
  });
  it('listed role passes', async () => {
    expect((await run('team_lead', 'team_lead')).nexted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers-api && npx vitest run tests/unit/capabilities.test.js`
Expected: FAIL — `backoffice_admin passes an admin gate` fails (current lib requireRole has no equivalence expansion)

- [ ] **Step 3: Implement**

In `workers-api/src/lib/middleware.js`, add import at top and replace `requireRole`:

```js
import { roleAllows } from './capabilities.js';
```

Replace lines 91-100 (the whole `requireRole` export):

```js
export const requireRole = (...roles) => {
  return async (c, next) => {
    const role = c.get('role');
    if (roleAllows(role, roles)) {
      await next();
    } else {
      return c.json({ success: false, message: 'Insufficient permissions' }, 403);
    }
  };
};
```

Replace the ENTIRE contents of `workers-api/src/middleware/auth.js` with:

```js
// Consolidated: the previous local authMiddleware here decoded JWTs WITHOUT
// verifying the signature. The verified implementations live in lib/middleware.js;
// this shim only preserves existing '../../middleware/auth.js' import paths.
export { authMiddleware, requireRole } from '../lib/middleware.js';
```

Delete dead code:

```bash
git rm -r workers-api/src/api/v1
git rm workers-api/src/routes/field-ops/visits.js
```

- [ ] **Step 4: Run full backend test suite (semantics change touches every requireRole route)**

Run: `cd workers-api && npm test`
Expected: PASS. If any existing test asserted a 403 for backoffice_admin/general_manager on an admin route, that test encoded the old inconsistency — update it to expect 200 and note it in the commit body.

- [ ] **Step 5: Commit**

```bash
git add -A workers-api/src
git commit -m "fix(auth): consolidate requireRole onto capabilities SSOT, delete unverified JWT middleware and dead api/v1"
```

---

### Task 3: funnelService.js — One-Number Rail

**Files:**
- Create: `workers-api/src/services/funnelService.js`
- Test: `workers-api/src/services/funnelService.test.js` (colocated, matches `kpiSignals.test.js` pattern)

**Interfaces:**
- Produces:
  - `CONVERTED_SQL(alias='vi') → string` — SQL boolean fragment for a converted signup
  - `VERIFIED_SQL(alias='vi') → string` — SQL boolean fragment for a BO-verified (qualified) signup
  - `NOT_REJECTED_SQL(alias='vi') → string` — the standard leaderboard/incentive filter
  - `isConverted(cfv) → boolean` — JS-side check (object or JSON string)
  - `sastDay(tsMs) → 'YYYY-MM-DD'` — SAST (+2h UTC) day bucket
  - `waterfall({fieldHours, visits, signups, verified, deposits, target}) → {visitsPerHour, signupsPerVisit, verifyRate, depositRate, attainment}` — nulls on zero denominators
- Task 4 converges consumers on these; Stage 1's paceEngine consumes `sastDay` and `waterfall`.

- [ ] **Step 1: Write the failing test**

```js
// workers-api/src/services/funnelService.test.js
import { describe, it, expect } from 'vitest';
import {
  CONVERTED_SQL, VERIFIED_SQL, NOT_REJECTED_SQL,
  isConverted, sastDay, waterfall,
} from './funnelService.js';

describe('SQL fragments', () => {
  it('converted covers both legacy flags, parameterised alias', () => {
    const sql = CONVERTED_SQL('vi');
    expect(sql).toContain("json_extract(vi.custom_field_values,'$.consumer_converted') = 'Yes'");
    expect(sql).toContain("json_extract(vi.custom_field_values,'$.converted') = 1");
  });
  it('verified means BO-qualified', () => {
    expect(VERIFIED_SQL('vi')).toContain("'$.verification_status') = 'qualified'");
  });
  it('not-rejected defaults missing status to provisional', () => {
    expect(NOT_REJECTED_SQL('vi')).toContain("COALESCE(json_extract(vi.custom_field_values,'$.verification_status'),'provisional') != 'rejected'");
  });
});

describe('isConverted', () => {
  it('accepts object with either flag', () => {
    expect(isConverted({ consumer_converted: 'Yes' })).toBe(true);
    expect(isConverted({ converted: 1 })).toBe(true);
    expect(isConverted({ converted: '1' })).toBe(true);
  });
  it('accepts JSON string', () => {
    expect(isConverted('{"consumer_converted":"Yes"}')).toBe(true);
  });
  it('rejects everything else, never throws', () => {
    expect(isConverted({ consumer_converted: 'No' })).toBe(false);
    expect(isConverted(null)).toBe(false);
    expect(isConverted('not-json')).toBe(false);
    expect(isConverted(undefined)).toBe(false);
  });
});

describe('sastDay', () => {
  it('shifts UTC +2h', () => {
    // 23:30 UTC on Jan 1 = 01:30 SAST on Jan 2
    expect(sastDay(Date.parse('2026-01-01T23:30:00Z'))).toBe('2026-01-02');
    expect(sastDay(Date.parse('2026-01-01T12:00:00Z'))).toBe('2026-01-01');
  });
});

describe('waterfall', () => {
  it('multiplicative identity holds: factors recompose to deposits/target', () => {
    const w = waterfall({ fieldHours: 40, visits: 80, signups: 40, verified: 30, deposits: 15, target: 20 });
    const recomposed = 40 * w.visitsPerHour * w.signupsPerVisit * w.verifyRate * w.depositRate / 20;
    expect(recomposed).toBeCloseTo(w.attainment, 10);
    expect(w.attainment).toBeCloseTo(0.75, 10);
  });
  it('zero denominators yield null, never NaN/Infinity', () => {
    const w = waterfall({ fieldHours: 0, visits: 0, signups: 0, verified: 0, deposits: 0, target: 0 });
    expect(w.visitsPerHour).toBeNull();
    expect(w.signupsPerVisit).toBeNull();
    expect(w.verifyRate).toBeNull();
    expect(w.depositRate).toBeNull();
    expect(w.attainment).toBeNull();
    for (const v of Object.values(w)) expect(Number.isNaN(v)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers-api && npx vitest run src/services/funnelService.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```js
// workers-api/src/services/funnelService.js
// One-Number Rail: the ONLY definitions of converted / verified / SAST day /
// waterfall math. Pure — no DB, no IO. Every consumer (kpi, incentives, gm,
// cron, portal export) must use these; never inline these expressions again.

export const CONVERTED_SQL = (a = 'vi') =>
  `(json_extract(${a}.custom_field_values,'$.consumer_converted') = 'Yes' ` +
  `OR json_extract(${a}.custom_field_values,'$.converted') = 1)`;

export const VERIFIED_SQL = (a = 'vi') =>
  `json_extract(${a}.custom_field_values,'$.verification_status') = 'qualified'`;

export const NOT_REJECTED_SQL = (a = 'vi') =>
  `COALESCE(json_extract(${a}.custom_field_values,'$.verification_status'),'provisional') != 'rejected'`;

export function isConverted(cfv) {
  let obj = cfv;
  if (typeof cfv === 'string') {
    try { obj = JSON.parse(cfv); } catch { return false; }
  }
  if (!obj || typeof obj !== 'object') return false;
  return String(obj.consumer_converted).toLowerCase() === 'yes' || Number(obj.converted) === 1;
}

// SAST = UTC+2, no DST. Matches cron/jobs.js convention.
export function sastDay(tsMs) {
  return new Date(tsMs + 2 * 3600 * 1000).toISOString().slice(0, 10);
}

// Attainment identity (spec §3.2):
// attainment = fieldHours × visits/hour × signups/visit × verifyRate × depositRate ÷ target
// Zero denominators → null (spec §6: never NaN).
export function waterfall({ fieldHours, visits, signups, verified, deposits, target }) {
  const div = (num, den) => (den > 0 ? num / den : null);
  return {
    visitsPerHour: div(visits, fieldHours),
    signupsPerVisit: div(signups, visits),
    verifyRate: div(verified, signups),
    depositRate: div(deposits, verified),
    attainment: div(deposits, target),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd workers-api && npx vitest run src/services/funnelService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add workers-api/src/services/funnelService.js workers-api/src/services/funnelService.test.js
git commit -m "feat(funnel): One-Number Rail — single converted/verified/sastDay/waterfall definitions"
```

---

### Task 4: Converge all converted/verified consumers on funnelService

**Files:**
- Modify: `workers-api/src/routes/field-ops/kpi.js:58-59`
- Modify: `workers-api/src/routes/field-ops/incentives.js:135,250-252` (and the `NOT_REJECTED` filters at 58,70,82,140)
- Modify: `workers-api/src/routes/field-ops/gm.js:109`
- Modify: `workers-api/src/cron/jobs.js:717`
- Modify: `workers-api/src/routes/companyPortal.js` (registrations export status CASE — the doubled `OR ... consumer_converted='Yes'` expression)

**Interfaces:**
- Consumes: `CONVERTED_SQL`, `VERIFIED_SQL`, `NOT_REJECTED_SQL`, `isConverted` from Task 3.

**Mechanical rule for every site:** the inline `json_extract(...consumer_converted...)='Yes'` / `...converted...=1` expressions are replaced by template-interpolating the fragment functions. The SQL semantics of each query must not change EXCEPT the companyPortal registrations export, which currently double-ORs the same condition — it collapses to one `CONVERTED_SQL('vi')`. Line numbers may drift a few lines; match on the expressions shown.

- [ ] **Step 1: kpi.js** — add import, replace inline expression

```js
import { CONVERTED_SQL } from '../../services/funnelService.js';
```

At kpi.js:58-59, the dailyRows query's converted CASE currently reads:

```
SUM(CASE WHEN JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes' THEN 1 ELSE 0 END)
```

becomes:

```js
`SUM(CASE WHEN ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END)`
```

- [ ] **Step 2: incentives.js** — add import, replace four sites

```js
import { CONVERTED_SQL, VERIFIED_SQL, NOT_REJECTED_SQL } from '../../services/funnelService.js';
```

- Lines 58, 70, 82, 140: replace the literal `COALESCE(json_extract(vi.custom_field_values,'$.verification_status'),'provisional') != 'rejected'` with `${NOT_REJECTED_SQL('vi')}` (convert the query string to a template literal where needed).
- Line 135 and line 250: replace `json_extract(vi.custom_field_values,'$.consumer_converted') = 'Yes'` inside the `SUM(CASE WHEN ... )` with `${CONVERTED_SQL('vi')}`. NOTE: `CONVERTED_SQL` also accepts the legacy `converted=1` flag, which the current incentives queries do NOT — this widening is intentional (it is the bug: incentives undercounts signups recorded with the legacy flag that kpi.js counts).
- Lines 251-252: replace `json_extract(vi.custom_field_values,'$.verification_status') = 'qualified'` with `${VERIFIED_SQL('vi')}`.

- [ ] **Step 3: gm.js** — same replacement at line 109

```js
import { CONVERTED_SQL } from '../../services/funnelService.js';
// SUM(CASE WHEN ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END) converted
```

- [ ] **Step 4: cron/jobs.js:717** — replace the JS-side check

Current: `Number(f.converted) === 1 || String(f.consumer_converted).toLowerCase() === 'yes'`

```js
import { isConverted } from '../services/funnelService.js';
// ...
isConverted(f)
```

- [ ] **Step 5: companyPortal.js registrations export** — collapse the doubled condition

Current CASE: `CASE WHEN ((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') THEN 'Converted' ELSE 'Pending' END`

becomes (with `import { CONVERTED_SQL } from '../services/funnelService.js';`):

```js
`CASE WHEN ${CONVERTED_SQL('vi')} THEN 'Converted' ELSE 'Pending' END as status`
```

- [ ] **Step 6: Verify no inline definitions remain**

Run: `cd workers-api && grep -rn "consumer_converted" src --include="*.js" | grep -v funnelService`
Expected: zero matches in query-building code (matches inside funnelService.js only; comments are fine).

Run: `npm test`
Expected: PASS. The existing kpiSignals/incentives tests exercise these queries' callers.

- [ ] **Step 7: Commit**

```bash
git add -A workers-api/src
git commit -m "refactor(funnel): converge all converted/verified sites onto funnelService One-Number Rail"
```

---

### Task 5: Financial endpoint hardening — finance.js, analytics.js

**Files:**
- Modify: `workers-api/src/routes/finance.js` (all routes)
- Modify: `workers-api/src/routes/analytics.js:384,497,520,533,542,564,807`

**Interfaces:**
- Consumes: `requireRole` from `../lib/middleware.js` (consolidated in Task 2 — `admin` gate now also admits `backoffice_admin`/`general_manager` automatically).

**Background:** All these routes mount under `api` which applies the verified `authMiddleware` globally (`index.js:129`), so they're authenticated — but ANY logged-in role (including agents) can read tenant-wide revenue. That violates the field-roles-never-see-rand rule. Gate: `requireRole('admin', 'manager')` — finance module is office-console (manager is a legitimate office finance user; the field-ops counts-only rule applies to field-ops screens, which don't call these).

- [ ] **Step 1: finance.js — gate every route**

Change the import (line 2) and add a module-level guard instead of touching all 22 routes individually:

```js
import { authMiddleware, requireRole } from '../lib/middleware.js';

const app = new Hono();
// Finance is office-console only: admin-equivalents + manager. Field roles
// (agents/team leads) must never read tenant-wide monetary data.
app.use('*', authMiddleware, requireRole('admin', 'manager'));
```

Then REMOVE the now-redundant per-route `authMiddleware` argument from each route definition in the file (mechanical: `, authMiddleware,` → `,` on every `app.get/post/put/delete` line). `/payment-ledger` (line 6) needs no other change — the `use('*')` now covers it.

- [ ] **Step 2: analytics.js — gate the unguarded report routes**

Add to imports: `requireRole` from `'../lib/middleware.js'`. Insert `requireRole('admin', 'manager')` as middleware on exactly these routes (match by path, lines may drift):

- `/reports/sales-dashboard` (≈497)
- `/reports/agent-performance` (≈520)
- `/reports/stock-valuation` (≈533)
- `/reports/van-sales` (≈542)
- `/anomaly-flags` (≈564)
- `/insights/commissions` (≈807)
- `/analytics/revenue` (≈384)

Pattern for each: `app.get('/reports/sales-dashboard', async (c) => {` → `app.get('/reports/sales-dashboard', requireRole('admin', 'manager'), async (c) => {`

- [ ] **Step 3: Verify + test**

Run: `cd workers-api && grep -n "app\.\(get\|post\|put\|delete\)" src/routes/finance.js | grep -v requireRole | head` — after the `use('*')` change this should list routes but none should carry a route-level authMiddleware; spot-check the `use` line exists.
Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add workers-api/src/routes/finance.js workers-api/src/routes/analytics.js
git commit -m "fix(security): role-gate finance and analytics report endpoints — field roles blocked from tenant monetary data"
```

---

### Task 6: Financial hardening — commissions.js, cashRecon.js

**Files:**
- Modify: `workers-api/src/routes/commissions.js:24,82`
- Modify: `workers-api/src/routes/cashRecon.js:49,121,129,137`

- [ ] **Step 1: commissions.js**

Line 24 — tenant-wide stats are managerial:

```js
app.get('/commissions/stats', authMiddleware, requireRole('admin', 'manager'), async (c) => {
```

Line 82 — another user's commissions: allow self OR managerial. Replace the route opening:

```js
app.get('/commissions/user/:userId', authMiddleware, async (c) => {
  const requesterId = c.get('userId');
  const role = c.get('role');
  const targetId = c.req.param('userId');
  const managerial = ['admin', 'super_admin', 'backoffice_admin', 'general_manager', 'manager'].includes(role);
  if (targetId !== requesterId && !managerial) {
    return c.json({ success: false, message: 'Insufficient permissions' }, 403);
  }
  // ... existing body unchanged below
```

- [ ] **Step 2: cashRecon.js — approval/rejection are managerial acts**

Add `requireRole('admin', 'manager')` to:
- `POST /cash-reconciliation/sessions/:sessionId/approve-variance` (line 49)
- `POST /cash-reconciliations/:id/approve` (line 121)
- `POST /cash-reconciliations/:id/reject` (line 129)
- `POST /cash-reconciliations/:id/close` (line 137)

Pattern: `app.post('/cash-reconciliations/:id/approve', authMiddleware, requireRole('admin', 'manager'), async (c) => {`

- [ ] **Step 3: Test + commit**

Run: `cd workers-api && npm test` — Expected: PASS

```bash
git add workers-api/src/routes/commissions.js workers-api/src/routes/cashRecon.js
git commit -m "fix(security): gate commission stats/user reads and cash-recon approvals to managerial roles"
```

---

### Task 7: Field-ops hardening — roster gate, verified-anchored leaderboard

**Files:**
- Modify: `workers-api/src/routes/field-ops/kpi.js:196` (`/kpi/roster`)
- Modify: `workers-api/src/routes/field-ops/incentives.js:117-146` (`/leaderboard`)
- Test: extend `workers-api/src/services/funnelService.test.js` is NOT needed; this is route wiring — verify via `npm test` + grep.

**Interfaces:**
- Consumes: `requireRole` (Task 2), `VERIFIED_SQL`/`NOT_REJECTED_SQL`/`CONVERTED_SQL` (Task 3 — leaderboard query already converted to fragments in Task 4).

- [ ] **Step 1: Gate /kpi/roster to team leadership**

kpi.js line 196: `app.get('/kpi/roster', async (c) => {` becomes:

```js
app.get('/kpi/roster', requireRole('team_lead', 'manager', 'admin'), async (c) => {
```

(`admin` auto-expands to GM + backoffice_admin via consolidated requireRole; agents can no longer enumerate the team roster.)

- [ ] **Step 2: Leaderboard ranks on verified, not raw signups (spec §2 "Verified is the currency")**

In the `/leaderboard` query (incentives.js ≈117-146), add a verified column and change the ordering. The SELECT becomes:

```js
`SELECT v.agent_id AS id, u.first_name || ' ' || u.last_name AS name, COUNT(*) AS signups,
        SUM(CASE WHEN ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END) AS converted,
        SUM(CASE WHEN ${VERIFIED_SQL('vi')} THEN 1 ELSE 0 END) AS verified
 FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
 JOIN users u ON u.id = v.agent_id
 WHERE v.tenant_id = ? AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
   AND vi.created_at >= ? AND vi.created_at < ?
   AND ${NOT_REJECTED_SQL('vi')}
 GROUP BY v.agent_id ORDER BY verified DESC, converted DESC, signups DESC LIMIT ?`
```

(Leaderboard payload is counts-only already — no stripMonetary needed here. `/incentives/me` and `/incentives/hero` are self-scoped own-pay endpoints and stay unstripped per Global Constraints.)

- [ ] **Step 3: Test + commit**

Run: `cd workers-api && npm test` — Expected: PASS

```bash
git add workers-api/src/routes/field-ops/kpi.js workers-api/src/routes/field-ops/incentives.js
git commit -m "fix(field-ops): gate roster to leads+, rank leaderboard on verified not raw signups"
```

---

### Task 8: Accuracy fixes — KYC 501, commission totals, 999 sentinel, silent catches, deposits count

**Files:**
- Modify: `workers-api/src/routes/surveys.js:573-599`
- Modify: `workers-api/src/routes/sales.js:52-56`
- Modify: `workers-api/src/routes/field-ops/kpi.js:90,122` (999 sentinel — response only)
- Modify: `workers-api/src/routes/mobileDashboards.js:189-191`
- Modify: `workers-api/src/routes/field-ops/deposits.js:44-54`
- Modify: `frontend/src/pages/sales/orders/SalesOrderCreate.tsx:82`

- [ ] **Step 1: KYC mock endpoints return 501, not fake success**

surveys.js 573-599 has six routes (`/kyc/:id/approve`, `/kyc/:id/credit-check`, `/kyc/:id/documents/:documentId/verify`, `/kyc/:id/reject`, `/kyc/:id/request-update`, `/kyc/:id/verify-references`) each returning fabricated `{ success: true, data: { id: crypto.randomUUID(), ... status: 'completed' } }`. Replace each body with:

```js
return c.json({ success: false, message: 'KYC processing is not implemented' }, 501);
```

(Real KYC is explicitly out of scope, spec §8 — a truthful 501 beats a fake "completed" that downstream screens present as fact.)

- [ ] **Step 2: Commission list totals from one query**

sales.js:52-56 runs three sequential prepares (COUNT, rows, SUM) — count and sum can disagree with the row page under concurrent writes. Combine the two aggregates:

```js
const totals = await db.prepare(
  'SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as total_amount FROM commission_earnings ce ' + where
).bind(...params).first();
const earnings = await db.prepare(
  "SELECT ce.*, u.first_name || ' ' || u.last_name as earner_name, cr.name as rule_name FROM commission_earnings ce LEFT JOIN users u ON ce.earner_id = u.id LEFT JOIN commission_rules cr ON ce.rule_id = cr.id " + where + ' ORDER BY ce.created_at DESC LIMIT ? OFFSET ?'
).bind(...params, limitNum, offset).all();
```

Then use `totals.total` where `countR.total` was used and `totals.total_amount` where `totalAmount.total` was used. Delete the third query.

- [ ] **Step 3: 999 sentinel never reaches API responses**

kpi.js lines 90 and 122 compute `daysSinceLastVisit = lastVisit ? Math.floor(...) : 999`. The 999 is a deliberate "worse than any threshold" input to `evaluateSignals` — keep it for signal evaluation, but wherever `daysSinceLastVisit` is included in a JSON response, expose:

```js
days_since_last_visit: lastVisit ? daysSinceLastVisit : null,
```

Grep first: `grep -n "daysSinceLastVisit" workers-api/src/routes/field-ops/kpi.js` — if it is never serialized into a response (signals-only), change nothing and note that in the commit body. Do NOT change the value passed to `evaluateSignals`.

- [ ] **Step 4: Silent catches log**

mobileDashboards.js:189-191 — five `.catch(() => ({ results: [] }))` on the batch Promise.all. Each becomes:

```js
.catch((e) => { console.error('mobileDashboards batch query failed:', e.message); return { results: [] }; })
```

frontend SalesOrderCreate.tsx:82 — `.catch(() => { setCustomerPrices({}) })` becomes:

```ts
.catch((e) => { console.error('customer prices fetch failed', e); setCustomerPrices({}) })
```

- [ ] **Step 5: Deposits list returns total_count**

deposits.js:44-54 query returns rows without a total. In the handler's response, add the count:

```js
const rows = result.results || [];
return c.json({ success: true, data: rows, total_count: rows.length });
```

(If the query has a LIMIT, add a separate `SELECT COUNT(*)` with the same WHERE; if not, `rows.length` is the total — check the query first.)

- [ ] **Step 6: Test + commit**

Run: `cd workers-api && npm test` and `cd frontend && npx tsc --noEmit` — Expected: PASS / no type errors

```bash
git add -A workers-api/src frontend/src
git commit -m "fix(accuracy): KYC honest 501s, atomic commission totals, null not 999 in responses, logged catches, deposits total_count"
```

---

### Task 9: Company portal hardening — login rate-limit, revocation, export audit

**Files:**
- Modify: `workers-api/src/routes/companyPortal.js` (login route ≈285-302, `companyAuthMiddleware` ≈7-50, export route ≈255-282)

**Interfaces:**
- Consumes: `rateLimiter` from `../lib/middleware.js` (existing, D1-backed); `auditLogService` from `../services/auditLogService.js` (existing, buffered writer).

- [ ] **Step 1: Rate-limit the portal login**

The login route mounts on `app` (absolute path), outside the `api`-scoped global limiter. Add a strict limiter directly:

```js
import { rateLimiter } from '../lib/middleware.js';
// ...
app.post('/api/field-ops/company-auth/login', rateLimiter(5, 60000), async (c) => {
```

(5 attempts/min/IP; existing limiter fails open on D1 errors, which is acceptable here — bcrypt already slows brute force.)

- [ ] **Step 2: Revocation — companyAuthMiddleware checks is_active per request**

Portal JWTs currently stay valid until exp even after a login is deactivated. In `companyAuthMiddleware`, after the payload checks pass (exp valid, companyId present) and before `await next()`, add:

```js
const live = await c.env.DB.prepare(
  'SELECT is_active FROM company_logins WHERE id = ?'
).bind(payload.userId).first();
if (!live || !live.is_active) {
  return c.json({ success: false, message: 'Access revoked' }, 401);
}
```

(One indexed read per portal request; portal traffic is low. Deactivating a `company_logins` row now revokes immediately — no token_version machinery needed.)

- [ ] **Step 3: Audit portal CSV exports**

In the export route (`GET /api/field-ops/company-portal/export`), after building the CSV and before returning the Response:

```js
import { auditLogService } from '../services/auditLogService.js';
// (check the service's actual export name/signature — grep 'export' in
// src/services/auditLogService.js and match the pattern of an existing caller)
await auditLogService.log(c.env.DB, {
  tenant_id: tenantId,
  user_id: c.get('userId'),
  action: 'portal_export',
  resource: 'company_portal_csv',
  resource_id: companyId,
  metadata: JSON.stringify({ type: type || 'visits', start: startD, end: endD, rows: rows.length }),
  ip_address: c.req.header('CF-Connecting-IP') || '',
  status: 'success',
});
```

If `auditLogService` exposes a different call shape (e.g. class instance or `logAudit(...)`), adapt to it — the requirement is one `audit_logs` row per export with action `portal_export`, the company id, row count, and date range.

- [ ] **Step 4: Test + commit**

Run: `cd workers-api && npm test` — Expected: PASS

```bash
git add workers-api/src/routes/companyPortal.js
git commit -m "fix(portal): rate-limit login, per-request revocation check, audit CSV exports"
```

---

### Task 10: Portal signed photo URLs

**Files:**
- Modify: `workers-api/src/routes/companyPortal.js` (photo_url response sites ≈176, 209; new proxy route)

**Interfaces:**
- Produces: `GET /api/field-ops/company-portal/photo/:visitId?exp=<unix>&sig=<hex>` — HMAC-signed, expiring, unauthenticated proxy. Signing helper `signPhotoUrl(visitId, jwtSecret, nowMs) → path string`.

**Background:** Portal responses currently embed raw `visits.photo_url` — a URL that works forever for anyone it's forwarded to. Replace with short-lived signed proxy links; the proxy streams the underlying object.

- [ ] **Step 1: Add signing helpers (top of companyPortal.js, after imports)**

```js
const PHOTO_TTL_MS = 15 * 60 * 1000;

async function hmacHex(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function signPhotoUrl(visitId, jwtSecret, nowMs = Date.now()) {
  const exp = Math.floor((nowMs + PHOTO_TTL_MS) / 1000);
  const sig = await hmacHex(jwtSecret, `photo|${visitId}|${exp}`);
  return `/api/field-ops/company-portal/photo/${visitId}?exp=${exp}&sig=${sig}`;
}
```

- [ ] **Step 2: Replace raw photo_url in responses**

At the two response sites (≈lines 176 and 209) where rows include `photo_url`, map each row before returning:

```js
const withPhotos = await Promise.all(rows.map(async (r) => ({
  ...r,
  photo_url: r.photo_url ? await signPhotoUrl(r.id, c.env.JWT_SECRET) : null,
})));
```

(Use the row's visit id field — confirm whether the row key is `id` or `visit_id` at each site and pass that.)

- [ ] **Step 3: Add the proxy route (public — signature IS the auth)**

```js
app.get('/api/field-ops/company-portal/photo/:visitId', async (c) => {
  const { visitId } = c.req.param();
  const exp = parseInt(c.req.query('exp') || '0', 10);
  const sig = c.req.query('sig') || '';
  if (!exp || exp < Math.floor(Date.now() / 1000)) {
    return c.json({ success: false, message: 'Link expired' }, 410);
  }
  const expected = await hmacHex(c.env.JWT_SECRET, `photo|${visitId}|${exp}`);
  if (sig !== expected) return c.json({ success: false, message: 'Invalid signature' }, 403);
  const row = await c.env.DB.prepare('SELECT photo_url FROM visits WHERE id = ?').bind(visitId).first();
  if (!row || !row.photo_url) return c.json({ success: false, message: 'Not found' }, 404);
  const upstream = await fetch(row.photo_url);
  if (!upstream.ok) return c.json({ success: false, message: 'Photo unavailable' }, 502);
  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'image/jpeg',
      'Cache-Control': 'private, max-age=300',
    },
  });
});
```

If `visits.photo_url` values turn out to be internal R2 keys rather than fetchable URLs (check a production row or the upload code path in `src/routes/fieldOps.js`), swap the `fetch` for the R2 binding read used by the existing `api.get('/uploads/:id/:subId')` handler in `index.js:225` — mirror that handler's object-get code.

- [ ] **Step 4: Test + commit**

Run: `cd workers-api && npm test` — Expected: PASS

```bash
git add workers-api/src/routes/companyPortal.js
git commit -m "fix(portal): expiring HMAC-signed photo links replace permanent raw URLs"
```

---

### Task 11: Frontend capabilities mirror + dead-link cleanup

**Files:**
- Create: `frontend/src/lib/capabilities.ts`
- Modify: `frontend/src/store/auth.store.ts:217-224` (hasRole delegates to mirror)
- Modify: `frontend/src/pages/mobile/MoreMenuPage.tsx:30,33,42,71-77`
- Modify: `frontend/src/components/mobile/MobileBottomTabs.tsx:10`
- Test: `frontend/src/lib/capabilities.test.ts`

**Interfaces:**
- Produces: `roleAllows(role, allowedRoles)`, `canSeeMoney(role)`, `ADMIN_EQUIVALENT`, `FIELD_ROLES` — TS mirror of `workers-api/src/lib/capabilities.js` (labels of truth: backend file).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/capabilities.test.ts
import { describe, it, expect } from 'vitest'
import { roleAllows, canSeeMoney, FIELD_ROLES } from './capabilities'

describe('capabilities mirror', () => {
  it('admin-equivalents pass staff gates', () => {
    expect(roleAllows('backoffice_admin', ['admin'])).toBe(true)
    expect(roleAllows('general_manager', ['manager'])).toBe(true)
  })
  it('super_admin passes everything', () => {
    expect(roleAllows('super_admin', ['team_lead'])).toBe(true)
  })
  it('field roles pass only when listed', () => {
    expect(roleAllows('agent', ['admin'])).toBe(false)
    expect(roleAllows('team_lead', ['team_lead'])).toBe(true)
  })
  it('field roles never see money', () => {
    for (const r of FIELD_ROLES) expect(canSeeMoney(r)).toBe(false)
    expect(canSeeMoney('general_manager')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/lib/capabilities.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the mirror**

```ts
// frontend/src/lib/capabilities.ts
// HAND-MIRRORED from workers-api/src/lib/capabilities.js (source of truth).
// No monorepo linkage exists — if you change one file, change both.

export const ADMIN_EQUIVALENT = ['admin', 'backoffice_admin', 'general_manager']

export const FIELD_ROLES = ['agent', 'field_agent', 'sales_rep', 'team_lead', 'manager']

export function roleAllows(role: string | undefined, allowedRoles: string[]): boolean {
  if (!role) return false
  if (role === 'super_admin') return true
  if (ADMIN_EQUIVALENT.includes(role)) return true
  return allowedRoles.includes(role)
}

export function canSeeMoney(role: string | undefined): boolean {
  return role === 'super_admin' || ADMIN_EQUIVALENT.includes(role ?? '')
}
```

- [ ] **Step 4: hasRole delegates to the mirror**

In `frontend/src/store/auth.store.ts`, add `import { roleAllows } from '../lib/capabilities'` at the top, then replace the BODY of the existing `hasRole` store method (lines 217-224 — keep the method's existing declaration shape inside the zustand store, only swap the logic):

```ts
hasRole: (role) => {
  const user = get().user
  // Single source of truth: capabilities mirror (backend lib/capabilities.js).
  if (role === 'super_admin') return user?.role === 'super_admin'
  return roleAllows(user?.role, [role])
},
```

(Semantics identical to the current inline `adminLike` logic — this removes the duplicate encoding, it doesn't change behavior. If the method reads user state differently — e.g. a `state` param instead of `get()` — keep that access pattern and swap only the boolean logic.)

- [ ] **Step 4b: MobileBottomTabs — backoffice_admin sees the tabs its admin-equivalence implies**

In `frontend/src/components/mobile/MobileBottomTabs.tsx:10`, `MGMT = ['admin','super_admin','manager','general_manager']` omits `backoffice_admin`, so a BO admin loses the Field/Sales/Stock tabs despite being admin-equivalent (gate by capability, not exact role). Change:

```ts
const MGMT = ['admin', 'super_admin', 'manager', 'general_manager', 'backoffice_admin']
```

The Finance tab already lists `backoffice_admin` explicitly; that entry becomes redundant but harmless — leave it. Confirm the file's actual path with `grep -rn "MobileBottomTabs" frontend/src --include="*.tsx" -l` before editing (component lives under `frontend/src/components/`).

- [ ] **Step 5: Fix the 9 dead MoreMenuPage links**

In `frontend/src/pages/mobile/MoreMenuPage.tsx`:
- Line 30: `/visit-workflow` → `/field-operations/visit-workflow`
- Line 33: `/routes` → `/van-sales/routes`
- Line 42: `/van-sales/loads` → `/van-sales/van-loads`
- Lines 71, 72, 74, 75, 76 (`/settings/profile`, `/settings/notifications`, `/admin/security`, `/admin/api-keys`, `/settings/appearance`): DELETE these items — no such routes exist in App.tsx and no page components exist for them.
- Line 77: `/help` → DELETE (no route).

- [ ] **Step 5b: Gate desktop money routes for field roles (audit-driven addition)**

A live-caller audit found that the desktop Finance/Commissions/Insights screens sit behind a `<ProtectedRoute>` with **no `requiredRole`** (`App.tsx:542-546`), and `DashboardLayout.tsx:57` only redirects the literal `'agent'` role — so `team_lead`/`field_agent`/`sales_rep` can browse to money screens today. Tasks 5-6 gate the backend endpoints to admin/manager; without this step those roles would see 403 error states instead of being routed away.

In `frontend/src/App.tsx`, add `requiredRole="manager"` to the route wrappers for:
- the Finance route group (routes rendering `FinanceDashboard`, invoice pages, payment pages, cash-reconciliation pages, commission-payouts — the block around `App.tsx:822-1059`)
- the `commissions` and `commissions/reports` routes (`App.tsx:844,853` — `CommissionDashboardPage`, `CommissionReportsPage`)
- the `insights/commissions` route (`App.tsx:990` — `CommissionInsights`)

Use whatever per-route gating shape `ProtectedRoute` already supports (`requiredRole` prop exists — confirm its semantics call `hasRole`, which after Step 4 delegates to `roleAllows`, so `manager`, admin-equivalents, and `super_admin` pass; `agent`/`field_agent`/`sales_rep`/`team_lead` are redirected). Do NOT touch `DashboardLayout.tsx:57` — team_lead legitimately uses desktop TeamCockpit. Do NOT gate `field-operations/team-cockpit`.

Also in `frontend/src/config/navigation.ts`: the Finance section header (`navigation.ts:245-263`) lacks `requiresRole` while Admin/Super Admin sections have it (`navigation.ts:270,298`) — add the same `requiresRole` shape with `'manager'` so the nav entry hides for field roles.

- [ ] **Step 6: Run tests + typecheck**

Run: `cd frontend && npx vitest run src/lib/capabilities.test.ts && npx tsc --noEmit`
Expected: PASS / no errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/capabilities.ts frontend/src/lib/capabilities.test.ts frontend/src/store/auth.store.ts frontend/src/pages/mobile/MoreMenuPage.tsx frontend/src/components/mobile/MobileBottomTabs.tsx frontend/src/App.tsx frontend/src/config/navigation.ts
git commit -m "feat(frontend): capabilities mirror as hasRole SSOT, gate desktop money routes, fix dead links and BO-admin tabs"
```

---

### Task 12: Playwright bootstrap — zero-rand guard

**Files:**
- Create: `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/fixtures/roles.ts`, `e2e/tests/money-visibility.spec.ts`
- Modify: root `.gitignore` (add `e2e/node_modules`, `e2e/test-results`, `e2e/playwright-report`)

**Interfaces:**
- Produces: `e2e/` harness at repo root (spec Layer 4 location); `ROLE_CREDS` fixture map that later stages extend to all 9 roles + portal login. Tests are skipped unless `E2E_BASE_URL` is set (no local D1 stack; runs against a deployed environment with seeded test users).

- [ ] **Step 1: Scaffold**

```json
// e2e/package.json
{
  "name": "fieldvibe-e2e",
  "private": true,
  "scripts": { "test": "playwright test" },
  "devDependencies": { "@playwright/test": "^1.44.0" }
}
```

```ts
// e2e/playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://fieldvibe.vantax.co.za',
    trace: 'retain-on-failure',
  },
})
```

```ts
// e2e/fixtures/roles.ts
// Test credentials come from env — never commit real credentials.
// Later stages extend this map to all 9 staff roles + 1 company portal login.
export const ROLE_CREDS: Record<string, { email?: string; password?: string }> = {
  agent: { email: process.env.E2E_AGENT_EMAIL, password: process.env.E2E_AGENT_PASSWORD },
  team_lead: { email: process.env.E2E_TEAM_LEAD_EMAIL, password: process.env.E2E_TEAM_LEAD_PASSWORD },
  general_manager: { email: process.env.E2E_GM_EMAIL, password: process.env.E2E_GM_PASSWORD },
}

export function haveCreds(role: string): boolean {
  const c = ROLE_CREDS[role]
  return Boolean(c?.email && c?.password)
}
```

```ts
// e2e/tests/money-visibility.spec.ts
import { test, expect, Page } from '@playwright/test'
import { ROLE_CREDS, haveCreds } from '../fixtures/roles'

// Canonical business rule (spec §2): field roles see signup/verified/deposit
// COUNTS per day — never rand amounts. GM sees revenue = deposits × config rate.
const RAND_TEXT = /R\s?\d[\d\s,]*(\.\d{2})?/

async function login(page: Page, role: string) {
  const { email, password } = ROLE_CREDS[role]
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email!)
  await page.getByLabel(/password/i).fill(password!)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/dashboard|agent/)
}

for (const role of ['agent', 'team_lead']) {
  test(`${role} field-ops screens show no rand values`, async ({ page }) => {
    test.skip(!process.env.E2E_BASE_URL || !haveCreds(role), 'E2E env not configured')
    await login(page, role)
    for (const path of ['/agent/dashboard', '/field-operations']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const body = await page.locator('body').innerText()
      expect(body, `${role} sees rand text on ${path}`).not.toMatch(RAND_TEXT)
    }
  })
}

test('general_manager sees revenue on GM overview', async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL || !haveCreds('general_manager'), 'E2E env not configured')
  await login(page, 'general_manager')
  await page.goto('/dashboard/gm')
  await page.waitForLoadState('networkidle')
  const body = await page.locator('body').innerText()
  expect(body).toMatch(RAND_TEXT)
})
```

- [ ] **Step 2: Install + verify collection**

Run: `cd e2e && npm install && npx playwright test --list`
Expected: 3 tests listed (they self-skip without env at run time; `--list` proves compilation).

- [ ] **Step 3: Commit**

```bash
git add e2e .gitignore
git commit -m "test(e2e): Playwright bootstrap — zero-rand guard for field roles, revenue check for GM"
```

---

## Ship & verify

1. `cd workers-api && npm test && npm run lint` — full green.
2. `cd frontend && npx tsc --noEmit && npm run build` — green.
3. Push branch, open PR against `main`, title `feat: Performance OS Stage 0b — trust foundation (capabilities SSOT, funnel rail, financial hardening)`.
4. No migrations to apply for this stage.
5. Merge: `gh pr merge <n> --squash --admin`. CI deploys frontend then backend.
6. Post-deploy manual checks (production):
   - As an agent login: `curl -H "Authorization: Bearer <agent JWT>" https://fieldvibe-api.vantax.co.za/api/finance/dashboard` → 403.
   - As GM: same call → 200.
   - `curl .../api/reports/sales-dashboard` with agent JWT → 403.
   - Agent PWA: dashboard, incentives, leaderboard all still render; leaderboard order now follows verified counts.
   - Company portal: login works (then 6 rapid wrong-password attempts → 429); dashboard photo links open and expire after 15 min; a deactivated `company_logins` row 401s immediately.
   - `audit_logs` gains a `portal_export` row after downloading a portal CSV.
7. Rollback: single squashed commit — `git revert` on main. No schema changes, nothing to unwind in D1.

## Out of scope for this plan (later stages)

- paceEngine / signals cadence / escalation / effect-delta (Stage 1)
- Portal two-way uploads + disputes (Stage 2)
- Cockpits, behavior gap, GM Monday pack (Stage 3), gamification (Stage 4)
- Full 9-role Playwright matrix + displayed===API assertions (grows per stage)
- Field-ops report/GM screens revenue display auditing beyond endpoints hardened here (Stage 3 cockpit redesign re-lands those screens on funnelService + canSeeMoney)
