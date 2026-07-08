# Goldrush Masterdata Report — 2026-07-08

Tenant `default-tenant-001`, company `abd43534-294b-4e8e-aea2-153e0773a924`. Production D1 (`fieldvibe-db`).

## Volumes

| Entity | Count | Notes |
|---|---|---|
| Visits | 43,754 | 100% completed; 41,561 individual / 2,193 store; range 2025-09-02 → 2026-07-08 |
| Visit individuals | 39,955 | 457 rows have empty `{}` custom_field_values |
| Visit responses | 18,596 | |
| Visit photos | 3,317 | 12 approved / 3,290 pending review |
| Customers | 2,543 | 1,942 have at least one visit |
| Products | 51 | |
| Active users | 88 | 66 active agents; 89 distinct agents own visits (34 now inactive) |

## Referential integrity — CLEAN

Zero orphans on every cross-module reference checked:

- visits → customers: 0 orphans
- visits → agents (users): 0 orphans
- visit_photos → visits: 0 orphans
- visit_individuals → visits: 0 orphans
- visit_responses → visits: 0 orphans
- customers with empty/null name: 0

## Conversions bug — FOUND AND FIXED

Every conversion metric (KPI cockpit, brand-insights, shops-analytics, agent performance, company dashboard, exports) read `JSON_EXTRACT(custom_field_values,'$.converted') = 1`. Goldrush data stores the flag as `consumer_converted` with string values `"Yes"`/`"No"`. Result: all conversion counts returned 0 while 10,686 real conversions existed.

Actual distribution across 39,955 visit_individuals: `"Yes"` = 10,686, `"No"` = 12,375, null/absent = 16,894.

Fix (deployed, worker version `6cf17afc`): all 37 query sites across `workers-api/src/index.js` and `workers-api/src/routes/field-ops/kpi.js` now treat a row as converted when `$.converted = 1` OR `$.consumer_converted = 'Yes'` — both schemas keep working. Verified live: brand-insights now reports 3,019 conversions in its window at a 43% conversion rate (was 0).

## Data-quality flags (no code fix needed; operational follow-ups)

1. **334 duplicate customer-name groups** — same name entered more than once; consider a merge/dedup pass.
2. **518 customers without geo coordinates** — map views and route planning blind to these.
3. **3,290 photos pending review** (only 12 approved ever) — review queue effectively unused.
4. **34 inactive agents still own historical visits** — expected (staff churn), but reports filtering to active agents will under-count history.
5. **457 visit_individuals with empty `{}` custom_field_values** — no survey answers captured; excluded from conversion metrics by design.

## Route health (post-fix probe)

394 GET routes probed with admin token: **391 × 200**, **3 × 400** (legitimate required-param guards: company-dashboard `company_id`, customer-prices `customer_id`, quote `product_id`), **0 × 5xx**.
