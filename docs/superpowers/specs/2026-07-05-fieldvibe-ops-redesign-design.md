# FieldVibe Operations Redesign — Design Spec

**Date:** 2026-07-05
**Status:** Approved design, pre-implementation
**First customer:** Goldrush (model is customer-generic throughout)

## 1. Problem

Field teams are not executing. The current PWA is too broad and does not focus
agents on the one thing that matters (Goldrush signups) or show them their
money. We are restructuring around a **configurable incentive engine**, a
**simplified agent experience**, two **new roles** (General Manager, Back Office
Admin), **photo-assisted signup capture**, **inactivity notifications with
escalation**, and a **mobile P&L** for the GM.

## 2. Existing platform (what we build on)

- **Backend:** Cloudflare Workers (Hono, JS), D1 (SQLite) via `workers-api/src/schema.sql`.
- **Frontend:** React + Vite + Tailwind PWA, Zustand stores, service-per-domain (`frontend/src/services/*`), role-driven nav (`config/navigation.ts`, `config/routes.registry.ts`).
- **Roles today:** `admin`, `manager`, `team_lead`, `agent`. Hierarchy on `users` via self-referencing `manager_id`, `team_lead_id`.
- **Goldrush signups:** `individual_registrations` — `product_app_player_id` is the goldrush id; `converted` + `conversion_date` mark a deposit.
- **Reuse:** `daily_targets`, `commission_rules` / `commission_earnings` + tiered `commissionService`, `commission_disputes` migration, `notifications` + `push_subscriptions`, `settings`, `CameraCapture` component, `sa-id` + `photo-compression` utils, `offline-queue.service`.

## 3. Decisions locked

