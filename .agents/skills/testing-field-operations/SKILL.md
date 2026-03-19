# Testing Field Operations on FieldVibe Production

## Overview
Field Operations has 6 pages under the sidebar menu: Working Days, Monthly Targets, Commission Tiers, Settings, Hierarchy, Daily Targets. These require 4 D1 database tables: `field_ops_settings`, `working_days_config`, `monthly_targets`, `target_commission_tiers`.

## Devin Secrets Needed
- `Cloudflare` — Cloudflare Global API Key for D1 queries and deployments
- `Cloudflareusername` — Cloudflare account email
- `github` — GitHub PAT for API access and PR management

## Production Environment
- **Frontend**: https://production.fieldvibe.pages.dev
- **Backend API**: https://fieldvibe-api.vantax.co.za/api
- **D1 Database ID**: found in `workers-api/wrangler.toml` under `[[d1_databases]]`
- **Cloudflare Account ID**: found in `workers-api/wrangler.toml` or Cloudflare dashboard
- **Login**: Use the demo admin credentials (stored in Devin secrets or ask user)

## D1 Schema Migrations
When new tables are added to `workers-api/src/schema.sql`, they are NOT automatically applied to the production D1 database. The CI/CD pipeline only deploys the Workers code, not schema changes.

### How to apply schema to D1
Use the Cloudflare REST API directly (wrangler auth may fail with Global API Key):

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/d1/database/<DB_ID>/query" \
  -H "X-Auth-Email: $Cloudflareusername" \
  -H "X-Auth-Key: $Cloudflare" \
  -H "Content-Type: application/json" \
  -d '{"sql": "YOUR_SQL_HERE"}'
```

### Important: Tenant ID
The production tenant ID may differ from the seed data in schema.sql. Always check:
```sql
SELECT id, name FROM tenants LIMIT 10
```
And use the correct tenant ID when seeding data. The schema.sql seed data may use a placeholder tenant ID that doesn't exist in production.

## Cloudflare Auth Notes
- The `CLOUDFLARE_ACCOUNT_ID_` secret may contain the wrong value. Always verify against `wrangler.toml`.
- The `Cloudflareusername` secret may have typos. Verify the correct email with the user.
- `wrangler` CLI with `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL` env vars may fail authentication. Prefer using `curl` directly with the Cloudflare REST API.

## Test Flow
1. **Bug fixes**: Navigate to `/admin/users` and `/field-operations/visits/create` — both should load without crash
2. **Settings**: Navigate to Field Operations > Settings, change a value, click Save Settings, refresh to verify persistence
3. **Working Days**: Navigate to Working Days, click Add Config, save with Mon-Fri defaults, verify row appears
4. **Monthly Targets**: Navigate to Monthly Targets, click Add Target, select an agent from dropdown, set target values, click Create Target, verify row appears with summary cards updated
5. **Commission Tiers**: Navigate to Commission Tiers, verify seeded tiers display correctly
6. **Hierarchy**: Navigate to Hierarchy, verify managers and unassigned agents display correctly
7. **Daily Targets**: Navigate to Daily Targets, verify date picker and empty table display correctly

## CI/CD
GitHub Actions auto-deploys on merge to `main`:
- Frontend → Cloudflare Pages (project name in wrangler config, branch: production)
- Backend → Cloudflare Workers
- D1 schema changes are NOT auto-applied — must be done manually via API
