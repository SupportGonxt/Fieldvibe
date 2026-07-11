# Goldrush Performance Metric-Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the hard-coded two-gate Goldrush deposit engine into a generic per-company metric rail (Goldrush live, Stellr placeholder), feed the deposit gate into the existing accountability/escalation spine, give the GM a unified performance-vs-actions view, and let Back Office upload a month-to-date Excel/CSV file.

**Architecture:** A per-company `metrics` config array (Approach A — generic metric registry) drives everything. A new `metric_facts` table generalizes `goldrush_deposits`; the incentive engine reads gate averages per metric key and clears a tier only when *every* gate metric's per-working-day average meets its target (N-gate). A pure `signalBelowGate` emits a `below_gate` signal that plugs into the existing `issueEngine` SLA ladder via `reactToIssues`. The BO PWA parses xlsx/csv client-side to 9-digit IDs and posts them to a generalized `/metric-facts` endpoint; the old `/deposits` route stays as a thin alias.

**Tech Stack:** Cloudflare Workers + Hono + D1 (SQLite) backend; React 18 + TS + Vite + Tailwind PWA; `vitest run` (workers-api) + node-guarded `demo()` self-checks; SheetJS `xlsx` (new frontend dep) for client-side spreadsheet parsing.

## Global Constraints

- **Deposit *revenue* (rand) is GM-only; deposit *counts* are visible to all roles.** Revenue is never a metric column — it stays a GM-only derived value (`count × commission_per_deposit`) computed in `gm.js`.
- **Metric registry config key is `metrics`** — a JSON array of `{key, label, source, visibility, gate, value}`. `source` ∈ `internal|bo_file`; `visibility` ∈ `all|gm`; `gate`/`value` are booleans.
- **Goldrush metrics ship LIVE. Stellr metrics ship as config PLACEHOLDERS only** — no Stellr ingestion or compute in scope.
- **Migration number is `0019`** — `migrations/0015`–`0018` already exist. File: `migrations/0019_metric_facts.sql`.
- **`metric_facts` unique key:** `(tenant_id, company_id, metric_key, subject_key, period)`. `period` NULL = cumulative (deposits); `'YYYY-MM'` = monthly (retention).
- **Idempotent-additive ingest, no clawback** — `INSERT OR IGNORE`; re-uploading an ID is a no-op.
- **Deploy is git push → CI only.** No Cloudflare/prod credentials; never run a deploy command.
- **`metric_facts` amount is nullable** — deposits carry `amount = NULL` (count-only); value metrics carry a number.
- **`goldrush_deposits` is left dormant** (dropped in a later migration, out of scope). Backfill copies its rows into `metric_facts`; the engine re-points its join to `metric_facts WHERE metric_key='deposits'`.
- **Test runner:** `cd workers-api && npx vitest run <path>` for `*.test.js`; `node <path>` for a file's node-guarded `demo()`.

---

## File Structure

- `migrations/0019_metric_facts.sql` — **create** — new table + index + backfill from `goldrush_deposits`.
- `workers-api/src/routes/field-ops/config.js` — **modify** — seed `metrics` registry (Goldrush live + Stellr placeholder); tier target shape.
- `workers-api/src/services/incentiveService.js` — **modify** — join re-point to `metric_facts`; N-gate `avgByMetric`/`tierFor`/`nextGate`/`computeIncentive`; ADD `demo()` self-check.
- `workers-api/src/services/kpiSignals.js` — **modify** — add pure `signalBelowGate`.
- `workers-api/src/services/kpiSignals.test.js` — **modify** — assert `below_gate` fires only when a gate metric trails; silent on empty window.
- `workers-api/src/services/issueEngine.js` — **modify** — add `KIND_WEIGHT.below_gate`; extend `demo()`.
- `workers-api/src/routes/field-ops/kpi.js` — **modify** — `/kpi/self` returns `visibility:'all'` registry metrics with per-day avg + gate target + shortfall; append `below_gate`.
- `workers-api/src/index.js` — **modify** — `reactToIssues` cron appends `below_gate` signals after `agentSignals`.
- `workers-api/src/routes/field-ops/metricFacts.js` — **create** — generalized `/metric-facts` router (POST/GET/DELETE, metric-keyed).
- `workers-api/src/routes/field-ops/deposits.js` — **modify** — thin `/deposits` alias forwarding `metric_key='deposits'`; GET/DELETE/reconcile re-point to `metric_facts`.
- `workers-api/src/routes/field-ops/gm.js` — **modify** — unified performance-vs-actions column on `buildGmOverview` leaders/teams rows.
- `frontend/src/pages/agent/PerformanceCard.tsx` — **modify** — render the metric list dynamically from `visibility:'all'` registry metrics; add `below_gate` case.
- `frontend/src/pages/agent/BackOfficeDeposits.tsx` — **modify** — add Excel/CSV file picker (client-side xlsx parse → 9-digit IDs into the existing flow).
- `frontend/package.json` — **modify** — add `xlsx` dependency.

---

### Task 1: Migration `0019_metric_facts` — generalized metric table + backfill

**Files:**
- Create: `migrations/0019_metric_facts.sql`
- Test: manual verify via `wrangler d1` is out of scope (no prod creds); verify by row-count SQL in Task 3's engine demo instead.

**Interfaces:**
- Produces: table `metric_facts(id, tenant_id, company_id, metric_key, subject_key, amount, period, source_batch, created_at)` with `UNIQUE(tenant_id, company_id, metric_key, subject_key, period)` and `idx_metric_facts_lookup ON (tenant_id, company_id, metric_key, subject_key)`. Deposits land as rows with `metric_key='deposits'`, `period=NULL`, `amount=NULL`, `subject_key=goldrush_id`.

- [ ] **Step 1: Write the migration file**

