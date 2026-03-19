# FieldVibe Testing Skills

## Devin Secrets Needed
- `GITHUB_TOKEN` — GitHub PAT for pushing branches and creating PRs
- `CLOUDFLARE_API_KEY` — Cloudflare Global API Key for deploying Workers and Pages
- `CLOUDFLARE_EMAIL` — Email associated with the Cloudflare account

## Test Credentials
- Admin login: `admin@demo.com` / `Admin@2026!`
- Backend API: `https://fieldvibe-api.reshigan-085.workers.dev`
- Frontend: `https://fieldvibe.pages.dev`

## Backend API Testing

### Full Curl Sweep
To verify all API endpoints return 200:

1. Get auth token:
```bash
TOKEN=$(curl -s -X POST https://fieldvibe-api.reshigan-085.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"Admin@2026!"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('token',''))")
```

2. Test each endpoint:
```bash
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://fieldvibe-api.reshigan-085.workers.dev/api/ENDPOINT" -H "Authorization: Bearer $TOKEN")
```

3. Key endpoint groups to test:
- `dashboard/*` — summary, KPIs, sales-by-category
- `inventory/*` — dashboard, suppliers
- `finance/*` — dashboard
- `commissions/*` — dashboard, payouts
- `insights/*` — executive, field-ops, trade-promotions, stock, goals, anomalies, competitors
- `reports/*` — executive, field-ops, inventory, trade-promotions, compliance, anomalies
- `field-ops/*` — visits, dashboard, team-performance, agent-performance
- `admin/*` — settings, roles, audit-log
- `brand-owner/*` — dashboard, reports

### Common Backend Issues
- **Route shadowing in Hono.js**: Specific routes (e.g., `/customers/dashboard`) MUST be registered before generic `:id` routes (e.g., `/customers/:id`). First match wins.
- **SQL column mismatches**: Backend queries may reference columns that don't exist in the D1 schema. Check `workers-api/src/schema.sql` for actual column names.
- **Bind parameter mismatch**: UNION ALL queries need bind parameters for EACH SELECT clause, not just one set.
- **Missing authMiddleware**: Routes without `authMiddleware` will have `c.get('tenantId')` return undefined, causing 500 errors.

## Frontend UI Testing

### Setup
1. Navigate to `https://fieldvibe.pages.dev` (or preview URL)
2. If auth token expired (stuck loading spinner), clear browser data:
   - Open DevTools > Console > `localStorage.clear()`
   - Hard reload with Ctrl+Shift+R
3. Log in with `admin@demo.com` / `Admin@2026!`

### Key Pages to Test
1. **Dashboard** — Should show KPIs (Total Revenue, Active Customers, Field Agents, Products Sold), Revenue Trends chart, Sales Performance chart
2. **Inventory > Dashboard** — KPI cards for total products, stock value, low stock items
3. **Finance > Dashboard** — Note: may redirect to main dashboard (frontend routing issue, not backend)
4. **Commissions** (under Finance sidebar) — Dashboard with commission KPIs and status summary
5. **Insights > Field Ops** — Visit summary, territories, competitor activity
6. **Insights > Executive** — Revenue trend, orders by status, top agents
7. **Field Operations > Agent Dashboard** — Today's schedule, performance metrics
8. **Customers > Directory** — Paginated customer list with search/filter
9. **Admin > Settings** — 13 settings categories
10. **Admin > Audit Log** — Search and filter with proper empty state

### Common Frontend Issues
- **Stale auth token**: After system reboots or long gaps, the auth token expires. Clear localStorage and re-login.
- **Some sidebar links redirect to main dashboard**: This is a frontend routing issue where certain sub-pages route to `/dashboard` instead of the correct path. The backend endpoints work fine.
- **Toast errors about undefined data**: Some pages show brief toast errors when API returns empty arrays. These are non-blocking.

## Deploying

