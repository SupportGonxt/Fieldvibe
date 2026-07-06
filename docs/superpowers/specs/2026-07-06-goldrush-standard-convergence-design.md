# Goldrush → Standard Convergence — Design

**Date:** 2026-07-06
**Status:** Approved (sections 1–5), ready for implementation plan
**Initiative:** Role-based performance management (Spec 1 of 2). Spec 2 = Performance cockpit, built after this.

## Goal

Retire goldrush as a hardcoded exception. Make it one company whose behavior is entirely described by per-company **config + survey + process flow** rows — no `name LIKE '%goldrush%'` gates anywhere. Collapse three parallel question systems into one. Migrate all history into the canonical layout losslessly, with money-safe before/after assertions as the gate.

## North star

"Fit the standard" — goldrush conforms to the standard model, not the reverse. "Don't lose any insights" — every existing goldrush report, question, and commission number survives, reproducible for any company from the admin UI with zero code.

## Non-goals

- Spec 2 (performance cockpit / KPIs / underperformance signals) — separate spec.
- Prod cutover. Ships to `dev` only. Migration on prod D1 (`fieldvibe-db`) + `dev`→`main` runs **only on explicit user go-ahead** (same rule as the voice-call feature).

---

## Current state (why this is needed)

**Goldrush is an exception on the standard `POST /visits/workflow` path**, gated on `field_companies.name LIKE '%goldrush%'`. ~40 `goldrush` literal sites drive validation, reports, fast-entry, reconcile, and commission.

**Three parallel question systems** exist, all persisting answers into `visit_responses` (and goldrush answers additionally into `visit_individuals.custom_field_values` JSON):

| System | Table | Scoped | Edited | Rendered |
|---|---|---|---|---|
| Company custom questions | `company_custom_questions` (schema.sql:2061) | company_id FK | ProcessFlowManagementPage → CustomQuestions tab (910) | VisitCreate Details/questionnaire step (1797-1806) |
| Questionnaires = "Surveys" | `questionnaires` (schema.sql:220) | company_id + brand_ids JSON; null = global | Surveys tab (1930) via `/surveys`; also `/questionnaires` | VisitCreate survey step (2049-2232) |
| Process flow steps | `process_flows` (2017) + `process_flow_steps` (2030), bound via `company_process_flows` (2047) | flow tenant-scoped; reaches company via join | ProcessFlows + CompanyAssignments tabs | activeSteps (VisitCreate 324-383) |

Plus a **dead `surveys` table** (schema.sql:756) no handler reads. The reader already normalizes across question shapes — `index.js:6580`:

```
// Questions come in two shapes: the seeded Goldrush style ({ key, label, type })
// and the survey-builder style ({ id, question_text, question_type }). Answers
// are keyed by whichever identifier that survey uses (id / key / label)...
```

**Data-key fragmentation (top migration risk):** the goldrush ID lives under two keys — `custom_field_values.goldrush_id_entry` (fast-entry, `GoldrushFastEntry.tsx:177`) and `custom_field_values.goldrush_id` (legacy/standard form). Reconcile matches `COALESCE(goldrush_id_entry, goldrush_id)` (`incentives.js:191-192`).

**Recent hardening (June 2026 commits) that MUST be preserved, not regressed:**
- `4065ef7` — SA-ID checksum (Luhn) + passport toggle for ID capture (`frontend/src/utils/sa-id.ts`, VisitCreate, IndividualRegistrationPage).
- `2277d80` + `c101231` — server-side 9-digit + unique `goldrush_id` enforcement.
- `4453800` — hard-reject duplicate `id_number`/`phone` at `/visits/workflow` (409 + `duplicate_field`, before any insert → no orphan visit), mirroring `/individuals`.
- `e03e97a` — partial UNIQUE indexes `uq_individuals_tenant_id_number`, `uq_individuals_tenant_phone` on `individuals` (WHERE col NOT NULL AND != ''). Prod already de-duped (222 groups collapsed); `goldrush_id` left as real visit data.

---

## Section 1 — One question model (config-driven)

Retire `company_custom_questions`. Questions reach a visit exactly one way: a **survey step** in the company's **process flow** points at a `questionnaire`. Goldrush = a questionnaire bound to the goldrush company + a process flow with a survey step + `program_config` flags.

**Additions to the questionnaire/survey model:**

1. **`identifier` question type.** New `question_type` alongside `text | multiple_choice | rating | yes_no | date`. Carries:
   - `min_length` / `max_length` (goldrush ID = 9/9).
   - `unique` (per-tenant uniqueness on this answer across visits).
   - `is_qualification_key` (this answer is what reconcile matches on to pay commission — replaces hardcoded `goldrush_id`).
   - `validation_kind` — `numeric` (goldrush 9-digit) | `sa_id` (Luhn checksum, generalizes `4065ef7`) | `passport` (free-form) | `none`. This folds the SA-ID-checksum/passport toggle into config instead of hardcoded frontend logic.
