/**
 * Escalation Report — real-time visibility into the intraday idle-agent escalation
 * ladder, plus a manual "action nudge" button per stage.
 *
 * This sits ALONGSIDE the automatic cron nudge ladder (cron/jobs.js:checkInactiveAgents)
 * and never changes its timing. It computes its OWN intraday stage clock from "quiet
 * since", reusing the single activity definition (services/activityToday.js) so the two
 * can never drift on WHAT counts as active. The 1/3/5h stage boundaries live nowhere in
 * the cron (which is minutes-config-driven and only reaches manager) — they are this
 * report's model, configurable per program.
 *
 * Stage clock (program_config key 'escalation_report', company row overrides tenant):
 *   quiet >= minIdleMinutes .. < managerAfterH*60   -> team_lead        (Hour 0–1 default)
 *   quiet >= managerAfterH*60 .. < backofficeAfterH  -> manager          (Hour 1–3)
 *   quiet >= backofficeAfterH*60 .. < gmAfterH        -> backoffice_admin (Hour 3–5)
 *   quiet >= gmAfterH*60                              -> general_manager  (Hour 5+, fallback)
 *
 * Stage actions reuse the notifications table (the chosen "notifications convention"):
 *   - the real agent nudge is delivered by the shared doNudge() — same mechanism as
 *     /kpi/remediate/nudge (in-app row + opportunistic push);
 *   - a compact audit marker (type 'escalation_action', addressed to the actor, is_read=1
 *     so it stays out of the bell badge, idempotent PK per agent+stage+day) records WHO
 *     actioned WHICH stage and WHEN. The GET read-back turns markers into "Contacted ✅".
 *
 * The Hour-3 agent "HR has been notified" message and the Hour-5 GM fallback fire lazily
 * and idempotently as this report is loaded (fireFallbacks), gated to SAST work hours —
 * no new cron, existing cron untouched.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { AGENT_ROLES } from '../../services/incentiveService.js';
import { workStartUtc, computeActiveToday } from '../../services/activityToday.js';
import { getConfig } from './config.js';
import { doNudge } from './issues.js';

const app = new Hono();

// The three actionable stages plus the GM fallback, ordered low -> high.
const STAGE_ORDER = ['team_lead', 'manager', 'backoffice_admin', 'general_manager'];
// Stages that carry an "Action nudge" button (GM is a notification-only fallback).
const ACTION_STAGES = ['team_lead', 'manager', 'backoffice_admin'];
const DEFAULT_STAGES = { minIdleMinutes: 15, managerAfterH: 1, backofficeAfterH: 3, gmAfterH: 5 };

// SQLite UTC datetime ('YYYY-MM-DD HH:MM:SS', no zone) -> Date. null-safe.
// Same parse the cron uses so idle math matches checkInactiveAgents exactly.
function parseSqlUtc(s) {
  if (!s) return null;
  let iso = s.includes('T') ? s : s.replace(' ', 'T');
  if (!/[Z+]/.test(iso)) iso += 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// Resolve the per-stage entry threshold (minutes of quiet) from config + defaults.
function resolveStarts(cfg) {
  const s = { ...DEFAULT_STAGES, ...(cfg && typeof cfg === 'object' ? cfg : {}) };
  return {
    thresholds: s,
    starts: {
      team_lead: Math.max(0, Number(s.minIdleMinutes) || 0),
      manager: (Number(s.managerAfterH) || DEFAULT_STAGES.managerAfterH) * 60,
      backoffice_admin: (Number(s.backofficeAfterH) || DEFAULT_STAGES.backofficeAfterH) * 60,
      general_manager: (Number(s.gmAfterH) || DEFAULT_STAGES.gmAfterH) * 60,
    },
  };
}

// Highest stage whose entry threshold <= idleMin. null when below the team_lead entry
// grace (agent has only briefly paused — not "quiet" yet, so no row).
function stageFor(idleMin, starts) {
  if (idleMin < starts.team_lead) return null;
  let cur = null;
  for (const st of STAGE_ORDER) if (idleMin >= starts[st]) cur = st;
  return cur;
}

// Company set the caller may see. null = unrestricted (admin/super_admin/GM). Managers AND
// back-office admins scope via manager_company_links (matches gm.js CO_MCL — BO admins are
// linked there, not in agent_company_links). team_lead is handled separately (own agents).
async function callerCompanyIds(db, { tenantId, userId, role }) {
  if (role === 'admin' || role === 'super_admin' || role === 'general_manager') return null;
  const rows = await db.prepare(
    'SELECT company_id FROM manager_company_links WHERE manager_id = ? AND tenant_id = ? AND is_active = 1'
  ).bind(userId, tenantId).all();
  return (rows.results || []).map((r) => r.company_id);
}

// EXISTS-on-agent_company_links scope for alias u. Mirrors activeToday.js companyScope so
// the roster agrees with the KPI tiles. ids===null -> no restriction; []->nothing.
function companyScope(ids) {
  if (ids === null) return { sql: '', binds: [] };
  if (ids.length === 0) return { sql: 'AND 1 = 0', binds: [] };
  const sql = `AND EXISTS (SELECT 1 FROM agent_company_links acl
      WHERE acl.agent_id = u.id AND acl.tenant_id = u.tenant_id AND acl.is_active = 1
        AND acl.company_id IN (${ids.map(() => '?').join(',')}))`;
  return { sql, binds: [...ids] };
}

// Which rows the viewer may SEE (spec "Who sees what"). Company/team scope is already
// applied to the roster; this layers the per-role stage gate on top.
function visibleToViewer(role, userId, agent, idleMin, starts, supById) {
  if (role === 'general_manager') return idleMin >= starts.general_manager; // final-fallback rows only
  if (role === 'admin' || role === 'super_admin' || role === 'backoffice_admin') {
    return idleMin >= starts.backoffice_admin; // Back Office / Admin: Hour 3+
  }
  if (role === 'manager') {
    if (idleMin < starts.manager) return false; // only once escalated to the manager tier
    if (agent.manager_id === userId) return true; // direct report
    const tl = agent.team_lead_id ? supById.get(agent.team_lead_id) : null;
    return tl?.manager_id === userId; // agent's team lead reports to this manager
  }
  if (role === 'team_lead') return agent.team_lead_id === userId; // own agents, any reached stage
  return false;
}

// ---- Lazy fallbacks: HR-notified (Hour 3) + GM fallback (Hour 5). Fired on report load,
// idempotent per agent+day, gated to SAST work hours so nothing pings out of hours. Never
// throws into the request path — a failure here must not blank the report. ----
async function fireFallbacks(db, { tenantId, now, today, agents, starts, resolveGm }) {
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const h = sast.getUTCHours(), day = sast.getUTCDay();
  if (h < 8 || h >= 17 || day === 0 || day === 6) return; // outside 08:00–17:00 SAST, Mon–Fri
  const INSERT = `INSERT OR IGNORE INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'ESCALATION', ?, 0, datetime('now'))`;
  // One batch instead of two writes per quiet agent, serialized. Every one of those
  // was a round trip to the D1 primary in WNAM while the report waited to render.
  const stmts = [];
  for (const a of agents) {
    if (a.idleMin >= starts.backoffice_admin) {
      // Agent-facing alert. In-app only — no HR role, no outbound contact (confirmed scope).
      stmts.push(db.prepare(INSERT).bind(`esc-hr-${a.id}-${today}`, tenantId, a.id, 'escalation_hr',
        'Follow-up required', 'HR has been notified that you are not working.', `esc_hr_${a.id}_${today}`));
    }
    if (a.idleMin >= starts.general_manager) {
      const gmId = resolveGm(a);
      if (gmId && gmId !== a.id) {
        stmts.push(db.prepare(INSERT).bind(`esc-gm-${a.id}-${today}`, tenantId, gmId, 'escalation_gm_fallback',
          'Escalation reached the top',
          `${a.name || 'An agent'} has been quiet all day with no supervisor action. It's with you now.`,
          `esc_gm_${a.id}_${today}`));
      }
    }
  }
  if (!stmts.length) return;
  try {
    await db.batch(stmts);
  } catch (e) {
    console.error('escalation fallback batch error:', e);
  }
}

// GET /field-ops/escalation-report?company_id=
// Real-time ladder: one row per currently-quiet agent, scoped to the caller's role.
app.get(
  '/escalation-report',
  requireRole('admin', 'super_admin', 'general_manager', 'manager', 'backoffice_admin', 'team_lead'),
  async (c) => {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const role = c.get('role');
    const companyId = c.req.query('company_id') || null;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const workStart = workStartUtc(now);

    const cfg = await getConfig(db, tenantId, companyId, 'escalation_report').catch(() => null);
    const { thresholds, starts } = resolveStarts(cfg);

    try {
      // ---- Roster scope. team_lead: own direct agents. everyone else: their companies
      // (unrestricted for admin/GM), honoring the company pill within the allowed set. ----
      let scope;
      if (role === 'team_lead') {
        scope = { sql: 'AND u.team_lead_id = ?', binds: [userId] };
      } else {
        let ids = await callerCompanyIds(db, { tenantId, userId, role });
        if (companyId) ids = ids && !ids.includes(companyId) ? [] : [companyId];
        scope = companyScope(ids);
      }

      // Org fields for every in-scope agent (one active company link resolved inline).
      const { results: orgRows } = await db.prepare(
        `SELECT u.id, TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')) AS name,
           u.team_lead_id, u.manager_id, u.gm_id,
           (SELECT acl.company_id FROM agent_company_links acl
              WHERE acl.agent_id = u.id AND acl.tenant_id = u.tenant_id AND acl.is_active = 1 LIMIT 1) AS company_id
         FROM users u
         WHERE u.tenant_id = ? AND u.is_active = 1 AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
           AND (u.agent_type IS NULL OR u.agent_type IN ('field_ops','both'))
           AND u.id NOT LIKE 'agent-test-%' AND LOWER(TRIM(u.first_name)) != 'test'
           ${scope.sql}`
      ).bind(tenantId, ...AGENT_ROLES, ...scope.binds).all();

      if (!orgRows || orgRows.length === 0) {
        return c.json({ success: true, asOf: today, config: thresholds, rows: [] });
      }

      // "Quiet since" from the shared activity definition (same scope), merged by id.
      const activity = await computeActiveToday(db, {
        tenantId, roles: AGENT_ROLES, workStart, scopeSql: scope.sql, scopeBinds: scope.binds,
      });
      const lastById = new Map(activity.roster.map((r) => [r.id, r.lastActivity]));

      // Supervisor map (leads + managers) — powers the manager-span filter and GM chain walk.
      const { results: sup } = await db.prepare(
        `SELECT id, role, manager_id, gm_id FROM users
         WHERE tenant_id = ? AND is_active = 1 AND role IN ('team_lead','manager')`
      ).bind(tenantId).all();
      const supById = new Map((sup || []).map((s) => [s.id, s]));

      // GM backstop, identical to cron/jobs.js: prefer the GM linked to the subject's
      // company, else any tenant GM/admin. The chosen chain walk lands here when a
      // manager's gm_id is unset.
      const gmLinks = (await db.prepare(
        `SELECT m.company_id, m.manager_id FROM manager_company_links m JOIN users u ON u.id = m.manager_id
         WHERE m.tenant_id = ? AND m.is_active = 1 AND u.is_active = 1 AND u.role IN ('general_manager','admin')
         ORDER BY (u.role = 'general_manager') DESC, u.id`
      ).bind(tenantId).all()).results || [];
      const gmByCompany = new Map();
      for (const g of gmLinks) if (!gmByCompany.has(g.company_id)) gmByCompany.set(g.company_id, g.manager_id);
      const tenantGmId = (await db.prepare(
        `SELECT id FROM users WHERE tenant_id = ? AND role IN ('general_manager','admin') AND is_active = 1
         ORDER BY (role = 'general_manager') DESC, id LIMIT 1`
      ).bind(tenantId).first())?.id || null;
      const gmFor = (cid) => gmByCompany.get(cid) || tenantGmId;
      // Walk the chain: agent -> manager (direct or via team lead) -> manager.gm_id, then backstop.
      const resolveGm = (a) => {
        const mgrId = a.manager_id || (a.team_lead_id ? supById.get(a.team_lead_id)?.manager_id : null);
        return (mgrId ? supById.get(mgrId)?.gm_id : null) || a.gm_id || gmFor(a.company_id);
      };

      // Company names for display.
      const { results: coRows } = await db.prepare(
        `SELECT id, name FROM field_companies WHERE tenant_id = ?`
      ).bind(tenantId).all().catch(() => ({ results: [] }));
      const companyNameById = new Map((coRows || []).map((r) => [r.id, r.name]));

      // Today's stage-action markers (the "Contacted ✅" source of truth). Small per-day set.
      const { results: markerRows } = await db.prepare(
        `SELECT n.user_id AS actor_id, n.related_id, n.created_at,
           TRIM(a.first_name || ' ' || COALESCE(a.last_name, '')) AS actor_name
         FROM notifications n LEFT JOIN users a ON a.id = n.user_id
         WHERE n.tenant_id = ? AND n.type = 'escalation_action' AND date(n.created_at) = ?`
      ).bind(tenantId, today).all().catch(() => ({ results: [] }));
      // related_id = esc:<agentId>:<stage>
      const markerByKey = new Map();
      for (const m of markerRows || []) {
        const parts = String(m.related_id || '').split(':');
        if (parts[0] !== 'esc' || parts.length < 3) continue;
        markerByKey.set(`${parts[1]}:${parts[2]}`, { by: m.actor_id, byName: (m.actor_name || '').trim(), at: m.created_at });
      }

      // Compute idle for the full scoped roster (drives BOTH the lazy fallbacks and the rows).
      const nowMs = now.getTime();
      const workStartMs = parseSqlUtc(workStart).getTime();
      const scored = orgRows.map((a) => {
        const last = parseSqlUtc(lastById.get(a.id));
        const lastActiveMs = last ? last.getTime() : workStartMs; // never active today -> quiet since work-start
        const idleMin = Math.max(0, Math.floor((nowMs - lastActiveMs) / 60000));
        return { ...a, idleMin, quietSince: lastById.get(a.id) || null };
      });

      // Fire HR + GM fallbacks over the full scoped set (independent of row visibility).
      // Notifications nobody in this response reads, so they no longer block it.
      const fallbacks = fireFallbacks(db, { tenantId, now, today, agents: scored, starts, resolveGm });
      // c.executionCtx THROWS (it does not return undefined) when there is no
      // ExecutionContext, e.g. a unit test calling app.fetch(req) with no ctx.
      try { c.executionCtx.waitUntil(fallbacks); } catch { await fallbacks; }

      // Build the visible rows.
      const rows = [];
      for (const a of scored) {
        const cur = stageFor(a.idleMin, starts);
        if (!cur) continue; // not quiet enough to appear
        if (!visibleToViewer(role, userId, a, a.idleMin, starts, supById)) continue;

        const stages = {};
        for (const st of ACTION_STAGES) {
          const start = starts[st];
          if (a.idleMin < start) { stages[st] = { reached: false }; continue; }
          const marker = markerByKey.get(`${a.id}:${st}`) || null;
          const nextStart = st === 'team_lead' ? starts.manager
            : st === 'manager' ? starts.backoffice_admin
            : starts.general_manager;
          stages[st] = {
            reached: true,
            actioned: marker,                                   // {by, byName, at} | null
            overdue: !marker && a.idleMin >= nextStart,         // band elapsed with no action
            current: cur === st,                                // the tier the row sits in now
          };
        }

        rows.push({
          agentId: a.id,
          name: a.name,
          teamLeadId: a.team_lead_id || null,
          companyId: a.company_id || null,
          company: companyNameById.get(a.company_id) || null,
          quietSince: a.quietSince,
          quietMinutes: a.idleMin,
          currentStage: cur,
          stages,
          gmNotified: a.idleMin >= starts.general_manager,
        });
      }
      rows.sort((x, y) => y.quietMinutes - x.quietMinutes); // most-escalated first

      return c.json({ success: true, asOf: today, config: thresholds, rows });
    } catch (error) {
      console.error(`Error building escalation report tenant=${tenantId} role=${role}:`, error);
      return c.json({ success: false, error: 'Could not build the escalation report' }, 500);
    }
  }
);

// GET /field-ops/escalation-report/history?company_id=&startDate=&endDate=
// Audit trail of past manual "action nudge" clicks — who actioned which stage, for which
// agent, and when. Independent of the live ladder above (no "quiet since"/idle math),
// scoped to the same roster the caller can see on the live report. startDate/endDate are
// optional 'YYYY-MM-DD' bounds (inclusive); omit either for an open-ended range.
app.get(
  '/escalation-report/history',
  requireRole('admin', 'super_admin', 'general_manager', 'manager', 'backoffice_admin', 'team_lead'),
  async (c) => {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const role = c.get('role');
    const companyId = c.req.query('company_id') || null;
    const { startDate, endDate } = c.req.query();
    const hasStart = !!(startDate && startDate.trim());
    const hasEnd = !!(endDate && endDate.trim());

    try {
      // Roster scope — same rule as the live ladder (team_lead: own agents; everyone else:
      // their companies, unrestricted for admin/super_admin/GM). No is_active filter here:
      // an agent who has since left should still resolve a name in past audit entries.
      let scope;
      if (role === 'team_lead') {
        scope = { sql: 'AND u.team_lead_id = ?', binds: [userId] };
      } else {
        let ids = await callerCompanyIds(db, { tenantId, userId, role });
        if (companyId) ids = ids && !ids.includes(companyId) ? [] : [companyId];
        scope = companyScope(ids);
      }

      const { results: orgRows } = await db.prepare(
        `SELECT u.id, TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')) AS name,
           (SELECT acl.company_id FROM agent_company_links acl
              WHERE acl.agent_id = u.id AND acl.tenant_id = u.tenant_id AND acl.is_active = 1 LIMIT 1) AS company_id
         FROM users u
         WHERE u.tenant_id = ? AND u.role IN (${AGENT_ROLES.map(() => '?').join(',')})
           AND u.id NOT LIKE 'agent-test-%' AND LOWER(TRIM(u.first_name)) != 'test'
           ${scope.sql}`
      ).bind(tenantId, ...AGENT_ROLES, ...scope.binds).all();

      if (!orgRows || orgRows.length === 0) {
        return c.json({ success: true, rows: [] });
      }
      const agentById = new Map(orgRows.map((a) => [a.id, a]));

      const { results: coRows } = await db.prepare(
        `SELECT id, name FROM field_companies WHERE tenant_id = ?`
      ).bind(tenantId).all().catch(() => ({ results: [] }));
      const companyNameById = new Map((coRows || []).map((r) => [r.id, r.name]));

      let dateFilter = '';
      const binds = [tenantId];
      if (hasStart && hasEnd) { dateFilter = ' AND date(n.created_at) BETWEEN ? AND ?'; binds.push(startDate, endDate); }
      else if (hasStart) { dateFilter = ' AND date(n.created_at) >= ?'; binds.push(startDate); }
      else if (hasEnd) { dateFilter = ' AND date(n.created_at) <= ?'; binds.push(endDate); }

      const { results: markerRows } = await db.prepare(
        `SELECT n.id, n.user_id AS actor_id, n.related_id, n.created_at,
           TRIM(a.first_name || ' ' || COALESCE(a.last_name, '')) AS actor_name
         FROM notifications n LEFT JOIN users a ON a.id = n.user_id
         WHERE n.tenant_id = ? AND n.type = 'escalation_action'${dateFilter}
         ORDER BY n.created_at DESC`
      ).bind(...binds).all();

      // related_id = esc:<agentId>:<stage> — parse and drop anything outside caller's roster.
      const rows = [];
      for (const m of markerRows || []) {
        const parts = String(m.related_id || '').split(':');
        if (parts[0] !== 'esc' || parts.length < 3) continue;
        const agent = agentById.get(parts[1]);
        if (!agent) continue;
        rows.push({
          id: m.id,
          agentId: agent.id,
          agentName: agent.name,
          company: companyNameById.get(agent.company_id) || null,
          stage: parts[2],
          actorName: (m.actor_name || '').trim() || null,
          at: m.created_at,
        });
      }

      return c.json({ success: true, rows });
    } catch (error) {
      console.error(`Error building escalation history tenant=${tenantId} role=${role}:`, error);
      return c.json({ success: false, error: 'Could not build the escalation history' }, 500);
    }
  }
);

// POST /field-ops/escalation-report/action  body: { agentId, stage, message? }
// Sends the real nudge to the agent via the shared doNudge mechanism, then records an
// idempotent audit marker (actor + stage + day) the report reads back as "Contacted ✅".
app.post(
  '/escalation-report/action',
  requireRole('admin', 'super_admin', 'general_manager', 'manager', 'backoffice_admin', 'team_lead'),
  async (c) => {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => ({}));
    const agentId = body.agentId;
    const stage = body.stage;
    if (!agentId || !ACTION_STAGES.includes(stage)) {
      return c.json({ success: false, error: 'agentId and a valid stage are required' }, 400);
    }

    // Deliver via the same path as /kpi/remediate/nudge (in-app + push, agent validated inside).
    const result = await doNudge({ db, env: c.env, tenantId, userId, body: { agentId, message: body.message }, issue: null });
    if (!result.ok) {
      return c.json({ success: false, error: result.message || 'Could not send nudge' }, result.httpStatus || 400);
    }

    // Audit marker: addressed to the actor, is_read=1 (out of the bell badge), one per
    // agent+stage+day. First action wins — the record is who first cleared the stage.
    const today = new Date().toISOString().slice(0, 10);
    await db.prepare(
      `INSERT OR IGNORE INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id, is_read, created_at)
       VALUES (?, ?, ?, 'escalation_action', ?, ?, 'ESCALATION', ?, 1, datetime('now'))`
    ).bind(`esc-${agentId}-${stage}-${today}`, tenantId, userId, 'Escalation actioned',
      `Nudged agent at ${stage} stage`, `esc:${agentId}:${stage}`).run();

    return c.json({ success: true, delivered: result.delivered ?? 0 });
  }
);

export default app;
