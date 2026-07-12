// workers-api/src/routes/field-ops/issues.js
// Read/act endpoints over the issues ledger (migration 0014, polarity added in 0020).
// The cron (reactToIssues in jobs.js) opens, re-owns and resolves rows; here an owner
// reads their worst-first queue, acts on one via the generic action dispatch, and a
// GM sees who is sitting on issues.
// Auth: global middleware sets userId/tenantId/role (no `auth` object) — same as kpi.js.
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { isBreached } from '../../services/issueEngine.js';
import { sendPush } from '../../lib/web-push.js';

// Guard every path (reads here, writes in the reactToIssues cron) so a not-yet-migrated D1
// never 500s. Kept in sync with migrations/0014_issues.sql + 0020_issues_polarity.sql.
export async function ensureIssues(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS issues (
       id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT,
       kind TEXT NOT NULL, subject_id TEXT NOT NULL, subject_role TEXT,
       owner_id TEXT NOT NULL, owner_role TEXT NOT NULL,
       severity INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'open',
       polarity TEXT NOT NULL DEFAULT 'deficit',
       detail TEXT, escalations INTEGER NOT NULL DEFAULT 0,
       opened_at TEXT DEFAULT CURRENT_TIMESTAMP, owner_since TEXT DEFAULT CURRENT_TIMESTAMP,
       acted_at TEXT, acted_by TEXT, last_action TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`
  ).run();
  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_live ON issues(tenant_id, subject_id, COALESCE(company_id,''), polarity) WHERE status != 'resolved'`
  ).run();
}

// coaching_notes DDL lives in schema.sql; guard the write path so a not-yet-migrated D1
// never 500s. follow_up_date/resource_link added in 0020.
async function ensureCoachingNotes(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS coaching_notes (
       id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT,
       manager_id TEXT NOT NULL, agent_id TEXT NOT NULL, signal_type TEXT,
       action TEXT NOT NULL, note TEXT, follow_up_date TEXT, resource_link TEXT,
       created_at TEXT DEFAULT CURRENT_TIMESTAMP)`
  ).run();
}

// Pure: shapes a coaching_notes row. Unit-tested (kpiRoster.test.js, via kpi.js re-export).
export function coachingNoteRow({ id, tenantId, companyId, managerId, agentId, signalType, action, note }) {
  return {
    id, tenant_id: tenantId, company_id: companyId ?? null,
    manager_id: managerId, agent_id: agentId,
    signal_type: signalType ?? null, action, note: note ?? null,
  };
}

// Shared low-level insert for every handler that writes a coaching note. Replaces the
// old non-idempotent `cn-${userId}-${agentId}-...` id scheme with a real UUID.
export async function writeCoachingNote(db, params, extra = {}) {
  await ensureCoachingNotes(db);
  const row = coachingNoteRow({ id: crypto.randomUUID(), ...params });
  await db.prepare(
    `INSERT INTO coaching_notes (id, tenant_id, company_id, manager_id, agent_id, signal_type, action, note, follow_up_date, resource_link)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(row.id, row.tenant_id, row.company_id, row.manager_id, row.agent_id, row.signal_type, row.action, row.note,
    extra.followUpDate ?? null, extra.resourceLink ?? null).run();
  return row.id;
}

async function targetExists(db, tenantId, agentId) {
  if (!agentId) return null;
  return db.prepare('SELECT id FROM users WHERE id = ? AND tenant_id = ?').bind(agentId, tenantId).first();
}

// --- Action handlers. Each takes { db, env, tenantId, companyId, userId, role, issue, body } —
// issue is null when called from the old direct-agentId endpoints (remediate/note, remediate/nudge),
// set when dispatched via POST /issues/:id/action. agentId falls back to body.agentId either way. ---

export async function doNote(ctx) {
  const { db, tenantId, companyId, userId, body, issue } = ctx;
  const agentId = issue?.subject_id || body.agentId;
  if (!(await targetExists(db, tenantId, agentId))) return { ok: false, httpStatus: 400, message: 'Unknown agent' };
  const id = await writeCoachingNote(db, {
    tenantId, companyId, managerId: userId, agentId,
    signalType: body.signalType ?? issue?.kind, action: body.action || 'note', note: body.note,
  });
  return { ok: true, id };
}

export async function doCheckin(ctx) {
  const { db, tenantId, companyId, userId, body, issue } = ctx;
  const agentId = issue?.subject_id || body.agentId;
  if (!(await targetExists(db, tenantId, agentId))) return { ok: false, httpStatus: 400, message: 'Unknown agent' };
  const id = await writeCoachingNote(db, {
    tenantId, companyId, managerId: userId, agentId,
    signalType: body.signalType ?? issue?.kind, action: 'checkin', note: body.note,
  }, { followUpDate: body.followUpDate ?? null });
  return { ok: true, id };
}

