# Go-live readiness — 2026-04-27

This document is the snapshot of what shipped during the post-audit buildout push. It supersedes any earlier `GO_LIVE_READINESS_REPORT.md` claims about the items listed here; it does not replace that file (which covers field operations more broadly).

## What is live in production now

All deploys below went out via the `main` → CI → Cloudflare Workers + Pages pipeline today. Each is its own merge commit on `main`; revert is straightforward if needed.

### Field operations (already live; just unblocked)

| Change | Branch | Notes |
|---|---|---|
| AI vision analysis works on photos > 80 KB | `fix/ai-analysis-image-size-cap` | The 80 KB cap (which silently killed every real photo since 2026-04-09) was raised to a 5 MB safety valve. |
| AI photo backlog auto-drains | `feat/ai-backlog-cron-drain` | Every cron tick processes up to 25 photos from `pending`/`skipped`. ~350/day at the current 14-cron schedule. Stuck `processing` rows older than 30 min get reaped to `pending`. |
| Field-ops AI backlog reset | post-deploy SQL | 1,012 photos that the 80 KB cap had marked `'skipped'` were flipped back to `'pending'`. They will drain over ~3 days at the cron rate. |

### Finance correctness (no UI change)

| Change | Branch | DB migration | Behaviour change |
|---|---|---|---|
| Invoices include tax in `total_amount` | `feat/returns-invoice-tax-totals` | `0002_returns_tax_amount.sql` | New invoices created via `POST /invoices/create` now carry `subtotal + tax_amount + discount_amount` instead of `total_amount = subtotal`. Existing rows are untouched. |
| Returns populate all four amount fields | same | same | `total_credit_amount`, `tax_amount`, `restock_fee`, `net_credit_amount` are all written instead of zero. Restock fee accepts `restock_fee_pct` or flat `restock_fee`. |
| Credit-note partial application | `feat/credit-notes-partial-application` | `0003_credit_notes_partial_application.sql` | `applied_amount` and `remaining_balance` columns added; `POST /credit-notes/:id/apply` now supports applying part of a note across multiple orders. `void` refuses to void an already-applied note. Tenant scope tightened on the `customers.outstanding_balance` update path. |

### Commission disputes & reversals

| Change | Branch | DB migration | Surface |
|---|---|---|---|
| Backend dispute / reverse / reject-with-reason | `feat/commission-disputes-reversals` | `0004_commission_disputes.sql` | New endpoints: `POST /commission-earnings/:id/dispute`, `POST /commission-earnings/:id/reverse`. `PUT /commission-earnings/:id/reject` now requires `{ reason }` (breaking, but no live caller hit it). |
| Order-cancel auto-reverse | same | same | `PUT /sales-orders/:id/cancel` is now idempotent and auto-rejects pending earnings, sibling-row-reverses approved/paid earnings. Same logic also applied to the larger transitions handler. |
| Status enum normalised | `chore/normalize-commission-voided-to-reversed` | — | Legacy `'voided'` write on cancel was replaced with the new reversal path. No production rows existed with `'voided'`. |
| Agent dispute UI | `feat/agent-commission-disputes-ui` | — | New `MyCommissionEarningsPage` at `/commissions/my`. Shows the agent's own earnings with status, totals, and a Dispute button on `pending` rows. Backend endpoint `GET /commission-earnings/my` filters by `earner_id`. |

### Other modules

| Change | Branch | Notes |
|---|---|---|
| Brand Activations real page | `feat/brand-activations-page` | Replaced the "coming soon" stub at `/brand-activations` with a list backed by `/activations`. |
| Van Sales cash reconciliation works | `feat/van-sales-rebuild` | The three `/van-sales/cash-reconciliation*` stubs that returned empty arrays now query `van_reconciliations`. The list, detail, and create flows all work. |
| Dead-code purge | `chore/dead-code-cleanup` | Removed orphan migrations folder, dead `auth-enhanced.js` middleware (487 LOC), `tests_backup/` (44 KB), and orphan `LoginSimple.d.ts`. -2,999 lines. |
| Design docs for items not shipped | `docs/system-buildout-plans` | Plans for items #3, #5, #8 reviewed below. |

## What is **not** live and why

| Item | Why deferred |
|---|---|
| Payments general ledger / reversal flow | Backfill of historical `payments` rows into a new ledger is a one-way migration. Production has live payment data; doing this without a staging dry-run is the kind of thing that destroys finance history. Design lives in [docs/planning/03-payments-ledger.md](planning/03-payments-ledger.md). |
| Van Sales full rebuild (vans CRUD, load lifecycle, per-line cash sessions) | The minimum cash-reconciliation fix above is enough to unblock users. The larger redesign is a 5–7 day backend + 4–5 day frontend project; doing it unattended over a holiday is a bad idea. Design lives in [docs/planning/05-van-sales-rebuild.md](planning/05-van-sales-rebuild.md). |
| Marketing tables consolidation | Genuinely needs a product call: do `activations` / `board_installations` / `share_of_voice_snapshots` graduate to first-class tables, or stay as side-effects of `visits`? Until that's decided, building either path is wrong. |
| KYC document migration to R2 | Touches PII. The design needs sign-off on retention and content-type rules before code. Design lives in [docs/planning/08-kyc-r2-migration.md](planning/08-kyc-r2-migration.md). |
| `CommissionApprovalPage` rework | The existing page calls `/commissions/:id/reverse` (legacy route family). The new dispute/reverse endpoints live under `/commission-earnings/:id/...`. Consolidating the two route families is its own architectural decision. The agent-facing flow at `/commissions/my` is already fully usable; managers can keep using the existing approval page. |