2. **`render_mode` on the survey step** — `full` (multi-step VisitCreate) | `quick` (single-screen fast entry). `GoldrushFastEntry.tsx` becomes a **generic quick-entry screen** rendering whatever questions the survey holds. Goldrush's fast entry = a survey marked `quick`. (Realizes the earlier "per-company opt-in + config" fast-entry decision.)

**Per-company flags in existing `program_config`** (key/value, company-override-wins via `getConfig`, `config.js:11-18`) — additive rows only, no new table:

| Key | Meaning |
|---|---|
| `fast_entry_enabled` | company's agents get the quick-entry screen |
| `qualification_enabled` | provisional→qualified reconcile + commission active |
| `qualification_identifier_key` | which survey question key reconcile matches on |
| `capture_steps` | step ordering override (e.g. photo-first) |

Absent config = plain standard company (no capture profile, no qualification, full-form only).

**Two uniqueness scopes stay distinct — both preserved:**
- **Individual-level** (all companies): `individuals.id_number` / `phone` uniqueness — partial UNIQUE indexes (`e03e97a`) + 409 hard-reject (`4453800`). Untouched by convergence.
- **Survey-identifier-level** (per config): the `identifier` question's `unique` flag — this is what enforced `goldrush_id` uniqueness. Generalized, still server-side.

---

## Section 2 — Data migration (all history → canonical layout)

Money rides on this (`commission_earnings`, `verification_status`), so it is a gated, reversible backfill.

**2a. Definitions** — build goldrush config from what already exists:
- Create one `questionnaire` bound to the goldrush company from its current `company_custom_questions` rows + seeded goldrush questions (`index.js:14019-14054`). The 9-digit ID row → `identifier` type, `validation_kind='numeric'`, `min_length=max_length=9`, `unique=1`, `is_qualification_key=1`.
- Create a goldrush `process_flow` with a survey step (`render_mode='quick'`), bound via `company_process_flows`.
- Seed `program_config` for the goldrush company: `fast_entry_enabled=1`, `qualification_enabled=1`, `qualification_identifier_key=<the identifier question key>`, `capture_steps` = photo-first.

**2b. Answers — normalize in place, do not relocate.** Money logic reads `visit_individuals.custom_field_values` (JSON). Lazy + safe:
- One-time UPDATE collapsing the fragmented keys: `COALESCE(goldrush_id_entry, goldrush_id)` → single canonical key = the identifier question's key.
- `consumer_converted`, `verification_status` stay as-is (already canonical, already read by money code).
- Reconcile switches from hardcoded `goldrush_id`/`goldrush_id_entry` to "the questionnaire's `qualification_identifier_key` answer" — same values, config-resolved.
- **No mass-move into `visit_responses`.** Money code already reads `custom_field_values`; relocating money-critical rows buys nothing but risk. `ponytail:` normalize keys, leave the store.

**2c. Gate (money-safety net).** Snapshot raw `custom_field_values` JSON before. After migration, assert **exact equality** on all four:
1. signup row count (non-rejected `visit_individuals` for the company),
2. distinct identifiers,
3. qualified count (`verification_status='qualified'`),
4. `SUM(commission_earnings.amount)` for the company's earners.

Any drift → abort + rollback from snapshot. Migration ships only when all four match.

---

## Section 3 — Reports (single set, keep goldrush detail)

Retire the 7 `Goldrush*.tsx` pages + the `/surveys`-vs-`/questionnaires` double surface. One standard report set, company-filtered, config-driven columns. No lost detail:

- **Standard individual/store reports** gain a company filter; questions flagged `show_in_reports` (already a column) become columns automatically. `likes_goldrush` etc. surface via that flag, not hardcode.
- **Qualification funnel** (provisional→qualified→converted) renders when the company's `qualification_enabled=1`; hidden otherwise. Same numbers goldrush shows today.
- **Capture-failure panel** — `goldrush_upload_failures` table generalizes; shown when the survey has an `identifier`/photo-validated question. The `NOT EXISTS (... goldrush_upload_failures ...)` filter repeated across ~17 report queries (`index.js:9563…16894`) becomes the config gate.
- Re-point nav/breadcrumbs (`App.tsx:1105-1113,1132`, `navigation.ts:105-106`, `Breadcrumbs.tsx:113-115`) at the unified reports filtered to company.

Any company gets funnel + capture-failure log + custom-question columns if its config turns them on. Goldrush = the company that turns them all on.

---

## Section 4 — Process-flow relook + kill the string-gates

All ~40 `goldrush` literal sites collapse to config lookups. Nothing stays name-gated.

