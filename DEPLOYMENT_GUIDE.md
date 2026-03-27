# FieldVibe Platform - Deployment Guide

**Status:** Ready for Deployment  
**Last Updated:** 2026-03-27

---

## ⚠️ Important: GitHub Actions Workflow Scope

The push was blocked because GitHub requires the `workflow` scope on Personal Access Tokens to create/update GitHub Actions workflow files.

### Solution: Update Your Personal Access Token

#### Option 1: Update Existing Token (Recommended)

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Find your token
3. Click "Edit"
4. Check the **`workflow`** scope (in addition to existing scopes)
5. Click "Update token"
6. Push again:
   ```bash
   cd /workspace/project/Fieldvibe
   git push origin main
   ```

#### Option 2: Create New Token with Workflow Scope

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
   - ✅ `write:packages` (if using packages)
   - ✅ `delete:packages` (if needed)
4. Generate token
5. Update remote URL:
   ```bash
   git remote set-url origin https://YOUR_NEW_TOKEN@github.com/Reshigan/Fieldvibe.git
   git push origin main
   ```

#### Option 3: Push Without Workflow File (Temporary)

If you can't update the token immediately:

```bash
# Temporarily move workflow file
mv .github/workflows/ci-cd.yml .github/workflows/ci-cd.yml.bak

# Push without workflow
git add .github/workflows/ci-cd.yml.bak
git commit --amend -m "feat: Complete best-in-world platform enhancements (no workflow)"
git push origin main

# Restore workflow file
mv .github/workflows/ci-cd.yml.bak .github/workflows/ci-cd.yml

# Later, when token is updated:
git add .github/workflows/ci-cd.yml
git commit -m "feat: Add CI/CD pipeline"
git push origin main
```

---

## 🚀 Deployment Checklist

### Pre-Deployment Requirements

- [ ] GitHub token updated with `workflow` scope
- [ ] Cloudflare account configured
- [ ] Database backup completed
- [ ] Staging environment tested (recommended)

### GitHub Secrets Required

Set these secrets in GitHub Repository Settings → Secrets and variables → Actions:

```
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
SNYK_TOKEN=your_snyk_token (optional, for security scanning)
```

### Step 1: Database Migration

**⚠️ CRITICAL: Backup database first!**

```bash
# Export current database
npx wrangler d1 execute fieldvibe-db --remote --command=".backup production-backup-$(date +%Y%m%d).sql"

# Run enhanced schema migration
cd workers-api
npx wrangler d1 execute fieldvibe-db --remote --file=src/database/migrations/002_enhanced_schema.sql

# Verify migration
npx wrangler d1 execute fieldvibe-db --remote --command="SELECT COUNT(*) FROM schema_migrations;"
```

### Step 2: Deploy Backend

```bash
cd workers-api

# Deploy to Cloudflare Workers
npx wrangler deploy

# Verify deployment
curl https://fieldvibe.vantax.co.za/api/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "v1",
  "timestamp": "2026-03-27T..."
}
```

### Step 3: Deploy Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Upload to hosting (adjust based on your hosting)
# Option A: Cloudflare Pages
npx wrangler pages deploy dist/

# Option B: Manual upload
# Upload dist/ folder to your hosting provider
```

### Step 4: Verify CI/CD Pipeline

After pushing to GitHub, the pipeline should run automatically:

1. Go to: https://github.com/Reshigan/Fieldvibe/actions
2. Verify all checks pass:
   - ✅ Lint & Type Check
   - ✅ Security Scan
   - ✅ Unit Tests
   - ✅ Integration Tests
   - ✅ Build Frontend
   - ✅ Build Backend
   - ✅ Deploy to Staging (if develop branch)
   - ✅ Deploy to Production (if main branch)

---

## 📊 Post-Deployment Verification

### Health Checks

```bash
# API Health
curl https://fieldvibe.vantax.co.za/api/v1/health

# API Version
curl https://fieldvibe.vantax.co.za/api/v1/version

