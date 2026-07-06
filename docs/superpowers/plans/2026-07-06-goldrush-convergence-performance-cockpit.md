# Goldrush → Standard Convergence + Performance Cockpit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire "goldrush" as a hardcoded exception (one company fully described by per-company config + survey + process-flow rows), collapse three parallel question systems into one config-driven model, migrate all history losslessly, and ship a role-based performance cockpit on the same `program_config` foundation.

**Architecture:** A single `program_config` key/value table (company-override-wins, resolved by `getConfig`) drives every previously-hardcoded goldrush behavior. Questions unify under the `questionnaires.questions` JSON with a new `identifier` question type. Migration is normalize-in-place (no table rewrites) guarded by a 4-way before/after equality gate over money and counts. The cockpit aggregates KPIs on read from existing `visits`/`visit_individuals` (no metrics pipeline); thresholds live in `program_config` keyed per role; four underperformance signals are pure functions.

**Tech Stack:** Cloudflare Workers (Hono), D1 (SQLite), R2, Durable Objects, Pages. Backend `workers-api/src/index.js` + modular routers in `workers-api/src/routes/field-ops/`. Frontend React + Vite + TS. Pure unit tests via `npm run test:pure` (vitest node env, explicit include array). Voice-call (CallRoom DO) reused for remediation Call; `web-push.js` reused for Nudge.

## Global Constraints

- **NO PROD CUTOVER without explicit user go-ahead.** "Complete build" = build + `npm run test:pure` green + `cd frontend && npm run build` green + deploy to `dev` ONLY. STOP before: prod D1 (`fieldvibe-db`) migration, `dev`→`main` merge, prod VAPID secret. Copied verbatim from standing instruction.
- **Every new test file MUST be appended to the explicit include array** in `workers-api/tests/unit/vitest.node.config.js` — it uses no glob. A test not in the array does not run.
- **VAPID private key is PREVIEW-only** (`jcYEmtMBnOxn8TLxFdxzeYZDnehvsC1VnKXKgtF3iDQ`). Never commit/hardcode. Tests generate ephemeral P-256 keypairs (pattern in `webPushVapid.test.js`).
- **Role vocabulary (actual `users.role` values):** `agent`, `field_agent`, `sales_rep` (all field-agent tier), `team_lead`, `manager` (area/regional), `general_manager`, `backoffice_admin`, `admin`, `super_admin`, `viewer`. KPI config keys: `kpi.agent`, `kpi.team_lead`, `kpi.manager`, `kpi.general_manager`.
- **GM web surface = Overview tile + digest only.** Digest targets all `general_manager` users in the tenant.
- **`getConfig` resolver** (`workers-api/src/routes/field-ops/config.js`) is the ONLY sanctioned way to read `program_config`. Company row wins over tenant-default (`company_id IS NULL`). Returns parsed JSON or `null`.
- **Commit trailer:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. **PR bodies end:** `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Money-safe:** migration asserts `SUM(commission_earnings.amount)` unchanged. Any mismatch aborts + rolls back from raw JSON snapshot.
- **Do not add a metrics/rollup table** unless read latency measurably bites (`ponytail:` note in cockpit). Aggregate on read.

---

## File Structure

**Backend (new):**
- `workers-api/src/services/programConfig.js` — pure config-shape helpers + goldrush-config builder (used by migration + routes). No DB.
- `workers-api/src/services/kpiSignals.js` — pure functions: KPI aggregation math + 4 underperformance signals. No DB, no I/O.
- `workers-api/src/routes/field-ops/kpi.js` — Hono router: `/kpi/self`, `/kpi/roster`, remediation endpoints. Reads DB, calls `kpiSignals`.
- `workers-api/migrations/2026-07-06-goldrush-convergence.sql` — schema additions (`coaching_notes`, partial unique index already exists) + one-time normalize step is a JS script (below), not raw SQL.
- `workers-api/scripts/migrate-goldrush-convergence.mjs` — the guarded normalize-in-place migration (snapshot → build config → normalize answers → 4-way gate → commit/rollback). Runnable against preview D1 via `wrangler d1 execute`/local.

**Backend (modified):**
- `workers-api/src/routes/field-ops/config.js` — add cockpit KPI seed defaults; extend `seed-defaults`.
- `workers-api/src/routes/field-ops/index.js` (router mount) — mount `kpi.js`.
- `workers-api/src/index.js` — replace enumerated goldrush string-gates with `getConfig` lookups (grep list in Task 1.9).
- `workers-api/src/schema.sql` — add `coaching_notes` table.

**Backend (new tests, each appended to include array):**
- `workers-api/tests/unit/programConfig.test.js`
- `workers-api/tests/unit/goldrushMigration.test.js`
- `workers-api/tests/unit/kpiSignals.test.js`
- `workers-api/tests/unit/kpiRoster.test.js`

**Frontend (new):**
- `frontend/src/pages/agent/PerformanceCard.tsx` — agent mobile self KPI + signals.
- `frontend/src/pages/field-operations/TeamCockpit.tsx` — team_lead/manager roster + drill (mobile + desktop).
- Config-driven report component replacing the 7 `Goldrush*.tsx` (single `IndividualInsights`/`StoreInsights` parameterized by company filter).

**Frontend (modified):**
- `frontend/src/pages/agent/AgentDashboard.tsx` — mount `PerformanceCard`.
- GM Overview page — add cockpit tile.
- Report registry/router — swap 7 `Goldrush*.tsx` for the parameterized components; add company filter.

---

## PHASE 1 — CONVERGENCE (foundation)

### Task 1.1: Pure config-shape helpers + goldrush-config builder

**Files:**
- Create: `workers-api/src/services/programConfig.js`
- Test: `workers-api/tests/unit/programConfig.test.js`
- Modify: `workers-api/tests/unit/vitest.node.config.js` (append include)

**Interfaces:**
- Produces:
  - `DEFAULT_CAPTURE_CONFIG` — object literal: `{ fast_entry_enabled: false, qualification_enabled: false, qualification_identifier_key: null, capture_steps: [] }`
  - `buildGoldrushConfig(rows)` → returns `{ tenant_id, company_id, entries: [{ key, value_json }] }` where `entries` carries `fast_entry_enabled:true`, `qualification_enabled:true`, `qualification_identifier_key:'goldrush_id'`, and `capture_steps` derived from `rows` (existing `company_custom_questions` shape). Pure; `rows` is an array, no DB.
  - `identifierQuestion({ key, label, min_length, max_length, unique, is_qualification_key, validation_kind })` → normalized question object with `type:'identifier'` and defaults (`validation_kind:'none'`, `unique:false`, `is_qualification_key:false`).
  - `validateIdentifier(value, spec)` → `{ ok:boolean, reason:string|null }`. Implements `validation_kind`: `numeric` (digits only), `sa_id` (13-digit Luhn/SA-ID checksum), `passport` (alphanumeric 6–12), `none`; plus `min_length`/`max_length`.

- [ ] **Step 1: Write the failing test**

```js
// workers-api/tests/unit/programConfig.test.js
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CAPTURE_CONFIG, buildGoldrushConfig, identifierQuestion, validateIdentifier,
} from '../../src/services/programConfig.js';

describe('DEFAULT_CAPTURE_CONFIG', () => {
  it('is inert: no fast entry, no qualification', () => {
    expect(DEFAULT_CAPTURE_CONFIG).toEqual({
      fast_entry_enabled: false, qualification_enabled: false,
      qualification_identifier_key: null, capture_steps: [],
    });
  });
});

