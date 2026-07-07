# GM KPIs + Daily Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `general_manager` a business-driving KPI overview on web + mobile, plus a 06:00/12:00/18:00 SAST email digest and in-app notification.

**Architecture:** One backend endpoint `GET /api/field-ops/gm/overview` composes existing pnl/leaderboard/roster/bo_calls data via a pure `buildGmOverview(db, tenantId, companyId, period)`. A cron job `generateGmDigest(env)` reuses that fn + existing MailChannels helpers + `notifications` table. Web page + mobile page both render the same payload.

**Tech Stack:** Cloudflare Workers (Hono), D1 (SQLite), React+Vite+TS, axios apiClient, MailChannels HTTP email, vitest (node config for pure tests).

## Global Constraints

- Backend router pattern: `const app = new Hono()`, `export default app`, mounted via `api.route('/field-ops', gmRoutes)` in `workers-api/src/index.js`. Global auth already covers `/api/*`; read ctx via `c.get('tenantId'|'userId'|'role')`.
- Gate GM+admin routes with `requireRole('admin','general_manager')` from `../../middleware/auth.js`.
- Reuse `AGENT_ROLES` from `../../services/incentiveService.js`. Do NOT hardcode role lists.
- Email from `reports@fieldvibe.vantax.co.za` via `sendEmailViaMailChannels(env, {to,subject,html})`. Reuse `kpiHtml`, `tableHtml`, `htmlEscape`.
- Money amounts in Rand; format `R` + `Math.round(n).toLocaleString('en-ZA')`.
- Cron slots already exist in `wrangler.toml`: `0 4`, `0 10`, `0 16` UTC = 06:00/12:00/18:00 SAST. No wrangler.toml edit.
- Notifications insert columns: `(id, tenant_id, user_id, type, title, message, related_type, related_id, is_read, created_at)`.
- Pure unit tests run under `test:pure` = `vitest run --config tests/unit/vitest.node.config.js` (node env). Add new test files to that config's `include`.
- Frontend has no unit harness — frontend tasks verified by `npm run build` (tsc) + deploy.
- Deploy = `git push origin dev`. D1 migrations applied manually; 0012 already applied to dev.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `buildGmOverview` + `/gm/overview` endpoint (backend)

**Files:**
- Create: `workers-api/src/routes/field-ops/gm.js`
- Modify: `workers-api/src/index.js` (import + mount, near the other `api.route('/field-ops', …)`)
- Test: `workers-api/tests/unit/gmOverview.test.js`
- Modify: `workers-api/tests/unit/vitest.node.config.js` (add test to `include`)

**Interfaces:**
- Produces: `buildGmOverview(db, tenantId, companyId, period) -> Promise<Overview>` and `periodRange(period, nowIso) -> {start, end, today}` and `default` Hono app.
- `Overview` = `{ period, money:{revenue,incentiveCost,salaryCost,net,costsAvailable}, funnel:{signups,converted,qualified,conversionRate,commissionPerDeposit}, field:{activeAgents,totalAgents,leastActive:[{id,name,phone,today,last_activity}]}, leaders:[{id,name,signups,converted}], calls:{contacted,target} }`.
- `periodRange('day'|'week'|'month', iso)`: month→`start=YYYY-MM-01,end=nextMonthStart`; week→Monday(UTC)..iso+1day start-of; day→today..today; `today` always `iso.slice(0,10)`. Represent end as exclusive `YYYY-MM-DD` compared with `vi.created_at >= start AND < end`. For day/week end = tomorrow's date.

- [ ] **Step 1: Write failing test** — `workers-api/tests/unit/gmOverview.test.js`

