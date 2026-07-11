# Field-Ops Insights & Actions — Credible, Role-Wide Redesign

## Problem

The field-ops issue/KPI-signal system flags underperformance but the signals and actions available today have four gaps:

1. `below_gate` has no shared display text — every surface except the agent's own `PerformanceCard` shows a generic "Underperformance signal" instead of the real reason.
2. Root-cause signals (`late_start`, `short_field_day`, `idle_gaps`, `excess_travel`) have no dedicated remediation — only generic note/nudge.
3. Agents can almost never act on their own issues (only owners act; agents rarely own).
4. `backoffice_admin` has no KPI threshold config (`kpi.backoffice_admin` doesn't exist) — only call-center stats, no accountability signals.

Beyond closing these gaps, the system should surface more signal patterns (trend direction, peer comparison, predictive risk) and recognize good performance, not just flag bad — so supervisors have something to reinforce, not only fix.

## Decisions (locked)

1. **Scope**: all four gaps above, in scope.
2. **New signal patterns**: add net-new types (trend, peer comparison, predictive risk), not limited to the current 6.
3. **Recognition signals**: add positive signals (improving trend, top-of-team, hit-gate-early).
4. **New action types**: beyond note/nudge — check-in, resource assignment, tier-review flag, recognition, tailored per signal/role.
5. **Agent self-action**: agents get a self-acknowledge + commit-to-fix action — non-resolving, visible to owner, adds accountability trail.
6. **BO admin KPIs**: add `kpi.backoffice_admin` signal set (response time, reconciliation turnaround, stale-queue age) via the existing `evaluateSignals` machinery.

## Architecture

### Data model

`issues` table gains one column: `polarity` (`'deficit'` | `'recognition'`), migration default `'deficit'` — existing rows need no backfill, behavior unchanged for them.

`issueEngine.js`'s SLA/escalation ladder (owner assignment, breach detection, escalation-on-breach) runs only for `polarity = 'deficit'`. Recognition rows carry no `owner_since`/breach semantics — just `opened_at` and status `open`/`acted` (acted = someone sent recognition for it).

### Signal registry (single source of truth)

New `SIGNAL_REGISTRY` object in `kpiSignals.js`, one entry per signal type (old 6 + new):

```
{ type, polarity, label, severityWeight, buildText(signal, ctx), actions: { [role]: [actionType, ...] } }
```

Both backend (issue `detail` rendering, notification text) and frontend (`IssueQueue.tsx`, every dashboard) read this registry instead of each hand-rolling display text. This is the direct fix for the `below_gate` bug — one source, every surface consistent.

### Action dispatch (generalized)

Collapse `remediate/note`, `remediate/nudge`, and `issues/:id/act` into one endpoint: `POST /issues/:id/action` with body `{ type, ...payload }`, dispatched through `ACTION_REGISTRY` (type → handler + allowed roles + allowed signal kinds).

Action types:
- `note` — coaching note (existing behavior)
- `nudge` — notification + push (existing behavior)
- `checkin` — note + `follow_up_date` field
- `resource` — note + `resource_link` tag
- `tier_flag` — escalates directly to admin/general_manager, bypassing normal owner chain (incentive-tier review, no automatic tier change — visibility only)
- `recognition` — kudos note + push, no SLA interaction, valid only on `polarity='recognition'` issues
- `commit` — agent-authored, own issue only, visible to owner, does not change issue status
- `acknowledge` / `resolve` — existing behavior, owner-only, deficit-only

### New signal types

- **Trend (generalized)**: one comparator, `signalTrend(recent, prior, metric, thresholds)`, replaces the need for separate improving/declining implementations. Slope down past `drop_pct` → `declining_trend` (deficit). Slope up past `improve_pct` → `improving_trend` (recognition).
- **Peer comparison**: reuses existing `rankRoster` (already ranks direct reports worst-first — no new ranking logic). Bottom quartile on primary gate metric → `team_bottom` (deficit, low weight, context signal not standalone crisis). Top of team → `team_top` (recognition). Computed only for roles with a roster (team_lead/manager).
- **Predictive risk**: `at_risk_gate` — pace-to-incentive-tier trending down two consecutive periods, not yet `below_gate`. Reuses `incentiveService` pace calc that already backs `below_gate`; checks trend direction instead of absolute shortfall. Deficit, low weight, early-warning only.
- **Recognition twin**: `hit_gate_early` — ahead of pace on incentive tier. Mirrors `below_gate`'s incentiveService call, positive branch.
- **BO admin signals**: new `kpi.backoffice_admin` threshold key (`response_mins`, `recon_hours`, `stale_queue_hours`). Three signals — `slow_response`, `recon_backlog`, `stale_queue` — evaluated through the existing `evaluateSignals` machinery, sourced by extending the query already backing `GET /issues/stats` (no new tables).

### Data flow

`evaluateSignals()` returns registry-tagged signals (polarity included) → `reactToIssues` cron branches persistence by polarity (SLA clock for deficit, plain open/acted for recognition) → `GET /issues/mine` returns both polarities, frontend groups into "Issues" vs "Highlights" sections using the same list component (`IssueQueue.tsx`), each row rendered via the shared registry.

## Error handling

- Unknown signal type at registry lookup → warn log, skip that signal only — one bad type must not crash the whole evaluation pass.
- Action request outside allowed roles/signal-kinds for its type → 403 with explicit reason (e.g., "only owner can resolve", "commit only allowed on own issue").
- Cron's breach-scan query adds `WHERE polarity = 'deficit'` — a one-line guard rather than a branch threaded through the ladder function.
- Migration backfill is the column default (`ADD COLUMN polarity ... DEFAULT 'deficit'`) — no separate backfill script.

## Testing

- `kpiSignals.test.js`: new cases per signal type — trend both directions, `team_bottom`/`team_top` off a fixture roster, `at_risk_gate`/`hit_gate_early` off an incentiveService pace stub, BO admin thresholds (`slow_response`/`recon_backlog`/`stale_queue`); empty-window guard (`days=0`) confirmed to suppress new signals same as existing ones.
- `issueEngine.test.js`: new case — recognition-polarity issue never breaches/escalates regardless of age.
- Route test for `POST /issues/:id/action`: table-driven over action type × role × signal-kind, allowed and disallowed combinations.
- Frontend: regression test asserting `below_gate` renders real text via the shared registry import (the bug that motivated gap #1).
