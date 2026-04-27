# System buildout plan — overview

This folder contains the design documents for the second phase of FieldVibe build-out: closing the gaps the audit found in the non–field-operations modules. Field operations is live with users and is out of scope for these documents.

## Where each item is

| # | Item | Status | Doc |
|---|------|--------|-----|
| 1 | Returns tax + Invoice tax calc | **CODE: branch `feat/returns-invoice-tax-totals`** | (no doc; small change, see commit) |
| 2 | Credit Notes partial application | **CODE: branch `feat/credit-notes-partial-application`** | (no doc; small change, see commit) |
| 3 | Payments ledger + reversals | DESIGN | [03-payments-ledger.md](./03-payments-ledger.md) |
| 4 | Commission disputes & reversals | **CODE: branch `feat/commission-disputes-reversals`** (backend); UI deferred | [04-commission-disputes.md](./04-commission-disputes.md) |
| 5 | Van Sales schema + handler rebuild | DESIGN | [05-van-sales-rebuild.md](./05-van-sales-rebuild.md) |
| 6 | Marketing tables consolidation | NEEDS DESIGN CALL | (deferred — requires product input on whether `activations`, `board_installations`, `share_of_voice_snapshots` should remain side-tables off `visits` or graduate to a first-class campaign-results model) |
| 7 | Brand Activations real page | **CODE: branch `feat/brand-activations-page`** | (no doc; small change, see commit) |
| 8 | KYC documents to R2 | DESIGN | [08-kyc-r2-migration.md](./08-kyc-r2-migration.md) |

Plus the AI fix that started this whole sequence: branch `fix/ai-analysis-image-size-cap`.

## Recommended deploy order

1. `fix/ai-analysis-image-size-cap` — unblock field-ops AI today; smallest diff.
2. `feat/returns-invoice-tax-totals` — finance-correctness fix; runs migration `0002`.
3. `feat/credit-notes-partial-application` — depends on `0002`'s ordering only because both touch the migrations folder; runs migration `0003`.
4. `feat/commission-disputes-reversals` — runs migration `0004`. Backend-only. **Behaviour change**: `PUT /commission-earnings/:id/reject` now requires a `reason` in the body; any frontend currently calling reject without one will start receiving 400. Audit existing callers before merge.
5. `feat/brand-activations-page` — frontend-only, no migration; can deploy any time.
6. Review the remaining three design docs (#3, #5, #8), pick the next item, cycle back into code.

## Migration ordering

Migrations are numbered by branch in the order they should be applied:
- `0001_baseline.sql` — already deployed.
- `0002_returns_tax_amount.sql` — adds `tax_amount` to `returns`.
- `0003_credit_notes_partial_application.sql` — adds `applied_amount`, `remaining_balance` to `credit_notes` and backfills.
- `0004_commission_disputes.sql` — adds dispute/rejection/reversal columns and a `(tenant_id, source_id)` index on `commission_earnings`.

Subsequent items (#3 ledger, #5 van-sales, #8 KYC) will introduce `0005` onwards once those PRs are written.

There are still **two** mirror copies of the migrations folder — `/migrations/` (referenced from `wrangler.toml`) and `/workers-api/migrations/` (orphan). Each new migration is committed to both copies for now to avoid silent drift, but the audit recommendation to delete the orphan still stands and should be done as a one-line PR before the next migration round.

## Things this plan deliberately does not do

- Touch any code under `frontend/src/pages/field-operations/` or `frontend/src/pages/sales/` that's already in use by live agents.
- Refactor `workers-api/src/index.js` into modules. The 18k-line monolith is the highest-leverage refactor in the codebase but it has nothing to do with feature gaps and would explode the diff.
- Convert `REAL` money columns to `INTEGER` cents. That is a separate, larger migration that should sit in its own quarter.
- Migrate to `UNIQUE(tenant_id, email)` on `users`. Same — separate, larger.