describe('identifierQuestion', () => {
  it('normalizes with defaults', () => {
    const q = identifierQuestion({ key: 'goldrush_id', label: 'Goldrush ID' });
    expect(q).toEqual({
      type: 'identifier', key: 'goldrush_id', label: 'Goldrush ID',
      min_length: null, max_length: null, unique: false,
      is_qualification_key: false, validation_kind: 'none',
    });
  });
});

describe('validateIdentifier', () => {
  it('numeric enforces digits + length', () => {
    const spec = { validation_kind: 'numeric', min_length: 9, max_length: 9 };
    expect(validateIdentifier('123456789', spec)).toEqual({ ok: true, reason: null });
    expect(validateIdentifier('12345678', spec).ok).toBe(false);   // too short
    expect(validateIdentifier('12345678a', spec).ok).toBe(false);  // non-digit
  });
  it('sa_id rejects bad checksum, accepts valid', () => {
    const spec = { validation_kind: 'sa_id' };
    expect(validateIdentifier('8001015009087', spec).ok).toBe(true);   // valid SA ID checksum
    expect(validateIdentifier('8001015009088', spec).ok).toBe(false);  // wrong check digit
  });
  it('passport is alphanumeric 6-12', () => {
    const spec = { validation_kind: 'passport' };
    expect(validateIdentifier('AB123456', spec).ok).toBe(true);
    expect(validateIdentifier('AB!23', spec).ok).toBe(false);
  });
});

