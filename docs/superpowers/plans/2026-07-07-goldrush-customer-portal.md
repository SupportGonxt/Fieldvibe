# Goldrush Customer Portal (Phase F) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone, read-only, per-customer web portal where each Goldrush customer logs in to see only their own company's visit/individual data, imagery, and AI insights — never agent identity, performance, pay, tiers, P&L, or other tenants' data.

**Architecture:** New `portal_users` + `portal_dashboard_config` tables (runtime-bootstrapped, mirroring `ensureCaptureFailures`). Portal auth reuses the existing `generateToken`/bcrypt/`JWT_SECRET` primitives but mints tokens with `aud:'portal'` carrying `company_id`; a dedicated `portalAuthMiddleware` accepts only `aud:'portal'` tokens and the staff `authMiddleware` rejects them. Portal data endpoints re-serve the goldrush report queries **scoped to the token's company_id and stripped of every agent column**. A sane default dashboard config is seeded per company. Delivery is a separate Vite/React/Tailwind app (`portal/`) scaffolded from the existing `frontend` config, talking only to `/portal/*`.

**Tech Stack:** Cloudflare Workers + Hono + D1 (backend, inline in `workers-api/src/index.js`); Vite + React + TS + Tailwind (frontend + new portal app); bcryptjs; Workers AI (`@cf/meta/llama-3.2-11b-vision-instruct` family) for the AI summary; lucide-react icons.

## Global Constraints

- **Branch:** all work on `dev`. NO prod D1 migration (`fieldvibe-db`), NO `dev`→`main` merge, NO prod secrets — STOP GATE, human go-ahead only.
- **No emojis.** UI uses custom icons (lucide-react), never emoji.
- **Zero staff data leak:** no `/portal/*` response may contain agent identity, agent/team/management performance, commission/pay/tiers, P&L, reconcile/BO tooling, or any other tenant's data. Enforced server-side: portal queries never SELECT agent columns and are filtered by the token's `company_id` (never a client-supplied one).
- **JWT audience isolation:** portal tokens carry `aud:'portal'`; `portalAuthMiddleware` rejects any token without it; staff `authMiddleware` rejects any token with `aud:'portal'`. Reuse existing `generateToken(payload, secret, expiresIn)` (index.js:457) and bcrypt(10) — no new crypto.
- **Runtime table bootstrap:** new tables get an `ensurePortalTables(db)` helper mirroring `ensureCaptureFailures` (index.js:9116), plus DDL in `schema.sql`, because dev D1 is migrated by hand.
- **Verify commands:** backend `node --check src/index.js` (from `workers-api/`) + `npm run test:pure`; frontend/portal `npm run build`.
- **Env bindings:** `c.env.DB` (D1), `c.env.JWT_SECRET`, `c.env.AI`, `c.env.UPLOADS` (R2), `c.env.FRONTEND_URL`.

---

### Task F1: Portal schema + pure helpers

**Files:**
- Create: `workers-api/src/services/portal.js`
- Create: `workers-api/tests/unit/portal.test.js`
- Modify: `workers-api/tests/unit/vitest.node.config.js` (append `'tests/unit/portal.test.js'`)
- Modify: `workers-api/src/schema.sql` (append two `CREATE TABLE IF NOT EXISTS`)

**Interfaces:**
- Produces:
  - `defaultDashboardConfig(companyId) -> { company_id, widgets: Array<{type,title,source,options}> }`
  - `assertPortalToken(payload) -> true` (throws `Error('not a portal token')` if `payload.aud !== 'portal'` or no `payload.portalUserId`)
  - `inviteTokenExpired(expiresAtIso, nowSec) -> boolean`
  - `serializeIndividualForPortal(row) -> object` (agent columns removed)
  - `serializeStoreForPortal(row) -> object` (agent columns removed)
  - `PORTAL_AGENT_FIELDS: string[]` (the denylist: `agent_id`, `agent_name`, `uploaded_by`, `created_by`, `commission_earnings`, `commission`, `tier`, `base_salary`)

- [ ] **Step 1: Write the failing test** — `workers-api/tests/unit/portal.test.js`

