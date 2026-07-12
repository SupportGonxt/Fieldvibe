# Per-Company Field-Ops — Design

## Context

Goldrush (code `GR`) and Stellr (id `5b129b5b-92b1-43c2-8523-caa221179d33`, code `STELLR`) are two `field_companies` under one tenant (`default-tenant-001`). The insights/signals/issues engine currently treats a person's **role, org hierarchy, and KPIs as global per user/tenant** — so the two companies get conflated:

- **Org mixup:** Lucky Mahlaba is a Field Sales Manager in Goldrush, but in Stellr he is FSM **and** a team lead. `users` holds a single global `role`/`manager_id`/`team_lead_id`, which cannot express "different role in each company."
- **KPI mixup:** Goldrush agents drive sign-ups/visits/conversion. Stellr agents only do **boards and surveys** — their insights/KPIs must be based on that, not on sign-up metrics. Today `aggregateKpis`/`signalBelowTarget` are hardcoded to `visits_per_day`/`signups_per_day`.
- **Issue mixup:** The cron pins each agent to **one** company (`... agent_company_links ... LIMIT 1`), so a multi-company person like Lucky only ever gets evaluated/flagged for one company. The live-issue uniqueness index (`tenant_id, subject_id, polarity`) has no company dimension, so a second company's issue for the same subject would collide with the first.

**The BO (back-office) admin is a shared service across all companies** — tenant-level, not per-company. It stays as-is.

The config layer is **already per-company**: `getConfig(db, tenantId, companyId, 'metrics')` and the `kpi.<role>` thresholds resolve by `companyId` today. The gaps are in the org model, the metric aggregation, the issue key, and the cron loop — not the config plumbing.

## Goals

1. A person can hold a different role / team-lead / manager **per company** (`agent_company_links`).
2. Insights/KPIs/signals are driven by each company's configured metrics — Stellr on boards/surveys/quality/coverage, Goldrush unchanged.
3. A multi-company subject is evaluated **per active company**, producing **one issue per (subject, company, polarity)**, grouped by company on screen.
4. BO admin unchanged (tenant-level, shared).

Non-goals: no change to the tenant model (both companies stay under one tenant), no change to incentive/gate mechanics beyond feeding them per-company metrics, no BO-admin behavior change.

## Approach (approved)

**A1 (config-driven generic metrics) + B (extend `agent_company_links` for per-company roles).** Chosen over A2 (a second hardcoded Stellr metric path) because the config registry is already per-company — generalizing the aggregate + `evaluateSignals` to iterate configured metric keys means Stellr, Goldrush, and any future company differ only by data, not code. Chosen over a separate `company_memberships` table because `agent_company_links` already models agent↔company and already carries `tenant_id`/`company_id`/`is_active`; adding role columns to it is the smaller diff.

## 1. Data model — migration `0021_per_company_org.sql`

```sql
-- per-company org role/hierarchy; NULL falls back to the user's global value
ALTER TABLE agent_company_links ADD COLUMN role TEXT;
ALTER TABLE agent_company_links ADD COLUMN team_lead_id TEXT;
ALTER TABLE agent_company_links ADD COLUMN manager_id TEXT;

-- backfill each existing link from the user's current global values
UPDATE agent_company_links
   SET role         = COALESCE(role,         (SELECT u.role         FROM users u WHERE u.id = agent_company_links.agent_id)),
       team_lead_id = COALESCE(team_lead_id, (SELECT u.team_lead_id FROM users u WHERE u.id = agent_company_links.agent_id)),
       manager_id   = COALESCE(manager_id,   (SELECT u.manager_id   FROM users u WHERE u.id = agent_company_links.agent_id));

-- widen live-issue uniqueness to include company. COALESCE(company_id,'') so tenant-level
-- rows (BO admin, company_id NULL) still dedupe — a bare NULL is distinct-per-row in a
-- SQLite unique index and would let duplicates pile up.
DROP INDEX IF EXISTS idx_issues_live;
CREATE UNIQUE INDEX idx_issues_live
  ON issues(tenant_id, subject_id, COALESCE(company_id,''), polarity) WHERE status != 'resolved';
```