```sql
-- migrations/0019_metric_facts.sql
-- Generalized per-company metric rail. Replaces the Goldrush-specific goldrush_deposits
-- table with a metric-keyed fact store so any company's KPIs (deposits, active users,
-- value/user, …) share one shape. The incentive engine reads gate averages from here.
--   period NULL      = cumulative fact (a deposit exists / doesn't) — counted, never summed by month.
--   period 'YYYY-MM' = monthly fact (retention, active users) — one row per subject per month.
--   amount NULL      = count-only metric (deposits); a number for value metrics.
-- Idempotent-additive: UNIQUE blocks a duplicate fact; ingest uses INSERT OR IGNORE. No clawback.
CREATE TABLE IF NOT EXISTS metric_facts (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  company_id   TEXT,
  metric_key   TEXT NOT NULL,               -- 'deposits' | 'active_users' | 'value_per_user' | …
  subject_key  TEXT NOT NULL,               -- canonical id the fact is about (e.g. 9-digit goldrush_id)
  amount       REAL,                         -- NULL for count-only metrics; a value for value metrics
  period       TEXT,                         -- NULL = cumulative; 'YYYY-MM' = monthly
  source_batch TEXT,
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, company_id, metric_key, subject_key, period)
);

-- Engine join: count facts for one metric_key scoped to a tenant/company/subject.
CREATE INDEX IF NOT EXISTS idx_metric_facts_lookup
  ON metric_facts (tenant_id, company_id, metric_key, subject_key);

-- Backfill: every confirmed Goldrush deposit becomes a deposits fact. period NULL (cumulative),
-- amount NULL (count-only gate), subject_key = the deposit's goldrush_id. INSERT OR IGNORE so
-- re-running the migration is inert and any duplicate (tenant,company,goldrush_id) collapses to one.
INSERT OR IGNORE INTO metric_facts
  (id, tenant_id, company_id, metric_key, subject_key, amount, period, source_batch, created_at)
SELECT
  gd.id, gd.tenant_id, gd.company_id, 'deposits', gd.goldrush_id, NULL, NULL, gd.source_batch, gd.created_at
FROM goldrush_deposits gd;
```

- [ ] **Step 2: Verify the SQL parses**

Run: `cat migrations/0019_metric_facts.sql | sqlite3 :memory:` — note this errors on the backfill because `goldrush_deposits` doesn't exist in the empty in-memory DB; that is expected. To verify the whole file including backfill:

Run:
```bash
sqlite3 :memory: "CREATE TABLE goldrush_deposits (id TEXT, tenant_id TEXT, company_id TEXT, goldrush_id TEXT, deposit_date TEXT, amount REAL, source_batch TEXT, uploaded_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP); INSERT INTO goldrush_deposits (id,tenant_id,goldrush_id) VALUES ('a','t1','123456789'); $(cat migrations/0019_metric_facts.sql) SELECT metric_key, subject_key, period, amount FROM metric_facts;"
```
Expected: one row `deposits|123456789||` (period and amount empty/NULL).

- [ ] **Step 3: Commit**

```bash
git add migrations/0019_metric_facts.sql
git commit -m "feat(metrics): add metric_facts table + backfill from goldrush_deposits"
```

---

### Task 2: Metric registry config seed + tier target shape

**Files:**
- Modify: `workers-api/src/routes/field-ops/config.js:118-147` (tier definitions + scales seed) and `:149-166` (config defaults).

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: config key `metrics` (per-company JSON array). New tier shape `{ amount, targets: { <metricKey>: <target> } }`. Goldrush registry: `[{key:'signups',label:'Signups',source:'internal',visibility:'all',gate:true,value:false},{key:'deposits',label:'Deposits',source:'bo_file',visibility:'all',gate:true,value:false}]`. The N-gate engine (Task 3) reads `t.targets` with a tolerant fallback to the legacy `{signups, deposits}` shape, so this seed and old rows coexist.

- [ ] **Step 1: Rewrite the tier arrays to the `targets` shape**

In `config.js`, replace the `fieldTiers`/`mgmtTiers` blocks (lines 118-130) with:

```js
  // GOVERNING N-gate pay scale — live on deploy. Each tier clears only when EVERY gate metric's
  // per-working-day average meets its target (min-tier across gates). targets is keyed by metric_key
  // so adding a gate metric is config, not code. Agents (own metric) and Team Leads (team avg) share these.
  const fieldTiers = [
    { amount: 1500, targets: { signups: 8,  deposits: 5  } },
    { amount: 2500, targets: { signups: 10, deposits: 8  } },
    { amount: 3500, targets: { signups: 15, deposits: 10 } },
    { amount: 4500, targets: { signups: 20, deposits: 15 } },
  ];
  // Management (org average): same gates, management-scale amounts.
  const mgmtTiers = [
    { amount: 10000, targets: { signups: 8,  deposits: 5  } },
    { amount: 20000, targets: { signups: 10, deposits: 8  } },
    { amount: 35000, targets: { signups: 15, deposits: 10 } },
    { amount: 45000, targets: { signups: 20, deposits: 15 } },
  ];
```

- [ ] **Step 2: Seed the `metrics` registry into `configDefaults`**

In `config.js`, inside the `configDefaults` object (starts line 149), add the `metrics` key. Goldrush is the live tenant default; Stellr placeholders are seeded per-company by admins later via `PUT /config`, so the tenant default is the Goldrush registry:

```js
    // Per-company metric registry (Approach A). Drives cockpit tiles, gate engine, GM view.
    // Goldrush is the live tenant default; Stellr admins override this key per-company via PUT /config
    // with its own placeholder array (active_users, value_per_user).
    metrics: [
      { key: 'signups',  label: 'Signups',  source: 'internal', visibility: 'all', gate: true, value: false },
      { key: 'deposits', label: 'Deposits', source: 'bo_file',  visibility: 'all', gate: true, value: false },
    ],
```

- [ ] **Step 3: Verify the file parses**

Run: `cd workers-api && node --check src/routes/field-ops/config.js`
Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```bash
git add workers-api/src/routes/field-ops/config.js
git commit -m "feat(metrics): seed metrics registry + N-gate tier target shape"
```

---

### Task 3: N-gate incentive engine — join re-point + `avgByMetric` + `demo()`

**Files:**
- Modify: `workers-api/src/services/incentiveService.js` (whole engine — `tierFor`, `nextGate`, `agentCount`, `agentMetric`, `teamMetric`, `computeIncentive`; ADD `demo()`).

