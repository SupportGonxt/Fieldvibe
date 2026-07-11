# Goldrush Performance System — Design

**Date:** 2026-07-11
**Status:** Approved design, pre-implementation
**Author:** brainstorming session (FieldVibe)

## Problem

The stated basis for company performance is **signups + deposits** as KPIs. The
system already knows almost everything it needs — but three surfaces disagree on
what "performance" means, deposits are invisible to the people who drive them,
and there is no single place where a GM sees each person's *number* next to their
*actions*.

Three disagreeing metric surfaces today:

1. `/kpi/self` + `kpiSignals` + `PerformanceCard` — visits / signups / conversion.
   **No deposits.**
2. `incentiveService` — signups + deposits, two-gate pay engine.
3. `gm.js` funnel — signups / converted / qualified + money (revenue).

The agent cockpit is blind to the deposit gate that determines their pay. Signals
and issues never fire on the deposit gate. The GM sees performance (`gm.js`) and
accountability (`issues`) in two separate places.

A second company, **Stellr**, tracks *different metrics entirely* — retention /
active-users and value-per-user — not signups + deposits. The current engine
hardwires exactly two metrics (signups, deposits), so Stellr cannot be expressed
as config alone; it needs a real per-company metric layer.

## Scope

- **Goldrush: built and wired live** this cycle — deposits become a first-class,
  visible KPI everywhere; the deposit gate feeds signals/issues/nudges; the GM
  gets a unified performance-vs-actions view; BO uploads deposits by Excel/CSV file.
- **Stellr: placeholder only** — its metrics (`active_users`, `value_per_user`)
  are registered in config so the generic rail is exercised by real config, but
  no Stellr data source is wired and its UI reads "not configured" until a BO
  uploads. No Stellr-specific compute code is written this cycle.

The design builds a **generic metric rail** (Approach A, chosen over per-company
code modules and a hardcoded two-slot engine) because two concrete companies with
genuinely different metrics is the real requirement, not speculation — and the
brief ("use everything it knows") points at extensibility. A third company or a
third metric becomes config + file upload, not a rewrite.

## Principles

- **Deposit counts are visible to every role; deposit revenue (rand) is GM-only.**
  Generalized: metric `visibility: 'all'` shows counts to all roles; `visibility:
  'gm'` restricts rand values to the GM.
- **Month-to-date file semantics:** each BO upload is the full authoritative
  snapshot for the metric. Ingest stays idempotent-additive (`INSERT OR IGNORE`),
  no clawback — a deposit, once recorded, stays recorded.
- **Reuse over rebuild:** the action channel (signals → issues → nudge/note), the
  GM overview, and the deposit join already exist. This design extends them; it
  does not add a parallel channel.

## 1. Metric registry (per-company config)

A new config key `metrics`, resolved through the existing `getConfig(db,
tenantId, companyId, 'metrics')` (company row overrides the tenant default,
`company_id IS NULL`). Value is a JSON array of metric definitions:

```json
[
  { "key": "signups",  "label": "Signups",  "source": "internal", "visibility": "all", "gate": true,  "value": false },
  { "key": "deposits", "label": "Deposits", "source": "bo_file",   "visibility": "all", "gate": true,  "value": false }
]
```

Field meanings:

| field        | values                    | meaning |
|--------------|---------------------------|---------|
| `key`        | string                    | stable metric id, also the `metric_facts.metric_key` |
| `label`      | string                    | display label |
| `source`     | `internal` \| `bo_file`   | `internal` = computed from visit data (signups only); `bo_file` = fed by BO upload |
| `visibility` | `all` \| `gm`             | `all` = counts visible to every role; `gm` = rand values, GM only |
| `gate`       | bool                      | counts toward the pay tier |
| `value`      | bool                      | fact carries a rand `amount` |

**Goldrush (live):**
```json
[
  { "key": "signups",  "label": "Signups",  "source": "internal", "visibility": "all", "gate": true, "value": false },
  { "key": "deposits", "label": "Deposits", "source": "bo_file",   "visibility": "all", "gate": true, "value": false }
]
```
Deposit *revenue* is not a metric column. It is a GM-only derived figure
(`deposit count × commission_per_deposit`) that stays in `gm.js`.