## Standing assumptions and watch-points

1. **`fieldvibe-db.d1_migrations` was empty** at the start of today. A synthetic row was inserted marking `0001_baseline.sql` as applied (the schema clearly was applied long ago, just not via wrangler's tracker). Future migrations from `wrangler d1 migrations apply` will work normally now.
2. **Migration mirror folder removed.** `/workers-api/migrations/` no longer exists; only `/migrations/` (referenced from `wrangler.toml`'s `migrations_dir`). Future migrations go there only.
3. **CI auto-deploys to production** on every push to `main`. There is no staging gate. The `develop` branch path in `ci-cd.yml` is unused.
4. **`PUT /commission-earnings/:id/reject` now requires a body with `reason`.** The existing live frontend never hit this endpoint (it goes through `/commissions/:id/reverse`), so no clients broke. Any new caller must include `{ reason: '...' }` or get a 400.
5. **Invoice `total_amount` is not back-compatible.** An invoice created today and queried tomorrow will show `tax_amount + total_amount` correctly. An invoice from before today still has `tax_amount = 0`. If you need historical tax breakdowns, that's a separate backfill.
6. **AI backlog drain is a recurring cost.** Each cron tick burns up to 25 Workers AI vision calls. At the current 14-cron schedule that's ~350/day. To pause, comment the `ctx.waitUntil(drainAiBacklog(env))` line in `scheduled()`.

## Manual verification checklist

In a browser, signed in as an account that has data in production:

- [ ] **`/brand-activations`** — list renders without errors. The four summary tiles show counts. The "Schedule Activation" button navigates to `/marketing/activations/create`.
- [ ] **`/commissions/my`** — page loads. Filter by status works. If a pending earning exists, the Dispute button opens a modal that requires a reason; submitting the dispute changes the status to `disputed`.
- [ ] **`/commissions/approval`** — existing manager approval page still functions identically (it was not touched).
- [ ] **`/sales/invoices/create`** — create a small test invoice with one line. The created invoice's `total_amount` should equal `subtotal + (subtotal × product.tax_rate / 100)`.
- [ ] **`/sales/returns/create`** — create a small return. The detail page should show non-zero `total_credit_amount`, `restock_fee` (if specified), and `net_credit_amount`.
- [ ] **`/sales/credit-notes/:id`** — apply a credit note to an order using less than its full balance. The note's status flips to `partially_applied` and `remaining_balance` is non-zero.
- [ ] **`/van-sales/cash-reconciliation`** — list page now shows real data (was empty before today). Create a new reconciliation against an existing van load; the row appears in the list with `pending` status.

## Outstanding items requiring you (not me)

1. **Rotate the GitHub PAT and Cloudflare Global API Key** pasted earlier in the session. They've been visible in chat history all day.
2. **Watch the AI backlog**: at the cron's 25 photos/tick rate, the 1,013-photo backlog clears in ~3 days. Run this query daily to track progress:
   ```sql
   SELECT ai_analysis_status, COUNT(*) FROM visit_photos GROUP BY ai_analysis_status;
   ```
   If `pending` isn't dropping, check the cron log in the Cloudflare dashboard.
3. **Smoke-test the manual checklist above.** I can't open a browser; a five-minute click-through is the only way to confirm the UI work landed correctly.
4. **Decide on the deferred items** when you want to come back to them. The design docs in `docs/planning/` are review-ready.

## Today's commit timeline (for the record)

| Time (UTC) | Branch | Commits added to `main` |
|---|---|---|
| Earlier | `fix/ai-analysis-image-size-cap` etc. (5 branches batch) | `1745579 → 6f6a1d7` |
| 14:54 | `chore/dead-code-cleanup` | `6f6a1d7 → bb5ec11` |
| 20:59 | `chore/normalize-commission-voided-to-reversed` | `bb5ec11 → deb9b4b` |
| 21:13 | `feat/ai-backlog-cron-drain` | `deb9b4b → 34c85fa` |
| 21:19 | `feat/agent-commission-disputes-ui` | `34c85fa → 0606d65` |
| 21:22 | `feat/van-sales-rebuild` | `0606d65 → ac24442` |
| now | `docs/go-live-readiness` (this document) | pending |

All CI runs green; zero production error_log entries during any deploy window.
