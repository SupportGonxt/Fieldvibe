// workers-api/src/routes/field-ops/issues.js
// Read/act endpoints over the issues ledger (migration 0014). The cron (reactToIssues
// in index.js) is what opens, re-owns and resolves rows; here an owner just reads their
// worst-first queue and marks one actioned, and a GM sees who is sitting on issues.
// Auth: global middleware sets userId/tenantId/role (no `auth` object) — same as kpi.js.
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { isBreached } from '../../services/issueEngine.js';

// Guard every path (reads here, writes in the reactToIssues cron) so a not-yet-migrated D1
// never 500s — mirrors kpi.js ensureCoachingNotes. Kept in sync with migrations/0014_issues.sql.
export async function ensureIssues(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS issues (
       id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT,
       kind TEXT NOT NULL, subject_id TEXT NOT NULL, subject_role TEXT,
       owner_id TEXT NOT NULL, owner_role TEXT NOT NULL,
       severity INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'open',
       detail TEXT, escalations INTEGER NOT NULL DEFAULT 0,
       opened_at TEXT DEFAULT CURRENT_TIMESTAMP, owner_since TEXT DEFAULT CURRENT_TIMESTAMP,
       acted_at TEXT, acted_by TEXT, last_action TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`
  ).run();
  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_live ON issues(tenant_id, subject_id) WHERE status != 'resolved'`
  ).run();
}

// TRIM/COALESCE: several live users have an empty last_name, which would render as a trailing space.
const fullName = (idCol) =>
  `(SELECT TRIM(COALESCE(first_name,'')||' '||COALESCE(last_name,'')) FROM users WHERE id = ${idCol})`;
const nameCol = fullName('i.subject_id');
const ownerNameCol = fullName('i.owner_id');

const app = new Hono();

// My open queue, worst-first (severity desc, then oldest owner_since). Drives every role's home list.
app.get('/issues/mine', async (c) => {
  const db = c.env.DB;
  await ensureIssues(db);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { results } = await db.prepare(
    `SELECT i.*, ${nameCol} subject_name FROM issues i
     WHERE i.tenant_id = ? AND i.owner_id = ? AND i.status != 'resolved'
     ORDER BY (i.status='acted') ASC, i.severity DESC, i.owner_since ASC`
  ).bind(tenantId, userId).all();
  return c.json({ issues: results || [] });
});

// Owner's accountability KPI: notifications received vs acted on, trailing 7 days.
// received = issues routed to this owner in the window; acted = those they actioned
// (acted_at set — survives the cron flipping status to 'resolved'). Drives the BO home card.
app.get('/issues/stats', async (c) => {
  const db = c.env.DB;
  await ensureIssues(db);
  const row = await db.prepare(
    `SELECT COUNT(*) received, COUNT(acted_at) acted FROM issues
     WHERE tenant_id = ? AND owner_id = ? AND owner_since >= datetime('now','-7 days')`
  ).bind(c.get('tenantId'), c.get('userId')).first();
  return c.json({ success: true, received: row?.received || 0, acted: row?.acted || 0 });
});

// GM/admin accountability view: open issues no owner has actioned, breaching-first, with the
// owner named — this is the "who isn't managing" surface (leads/managers/BO who sit on issues).
app.get('/issues/unmanaged', requireRole('admin', 'general_manager'), async (c) => {
  const db = c.env.DB;
  await ensureIssues(db);
  const tenantId = c.get('tenantId');
  // A GM covers specific customers (Goldrush, Stellr) via manager_company_links; they see those
  // plus any subject with no customer assigned. An admin sees the whole tenant.
  const scoped = c.get('role') === 'general_manager';
  const companyFilter = scoped
    ? `AND (i.company_id IS NULL OR i.company_id IN
         (SELECT company_id FROM manager_company_links WHERE manager_id = ? AND tenant_id = ? AND is_active = 1))`
    : '';
  const stmt = db.prepare(
    `SELECT i.*, ${nameCol} subject_name, ${ownerNameCol} owner_name,
            (SELECT name FROM field_companies WHERE id = i.company_id) company_name
     FROM issues i
     WHERE i.tenant_id = ? AND i.status = 'open' ${companyFilter}
     ORDER BY i.escalations DESC, i.severity DESC, i.owner_since ASC`
  );
  const { results } = await (scoped
    ? stmt.bind(tenantId, c.get('userId'), tenantId)
    : stmt.bind(tenantId)).all();
  const now = Date.now();
  const issues = (results || []).map((i) => ({
    ...i,
    breached: isBreached(i.owner_role, Date.parse((i.owner_since || '').replace(' ', 'T') + 'Z') || now, now),
  }));
  return c.json({ issues });
});

// Owner marks an issue actioned (clears the SLA breach). action='resolve' closes it outright;
// otherwise the next cron tick resolves it once the underlying signal clears.
app.post('/issues/:id/act', async (c) => {
  const db = c.env.DB;
  await ensureIssues(db);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const id = c.req.param('id');
  const b = await c.req.json().catch(() => ({}));
  const status = b.action === 'resolve' ? 'resolved' : 'acted';
  const res = await db.prepare(
    `UPDATE issues SET status = ?, acted_at = datetime('now'), acted_by = ?, last_action = ?, updated_at = datetime('now')
     WHERE id = ? AND tenant_id = ? AND owner_id = ? AND status != 'resolved'`
  ).bind(status, userId, b.action || 'acknowledged', id, tenantId, userId).run();
  if (!res.meta?.changes) return c.json({ ok: false, error: 'not found or not yours' }, 404);
  return c.json({ ok: true, status });
});

export default app;