- Lucky's Stellr link is then set to `role='team_lead'` (and he stays his own team lead there); his Goldrush link stays `role='manager'`. Any per-company divergence from the global default is a targeted `UPDATE agent_company_links` after backfill — an ops step, not code.
- `issues.company_id` already exists (persisted/refreshed by cron) — no column add.
- `ensureIssues()` in `issues.js` is updated in the **same commit** to mirror the 4-key expression index, so a fresh/local D1 that runs code before migrations gets the same shape.

## 2. Metric layer — A1, config-driven (`kpiSignals.js` + `kpi.js`)

**`dailyRows` widens** to also return, per day, from the existing visit tables:
- `boards` — visits with a board placed: `COUNT(DISTINCT CASE WHEN v.board_placement_location IS NOT NULL THEN v.id END)`.
- `surveys` — completed surveys: `SUM(CASE WHEN vi.survey_completed = 1 THEN 1 ELSE 0 END)` (survey_completed is on `visit_individuals`, so it sums correctly across the existing LEFT JOIN fan-out).
- `board_quality` inputs — `AVG` of `v.sample_board_match_score` per visit. Because the `visit_individuals` join fans v-level rows out, board/match_score use `COUNT(DISTINCT v.id)` / a per-visit-deduped average, not raw `SUM/AVG` over joined rows.

All columns already exist (`board_placement_location`, `sample_board_match_score` on `visits`; `survey_completed` on `visit_individuals`). No new tables.

**`aggregateKpis` returns the superset:** `visits_per_day, signups_per_day, conversion_pct, qualified_pct, boards_per_day, surveys_per_day, board_quality`. Extra keys cost nothing for a company that doesn't use them — the thresholds decide what's evaluated.

**`evaluateSignals` / `signalBelowTarget` stop hardcoding metric keys.** They iterate the company's `kpi.<role>` threshold keys, using per-metric direction:
- *At-least* metrics (`visits_per_day`, `signups_per_day`, `boards_per_day`, `surveys_per_day`) fire `below_target` when `actual < threshold`.
- *Floor* metrics (`conversion_floor_pct`, `board_quality_floor`) fire when below the floor.

Direction is derived from a small in-code descriptor keyed by metric name (no new config shape) — the same de-slug/label machinery already added in `metricLabel()` handles display. Goldrush's `kpi.agent` lists sign-up/visit/conversion thresholds; Stellr's lists board/survey/quality/visit thresholds. Trend (`signalTrend`), peer (`peerSignals`), and gate (`signalAtRiskGate`/`signalHitGateEarly`) signals are already metric-name-generic — they just get fed the company's metric set. `min_days` (M-1) gating and the empty-window guard are unchanged.

## 3. Org resolution — B (`jobs.js`)

- **Subject gathering** joins `agent_company_links` to produce **one row per (user, active company)**, carrying that link's `role`/`team_lead_id`/`manager_id`/`company_id`, each `COALESCE`d to the user's global value when the link column is null.
- The `AGENT_SUBJECT` role check and `defaultOwner()` read the **link's** role/lead/manager, not the global `users` row. Lucky is evaluated as `manager` on his Goldrush row and `team_lead` on his Stellr row, owning/escalating per company.
- GM-per-company resolution already works via `manager_company_links` (`gmFor(company_id)`) — unchanged.
- BO-admin subjects are tenant-level (no company link) — they keep `company_id` NULL and evaluate once per tenant, exactly as today.

## 4. Cron loop (`jobs.js reactToIssues`)

- The per-agent loop becomes **per (agent, company)** — the widened subject query already yields one row each, so the existing loop body runs once per company row with no new nesting.
- Thresholds/metrics resolve via `getConfig(..., companyId, ...)` (already company-scoped).
- Live-issue lookup and insert key on `company_id` too: `WHERE tenant_id=? AND subject_id=? AND company_id IS ? AND polarity=? AND status != 'resolved'`. Deficit/recognition split, escalation, and M-1 min_days gating are otherwise unchanged.
- Per-tenant and per-row try/catch stay (blast-radius containment). Signal text still routes through `signalLabel()`/`metricLabel()` (friendliness pass).