**Backend → config:**
- Main workflow gate (`index.js:9128-9131`) → resolve company `program_config` + questionnaire. No `LIKE '%goldrush%'`.
- `validateGoldrushId` (`9069`), `extractGoldrushId` (`9076`), `goldrushIdExists` (`9089`), dup checks (`8983`), edit-path gates (`3473`, `5799`) → driven by the `identifier` question def (`min/max length`, `unique`, `validation_kind`).
- ~17 `goldrush_upload_failures` filters → capture-failure gate keyed on company config.
- Reconcile (`incentives.js:175-221`) + `incentiveService.extractGoldrushIds` 9-digit regex (`incentiveService.js:22-35`) → match on `qualification_identifier_key`.
- Seed logic (`index.js:13988-14054`, `14209`) → becomes the migration's config seed (Section 2a), not runtime name-gates.

**Frontend → config:**
- `VisitCreate.isGoldrushCompany` (`175`), step visibility (`342,349,354,388-390,680,877-880`), `GOLDRUSH_ID_LENGTH` (`119`) → read company config + survey question defs.
- `GoldrushFastEntry.findGoldrush` (`88`) → generic quick-entry gated on `fast_entry_enabled`.
- `VisitDetail` goldrush_id edit/rejection UI (`110-155,413-476`) → identifier-question edit UI.
- `sa-id.ts` key exclusion (`69-76`) → SA-ID validation driven by question `validation_kind`, not key-name sniffing.
- Routing/nav (`App.tsx`, `navigation.ts`, `Breadcrumbs.tsx`) → unified reports.

**Process-flow relook** — express goldrush's shape via generic steps so nothing is special-cased:
- Photo-first ordering → `process_flow_steps.step_order` (photo before details) via `capture_steps` config.
- Quick capture → survey step `render_mode='quick'`.
- ID + "did they buy?" → `identifier` + `yes_no` questions in the survey.
- Photo-mismatch / no-B-Tag acks → capture-validation config on the identifier question.

Result: goldrush is rows in `process_flows`/`process_flow_steps`/`questionnaires`/`program_config`. Any company reproducible from the admin UI, no code.

---

## Section 5 — Testing + rollout

Money-critical, so verification is the spine.

**Pure unit tests** (node env; append each file path to `workers-api/tests/unit/vitest.node.config.js` include array — it is explicit, not a glob):
- `identifier` validation generalized (length + `validation_kind` sa_id/numeric/passport + `unique`) reproduces old 9-digit + SA-ID-checksum behavior exactly.
- Qualification-key resolver: reconcile matches the same signups by `qualification_identifier_key` as the old hardcoded `COALESCE(goldrush_id_entry, goldrush_id)`.
- Config resolver: company-override-wins; absent config = plain standard (no capture profile).
- Commission unchanged: same qualified set → same `commission_earnings` rows.
- Individual-level uniqueness intact: dup `id_number`/`phone` still 409 with `duplicate_field` (regression guard on `4453800`).

**Migration verification** (the 2c gate, as a test + a runtime assert):
- Dry-run on preview D1 (`fieldvibe-dev`) first. Assert the four equalities before/after. Abort on drift.
- Raw JSON snapshot retained → rollback path.

**Rollout order:**
1. Ship code + migration to `dev`. Verify goldrush reports render **identical numbers** to today (funnel, failures, columns).
2. Confirm a fresh standard company can be built goldrush-shaped from admin UI alone (no code).
3. **Prod cutover NOT autonomous** — migration on prod D1 + `dev`→`main` only on explicit go-ahead.

---

## Files touched (map for the plan)

**Backend (`workers-api/src/`):**
- `index.js` — remove ~40 goldrush string-gates; workflow gate → config resolver; report queries → config gate; retire `company_custom_questions` CRUD (`8460-8523`) into questionnaires; seed → migration.
- `routes/field-ops/config.js` — new `program_config` keys documented/seeded.
- `routes/field-ops/incentives.js` + `services/incentiveService.js` — reconcile/extract by `qualification_identifier_key`.
- `schema.sql` + `database/schema.js` — `identifier` question fields on `questionnaires`; `render_mode` on step config; preserve partial UNIQUE indexes.
- New migration file — Section 2 (definitions + answer normalize + assertions).

**Frontend (`frontend/src/`):**
- `pages/agent/GoldrushFastEntry.tsx` → generic `QuickEntry` (config-driven).
- `pages/field-operations/visits/VisitCreate.tsx` + `VisitDetail.tsx` — config-driven capture/edit; drop `isGoldrushCompany`.
- `utils/sa-id.ts` — validation by `validation_kind`, not key-name.
- `pages/field-operations/ProcessFlowManagementPage.tsx` — retire CustomQuestions tab; survey builder gains `identifier` type + `render_mode`.
- `pages/field-operations/reports/` — retire `Goldrush*.tsx`; unified reports gain company filter + config columns.
- `App.tsx`, `config/navigation.ts`, `components/navigation/Breadcrumbs.tsx` — re-point routing.

**Tests (`workers-api/tests/unit/`):** new files per Section 5, each appended to `vitest.node.config.js`.
