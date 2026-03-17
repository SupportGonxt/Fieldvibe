# Testing Fieldvibe Frontend

## Overview
Fieldvibe is a React (Vite + TypeScript) field operations management platform with a Cloudflare Workers backend.

## Devin Secrets Needed
- `GITHUB_PAT` — GitHub personal access token for pushing/creating PRs
- `CLOUDFLARE_GLOBAL_API_KEY` — Cloudflare Global API Key for deployment
- `CLOUDFLARE_EMAIL` — Cloudflare account email
- Cloudflare Account ID: `08596e523c096f04b56d7ae43f7821f4`

## Build & Run
```bash
cd frontend
npm install
npm run build          # Production build to dist/
npx vite preview --host 0.0.0.0 --port 4173   # Preview server
```

## Deployment to Cloudflare Pages
```bash
cd frontend
npm run build
CLOUDFLARE_API_KEY="$CLOUDFLARE_GLOBAL_API_KEY" \
CLOUDFLARE_EMAIL="$CLOUDFLARE_EMAIL" \
CLOUDFLARE_ACCOUNT_ID="08596e523c096f04b56d7ae43f7821f4" \
npx wrangler pages deploy dist --project-name=fieldvibe
```
- Production URLs: https://fieldvibe.pages.dev / https://fieldvibe.vantax.co.za
- Each deploy generates a preview URL like `https://<hash>.fieldvibe.pages.dev`

## Authentication
- Login URL: `/auth/login`
- Test credentials: `admin@demo.com` / `Admin@2026!`
- The login page shows demo hint as `admin@demo.com / admin123` but the actual working password is `Admin@2026!`
- After login, the app redirects to `/dashboard`

## Key Routes to Test
| Route | Description |
|-------|-------------|
| `/dashboard` | Main dashboard with revenue, customers, agents, products metrics |
| `/field-operations/visits` | Visit management — may show "Failed to load visits" if API has no data |
| `/field-operations/agent-dashboard` | Agent dashboard (skeleton cards) |
| `/field-operations/gps-tracking` | GPS tracking page |
| `/commissions` | Commission dashboard with stats cards |
| `/commissions/approval` | Commission approval — may crash (see known issues) |
| `/product-management/pricing` | Product pricing table with real API data |
| `/product-management/inventory` | Product inventory |
| `/product-management/hierarchy` | Product hierarchy |

## Known Issues & Gotchas
1. **Missing component imports in App.tsx cause full-app crash**: React Router evaluates ALL `<Route>` elements at mount time. If ANY route references an undefined component, the entire app renders blank (white screen). Always verify all route components are imported.
2. **Merge conflicts on App.tsx**: This file has 1000+ lines with all route definitions. When merging branches, conflicts in this file are common. Prefer testing against the deployed Cloudflare URL rather than rebuilding locally after a merge.
3. **Commission Approval page might crash**: The `/commissions/approval` route has shown "Something went wrong" error boundary crashes, likely due to the commission API response shape not matching what the component expects.
4. **Toast notifications vs alerts**: PR #14 migrated ~114 `alert()` calls to toast notifications. When testing, look for toast popups in the bottom-right corner rather than browser alert dialogs.
5. **Cloudflare API key format**: The Global API Key must be passed as `CLOUDFLARE_API_KEY` env var (not `CLOUDFLARE_API_TOKEN`). If deployment fails with "Invalid format for X-Auth-Key", the key may be truncated or expired.
6. **KWrite may intercept URLs**: On the test VM, KWrite sometimes opens URLs instead of Chrome. Kill KWrite with `killall kwrite` and use `google-chrome --no-first-run about:blank &` to launch Chrome separately, then navigate via the address bar.

## API
- Backend: https://fieldvibe-api.reshigan-085.workers.dev
- Health check: `GET /` returns basic info
- Auth: `POST /auth/login` with `{email, password}` returns JWT tokens

## CI/CD
- GitHub Actions: `.github/workflows/ci.yml` runs `npm run build` on PRs
- No automated tests exist — all verification is manual via UI
- Use `git_pr_checks` to wait for CI to pass after creating PRs