### Backend (Cloudflare Workers)
```bash
export CLOUDFLARE_API_KEY="<key>"
export CLOUDFLARE_EMAIL="<email>"
cd workers-api && npx wrangler deploy
```

### Frontend (Cloudflare Pages)
```bash
cd frontend && npm run build
export CLOUDFLARE_API_KEY="<key>"
export CLOUDFLARE_EMAIL="<email>"
npx wrangler pages deploy dist --project-name=fieldvibe
```

### D1 Schema Updates
If new tables or columns are added to `workers-api/src/schema.sql`, they must be applied to the production D1 database:
```bash
npx wrangler d1 execute fieldvibe-db --remote --command="CREATE TABLE IF NOT EXISTS ..."
```
# Testing FieldVibe Platform

## Environment Setup

### Local Dev Server
1. `cd frontend && npm install && npx vite --port 5173 --host 0.0.0.0`
2. The dev server runs on port 5173 by default (vite.config.ts specifies port 12000 but `strictPort: false` allows fallback)
3. **Important**: Check `frontend/.env.local` -- it overrides `VITE_API_BASE_URL`. Make sure it points to the correct backend API endpoint.
4. The vite proxy config (for `/api` prefix) only works if `.env.local` uses `/api` as the base URL

### Production URLs
- Frontend: https://fieldvibe.pages.dev / https://fieldvibe.vantax.co.za
- Backend API: https://fieldvibe-api.vantax.co.za/api

### Deployment
- Backend: `cd workers-api && npx wrangler deploy`
- Frontend: `cd frontend && npx vite build && npx wrangler pages deploy dist --project-name=fieldvibe`
- Requires Cloudflare credentials set as env vars

## Devin Secrets Needed
- `CLOUDFLARE_API_KEY` -- Cloudflare Global API Key for deployment
- `CLOUDFLARE_EMAIL` -- Cloudflare account email
- `GITHUB_TOKEN` -- GitHub PAT for PR operations

## Test Credentials
- Super admin and regular admin credentials are stored in `workers-api/src/seed.sql`
- Super admin role: `super_admin`, regular admin role: `admin`
- If seed credentials stop working, verify via API call to `/api/auth/login` with `X-Tenant-Code` header before proceeding with UI tests
- You can create test admin users via the Super Admin > Tenant Management > Create Tenant flow

## Common Testing Flows

### Super Admin Flow
1. Login as super admin
2. Click "Super Admin" in sidebar (under PLATFORM section) to expand
3. Click "Tenant Management" sub-item
4. Verify KPI cards (Total Tenants, Active, Suspended, Total Users)
5. Click "CREATE TENANT" to test tenant creation

### ProtectedRoute Guard Testing
1. Login as a non-super-admin user
2. Navigate directly to `/superadmin/tenants` in URL bar
3. Should see "Access Denied" message with "Go Back" button
4. Sidebar should NOT show "Super Admin" nav item for non-super-admin users

## Known Gotchas

### React Form Inputs
- The login form uses React controlled inputs -- Chrome's autofill may not trigger React state updates
- If typing into form fields doesn't work, try: click the field, Ctrl+A to select all, type new value
- As a fallback, verify credentials via curl/API first, then use browser console to set values

### Port Mismatch
- vite.config.ts specifies port 12000, but the dev server typically runs on 5173
- HMR websocket connections to port 12000 will show ERR_CONNECTION_REFUSED in console -- this is harmless
- The actual API calls use VITE_API_BASE_URL from .env.local, NOT the proxy config

### audit_log Schema
- The `audit_log` table uses `old_values` and `new_values` columns (NOT `details`)
- If you see "An internal error occurred" on tenant creation or user registration, check for `details` column references in INSERT statements

### D1 Database
- Schema: `workers-api/src/schema.sql`
- Seed data: `workers-api/src/seed.sql`
- To apply schema changes: use wrangler D1 commands or redeploy the worker