```js
import { describe, it, expect } from 'vitest';
import { periodRange } from '../../src/routes/field-ops/gm.js';

describe('periodRange', () => {
  it('month: first to next-month-first', () => {
    const r = periodRange('month', '2026-07-06T09:00:00.000Z');
    expect(r.start).toBe('2026-07-01');
    expect(r.end).toBe('2026-08-01');
    expect(r.today).toBe('2026-07-06');
  });
  it('day: today to tomorrow', () => {
    const r = periodRange('day', '2026-07-06T09:00:00.000Z');
    expect(r.start).toBe('2026-07-06');
    expect(r.end).toBe('2026-07-07');
  });
  it('week: monday to tomorrow (Sunday 2026-07-06 is a Monday-week)', () => {
    // 2026-07-06 is a Monday
    const r = periodRange('week', '2026-07-06T09:00:00.000Z');
    expect(r.start).toBe('2026-07-06');
    expect(r.end).toBe('2026-07-07');
  });
  it('defaults unknown period to month', () => {
    expect(periodRange('bogus', '2026-07-06T09:00:00.000Z').start).toBe('2026-07-01');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `cd workers-api && npx vitest run --config tests/unit/vitest.node.config.js tests/unit/gmOverview.test.js` → FAIL (module not found / periodRange undefined). First add the file to the config include (Step 3 covers the source; add include line too).

- [ ] **Step 3: Write `gm.js`**

```js
/**
 * Field-Ops GM overview — one composed business KPI payload for the general_manager.
 * Pure composition over existing incentive/leaderboard/roster/bo_calls data; no new metric math.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { computeIncentive, AGENT_ROLES } from '../../services/incentiveService.js';
import { getConfig } from './config.js';

const app = new Hono();

function nextMonthStart(period) {
  const [y, m] = period.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
function addDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function round1(n) { return Math.round(n * 10) / 10; }

// Resolve [start, end) date bounds + today from a period keyword.
export function periodRange(period, nowIso) {
  const today = nowIso.slice(0, 10);
  if (period === 'day') return { start: today, end: addDay(today), today, mode: 'day' };
  if (period === 'week') {
    const d = new Date(nowIso);
    const dow = d.getUTCDay();               // 0 Sun..6 Sat
    const back = dow === 0 ? 6 : dow - 1;    // days since Monday
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back))
      .toISOString().slice(0, 10);
    return { start: monday, end: addDay(today), today, mode: 'week' };
  }
  const p = today.slice(0, 7);               // month (default)
  return { start: `${p}-01`, end: nextMonthStart(p), today, mode: 'month' };
}

// Compose the GM overview. companyId scopes config (rate/salaries); null = tenant-wide.
export async function buildGmOverview(db, tenantId, companyId, period) {
  const now = new Date().toISOString();
  const { start, end, today, mode } = periodRange(period, now);
  const notRejected = `COALESCE(json_extract(vi.custom_field_values,'$.verification_status'),'provisional') != 'rejected'`;

  // Funnel + revenue base (range aggregate — mirrors the pnl endpoint's agg query).
  const rate = (await getConfig(db, tenantId, companyId, 'commission_per_deposit')) || 0;
  const agg = await db.prepare(
    `SELECT COUNT(*) signups,
       SUM(CASE WHEN json_extract(vi.custom_field_values,'$.consumer_converted')='Yes' THEN 1 ELSE 0 END) converted,
       SUM(CASE WHEN json_extract(vi.custom_field_values,'$.verification_status')='qualified' THEN 1 ELSE 0 END) qualified
     FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
     WHERE v.tenant_id = ? AND vi.created_at >= ? AND vi.created_at < ? AND ${notRejected}`
  ).bind(tenantId, start, end).first().catch(() => null);
  const signups = agg?.signups || 0, converted = agg?.converted || 0, qualified = agg?.qualified || 0;
  const revenue = converted * rate;

  // Costs are only coherent monthly (tiered per-agent avg + fixed salaries). Skip for day/week.
  let money = { revenue, incentiveCost: null, salaryCost: null, net: null, costsAvailable: false };
  if (mode === 'month') {
    const salaries = (await getConfig(db, tenantId, companyId, 'salaries')) || {};
    const salaryCost = Object.values(salaries).reduce((s, v) => s + (Number(v) || 0), 0);
    const period7 = today.slice(0, 7);
    const { results: ags } = await db.prepare(
      `SELECT DISTINCT v.agent_id id FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
       WHERE v.tenant_id = ? AND vi.created_at >= ? AND vi.created_at < ?`
    ).bind(tenantId, start, end).all().catch(() => ({ results: [] }));
    let incentiveCost = 0;
    for (const { id } of ags || []) {
      const u = await db.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
      if (!u) continue;
      const inc = await computeIncentive(db, tenantId, companyId, id, u.role, period7, today);
      incentiveCost += inc.payable;
    }
    incentiveCost = round1(incentiveCost);
    money = { revenue, incentiveCost, salaryCost, net: round1(revenue - incentiveCost - salaryCost), costsAvailable: true };
  }

  // Leaders (period-scoped signup leaderboard, top 5).
  const { results: leaders } = await db.prepare(
    `SELECT v.agent_id id, u.first_name||' '||u.last_name name, COUNT(*) signups,
       SUM(CASE WHEN json_extract(vi.custom_field_values,'$.consumer_converted')='Yes' THEN 1 ELSE 0 END) converted
     FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id JOIN users u ON u.id = v.agent_id
     WHERE v.tenant_id = ? AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND vi.created_at >= ? AND vi.created_at < ? AND ${notRejected}
     GROUP BY v.agent_id ORDER BY signups DESC LIMIT 5`
  ).bind(tenantId, ...AGENT_ROLES, start, end).all().catch(() => ({ results: [] }));

  // Field force: active-today + roster (least active first, top 5 quiet).
  const { results: roster } = await db.prepare(
    `SELECT u.id, u.first_name||' '||u.last_name name, u.phone,
       COUNT(CASE WHEN date(vi.created_at)=? THEN 1 END) today, MAX(vi.created_at) last_activity
     FROM users u
     LEFT JOIN visits v ON v.agent_id = u.id AND v.tenant_id = u.tenant_id
     LEFT JOIN visit_individuals vi ON vi.visit_id = v.id AND ${notRejected}
     WHERE u.tenant_id = ? AND u.is_active = 1 AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
       AND (u.agent_type IS NULL OR u.agent_type IN ('field_ops','both'))
     GROUP BY u.id ORDER BY today ASC, last_activity ASC`
  ).bind(today, tenantId, ...AGENT_ROLES).all().catch(() => ({ results: [] }));
  const totalAgents = (roster || []).length;
  const activeAgents = (roster || []).filter((r) => (r.today || 0) > 0).length;
  const leastActive = (roster || []).slice(0, 5);

  // BO calls: agents contacted today vs summed daily targets (default 20 per BO admin).
  const contactedRow = await db.prepare(
    `SELECT COUNT(DISTINCT callee_id) c FROM bo_calls
     WHERE tenant_id = ? AND status='answered' AND date(started_at)=?`
  ).bind(tenantId, today).first().catch(() => null);
  const boCountRow = await db.prepare(
    `SELECT COUNT(*) c FROM users WHERE tenant_id = ? AND is_active = 1
       AND role IN ('admin','backoffice_admin','general_manager','manager')
       AND (agent_type IS NULL OR agent_type IN ('back_office','both'))`
  ).bind(tenantId).first().catch(() => null);
  const targetRow = await db.prepare(
    `SELECT COALESCE(SUM(daily_target),0) t FROM bo_call_targets WHERE tenant_id = ?`
  ).bind(tenantId).first().catch(() => null);
  const boCount = boCountRow?.c || 0;
  const explicitTarget = targetRow?.t || 0;
  const target = explicitTarget > 0 ? explicitTarget : boCount * 20;

  return {
    period: mode,
    money,
    funnel: { signups, converted, qualified, commissionPerDeposit: rate,
      conversionRate: signups ? round1((converted / signups) * 100) : 0 },
    field: { activeAgents, totalAgents, leastActive },
    leaders: leaders || [],
    calls: { contacted: contactedRow?.c || 0, target },
  };
}

// GET /gm/overview?period=day|week|month&company_id=
app.get('/gm/overview', requireRole('admin', 'general_manager'), async (c) => {
  const tenantId = c.get('tenantId');
  const period = c.req.query('period') || 'day';
  const companyId = c.req.query('company_id') || null;
  const overview = await buildGmOverview(c.env.DB, tenantId, companyId, period);
  return c.json({ success: true, ...overview });
});

export default app;
```

- [ ] **Step 4: Add test to node config include** — `workers-api/tests/unit/vitest.node.config.js`

```js
export default defineConfig({ test: { environment: 'node', include: ['tests/unit/incentiveService.test.js', 'tests/unit/callsFinalize.test.js', 'tests/unit/gmOverview.test.js', 'tests/unit/gmDigest.test.js'] } })
```

- [ ] **Step 5: Run test, expect PASS** — `cd workers-api && npx vitest run --config tests/unit/vitest.node.config.js tests/unit/gmOverview.test.js` → PASS.

- [ ] **Step 6: Mount router in index.js** — find the existing `api.route('/field-ops', callRoutes)` line; add alongside:

```js
import gmRoutes from './routes/field-ops/gm.js';
// …
api.route('/field-ops', gmRoutes);
```

- [ ] **Step 7: Commit**

```bash
git add workers-api/src/routes/field-ops/gm.js workers-api/src/index.js workers-api/tests/unit/gmOverview.test.js workers-api/tests/unit/vitest.node.config.js
git commit -m "feat(gm): /field-ops/gm/overview composed KPI endpoint + buildGmOverview"
```

---

### Task 2: `generateGmDigest` cron job (backend)

**Files:**
- Modify: `workers-api/src/index.js` (add `digestSlot`, `generateGmDigest`, wire into `scheduled`)
- Test: `workers-api/tests/unit/gmDigest.test.js`

**Interfaces:**
- Consumes: `buildGmOverview` (Task 1) — but to avoid a cross-module import in the monolith, `generateGmDigest` imports it at top of index.js: `import { buildGmOverview } from './routes/field-ops/gm.js';`.
- Produces: `digestSlot(sastHour) -> 'morning'|'midday'|'evening'|null`, `generateGmDigest(env) -> Promise<void>`.

- [ ] **Step 1: Write failing test** — `workers-api/tests/unit/gmDigest.test.js`

```js
import { describe, it, expect } from 'vitest';
import { digestSlot } from '../../src/routes/field-ops/gm.js';

describe('digestSlot', () => {
  it('06:00 SAST -> morning', () => expect(digestSlot(6)).toBe('morning'));
  it('12:00 SAST -> midday', () => expect(digestSlot(12)).toBe('midday'));
  it('18:00 SAST -> evening', () => expect(digestSlot(18)).toBe('evening'));
  it('other hours -> null', () => expect(digestSlot(9)).toBe(null));
});
```

- [ ] **Step 2: Run test, expect FAIL** — `npx vitest run --config tests/unit/vitest.node.config.js tests/unit/gmDigest.test.js` → FAIL (digestSlot undefined).

- [ ] **Step 3: Add `digestSlot` to `gm.js`** (co-located with the other pure helpers; exported)

```js
// SAST-hour -> digest slot label. Digest fires at 06/12/18 SAST only.
export function digestSlot(sastHour) {
  if (sastHour === 6) return 'morning';
  if (sastHour === 12) return 'midday';
  if (sastHour === 18) return 'evening';
  return null;
}
```

- [ ] **Step 4: Run test, expect PASS** — same command → PASS.

- [ ] **Step 5: Add `generateGmDigest` in index.js** (beside `generatePerformanceSummaries`; add the import near the top with the other route imports)

```js
import { buildGmOverview, digestSlot } from './routes/field-ops/gm.js';

// GM daily digest — emails every general_manager the day's overview + an in-app notification.
// Fires from the 04/10/16 UTC cron ticks (06/12/18 SAST). Reuses buildGmOverview + MailChannels.
async function generateGmDigest(env) {
  const db = env.DB;
  const sastHour = (new Date().getUTCHours() + 2) % 24;
  const slot = digestSlot(sastHour);
  if (!slot) return;
  const { results: gms } = await db.prepare(
    `SELECT id, tenant_id, email, first_name FROM users
     WHERE role = 'general_manager' AND is_active = 1 AND email IS NOT NULL`
  ).all();
  const byTenant = new Map();
  for (const g of gms || []) {
    if (!byTenant.has(g.tenant_id)) byTenant.set(g.tenant_id, []);
    byTenant.get(g.tenant_id).push(g);
  }
  const rand = (n) => 'R' + Math.round(Number(n) || 0).toLocaleString('en-ZA');
  for (const [tenantId, list] of byTenant) {
    let o;
    try { o = await buildGmOverview(db, tenantId, null, 'day'); }
    catch (e) { console.error('gm-digest overview failed', tenantId, e.message); continue; }
    const kpis = [
      ['Signups today', String(o.funnel.signups)],
      ['Converted', `${o.funnel.converted} (${o.funnel.conversionRate}%)`],
      ['Revenue (today)', rand(o.money.revenue)],
      ['Active agents', `${o.field.activeAgents}/${o.field.totalAgents}`],
      ['BO agents contacted', `${o.calls.contacted}/${o.calls.target}`],
    ];
    const leaderRows = o.leaders.map((l) => [l.name, String(l.signups), String(l.converted)]);
    const html =
      `<div style="font-family:Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:16px">` +
      `<h2 style="color:#0F172A">FieldVibe daily summary — ${slot}</h2>` +
      kpiHtml(kpis) +
      (leaderRows.length ? `<h3 style="color:#0F172A;font-size:15px">Top performers</h3>${tableHtml(['Agent', 'Signups', 'Converted'], leaderRows)}` : '') +
      `</div>`;
    const msg = `${o.funnel.signups} signups, ${o.funnel.converted} converted, ${rand(o.money.revenue)} revenue today.`;
    for (const g of list) {
      try {
        await sendEmailViaMailChannels(env, { to: g.email, toName: g.first_name, subject: `FieldVibe daily summary — ${slot}`, html });
      } catch (e) { console.error('gm-digest email failed', g.email, e.message); }
      try {
        const notifId = crypto.randomUUID();
        await db.prepare(
          "INSERT INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id, is_read, created_at) VALUES (?, ?, ?, 'gm_digest', ?, ?, 'GM_DIGEST', ?, 0, datetime('now'))"
        ).bind(notifId, tenantId, g.id, `Daily summary (${slot})`, msg, `gmdigest_${o && new Date().toISOString().slice(0,10)}_${slot}`).run();
      } catch (e) { console.error('gm-digest notif failed', g.id, e.message); }
    }
  }
}
```

- [ ] **Step 6: Wire into `scheduled`** — in `workers-api/src/index.js` scheduled handler, after the existing hour branches:

```js
    // GM daily digest at 06/12/18 SAST (04/10/16 UTC).
    if (hour === 4 || hour === 10 || hour === 16) await generateGmDigest(env);
```

- [ ] **Step 7: Run full pure suite** — `cd workers-api && npm run test:pure` → all PASS.

- [ ] **Step 8: Commit**

```bash
git add workers-api/src/index.js workers-api/src/routes/field-ops/gm.js workers-api/tests/unit/gmDigest.test.js
git commit -m "feat(gm): thrice-daily digest email + in-app notification via generateGmDigest"
```

---

### Task 3: Web GM overview page (frontend)

**Files:**
- Create: `frontend/src/pages/dashboard/GmOverviewPage.tsx`
- Modify: `frontend/src/App.tsx` (route + role guard for `general_manager`)

**Interfaces:**
- Consumes: `GET /field-ops/gm/overview?period=` via `apiClient` (returns `{success, period, money, funnel, field, leaders, calls}` from Task 1).

- [ ] **Step 1: Build the page** — reuse existing dashboard card components if present; otherwise a self-contained KPI-card grid. Period toggle (day/week/month). Groups: Money (revenue always; incentiveCost/salaryCost/net only when `money.costsAvailable`), Funnel (signups/converted/conversionRate/qualified), Field (active/total + leastActive list), Leaders table, BO calls (contacted/target). Format Rand as `R` + `Math.round(n).toLocaleString('en-ZA')`.

- [ ] **Step 2: Add route + guard in `App.tsx`** — add `/dashboard/gm` (or existing dashboard route group) rendering `GmOverviewPage`, guarded so only `general_manager` (and admin) reach it; redirect other roles.

- [ ] **Step 3: Typecheck/build** — `cd frontend && npm run build` → succeeds (no TS errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/GmOverviewPage.tsx frontend/src/App.tsx
git commit -m "feat(gm): web GM overview dashboard page"
```

---

### Task 4: Mobile GM overview tab + notification bell (frontend)

**Files:**
- Create: `frontend/src/pages/agent/GmOverview.tsx`
- Modify: `frontend/src/pages/agent/AgentLayout.tsx` (GM Home tab → `/agent/overview`; mount notification bell in header)
- Modify: `frontend/src/App.tsx` (route `/agent/overview` → `GmOverview` under the agent layout)

**Interfaces:**
- Consumes: same `GET /field-ops/gm/overview` payload; render with the mobile card idiom from `GMPnl.tsx` (dark `#06090F` bg, `#00E87B` accent, `Stat`/`Row` components).

- [ ] **Step 1: Build `GmOverview.tsx`** — mirror `GMPnl.tsx` structure: period toggle, KPI stat grid (signups, converted, conversionRate, revenue, active agents, BO contacted), leaders list, least-active list. Reuse the `Stat`/`Row` local component pattern.

- [ ] **Step 2: Swap GM Home tab + add bell in `AgentLayout.tsx`** — in `getTabsForRole` for `general_manager`, change the base `Home` tab target to `/agent/overview` (keep P&L/Stats/Profile). Render the existing `NotificationCenter` bell in a top header for the agent layout (at least for GM) so in-app notifications are reachable on mobile.

- [ ] **Step 3: Add route in `App.tsx`** — `/agent/overview` → `GmOverview` inside the agent layout, GM-gated.

- [ ] **Step 4: Typecheck/build** — `cd frontend && npm run build` → succeeds.

- [ ] **Step 5: Commit + push to dev**

```bash
git add frontend/src/pages/agent/GmOverview.tsx frontend/src/pages/agent/AgentLayout.tsx frontend/src/App.tsx
git commit -m "feat(gm): mobile GM overview tab + notification bell in agent layout"
git push origin dev
```

---

## Self-Review

**Spec coverage:**
- Web KPI overview → Task 3. ✅
- Mobile KPI overview → Task 4. ✅
- KPIs "relevant to driving business" (money, funnel, field force, leaders, BO productivity) → `buildGmOverview` Task 1. ✅
- Digest 06:00/12:00/18:00 SAST → Task 2 (`generateGmDigest` + scheduled wiring, reuses existing crons). ✅
- In-app notifications → Task 2 (notifications insert) + Task 4 (mobile bell surface). ✅
- All-GM recipients → Task 2 query `role='general_manager'`. ✅
- No new table / no cron edit / no new provider → honored. ✅

**Placeholder scan:** none — backend code complete; frontend tasks specify exact contract + reuse patterns (GMPnl idiom) rather than placeholders, acceptable given no TS test harness and single autonomous executor.

**Type consistency:** `buildGmOverview` return shape (`money/funnel/field/leaders/calls`) is consumed identically in digest (Task 2), web (Task 3), mobile (Task 4). `periodRange`/`digestSlot` signatures match tests. `AGENT_ROLES` imported, not hardcoded. Notification columns match existing inserts.