export async function doResource(ctx) {
  const { db, tenantId, companyId, userId, body, issue } = ctx;
  const agentId = issue?.subject_id || body.agentId;
  if (!(await targetExists(db, tenantId, agentId))) return { ok: false, httpStatus: 400, message: 'Unknown agent' };
  const id = await writeCoachingNote(db, {
    tenantId, companyId, managerId: userId, agentId,
    signalType: body.signalType ?? issue?.kind, action: 'resource', note: body.note,
  }, { resourceLink: body.resourceLink ?? null });
  return { ok: true, id };
}

// Nudging writes a notification addressed to someone else, so it is a supervisor-only action.
export async function doNudge(ctx) {
  const { db, env, tenantId, userId, body, issue } = ctx;
  const agentId = issue?.subject_id || body.agentId;
  const title = 'Performance nudge';
  const message = body.message || 'Check in with your manager.';
  if (!(await targetExists(db, tenantId, agentId))) return { ok: false, httpStatus: 400, message: 'Unknown agent' };

  await db.prepare(
    `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(`nudge-${crypto.randomUUID()}`, tenantId, agentId, 'nudge', title, message, 'coaching', userId).run();

  // Push is opportunistic on top of the in-app row, which is the real deliverable.
  let delivered = 0;
  try {
    const subs = (await db.prepare(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id=? AND user_id=?`
    ).bind(tenantId, agentId).all()).results ?? [];
    for (const sub of subs) {
      const { ok, status } = await sendPush(env, sub, { title, body: message, url: '/agent' });
      if (ok) delivered++;
      else {
        console.error(`push fail nudge user=${agentId} status=${status}`);
        if (status === 404 || status === 410) {
          await db.prepare(`DELETE FROM push_subscriptions WHERE tenant_id=? AND user_id=? AND endpoint=?`)
            .bind(tenantId, agentId, sub.endpoint).run();
        }
      }
    }
  } catch (e) {
    console.error(`push error nudge user=${agentId}:`, e);
  }
  return { ok: true, delivered };
}

// Owner marks an issue actioned. action==='resolve' closes it outright; otherwise the next
// cron tick resolves it once the underlying signal clears. Ownership enforced in the WHERE
// clause, not a separate fetch — atomic, matches the pre-dispatch route's original behavior.
export async function doAct(ctx, action) {
  const { db, tenantId, userId, issue } = ctx;
  const status = action === 'resolve' ? 'resolved' : 'acted';
  const res = await db.prepare(
    `UPDATE issues SET status = ?, acted_at = datetime('now'), acted_by = ?, last_action = ?, updated_at = datetime('now')
     WHERE id = ? AND tenant_id = ? AND owner_id = ? AND status != 'resolved'`
  ).bind(status, userId, action, issue.id, tenantId, userId).run();
  if (!res.meta?.changes) return { ok: false, httpStatus: 404, error: 'not found or not yours' };
  return { ok: true, status };
}

// Visibility escalation only — re-points owner_id/owner_role to the tenant's admin/GM.
// No tier/severity mutation; just gets it in front of someone above the current owner.
export async function doTierFlag(ctx) {
  const { db, tenantId, companyId, userId, issue, body } = ctx;
  const gm = await db.prepare(
    `SELECT id, role FROM users WHERE tenant_id=? AND is_active=1 AND role IN ('general_manager','admin')
     ORDER BY (role='general_manager') DESC, id LIMIT 1`
  ).bind(tenantId).first();
  if (!gm) return { ok: false, httpStatus: 400, message: 'No admin/GM to escalate to' };
  await db.prepare(
    `UPDATE issues SET owner_id=?, owner_role=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?`
  ).bind(gm.id, gm.role, issue.id, tenantId).run();
  const id = await writeCoachingNote(db, {
    tenantId, companyId, managerId: userId, agentId: issue.subject_id,
    signalType: issue.kind, action: 'tier_flag', note: body.note,
  });
  return { ok: true, id, escalatedTo: gm.id };
}

