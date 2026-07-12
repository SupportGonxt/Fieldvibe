# Per-Company Field-Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop conflating Goldrush and Stellr — give each person a per-company role/hierarchy, drive KPIs/signals off each company's configured metrics (Stellr = boards/surveys/quality/coverage), and emit one issue per (subject, company, polarity) grouped by company on screen. BO admin stays tenant-level.

**Architecture:** Extend `agent_company_links` with per-company `role`/`team_lead_id`/`manager_id` (backfilled from the user's global values). Widen `aggregateKpis`/`dailyRows` to a metric superset and make `signalBelowTarget` iterate whichever target keys the company's `kpi.<role>` config sets. The cron gathers one subject row per (user, active company) from the link, resolves owner/thresholds/metrics per company, and keys live-issue lookup/insert on `company_id`. A migration widens the live-issue unique index to include company. Frontend groups issue rows by company.

**Tech Stack:** Cloudflare Workers (Hono) + D1 (SQLite), Vitest for backend units; React + React Query + Vitest/RTL frontend. No new dependencies.

## Global Constraints

- Both companies live under **one tenant** (`default-tenant-001`); Goldrush code `GR`, Stellr id `5b129b5b-92b1-43c2-8523-caa221179d33` code `STELLR`. This is a per-company model gap, not a tenant-scoping change.
- Migrations are **100% manual** (`wrangler d1 migrations apply` / direct SQL), never CI. Prod D1 name: `fieldvibe-db`. **Always verify a migration via `pragma_table_info` — never trust `wrangler d1 migrations list`.**
- CI auto-deploys to **production** on merge to `main`; **no staging**. Frontend deploys before backend within one job — ship backend and frontend as **separate merges**, backend first.
- CI test job is `continue-on-error`; the Vitest suite is a **human pre-merge gate**. Run `npm test` in `workers-api/` and `frontend/` before merging.
- Keep signal/notification copy routed through `signalLabel()`/`metricLabel()` (friendliness pass already shipped) — do not reintroduce raw slugs.
- Board/survey columns already exist: `visits.board_placement_location`, `visits.sample_board_match_score`, `visit_individuals.survey_completed`. `issues.company_id` already exists. No new tables.

---

## File Structure

- `migrations/0021_per_company_org.sql` — **new.** Adds link role columns, backfills them, widens `idx_issues_live`.
- `workers-api/src/routes/field-ops/issues.js` — **modify.** `ensureIssues()` index string synced to 4-key; `/issues/mine` returns `company_name`.
- `workers-api/src/routes/field-ops/kpi.js` — **modify.** `dailyRows` widened to boards/surveys/quality (fan-out-safe via a pre-aggregated `visit_individuals` subquery).
- `workers-api/src/services/kpiSignals.js` — **modify.** `aggregateKpis` returns the metric superset; `signalBelowTarget` iterates configured target keys.
- `workers-api/src/services/kpiSignals.test.js` — **modify.** New cases for the superset + config-driven target.
- `workers-api/src/cron/jobs.js` — **modify.** Subject gathering per (user, active company) with link-based org; company-keyed live-issue lookups.
- `frontend/src/components/field-ops/IssueQueue.tsx` — **modify.** Group deficit rows by company; add a tiny pure `groupByCompany` helper.
- `frontend/src/components/field-ops/IssueQueue.groupBy.test.ts` — **new.** Unit test for `groupByCompany`.
- `docs/ops/seed-stellr-kpi.sql` — **new.** Stellr `kpi.agent` + `metrics` seed (ops artifact, run manually at rollout).

---

## Task 1: Migration 0021 + ensureIssues sync

**Files:**
- Create: `migrations/0021_per_company_org.sql`
- Modify: `workers-api/src/routes/field-ops/issues.js:14-29` (`ensureIssues`)

**Interfaces:**
- Produces: link columns `agent_company_links.role/team_lead_id/manager_id`; live-issue unique index `idx_issues_live(tenant_id, subject_id, COALESCE(company_id,''), polarity) WHERE status != 'resolved'`. Tasks 4 and 5 rely on this index existing.

- [ ] **Step 1: Write the migration**

Create `migrations/0021_per_company_org.sql`:

```sql
-- Per-company org: a person can hold a different role/hierarchy in each field_company.
-- NULL link columns fall back to the user's global users.* value in code.
ALTER TABLE agent_company_links ADD COLUMN role TEXT;
ALTER TABLE agent_company_links ADD COLUMN team_lead_id TEXT;
ALTER TABLE agent_company_links ADD COLUMN manager_id TEXT;

-- Backfill each existing link from the user's current global values so behavior is
-- identical until a per-company override is set.
UPDATE agent_company_links
   SET role         = COALESCE(role,         (SELECT u.role         FROM users u WHERE u.id = agent_company_links.agent_id)),
       team_lead_id = COALESCE(team_lead_id, (SELECT u.team_lead_id FROM users u WHERE u.id = agent_company_links.agent_id)),
       manager_id   = COALESCE(manager_id,   (SELECT u.manager_id   FROM users u WHERE u.id = agent_company_links.agent_id));

-- Widen live-issue uniqueness to include company so one subject can hold a live issue
-- per company. COALESCE(company_id,'') keeps tenant-level rows (BO admin, company_id NULL)
-- deduping — a bare NULL is distinct-per-row in a SQLite unique index.
DROP INDEX IF EXISTS idx_issues_live;
CREATE UNIQUE INDEX idx_issues_live
  ON issues(tenant_id, subject_id, COALESCE(company_id,''), polarity) WHERE status != 'resolved';
```

- [ ] **Step 2: Sync `ensureIssues()` to the new index**

In `workers-api/src/routes/field-ops/issues.js`, replace the index line in `ensureIssues` (line 27):

```js
  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_live ON issues(tenant_id, subject_id, COALESCE(company_id,''), polarity) WHERE status != 'resolved'`
  ).run();