# Frontend
curl https://fieldvibe.vantax.co.za
```

### Database Verification

```bash
# Check new tables exist
npx wrangler d1 execute fieldvibe-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# Should show 18 tables including:
# - audit_logs
# - user_sessions
# - api_keys
# - commission_structures
# - commission_calculations
# - daily_metrics
# - system_settings
# - schema_migrations
```

### Functionality Tests

1. **Authentication**
   - [ ] Login works
   - [ ] MFA enrollment available
   - [ ] Session management functional

2. **Core Features**
   - [ ] Visits can be created
   - [ ] Customers can be managed
   - [ ] Reports generate correctly

3. **New Features**
   - [ ] Audit logs are being created
   - [ ] Health endpoint returns metrics
   - [ ] Monitoring is collecting data

---

## 🔧 Troubleshooting

### Deployment Fails

**Error: D1 migration failed**
```bash
# Check migration syntax
npx wrangler d1 execute fieldvibe-db --local --file=src/database/migrations/002_enhanced_schema.sql

# Check existing migrations
npx wrangler d1 execute fieldvibe-db --remote --command "SELECT * FROM schema_migrations;"
```

**Error: Workers deployment failed**
```bash
# Validate wrangler config
npx wrangler deploy --dry-run

# Check account ID
npx wrangler whoami
```

**Error: Frontend build fails**
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install
npm run build

# Check TypeScript errors
npm run typecheck
```

### CI/CD Pipeline Fails

**Workflow permissions error:**
- Update GitHub token with `workflow` scope (see above)

**Tests failing:**
```bash
# Run tests locally
cd workers-api
npm test

# Run with coverage
npm run test:coverage
```

**Security scan fails:**
- Review vulnerabilities at: https://app.snyk.io
- Update vulnerable dependencies: `npm audit fix`

---

## 📈 Monitoring Post-Deployment

### Set Up Monitoring

1. **Sentry (Error Tracking)**
   ```bash
   # Install Sentry
   npm install @sentry/browser @sentry/integrations
   
   # Configure in frontend/src/main.tsx
   ```

2. **Grafana (Dashboards)**
   - Set up Grafana Cloud
   - Connect to Cloudflare Logs
   - Create dashboards for:
     - API response times
     - Error rates
     - Request volumes
     - Database performance

3. **Uptime Monitoring**
   - Set up UptimeRobot or similar
   - Monitor: https://fieldvibe.vantax.co.za/api/v1/health
   - Alert on downtime

### Key Metrics to Watch

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API Response Time (p95) | <100ms | >500ms |
| Error Rate | <0.1% | >1% |
| Uptime | 99.95% | <99.9% |
| Database Query Time | <50ms | >200ms |

---

## 🎯 Rollback Plan

If issues occur after deployment:

### Quick Rollback

```bash
# Rollback Cloudflare Workers
npx wrangler rollback

# Restore database from backup
npx wrangler d1 execute fieldvibe-db --remote --file=production-backup-YYYYMMDD.sql

# Redeploy previous version
git checkout <previous-commit>
git push origin main --force
```

### Partial Rollback

If only specific features have issues:

```bash
# Disable new features via feature flags
# (Implement feature flags in system_settings table)
```

---

## 📞 Support Contacts

- **Technical Issues:** Check GitHub Actions logs
- **Database Issues:** Review D1 dashboard
- **Cloudflare Issues:** Check Workers dashboard
- **Emergency:** Contact on-call engineer

---

## ✅ Deployment Sign-Off

After successful deployment:

- [ ] All health checks passing
- [ ] Database migration verified
- [ ] CI/CD pipeline green
- [ ] Monitoring configured
- [ ] Team notified
- [ ] Documentation updated
- [ ] Backup strategy confirmed

**Deployment Complete:** _______________  
**Deployed By:** _______________  
**Version:** 2.0.0  

---

**Document Version:** 1.0  
**Created:** 2026-03-27  
**Next Review:** After first production deployment