// recognition-polarity only (enforced by resolveAction) — a note plus a kudos push.
export async function doRecognition(ctx) {
  const { db, env, tenantId, companyId, userId, issue, body } = ctx;
  const id = await writeCoachingNote(db, {
    tenantId, companyId, managerId: userId, agentId: issue.subject_id,
    signalType: issue.kind, action: 'recognition', note: body.note,
  });
  try {
    const subs = (await db.prepare(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id=? AND user_id=?`
    ).bind(tenantId, issue.subject_id).all()).results ?? [];
    for (const sub of subs) {
      await sendPush(env, sub, { title: 'Nice work!', body: body.note || 'Your manager just recognized your performance.', url: '/agent' });
    }
  } catch (e) {
    console.error(`push error recognition user=${issue.subject_id}:`, e);
  }
  return { ok: true, id };
}

// Non-resolving self-commit: the agent logs a plan against their own open issue. ownOnly
// (subject === caller) is enforced by resolveAction; this never touches issues.status.
export async function doCommit(ctx) {
  const { db, tenantId, companyId, userId, issue, body } = ctx;
  const id = await writeCoachingNote(db, {
    tenantId, companyId, managerId: userId, agentId: userId,
    signalType: issue.kind, action: 'commit', note: body.note,
  });
  return { ok: true, id };
}

// Every action type this endpoint can dispatch, and who may call it. `roles: 'owner'` means
// issue.owner_id === caller; `ownOnly` means issue.subject_id === caller; `polarityOnly` gates
// on the issue's polarity. Role lists don't need 'general_manager' alongside 'admin' —
// resolveAction expands that the same way requireRole does.
export const ACTION_REGISTRY = {
  note:        { roles: ['admin', 'super_admin', 'manager', 'team_lead', 'backoffice_admin'], handler: doNote },
  nudge:       { roles: ['admin', 'super_admin', 'manager', 'team_lead', 'backoffice_admin'], handler: doNudge },
  checkin:     { roles: ['manager', 'team_lead', 'general_manager'], handler: doCheckin },
  resource:    { roles: ['manager', 'team_lead', 'general_manager'], handler: doResource },
  tier_flag:   { roles: ['manager', 'general_manager', 'admin'], handler: doTierFlag },
  recognition: { roles: ['manager', 'team_lead', 'general_manager'], polarityOnly: 'recognition', handler: doRecognition },
  commit:      { roles: ['agent', 'field_agent', 'sales_rep'], ownOnly: true, handler: doCommit },
  acknowledge: { roles: 'owner', polarityOnly: 'deficit', handler: (ctx) => doAct(ctx, 'acknowledge') },
  resolve:     { roles: 'owner', polarityOnly: 'deficit', handler: (ctx) => doAct(ctx, 'resolve') },
};

// Pure dispatcher: given an action type, the caller's role/id, and the target issue, decides
// whether the call is allowed and which handler answers it. Check order: unknown type,
// polarity gate, ownOnly, owner-only, then role membership (admin implies general_manager,
// mirroring requireRole's exact expansion in middleware/auth.js).
export function resolveAction(type, callerRole, callerId, issue) {
  const entry = ACTION_REGISTRY[type];
  if (!entry) return { allowed: false, reason: `Unknown action type: ${type}` };
  if (entry.polarityOnly && issue.polarity !== entry.polarityOnly) {
    return { allowed: false, reason: `${type} only applies to ${entry.polarityOnly} issues` };
  }
  if (entry.ownOnly) {
    if (issue.subject_id !== callerId) return { allowed: false, reason: `${type} may only be performed by the issue's subject` };
    return { allowed: true, handler: entry.handler };
  }
  if (entry.roles === 'owner') {
    if (issue.owner_id !== callerId) return { allowed: false, reason: `${type} may only be performed by the issue's current owner` };
    return { allowed: true, handler: entry.handler };
  }
  const allowedRoles = entry.roles.includes('admin') ? [...entry.roles, 'general_manager'] : entry.roles;
  if (!allowedRoles.includes(callerRole)) return { allowed: false, reason: `${type} is not permitted for role ${callerRole}` };
  return { allowed: true, handler: entry.handler };
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
    `SELECT i.*, ${nameCol} subject_name,
            (SELECT name FROM field_companies WHERE id = i.company_id) company_name
     FROM issues i
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

// Generic action dispatch. body: { type, ...action-specific fields }. Loads the issue,
// checks resolveAction, runs the matched handler. httpStatus (if a handler sets one) is
// stripped before responding — 'status' in a handler's body means the issue's status string.
app.post('/issues/:id/action', async (c) => {
  const db = c.env.DB;
  await ensureIssues(db);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const issue = await db.prepare('SELECT * FROM issues WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!issue) return c.json({ ok: false, error: 'not found' }, 404);
  const companyId = c.req.query('company_id') || issue.company_id || null;
  const { allowed, reason, handler } = resolveAction(body.type, role, userId, issue);
  if (!allowed) return c.json({ ok: false, error: reason }, 403);
  const result = await handler({ db, env: c.env, tenantId, companyId, userId, role, issue, body });
  const { httpStatus = 200, ...rest } = result;
  return c.json(rest, httpStatus);
});

// Thin wrapper over doAct, kept at its original URL/body shape for existing callers
// (TeamCockpit.tsx, IssueQueue.tsx). action='resolve' closes the issue outright; any
// other value (or none) just clears the SLA breach as 'acted'.
app.post('/issues/:id/act', async (c) => {
  const db = c.env.DB;
  await ensureIssues(db);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const id = c.req.param('id');
  const b = await c.req.json().catch(() => ({}));
  const result = await doAct({ db, tenantId, userId, issue: { id } }, b.action || 'acknowledged');
  const { httpStatus = 200, ...rest } = result;
  return c.json(rest, httpStatus);
});

export default app;