```

- [ ] **Step 3: Add the ensureIssues schema-sync assertion**

Append to `workers-api/src/services/kpiSignals.test.js` a standalone check that the source string is in sync (no DB needed):

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('ensureIssues index sync (0021)', () => {
  it('idx_issues_live is keyed on COALESCE(company_id,\'\')', () => {
    const src = readFileSync(fileURLToPath(new URL('../routes/field-ops/issues.js', import.meta.url)), 'utf8');
    expect(src).toContain("COALESCE(company_id,'')");
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd workers-api && npx vitest run src/services/kpiSignals.test.js -t "index sync"`
Expected: PASS.

- [ ] **Step 5: node --check the edited file**

Run: `node --check workers-api/src/routes/field-ops/issues.js && echo OK`
Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add migrations/0021_per_company_org.sql workers-api/src/routes/field-ops/issues.js workers-api/src/services/kpiSignals.test.js
git commit -m "feat(field-ops): migration 0021 per-company org + widen live-issue index

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Rollout note (do NOT run in CI):** After the backend PR is ready, a human applies `0021` to prod D1 and verifies:
> `wrangler d1 execute fieldvibe-db --remote --command "SELECT name FROM pragma_table_info('agent_company_links') WHERE name IN ('role','team_lead_id','manager_id')"` → 3 rows;
> `wrangler d1 execute fieldvibe-db --remote --command "SELECT sql FROM sqlite_master WHERE name='idx_issues_live'"` → contains `COALESCE(company_id,'')`.

---

## Task 2: Widen the metric aggregate to boards/surveys/quality

**Files:**
- Modify: `workers-api/src/services/kpiSignals.js:123-135` (`aggregateKpis`)
- Modify: `workers-api/src/routes/field-ops/kpi.js:39-54` (`dailyRows`)
- Test: `workers-api/src/services/kpiSignals.test.js`