```js
import { describe, it, expect } from 'vitest';
import {
  defaultDashboardConfig,
  assertPortalToken,
  inviteTokenExpired,
  serializeIndividualForPortal,
  serializeStoreForPortal,
  PORTAL_AGENT_FIELDS,
} from '../../src/services/portal.js';

describe('defaultDashboardConfig', () => {
  it('returns overview KPIs + individuals + stores + insights widgets scoped to the company', () => {
    const cfg = defaultDashboardConfig('co-1');
    expect(cfg.company_id).toBe('co-1');
    const types = cfg.widgets.map(w => w.type);
    expect(types).toEqual(['kpi', 'individuals_table', 'stores_table', 'insights']);
    cfg.widgets.forEach(w => {
      expect(typeof w.title).toBe('string');
      expect(w.title.length).toBeGreaterThan(0);
    });
  });
});

describe('assertPortalToken', () => {
  it('accepts a portal token', () => {
    expect(assertPortalToken({ aud: 'portal', portalUserId: 'p1', companyId: 'c1' })).toBe(true);
  });
  it('rejects a staff token (no aud) or wrong aud or missing portalUserId', () => {
    expect(() => assertPortalToken({ userId: 'u1', role: 'admin' })).toThrow();
    expect(() => assertPortalToken({ aud: 'staff', portalUserId: 'p1' })).toThrow();
    expect(() => assertPortalToken({ aud: 'portal' })).toThrow();
  });
});

describe('inviteTokenExpired', () => {
  it('true when past expiry, false when before', () => {
    const now = 1_000_000;
    expect(inviteTokenExpired(new Date((now - 10) * 1000).toISOString(), now)).toBe(true);
    expect(inviteTokenExpired(new Date((now + 10) * 1000).toISOString(), now)).toBe(false);
  });
  it('true for null/blank/unparseable expiry (fail closed)', () => {
    expect(inviteTokenExpired(null, 1000)).toBe(true);
    expect(inviteTokenExpired('', 1000)).toBe(true);
    expect(inviteTokenExpired('not-a-date', 1000)).toBe(true);
  });
});

describe('serializeIndividualForPortal / serializeStoreForPortal', () => {
  it('strips every agent/pay field from the row', () => {
    const row = { id: 'v1', first_name: 'A', agent_id: 'ag1', agent_name: 'Spy', commission: 5, tier: 'gold', keep: 'yes' };
    const out = serializeIndividualForPortal(row);
    PORTAL_AGENT_FIELDS.forEach(f => expect(out).not.toHaveProperty(f));
    expect(out.first_name).toBe('A');
    expect(out.keep).toBe('yes');
    const s = serializeStoreForPortal({ id: 's1', store_name: 'X', agent_name: 'Spy', uploaded_by: 'ag1' });
    expect(s).not.toHaveProperty('agent_name');
    expect(s).not.toHaveProperty('uploaded_by');
    expect(s.store_name).toBe('X');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers-api && npx vitest run --config tests/unit/vitest.node.config.js tests/unit/portal.test.js`
Expected: FAIL — `Cannot find module '../../src/services/portal.js'`

- [ ] **Step 3: Write minimal implementation** — `workers-api/src/services/portal.js`

```js
// Pure helpers for the customer portal (Phase F). No DB/IO — unit-testable
// without a Workers runtime. Consumed by src/index.js portal routes.

// Fields that must NEVER reach a customer. The portal SQL already avoids
// selecting these, but the serializer is a belt-and-braces second gate.
export const PORTAL_AGENT_FIELDS = [
  'agent_id', 'agent_name', 'uploaded_by', 'created_by',
  'commission_earnings', 'commission', 'tier', 'base_salary',
];

function stripAgentFields(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const k of Object.keys(row)) {
    if (!PORTAL_AGENT_FIELDS.includes(k)) out[k] = row[k];
  }
  return out;
}

export const serializeIndividualForPortal = stripAgentFields;
export const serializeStoreForPortal = stripAgentFields;

// Seeded per company so a freshly-invited customer sees a useful portal
// before any staff curation. widget.source references a capture_steps key,
// a store-insight field, or a built-in metric.
export function defaultDashboardConfig(companyId) {
  return {
    company_id: companyId,
    widgets: [
      { type: 'kpi', title: 'Overview', source: 'builtin:overview', options: {} },
      { type: 'individuals_table', title: 'Registrations', source: 'builtin:individuals', options: { pageSize: 25 } },
      { type: 'stores_table', title: 'Stores', source: 'builtin:stores', options: { pageSize: 25 } },
      { type: 'insights', title: 'Store Insights', source: 'builtin:insights', options: {} },
    ],
  };
}

// Portal tokens are their own JWT audience. Throw (caller -> 401) unless the
// decoded payload is a portal token carrying a portal user id.
export function assertPortalToken(payload) {
  if (!payload || payload.aud !== 'portal' || !payload.portalUserId) {
    throw new Error('not a portal token');
  }
  return true;
}

// Fail closed: any missing/unparseable expiry counts as expired.
export function inviteTokenExpired(expiresAtIso, nowSec) {
  if (!expiresAtIso) return true;
  const t = Date.parse(expiresAtIso);
  if (Number.isNaN(t)) return true;
  return Math.floor(t / 1000) <= nowSec;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd workers-api && npx vitest run --config tests/unit/vitest.node.config.js tests/unit/portal.test.js`
Expected: PASS (all cases)

- [ ] **Step 5: Wire the new test into the pure-test config** — `workers-api/tests/unit/vitest.node.config.js`

Append `'tests/unit/portal.test.js'` to the `include` array (after `'tests/unit/goldrushVision.test.js'`). Then run the full pure suite:

Run: `cd workers-api && npm run test:pure`
Expected: PASS (prior 71 + new portal cases)