**Stellr (placeholder):**
```json
[
  { "key": "active_users",   "label": "Active Users",   "source": "bo_file", "visibility": "all", "gate": true, "value": false },
  { "key": "value_per_user", "label": "Value / User",   "source": "bo_file", "visibility": "gm",  "gate": true, "value": true  }
]
```
Registered in config; no upload wired; every surface that renders Stellr metrics
shows "not configured" until facts exist.

Seeding: `config/seed-defaults` writes the Goldrush `metrics` array. The Stellr
placeholder array is seeded for the Stellr company row.

## 2. Data — generalize `goldrush_deposits` → `metric_facts`

Migration `0015_metric_facts.sql`. One fact table for all `bo_file` metrics.

```sql
CREATE TABLE IF NOT EXISTS metric_facts (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  company_id   TEXT,
  metric_key   TEXT NOT NULL,
  subject_key  TEXT NOT NULL,   -- canonical goldrush_id; Stellr: its user id
  amount       REAL,            -- NULL unless the metric's value flag is set
  period       TEXT,            -- NULL = cumulative (deposits); 'YYYY-MM' = monthly (retention)
  source_batch TEXT,
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, company_id, metric_key, subject_key, period)
);
CREATE INDEX IF NOT EXISTS idx_metric_facts_lookup
  ON metric_facts (tenant_id, company_id, metric_key, subject_key);
```

- `period` handles both semantics: deposits are cumulative (`period IS NULL` —
  once deposited, always deposited), Stellr retention is monthly (`period =
  'YYYY-MM'`). The UNIQUE constraint keys on `period`, so the same subject can be
  active across months without collision while deposits collapse to one row.
- **Backfill:** copy existing `goldrush_deposits` rows into `metric_facts` as
  `metric_key='deposits'`, `period=NULL`, `amount=NULL`, carrying `subject_key`
  from the existing goldrush id and `source_batch` where present.
- `goldrush_deposits` is left dormant after backfill (reads/writes re-pointed to
  `metric_facts`), dropped in a later migration once the new rail is proven.

The deposit join in `incentiveService` re-points from `goldrush_deposits` to
`metric_facts WHERE metric_key = 'deposits'`. Behavior is identical to today —
same canonical-goldrush-id LEFT JOIN, just a different table name.

## 3. Engine — two-gate → N-gate over the registry

`incentiveService` today hardwires `avgSignups` / `avgDeposits`. Generalize to a
loop over the company's `gate: true` metrics.

**Tier config shape change.** From:
```json
{ "amount": 4000, "signups": 8, "deposits": 3 }
```
to:
```json
{ "amount": 4000, "targets": { "signups": 8, "deposits": 3 } }
```
Backfill existing Goldrush tiers into the `targets` shape. A tier clears when
**every** gate metric's average per working day ≥ its target in `targets`.

Function changes (same file, same exports where possible):

- `agentMetric(...)` returns `{ avgByMetric: { signups, deposits }, workingDays,
  ... }` instead of separate `avgSignups`/`avgDeposits` — a map keyed by metric
  `key` so it scales to N metrics.
- `tierFor(tiers, avgByMetric)` — highest-amount tier where every
  `targets[key] <= avgByMetric[key]`, else 0.
- `nextGate(tiers, avgByMetric)` — next unreached tier plus a per-metric
  `shortfall: { deposits: 1.2, ... }` map (target minus current avg, clamped ≥0).
- `computeIncentive(...)` returns `metricByKey` (provisional + qualified per
  metric), `payable`, `nextTier`, `tiers`.

Goldrush's two live metrics produce results identical to the current two-gate
engine — this is a data-driven refactor, not a behavior change. The money path
keeps its existing self-check (extend the assert demo to drive the loop with the
Goldrush two-metric config and assert the same tier outcomes as before).

## 4. Agent / TL / manager cockpit — deposits visible