**Interfaces:**
- Consumes: per-day rows from `dailyRows`, now including `boards`, `surveys`, `quality_sum`, `quality_n` alongside the existing `visits`, `signups`, `qualified`.
- Produces: `aggregateKpis(rows)` returns `{ visits_per_day, signups_per_day, conversion_pct, qualified_pct, boards_per_day, surveys_per_day, board_quality, days }`. Task 3 and Task 4 read these keys.

- [ ] **Step 1: Write the failing test**

Append to `workers-api/src/services/kpiSignals.test.js`:

```js
describe('aggregateKpis boards/surveys/quality superset', () => {
  it('averages boards and surveys per day and quality across scored visits', () => {
    const rows = [
      { date: '2026-07-01', visits: 4, signups: 2, qualified: 1, boards: 2, surveys: 3, quality_sum: 1.6, quality_n: 2 },
      { date: '2026-07-02', visits: 6, signups: 3, qualified: 2, boards: 4, surveys: 5, quality_sum: 0.9, quality_n: 1 },
    ];
    const a = aggregateKpis(rows);
    expect(a.boards_per_day).toBeCloseTo(3);          // (2+4)/2
    expect(a.surveys_per_day).toBeCloseTo(4);         // (3+5)/2
    expect(a.board_quality).toBeCloseTo(2.5 / 3);     // (1.6+0.9)/(2+1)
    expect(a.visits_per_day).toBeCloseTo(5);          // existing keys unchanged
  });

  it('board_quality is 0 when no visit carried a match score', () => {
    const rows = [{ date: '2026-07-01', visits: 1, signups: 0, qualified: 0, boards: 0, surveys: 0, quality_sum: 0, quality_n: 0 }];
    expect(aggregateKpis(rows).board_quality).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers-api && npx vitest run src/services/kpiSignals.test.js -t "superset"`
Expected: FAIL — `board_quality` / `boards_per_day` undefined.

- [ ] **Step 3: Widen `aggregateKpis`**

Replace `aggregateKpis` in `workers-api/src/services/kpiSignals.js`:

```js
export function aggregateKpis(rows) {
  const days = rows.length || 0;
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const totV = sum('visits'), totS = sum('signups'), totQ = sum('qualified');
  const qSum = sum('quality_sum'), qN = sum('quality_n');
  return {
    visits_per_day: days ? totV / days : 0,
    signups_per_day: days ? totS / days : 0,
    conversion_pct: safeDiv(totS, totV),
    qualified_pct: safeDiv(totQ, totS),
    boards_per_day: days ? sum('boards') / days : 0,
    surveys_per_day: days ? sum('surveys') / days : 0,
    board_quality: safeDiv(qSum, qN),
    days,
  };
}
```

- [ ] **Step 4: Widen `dailyRows` (fan-out-safe)**

Replace the query in `workers-api/src/routes/field-ops/kpi.js` `dailyRows`. The `visit_individuals` rows are pre-aggregated to one row per visit so v-level board/quality columns are not multiplied by the individual count:

```js
async function dailyRows(db, tenantId, agentIds, sinceDate) {
  const ids = Array.isArray(agentIds) ? agentIds : [agentIds];
  if (!ids.length) return [];
  return (await db.prepare(
    // vi pre-aggregated to one row per visit → the join is 1:1, so v-level board/quality
    // columns aren't fanned out by the individual count. surveys/qualified stay individual-grain
    // (summed/OR-ed inside the subquery). survey_completed lives on visit_individuals.
    `SELECT v.visit_date date,
            COUNT(v.id) visits,
            SUM(CASE WHEN LOWER(v.visit_type)='individual' THEN 1 ELSE 0 END) signups,
            SUM(COALESCE(vi.qualified_flag, 0)) qualified,
            SUM(CASE WHEN v.board_placement_location IS NOT NULL THEN 1 ELSE 0 END) boards,
            SUM(COALESCE(vi.surveys, 0)) surveys,
            SUM(CASE WHEN v.sample_board_match_score IS NOT NULL THEN v.sample_board_match_score ELSE 0 END) quality_sum,
            SUM(CASE WHEN v.sample_board_match_score IS NOT NULL THEN 1 ELSE 0 END) quality_n
     FROM visits v
     LEFT JOIN (
       SELECT visit_id,
              SUM(CASE WHEN survey_completed = 1 THEN 1 ELSE 0 END) surveys,
              MAX(CASE WHEN (JSON_EXTRACT(custom_field_values,'$.converted')=1
                          OR JSON_EXTRACT(custom_field_values,'$.consumer_converted')='Yes')
                       THEN 1 ELSE 0 END) qualified_flag
       FROM visit_individuals GROUP BY visit_id
     ) vi ON vi.visit_id = v.id
     WHERE v.tenant_id=? AND v.agent_id IN (${ids.map(() => '?').join(',')}) AND v.visit_date>=? AND v.status='completed'
     GROUP BY v.visit_date
     ORDER BY v.visit_date`
  ).bind(tenantId, ...ids, sinceDate).all()).results ?? [];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd workers-api && npx vitest run src/services/kpiSignals.test.js`
