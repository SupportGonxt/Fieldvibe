# FieldVibe Performance OS — Design Spec (v4)

Date: 2026-07-13
Status: awaiting user review
Scope: **Field Operations module first**, end-to-end across all four surfaces — field PWA (`/agent`), backoffice portal field-ops screens, field-ops reporting, and the company (customer) portal — plus the global trust foundation (access SSOT, financial hardening) everything sits on. Other modules (sales, inventory, van-sales, marketing) follow the same blueprint in later waves.

## 1. Problem

Field teams miss ~95% of field-ops targets. Eight parallel audits (2026-07-13) found the system *records* field work but nothing *drives* it, and the numbers it records cannot be fully trusted:

1. **Feedback latency kills behavior.** The funnel is signup (provisional, instant) → verified/qualified (only when backoffice_admin manually pastes Goldrush confirmations into `/field-ops/incentives/reconcile`) → deposit (only when backoffice_admin manually uploads into `/field-ops/deposits`). Agents are managed on raw signup volume; the truth (verified, deposited) arrives days later, long after the behavior that produced it.
2. **A 95% miss has unknown etiology — and the system can't diagnose it.** A miss that large is structural: fantasy targets, short effective field days, a verify pipeline eating most signups, truth lag, or fabricated signups. Today nobody can tell which, so nobody knows which lever to pull.
3. **No single source of truth for access.** Role→module visibility duplicated across ≥6 disagreeing places (navigation.ts, Sidebar, MegaMenu, MobileBottomTabs, MoreMenuPage, backend guards). Frontend `hasRole()` treats `backoffice_admin`/`general_manager` as admin-equivalent; backend `requireRole()` does not. MoreMenuPage has 8 dead links.
4. **Financial data leaks.** No-auth endpoints: `GET /payment-ledger`, `/reports/sales-dashboard`, `/reports/agent-performance`, `/reports/stock-valuation`, `/reports/van-sales`, `/anomaly-flags`, `/insights/commissions`, `/kpi/self`, `/kpi/roster`. Auth-but-no-role-guard: `/finance/*` (incl. create/update/DELETE), `/commissions/stats`, `/commissions/user/:userId`, `/analytics/revenue`, `/cash-reconciliations/:id/approve`, `/incentives/hero`, `/incentives/me`. All `/field-ops/reports/*` endpoints are `authMiddleware` only — any authenticated role can pull consumer PII rows.
5. **Numbers disagree with themselves.** "Converted" defined ≥3 different ways (`converted=1`, `consumer_converted='Yes'` case-varies, `'true'` string variant in cron). Timezone bug: `visit_date` date-only vs `created_at` UTC — a 23:30 UTC visit buckets to the wrong SAST day; cron applies SAST offset to trigger hours but not data windows. `company_id` filter inert in main report endpoints. Report rates computed client-side on capped row sets (5k/20k). Null date range silently means all-time. Mock KYC returns fake `{success:true}`. Commission balance from two unsynchronized queries. Hardcoded `999` daysSinceLastVisit sentinel. Deposits list lacks `total_count`. Silent `catch {}` in financial/dashboard paths.
6. **The company portal is one-way.** Goldrush *owns* verification/deposit truth but it enters FieldVibe via BO admin manual paste. The portal also exposes consumer PII (names, ID numbers, phones), photos, and bulk CSV export with no login rate limiting, no token revocation, no export audit log.
7. **No e2e validation.** Vitest only; Playwright absent; `tests/e2e/` empty.

## 2. Business rules (canonical)

- **Field roles** (`agent`, `field_agent`, `sales_rep`, `team_lead`, `manager`): see per-day **counts** — signups, verified (qualified), deposits-as-a-number. NEVER rand/monetary deposit values.
- **GM + admin-equivalents** (`general_manager`, `backoffice_admin`, `admin`, `super_admin`): see monetary revenue = **deposits × R75**, rate from existing tenant config `program_config.commission_per_deposit` — reuse, never hardcode.
- Monetary stripping is **server-side** (payload never contains rand fields for field roles); frontend gating is the second layer.
- **One conversion definition, one day definition.** "Converted/verified" and "day" (SAST calendar day) each defined in exactly one backend function; every consumer calls it.
- **Verified is the currency.** Ranking, recognition, and pace pressure anchor on verified (and deposits), never on raw signups alone — because signups are agent-entered and free to fabricate.