**Interfaces:**
- Consumes: tier shape `{ amount, targets:{ signups, deposits } }` from Task 2; `metric_facts` table from Task 1.
- Produces:
  - `readTargets(tier)` → `{ [metricKey]: number }` (tolerant of legacy `{amount,signups,deposits}`).
  - `tierFor(tiers, avgByMetric)` → number (highest tier amount where every target metric's avg ≥ target; `0` if none).
  - `nextGate(tiers, avgByMetric)` → `null | { amount, targets, shortfall:{[k]:number} }` (next unmet tier with per-metric `shortfall = max(0, target-avg)`).
  - `agentMetric(...)` → `{ count, converted, deposits, avgByMetric:{signups,deposits}, avg, workingDays }`.
  - `computeIncentive(...)` → `{ ...prev, metricByKey, payable, nextTier, tiers }`.

- [ ] **Step 1: Write the failing demo self-check**

Append to `workers-api/src/services/incentiveService.js` (at end of file, before/after existing node guard — there is none yet, so add one):

```js
// --- self-check: N-gate parity with the pre-refactor two-gate outcomes ---
export function demo() {
  const tiers = [
    { amount: 1500, targets: { signups: 8,  deposits: 5  } },
    { amount: 2500, targets: { signups: 10, deposits: 8  } },
  ];
  // both gates clear the low tier, neither clears the high tier -> 1500
  console.assert(tierFor(tiers, { signups: 9, deposits: 6 }) === 1500, 'both-clear low tier');
  // signups clear but deposits short of even the low gate -> 0 (a gate is a gate)
  console.assert(tierFor(tiers, { signups: 20, deposits: 4 }) === 0, 'one-short pays nothing');
  // neither clears -> 0
  console.assert(tierFor(tiers, { signups: 1, deposits: 1 }) === 0, 'neither-clear');
  // legacy tier shape (no .targets) still reads
  console.assert(tierFor([{ amount: 999, signups: 8, deposits: 5 }], { signups: 8, deposits: 5 }) === 999, 'legacy shape');
  // nextGate reports per-metric shortfall against the first unmet tier
  const ng = nextGate(tiers, { signups: 9, deposits: 6 });
  console.assert(ng.amount === 2500 && ng.shortfall.signups === 1 && ng.shortfall.deposits === 2, 'nextGate shortfall');
  console.log('incentiveService demo OK');
}
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) demo();
```

- [ ] **Step 2: Run the demo to verify it fails**

Run: `cd workers-api && node src/services/incentiveService.js`
Expected: FAIL — assertions throw/log because `tierFor` still takes `(tiers, avgSignups, avgDeposits)` (three args) and returns wrong values for the new call shape (e.g. `tierFor(tiers, {signups:9,deposits:6})` passes the object as `avgSignups` and `undefined` as `avgDeposits`).

- [ ] **Step 3: Add the tolerant target reader**

Near the top of `incentiveService.js` (after the imports), add:

```js
// A tier's gate targets, keyed by metric_key. Tolerant of the legacy {amount, signups, deposits}
// shape so pre-refactor seeded rows and new {amount, targets:{…}} rows both read correctly.
export function readTargets(tier) {
  if (tier.targets) return tier.targets;
  const { amount, ...rest } = tier;
  return rest; // legacy: every non-amount key is a gate target
}
```

- [ ] **Step 4: Rewrite `tierFor` and `nextGate` to take `avgByMetric`**

Replace the existing `tierFor` and `nextGate` functions with:

```js
// Highest tier amount whose EVERY gate metric average clears its target. 0 if none clear.
export function tierFor(tiers, avgByMetric) {
  return (tiers || [])
    .filter((t) => Object.entries(readTargets(t)).every(([k, target]) => (avgByMetric[k] || 0) >= target))
    .sort((a, b) => b.amount - a.amount)[0]?.amount ?? 0;
}

// The next unmet tier with per-metric shortfall = max(0, target - avg). null if all tiers cleared.
export function nextGate(tiers, avgByMetric) {
  const next = (tiers || [])
    .filter((t) => Object.entries(readTargets(t)).some(([k, target]) => (avgByMetric[k] || 0) < target))
    .sort((a, b) => a.amount - b.amount)[0];
  if (!next) return null;
  const targets = readTargets(next);
  const shortfall = {};
  for (const [k, target] of Object.entries(targets)) shortfall[k] = Math.max(0, target - (avgByMetric[k] || 0));
  return { amount: next.amount, targets, shortfall };
}
```

- [ ] **Step 5: Re-point the deposit join to `metric_facts` and return `avgByMetric`**

In `agentCount` (the `LEFT JOIN goldrush_deposits gd …` query), replace the join with `metric_facts`:

```js
// deposit gate now reads metric_facts (metric_key='deposits'); goldrush_deposits is dormant.
`LEFT JOIN metric_facts gd
   ON gd.tenant_id = v.tenant_id
  AND gd.metric_key = 'deposits'
  AND gd.subject_key = COALESCE(json_extract(vi.custom_field_values,'$.goldrush_id_entry'),
                                json_extract(vi.custom_field_values,'$.goldrush_id'))`
```

In `agentMetric`, replace the returned `avgSignups`/`avgDeposits` fields with an `avgByMetric` map (keep `avg` for back-compat callers):

```js
  const avgByMetric = { signups: count / wd, deposits: deposits / wd };
  return { count, converted, deposits, avg: count / wd, avgByMetric, workingDays: wd };
```

Apply the identical `avgByMetric` return to `teamMetric`.

- [ ] **Step 6: Update `computeIncentive` to pass `avgByMetric`**

In `computeIncentive`, change the `payable`/`nextTier` computation:

```js
  const payable = withBase(tierFor(tiers, qualified.avgByMetric));
  const nextTier = nextGate(tiers, provisional.avgByMetric);
  // per-metric snapshot for cockpit/GM consumers (avg per working day, keyed by metric)
  const metricByKey = provisional.avgByMetric;
```

and include `metricByKey` in the returned object alongside `payable`, `nextTier`, `tiers`.

- [ ] **Step 7: Run the demo to verify it passes**

Run: `cd workers-api && node src/services/incentiveService.js`
Expected: `incentiveService demo OK` and no assertion failures.

- [ ] **Step 8: Run the existing incentive test suite (regression)**

Run: `cd workers-api && npx vitest run src/services/incentiveService`
Expected: PASS (any existing tests still green; if a test asserts the old `avgSignups` field it must be updated to `avgByMetric.signups` in the same commit).

- [ ] **Step 9: Commit**

```bash
git add workers-api/src/services/incentiveService.js
git commit -m "feat(metrics): N-gate engine reads metric_facts + avgByMetric"
```

---

### Task 4: `below_gate` signal (pure) + `KIND_WEIGHT`

**Files:**
- Modify: `workers-api/src/services/kpiSignals.js` (add `signalBelowGate`).
- Modify: `workers-api/src/services/kpiSignals.test.js` (assert behavior).
- Modify: `workers-api/src/services/issueEngine.js` (add `KIND_WEIGHT.below_gate`; extend `demo()`).

**Interfaces:**
- Consumes: `nextGate(...)` output shape from Task 3 (`{ shortfall:{[k]:n}, targets:{[k]:n} }`).
- Produces: `signalBelowGate({ avgByMetric, nextGate })` → `Signal[]`, one `{ type:'below_gate', detail:{ metric, shortfall, target } }` per gate metric that trails pace (shortfall > 0). Empty array when `nextGate` is null or nothing trails.

- [ ] **Step 1: Write the failing test**

Add to `workers-api/src/services/kpiSignals.test.js`:

```js
import { signalBelowGate } from './kpiSignals.js';

test('below_gate fires one signal per trailing gate metric', () => {
  const ng = { amount: 2500, targets: { signups: 10, deposits: 8 }, shortfall: { signups: 1, deposits: 0 } };
  const out = signalBelowGate({ avgByMetric: { signups: 9, deposits: 8 }, nextGate: ng });
  expect(out).toHaveLength(1);
  expect(out[0]).toEqual({ type: 'below_gate', detail: { metric: 'signups', shortfall: 1, target: 10 } });
});

test('below_gate is silent when nothing trails or no next tier', () => {
  expect(signalBelowGate({ avgByMetric: { signups: 99 }, nextGate: null })).toEqual([]);
  const met = { amount: 2500, targets: { signups: 10 }, shortfall: { signups: 0 } };
  expect(signalBelowGate({ avgByMetric: { signups: 10 }, nextGate: met })).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd workers-api && npx vitest run src/services/kpiSignals.test.js`
Expected: FAIL — `signalBelowGate is not a function` / import error.

- [ ] **Step 3: Implement `signalBelowGate`**

Add to `workers-api/src/services/kpiSignals.js` (alongside the other `signal*` fns):

```js
// A person trailing the pace needed for their next incentive tier. One signal per gate metric
// still short (shortfall > 0), carrying the metric key, its shortfall, and the target it missed.
// Pure: callers compute nextGate via incentiveService and pass it in. Silent when on/above pace.
export function signalBelowGate({ nextGate }) {
  if (!nextGate) return [];
  return Object.entries(nextGate.shortfall || {})
    .filter(([, short]) => short > 0)
    .map(([metric, shortfall]) => ({
      type: 'below_gate',
      detail: { metric, shortfall, target: nextGate.targets[metric] },
    }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd workers-api && npx vitest run src/services/kpiSignals.test.js`
Expected: PASS.

- [ ] **Step 5: Add `KIND_WEIGHT.below_gate` and extend the issueEngine demo**

In `workers-api/src/services/issueEngine.js`, add `below_gate` to the `KIND_WEIGHT` map. Weight `4` — same tier as `below_target` (a missed pay gate is a strong signal, below `gone_quiet`'s 5):

```js
const KIND_WEIGHT = {
  gone_quiet: 5,
  below_gate: 4,
  below_target: 4,
  dropped_vs_baseline: 3,
  low_conversion: 2,
  late_start: 1,
  short_field_day: 1,
  idle_gaps: 1,
  excess_travel: 1,
};
```

In the existing `demo()` in that file, add an assertion that `severityOf` counts `below_gate`:

```js
  console.assert(severityOf(['below_gate']).weight === 4, 'below_gate weight');
```
(Match the property name `severityOf` returns — if it returns `{ weight, count }`, assert `.weight`; if the field differs, use the existing field name already asserted in `demo()`.)

- [ ] **Step 6: Run the issueEngine demo**

Run: `cd workers-api && node src/services/issueEngine.js`
Expected: prints its existing demo OK line, no assertion failure.

- [ ] **Step 7: Commit**

```bash
git add workers-api/src/services/kpiSignals.js workers-api/src/services/kpiSignals.test.js workers-api/src/services/issueEngine.js
git commit -m "feat(metrics): below_gate signal + severity weight"
```

---

### Task 5: Wire `below_gate` into `/kpi/self` and the `reactToIssues` cron

**Files:**
- Modify: `workers-api/src/routes/field-ops/kpi.js` (`/kpi/self` — append registry metrics + `below_gate`).
- Modify: `workers-api/src/index.js` (`reactToIssues` — append `below_gate` after `agentSignals`).

**Interfaces:**
- Consumes: `getConfig(db, tenantId, companyId, 'metrics')`; `computeIncentive`/`agentMetric` + `nextGate` from Task 3; `signalBelowGate` from Task 4.
- Produces: `/kpi/self` response gains `metrics` (array of `{ key, label, value, target, shortfall }` for `visibility:'all'` gate metrics) and any `below_gate` entries in `signals`. Cron opens/escalates `below_gate` issues on the existing ladder.

- [ ] **Step 1: Add registry metrics + below_gate to `/kpi/self`**

In `kpi.js`, inside `app.get('/kpi/self', …)`, after `signals` is built (line 92-94) and before the `return c.json(...)`, add:

```js
  // Registry-driven metric tiles (visibility:'all' gate metrics) + below_gate pace signal.
  const registry = (await getConfig(db, tenantId, companyId, 'metrics')) || [];
  const gateMetrics = registry.filter((m) => m.gate && m.visibility === 'all');
  let metrics = [];
  if (gateMetrics.length && actual.days > 0) {
    // per-working-day averages + this person's next-tier shortfall, via the shared engine.
    const inc = await computeIncentive(db, tenantId, companyId, userId, role);
    const avgByMetric = inc?.metricByKey || {};
    const ng = inc?.nextTier || null;
    metrics = gateMetrics.map((m) => ({
      key: m.key,
      label: m.label,
      value: avgByMetric[m.key] ?? 0,
      target: ng?.targets?.[m.key] ?? null,
      shortfall: ng?.shortfall?.[m.key] ?? 0,
    }));
    signals.push(...signalBelowGate({ nextGate: ng }));
  }
  return c.json({ actual, thresholds, signals, metrics });
```

Add the imports at the top of `kpi.js`:

```js
import { computeIncentive } from '../../services/incentiveService.js';
import { signalBelowGate } from '../../services/kpiSignals.js';
```

(Confirm `computeIncentive`'s real signature before wiring — if it takes `(db, tenantId, companyId, userId, role)` use as shown; if it takes a period/anchor arg, pass the current period as `gm.js` does. Match the existing caller in `gm.js`.)

- [ ] **Step 2: Verify kpi.js parses**

Run: `cd workers-api && node --check src/routes/field-ops/kpi.js`
Expected: exit 0.

- [ ] **Step 3: Append `below_gate` in the `reactToIssues` cron**

In `workers-api/src/index.js`, in `reactToIssues`, immediately after the per-agent line `const { actual, signals } = await agentSignals(db, tenantId, agent.id, thresholds, since);` (≈line 21745), append the pace signal for agent-subject rows:

```js
        // Pace signal: is this agent trailing the per-working-day gate targets for their next tier?
        if (AGENT_SUBJECT.has(agent.role)) {
          const inc = await computeIncentive(db, tenantId, companyId, agent.id, agent.role);
          signals.push(...signalBelowGate({ nextGate: inc?.nextTier || null }));
        }
```

(Confirm `companyId` is in scope at this point in the loop — the cron builds agents per tenant; if company scoping is per-agent, read it from the agent row or pass `null` as elsewhere in the cron. Use the same company value the surrounding `thresholdsFor`/`gmFor` calls use.)

Add to the imports already present at the top of `index.js` for `incentiveService` (it is already imported for other symbols — extend that import) and `kpiSignals`:

```js
import { computeIncentive } from './services/incentiveService.js'; // extend existing import if present
import { signalBelowGate } from './services/kpiSignals.js';        // extend existing import if present
```

- [ ] **Step 4: Verify index.js parses**

Run: `cd workers-api && node --check src/index.js`
Expected: exit 0.

- [ ] **Step 5: Run the workers-api test suite (regression)**

Run: `cd workers-api && npx vitest run`
Expected: PASS (no regressions from the wiring).

- [ ] **Step 6: Commit**

```bash
git add workers-api/src/routes/field-ops/kpi.js workers-api/src/index.js
git commit -m "feat(metrics): surface below_gate in cockpit + escalation cron"
```

---

### Task 6: Generalized `/metric-facts` endpoint + `/deposits` alias

**Files:**
- Create: `workers-api/src/routes/field-ops/metricFacts.js`
- Modify: `workers-api/src/routes/field-ops/deposits.js` (POST → alias forwarding `metric_key='deposits'`; GET/DELETE/reconcile → `metric_facts`).
- Modify: `workers-api/src/index.js` (mount the new router at line ~21338).

**Interfaces:**
- Consumes: `metric_facts` table (Task 1); `extractGoldrushIds` from `incentiveService.js`.
- Produces: `POST /field-ops/metric-facts` body `{ company_id?, metric_key, source_batch?, dry_run?, facts:[{subject_key, amount?}] }` → INSERT OR IGNORE; `dry_run` returns `{ matched, unmatched }`. `GET /field-ops/metric-facts?company_id=&metric_key=&batch=&limit=`. `DELETE /field-ops/metric-facts/:id`.

- [ ] **Step 1: Write the generalized router**

Create `workers-api/src/routes/field-ops/metricFacts.js`:

```js
/**
 * Generalized metric-fact ingest (the metric rail). A metric fact = one (metric_key, subject_key)
 * datum for a company: a confirmed deposit, an active user, a value-per-user number. Deposits are
 * the live case; other keys are seeded per-company via the metrics registry. Idempotent-additive:
 * INSERT OR IGNORE against UNIQUE(tenant,company,metric_key,subject,period) — re-upload is a no-op.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';

const app = new Hono();
const boRoles = requireRole('admin', 'general_manager', 'backoffice_admin');

// Canonical goldrush id expression over visit_individuals — used to flag which deposit facts
// map to an existing signup (BO chases the rest). Only meaningful for metric_key='deposits'.
const GID = `COALESCE(json_extract(custom_field_values,'$.goldrush_id_entry'),
                      json_extract(custom_field_values,'$.goldrush_id'))`;

// POST /field-ops/metric-facts — ingest facts for one metric_key.
export async function ingestMetricFacts(c, forcedKey) {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => ({}));
  const companyId = body.company_id ?? null;
  const metricKey = forcedKey || body.metric_key;
  const period = body.period ?? null;
  const batch = body.source_batch || null;
  if (!metricKey) return c.json({ success: false, error: 'metric_key required' }, 400);

  // Normalize facts: dedupe by subject_key, coerce amount.
  const rows = [];
  const seen = new Set();
  for (const f of Array.isArray(body.facts) ? body.facts : []) {
    const key = String(f.subject_key ?? '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push({ subject_key: key, amount: f.amount == null ? null : Number(f.amount) });
  }
  if (rows.length === 0) return c.json({ success: false, error: 'No facts in the upload' }, 400);

  // For deposits, report which subject_keys map to a signup so BO can chase the rest.
  let matched = new Set();
  if (metricKey === 'deposits') {
    const ph = rows.map(() => '?').join(',');
    const { results: found } = await db.prepare(
      `SELECT DISTINCT ${GID} g FROM visit_individuals WHERE tenant_id = ? AND ${GID} IN (${ph})`
    ).bind(tenantId, ...rows.map((r) => r.subject_key)).all();
    matched = new Set((found || []).map((r) => String(r.g)));
  }
  const unmatched = metricKey === 'deposits' ? rows.map((r) => r.subject_key).filter((k) => !matched.has(k)) : [];

  if (body.dry_run) {
    return c.json({ success: true, dry_run: true, uploaded: rows.length, matched: matched.size, unmatched });
  }

  let inserted = 0;
  for (const r of rows) {
    const res = await db.prepare(
      `INSERT OR IGNORE INTO metric_facts (id, tenant_id, company_id, metric_key, subject_key, amount, period, source_batch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), tenantId, companyId, metricKey, r.subject_key, r.amount, period, batch).run();
    inserted += res.meta?.changes ?? 0;
  }
  return c.json({ success: true, uploaded: rows.length, inserted, duplicates: rows.length - inserted, matched: matched.size, unmatched });
}