## 5. Frontend (`IssueQueue.tsx`, GM views)

- Issue rows **group by company** — join `field_companies` for the display name; `company_id` is already in the issues API shape. Same row/`signalRegistry` rendering, grouped under a company heading. No new component, no new endpoint.
- Where a subject spans companies (Lucky), the two issues render under their respective company groups — "separate it by company on the screen," as specified.

## 6. Config seeding (ops — the de-facto rollout gate)

- Seed Stellr's `kpi.agent` thresholds (boards/day, surveys/day, board-quality floor, visits/day coverage) and Stellr-scoped `metrics` registry rows, scoped to the Stellr `company_id`. Goldrush config untouched.
- Stellr signals only activate once its config is seeded — this is the staged-rollout lever (no staging environment exists; config-not-seeded = no-op, same pattern as the BO-admin rollout).

## 7. Rollout sequencing (no staging — CI deploys straight to `main`)

1. **Manually apply** migration `0021` against production D1. **Verify** via `SELECT ... FROM pragma_table_info('agent_company_links')` and confirm `idx_issues_live` is the 4-key expression index — never trust `wrangler d1 migrations list` bookkeeping.
2. Run the per-company org backfill `UPDATE`s (in the migration), then the targeted `UPDATE agent_company_links` for any per-company role divergence (Lucky's Stellr `team_lead`).
3. Merge the **backend** PR (widened `dailyRows`/`aggregateKpis`, config-driven `evaluateSignals`, link-based org resolution, per-(agent,company) cron, company-keyed issue lookup/insert, `ensureIssues` index sync). Additive — an unseeded company still resolves to today's behavior. Wait for the backend deploy to go green before the frontend.
4. Merge the **frontend** PR (group issues by company).
5. Seed Stellr `kpi.agent` + `metrics` for the pilot; watch 1–2 cron ticks (`GET /field-ops/issues/unmanaged` + Cloudflare cron logs); then confirm Goldrush is unaffected.

## 8. Rollback

Migration is additive (nullable columns + an index swap) — safe to leave after any revert. If the cron misbehaves: `git revert` the backend PR straight to `main` (fastest path on this direct-to-main pipeline). If bad rows were inserted before the revert lands (≤1 cron tick), clean up with a targeted `DELETE FROM issues WHERE company_id = ? AND opened_at >= ?` — not a blanket delete. The old single-key `idx_issues_live` can be restored by re-running its `CREATE` if ever needed, but the wider index is a strict superset of the old constraint.

## 9. Testing

- `aggregateKpis`: boards/surveys/board_quality computed correctly, including the `visit_individuals` fan-out (a visit with N individuals counts one board, N surveys).
- `evaluateSignals` config-driven: at-least vs floor direction; Stellr metric set fires `below_target` on boards/surveys/quality and never on sign-ups; Goldrush unchanged.
- Per-company issue keying: one multi-company subject yields two live rows (one per company, same polarity) without a uniqueness collision; `ensureIssues` CREATE-string contains the 4-key `COALESCE(company_id,'')` index.
- Link-based owner resolution: `defaultOwner()` picks the link's team_lead/manager, falling back to the global value when the link column is null.
- BO-admin path: still evaluates once per tenant with `company_id` NULL, no collision, no regression.
- Run `npm test` in `workers-api/` before merging (CI's test job is `continue-on-error`; the suite is a human pre-merge gate).

## Critical files

- `migrations/0021_per_company_org.sql` — new
- `workers-api/src/services/kpiSignals.js` — widened `aggregateKpis`, config-driven `evaluateSignals`/`signalBelowTarget`
- `workers-api/src/routes/field-ops/kpi.js` — widened `dailyRows`
- `workers-api/src/routes/field-ops/issues.js` — `ensureIssues` index sync
- `workers-api/src/cron/jobs.js` — per-(agent,company) subject gathering, link-based org resolution, company-keyed issue lookup/insert
- `frontend/src/components/field-ops/IssueQueue.tsx` (+ GM views) — group issues by company