## 3. The world-first operating model: a closed performance loop

Salesforce-class tools record activity and show dashboards. None of them run a **closed loop between external ground truth and hour-by-hour field behavior, with management inaction itself measured and escalated**. The loop has six stages; every feature in this design serves exactly one stage:

**Detect → Diagnose → Prescribe → Commit → Verify → Learn** — hourly for agents, daily for leaders, weekly for the GM.

### 3.1 Detect — Funnel Pace Engine (intraday, per stage)
- `paceEngine.js` (pure functions): daily target per stage (monthly ÷ working days config), expected-by-now = daily target × elapsed working-hours fraction (tenant hours config, default 08:00–17:00 SAST). `paceStatus({actual, dailyTarget, nowFraction})` → `ahead | on_pace | behind | far_behind` (<80% / <50% of expected-by-now).
- Stages per agent: **visits, signups, verified-rate (quality), deposits**. Pace on signups is **quality-adjusted**: expected verified = signups × agent's trailing 14-day verify rate — a high-volume/low-verified agent shows as a quality problem, not an activity hero.
- New SIGNAL_REGISTRY types: `behind_pace_today`, `far_behind_pace` (deficit, intraday, min_days-exempt like `gone_quiet`), `low_verify_rate` (deficit, quality), `truth_lag` (deficit, BO-owned), `target_unrealistic` (deficit, GM-owned — see 3.2).
- Team-level detection: when ≥N agents (config, default 3) in one team are `behind|far_behind` at midday, the team_lead (and their manager) gets ONE team-level alert, not N copies.

### 3.2 Diagnose — Attainment Waterfall (the "why" of the miss)
The gap decomposes as a multiplicative identity over data the system already collects:

```
attainment = effective field hours × visits/hour × signups/visit × verify rate × deposit rate  ÷  target
```

- Computed per agent/team/tenant per day and month-to-date by `funnelService` (pure arithmetic — no ML). Each factor has an **owner**: field hours + visits/hour → agent (team_lead coaches), signups/visit + verify rate → agent skill/quality (manager coaches), truth lag → backoffice_admin, target line → GM.
- **Effective field hours**: first-to-last visit span minus gaps > threshold, from existing visit timestamps/check-ins (presence consent notice already shipped; field-hours shown as a coaching metric, not per-minute tracking).
- **Target feasibility**: compare target against observed top-decile throughput (`top-decile visits/hour × top-decile signups/visit × team verify rate × field hours`). If even top-decile behavior can't reach it for 14+ days → `target_unrealistic` fires with the evidence attached: "target needs 11 signups/day; your best agents do 6". GM must either re-base the target or change the operation — the system won't let a fantasy number sit unchallenged.
- GM command center renders the waterfall: "95% miss = 55% field-hours gap + 20% conversion gap + 12% verify-rate gap + 8% truth lag" — each bar clickable to the owning teams/agents.

### 3.3 Prescribe — Behavior Gap Engine + Huddle Card
- Weekly per tenant: top-quartile behavioral fingerprint (visits/day, active-hours histogram, verified-rate, signups-per-active-hour) from existing visits/GPS/checkins-by-hour data. Quartile stats only — no ML.
- Each agent's gap renders as ONE concrete next-best-action card on the agent home: not "you're behind" but "top agents log 6 signups by 13:00 — you average 2; your own best conversion window is 10:00–14:00".
- **Huddle Card (human-hierarchy amplifier):** every morning the system generates the team_lead's 5-minute standup script — yesterday's team result vs commitment, who's on a streak, who slipped, today's single team focus (the worst waterfall factor), and each agent's committed number. Digital driving works *through* the team lead, not around them. Delivered in the 07:30 push + `/agent/team` board.