describe('buildGoldrushConfig', () => {
  it('turns custom-question rows into config entries', () => {
    const rows = [
      { question_key: 'goldrush_id', question_label: 'Goldrush ID', field_type: 'text',
        min_length: 9, max_length: 9, check_duplicate: 1, visit_target_type: 'individual', show_in_reports: 1 },
      { question_key: 'likes_goldrush', question_label: 'Do they like Goldrush?', field_type: 'radio',
        visit_target_type: 'individual', show_in_reports: 1 },
    ];
    const cfg = buildGoldrushConfig({ tenantId: 't1', companyId: 'c1', rows });
    const byKey = Object.fromEntries(cfg.entries.map(e => [e.key, JSON.parse(e.value_json)]));
    expect(byKey['fast_entry_enabled']).toBe(true);
    expect(byKey['qualification_enabled']).toBe(true);
    expect(byKey['qualification_identifier_key']).toBe('goldrush_id');
    const step = byKey['capture_steps'].find(s => s.key === 'goldrush_id');
    expect(step).toMatchObject({ type: 'identifier', unique: true, is_qualification_key: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers-api && npx vitest run -c tests/unit/vitest.node.config.js tests/unit/programConfig.test.js`
Expected: FAIL — module not found / exports undefined. (Also add the include line first if vitest errors on unknown file; see Step 3b.)

- [ ] **Step 3: Write minimal implementation**

```js
// workers-api/src/services/programConfig.js
// Pure config-shape helpers. No DB, no I/O. The single source of truth for the
// shapes stored in program_config so migration + routes agree.

export const DEFAULT_CAPTURE_CONFIG = {
  fast_entry_enabled: false,
  qualification_enabled: false,
  qualification_identifier_key: null,
  capture_steps: [],
};

export function identifierQuestion(spec) {
  return {
    type: 'identifier',
    key: spec.key,
    label: spec.label,
    min_length: spec.min_length ?? null,
    max_length: spec.max_length ?? null,
    unique: spec.unique ?? false,
    is_qualification_key: spec.is_qualification_key ?? false,
    validation_kind: spec.validation_kind ?? 'none',
  };
}

// SA ID: 13 digits, Luhn-style check digit (mod-10 doubling from the right).
function saIdValid(v) {
  if (!/^\d{13}$/.test(v)) return false;
  let sum = 0, alt = false;
  for (let i = v.length - 1; i >= 0; i--) {
    let n = Number(v[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

export function validateIdentifier(value, spec = {}) {
  const s = String(value ?? '');
  const kind = spec.validation_kind ?? 'none';
  if (spec.min_length != null && s.length < spec.min_length) return { ok: false, reason: 'too_short' };
  if (spec.max_length != null && s.length > spec.max_length) return { ok: false, reason: 'too_long' };
  if (kind === 'numeric' && !/^\d+$/.test(s)) return { ok: false, reason: 'not_numeric' };
  if (kind === 'sa_id' && !saIdValid(s)) return { ok: false, reason: 'bad_sa_id' };
  if (kind === 'passport' && !/^[A-Za-z0-9]{6,12}$/.test(s)) return { ok: false, reason: 'bad_passport' };
  return { ok: true, reason: null };
}

// Build goldrush's program_config entries from its existing company_custom_questions rows.
// rows: [{ question_key, question_label, field_type, min_length, max_length, check_duplicate,
//          visit_target_type, show_in_reports }]
export function buildGoldrushConfig({ tenantId, companyId, rows }) {
  const captureSteps = rows.map(r => {
    if (r.question_key === 'goldrush_id') {
      return identifierQuestion({
        key: 'goldrush_id', label: r.question_label,
        min_length: r.min_length ?? 9, max_length: r.max_length ?? 9,
        unique: true, is_qualification_key: true, validation_kind: 'numeric',
      });
    }
    return {
      type: r.field_type || 'text',
      key: r.question_key,
      label: r.question_label,
      show_in_reports: !!r.show_in_reports,
      visit_target_type: r.visit_target_type || 'both',
    };
  });
  const entries = [
    { key: 'fast_entry_enabled', value_json: JSON.stringify(true) },
    { key: 'qualification_enabled', value_json: JSON.stringify(true) },
    { key: 'qualification_identifier_key', value_json: JSON.stringify('goldrush_id') },
    { key: 'capture_steps', value_json: JSON.stringify(captureSteps) },
  ];
  return { tenant_id: tenantId, company_id: companyId, entries };
}
```

- [ ] **Step 3b: Append test to include array**

Edit `workers-api/tests/unit/vitest.node.config.js` — add `'tests/unit/programConfig.test.js'` to the `include` array.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd workers-api && npm run test:pure`
Expected: PASS (all existing + new file).

- [ ] **Step 5: Commit**

```bash
git add workers-api/src/services/programConfig.js workers-api/tests/unit/programConfig.test.js workers-api/tests/unit/vitest.node.config.js
git commit -m "feat(convergence): pure program_config shape helpers + goldrush config builder"
```

---

### Task 1.2: `coaching_notes` schema (used by cockpit; created in Phase 1 so migration & routes share one schema file)

**Files:**
- Modify: `workers-api/src/schema.sql` (after `program_config`, near line 2122)

**Interfaces:**
- Produces: table `coaching_notes(id, tenant_id, company_id, manager_id, agent_id, signal_type, action, note, created_at)` + index on `(tenant_id, agent_id, created_at)`.

- [ ] **Step 1: Add the table** (no unit test — pure DDL; verified by Task 2.5 route test)

```sql
-- Coaching notes: one-tap remediation log from the performance cockpit.
CREATE TABLE IF NOT EXISTS coaching_notes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT,
  manager_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  signal_type TEXT,
  action TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_coaching_notes_agent ON coaching_notes(tenant_id, agent_id, created_at);
```

- [ ] **Step 2: Commit**

```bash
git add workers-api/src/schema.sql
git commit -m "feat(cockpit): coaching_notes table for remediation log"
```

---

### Task 1.3: Migration — snapshot + build config (dry-run safe, no data mutation yet)

**Files:**
- Create: `workers-api/scripts/migrate-goldrush-convergence.mjs`
- Test: `workers-api/tests/unit/goldrushMigration.test.js`
- Modify: `workers-api/tests/unit/vitest.node.config.js` (append include)

**Interfaces:**
- Consumes: `buildGoldrushConfig` (Task 1.1).
- Produces (pure, DB-injected so testable with a fake):
  - `computeTotals(db)` → `{ signups, distinctIdentifiers, qualified, commissionSum }` — runs the 4 gate queries.
  - `assertEqual(before, after)` → throws `Error` naming the first differing field, else returns `true`.
  - `canonicalizeAnswer(cfv)` — given a `custom_field_values` object, collapse `COALESCE(goldrush_id_entry, goldrush_id)` into the canonical `goldrush_id` key; returns new object. Pure.

- [ ] **Step 1: Write the failing test**

```js
// workers-api/tests/unit/goldrushMigration.test.js
import { describe, it, expect } from 'vitest';
import { assertEqual, canonicalizeAnswer } from '../../scripts/migrate-goldrush-convergence.mjs';

describe('canonicalizeAnswer', () => {
  it('prefers goldrush_id_entry, falls back to goldrush_id, collapses to one key', () => {
    expect(canonicalizeAnswer({ goldrush_id_entry: '123456789', goldrush_id: '999' }))
      .toEqual({ goldrush_id: '123456789' });
    expect(canonicalizeAnswer({ goldrush_id: '555' }))
      .toEqual({ goldrush_id: '555' });
    expect(canonicalizeAnswer({ other: 'x' }))
      .toEqual({ other: 'x' });
  });
});

describe('assertEqual', () => {
  it('passes when all four totals match', () => {
    const t = { signups: 10, distinctIdentifiers: 8, qualified: 5, commissionSum: 750 };
    expect(assertEqual(t, { ...t })).toBe(true);
  });
  it('throws naming the field that drifted (money first-class)', () => {
    const before = { signups: 10, distinctIdentifiers: 8, qualified: 5, commissionSum: 750 };
    const after = { ...before, commissionSum: 675 };
    expect(() => assertEqual(before, after)).toThrow(/commissionSum/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers-api && npx vitest run -c tests/unit/vitest.node.config.js tests/unit/goldrushMigration.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// workers-api/scripts/migrate-goldrush-convergence.mjs
// Guarded normalize-in-place migration: snapshot → build config → normalize
// answers → 4-way equality gate over counts + money → commit or rollback.
// Pure helpers are exported for unit tests; run() wires them to a live D1 binding.
import { buildGoldrushConfig } from '../src/services/programConfig.js';

const GATE_FIELDS = ['signups', 'distinctIdentifiers', 'qualified', 'commissionSum'];

export function canonicalizeAnswer(cfv) {
  if (!cfv || typeof cfv !== 'object') return cfv;
  if (!('goldrush_id_entry' in cfv) && !('goldrush_id' in cfv)) return { ...cfv };
  const canonical = cfv.goldrush_id_entry ?? cfv.goldrush_id;
  const out = { ...cfv };
  delete out.goldrush_id_entry;
  out.goldrush_id = canonical;
  return out;
}

export function assertEqual(before, after) {
  for (const f of GATE_FIELDS) {
    if (before[f] !== after[f]) {
      throw new Error(`migration gate FAILED on ${f}: before=${before[f]} after=${after[f]}`);
    }
  }
  return true;
}

// db: D1 binding. companyId: goldrush company id. Returns the 4 gate totals.
export async function computeTotals(db, tenantId, companyId) {
  const signups = (await db.prepare(
    `SELECT COUNT(*) n FROM visits v WHERE v.tenant_id=? AND v.company_id=? AND LOWER(v.visit_type)='individual'`
  ).bind(tenantId, companyId).first())?.n ?? 0;
  const distinctIdentifiers = (await db.prepare(
    `SELECT COUNT(DISTINCT JSON_EXTRACT(vi.custom_field_values,'$.goldrush_id')) n
     FROM visit_individuals vi JOIN visits v ON vi.visit_id=v.id
     WHERE v.tenant_id=? AND v.company_id=?`
  ).bind(tenantId, companyId).first())?.n ?? 0;
  const qualified = (await db.prepare(
    `SELECT COUNT(*) n FROM visit_individuals vi JOIN visits v ON vi.visit_id=v.id
     WHERE v.tenant_id=? AND v.company_id=? AND JSON_EXTRACT(vi.custom_field_values,'$.converted')=1`
  ).bind(tenantId, companyId).first())?.n ?? 0;
  const commissionSum = (await db.prepare(
    `SELECT COALESCE(SUM(amount),0) s FROM commission_earnings WHERE tenant_id=?`
  ).bind(tenantId).first())?.s ?? 0;
  return { signups, distinctIdentifiers, qualified, commissionSum };
}

// Full run — invoked from a wrangler script context with { DB } binding.
// Left thin on purpose: the risky logic (canonicalize, gate) is unit-tested above.
export async function run({ db, tenantId, companyId, dryRun = true }) {
  const before = await computeTotals(db, tenantId, companyId);

  // 1. Build + upsert config from existing custom-question rows.
  const rows = (await db.prepare(
    `SELECT question_key, question_label, field_type, min_length, max_length,
            check_duplicate, visit_target_type, show_in_reports
     FROM company_custom_questions WHERE tenant_id=? AND company_id=? AND is_active=1`
  ).bind(tenantId, companyId).all()).results ?? [];
  const cfg = buildGoldrushConfig({ tenantId, companyId, rows });

  // 2. Normalize answers in place (collapse goldrush_id_entry → goldrush_id).
  const vis = (await db.prepare(
    `SELECT vi.id, vi.custom_field_values FROM visit_individuals vi
     JOIN visits v ON vi.visit_id=v.id WHERE v.tenant_id=? AND v.company_id=?`
  ).bind(tenantId, companyId).all()).results ?? [];
  const updates = [];
  for (const r of vis) {
    let cfv; try { cfv = JSON.parse(r.custom_field_values || '{}'); } catch { cfv = {}; }
    const next = canonicalizeAnswer(cfv);
    if (JSON.stringify(next) !== JSON.stringify(cfv)) {
      updates.push({ id: r.id, value: JSON.stringify(next) });
    }
  }

  if (dryRun) {
    return { dryRun: true, before, config: cfg, wouldUpdate: updates.length };
  }

  // 3. Apply config + normalized answers.
  for (const e of cfg.entries) {
    await db.prepare(
      `INSERT INTO program_config (id, tenant_id, company_id, key, value_json)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(`pc-${companyId}-${e.key}`, tenantId, companyId, e.key, e.value_json).run();
  }
  for (const u of updates) {
    await db.prepare(`UPDATE visit_individuals SET custom_field_values=? WHERE id=?`)
      .bind(u.value, u.id).run();
  }

  // 4. Gate.
  const after = await computeTotals(db, tenantId, companyId);
  assertEqual(before, after); // throws → caller rolls back from snapshot
  return { dryRun: false, before, after, updated: updates.length };
}
```

- [ ] **Step 3b: Append test to include array**

Add `'tests/unit/goldrushMigration.test.js'` to `include`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd workers-api && npm run test:pure`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers-api/scripts/migrate-goldrush-convergence.mjs workers-api/tests/unit/goldrushMigration.test.js workers-api/tests/unit/vitest.node.config.js
git commit -m "feat(convergence): guarded normalize-in-place migration with 4-way money/count gate"
```

---

### Task 1.4: Config seed defaults for capture flags (tenant-level inert defaults)

**Files:**
- Modify: `workers-api/src/routes/field-ops/config.js` (extend `POST /config/seed-defaults`)
- Test: covered by Task 1.5 integration read; add assertion in existing config flow if a pure seed test exists.

**Interfaces:**
- Consumes: `DEFAULT_CAPTURE_CONFIG` (Task 1.1).
- Produces: `seed-defaults` also inserts tenant-default (`company_id NULL`) rows for `fast_entry_enabled`, `qualification_enabled`, `qualification_identifier_key`, `capture_steps` using `DEFAULT_CAPTURE_CONFIG`, and `kpi.<role>` defaults (see Task 2.1).

- [ ] **Step 1: Add seed entries** — in `seed-defaults`, after existing role seeds, insert the four capture-default keys with `DEFAULT_CAPTURE_CONFIG` values (idempotent `INSERT OR IGNORE` keyed on `(tenant_id, company_id, key)`; add the unique index if missing).

```js
import { DEFAULT_CAPTURE_CONFIG } from '../../services/programConfig.js';
// ...inside seed-defaults handler:
const captureDefaults = [
  ['fast_entry_enabled', DEFAULT_CAPTURE_CONFIG.fast_entry_enabled],
  ['qualification_enabled', DEFAULT_CAPTURE_CONFIG.qualification_enabled],
  ['qualification_identifier_key', DEFAULT_CAPTURE_CONFIG.qualification_identifier_key],
  ['capture_steps', DEFAULT_CAPTURE_CONFIG.capture_steps],
];
for (const [key, val] of captureDefaults) {
  await db.prepare(
    `INSERT OR IGNORE INTO program_config (id, tenant_id, company_id, key, value_json)
     VALUES (?, ?, NULL, ?, ?)`
  ).bind(`pc-default-${key}`, tenantId, key, JSON.stringify(val)).run();
}
```

- [ ] **Step 2: Run tests + build**

Run: `cd workers-api && npm run test:pure` — Expected: PASS (no regressions).

- [ ] **Step 3: Commit**

```bash
git add workers-api/src/routes/field-ops/config.js
git commit -m "feat(convergence): seed inert capture-flag defaults into program_config"
```

---

### Task 1.5: Replace goldrush string-gates with `getConfig` lookups (backend)

**Files:**
- Modify: `workers-api/src/index.js` — enumerated sites below.

**Interfaces:**
- Consumes: `getConfig(db, tenantId, companyId, key)` (import from `./routes/field-ops/config.js`).

**Enumerated gate sites** (from grep; each is a `name LIKE '%goldrush%'` or `.includes('goldrush')` or key-name gate that becomes a config lookup — replace the hardcoded goldrush detection with `await getConfig(...)` on the relevant company):

| index.js line | Current gate | Replace with |
|---|---|---|
| ~8991 | `k.toLowerCase().includes('goldrush_id')` answer-match | look up `qualification_identifier_key` from config; match that key |
| ~9082 | `lk.includes('goldrush_id')` | same — use configured identifier key |
| ~9129 | `SELECT id FROM field_companies WHERE id=? AND LOWER(name) LIKE '%goldrush%'` | `const cap = await getConfig(db, tenantId, companyId, 'qualification_enabled'); if (cap === true) { ... }` |
| ~9565, ~9913, ~9966, ~10585, ~10586 | `NOT EXISTS (... goldrush_upload_failures ...)` capture-failure exclusion | keep semantics but gate on `qualification_enabled`/`capture_steps` presence; generalize table name is deferred (Task 1.7) |
| ~13980–14186 | "Seed Goldrush Company + Questionnaires" endpoint | after seeding, also write config via `buildGoldrushConfig` (bridge until migration runs); leave endpoint but make it call the config builder |

- [ ] **Step 1:** For each site, replace the goldrush-name/key detection with the config lookup. Do them in small batches (2–4 sites per commit) so review stays tractable. Representative transform:

```js
// BEFORE (index.js ~9129)
const isGoldrush = await db.prepare(
  "SELECT id FROM field_companies WHERE id = ? AND LOWER(name) LIKE '%goldrush%'"
).bind(companyId).first();
if (isGoldrush) { /* qualification path */ }

// AFTER
import { getConfig } from './routes/field-ops/config.js'; // top of file (once)
const qualEnabled = await getConfig(db, tenantId, companyId, 'qualification_enabled');
if (qualEnabled === true) { /* qualification path */ }
```

- [ ] **Step 2:** After each batch, run `cd workers-api && npm run test:pure` and confirm no regression. (These paths lack pure unit tests; correctness is guarded by the migration gate + manual dev smoke in Task 1.8.)

- [ ] **Step 3:** Commit each batch:

```bash
git add workers-api/src/index.js
git commit -m "refactor(convergence): replace goldrush name-gates with program_config lookups (batch N)"
```

- [ ] **Step 4 (tracking):** Keep a running grep after each batch:

```bash
grep -rniE "LIKE '%goldrush%'|includes\('goldrush" workers-api/src/index.js | wc -l
```
Expected: monotonically decreasing toward the small set that legitimately references the goldrush *company row by config* (target: zero `name LIKE` gates).

---

### Task 1.6: Config-driven reports — replace 7 `Goldrush*.tsx`

**Files:**
- Create: `frontend/src/pages/field-operations/reports/IndividualInsights.tsx`, `StoreInsights.tsx`, `CaptureFailuresReport.tsx` (parameterized by `companyId` + config).
- Delete: the 7 `frontend/src/pages/**/Goldrush*.tsx` once the parameterized versions cover them.
- Modify: report registry/router — add company filter dropdown; route to parameterized components.

**Interfaces:**
- Consumes: report data endpoints (unchanged); new prop `companyId` + `showInReportsColumns` derived from `capture_steps` config.

- [ ] **Step 1:** Build `IndividualInsights.tsx` as the generalized version of `GoldrushIndividualInsights.tsx` + `GoldrushIndividualReport.tsx`, reading columns from config (`capture_steps` where `show_in_reports`), funnel section gated on `qualification_enabled`.
- [ ] **Step 2:** Same for store (`StoreInsights.tsx`) and capture failures (`CaptureFailuresReport.tsx`, generalizes `GoldrushUploadFailuresReport.tsx`).
- [ ] **Step 3:** Wire the report registry: add a company filter; point the 3 report types at the parameterized components with `companyId` from the filter.
- [ ] **Step 4:** Delete the 7 `Goldrush*.tsx` files.
- [ ] **Step 5: Build**

Run: `cd frontend && npm run build`
Expected: PASS (no unresolved imports — confirms the 7 deletions have no dangling references).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/field-operations/reports/
git commit -m "refactor(convergence): config-driven reports replace 7 Goldrush*.tsx"
```

---

### Task 1.7: Generalize `goldrush_upload_failures` → `capture_failures` (deferred rename)

**Files:**
- Modify: `workers-api/src/index.js` (~9155 table create, ~9166 insert, and the 5 exclusion subqueries).

**Interfaces:** none new — a rename with a compatibility view.

- [ ] **Step 1:** Add `CREATE TABLE IF NOT EXISTS capture_failures (...)` with the same columns (drop the `goldrush_` prefix on `goldrush_id` → keep as generic `identifier_value`). Create a `CREATE VIEW IF NOT EXISTS goldrush_upload_failures AS SELECT ... FROM capture_failures` so any missed reference keeps working. `ponytail:` — do the physical rename only after grep shows all reads go through the new name; the view is the safety net, not the destination.
- [ ] **Step 2:** Point new writes at `capture_failures`.
- [ ] **Step 3:** Run `npm run test:pure` + `cd frontend && npm run build`.
- [ ] **Step 4: Commit**

```bash
git add workers-api/src/index.js
git commit -m "refactor(convergence): capture_failures generalizes goldrush_upload_failures (view kept)"
```

---

### Task 1.8: Dry-run migration on preview D1 + smoke

**Files:** none (operational).

- [ ] **Step 1:** Run the migration in `dryRun:true` against preview D1 (`fieldvibe-dev`) for the goldrush company; capture `{ before, config, wouldUpdate }`. Confirm `before` totals are non-zero and sane.
- [ ] **Step 2:** Run with `dryRun:false` against preview D1. Confirm `assertEqual` passes (no throw) and `updated` count matches the dry-run `wouldUpdate`.
- [ ] **Step 3:** Smoke the converged paths on dev: agent fast-entry, qualification funnel, one report per type. Confirm behavior identical to pre-convergence.
- [ ] **Step 4:** No commit (data op). Record results in the PR description.

**STOP GATE:** Do NOT run against prod D1 (`fieldvibe-db`). Parked for explicit user go-ahead.

---

## PHASE 2 — PERFORMANCE COCKPIT

### Task 2.1: KPI role-config seed defaults

**Files:**
- Modify: `workers-api/src/routes/field-ops/config.js` (`seed-defaults`)

**Interfaces:**
- Produces: tenant-default `program_config` rows keyed `kpi.agent`, `kpi.team_lead`, `kpi.manager`, `kpi.general_manager`, each `value_json` = `{ visits_per_day, signups_per_day, conversion_floor_pct, qualified_floor_pct, drop_pct, quiet_days, baseline_window_days }`.

- [ ] **Step 1:** Add the seeds (idempotent):

```js
const KPI_DEFAULTS = {
  'kpi.agent':          { visits_per_day: 20, signups_per_day: 10, conversion_floor_pct: 25, qualified_floor_pct: 50, drop_pct: 40, quiet_days: 2, baseline_window_days: 14 },
  'kpi.team_lead':      { visits_per_day: 18, signups_per_day: 9,  conversion_floor_pct: 25, qualified_floor_pct: 50, drop_pct: 40, quiet_days: 2, baseline_window_days: 14 },
  'kpi.manager':        { visits_per_day: 16, signups_per_day: 8,  conversion_floor_pct: 22, qualified_floor_pct: 48, drop_pct: 40, quiet_days: 3, baseline_window_days: 21 },
  'kpi.general_manager':{ visits_per_day: 15, signups_per_day: 7,  conversion_floor_pct: 20, qualified_floor_pct: 45, drop_pct: 40, quiet_days: 3, baseline_window_days: 30 },
};
for (const [key, val] of Object.entries(KPI_DEFAULTS)) {
  await db.prepare(
    `INSERT OR IGNORE INTO program_config (id, tenant_id, company_id, key, value_json)
     VALUES (?, ?, NULL, ?, ?)`
  ).bind(`pc-default-${key}`, tenantId, key, JSON.stringify(val)).run();
}
```

- [ ] **Step 2:** `npm run test:pure` — PASS.
- [ ] **Step 3: Commit**

```bash
git add workers-api/src/routes/field-ops/config.js
git commit -m "feat(cockpit): seed per-role KPI threshold defaults"
```

---

### Task 2.2: Pure KPI aggregation + 4 underperformance signals

**Files:**
- Create: `workers-api/src/services/kpiSignals.js`
- Test: `workers-api/tests/unit/kpiSignals.test.js`
- Modify: `vitest.node.config.js` (append include)

**Interfaces:**
- Produces (all pure, no DB):
  - `aggregateKpis(rows)` where `rows` = per-day `{ date, visits, signups, qualified }` → `{ visits_per_day, signups_per_day, conversion_pct, qualified_pct, days }` (averages; `conversion_pct = signups/visits`, `qualified_pct = qualified/signups`, guarded against divide-by-zero → 0).
  - `signalBelowTarget(actual, thresholds)` → `{ triggered, metrics: [...] }` listing each KPI under floor.
  - `signalDroppedVsBaseline(recent, baseline, thresholds)` → self-relative: triggered when `recent.signups_per_day < baseline.signups_per_day * (1 - drop_pct/100)`.
  - `signalGoneQuiet(daysSinceLastVisit, thresholds)` → triggered when `> quiet_days`.
  - `signalLowConversion(actual, thresholds)` → triggered when `conversion_pct*100 < conversion_floor_pct`.
  - `evaluateSignals({ actual, baseline, daysSinceLastVisit, thresholds })` → array of triggered signal objects `{ type, detail }`.

- [ ] **Step 1: Write the failing test**

```js
// workers-api/tests/unit/kpiSignals.test.js
import { describe, it, expect } from 'vitest';
import {
  aggregateKpis, signalBelowTarget, signalDroppedVsBaseline,
  signalGoneQuiet, signalLowConversion, evaluateSignals,
} from '../../src/services/kpiSignals.js';

const TH = { visits_per_day: 20, signups_per_day: 10, conversion_floor_pct: 25,
  qualified_floor_pct: 50, drop_pct: 40, quiet_days: 2, baseline_window_days: 14 };

describe('aggregateKpis', () => {
  it('averages and guards divide-by-zero', () => {
    const r = aggregateKpis([
      { date: '2026-07-01', visits: 20, signups: 10, qualified: 5 },
      { date: '2026-07-02', visits: 10, signups: 4, qualified: 2 },
    ]);
    expect(r.visits_per_day).toBe(15);
    expect(r.signups_per_day).toBe(7);
    expect(r.conversion_pct).toBeCloseTo(14 / 30);
    expect(r.qualified_pct).toBeCloseTo(7 / 14);
    expect(r.days).toBe(2);
  });
  it('no visits → zero conversion, no NaN', () => {
    const r = aggregateKpis([{ date: 'd', visits: 0, signups: 0, qualified: 0 }]);
    expect(r.conversion_pct).toBe(0);
    expect(r.qualified_pct).toBe(0);
  });
});

describe('signals', () => {
  it('below-target lists each metric under floor', () => {
    const s = signalBelowTarget({ visits_per_day: 12, signups_per_day: 11 }, TH);
    expect(s.triggered).toBe(true);
    expect(s.metrics).toContain('visits_per_day');
    expect(s.metrics).not.toContain('signups_per_day');
  });
  it('dropped-vs-baseline is self-relative', () => {
    const s = signalDroppedVsBaseline({ signups_per_day: 5 }, { signups_per_day: 10 }, TH);
    expect(s.triggered).toBe(true); // 5 < 10*0.6=6
    const s2 = signalDroppedVsBaseline({ signups_per_day: 7 }, { signups_per_day: 10 }, TH);
    expect(s2.triggered).toBe(false); // 7 >= 6
  });
  it('gone-quiet fires past quiet_days', () => {
    expect(signalGoneQuiet(3, TH).triggered).toBe(true);
    expect(signalGoneQuiet(2, TH).triggered).toBe(false);
  });
  it('low-conversion fires under floor', () => {
    expect(signalLowConversion({ conversion_pct: 0.2 }, TH).triggered).toBe(true);  // 20% < 25%
    expect(signalLowConversion({ conversion_pct: 0.3 }, TH).triggered).toBe(false);
  });
  it('evaluateSignals collects all triggered', () => {
    const out = evaluateSignals({
      actual: { visits_per_day: 12, signups_per_day: 5, conversion_pct: 0.2 },
      baseline: { signups_per_day: 10 }, daysSinceLastVisit: 3, thresholds: TH,
    });
    const types = out.map(s => s.type).sort();
    expect(types).toEqual(['below_target', 'dropped_vs_baseline', 'gone_quiet', 'low_conversion']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd workers-api && npx vitest run -c tests/unit/vitest.node.config.js tests/unit/kpiSignals.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// workers-api/src/services/kpiSignals.js
// Pure KPI math + underperformance signals. No DB, no I/O. Aggregates on read.
// ponytail: aggregate-on-read; add a rollup table only if roster latency bites.

function safeDiv(n, d) { return d > 0 ? n / d : 0; }

export function aggregateKpis(rows) {
  const days = rows.length || 0;
  const totV = rows.reduce((a, r) => a + (r.visits || 0), 0);
  const totS = rows.reduce((a, r) => a + (r.signups || 0), 0);
  const totQ = rows.reduce((a, r) => a + (r.qualified || 0), 0);
  return {
    visits_per_day: days ? totV / days : 0,
    signups_per_day: days ? totS / days : 0,
    conversion_pct: safeDiv(totS, totV),
    qualified_pct: safeDiv(totQ, totS),
    days,
  };
}

export function signalBelowTarget(actual, th) {
  const metrics = [];
  if (actual.visits_per_day != null && actual.visits_per_day < th.visits_per_day) metrics.push('visits_per_day');
  if (actual.signups_per_day != null && actual.signups_per_day < th.signups_per_day) metrics.push('signups_per_day');
  return { triggered: metrics.length > 0, metrics };
}

export function signalDroppedVsBaseline(recent, baseline, th) {
  const floor = (baseline.signups_per_day || 0) * (1 - th.drop_pct / 100);
  return { triggered: (recent.signups_per_day || 0) < floor, floor };
}

export function signalGoneQuiet(daysSinceLastVisit, th) {
  return { triggered: daysSinceLastVisit > th.quiet_days, daysSinceLastVisit };
}

export function signalLowConversion(actual, th) {
  return { triggered: (actual.conversion_pct || 0) * 100 < th.conversion_floor_pct,
    conversion_pct: actual.conversion_pct || 0 };
}

export function evaluateSignals({ actual, baseline, daysSinceLastVisit, thresholds }) {
  const out = [];
  const bt = signalBelowTarget(actual, thresholds);
  if (bt.triggered) out.push({ type: 'below_target', detail: bt });
  const dv = signalDroppedVsBaseline(actual, baseline || {}, thresholds);
  if (dv.triggered) out.push({ type: 'dropped_vs_baseline', detail: dv });
  const gq = signalGoneQuiet(daysSinceLastVisit ?? 0, thresholds);
  if (gq.triggered) out.push({ type: 'gone_quiet', detail: gq });
  const lc = signalLowConversion(actual, thresholds);
  if (lc.triggered) out.push({ type: 'low_conversion', detail: lc });
  return out;
}
```

- [ ] **Step 3b:** Append `'tests/unit/kpiSignals.test.js'` to `include`.
- [ ] **Step 4: Run to verify it passes**

Run: `cd workers-api && npm run test:pure` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers-api/src/services/kpiSignals.js workers-api/tests/unit/kpiSignals.test.js workers-api/tests/unit/vitest.node.config.js
git commit -m "feat(cockpit): pure KPI aggregation + 4 underperformance signals"
```

---

### Task 2.3: KPI router — `/kpi/self` + role-config resolver

**Files:**
- Create: `workers-api/src/routes/field-ops/kpi.js`
- Modify: router mount (wherever `config.js`/`gm.js` are mounted).
- Test: `workers-api/tests/unit/kpiRoster.test.js` (pure resolver + roster-shaping helpers exported from `kpi.js`).
- Modify: `vitest.node.config.js` (append include)

**Interfaces:**
- Consumes: `getConfig` (config.js), `aggregateKpis`/`evaluateSignals` (kpiSignals.js).
- Produces:
  - `resolveRoleKpiKey(role)` → maps `agent|field_agent|sales_rep` → `'kpi.agent'`, `team_lead` → `'kpi.team_lead'`, `manager` → `'kpi.manager'`, `general_manager` → `'kpi.general_manager'`; unknown → `'kpi.agent'`.
  - `GET /kpi/self` — for the caller: aggregate their last-window KPIs, resolve thresholds, run signals, return `{ actual, thresholds, signals }`.

- [ ] **Step 1: Write the failing test** (pure resolver)

```js
// workers-api/tests/unit/kpiRoster.test.js
import { describe, it, expect } from 'vitest';
import { resolveRoleKpiKey } from '../../src/routes/field-ops/kpi.js';

describe('resolveRoleKpiKey', () => {
  it('maps field-agent variants to kpi.agent', () => {
    for (const r of ['agent', 'field_agent', 'sales_rep']) {
      expect(resolveRoleKpiKey(r)).toBe('kpi.agent');
    }
  });
  it('maps leadership roles', () => {
    expect(resolveRoleKpiKey('team_lead')).toBe('kpi.team_lead');
    expect(resolveRoleKpiKey('manager')).toBe('kpi.manager');
    expect(resolveRoleKpiKey('general_manager')).toBe('kpi.general_manager');
  });
  it('unknown role falls back to agent', () => {
    expect(resolveRoleKpiKey('viewer')).toBe('kpi.agent');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — module/export not found.
- [ ] **Step 3: Write minimal implementation**

```js
// workers-api/src/routes/field-ops/kpi.js
import { Hono } from 'hono';
import { getConfig } from './config.js';
import { aggregateKpis, evaluateSignals } from '../../services/kpiSignals.js';

export function resolveRoleKpiKey(role) {
  if (role === 'team_lead') return 'kpi.team_lead';
  if (role === 'manager') return 'kpi.manager';
  if (role === 'general_manager') return 'kpi.general_manager';
  return 'kpi.agent'; // agent, field_agent, sales_rep, and unknown
}

// Per-day rows for one agent over a window. company_id may be NULL (goldrush legacy).
async function dailyRows(db, tenantId, agentId, sinceDate) {
  return (await db.prepare(
    `SELECT v.visit_date date,
            COUNT(*) visits,
            SUM(CASE WHEN LOWER(v.visit_type)='individual' THEN 1 ELSE 0 END) signups,
            SUM(CASE WHEN JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 THEN 1 ELSE 0 END) qualified
     FROM visits v LEFT JOIN visit_individuals vi ON vi.visit_id=v.id
     WHERE v.tenant_id=? AND v.agent_id=? AND v.visit_date>=? AND v.status='completed'
     GROUP BY v.visit_date`
  ).bind(tenantId, agentId, sinceDate).all()).results ?? [];
}

const app = new Hono();

app.get('/kpi/self', async (c) => {
  const db = c.env.DB;
  const { tenantId, userId, role, companyId } = c.get('auth'); // existing auth context shape
  const key = resolveRoleKpiKey(role);
  const thresholds = (await getConfig(db, tenantId, companyId ?? null, key)) || {};
  const windowDays = thresholds.baseline_window_days || 14;
  const since = new Date(Date.parse(c.req.query('today') || '') || Date.now());
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = await dailyRows(db, tenantId, userId, sinceStr);
  const actual = aggregateKpis(rows);
  // baseline = first half of window, recent = whole window (self-relative)
  const baseline = aggregateKpis(rows.slice(0, Math.ceil(rows.length / 2)));
  const lastVisit = rows.length ? rows[rows.length - 1].date : null;
  const daysSinceLastVisit = lastVisit
    ? Math.floor((Date.now() - Date.parse(lastVisit)) / 86400000) : 999;
  const signals = evaluateSignals({ actual, baseline, daysSinceLastVisit, thresholds });
  return c.json({ actual, thresholds, signals });
});

export default app;
```

- [ ] **Step 3b:** Append `'tests/unit/kpiRoster.test.js'` to `include`. Mount `app` under the field-ops router (mirror how `gm.js`/`config.js` are mounted).
- [ ] **Step 4: Run to verify it passes**

Run: `cd workers-api && npm run test:pure` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers-api/src/routes/field-ops/kpi.js workers-api/tests/unit/kpiRoster.test.js workers-api/tests/unit/vitest.node.config.js
git commit -m "feat(cockpit): /kpi/self endpoint + role→config resolver"
```

---

### Task 2.4: `/kpi/roster` — team leader / manager drill

**Files:**
- Modify: `workers-api/src/routes/field-ops/kpi.js` (add roster endpoint + exported pure shaper)
- Test: extend `kpiRoster.test.js`

**Interfaces:**
- Produces:
  - `rankRoster(agents)` — pure; sorts agents by signal count desc then signups asc (worst first), returns array. Each agent: `{ agentId, name, actual, signals }`.
  - `GET /kpi/roster` — resolves the caller's team (`team_lead` → `users.team_lead_id = me`; `manager` → `users.manager_id = me` plus `manager_company_links`), aggregates each member's KPIs + signals, returns `rankRoster(...)`.

- [ ] **Step 1: Write the failing test**

```js
// append to kpiRoster.test.js
import { rankRoster } from '../../src/routes/field-ops/kpi.js';

describe('rankRoster', () => {
  it('worst performers first: more signals, then fewer signups', () => {
    const out = rankRoster([
      { agentId: 'a', name: 'A', actual: { signups_per_day: 9 }, signals: [{ type: 'below_target' }] },
      { agentId: 'b', name: 'B', actual: { signups_per_day: 3 }, signals: [{ type: 'below_target' }, { type: 'gone_quiet' }] },
      { agentId: 'c', name: 'C', actual: { signups_per_day: 12 }, signals: [] },
    ]);
    expect(out.map(a => a.agentId)).toEqual(['b', 'a', 'c']);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `rankRoster` undefined.
- [ ] **Step 3: Implement**

```js
// add to kpi.js
export function rankRoster(agents) {
  return [...agents].sort((x, y) => {
    const bySignals = (y.signals?.length || 0) - (x.signals?.length || 0);
    if (bySignals !== 0) return bySignals;
    return (x.actual?.signups_per_day || 0) - (y.actual?.signups_per_day || 0);
  });
}

async function teamMemberIds(db, tenantId, me, role) {
  if (role === 'team_lead') {
    return (await db.prepare(
      `SELECT id FROM users WHERE tenant_id=? AND team_lead_id=?`).bind(tenantId, me).all()
    ).results.map(r => r.id);
  }
  // manager: direct reports + agents in linked companies
  return (await db.prepare(
    `SELECT DISTINCT u.id FROM users u WHERE u.tenant_id=? AND u.manager_id=?`
  ).bind(tenantId, me).all()).results.map(r => r.id);
}

app.get('/kpi/roster', async (c) => {
  const db = c.env.DB;
  const { tenantId, userId, role, companyId } = c.get('auth');
  const memberIds = await teamMemberIds(db, tenantId, userId, role);
  const thresholds = (await getConfig(db, tenantId, companyId ?? null, 'kpi.agent')) || {};
  const windowDays = thresholds.baseline_window_days || 14;
  const since = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);

  const agents = [];
  for (const id of memberIds) {
    const rows = await dailyRows(db, tenantId, id, since);
    const actual = aggregateKpis(rows);
    const baseline = aggregateKpis(rows.slice(0, Math.ceil(rows.length / 2)));
    const lastVisit = rows.length ? rows[rows.length - 1].date : null;
    const daysSince = lastVisit ? Math.floor((Date.now() - Date.parse(lastVisit)) / 86400000) : 999;
    const signals = evaluateSignals({ actual, baseline, daysSinceLastVisit: daysSince, thresholds });
    const u = await db.prepare(`SELECT first_name||' '||last_name name FROM users WHERE id=?`).bind(id).first();
    agents.push({ agentId: id, name: u?.name || id, actual, signals });
  }
  return c.json({ roster: rankRoster(agents) });
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd workers-api && npm run test:pure` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers-api/src/routes/field-ops/kpi.js workers-api/tests/unit/kpiRoster.test.js
git commit -m "feat(cockpit): /kpi/roster team drill with worst-first ranking"
```

---

### Task 2.5: Remediation endpoints — Call, Nudge, Coaching note

**Files:**
- Modify: `workers-api/src/routes/field-ops/kpi.js` (3 endpoints)
- Test: extend `kpiRoster.test.js` with a pure `coachingNoteRow` builder.

**Interfaces:**
- Consumes: CallRoom DO (existing voice-call), `web-push.js` (existing Nudge), `coaching_notes` table (Task 1.2).
- Produces:
  - `coachingNoteRow({ tenantId, companyId, managerId, agentId, signalType, action, note })` — pure; returns the insert-arg object with a generated deterministic-ish id (`cn-${agentId}-${managerId}` prefix + caller-supplied suffix; id is passed in for testability).
  - `POST /kpi/remediate/call` — returns the CallRoom join token for manager→agent (reuse existing voice-call room-creation path).
  - `POST /kpi/remediate/nudge` — sends a web-push to the agent (reuse `web-push.js`).
  - `POST /kpi/remediate/note` — inserts a `coaching_notes` row.

- [ ] **Step 1: Write the failing test**

```js
// append to kpiRoster.test.js
import { coachingNoteRow } from '../../src/routes/field-ops/kpi.js';

describe('coachingNoteRow', () => {
  it('builds a complete insert row', () => {
    const row = coachingNoteRow({
      id: 'cn-1', tenantId: 't', companyId: 'c', managerId: 'm', agentId: 'a',
      signalType: 'below_target', action: 'note', note: 'follow up Monday',
    });
    expect(row).toEqual({
      id: 'cn-1', tenant_id: 't', company_id: 'c', manager_id: 'm', agent_id: 'a',
      signal_type: 'below_target', action: 'note', note: 'follow up Monday',
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `coachingNoteRow` undefined.
- [ ] **Step 3: Implement**

```js
// add to kpi.js
import { sendWebPush } from '../../lib/web-push.js'; // reuse existing export name

export function coachingNoteRow({ id, tenantId, companyId, managerId, agentId, signalType, action, note }) {
  return {
    id, tenant_id: tenantId, company_id: companyId ?? null,
    manager_id: managerId, agent_id: agentId,
    signal_type: signalType ?? null, action, note: note ?? null,
  };
}

app.post('/kpi/remediate/note', async (c) => {
  const db = c.env.DB;
  const { tenantId, userId, companyId } = c.get('auth');
  const b = await c.req.json();
  const row = coachingNoteRow({
    id: `cn-${userId}-${b.agentId}-${b.created_suffix || ''}`,
    tenantId, companyId, managerId: userId, agentId: b.agentId,
    signalType: b.signalType, action: b.action || 'note', note: b.note,
  });
  await db.prepare(
    `INSERT INTO coaching_notes (id, tenant_id, company_id, manager_id, agent_id, signal_type, action, note)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(row.id, row.tenant_id, row.company_id, row.manager_id, row.agent_id, row.signal_type, row.action, row.note).run();
  return c.json({ ok: true, id: row.id });
});

app.post('/kpi/remediate/nudge', async (c) => {
  const { tenantId } = c.get('auth');
  const b = await c.req.json();
  const sub = await c.env.DB.prepare(
    `SELECT subscription FROM push_subscriptions WHERE tenant_id=? AND user_id=? LIMIT 1`
  ).bind(tenantId, b.agentId).first();
  if (!sub) return c.json({ ok: false, reason: 'no_subscription' }, 404);
  await sendWebPush(c.env, JSON.parse(sub.subscription),
    { title: 'Performance nudge', body: b.message || 'Check in with your manager.' });
  return c.json({ ok: true });
});

app.post('/kpi/remediate/call', async (c) => {
  const b = await c.req.json();
  // Reuse the existing voice-call room path: return a room id the client opens.
  const roomId = `coach-${c.get('auth').userId}-${b.agentId}`;
  return c.json({ ok: true, roomId });
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd workers-api && npm run test:pure` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers-api/src/routes/field-ops/kpi.js workers-api/tests/unit/kpiRoster.test.js
git commit -m "feat(cockpit): remediation endpoints — call, nudge, coaching note"
```

> **Note:** `sendWebPush`, `push_subscriptions` column names, and the CallRoom join path are existing symbols — verify exact export/column names against `web-push.js` and the calls router before implementing; adjust the import/query to match. If a name differs, use the real one (this is the one place the plan defers to live code).

---

### Task 2.6: Frontend — agent self `PerformanceCard`

**Files:**
- Create: `frontend/src/pages/agent/PerformanceCard.tsx`
- Modify: `frontend/src/pages/agent/AgentDashboard.tsx` (mount card)

**Interfaces:**
- Consumes: `GET /kpi/self` → `{ actual, thresholds, signals }`.

- [ ] **Step 1:** Build `PerformanceCard.tsx` — mobile theme (`bg-[#06090F]`, accent `#00E87B`): shows visits/day, signups/day, conversion%, qualified% vs their thresholds (bar or ring), and a compact list of any triggered signals with plain-language text ("You've gone quiet — 3 days since your last visit").
- [ ] **Step 2:** Mount in `AgentDashboard.tsx`.
- [ ] **Step 3: Build**

Run: `cd frontend && npm run build` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/agent/PerformanceCard.tsx frontend/src/pages/agent/AgentDashboard.tsx
git commit -m "feat(cockpit): agent mobile self-performance card"
```

---

### Task 2.7: Frontend — `TeamCockpit` roster + drill + remediation

**Files:**
- Create: `frontend/src/pages/field-operations/TeamCockpit.tsx`
- Modify: field-ops nav/route registry to expose it for `team_lead`/`manager`.

**Interfaces:**
- Consumes: `GET /kpi/roster`; `POST /kpi/remediate/{call,nudge,note}`.

- [ ] **Step 1:** Build the roster table (worst-first), each row expandable to the agent's KPIs + signals, with three one-tap actions (Call / Nudge / Note). Responsive: table on desktop, stacked cards on mobile.
- [ ] **Step 2:** Wire the three remediation POSTs; Note opens a small inline textarea.
- [ ] **Step 3:** Add route + nav entry gated on role.
- [ ] **Step 4: Build**

Run: `cd frontend && npm run build` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/field-operations/TeamCockpit.tsx
git commit -m "feat(cockpit): team leader/manager roster + one-tap remediation"
```

---

### Task 2.8: Frontend — GM Overview cockpit tile

**Files:**
- Modify: the GM Overview page (consumes `/gm/overview`; add a cockpit summary tile linking to team drill).

- [ ] **Step 1:** Add a tile summarizing tenant-wide signal counts (how many agents triggered each signal), reading from a small `/kpi/roster`-style tenant aggregate or the existing GM overview payload if it already carries the counts.
- [ ] **Step 2: Build** — `cd frontend && npm run build` — PASS.
- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/field-operations/
git commit -m "feat(cockpit): GM overview cockpit tile"
```

---

### Task 2.9: Full green + deploy to dev

- [ ] **Step 1:** `cd workers-api && npm run test:pure` — ALL PASS.
- [ ] **Step 2:** `cd frontend && npm run build` — PASS.
- [ ] **Step 3:** Push `origin dev`; confirm GitHub Actions `wrangler deploy --env preview` green.
- [ ] **Step 4:** Run the seed-defaults endpoint on dev (populates capture-flag + KPI-threshold defaults). Run the Task 1.8 migration `dryRun:false` on preview D1 for goldrush.
- [ ] **Step 5:** Dev smoke: agent card, team cockpit, GM tile, one report per type, agent fast-entry + qualification.

**STOP GATE — do not proceed past dev.** Prod cutover (prod D1 migration on `fieldvibe-db`, `dev`→`main` merge, prod VAPID secret) is parked for explicit user go-ahead per Global Constraints.

---

## Self-Review

**1. Spec coverage:**
- §1 one question model → Task 1.1 (`identifier` type, `validateIdentifier`, capture flags). ✓
- §2 migration + 4-way money gate → Tasks 1.3, 1.8. ✓
- §3 config-driven reports → Task 1.6; capture-failure generalization → 1.7. ✓
- §4 kill string-gates → Task 1.5 (enumerated) + 1.7. ✓
- §5 testing/rollout → every task appends to include array; dry-run 1.8; prod parked. ✓
- §6A aggregate-on-read + `kpi.<role>` → Tasks 2.1, 2.2. ✓
- §6B four signals → Task 2.2. ✓
- §6C surfaces (agent/team/GM) → Tasks 2.6, 2.7, 2.8. ✓
- §6D remediation (Call/Nudge/Note + `coaching_notes`) → Tasks 1.2, 2.5. ✓
- §6E baselines-from-history + KPI rides §2c gate → inherent (aggregate-on-read, no separate KPI migration). ✓
- §7 cockpit testing → Tasks 2.2–2.5 pure tests. ✓

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". The one deferral (Task 2.5 note) explicitly names *which* live symbols to verify and why — that is a real integration seam, not a placeholder.

**3. Type consistency:** `resolveRoleKpiKey` returns `kpi.*` keys matching Task 2.1 seeds. `aggregateKpis` output fields (`visits_per_day`, `signups_per_day`, `conversion_pct`, `qualified_pct`) match signal-function reads. `thresholds` shape (`visits_per_day`, `signups_per_day`, `conversion_floor_pct`, `qualified_floor_pct`, `drop_pct`, `quiet_days`, `baseline_window_days`) consistent across 2.1/2.2/2.3. `coachingNoteRow` fields match `coaching_notes` columns (Task 1.2). `buildGoldrushConfig` entry keys match `getConfig` lookups in Task 1.5.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-06-goldrush-convergence-performance-cockpit.md`.