- [ ] **Step 6: Add DDL to schema.sql** — append near the other Goldrush tables:

```sql
-- Customer portal (Phase F): per-customer read-only accounts, one company each.
CREATE TABLE IF NOT EXISTS portal_users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,
  invite_token TEXT,
  invite_expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'invited',
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_users_tenant_email ON portal_users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_portal_users_invite ON portal_users(invite_token);

-- One dashboard config row per company; widgets is a JSON array.
CREATE TABLE IF NOT EXISTS portal_dashboard_config (
  company_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  widgets TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

- [ ] **Step 7: Commit**

```bash
git add workers-api/src/services/portal.js workers-api/tests/unit/portal.test.js workers-api/tests/unit/vitest.node.config.js workers-api/src/schema.sql
git commit -m "feat(portal): schema + pure helpers (dashboard defaults, token/serializer guards)"
```

---

### Task F2: Portal auth — bootstrap, mint, middleware, accept-invite/login

**Files:**
- Modify: `workers-api/src/index.js` (add `ensurePortalTables`, `portalAuthMiddleware`, aud guard in `authMiddleware`, `POST /portal/auth/accept-invite`, `POST /portal/auth/login`)

**Interfaces:**
- Consumes: `generateToken` (index.js:457), `bcrypt` (imported), `assertPortalToken`, `inviteTokenExpired`, `defaultDashboardConfig` (from `services/portal.js`).
- Produces:
  - `async function ensurePortalTables(db)` — idempotent CREATE of both portal tables (mirrors `ensureCaptureFailures`), safe to call on every portal request path.
  - `const portalAuthMiddleware` — verifies HS256 sig with `JWT_SECRET`, decodes, calls `assertPortalToken(payload)`, checks exp, sets `c.set('portalUserId')`, `c.set('portalTenantId')`, `c.set('portalCompanyId')`. Rejects (401) staff tokens.
  - Portal JWT payload shape: `{ portalUserId, tenantId, companyId, aud: 'portal' }`.

- [ ] **Step 1: Add `import { defaultDashboardConfig, assertPortalToken, inviteTokenExpired, serializeIndividualForPortal, serializeStoreForPortal } from './services/portal.js';`** next to the existing `goldrushVision` import.

- [ ] **Step 2: Add the aud guard to staff `authMiddleware`** — after `const payload = JSON.parse(atob(parts[1]));` and the exp check (index.js ~509-512), before `c.set('userId', ...)`, insert:

```js
    if (payload.aud === 'portal') {
      return c.json({ success: false, message: 'Portal token not valid for staff API' }, 401);
    }
```

- [ ] **Step 3: Add `ensurePortalTables` + `portalAuthMiddleware`** near `ensureCaptureFailures` (index.js ~9116):

```js
async function ensurePortalTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS portal_users (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT NOT NULL,
    email TEXT NOT NULL, password_hash TEXT, invite_token TEXT, invite_expires_at TEXT,
    status TEXT NOT NULL DEFAULT 'invited', created_by TEXT, created_at TEXT DEFAULT (datetime('now'))
  )`).run();
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_users_tenant_email ON portal_users(tenant_id, email)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_portal_users_invite ON portal_users(invite_token)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS portal_dashboard_config (
    company_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, widgets TEXT NOT NULL,
    updated_by TEXT, updated_at TEXT DEFAULT (datetime('now'))
  )`).run();
}

const portalAuthMiddleware = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : c.req.query('access_token');
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);
    const parts = token.split('.');
    if (parts.length !== 3) return c.json({ success: false, message: 'Malformed token' }, 401);
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) return c.json({ success: false, message: 'Server configuration error' }, 500);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signatureBytes = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(parts[0] + '.' + parts[1]));
    if (!valid) return c.json({ success: false, message: 'Invalid token signature' }, 401);
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) return c.json({ success: false, message: 'Token expired' }, 401);
    try { assertPortalToken(payload); } catch { return c.json({ success: false, message: 'Not a portal token' }, 401); }
    c.set('portalUserId', payload.portalUserId);
    c.set('portalTenantId', payload.tenantId);
    c.set('portalCompanyId', payload.companyId);
    await next();
  } catch (e) {
    return c.json({ success: false, message: 'Invalid token' }, 401);
  }
};
```

- [ ] **Step 4: Add `POST /portal/auth/accept-invite` and `POST /portal/auth/login`** (mount on `app`, alongside `/api/auth/login`):

```js
app.post('/portal/auth/accept-invite', rateLimiter(5, 900000), async (c) => {
  try {
    const db = c.env.DB;
    await ensurePortalTables(db);
    const { token, password } = await c.req.json();
    if (!token || !password || String(password).length < 8) {
      return c.json({ success: false, message: 'Token and an 8+ char password are required' }, 400);
    }
    const user = await db.prepare("SELECT * FROM portal_users WHERE invite_token = ? AND status = 'invited'").bind(token).first();
    if (!user) return c.json({ success: false, message: 'Invalid or already-used invite' }, 400);
    if (inviteTokenExpired(user.invite_expires_at, Math.floor(Date.now() / 1000))) {
      return c.json({ success: false, message: 'Invite expired' }, 400);
    }
    const hash = await bcrypt.hash(password, 10);
    await db.prepare("UPDATE portal_users SET password_hash = ?, status = 'active', invite_token = NULL, invite_expires_at = NULL WHERE id = ?").bind(hash, user.id).run();
    const jwtSecret = c.env.JWT_SECRET;
    const accessToken = await generateToken({ portalUserId: user.id, tenantId: user.tenant_id, companyId: user.company_id, aud: 'portal' }, jwtSecret);
    return c.json({ success: true, data: { token: accessToken, access_token: accessToken } });
  } catch (e) {
    return c.json({ success: false, message: 'Could not accept invite' }, 500);
  }
});