### 3.4 Commit — Commitment Contract
3-touch in-app push cadence (times tenant-config `kpi.cadence`; existing `sendPush` infra; per-user prefs respected):
- **07:30 brief:** today's per-stage target, yesterday's result, *yesterday's commitment vs delivery*, rank. Team lead gets the Huddle Card.
- **12:30 alert:** only if `behind|far_behind` — exact recovery number + next-best-action. Team-level variant per 3.1.
- **17:30 recap:** result vs target + one-tap **commit** for tomorrow (ACTION_REGISTRY `commit` action — non-resolving self-commitment, coaching_notes row).
- Commitment vs delivery is visible to the team (leaderboard shows committed vs delivered) — a written public promise beats a target assigned from above. Streaks = consecutive days delivering ≥ commitment.

### 3.5 Verify — Same-Day Truth Loop + Integrity
The moat: shrink signup→verified→deposit latency from days to hours, and make the truth disputable and tamper-evident.
- **Two-way company portal:** new portal capability (company_login role `admin`) to upload/paste verification confirmations and deposit IDs — the same dry-run→commit endpoints BO admin uses (`/incentives/reconcile`, `/deposits`) re-exposed under company-portal auth, `company_id` always forced from the JWT. The company's own portal shows their truth-age: "your data is N days stale — upload now."
- **Provenance:** every reconcile/deposit batch records source (`bo_admin | company_portal`), uploader, timestamp, batch id, and the dry-run diff snapshot. Required for both trust and disputes.
- **Dispute channel:** same-day truth without recourse creates same-day rage. Agent taps "flag mismatch" on an unverified signup → creates a `verification_dispute` issue owned by backoffice_admin with SLA (existing issueEngine machinery). Resolution writes back to the signup with reason.
- **Integrity signals (anti-gaming):** pace pressure + leaderboards will induce fabrication unless checked. Three cheap detections, no ML: (a) duplicate goldrush_id across visits/agents; (b) verify-rate collapse (trailing rate drops >X points while signup volume rises); (c) impossible travel (consecutive visit GPS distance ÷ time gap exceeds threshold). Each fires an `integrity_flag` signal owned by the manager — framed as review, not accusation.
- **BO fallback + SLA:** BO admin remains the manual path; `truth_lag` fires when newest batch age exceeds config `kpi.backoffice_admin.recon_hours`; GM cockpit shows truth-age at all times.

### 3.6 Learn — Coaching Alpha Ledger + GM Weekly Pack
- Every ACTION_REGISTRY action (nudge/checkin/resource/commit/recognition) already writes `coaching_notes`. Nightly rollup computes the subject's before/after 3-working-day delta on their primary stage metric → `effect_delta` column (migration).
- Escalation chain (existing issueEngine SLA): `behind_pace_today` owner = team_lead, SLA default 3 working hours → manager → GM. **Inaction is itself the event that travels upward.**
- GM cockpit ranks team_leads/managers by intervention count AND median effect delta — who coaches, and whose coaching moves numbers.
- **GM Monday pack** (extends existing weekly email cron): attainment waterfall trend, coaching-alpha table, target-feasibility flags, truth-latency trend, integrity flags summary. The GM's weekly operating review, auto-written.

## 4. Architecture layers

### Layer 0: Trust foundation
**Capability SSOT.** `shared/capabilities.js` at repo root (plain data + `can(role, module)` / `canField(role, field)` pure functions), imported by frontend (Vite) and workers-api. Fallback if a bundler rejects the shared import: mirrored `.js`/`.ts` pair with cross-referencing headers (signalRegistry precedent).
- `MODULES`: one row per module — allowed roles + surfaces (`office`/`field`/`portal`). First wave enumerates all **field-ops** modules from the route audit; other modules get rows encoding current behavior (no regressions), refined in later waves.
- `FIELDS`: `deposit_rand` (admin-equivalents only), `payroll_totals`, `consumer_pii` (portal/report gating).
- Backend `requireCapability(mod)` middleware replaces scattered `requireRole` on field-ops routes; serializers strip `FIELDS`-gated keys (fail closed: unknown role → strip).
- Frontend: all nav surfaces filter via `can()`; hand-rolled role arrays deleted; MoreMenuPage dead links fixed/removed.

