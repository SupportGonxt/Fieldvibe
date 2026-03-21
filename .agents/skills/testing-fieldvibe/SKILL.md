# Testing FieldVibe Platform

## Devin Secrets Needed
- `CLOUDFLARE_API_KEY` - Cloudflare Global API Key for deploying to Cloudflare Pages
- `CLOUDFLARE_EMAIL` - Cloudflare account email
- `GITHUB_TOKEN` - GitHub PAT for pushing and creating PRs
- Admin login credentials (stored as Devin secrets)
- Super admin login credentials (stored as Devin secrets)

## Environment
- **Production Frontend**: https://fieldvibe.pages.dev
- **Production API**: https://fieldvibe-api.vantax.co.za/api
- **Repo**: Reshigan/Fieldvibe
- **Default Branch**: Check with `git branch -r` - may be `main` or a feature branch
- **Frontend**: React + Vite + TypeScript in `frontend/`
- **Backend**: Cloudflare Workers API in `workers-api/`
- **Database**: Cloudflare D1 (SQLite)

## Building & Deploying Frontend
```bash
cd frontend && npm run build
npx wrangler pages deploy dist --project-name=fieldvibe --branch=main
```

## Key Navigation Paths
| Page | URL Path | Sidebar |
|------|----------|--------|
| Dashboard | /dashboard | Core > Dashboard |
| GPS Tracking | /field-operations/gps-tracking | Field Operations > GPS Tracking |
| Board Placements | /field-operations/boards | Field Operations > Board Placements |
| Van Routes | /van-sales/routes | Van Sales > Routes |
| Van Inventory | /van-sales/inventory | Van Sales > Inventory |
| Inventory Dashboard | /inventory/dashboard | Inventory > Dashboard |
| Insights | /insights | Core > Insights |

## Common Issues

### Service Worker Caching
The app is a PWA with a service worker that aggressively caches JS chunks. After deploying a new build:
- The old service worker may serve stale JS files, causing pages to appear broken or show old bugs
- **Fix**: Hard refresh (Ctrl+Shift+R) or clear site data in DevTools > Application > Storage > Clear site data
- When testing after deployment, always do a hard refresh first

### "is not a function" Errors
These occur when frontend pages call methods on service classes that don't exist. Common pattern:
- Page imports `someService` and calls `someService.methodName()`
- But `methodName` was never defined in the service class
- The fix is to add the missing method to the service file, often as an alias to an existing method
- To audit: grep for all `serviceInstance.methodName()` calls and compare against defined methods in the service file

### API Route 404s
The `apiClient` has a baseURL that already includes `/api`. If service methods also prefix with `/api/`, the request goes to `/api/api/...` which returns 404.
- **Fix**: Remove the `/api/` prefix from service method URLs

### Backend D1 Errors
Some pages show "Failed to load" errors because:
- The D1 database table might not exist (schema not migrated)
- The table exists but has no seed data
- **Fix**: Run schema migrations and seed data against the production D1 database

## Testing Checklist
1. Hard refresh the production app to bypass service worker cache
2. Log in with admin credentials
3. Navigate to each major section and verify no JS crashes
4. Check browser console for "is not a function" errors
5. Check Network tab for 404 API responses
6. Test create/update/delete flows on transaction pages