app.post('/portal/auth/login', rateLimiter(5, 900000), async (c) => {
  try {
    const db = c.env.DB;
    await ensurePortalTables(db);
    const { email, password } = await c.req.json();
    if (!email || !password) return c.json({ success: false, message: 'Email and password are required' }, 400);
    const user = await db.prepare("SELECT * FROM portal_users WHERE email = ? AND status = 'active'").bind(String(email).toLowerCase().trim()).first();
    if (!user || !user.password_hash) return c.json({ success: false, message: 'Invalid credentials' }, 401);
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return c.json({ success: false, message: 'Invalid credentials' }, 401);
    const jwtSecret = c.env.JWT_SECRET;
    const accessToken = await generateToken({ portalUserId: user.id, tenantId: user.tenant_id, companyId: user.company_id, aud: 'portal' }, jwtSecret);
    return c.json({ success: true, data: { token: accessToken, access_token: accessToken } });
  } catch (e) {
    return c.json({ success: false, message: 'Login failed' }, 500);
  }
});
```

- [ ] **Step 5: Verify backend syntax**

Run: `cd workers-api && node --check src/index.js`
Expected: no output (SYNTAX_OK)

- [ ] **Step 6: Verify pure suite still green**

Run: `cd workers-api && npm run test:pure`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add workers-api/src/index.js
git commit -m "feat(portal): auth — aud:'portal' JWT, portal middleware, accept-invite + login"
```

---

### Task F3: Staff-side portal admin endpoints (`/field-ops/portal/*`)

**Files:**
- Modify: `workers-api/src/index.js` (five endpoints under `api`, all `authMiddleware` + `requireRole('admin','general_manager')`)

**Interfaces:**
- Consumes: `ensurePortalTables`, `defaultDashboardConfig`, `crypto.randomUUID()` for ids + invite tokens, `resolveReportCompanyId(db, tenantId, company_id)` (existing, index.js:~17703) to validate the company.
- Produces endpoints:
  - `POST /field-ops/portal/users` `{ email, company_id }` → creates `status='invited'` row, returns `{ id, invite_token, invite_url }` (invite_url = `${FRONTEND_URL-derived portal base}/accept-invite?token=...` — see step).
  - `GET /field-ops/portal/users?company_id=` → list (no password_hash).
  - `DELETE /field-ops/portal/users/:id` → set `status='disabled'`.
  - `GET /field-ops/portal/dashboard-config?company_id=` → the row's widgets (seeds+returns default if none).
  - `PUT /field-ops/portal/dashboard-config` `{ company_id, widgets }` → upsert.

- [ ] **Step 1: Add the five endpoints** (place near other `/field-ops/reports/goldrush-*` endpoints):