**funnelService.js (One-Number Rail).** The only place funnel numbers are computed: one `isConverted()`, one `sastDay(ts)` (fixes UTC/SAST bucketing everywhere at once), one funnel query per (tenant, company, agent, day) over `visits`/`visit_individuals`/`metric_facts`, plus the waterfall arithmetic (3.2). Dashboard, KPI self/roster, GM overview, P&L, reports, weekly email, GM digest, company portal ALL consume it; per-endpoint re-implementations deleted. All report aggregation server-side; `company_id` params live (or removed); explicit "All time" label when no range; every aggregate carries `as_of` + `day_tz: 'Africa/Johannesburg'`.

**Financial + report hardening.** Every §1.4 endpoint gets auth + `requireCapability`. `/field-ops/reports/*` gated by capability. Write/approve endpoints admin-equivalent-gated. `/incentives/hero`+`/me` stay field-reachable, counts only.

**Company portal hardening** (prerequisite for two-way writes): login rate limiting (per-IP + per-email, D1-backed), token revocation on login delete, export audit log, photo access via time-limited signed URLs where feasible.

**Accuracy fixes.** KYC mocks → `501 not_implemented`, commission single-query, deposits `total_count`, `999` sentinel → null, silent catches → rendered error states.

### Layer 1: Execution spine
Loop stages 3.1–3.2 + 3.4–3.6 backend: paceEngine, waterfall in funnelService, new signals (incl. integrity + dispute types), cadence cron, team-level alerts, escalation, effect-delta rollup, provenance columns, GM weekly pack. Builds ON the pending insights/actions plan (SIGNAL_REGISTRY, polarity, ACTION_REGISTRY, per-tenant cron try/catch) — that plan ships first as spine base. All new automation config-gated per tenant (`cron.pace_engine`), seeded pilot-tenant-first (established staged-rollout pattern; no staging env exists).

### Layer 2: Role cockpits (PWA + office, field-ops)
Role-tailored, never homogenized. All numbers from funnelService via API; no client-side totals; drilldown wherever a number appears. Copy/visual quality via impeccable + ui-ux-pro-max at build time.
- **Agent home (`/agent/dashboard` rework):** funnel pace hero — today's signups/verified/deposits counts vs daily target with expected-by-now marker; next-best-action card; commitment status + streak; rank; "flag mismatch" on unverified signups. Existing cards (rejected photos/IDs, targets by company, recent visits) reorganized under it, exceptions-first.
- **Team lead (`/agent/team`):** Huddle Card each morning; live board worst-first, per-agent stage pace red/amber/green; one-tap nudge/call/checkin; action queue with SLA countdown; commitment vs delivery per agent.
- **Manager (`/agent/teams`):** exception-first — behind-pace teams only by default; coaching queue; integrity flags to review; per-team_lead coaching alpha (count + effect delta).
- **GM (`/agent/overview` + `/dashboard/gm`):** command center — revenue (deposits × rate), month trajectory vs target, **attainment waterfall** (clickable factor bars), funnel waterfall (signups→verified→deposits stage-loss %), truth-age indicator, escalation heatmap, coaching-alpha leaderboard, `target_unrealistic` flags with evidence. Drill to any team/agent.
- **BO admin (`/agent/reconcile`, `/agent/deposits`):** truth-queue with SLA — pending batches, truth age, one-screen dry-run→commit, company self-uploads needing only review, dispute queue.
- **Company portal:** existing analytics + upload tab (verifications, deposits — dry-run preview then commit, own company only) + their truth-age banner — the company sees the same funnel the GM sees for their brand.

### Layer 3: Recognition + gamification
Leaderboards (verified/deposit counts only for field roles — never raw-signup-ranked, never rand; weekly + monthly; team + tenant), streaks (derived read, no new table), recognition signals (`improving_trend`, `team_top`, `hit_gate_early` per pending plan) trigger celebration push + Highlights.