`/kpi/self` returns the company's `visibility: 'all'` metrics from the registry
with each metric's per-day average, its gate target, and its shortfall (from
`nextGate`). For Goldrush this adds a **Deposits/day** metric with its gate
target next to the existing Signups.

`PerformanceCard.tsx` renders the metric list dynamically (one `<Metric>` per
`visibility:'all'` entry) instead of the four hardcoded tiles. Revenue is never
sent to or rendered by this card. The visits/conversion/qualified tiles remain
(they are activity health, not gate metrics).

New signal `below_gate` (see §5) surfaces here through the existing
`signalText` switch: "Behind on Deposits — need 1.2/day more to clear your tier."

TL and manager dashboards reuse `PerformanceCard` (team-rolled variant) so they
see the same deposit gate their agents do.

## 5. Action channel — deposit gate feeds issues / nudge

`kpiSignals` gains a gate-aware signal. `evaluateSignals` calls a new
`signalBelowGate({ avgByMetric, nextGate })` that emits one `below_gate` signal
per gate metric trailing its pace, carrying `{ metric, shortfall, target }`.

This flows the **existing** rail with no new channel:

- `reactToIssues` (cron) opens/owns/resolves `below_gate` issues in the `issues`
  ledger (migration 0014) exactly as it does other signal kinds.
- `/kpi/remediate/nudge` sends the web-push to the agent PWA; `/kpi/remediate/note`
  records the coaching note — unchanged.
- `/issues/unmanaged` already surfaces which TL/manager is sitting on open
  issues, so deposit-gate accountability is visible to the GM for free.

`below_gate` is added as a recognized issue `kind` in `issueEngine` /
`reactToIssues` (severity by shortfall size, same pattern as existing kinds) — a
`KIND_WEIGHT.below_gate` entry ranks it against the other signals in the
worst-first queue. It then rides the accountability spine described in §8.

## 6. GM — unified performance-vs-actions

`buildGmOverview` gains a per-metric rollup driven by the registry: for Goldrush,
signups and deposit **count** tiles (revenue stays in the existing GM-only `money`
block — unchanged, still `converted × commission_per_deposit`).

**Unified view (chosen: extra column, not a new screen).** The existing GM
overview's `leaders` / `teams` rows are augmented so each person's row carries
both halves:

- **number** — their signups + deposit count (+ revenue for the GM) from the
  funnel/rollup.
- **actions** — their open / acted issue counts from the `issues` ledger
  (a `LEFT JOIN`/subquery on `issues` grouped by `owner_id`, or by `subject_id`
  for "issues about this person").

One row now answers "is this person performing *and* are they/their manager
acting on the issues raised" — the "number vs actions" view, folded into the
overview the GM already opens rather than a second destination.

## 7. BO file upload — Excel / CSV, month-to-date

**Parsing is client-side in the PWA**, keeping an xlsx parser out of the Worker
(CPU/bundle limits). No parser exists in the frontend today, so add the `xlsx`
(SheetJS) dependency — it reads both `.xlsx` and `.csv` from a single API, so one
dep covers both formats the BO admin needs.

Flow:

1. BO admin picks an `.xlsx` or `.csv` file in the PWA (month-to-date snapshot of
   goldrush ids that have deposited; for value metrics, an amount column too).
2. Client parses with `xlsx`, extracts 9-digit ids via the existing
   `/(?<!\d)\d{9}(?!\d)/` rule, plus optional `amount`.
3. Client POSTs to a generalized endpoint:
   ```
   POST /field-ops/metric-facts
   { company_id, metric_key, source_batch?, dry_run?,
     facts: [ { subject_key, amount? }, ... ] }
   ```
4. Server writes `metric_facts` with `INSERT OR IGNORE` (idempotent-additive —
   re-uploading the MTD file adds only new ids, matching current deposit
   semantics; no clawback). `dry_run` returns matched/unmatched counts without
   writing, as the current deposits endpoint does.