```js
api.post('/field-ops/portal/users', authMiddleware, requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  await ensurePortalTables(db);
  const tenantId = c.get('tenantId');
  const staffId = c.get('userId');
  const { email, company_id } = await c.req.json();
  if (!email || !company_id) return c.json({ success: false, message: 'email and company_id are required' }, 400);
  const companyId = await resolveReportCompanyId(db, tenantId, company_id);
  if (!companyId) return c.json({ success: false, message: 'Company not found' }, 404);
  const normEmail = String(email).toLowerCase().trim();
  const existing = await db.prepare('SELECT id, status FROM portal_users WHERE tenant_id = ? AND email = ?').bind(tenantId, normEmail).first();
  const id = existing ? existing.id : crypto.randomUUID();
  const inviteToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  if (existing) {
    await db.prepare("UPDATE portal_users SET company_id = ?, invite_token = ?, invite_expires_at = ?, status = 'invited' WHERE id = ?").bind(companyId, inviteToken, expires, id).run();
  } else {
    await db.prepare("INSERT INTO portal_users (id, tenant_id, company_id, email, invite_token, invite_expires_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?, 'invited', ?)").bind(id, tenantId, companyId, normEmail, inviteToken, expires, staffId).run();
  }
  const portalBase = (c.env.PORTAL_URL || c.env.FRONTEND_URL || '').replace(/\/$/, '');
  return c.json({ success: true, data: { id, invite_token: inviteToken, invite_url: `${portalBase}/accept-invite?token=${inviteToken}` } });
});

api.get('/field-ops/portal/users', authMiddleware, requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  await ensurePortalTables(db);
  const tenantId = c.get('tenantId');
  const { company_id } = c.req.query();
  let sql = 'SELECT id, tenant_id, company_id, email, status, invite_expires_at, created_by, created_at FROM portal_users WHERE tenant_id = ?';
  const binds = [tenantId];
  if (company_id) { sql += ' AND company_id = ?'; binds.push(company_id); }
  const rows = await db.prepare(sql + ' ORDER BY created_at DESC').bind(...binds).all();
  return c.json({ success: true, data: rows.results || [] });
});

api.delete('/field-ops/portal/users/:id', authMiddleware, requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  await ensurePortalTables(db);
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare("UPDATE portal_users SET status = 'disabled' WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true });
});

api.get('/field-ops/portal/dashboard-config', authMiddleware, requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  await ensurePortalTables(db);
  const tenantId = c.get('tenantId');
  const { company_id } = c.req.query();
  const companyId = await resolveReportCompanyId(db, tenantId, company_id || null);
  if (!companyId) return c.json({ success: false, message: 'Company not found' }, 404);
  const row = await db.prepare('SELECT widgets FROM portal_dashboard_config WHERE company_id = ? AND tenant_id = ?').bind(companyId, tenantId).first();
  const widgets = row ? JSON.parse(row.widgets) : defaultDashboardConfig(companyId).widgets;
  return c.json({ success: true, data: { company_id: companyId, widgets } });
});

api.put('/field-ops/portal/dashboard-config', authMiddleware, requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  await ensurePortalTables(db);
  const tenantId = c.get('tenantId');
  const staffId = c.get('userId');
  const { company_id, widgets } = await c.req.json();
  const companyId = await resolveReportCompanyId(db, tenantId, company_id || null);
  if (!companyId) return c.json({ success: false, message: 'Company not found' }, 404);
  if (!Array.isArray(widgets)) return c.json({ success: false, message: 'widgets must be an array' }, 400);
  await db.prepare(`INSERT INTO portal_dashboard_config (company_id, tenant_id, widgets, updated_by, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(company_id) DO UPDATE SET widgets = excluded.widgets, updated_by = excluded.updated_by, updated_at = datetime('now')`)
    .bind(companyId, tenantId, JSON.stringify(widgets), staffId).run();
  return c.json({ success: true, data: { company_id: companyId, widgets } });
});
```

- [ ] **Step 2: Verify backend syntax** — `cd workers-api && node --check src/index.js` → SYNTAX_OK
- [ ] **Step 3: Verify pure suite** — `cd workers-api && npm run test:pure` → PASS
- [ ] **Step 4: Commit**

```bash
git add workers-api/src/index.js
git commit -m "feat(portal): staff admin endpoints — invite/list/disable users + dashboard-config CRUD"
```

---

### Task F4: Portal data endpoints (`/portal/*`, portal session only)

**Files:**
- Modify: `workers-api/src/index.js` (portal data endpoints under `app`, all `portalAuthMiddleware`)

**Interfaces:**
- Consumes: `portalAuthMiddleware` (sets `portalTenantId`/`portalCompanyId`), `serializeIndividualForPortal`, `serializeStoreForPortal`, `defaultDashboardConfig`, existing goldrush report SQL patterns (index.js:17742, 18173, 18643) **minus agent joins/columns**.
- Produces endpoints (company/tenant always from token, never from query):
  - `GET /portal/overview` — `{ widgets, kpis }` where widgets come from `portal_dashboard_config` (default if none) and kpis = built-in counts (total individuals, total store visits, qualification rate, deposits-confirmed rate, store coverage, avg share-of-wall).
  - `GET /portal/individuals?limit=&offset=` — scoped individuals list, agent-stripped.
  - `GET /portal/stores?limit=&offset=` — scoped store list with photo thumbnail + share-of-wall, agent-stripped.
  - `GET /portal/insights` — per-store insights (share-of-wall + `ai_raw_response` observations) + a roll-up count.
  - `GET /portal/media/:id` — streams a `visit_photos` row's image, only if its visit's `company_id` matches the token; supports both R2-object and base64-data-URL storage (mirror `analyzePhotoWithAI`'s dual path).

- [ ] **Step 1: Add `GET /portal/overview`:**

```js
app.get('/portal/overview', portalAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('portalTenantId');
  const companyId = c.get('portalCompanyId');
  const cfgRow = await db.prepare('SELECT widgets FROM portal_dashboard_config WHERE company_id = ? AND tenant_id = ?').bind(companyId, tenantId).first();
  const widgets = cfgRow ? JSON.parse(cfgRow.widgets) : defaultDashboardConfig(companyId).widgets;
  const ind = await db.prepare(`SELECT COUNT(*) AS n,
      SUM(CASE WHEN COALESCE(JSON_EXTRACT(vi.custom_field_values,'$.converted'),0)=1 THEN 1 ELSE 0 END) AS converted
    FROM visits v LEFT JOIN visit_individuals vi ON v.id = vi.visit_id
    WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='individual'`).bind(tenantId, companyId).first();
  const stores = await db.prepare(`SELECT COUNT(*) AS n,
      AVG((SELECT MAX(vp.ai_share_of_voice) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.ai_share_of_voice IS NOT NULL)) AS avg_sow
    FROM visits v WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='store'`).bind(tenantId, companyId).first();
  const totalInd = ind?.n || 0;
  const kpis = {
    total_individuals: totalInd,
    total_stores: stores?.n || 0,
    qualification_rate: totalInd ? Math.round(((ind?.converted || 0) / totalInd) * 1000) / 10 : 0,
    avg_share_of_wall: stores?.avg_sow != null ? Math.round(stores.avg_sow * 10) / 10 : null,
  };
  return c.json({ success: true, data: { widgets, kpis } });
});
```

- [ ] **Step 2: Add `GET /portal/individuals`** — reuse the goldrush-individuals SELECT **without the `users u` join, without `agent_name`, without agent-test exclusions on identity** (keep the test-agent visit exclusion so demo data stays out), scoped to token company:

```js
app.get('/portal/individuals', portalAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('portalTenantId');
  const companyId = c.get('portalCompanyId');
  const limit = Math.min(parseInt(c.req.query('limit') || '25', 10) || 25, 100);
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0;
  const result = await db.prepare(`
    SELECT v.id, i.first_name, i.last_name, i.phone, i.email,
      (SELECT vp.r2_url FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.r2_url IS NOT NULL LIMIT 1) AS thumbnail_url,
      (SELECT vp.id FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.r2_url IS NOT NULL LIMIT 1) AS photo_id,
      COALESCE(JSON_EXTRACT(vi.custom_field_values,'$.converted'),0) AS converted,
      vi.custom_field_values, v.visit_date, v.created_at
    FROM visits v
    LEFT JOIN visit_individuals vi ON v.id = vi.visit_id
    LEFT JOIN individuals i ON vi.individual_id = i.id
    WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='individual'
      AND v.agent_id NOT LIKE 'agent-test-%'
    ORDER BY v.created_at DESC LIMIT ? OFFSET ?
  `).bind(tenantId, companyId, limit, offset).all();
  const data = (result.results || []).map(serializeIndividualForPortal);
  return c.json({ success: true, data });
});
```

- [ ] **Step 3: Add `GET /portal/stores`** — store visits with thumbnail + share-of-wall, agent-stripped:

```js
app.get('/portal/stores', portalAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('portalTenantId');
  const companyId = c.get('portalCompanyId');
  const limit = Math.min(parseInt(c.req.query('limit') || '25', 10) || 25, 100);
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0;
  const result = await db.prepare(`
    SELECT v.id, v.store_name, v.visit_date, v.created_at,
      (SELECT vp.id FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.r2_url IS NOT NULL LIMIT 1) AS photo_id,
      (SELECT MAX(vp.ai_share_of_voice) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.ai_share_of_voice IS NOT NULL) AS share_of_wall
    FROM visits v
    WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='store'
      AND v.agent_id NOT LIKE 'agent-test-%'
    ORDER BY v.created_at DESC LIMIT ? OFFSET ?
  `).bind(tenantId, companyId, limit, offset).all();
  const data = (result.results || []).map(serializeStoreForPortal);
  return c.json({ success: true, data });
});
```

- [ ] **Step 4: Add `GET /portal/insights`** — per-store share-of-wall + parsed observations:

```js
app.get('/portal/insights', portalAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('portalTenantId');
  const companyId = c.get('portalCompanyId');
  const rows = await db.prepare(`
    SELECT v.id AS visit_id, v.store_name, vp.ai_share_of_voice AS share_of_wall, vp.ai_raw_response
    FROM visits v JOIN visit_photos vp ON vp.visit_id = v.id
    WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type)='store'
      AND vp.ai_raw_response IS NOT NULL
    ORDER BY v.created_at DESC LIMIT 200
  `).bind(tenantId, companyId).all();
  const data = (rows.results || []).map(r => ({
    visit_id: r.visit_id,
    store_name: r.store_name,
    share_of_wall: r.share_of_wall,
    insights: parseStoreInsights(r.ai_raw_response),
  }));
  return c.json({ success: true, data });
});
```

> Implementer note: `parseStoreInsights` is already imported from `services/goldrushVision.js` (Phase E). Reuse it — do not reimplement.

- [ ] **Step 5: Add `GET /portal/media/:id`** — company-scoped image stream, dual storage path (mirror `analyzePhotoWithAI`):

```js
app.get('/portal/media/:id', portalAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('portalTenantId');
  const companyId = c.get('portalCompanyId');
  const photoId = c.req.param('id');
  const row = await db.prepare(`
    SELECT vp.r2_key, vp.r2_url FROM visit_photos vp
    JOIN visits v ON v.id = vp.visit_id
    WHERE vp.id = ? AND vp.tenant_id = ? AND v.company_id = ?
  `).bind(photoId, tenantId, companyId).first();
  if (!row) return c.json({ success: false, message: 'Not found' }, 404);
  // Path A: real R2 object.
  if (row.r2_key && c.env.UPLOADS) {
    const obj = await c.env.UPLOADS.get(row.r2_key);
    if (obj) {
      return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'private, max-age=300' } });
    }
  }
  // Path B: base64 data URL stored directly in r2_url (Goldrush store/individual photos).
  if (row.r2_url && String(row.r2_url).startsWith('data:')) {
    const m = String(row.r2_url).match(/^data:([^;]+);base64,(.*)$/);
    if (m) {
      const bytes = Uint8Array.from(atob(m[2]), ch => ch.charCodeAt(0));
      return new Response(bytes, { headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=300' } });
    }
  }
  // Path C: r2_url is a plain remote URL — redirect.
  if (row.r2_url) return c.redirect(row.r2_url, 302);
  return c.json({ success: false, message: 'No image' }, 404);
});
```

- [ ] **Step 6: Verify** — `cd workers-api && node --check src/index.js` → SYNTAX_OK; `npm run test:pure` → PASS
- [ ] **Step 7: Commit**

```bash
git add workers-api/src/index.js
git commit -m "feat(portal): scoped data endpoints — overview/individuals/stores/insights/media"
```

---

### Task F5: Portal setup admin screen (existing frontend)

**Files:**
- Create: `frontend/src/pages/field-operations/PortalSetup.tsx`
- Modify: `frontend/src/App.tsx` (lazy import + route under field-operations, admin-gated)
- Modify: the field-ops nav (same file/pattern the other field-ops report pages use) to add a "Portal setup" entry

**Interfaces:**
- Consumes: `apiClient` (`services/api.service`), endpoints from Task F3.
- Two panels on one page:
  1. **Portal users** — email input + "Invite" button → `POST /field-ops/portal/users`; on success show the returned `invite_url` (copyable). List below from `GET /field-ops/portal/users` with a "Disable" action (`DELETE`).
  2. **Dashboard widgets** — load `GET /field-ops/portal/dashboard-config`; render the widget list with title edit, show/hide toggle, and up/down reorder; "Save" → `PUT`.

- [ ] **Step 1: Build `PortalSetup.tsx`** — light/dark, lucide-react icons only (no emoji), company selector defaulting to the Goldrush company, matching the visual language of the existing field-ops report pages (`StoreInsights.tsx` is the closest sibling — mirror its container, table, and dark-mode classes). Both panels wired to the Task F3 endpoints via `apiClient`. Widget editor operates on the local `widgets` array and PUTs the whole array.

- [ ] **Step 2: Register route + nav** — lazy import in `App.tsx`, `<Route path="field-operations/portal-setup" element={<ProtectedRoute requiredRole="admin"><PortalSetup /></ProtectedRoute>} />`, and add the nav entry in the field-ops menu group alongside the other report links.

- [ ] **Step 3: Verify** — `cd frontend && npm run build` → PASS
- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/field-operations/PortalSetup.tsx frontend/src/App.tsx
git commit -m "feat(portal): staff Portal-setup screen — invite users + curate dashboard widgets"
```

---

### Task F6: Standalone customer-portal app

**Files:**
- Create: `portal/` — a sibling Vite/React/TS/Tailwind app scaffolded from `frontend`'s config (own `package.json`, `vite.config.ts`, `tailwind.config`, `index.html`, `tsconfig`), talking ONLY to `/portal/*`.
- Key source: `portal/src/main.tsx`, `portal/src/App.tsx`, `portal/src/api.ts` (axios instance, `aud:'portal'` token in localStorage under a portal-specific key), pages `Login.tsx`, `AcceptInvite.tsx`, `Dashboard.tsx`, and widget components (`KpiWidget`, `IndividualsTable`, `StoresTable`, `InsightsWidget`).

**Interfaces:**
- Consumes: `/portal/auth/login`, `/portal/auth/accept-invite`, `/portal/overview`, `/portal/individuals`, `/portal/stores`, `/portal/insights`, `/portal/media/:id`.
- Own token storage key (`portal_token`) so it never collides with the staff app. No staff PWA shell, no staff bundle.

- [ ] **Step 1: Scaffold `portal/`** — copy `frontend`'s `vite.config.ts` (drop the PWA plugin; keep the `/api` → backend dev proxy but point portal fetches at `/portal/*`, or set `VITE_API_BASE_URL`), `tailwind.config.js`, `postcss.config.js`, `tsconfig*.json`, `index.html` (new title "Customer Portal"), and a minimal `package.json` with the same React/Vite/Tailwind/axios/lucide-react deps and `dev`/`build`/`preview` scripts. Do NOT copy the staff `src/`.

- [ ] **Step 2: `portal/src/api.ts`** — axios instance, base URL from `VITE_API_BASE_URL` (fallback `''` so `/portal/...` hits same origin), request interceptor attaches `Authorization: Bearer <portal_token from localStorage>`; a 401 interceptor clears the token and routes to `/login`.

- [ ] **Step 3: `Login.tsx` + `AcceptInvite.tsx`** — email/password login; accept-invite reads `?token=` and sets a password (8+ chars, confirm field). On success store `portal_token`, go to `/`.

- [ ] **Step 4: `Dashboard.tsx`** — fetch `/portal/overview`, render each configured widget in order via a `type`→component switch. `kpi` → KpiWidget (the overview counts); `individuals_table` → IndividualsTable (fetches `/portal/individuals`, paged); `stores_table` → StoresTable (`/portal/stores`, thumbnails via `/portal/media/:id`, share-of-wall shown); `insights` → InsightsWidget (`/portal/insights`, per-store observations); unknown types render nothing. Design: clean, read-only, light/dark, lucide-react icons, no emoji; NO agent/pay fields anywhere (there are none in the responses).

- [ ] **Step 5: Verify** — `cd portal && npm install && npm run build` → PASS
- [ ] **Step 6: Commit**

```bash
git add portal/
git commit -m "feat(portal): standalone read-only customer portal app (login, accept-invite, dashboard)"
```

---

### Task F7: AI ask panel (fast-follow — build last)

**Files:**
- Modify: `workers-api/src/index.js` (`POST /portal/ask`, `portalAuthMiddleware`)
- Modify: `portal/src/pages/Dashboard.tsx` (+ an `AskPanel.tsx` component) — a text box that POSTs the question and shows the text answer + the rows/metric it used.

**Interfaces:**
- `POST /portal/ask { question }` → maps the question onto a **bounded set of metric intents** (NOT free SQL): e.g. `total_individuals`, `qualification_rate`, `share_of_wall`, `store_coverage`, `trend_over_time`. Compute the scoped aggregate for the matched intent, then call `c.env.AI` to phrase a short answer over ONLY that aggregate. Returns `{ answer, intent, data }`.

- [ ] **Step 1: Add a pure intent-matcher** to `services/portal.js`: `matchAskIntent(question) -> intentKey|null` (keyword map over a fixed intent list). Add unit cases to `portal.test.js` (a question about "sign ups" → `total_individuals`, "share of wall" → `share_of_wall`, gibberish → `null`). Run the pure suite.
- [ ] **Step 2: Add `POST /portal/ask`** — `matchAskIntent`; if null, return a friendly "I can answer questions about registrations, qualification, and store share-of-wall." Otherwise compute that one scoped aggregate and pass it to `c.env.AI` with a prompt that forbids inventing data; return `{ answer, intent, data }`. `node --check` + pure suite.
- [ ] **Step 3: `AskPanel.tsx`** in the portal app — input + submit, render `answer` and a small table/number from `data`. `npm run build`.
- [ ] **Step 4: Commit**

```bash
git add workers-api/src/index.js workers-api/src/services/portal.js workers-api/tests/unit/portal.test.js portal/src/
git commit -m "feat(portal): AI ask panel — bounded metric-intent NL query over scoped aggregates"
```

---

## Self-Review

**Spec coverage:**
- F1 (shows/never-shows) → enforced across F4 (agent-stripped queries + serializer) and the F1 `PORTAL_AGENT_FIELDS` denylist. ✅
- F2 (auth, portal_users, invite, aud:'portal') → Tasks F1 (schema) + F2 (mint/middleware/accept-invite/login). ✅
- F3 (dashboard config, default seed, staff curation) → F1 (`defaultDashboardConfig`) + F3 (CRUD) + F5 (setup screen). ✅
- F4 (AI insights + ask) → F7. Marked fast-follow, built last per spec's ponytail note. ✅
- F5 (portal API) → F2 (auth routes) + F4 (data routes). ✅
- F6 (standalone app) → F6. ✅
- F tests (scoping, staff-token-rejected, no agent field, invite flow) → covered by F1 unit tests (serializer/token/invite-expiry) + the cross-company/staff-token checks the final review must exercise against dev. ✅

**Placeholder scan:** none. Both accept-invite and login return `{ token, access_token }` literally.

**Type consistency:** portal JWT payload `{ portalUserId, tenantId, companyId, aud:'portal' }` is minted identically in accept-invite + login and asserted by `assertPortalToken` + `portalAuthMiddleware`. Context keys `portalUserId`/`portalTenantId`/`portalCompanyId` are set in F2 and read in F4. `widgets` is a JSON string column, parsed to an array everywhere it's read. Consistent.

**Notes:** `store_name` column existence on `visits` is assumed from the goldrush-stores report; the F4 implementer must confirm the exact column (the store report SELECT is the reference) and match it. Company scoping always derives `companyId` from the token, never a query param — the one non-negotiable security invariant.