### Layer 4: Validation harness
- `@playwright/test`, `e2e/` at repo root; CI job non-blocking until green, then blocking. Fixtures: seeded login per role (9 roles + 1 company portal login) against seeded test tenant.
- Matrix per role × screen: allowed renders without console error; forbidden 403/redirects; **zero rand-formatted deposit text on field-role screens**; displayed headline numbers === intercepted API values.
- Number-consistency e2e: same (tenant, company, day) via dashboard, report, and portal endpoints returns identical funnel counts — the funnelService guarantee, asserted.
- Vitest: paceEngine, capability functions, funnelService (SAST edges incl. 23:30 UTC; waterfall identity — factors multiply back to attainment), quality-adjusted pace, integrity detections (fixtures for each of the 3), serializer stripping, behavior-gap quartiles.

## 5. Ship order (staged PR train, each stage loop-till-live)

1. **Stage 0a:** pending insights/actions plan (already written) — spine base.
2. **Stage 0b:** capability SSOT + financial/report/portal hardening + funnelService (incl. waterfall math) + accuracy fixes. Security- and trust-bearing; earliest.
3. **Stage 1:** paceEngine + new signals (pace, quality, integrity, truth_lag, target_unrealistic) + cadence + team alerts + escalation + effect-delta ledger + provenance columns (backend, pilot-tenant config-gated).
4. **Stage 2:** portal two-way upload + dispute channel — after portal hardening proven live.
5. **Stage 3:** cockpits (agent → team_lead+Huddle → manager → GM waterfall command center → BO truth-queue → portal upload tab) + behavior-gap engine + GM weekly pack.
6. **Stage 4:** gamification.
7. **Playwright grows with every stage;** a stage is done only when its matrix rows pass.

Execution: max parallel agents, worktree isolation per module, migrations manually applied before merging referencing code (CI never runs migrations; frontend deploys before backend within one push — backend PRs precede frontend PRs sharing a contract).

## 6. Error handling

- Capability lookup miss: deny by default, warn once.
- Cron: per-tenant try/catch; one tenant never aborts others; unknown signal type warn+skip.
- Push failures: log and continue; cadence best-effort, SLA escalation is the guarantee.
- Portal uploads: dry-run mandatory before commit; company JWT `company_id` always overrides body.
- Waterfall factors with zero denominators: factor reported as `null`/"insufficient data", never Infinity/NaN; attainment falls back to simple actual÷target.
- Integrity flags are review prompts for the manager, never auto-punitive; false-positive dismissal is one tap and logged.
- Stripping serializer fails closed.

## 7. Success metrics

- Truth latency: median signup→verified and signup→deposit-recorded, target <24h (from days).
- Gap attribution coverage: % of tenant attainment miss explained by waterfall factors (target: factors multiply to within 5% of actual attainment).
- Behind-pace detection ≤1 cron tick; % behind-pace issues actioned within SLA.
- Commitment participation (% agents committing daily) and delivery-vs-commitment rate.
- Coaching alpha: interventions/week per leader + median effect delta.
- Dispute resolution: median `verification_dispute` time-to-resolve within SLA.
- Integrity: flags raised/reviewed; verify-rate trend per team (rising = quality improving, gaming shrinking).
- `target_unrealistic` flags actioned (target re-based or operation changed).
- Zero unguarded financial/report endpoints; zero rand values reachable by field roles; number-consistency e2e green; full role×screen matrix green.

## 8. Out of scope (explicit)

- WhatsApp/SMS channels (revisit if push proves ignorable).
- Hourly-aggressive nudging (3-touch chosen; alert fatigue).
- Real KYC provider (501 until chosen).
- ML prediction/anomaly detection (waterfall is arithmetic, behavior gap is quartiles, integrity is 3 rule checks; iterate later).
- Per-minute location surveillance (effective field hours derived from visit/check-in spans only).
- Payroll/commission rule redesign (access hardening only).
- Auto-punitive actions from integrity flags (human review always).
- Non-field-ops module cockpit redesigns (same blueprint, later waves).