Expected: PASS (superset cases + all pre-existing cases still green).

- [ ] **Step 6: node --check kpi.js**

Run: `node --check workers-api/src/routes/field-ops/kpi.js && echo OK`
Expected: `OK`.

- [ ] **Step 7: Commit**

```bash
git add workers-api/src/services/kpiSignals.js workers-api/src/routes/field-ops/kpi.js workers-api/src/services/kpiSignals.test.js
git commit -m "feat(field-ops): widen KPI aggregate to boards/surveys/quality

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Config-driven below_target

**Files:**
- Modify: `workers-api/src/services/kpiSignals.js:137-142` (`signalBelowTarget`)
- Test: `workers-api/src/services/kpiSignals.test.js`

**Interfaces:**
- Consumes: `aggregateKpis` output (Task 2) + a `kpi.<role>` thresholds object.
- Produces: `signalBelowTarget(actual, th)` → `{ triggered, metrics }` where `metrics` is the subset of TARGET_KEYS the company configured **and** is under. Existing `below_target` signal detail shape (`{ metrics: [...] }`) is unchanged, so `SIGNAL_REGISTRY.below_target.buildText` and the frontend mirror keep working.

- [ ] **Step 1: Write the failing test**

Append to `workers-api/src/services/kpiSignals.test.js`:

```js
describe('signalBelowTarget config-driven', () => {
  const actual = {
    visits_per_day: 3, signups_per_day: 1, boards_per_day: 2, surveys_per_day: 1, board_quality: 0.5,
  };
  it('Goldrush config flags only its configured sign-up/visit metrics', () => {
    const r = signalBelowTarget(actual, { visits_per_day: 5, signups_per_day: 4 });
    expect(r.triggered).toBe(true);
    expect(r.metrics.sort()).toEqual(['signups_per_day', 'visits_per_day']);
  });
  it('Stellr config flags boards/surveys/quality, never sign-ups it does not configure', () => {
    const r = signalBelowTarget(actual, { boards_per_day: 4, surveys_per_day: 3, board_quality: 0.7, visits_per_day: 2 });
    expect(r.metrics.sort()).toEqual(['board_quality', 'boards_per_day', 'surveys_per_day']);
    expect(r.metrics).not.toContain('signups_per_day'); // Stellr doesn't do sign-ups
  });
  it('nothing configured under target → not triggered', () => {
    expect(signalBelowTarget(actual, { visits_per_day: 1, boards_per_day: 1 }).triggered).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers-api && npx vitest run src/services/kpiSignals.test.js -t "config-driven"`
Expected: FAIL — old `signalBelowTarget` only inspects `visits_per_day`/`signups_per_day`.

- [ ] **Step 3: Make `signalBelowTarget` iterate configured target keys**

Replace `signalBelowTarget` in `workers-api/src/services/kpiSignals.js`:

```js
// The metric keys below_target can flag. A metric fires only when the company's
// kpi.<role> config sets a threshold for it AND actual is under it, so Goldrush
// (sign-ups/visits) and Stellr (boards/surveys/quality/coverage) share one code path
// and differ only by config. conversion has its own signal (low_conversion), not here.
const TARGET_KEYS = ['visits_per_day', 'signups_per_day', 'boards_per_day', 'surveys_per_day', 'board_quality'];

export function signalBelowTarget(actual, th) {
  const metrics = TARGET_KEYS.filter(
    (k) => th[k] != null && actual[k] != null && actual[k] < th[k]
  );
  return { triggered: metrics.length > 0, metrics };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd workers-api && npx vitest run src/services/kpiSignals.test.js`
Expected: PASS (config-driven cases + all prior cases; the existing min_days test uses `visits_per_day`/`signups_per_day` thresholds, still covered).

- [ ] **Step 5: Commit**

```bash
git add workers-api/src/services/kpiSignals.js workers-api/src/services/kpiSignals.test.js
git commit -m "feat(field-ops): config-driven below_target across company metrics

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Cron per-(agent, company) with link-based org

**Files:**
- Modify: `workers-api/src/cron/jobs.js:341-365` (subject gathering) and `:495-497`, `:584-586` (live-issue lookups)

**Interfaces:**
- Consumes: `agent_company_links.role/team_lead_id/manager_id` (Task 1); company-scoped `getConfig`, `computeIncentive`, `gmFor` (unchanged).
- Produces: one loop iteration per (subject, active company); one live issue per (subject, company, polarity). No new exported symbols.

- [ ] **Step 1: Replace the subject-gathering query with a per-company link join**

In `workers-api/src/cron/jobs.js`, replace the `agents` query (lines ~353-365). The comment at 351 ("belongs to exactly one customer") is now wrong — replace it too:

```js
        // A field subject is scoped per active company via agent_company_links, which now
        // carries a per-company role/team_lead_id/manager_id (0021). One row per (user,
        // active company): a multi-company person (Lucky: manager in Goldrush, team_lead in
        // Stellr) is evaluated once per company with that company's role/owner/config.
        // NULL link columns fall back to the user's global users.* value. BO admin is a
        // shared tenant-level service — it never joins a company link (company_id stays NULL).
        const leadSince = new Date(nowMs - 180 * 86400000).toISOString().slice(0, 10);
        const agents = (await db.prepare(
          `SELECT u.id, u.first_name, u.last_name,
                  COALESCE(l.role, u.role) role,
                  COALESCE(l.team_lead_id, u.team_lead_id) team_lead_id,
                  COALESCE(l.manager_id, u.manager_id) manager_id,
                  l.company_id company_id
           FROM users u
           LEFT JOIN agent_company_links l
             ON l.agent_id = u.id AND l.is_active = 1 AND u.role != 'backoffice_admin'
           WHERE u.tenant_id = ? AND u.is_active = 1
             AND ( (u.role IN ('agent','field_agent','sales_rep')
                    AND (u.agent_type IS NULL OR u.agent_type IN ('field_ops','both')))
                OR (u.role IN ('team_lead','manager')
                    AND EXISTS (SELECT 1 FROM visits v
                                WHERE v.agent_id = u.id AND v.tenant_id = u.tenant_id AND v.visit_date >= ?))
                OR u.role = 'backoffice_admin' )`
        ).bind(tenantId, leadSince).all()).results || [];
```

Notes for the implementer:
- The WHERE role gate still uses the **global** `u.role` (Lucky's global `manager` keeps him in the `team_lead`/`manager` branch); the **effective** per-company `role` alias then drives `AGENT_SUBJECT`/`defaultOwner` inside the loop, which already read `agent.role`/`agent.team_lead_id`/`agent.manager_id`. No further loop-body change is needed for org resolution — the aliases feed the existing code.
- An agent with two active links yields two rows → evaluated per company. An agent with no active link yields one row with `company_id` NULL → tenant-default config, same as before.
- `u.role != 'backoffice_admin'` on the JOIN guarantees a BO admin never fans out even if a stray link exists.

- [ ] **Step 2: Company-key the deficit live-issue lookup**

Replace the deficit lookup (line ~495-497):

```js
            const live = await db.prepare(
              "SELECT * FROM issues WHERE tenant_id = ? AND subject_id = ? AND COALESCE(company_id,'') = COALESCE(?,'') AND polarity = 'deficit' AND status != 'resolved'"
            ).bind(tenantId, agent.id, agent.company_id || null).first();
```

- [ ] **Step 3: Company-key the recognition live-issue lookup**

Replace the recognition lookup (line ~584-586):

```js
              const rLive = await db.prepare(
                "SELECT * FROM issues WHERE tenant_id = ? AND subject_id = ? AND COALESCE(company_id,'') = COALESCE(?,'') AND polarity = 'recognition' AND status != 'resolved'"
              ).bind(tenantId, agent.id, agent.company_id || null).first();
```

(The INSERTs at ~522 and ~593 already bind `agent.company_id`; the mid-issue re-home UPDATE at ~533 is now a no-op since we look up by company, harmless — leave it.)

- [ ] **Step 4: Assert the company-scoping is present (source check)**

Append to `workers-api/src/services/kpiSignals.test.js` (co-located suite; no DB needed):

```js
describe('cron company-scoped issue lookup (0021)', () => {
  it('reactToIssues keys live-issue lookups on company', () => {
    const src = readFileSync(fileURLToPath(new URL('../cron/jobs.js', import.meta.url)), 'utf8');
    const matches = src.match(/COALESCE\(company_id,''\) = COALESCE\(\?,''\)/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2); // deficit + recognition
    expect(src).toContain("LEFT JOIN agent_company_links l"); // per-company subject fan-out
  });
});
```

- [ ] **Step 5: Run test + node --check**

Run: `cd workers-api && npx vitest run src/services/kpiSignals.test.js -t "company-scoped" && node --check src/cron/jobs.js && echo OK`
Expected: PASS then `OK`.

- [ ] **Step 6: Commit**

```bash
git add workers-api/src/cron/jobs.js workers-api/src/services/kpiSignals.test.js
git commit -m "feat(field-ops): evaluate issues per (subject, company) with link-based org

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Frontend — group issues by company

**Files:**
- Modify: `workers-api/src/routes/field-ops/issues.js:260-264` (`/issues/mine` returns `company_name`)
- Modify: `frontend/src/components/field-ops/IssueQueue.tsx`
- Create: `frontend/src/components/field-ops/IssueQueue.groupBy.test.ts`

**Interfaces:**
- Consumes: `Issue.company_name` (already on the type; now also returned by `/issues/mine`).
- Produces: `groupByCompany(issues)` → `Array<{ company: string; items: Issue[] }>`, ordered by first appearance, used to render one sub-list per company.

- [ ] **Step 1: Add `company_name` to `/issues/mine`**

In `workers-api/src/routes/field-ops/issues.js`, update the `/issues/mine` SELECT (line ~261):

```js
  const { results } = await db.prepare(
    `SELECT i.*, ${nameCol} subject_name,
            (SELECT name FROM field_companies WHERE id = i.company_id) company_name
     FROM issues i
     WHERE i.tenant_id = ? AND i.owner_id = ? AND i.status != 'resolved'
     ORDER BY (i.status='acted') ASC, i.severity DESC, i.owner_since ASC`
  ).bind(tenantId, userId).all();
```

- [ ] **Step 2: Write the failing test for `groupByCompany`**

Create `frontend/src/components/field-ops/IssueQueue.groupBy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupByCompany } from './IssueQueue'

describe('groupByCompany', () => {
  it('groups rows by company_name preserving first-seen order, nulls under "Unassigned"', () => {
    const rows: any[] = [
      { id: '1', company_name: 'Goldrush' },
      { id: '2', company_name: 'Stellr' },
      { id: '3', company_name: 'Goldrush' },
      { id: '4', company_name: null },
    ]
    const g = groupByCompany(rows)
    expect(g.map((x) => x.company)).toEqual(['Goldrush', 'Stellr', 'Unassigned'])
    expect(g[0].items.map((i) => i.id)).toEqual(['1', '3'])
  })

  it('single-company list returns one group', () => {
    expect(groupByCompany([{ id: '1', company_name: 'Stellr' }] as any)).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/field-ops/IssueQueue.groupBy.test.ts`
Expected: FAIL — `groupByCompany` is not exported.

- [ ] **Step 4: Add and export `groupByCompany`, render grouped**

In `frontend/src/components/field-ops/IssueQueue.tsx`, add the helper near the top-level (after the `Issue` type):

```tsx
export function groupByCompany(items: Issue[]): { company: string; items: Issue[] }[] {
  const order: string[] = []
  const byCompany = new Map<string, Issue[]>()
  for (const i of items) {
    const key = i.company_name || 'Unassigned'
    if (!byCompany.has(key)) { byCompany.set(key, []); order.push(key) }
    byCompany.get(key)!.push(i)
  }
  return order.map((company) => ({ company, items: byCompany.get(company)! }))
}
```

Then in **both** `MyIssues` and `UnmanagedIssues`, replace the flat deficit list render with a per-company grouped render. For `MyIssues` replace the deficit `<ul>` (around line 159):

```tsx
          {groupByCompany(deficit).map((g) => (
            <div key={g.company}>
              <p className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{g.company}</p>
              <ul className={s.divide}>{g.items.map(renderIssue)}</ul>
            </div>
          ))}
```

Apply the same substitution to the `UnmanagedIssues` deficit `<ul>` (around line 216). Leave the highlights (recognition) lists flat — recognition is a lighter surface and grouping there adds noise. `ponytail: recognition stays flat; group it too only if a multi-company highlight pile-up actually confuses anyone.`

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/field-ops/IssueQueue.groupBy.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + node --check backend**

Run: `cd frontend && npx tsc --noEmit` then `node --check ../workers-api/src/routes/field-ops/issues.js && echo OK`
Expected: no TS errors, then `OK`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/field-ops/IssueQueue.tsx frontend/src/components/field-ops/IssueQueue.groupBy.test.ts workers-api/src/routes/field-ops/issues.js
git commit -m "feat(field-ops): group issue queue by company; return company_name on /issues/mine

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Stellr config seed (ops artifact)

**Files:**
- Create: `docs/ops/seed-stellr-kpi.sql`

**Interfaces:** none (data seeded manually at rollout; Stellr signals stay dormant until this runs — the staged-rollout lever).

- [ ] **Step 1: Confirm the config storage shape**

Run: `grep -rn "getConfig\|project_config\|INSERT.*config" workers-api/src/routes/field-ops/config.js | head`
Expected: reveals the table name and column layout (`tenant_id`, `company_id`, config key, JSON `value`). **Match the existing `POST /field-ops/config/seed-defaults` INSERT pattern exactly** — same table, same id scheme, same `INSERT OR IGNORE`.

- [ ] **Step 2: Write the seed using that exact pattern**

Create `docs/ops/seed-stellr-kpi.sql`. Fill the table/column names and id scheme from Step 1; values below are the Stellr thresholds (tune with the operator). `<STELLR>` = `5b129b5b-92b1-43c2-8523-caa221179d33`, `<TENANT>` = `default-tenant-001`:

```sql
-- Stellr agents do boards + surveys, not sign-ups. kpi.agent thresholds drive below_target
-- via the config-driven signalBelowTarget (Task 3). board_quality is the match-score floor.
-- Adjust the numbers with the Stellr operator before running.
-- (Column/id layout copied from config.js seed-defaults — see Step 1.)
INSERT OR IGNORE INTO <config_table> (id, tenant_id, company_id, <key_col>, <value_col>)
VALUES ('pc-stellr-kpi.agent', 'default-tenant-001', '5b129b5b-92b1-43c2-8523-caa221179d33', 'kpi.agent',
  json('{"boards_per_day":3,"surveys_per_day":4,"board_quality":0.7,"visits_per_day":5,"min_days":3,"baseline_window_days":14,"drop_pct":30,"quiet_days":3,"conversion_floor_pct":0}'));

-- metrics registry: which metrics are gate/visible for Stellr agents (drives incentive gate
-- + /kpi/self). visibility:'all' = agent-facing. Mirror the shape config.js already stores.
INSERT OR IGNORE INTO <config_table> (id, tenant_id, company_id, <key_col>, <value_col>)
VALUES ('pc-stellr-metrics', 'default-tenant-001', '5b129b5b-92b1-43c2-8523-caa221179d33', 'metrics',
  json('[{"key":"boards_per_day","label":"Boards / day","gate":true,"visibility":"all"},
         {"key":"surveys_per_day","label":"Surveys / day","gate":true,"visibility":"all"},
         {"key":"board_quality","label":"Board match score","gate":false,"visibility":"all"},
         {"key":"visits_per_day","label":"Visit coverage","gate":false,"visibility":"all"}]'));
```

- [ ] **Step 3: Commit**

```bash
git add docs/ops/seed-stellr-kpi.sql
git commit -m "docs(ops): Stellr kpi.agent + metrics seed for per-company rollout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Rollout note (do NOT run in CI):** Apply `docs/ops/seed-stellr-kpi.sql` to prod D1 (fill placeholders from Step 1) **only after** backend + frontend are deployed, then watch 1-2 cron ticks and confirm Goldrush is unaffected.

---

## Rollout sequencing (human-run, no staging)

1. Land Tasks 1-4 (backend) + Task 6 (seed file) on the feature branch. Run full `cd workers-api && npm test`.
2. **Apply migration 0021 to prod D1 and verify** (Task 1 rollout note) — before merging anything that references the new columns/index.
3. Run the migration's backfill (in-file), then the targeted per-company override for Lucky's Stellr link:
   `UPDATE agent_company_links SET role='team_lead' WHERE agent_id='ef70738c-eccc-4635-9234-1a964a4e5bf6' AND company_id='5b129b5b-92b1-43c2-8523-caa221179d33';`
   (Confirm the Stellr link exists first; Lucky stays his own team_lead there and keeps `role='manager'` on Goldrush.)
4. Merge the **backend** PR (Tasks 1-4). Wait for the deploy to go green.
5. Merge the **frontend** PR (Task 5).
6. Apply `docs/ops/seed-stellr-kpi.sql` for Stellr; watch 1-2 cron ticks via `GET /field-ops/issues/unmanaged` + Cloudflare cron logs; confirm Goldrush counts unchanged.

## Rollback

Migration is additive (nullable columns + an index swap). If the cron misbehaves: `git revert` the backend PR to `main`. Bad rows from ≤1 tick: `DELETE FROM issues WHERE company_id = ? AND opened_at >= ?` (targeted, not blanket). The wider `idx_issues_live` is a strict superset of the old constraint — no down-migration needed.

## Self-Review

- **Spec coverage:** §1 data model → Task 1; §2 metric layer → Tasks 2-3; §3 org resolution → Task 4 (link aliases feed existing `defaultOwner`/`AGENT_SUBJECT`); §4 cron loop → Task 4; §5 frontend → Task 5; §6 config seeding → Task 6; §7 rollout → Rollout section; §8 rollback → Rollback; §9 testing → per-task Vitest + source-sync assertions. All covered.
- **Placeholders:** the only intentional placeholders are the config table/column names in Task 6, resolved by its Step 1 grep before writing — flagged, not left vague.
- **Type consistency:** `aggregateKpis` keys (`boards_per_day`/`surveys_per_day`/`board_quality`) match `TARGET_KEYS` in Task 3 and the seed keys in Task 6; `groupByCompany` signature matches its test and both call sites; `dailyRows` output columns (`boards`/`surveys`/`quality_sum`/`quality_n`) match what `aggregateKpis` sums.
