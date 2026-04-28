# Marketing tables: decision document (item #6)

Status: **NEEDS PRODUCT DECISION** — pick option A or B per concept below, then a follow-up PR per chosen option.

## Why this exists

The earlier audit flagged that 43 routes under `/trade-marketing`, `/field-marketing`, and `/marketing` query a wide range of marketing concepts, but only a subset of those concepts have dedicated tables in production. Half the endpoints return empty arrays or zero-count summaries because there's nothing backing them.

The decision the team needs to make is: *for each marketing concept that doesn't yet have a table, do we (A) graduate it to a first-class table, or (B) keep deriving it from existing visit data, or (C) drop the concept entirely?*

## What's actually in production today

Verified against the live D1 (`fieldvibe-db`) on 2026-04-28.

| Concept | Status in prod | Backing |
|---|---|---|
| **Campaigns** | First-class | `campaigns`, `campaign_assignments` |
| **Activations** | First-class | `activations`, `activation_performances` |
| **Trade promotions** | First-class | `trade_promotions`, `trade_promotion_enrollments`, `trade_promotion_claims`, `trade_promotion_audits`, `promotion_rules` |
| **Share of voice** | First-class | `share_of_voice_snapshots` (populated by AI photo analysis) |
| **Boards / sample boards** | First-class | `boards`, `company_sample_boards` |
| **Board installations** | **No table.** `/trade-marketing/board-installations` GET returns `[]`, POST is a noop. | Inferred from `visit_photos.board_*` columns + `visit_responses` JSON containing `board_installed: 'Yes'` (set by the AI vision pipeline). |
| **Promoters** | **No table.** `/trade-marketing/promoters` GET returns `[]`, DELETE is a noop. | Probably means agents with a `field_marketing` role — no separate model. |
| **Merchandising compliance** | **No table.** `/trade-marketing/merchandising-compliance` returns `[]`. | Could be derived from AI photo analysis (`ai_compliance_score` on `visit_photos`). |
| **Channel partners** | **No table.** `/trade-marketing/channel-partners` returns `[]`. | Concept overlap with `customers` typed as wholesale/distributor. |
| **Competitor analysis** | Partial | AI photo data has competitor brand counts in `visit_photos.ai_brands_detected`; no aggregation table. |

So the conceptual landscape is **clearer than the audit suggested**. The first-class tables already exist for 5 of 9 marketing concepts. The four genuinely missing ones are the question.

## The four open decisions

For each, **pick A, B, or C**.

### 1. Board installations

**Option A — Graduate to a first-class table**
```sql
CREATE TABLE board_installations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT,                         -- where the board is installed
  visit_id TEXT,                             -- the visit that recorded the install
  brand_id TEXT,
  board_type TEXT,                           -- 'signage' | 'poster' | 'banner' | etc.
  condition TEXT,                            -- 'good' | 'damaged' | 'faded'
  installed_at TEXT,
  installed_by TEXT,                         -- user id
  photo_id TEXT,                             -- visit_photos.id
  status TEXT DEFAULT 'active',              -- 'active' | 'removed' | 'damaged'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (visit_id) REFERENCES visits(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);
```
Backfill from existing `visit_photos.board_*` rows is straightforward — write a one-shot migration job that creates one `board_installations` row per visit_photo where `board_placement_location IS NOT NULL`.

**Pros**: Reports of "how many active boards do we have at customer X?" become trivial. Field-ops agents can see the board history of a store at-a-glance. Compliance team can run audits.

**Cons**: Two sources of truth (the table and the visit_photos columns) until the AI pipeline writes both. Existing reports that aggregate from visit_photos keep working.

**Option B — Keep deriving from `visit_photos`**
Replace the stub `GET /trade-marketing/board-installations` with a real query that joins `visit_photos` ↔ `customers` ↔ `visits`, filtered to rows where `board_placement_location IS NOT NULL`. No schema change.

**Pros**: Zero data migration. Works immediately.

**Cons**: Every "list installed boards" query has to JOIN through visits. Hard to model "this board was removed" without a separate state column. Hard to track install history per customer per brand.

**Option C — Drop the endpoint**
If nobody is asking for board-installation reports, just delete the routes.

**Recommendation**: **Option A** if board tracking is a real workflow (the existence of a `boards` and `company_sample_boards` table suggests it is). If only used for one-off compliance audits, **Option B** is enough.

---

### 2. Promoters

**Option A — `marketing_promoters` table**
```sql
CREATE TABLE marketing_promoters (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,                              -- nullable: external promoters may not be platform users
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  agency_name TEXT,                          -- for outsourced promoters
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```
Lets the company track external promoters from third-party agencies separately from platform users.

**Option B — Filter `users` by role**
Treat any user with `role = 'field_marketing'` or a new `role = 'promoter'` as a promoter. Replace the stub with `SELECT * FROM users WHERE role IN ('promoter', 'field_marketing')`.

**Pros**: Zero new schema. Reuses authentication.

**Cons**: External (agency) promoters need login accounts even if they shouldn't have one.

**Recommendation**: **Option A** if you have a real third-party promoter agency relationship, otherwise **Option B**.

---

### 3. Merchandising compliance

**Option A — Compliance scorecard table**
```sql
CREATE TABLE merchandising_compliance_audits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  visit_id TEXT,
  audited_by TEXT,
  shelf_compliance_score REAL,               -- 0-100
  posm_compliance_score REAL,
  pricing_compliance_score REAL,
  overall_score REAL,                        -- weighted average
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (visit_id) REFERENCES visits(id)
);
```

**Option B — Aggregate from `visit_photos.ai_compliance_score`**
Compute on the fly: `SELECT customer_id, AVG(ai_compliance_score) FROM visit_photos vp JOIN visits v ON vp.visit_id = v.id WHERE vp.ai_compliance_score IS NOT NULL GROUP BY customer_id`.

**Pros**: Already populated by the AI pipeline (when it runs successfully).

**Cons**: AI-only. Manual auditor entries can't be captured.

**Recommendation**: **Option B** for now. Add the table only when manual compliance audits become a real workflow.

---

### 4. Channel partners

**Option A — New table**
Distinguish wholesalers / distributors / sub-distributors from retail customers in their own table.

**Option B — Customer type column**
Add `customers.partner_type TEXT` and tag accordingly. The `/trade-marketing/channel-partners` endpoint becomes `SELECT * FROM customers WHERE partner_type IS NOT NULL`.

**Recommendation**: **Option B**, almost always. A "channel partner" is a customer with extra attributes, not a fundamentally different entity.

---

## Suggested defaults if you don't want to decide each one

If you want a single ship-it-now default per concept:

| Concept | Default | Effort |
|---|---|---|
| Board installations | A (new table) | ~1 day |
| Promoters | B (filter users) | ~1 hour |
| Merchandising compliance | B (derive from AI scores) | ~2 hours |
| Channel partners | B (customer.partner_type) | ~2 hours |

Total ~1.5 days of backend work. None of these touch field-ops live data.

## What needs you, not me

- Confirm whether **board installations** are a real long-running concept (boards installed on a date, tracked over time, eventually removed) versus a one-off photo-based record. That answer chooses option A vs B above.
- Confirm whether you have a relationship with an **external promoter agency**. Drives option A vs B for promoters.
- Tell me which of the four to start with, or "all of them with the defaults above" — I'll ship them as separate branches.

Until then, the existing endpoints stay as stubs. They don't crash; they just return empty. The audit's "43 routes have no tables" claim was an overstatement — most of them do, only these four don't.