`deposits.js` generalizes into this metric-keyed router. The old `POST /deposits`
is kept as a thin alias that forwards with `metric_key='deposits'` so any existing
caller keeps working; the only frontend caller (the BO deposit UI) is updated to
the file-upload flow on the new endpoint. Auth unchanged:
`requireRole('admin','general_manager','backoffice_admin')`. `GET` / `DELETE` /
`reconcile` re-point to `metric_facts` filtered by `metric_key`.

## 8. Accountability spine — the system drives the role structure to act

This is the mechanism that makes the system *drive* performance rather than merely
report it. It already exists (`issueEngine` + the `reactToIssues` cron); this
cycle plugs the deposit gate into it and surfaces the whole chain to the GM.

**What already runs, unchanged:**

- **Detect → assign.** The cron evaluates signals per agent and opens an issue
  owned by the role responsible for acting — an underperforming agent's issue is
  owned by their **team lead** (the person who must coach), not the agent.
- **SLA ladder.** `SLA_HOURS` gives each owner role a window to act (team_lead
  48h, manager 72h, backoffice_admin 72h; general_manager never breaches — top of
  chain). `slaClockOf` runs the clock from `owner_since`, or from `acted_at` once
  actioned — ticking the box buys a fresh window, not immunity: if the agent is
  still failing after it, the issue re-opens.
- **Escalate on breach.** When an owner sits past their SLA (`isBreached`), the
  cron re-homes the issue one level up `ESCALATE_TO` (team_lead → manager →
  general_manager), resets `owner_since`, increments `escalations`, and notifies
  the new owner naming who let it lapse. The escalation record *is* the
  accountability trail.
- **Mandate + measure.** Each role's home shows their worst-first mandated queue
  (`/issues/mine`) and their own acted-vs-received KPI (`/issues/stats`). Not
  acting is itself visible upward via `/issues/unmanaged`.

**What this cycle adds:**

- The **deposit gate** (`below_gate`, §5) becomes a driver of this spine: a
  deposit shortfall opens a TL-owned issue that escalates TL → manager → GM on
  the same SLA ladder as any other signal. Deposits now compel action through the
  structure, not just display on a card.
- The GM **unified view** (§6) exposes the chain per person: their number, the
  current issue owner, whether it is breaching, and the escalation count — so the
  GM sees not only who is underperforming but *where the action stalled* in the
  role structure.

No new escalation logic is written; the deposit gate reuses the existing ladder.
The `severityOf` / `KIND_WEIGHT` self-check is extended to cover `below_gate`.

## Data flow (end to end, Goldrush)

```
BO Excel/CSV (MTD)
  → PWA parses (xlsx), extracts 9-digit ids
  → POST /field-ops/metric-facts {metric_key:'deposits', facts}
  → metric_facts (INSERT OR IGNORE)
  → incentiveService: signups (internal) + deposits (metric_facts) → N-gate
      → /kpi/self  → PerformanceCard (deposit tile + shortfall, counts only)
      → kpiSignals below_gate → issues ledger → nudge/note (PWA push)
      → gm.js overview: per-metric rollup + revenue (GM-only) + issues per person
```

## Testing

- `incentiveService` self-check (assert `demo()`): drive the N-gate loop with the
  Goldrush two-metric config; assert tier outcomes match the pre-refactor
  two-gate results for representative avg pairs (both gates clear, one short,
  neither). One runnable check on the money path.
- `kpiSignals`: assert `below_gate` fires only when a gate metric trails its
  target and stays silent on an empty window (reuse the existing empty-window
  guard).
- Migration 0015: verify backfill copies every `goldrush_deposits` row and the
  deposit join count is unchanged before/after re-pointing.

## Out of scope (this cycle)

- Stellr data ingestion / compute (retention derivation, value files). Only its
  placeholder config is written.
- Dropping `goldrush_deposits` (a later migration, after the new rail is proven).
- Clawback / snapshot-diff semantics (MTD stays additive-idempotent by decision).
- Per-metric editable target admin UI (existing config-seed path is sufficient;
  revisit if the GM needs in-app tier editing).