app.post('/metric-facts', boRoles, (c) => ingestMetricFacts(c));

// GET /field-ops/metric-facts?company_id=&metric_key=&batch=&limit=
app.get('/metric-facts', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.req.query('company_id') || null;
  const metricKey = c.req.query('metric_key') || null;
  const batch = c.req.query('batch') || null;
  const limit = Math.min(Number(c.req.query('limit')) || 200, 1000);
  const { results } = await db.prepare(
    `SELECT mf.*,
            (SELECT 1 FROM visit_individuals vi
              WHERE vi.tenant_id = mf.tenant_id AND ${GID.replace(/custom_field_values/g, 'vi.custom_field_values')} = mf.subject_key
              LIMIT 1) matched
       FROM metric_facts mf
      WHERE mf.tenant_id = ?
        AND (? IS NULL OR mf.company_id = ?)
        AND (? IS NULL OR mf.metric_key = ?)
        AND (? IS NULL OR mf.source_batch = ?)
      ORDER BY mf.created_at DESC
      LIMIT ?`
  ).bind(tenantId, companyId, companyId, metricKey, metricKey, batch, batch, limit).all();
  return c.json({ success: true, facts: (results || []).map((r) => ({ ...r, matched: !!r.matched })) });
});

// DELETE /field-ops/metric-facts/:id
app.delete('/metric-facts/:id', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const res = await db.prepare(`DELETE FROM metric_facts WHERE tenant_id = ? AND id = ?`)
    .bind(tenantId, c.req.param('id')).run();
  return c.json({ success: true, deleted: res.meta?.changes ?? 0 });
});