| # | Decision |
|---|----------|
| Incentive shape | **Step tiers** over **working days**: `avg≥20→R3500, ≥15→R2500, ≥10→R2000, <10→R0`. Per role, per customer. |
| OCR | **On-device** (tesseract.js) autofills goldrush id, agent can edit. Photo stored. |
| P&L costs | **Fixed salaries only** (Manager + BO Admin + GM). Incentive payouts shown as memo line, not in margin. |
| Inactivity | Any **signup OR app write** resets timer; fires only in **work hours**, skips **training days**; escalates. |
| Money base (#1) | **Two-phase.** Provisional at capture (pace/motivation only). Money paid on **qualified/deposited** count after Goldrush reconciliation import. No overpay, no clawback. |
| Reconciliation channel | **File upload** (CSV/Excel from Goldrush portal), matched on goldrush id. Direct API = phase 2. |

## 4. Incentive engine (core)

### 4.1 Config — per role, per customer

New table:

```sql
CREATE TABLE incentive_scales (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT,                 -- NULL = tenant default; company row overrides
  role TEXT NOT NULL,              -- agent|team_lead|manager|general_manager|backoffice_admin
  metric TEXT NOT NULL,            -- daily_avg_signups | team_daily_avg | reactivations
  tiers_json TEXT NOT NULL,        -- [{"min":10,"amount":2000},{"min":15,"amount":2500},{"min":20,"amount":3500}]
  basis TEXT DEFAULT 'working_days',
  period TEXT DEFAULT 'month',
  active INTEGER DEFAULT 1,
  effective_from TEXT, effective_to TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

Resolution: company-scoped row wins over tenant default (`company_id IS NULL`).

### 4.2 Metric per role

All roles use the same tier-lookup shape; only the metric input differs.

- **Agent:** `avg = qualified_signups_in_period / working_days_elapsed` → step tier.
- **Team lead:** mean of their agents' `avg` → step tier (own scale row).
- **Manager:** mean of their team leads' metric → step tier.
- **General Manager:** mean of managers' metric → step tier. Scale slot exists, **default disabled**.
- **BO Admin:** `metric='reactivations'`, flat R per successful reactivation (see §9).

Team metric = **mean of member averages**. New joiner excluded until **≥3 working days** logged (grace), to avoid skewing team average.

### 4.3 Two-phase money (resolves #1)

Qualification is unknown at capture — Goldrush confirms later in the month.

- **Provisional (capture time):** signup `verification_status='provisional'`. Feeds **pace / hero / leaderboard** only. Never money.
- **Confirmed:** Goldrush import flips rows to `qualified` (deposited) or `rejected`.
- **Payout basis = qualified count**, computed at month close, after import.
- **Late tail:** if Goldrush data incomplete at payroll cut, pay on qualified-so-far; carry remainder to next cycle via true-up ledger. Never overpaid, so no clawback.

### 4.4 Accrual (for hero display)

```
monthly_target = tier(metric)
accrued_to_date = monthly_target × (working_days_elapsed / working_days_in_month)
```

Working days exclude weekends, public holidays (admin holiday calendar), and
approved leave; those days are removed from both numerator basis and
denominator so leave does not crater an agent's average.

### 4.5 Storage / reuse

Payable incentive writes to existing `commission_earnings` (earner_id, period,
amount, status, approve flow). Disputes reuse `commission_disputes`. Month
close = admin-triggered lock after import; sets earnings `status` to approved
for payroll export.

## 5. Roles & hierarchy

Add roles `general_manager`, `backoffice_admin`. Add `users.gm_id` (nullable)
so managers roll up to a GM.

Chain: `agent —(team_lead_id)→ team_lead —(manager_id)→ manager —(gm_id)→ general_manager`.

Extend `requireRole` and the hierarchy resolver (given a node, fetch direct
reports for average roll-ups and drill-down).

## 6. PWAs (one app, role-driven nav)

Strip the agent view down; other roles layer on top.

- **Agent (simplified):**
  - **Hero:** provisional pace + confirmed R earned (day / week / month) + "N more/day → next tier" + leaderboard rank.
  - **Primary action:** New Goldrush Signup (photo → OCR autofill → edit → save).
  - Performance vs target; recent signups (with provisional/qualified/rejected status).
  - **Removes** trade-marketing, POS, board-placement, and other non-Goldrush screens from agent nav.
- **Team lead:** agent screens + **Store Visits** (reuse `VisitWorkflow`) + team dashboard (team avg, drill to agent, own incentive on team avg).
- **Manager:** team-lead averages, drill TL→agent, own incentive.
- **General Manager (new):** manager averages, drill manager→TL→agent (same base metric); total signups; Goldrush revenue; **mobile P&L** (§10); **BO oversight** (§9).
- **Back Office Admin (new):** current admin functions + **inactivity worklist** + logged **data-call** action + **training-day booking** (suppresses notifications) + **Goldrush reconciliation import** + own reactivation incentive hero.

## 7. Goldrush signup capture + photo OCR

- New signup form: `CameraCapture` → **tesseract.js on-device** reads the goldrush id (numeric pattern) → autofills field → agent edits/confirms → save. Works offline.
- Goldrush id field = existing `product_app_player_id`; agent can type it directly.
- Store the picture: add `individual_registrations.goldrush_id_photo_url` (R2 object; base64 fallback for offline, uploaded on sync).
- Existing server-side 9-digit + uniqueness enforcement applies.
- **Offline:** capture queues via `offline-queue.service`; **counts at capture time** for pace; server dedups on sync (existing uniqueness indexes).

## 8. Inactivity notifications

- Add `users.last_activity_at`, bumped on any signup / visit / check-in / authenticated write.
- Add `tenants.timezone` (default `Africa/Johannesburg`). **Cloudflare Cron every 15 min (UTC)**; localize before work-hours / training-day checks.
- For each active employee: if `now − last_activity_at > inactivity_minutes` AND inside work hours AND not a training day → fire.
- **Escalation ladder** (`program_config.escalate_steps = [{after_min,to}]`):
  - `t0`: push employee.
  - `+X min` still inactive: escalate to team lead.
  - `+Y min`: manager + BO worklist item.
  - Repeats stop once actioned or activity resumes.
- **Channel ladder:** push (`push_subscriptions`) → no token / still unread after cadence → SMS/WhatsApp via **pluggable provider** (Twilio / WhatsApp Cloud API), per-tenant config. Provider stubbed first; live key later.
- New `training_days(tenant_id, user_id, date, reason)` suppresses notifications for those users/dates.

## 9. BO data-calls + reactivation credit + GM oversight

```sql
CREATE TABLE inactivity_events (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL,
  detected_at TEXT NOT NULL, resolved_at TEXT, resolved_by TEXT,
  data_call_id TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE data_calls (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
  bo_admin_id TEXT NOT NULL, target_user_id TEXT NOT NULL,
  inactivity_event_id TEXT, trigger TEXT DEFAULT 'inactivity',
  channel TEXT, notes TEXT, outcome TEXT,
  alerted_at TEXT, actioned_at TEXT,
  resulted_in_activity INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

- BO admin sees inactivity worklist, records a data-call (channel + notes +
  outcome); `actioned_at` stamped; links to the `inactivity_event`.
- **In-app call = click-to-dial** (phase 1): the worklist row has a call button
  firing native `tel:<number>` or `https://wa.me/<number>`; tapping it
  auto-creates the `data_call` (`channel='call'|'whatsapp'`, `actioned_at`
  stamped). Call rides carrier/WhatsApp, not the app. True in-app VoIP (WebRTC +
  TURN, or Twilio Programmable Voice with call recording) = phase 2.
- **Reactivation credit:** if the target logs activity within
  `reactivation_window` (default 2h) of a data-call → `resulted_in_activity=1`
  → BO earns the reactivation incentive (§4.2).
- **Coverage:** each employee assigned to a BO admin pool; an inactivity event
  unactioned beyond SLA escalates to the GM.
- **GM BO-performance dashboard** per admin over a range: alerts_assigned,
  actioned, response_rate, avg_time_to_action (`actioned_at − alerted_at`),
  reactivations, reactivation_rate. Same numbers feed BO incentive.
- **Training-day abuse guard:** booked training days are visible to the GM.

## 10. GM P&L (mobile)

- **Revenue** = `commission_per_deposit (default R75) × count(individual_registrations WHERE converted=1 AND conversion_date IN range)`. No 30% constant.
- **Observed conversion rate** KPI = deposited ÷ signups (this is where the ~30% shows up, measured not assumed).
- **Costs** = Manager + BO Admin + GM salaries (fixed, configured per customer).
- **Net** = revenue − fixed salaries.
- **Memo line** (not in margin): total incentive payouts (confirmed).
- **Trailing tail:** revenue recognized on `conversion_date`; volume by signup date. P&L shows both ranges. Per-customer P&L, roll-up across customers.

## 11. Config store

```sql
CREATE TABLE program_config (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT,  -- NULL = tenant default
  key TEXT NOT NULL, value_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

Keys: `salaries` (manager/bo/gm), `commission_per_deposit`, `work_hours`,
`inactivity_minutes`, `escalate_steps`, `channels`, `reactivation_window`,
`working_days_in_month`, `holiday_calendar`, `leaderboard_visible`.
Company-scoped row overrides tenant default.

## 12. Reconciliation import

```sql
CREATE TABLE goldrush_imports (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT,
  uploaded_by TEXT NOT NULL, source TEXT, row_count INTEGER, matched_count INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

- BO admin / GM uploads CSV/Excel; matched on goldrush id
  (`product_app_player_id`).
- Sets `individual_registrations.verification_status` = `qualified` /
  `rejected`, `verified_at`, and (`converted`, `conversion_date`) on deposits.
- Unmatched / duplicate rows surfaced for review. Direct Goldrush API = phase 2.

## 13. Schema net-new summary

- **New tables:** `incentive_scales`, `program_config`, `inactivity_events`, `data_calls`, `training_days`, `goldrush_imports`.
- **Altered:** `users` (+`gm_id`, +`last_activity_at`); `tenants` (+`timezone`); `individual_registrations` (+`goldrush_id_photo_url`, +`verification_status`, +`verified_at`).
- **New roles:** `general_manager`, `backoffice_admin`.

## 14. Defaults applied to open items (#2–#6)

- **Month close:** admin-triggered lock after import; earnings → approved for payroll.
- **Working days:** exclude weekends, public holidays (admin calendar), approved leave.
- **Offline signup:** counts at capture; dedup on sync.
- **Team fairness:** mean-of-averages; new joiner grace ≥3 working days; TL/manager personal signups do not enter the agent pool.
- **BO coverage:** assigned pool; unactioned past SLA escalates to GM.

## 15. Out of scope (YAGNI)

Linear / partial-floor incentive math; server-side OCR; incentive payouts inside
P&L margin; deposit-linked clawback (not needed — money only counts qualified);
direct Goldrush API; incentive tax / payslip generation; multi-language;
in-app VoIP / call recording (click-to-dial covers phase 1).

## 16. Build order (proposed for the implementation plan)

1. Schema migrations + roles + hierarchy resolver + `program_config`/`incentive_scales`.
2. Incentive engine (provisional + payable calc) + `commission_earnings` wiring.
3. Simplified agent PWA: signup capture + OCR + photo storage + hero + leaderboard.
4. Reconciliation import + verification status → confirmed payout.
5. Inactivity cron + escalation + notification channels + training days.
6. BO Admin PWA: worklist + data-calls + reactivation credit.
7. GM PWA: roll-up drill-down + total signups + P&L + BO oversight.
8. Team lead / manager dashboards + store visits wiring.