export default app;
```

- [ ] **Step 2: Reduce `deposits.js` to a thin alias over `metric_facts`**

Rewrite `workers-api/src/routes/field-ops/deposits.js` so `POST /deposits` forwards to the generalized ingest with `metric_key='deposits'` (mapping the id-only paths to `facts`), and GET/DELETE/reconcile read `metric_facts`:

```js
/**
 * Back-Office Goldrush deposit ingest — now a thin alias over the generalized metric rail.
 * POST /deposits normalizes its id-only inputs to deposit facts and forwards to ingestMetricFacts
 * with metric_key='deposits'. GET/DELETE read metric_facts; reconcile promotes signups that have a
 * deposit fact. The two-gate → N-gate engine reads these facts, so ingesting one clears the gate.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { extractGoldrushIds } from '../../services/incentiveService.js';
import { ingestMetricFacts } from './metricFacts.js';

const app = new Hono();
const boRoles = requireRole('admin', 'general_manager', 'backoffice_admin');
const GID = `COALESCE(json_extract(custom_field_values,'$.goldrush_id_entry'),
                      json_extract(custom_field_values,'$.goldrush_id'))`;

// POST /field-ops/deposits — legacy alias. Accepts {deposits:[{goldrush_id,amount}], goldrush_ids, csv}.
app.post('/deposits', boRoles, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  // Normalize every id path to a 9-digit subject_key; deposits are count-only (amount omitted).
  const seen = new Set();
  const facts = [];
  const add = (id) => {
    const m = String(id ?? '').match(/(?<!\d)\d{9}(?!\d)/);
    if (m && !seen.has(m[0])) { seen.add(m[0]); facts.push({ subject_key: m[0] }); }
  };
  for (const d of Array.isArray(body.deposits) ? body.deposits : []) add(d.goldrush_id);
  for (const id of extractGoldrushIds({ goldrush_ids: body.goldrush_ids, csv: body.csv })) add(id);
  // Rebuild the request body the generalized ingest expects, then delegate.
  c.req.json = async () => ({ company_id: body.company_id ?? null, source_batch: body.source_batch || null, dry_run: !!body.dry_run, facts });
  return ingestMetricFacts(c, 'deposits');
});

// GET /field-ops/deposits — recent deposit facts with a matched flag (BO list screen).
app.get('/deposits', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.req.query('company_id') || null;
  const batch = c.req.query('batch') || null;
  const limit = Math.min(Number(c.req.query('limit')) || 200, 1000);
  const { results } = await db.prepare(
    `SELECT mf.id, mf.company_id, mf.subject_key AS goldrush_id, mf.amount, mf.source_batch, mf.created_at,
            (SELECT 1 FROM visit_individuals vi
              WHERE vi.tenant_id = mf.tenant_id AND ${GID.replace(/custom_field_values/g, 'vi.custom_field_values')} = mf.subject_key
              LIMIT 1) matched
       FROM metric_facts mf
      WHERE mf.tenant_id = ? AND mf.metric_key = 'deposits'
        AND (? IS NULL OR mf.company_id = ?)
        AND (? IS NULL OR mf.source_batch = ?)
      ORDER BY mf.created_at DESC LIMIT ?`
  ).bind(tenantId, companyId, companyId, batch, batch, limit).all();
  return c.json({ success: true, deposits: (results || []).map((r) => ({ ...r, deposit_date: null, matched: !!r.matched })) });
});

// POST /field-ops/deposits/reconcile — promote provisional signups that now have a deposit fact.
app.post('/deposits/reconcile', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const res = await db.prepare(
    `UPDATE visit_individuals
        SET custom_field_values = json_set(COALESCE(custom_field_values,'{}'),'$.verification_status','qualified')
      WHERE tenant_id = ?
        AND COALESCE(json_extract(custom_field_values,'$.verification_status'),'provisional') = 'provisional'
        AND ${GID} IN (SELECT subject_key FROM metric_facts WHERE tenant_id = ? AND metric_key = 'deposits')`
  ).bind(tenantId, tenantId).run();
  return c.json({ success: true, qualified: res.meta?.changes ?? 0 });
});

// DELETE /field-ops/deposits/:id — remove a mistaken deposit fact.
app.delete('/deposits/:id', boRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const res = await db.prepare(`DELETE FROM metric_facts WHERE tenant_id = ? AND id = ? AND metric_key = 'deposits'`)
    .bind(tenantId, c.req.param('id')).run();
  return c.json({ success: true, deleted: res.meta?.changes ?? 0 });
});

export default app;
```

(Note: reassigning `c.req.json` is the minimal way to reuse `ingestMetricFacts` without a signature change. If the codebase forbids mutating the context, instead extract the normalize+insert core of `ingestMetricFacts` into a plain `async function insertFacts(db, tenantId, {companyId, metricKey, facts, batch, period, dryRun})` and call it from both routers — pick whichever matches the house style you observe in the file.)

- [ ] **Step 3: Mount the new router in `index.js`**

In `workers-api/src/index.js`, add the import near the other field-ops route imports (line ~13) and mount it near line 21338:

```js
import metricFactsRoutes from './routes/field-ops/metricFacts.js';   // near line 13
```
```js
api.route('/field-ops', metricFactsRoutes);                          // near line 21338, beside depositRoutes
```

- [ ] **Step 4: Verify all three files parse**

Run: `cd workers-api && node --check src/routes/field-ops/metricFacts.js && node --check src/routes/field-ops/deposits.js && node --check src/index.js`
Expected: exit 0.

- [ ] **Step 5: Run the workers-api test suite (regression)**

Run: `cd workers-api && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add workers-api/src/routes/field-ops/metricFacts.js workers-api/src/routes/field-ops/deposits.js workers-api/src/index.js
git commit -m "feat(metrics): generalized /metric-facts endpoint + /deposits alias"
```

---

### Task 7: BO PWA — Excel/CSV month-to-date file upload

**Files:**
- Modify: `frontend/package.json` (add `xlsx`).
- Modify: `frontend/src/pages/agent/BackOfficeDeposits.tsx` (add file picker → client-side parse → 9-digit IDs into the existing flow).

**Interfaces:**
- Consumes: the existing `/field-ops/deposits` POST (which now forwards to `metric_facts`).
- Produces: a file `<input type="file" accept=".xlsx,.xls,.csv">` that parses the sheet to text, extracts 9-digit IDs, and drops them into the existing `text` state so Preview/Upload work unchanged.

- [ ] **Step 1: Add the `xlsx` dependency**

Run: `cd frontend && npm install xlsx`
Expected: `frontend/package.json` gains `"xlsx": "^0.18.5"` (or current) under `dependencies`; lockfile updates.

- [ ] **Step 2: Add the file-parse handler to `BackOfficeDeposits.tsx`**

At the top of `BackOfficeDeposits.tsx`, add the import:

```tsx
import * as XLSX from 'xlsx'
```

Inside the component, add a handler that reads a workbook, flattens every cell to a string, extracts 9-digit IDs, and appends them to `text`:

```tsx
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      // Flatten every sheet to raw cell text, then pull 9-digit ids (same rule as the server).
      let dump = ''
      for (const name of wb.SheetNames) {
        dump += XLSX.utils.sheet_to_csv(wb.Sheets[name]) + '\n'
      }
      const ids = Array.from(dump.matchAll(/(?<!\d)\d{9}(?!\d)/g)).map((m) => m[0])
      const unique = Array.from(new Set(ids))
      if (!unique.length) { toast.error('No 9-digit Goldrush IDs found in that file'); return }
      setText((t) => (t.trim() ? t.trim() + '\n' : '') + unique.join('\n'))
      reset()
      toast.success(`${unique.length} ID${unique.length === 1 ? '' : 's'} loaded from ${file.name}`)
    } catch {
      toast.error('Could not read that file')
    }
  }
```

- [ ] **Step 3: Add the file-picker button to the UI**

In `BackOfficeDeposits.tsx`, directly above the `<textarea>` (line ~124), add a labeled file input styled as a button:

```tsx
        <label className="flex items-center justify-center gap-2 w-full mb-3 bg-white/[0.04] border border-dashed border-white/15 rounded-2xl py-3 text-sm text-gray-300 cursor-pointer active:scale-[0.99] transition-transform">
          <Upload className="w-4 h-4 text-[#00E87B]" />
          Upload Excel / CSV file
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
        </label>
```

Add `Upload` to the lucide import on line 2:

```tsx
import { Loader2, CheckCircle2, AlertTriangle, Banknote, Trash2, RefreshCw, Link2, Unlink, Upload } from 'lucide-react'
```

- [ ] **Step 4: Verify the frontend builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors from `BackOfficeDeposits.tsx`.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/pages/agent/BackOfficeDeposits.tsx
git commit -m "feat(metrics): BO Excel/CSV file upload for deposit IDs"
```

---

### Task 8: `/kpi/self` cockpit — render metric list dynamically

**Files:**
- Modify: `frontend/src/pages/agent/PerformanceCard.tsx` (render `metrics` from the response; add `below_gate` case).

**Interfaces:**
- Consumes: `/kpi/self` response `metrics: [{ key, label, value, target, shortfall }]` and `below_gate` signals (Task 5).
- Produces: one `<Metric>` per registry metric, replacing the hard-coded Signups tile; Visits/Conversion/Qualified tiles stay.

- [ ] **Step 1: Extend the response type and signalText**

In `PerformanceCard.tsx`, add the `metrics` field to `SelfKpi` and a `below_gate` case to `signalText`:

```tsx
type RegistryMetric = { key: string; label: string; value: number; target: number | null; shortfall: number }
type SelfKpi = { actual: Actual; thresholds: Thresholds; signals: Signal[]; metrics?: RegistryMetric[] }
```

In `signalText`, add before `default:`:

```tsx
    case 'below_gate':
      return `Behind pace on ${String(s.detail?.metric || 'a target').replace('_', ' ')} — ${s.detail?.shortfall ?? '?'}/day short of the next tier`
```

- [ ] **Step 2: Render the registry metrics in place of the hard-coded Signups tile**

In the metric grid (lines 91-96), replace the single hard-coded Signups `<Metric>` with a dynamic map, keeping Visits / Conversion / Qualified:

```tsx
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric label="Visits/day" value={actual.visits_per_day} target={thresholds.visits_per_day} />
        {(d.metrics || []).map((m) => (
          <Metric key={m.key} label={`${m.label}/day`} value={m.value} target={m.target ?? undefined} />
        ))}
        <Metric label="Conversion" value={actual.conversion_pct * 100} target={thresholds.conversion_floor_pct} suffix="%" />
        <Metric label="Qualified" value={actual.qualified_pct * 100} suffix="%" />
      </div>
```

(If `d.metrics` is empty — e.g. Stellr before ingestion, or a config without gate metrics — the grid falls back to the three static tiles, so the card never breaks.)

- [ ] **Step 3: Verify the frontend builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors from `PerformanceCard.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/agent/PerformanceCard.tsx
git commit -m "feat(metrics): render cockpit metric tiles from registry"
```

---

### Task 9: GM unified performance-vs-actions view

**Files:**
- Modify: `workers-api/src/routes/field-ops/gm.js` (`buildGmOverview` — add a per-row actions column from the issues ledger; keep GM-only revenue).

**Interfaces:**
- Consumes: `buildGmOverview(db, tenantId, companyId, period, anchor)`; the `issues` ledger (`owner_id`/`subject_id`, `status`).
- Produces: each leaders/teams row gains `{ open_issues, acted_issues }` (issues where the person is the *subject*), alongside the existing GM-only `revenue` number. This is the "number vs their actions" surface.

- [ ] **Step 1: Add an issues-per-subject subquery to the leaders/teams aggregation**

In `gm.js`, in `buildGmOverview`, after the leaders rows are built (the top-5 signups block, ≈lines 150-180), enrich each row with its issue counts. Add a single grouped lookup keyed by subject:

```js
  // Accountability column: open vs acted issues per person (as the issue's subject).
  // One grouped scan, joined in memory — cheaper than a correlated subquery per row.
  const subjectIds = leaders.map((r) => r.agent_id).filter(Boolean);
  let issuesBySubject = {};
  if (subjectIds.length) {
    const ph = subjectIds.map(() => '?').join(',');
    const { results: ic } = await db.prepare(
      `SELECT subject_id,
              SUM(CASE WHEN status = 'open'  THEN 1 ELSE 0 END) open_issues,
              SUM(CASE WHEN status = 'acted' THEN 1 ELSE 0 END) acted_issues
         FROM issues
        WHERE tenant_id = ? AND status != 'resolved' AND subject_id IN (${ph})
        GROUP BY subject_id`
    ).bind(tenantId, ...subjectIds).all();
    issuesBySubject = Object.fromEntries((ic || []).map((r) => [r.subject_id, r]));
  }
  for (const r of leaders) {
    const x = issuesBySubject[r.agent_id] || {};
    r.open_issues = x.open_issues || 0;
    r.acted_issues = x.acted_issues || 0;
  }
```

(Match the real row key — if `buildGmOverview`'s leader rows use `id`/`user_id` instead of `agent_id`, use that field. Apply the same enrichment to the `teams` rows if they carry a person/lead id.)

- [ ] **Step 2: Verify gm.js parses**

Run: `cd workers-api && node --check src/routes/field-ops/gm.js`
Expected: exit 0.

- [ ] **Step 3: Run the workers-api test suite (regression)**

Run: `cd workers-api && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add workers-api/src/routes/field-ops/gm.js
git commit -m "feat(metrics): GM unified performance-vs-actions column"
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task |
|---|---|
| §1 Metric registry (`metrics` config key, Goldrush live + Stellr placeholder) | Task 2 |
| §2 Migration `metric_facts` + backfill + engine join re-point | Task 1 (table/backfill) + Task 3 (join) |
| §3 N-gate engine (`avgByMetric`, `tierFor`, `nextGate`, `computeIncentive`, demo parity) | Task 3 |
| §4 `/kpi/self` registry metrics + PerformanceCard dynamic tiles | Task 5 (API) + Task 8 (UI) |
| §5 `below_gate` signal + `KIND_WEIGHT` + reactToIssues + kpi.js wiring | Task 4 (signal) + Task 5 (wiring) |
| §6 GM unified number-vs-actions column | Task 9 |
| §7 BO Excel/CSV upload + generalized `/metric-facts` + deposits alias | Task 6 (API) + Task 7 (UI) |
| §8 Accountability spine (below_gate on the SLA ladder; severity self-check) | Task 4 (weight/demo) + Task 5 (cron ladder) |

All eight sections map to at least one task. GM-only revenue stays in `gm.js` (untouched by the metric registry) per the global constraint.

**2. Placeholder scan:** No `TBD`/`TODO`/"handle edge cases" left. Every code step shows real code. The three "confirm the real signature/field name before wiring" notes (Task 5 `computeIncentive` args, Task 5 cron `companyId` scope, Task 9 leader row key) are verification instructions against existing code, not placeholders — the surrounding code is complete and the fallback is stated.

**3. Type consistency:**
- `avgByMetric` — object keyed by metric_key — is produced in Task 3 (`agentMetric`/`teamMetric`), consumed by `tierFor`/`nextGate` (Task 3), `signalBelowGate` (Task 4, via `nextGate` output), and `/kpi/self` (Task 5). Consistent.
- `nextGate` return shape `{ amount, targets, shortfall }` — produced Task 3, consumed by `signalBelowGate` (reads `.shortfall`, `.targets`) Task 4 and `/kpi/self` (reads `.targets`, `.shortfall`) Task 5. Consistent.
- `metricByKey` on `computeIncentive` — produced Task 3, consumed Task 5 (`inc.metricByKey`). Consistent.
- `metrics` response field `[{key,label,value,target,shortfall}]` — produced Task 5, consumed Task 8 (`RegistryMetric`). Field names match.
- `metric_facts` columns — defined Task 1, referenced identically in Task 3 (join), Task 6 (ingest/GET/DELETE), Task 6 deposits alias. `subject_key`/`metric_key`/`period`/`amount` consistent throughout.
- `signalBelowGate({ nextGate })` — Task 4 defines it reading only `nextGate`; both callers (Task 5 kpi.js, Task 5 cron) pass `{ nextGate }`. The Task 4 test also passes `avgByMetric` but the impl ignores it — harmless; the impl signature is the source of truth.

One correction folded in during review: the spec named migration `0015`, but `0015`–`0018` already exist — this plan uses `0019` (Global Constraints + Task 1).

---

**Plan complete.**
