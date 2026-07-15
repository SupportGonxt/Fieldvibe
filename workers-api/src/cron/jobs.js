import { sendEmailViaMailChannels, htmlEscape, tableHtml, kpiHtml } from './email.js';
import { analyzePhotoWithAI } from '../lib/photoAi.js';
import { buildGmOverview, digestSlot } from '../routes/field-ops/gm.js';
import { agentSignals, boAdminSignals, rankRoster } from '../routes/field-ops/kpi.js';
import { ensureIssues } from '../routes/field-ops/issues.js';
import { getConfig, getScale } from '../routes/field-ops/config.js';
import { severityOf, isBreached, nextOwnerRole, slaClockOf, slaAppliesTo } from '../services/issueEngine.js';
import { sendPush } from '../lib/web-push.js';
import { dueEscalation, agentCount, nextGate, readTargets, workingDaysElapsed } from '../services/incentiveService.js';
import {
  signalBelowGate, signalLabel, SIGNAL_REGISTRY,
  trendSignals, peerSignals, signalAtRiskGate, signalHitGateEarly,
} from '../services/kpiSignals.js';
import { resolveReportCompanyId } from '../lib/aggregates.js';
import { isConverted } from '../services/funnelService.js';

// ==================== PERFORMANCE SUMMARY MESSAGES (Hourly 8am-5pm SAST) ====================
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
  const stamp = new Date().toISOString().slice(0, 10);
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
    const leaderRows = (o.leaders || []).map((l) => [l.name, String(l.signups), String(l.converted)]);
    const html =
      `<div style="font-family:Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:16px">` +
      `<h2 style="color:#0F172A">FieldVibe daily summary — ${slot}</h2>` +
      kpiHtml(kpis) +
      (leaderRows.length
        ? `<h3 style="color:#0F172A;font-size:15px">Top performers</h3>${tableHtml(['Agent', 'Signups', 'Converted'], leaderRows)}`
        : '') +
      `</div>`;
    const msg = `${o.funnel.signups} signups, ${o.funnel.converted} converted, ${rand(o.money.revenue)} revenue today.`;
    const subject = `FieldVibe daily summary — ${slot}`;
    for (const g of list) {
      try {
        await sendEmailViaMailChannels(env, { to: g.email, toName: g.first_name, subject, html });
      } catch (e) { console.error('gm-digest email failed', g.email, e.message); }
      try {
        await db.prepare(
          "INSERT INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id, is_read, created_at) VALUES (?, ?, ?, 'gm_digest', ?, ?, 'GM_DIGEST', ?, 0, datetime('now'))"
        ).bind(crypto.randomUUID(), tenantId, g.id, `Daily summary (${slot})`, msg, `gmdigest_${stamp}_${slot}`).run();
      } catch (e) { console.error('gm-digest notif failed', g.id, e.message); }
    }
  }
}

async function generatePerformanceSummaries(db, force = false) {
  try {
    // Get current SAST hour (UTC+2)
    const now = new Date();
    const sastHour = (now.getUTCHours() + 2) % 24;
    // Only generate during working hours: 8am-5pm SAST
    if (!force && (sastHour < 8 || sastHour > 17)) return;
    // Skip weekends (SAST day)
    const sastDay = new Date(now.getTime() + 2 * 60 * 60 * 1000).getDay();
    if (!force && (sastDay === 0 || sastDay === 6)) return;

    const today = now.toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);
    const monthStart = currentMonth + '-01';
    const [mY, mM] = currentMonth.split('-').map(Number);
    const nextMonth = mM === 12 ? `${mY + 1}-01-01` : `${mY}-${String(mM + 1).padStart(2, '0')}-01`;

    // Get all tenants that have active managers or team leads
    const tenants = await db.prepare("SELECT DISTINCT tenant_id FROM users WHERE role IN ('manager', 'team_lead') AND is_active = 1").all();

    for (const tenant of (tenants.results || [])) {
      const tenantId = tenant.tenant_id;

      // Get all managers and team leads for this tenant
      const leaders = await db.prepare("SELECT id, first_name, last_name, role, manager_id, team_lead_id FROM users WHERE tenant_id = ? AND role IN ('manager', 'team_lead') AND is_active = 1").bind(tenantId).all();

      for (const leader of (leaders.results || [])) {
        try {
          let agentIds = [];
          let teamInfo = '';

          if (leader.role === 'manager') {
            // Manager: get all team leads under them, then all agents under those team leads
            const tls = await db.prepare("SELECT id, first_name, last_name FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND manager_id = ?").bind(tenantId, leader.id).all();
            const tlIds = (tls.results || []).map(t => t.id);

            if (tlIds.length > 0) {
              const tlPh = tlIds.map(() => '?').join(',');
              const agents = await db.prepare(`SELECT id FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent', 'sales_rep') AND is_active = 1 AND team_lead_id IN (${tlPh})`).bind(tenantId, ...tlIds).all();
              agentIds = (agents.results || []).map(a => a.id);
            }
            teamInfo = `${tlIds.length} team lead${tlIds.length !== 1 ? 's' : ''}, ${agentIds.length} agent${agentIds.length !== 1 ? 's' : ''}`;
          } else if (leader.role === 'team_lead') {
            // Team lead: get all agents under them
            const agents = await db.prepare("SELECT id, first_name, last_name FROM users WHERE tenant_id = ? AND team_lead_id = ? AND is_active = 1").bind(tenantId, leader.id).all();
            agentIds = [leader.id, ...(agents.results || []).map(a => a.id)];
            teamInfo = `${(agents.results || []).length} agent${(agents.results || []).length !== 1 ? 's' : ''}`;
          }

          if (agentIds.length === 0) agentIds = [leader.id];
          const agentPh = agentIds.map(() => '?').join(',');
          const agentFilter = agentIds.length === 1 ? 'agent_id = ?' : `agent_id IN (${agentPh})`;

          // Get today's visits count
          const todayVisits = await db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN LOWER(visit_type) = 'individual' THEN 1 ELSE 0 END) as individual_count, SUM(CASE WHEN LOWER(visit_type) = 'store' THEN 1 ELSE 0 END) as store_count FROM visits WHERE tenant_id = ? AND ${agentFilter} AND visit_date = ?`).bind(tenantId, ...agentIds, today).first().catch(() => ({ total: 0, individual_count: 0, store_count: 0 }));

          // Get month-to-date visits
          const monthVisits = await db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN LOWER(visit_type) = 'individual' THEN 1 ELSE 0 END) as individual_count, SUM(CASE WHEN LOWER(visit_type) = 'store' THEN 1 ELSE 0 END) as store_count FROM visits WHERE tenant_id = ? AND ${agentFilter} AND visit_date >= ? AND visit_date < ?`).bind(tenantId, ...agentIds, monthStart, nextMonth).first().catch(() => ({ total: 0, individual_count: 0, store_count: 0 }));

          // Get monthly targets
          const monthTargets = await db.prepare(`SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_stores FROM monthly_targets WHERE tenant_id = ? AND ${agentFilter} AND target_month = ?`).bind(tenantId, ...agentIds, currentMonth).first().catch(() => ({ target_visits: 0, target_stores: 0 }));

          // Fall back to company_target_rules if no monthly_targets
          let targetVisits = monthTargets.target_visits || 0;
          let targetStores = monthTargets.target_stores || 0;
          if (targetVisits === 0 && targetStores === 0) {
            // Simple fallback: count company target rules
            for (const uid of agentIds) {
              const rules = await db.prepare("SELECT COALESCE(SUM(ctr.individual_target_per_month), 0) as indiv, COALESCE(SUM(ctr.store_target_per_month), 0) as store FROM company_target_rules ctr JOIN agent_company_links acl ON ctr.company_id = acl.company_id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND ctr.tenant_id = ? AND ctr.is_active = 1").bind(uid, tenantId, tenantId).first().catch(() => null);
              if (rules) {
                targetVisits += rules.indiv || 0;
                targetStores += rules.store || 0;
              }
            }
          }

          // Get top performing agent today (for managers and team leads)
          let topAgent = null;
          if (agentIds.length > 1) {
            const topResult = await db.prepare(`SELECT u.first_name, u.last_name, COUNT(*) as visit_count FROM visits v JOIN users u ON v.agent_id = u.id WHERE v.tenant_id = ? AND v.${agentFilter} AND v.visit_date = ? GROUP BY v.agent_id ORDER BY visit_count DESC LIMIT 1`).bind(tenantId, ...agentIds, today).first().catch(() => null);
            if (topResult && topResult.visit_count > 0) {
              topAgent = { name: topResult.first_name + ' ' + topResult.last_name, count: topResult.visit_count };
            }
          }

          // Build the performance message
          const todayTotal = todayVisits.total || 0;
          const todayIndiv = todayVisits.individual_count || 0;
          const todayStore = todayVisits.store_count || 0;
          const monthTotal = monthVisits.total || 0;
          const monthIndiv = monthVisits.individual_count || 0;
          const monthStore = monthVisits.store_count || 0;
          const monthAch = targetVisits > 0 ? Math.round((monthIndiv / targetVisits) * 100) : 0;
          const storeAch = targetStores > 0 ? Math.round((monthStore / targetStores) * 100) : 0;

          const timeStr = `${String(sastHour).padStart(2, '0')}:00`;
          const title = `${timeStr} Performance Update`;

          let message = `Today: ${todayTotal} visits (${todayIndiv} individual, ${todayStore} store)`;
          message += ` | MTD: ${monthTotal} visits (${monthIndiv} individual, ${monthStore} store)`;
          if (targetVisits > 0) message += ` | Individual: ${monthAch}% of ${targetVisits} target`;
          if (targetStores > 0) message += ` | Store: ${storeAch}% of ${targetStores} target`;
          if (topAgent) message += ` | Top today: ${topAgent.name} (${topAgent.count} visits)`;
          message += ` | Team: ${teamInfo}`;

          // Check if we already sent a message this hour (avoid duplicates on re-run)
          const hourStart = now.toISOString().substring(0, 10) + ' ' + String(now.getUTCHours()).padStart(2, '0') + ':00:00';
          const existing = await db.prepare("SELECT id FROM notifications WHERE tenant_id = ? AND user_id = ? AND type = 'performance_summary' AND created_at >= ?").bind(tenantId, leader.id, hourStart).first();
          if (existing) continue;

          // Insert the notification
          const notifId = crypto.randomUUID();
          await db.prepare("INSERT INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id, is_read, created_at) VALUES (?, ?, ?, 'performance_summary', ?, ?, 'PERFORMANCE', ?, 0, datetime('now'))").bind(notifId, tenantId, leader.id, title, message, `perf_${today}_${sastHour}`).run();

        } catch (leaderErr) {
          console.error(`Performance summary error for ${leader.id}:`, leaderErr);
        }
      }
    }
  } catch (e) { console.error('generatePerformanceSummaries error:', e); }
}

// Field-ops inactivity nudge. During SAST work hours, alert an agent (and escalate up
// their chain) once they've gone quiet longer than the configured threshold. Thresholds
// come from program_config: inactivity_minutes (grace) + escalate_steps (who, when).
// Tenants without both keys are skipped — inactivity nudges are opt-in per program.
function parseSqlUtc(s) {
  if (!s) return null;
  let iso = s.includes('T') ? s : s.replace(' ', 'T');
  if (!/[Z+]/.test(iso)) iso += 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
async function checkInactiveAgents(db, env) {
  try {
    const now = new Date();
    const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const sastHour = sast.getUTCHours();
    const sastDay = sast.getUTCDay();
    // Working hours only: 8am–5pm SAST, Mon–Fri.
    if (sastHour < 8 || sastHour >= 17) return;
    if (sastDay === 0 || sastDay === 6) return;

    const today = now.toISOString().slice(0, 10);
    const workStartUtc = `${today} 06:00:00`; // 08:00 SAST

    const tenants = await db.prepare(
      "SELECT DISTINCT tenant_id FROM users WHERE role IN ('agent','field_agent','sales_rep') AND is_active = 1"
    ).all();

    for (const { tenant_id: tenantId } of (tenants.results || [])) {
      const cfgRows = await db.prepare(
        "SELECT key, value_json FROM program_config WHERE tenant_id = ? AND company_id IS NULL AND key IN ('inactivity_minutes','escalate_steps')"
      ).bind(tenantId).all();
      const cfg = {};
      for (const r of (cfgRows.results || [])) { try { cfg[r.key] = JSON.parse(r.value_json); } catch {} }
      const threshold = Number(cfg.inactivity_minutes);
      const steps = Array.isArray(cfg.escalate_steps) ? cfg.escalate_steps : null;
      if (!threshold || !steps) continue; // program hasn't opted in

      const agents = await db.prepare(
        "SELECT id, first_name, last_name, team_lead_id, manager_id FROM users WHERE tenant_id = ? AND role IN ('agent','field_agent','sales_rep') AND is_active = 1 AND (agent_type IS NULL OR agent_type IN ('field_ops','both'))"
      ).bind(tenantId).all();

      for (const agent of (agents.results || [])) {
        try {
          const last = await db.prepare(
            `SELECT MAX(vi.created_at) t FROM visit_individuals vi JOIN visits v ON v.id = vi.visit_id
             WHERE v.tenant_id = ? AND v.agent_id = ? AND vi.created_at >= ?`
          ).bind(tenantId, agent.id, workStartUtc).first();
          const lastActive = parseSqlUtc(last?.t) || parseSqlUtc(workStartUtc);
          const idleMin = Math.floor((now.getTime() - lastActive.getTime()) / 60000);
          const due = dueEscalation(steps, idleMin - threshold);
          if (!due) continue;

          const targetId = due.to === 'employee' ? agent.id
            : due.to === 'team_lead' ? agent.team_lead_id
            : due.to === 'manager' ? (agent.manager_id || null)
            : null;
          if (!targetId) continue;

          // One nudge per agent per step per day. notify() dedupes on (type, related_id).
          const relId = `inactive_${agent.id}_${due.to}_${today}`;
          const name = `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 'An agent';
          const hrs = Math.floor(idleMin / 60), mins = idleMin % 60;
          const idleStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
          const title = due.to === 'employee' ? 'Time to get moving' : `${name} has gone quiet`;
          const message = due.to === 'employee'
            ? `No signups logged in ${idleStr}. Get back out there — every signup counts toward your bonus.`
            : `${name} has logged no signups in ${idleStr} today. A nudge might help.`;

          await notify(db, env, tenantId, targetId, 'inactivity', title, message, relId, 'AGENT');
        } catch (agentErr) {
          console.error(`Inactivity check error for ${agent.id}:`, agentErr);
        }
      }
    }
  } catch (e) { console.error('checkInactiveAgents error:', e); }
}

// In-app notification is the deliverable; push is opportunistic on top of it (a push failure must
// never break the cron). Idempotent on (type, related_id), so an hourly tick re-firing the same
// day is a no-op. Every cron-side notification routes through here so it gets a push attempt.
async function notify(db, env, tenantId, userId, type, title, message, relId, relType = 'ISSUE') {
  if (!userId) return;
  const dup = await db.prepare(
    'SELECT id FROM notifications WHERE tenant_id = ? AND type = ? AND related_id = ?'
  ).bind(tenantId, type, relId).first();
  if (dup) return;
  await db.prepare(
    `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
  ).bind(crypto.randomUUID(), tenantId, userId, type, title, message, relType, relId).run();
  try {
    const subs = (await db.prepare(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id = ? AND user_id = ?'
    ).bind(tenantId, userId).all()).results || [];
    if (!subs.length) console.log(`push skip ${type} user=${userId}: no subscription`);
    for (const sub of subs) {
      // /agent renders PerformanceMessages, the in-app notification list this push mirrors
      const { ok, status } = await sendPush(env, sub, { title, body: message, url: '/agent' });
      if (!ok) {
        console.error(`push fail ${type} user=${userId} status=${status}`);
        if (status === 404 || status === 410) {
          await db.prepare('DELETE FROM push_subscriptions WHERE tenant_id = ? AND user_id = ? AND endpoint = ?')
            .bind(tenantId, userId, sub.endpoint).run();
        }
      }
    }
  } catch (e) { console.error(`push error ${type} user=${userId}:`, e); }
}

// Every remediation channel we have, fired once per issue per day (idempotent across hourly
// ticks): the owner is told to coach, and the agent is nudged directly. The system acts on its
// own rather than waiting for a human to open a dashboard.
async function reactToIssue(db, env, tenantId, issue, name, types, today) {
  const reasons = types.map(signalLabel).join(', ');
  await notify(db, env, tenantId, issue.owner_id, 'issue_open',
    `${name} could use a hand`,
    `What we're seeing: ${reasons}. Open their card and act — it escalates if left untouched.`,
    `issue_${issue.id}_owner_${today}`);
  await notify(db, env, tenantId, issue.subject_id, 'nudge',
    'Let\'s get back on track',
    `What we're seeing: ${reasons}. Head to your next sign-up — your lead's been looped in to help.`,
    `issue_${issue.id}_agent_${today}`);
}

// The reacting half of the accountability spine, run hourly by the scheduled handler.
// Per agent: read the same signals the roster/GM screens read, keep exactly one live issue,
// act on it, re-own it one level up the org chain once the owner sits past their SLA
// (48h lead / 72h manager, see issueEngine), and resolve it when the signal clears.
// Opt-in per tenant: no kpi.agent thresholds means no signals, so no issues.
// Deficit and recognition signals persist as separate live rows per subject (idx_issues_live
// is now 3-column: tenant_id, subject_id, polarity) — see SIGNAL_REGISTRY in kpiSignals.js.
async function reactToIssues(db, env) {
  try {
    const now = new Date();
    const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const sastHour = sast.getUTCHours();
    const sastDay = sast.getUTCDay();
    // Work hours only, same window as the other nudging crons — nobody coaches at 3am.
    if (sastHour < 8 || sastHour >= 18) return;
    if (sastDay === 0 || sastDay === 6) return;

    await ensureIssues(db);
    const nowMs = now.getTime();
    const today = now.toISOString().slice(0, 10);

    const tenants = await db.prepare(
      "SELECT DISTINCT tenant_id FROM users WHERE role IN ('agent','field_agent','sales_rep') AND is_active = 1"
    ).all();

    for (const { tenant_id: tenantId } of (tenants.results || [])) {
      try {
        // Subjects of an issue: agents, plus any lead or manager who works the field, plus
        // backoffice_admin (queue-health signals, no field activity to gate on). Lucky runs
        // Stellr as manager AND team lead, so the role name alone can't decide this; logging
        // visits does. Someone who never logs (Lucky, today) is only ever an owner, never a
        // subject — they answer to the coaching SLA instead.
        //
        // The window is deliberately long. At 30 days a leader who STOPS logging silently drops out
        // of this set, so going quiet would hide them from the very check meant to catch it. Six
        // months keeps a field-working leader in scope long enough for gone_quiet to fire on them.
        //
        // A field subject is scoped per active company via agent_company_links, which now
        // carries a per-company role/team_lead_id/manager_id (0021). One row per (user,
        // active company): a multi-company person (Lucky: manager in Goldrush, team_lead in
        // Stellr) is evaluated once per company with that company's role/owner/config.
        // NULL link columns fall back to the user's global users.* value. BO admin is a
        // shared tenant-level service — it never joins a company link (company_id stays NULL).
        const leadSince = new Date(nowMs - 180 * 86400000).toISOString().slice(0, 10);
        const agents = (await db.prepare(
          `SELECT u.id, u.first_name, u.last_name,
                  COALESCE(l.role, u.role) role,
                  COALESCE(l.team_lead_id, u.team_lead_id) team_lead_id,
                  COALESCE(l.manager_id, u.manager_id) manager_id,
                  l.company_id company_id
           FROM users u
           LEFT JOIN agent_company_links l
             ON l.agent_id = u.id AND l.is_active = 1 AND u.role != 'backoffice_admin'
           WHERE u.tenant_id = ? AND u.is_active = 1
             AND ( (u.role IN ('agent','field_agent','sales_rep')
                    AND (u.agent_type IS NULL OR u.agent_type IN ('field_ops','both')))
                OR (u.role IN ('team_lead','manager')
                    AND EXISTS (SELECT 1 FROM visits v
                                WHERE v.agent_id = u.id AND v.tenant_id = u.tenant_id AND v.visit_date >= ?))
                OR u.role = 'backoffice_admin' )`
        ).bind(tenantId, leadSince).all()).results || [];

        // Who is held to an agent's daily quota. A lead or manager in the field still isn't carrying
        // one, so the volume targets don't apply to them — quality and drop-off still do.
        const AGENT_SUBJECT = new Set(['agent', 'field_agent', 'sales_rep']);

        // A kpi.team_lead config overrides this if a program wants leads on their own numbers.
        const leadDefaults = (t) => ({ ...t, visits_per_day: 0, signups_per_day: 0 });

        // kpi.agent resolves per customer (getConfig prefers a company_id row over the tenant
        // default). Cached because every agent in a company resolves the same config.
        const cfgCache = new Map();
        const thresholdsFor = async (companyId) => {
          const key = companyId || '';
          if (!cfgCache.has(key)) cfgCache.set(key, (await getConfig(db, tenantId, companyId, 'kpi.agent')) || {});
          return cfgCache.get(key);
        };
        const leadCfgCache = new Map();
        const leadThresholdsFor = async (companyId) => {
          const key = companyId || '';
          if (!leadCfgCache.has(key)) {
            const own = await getConfig(db, tenantId, companyId, 'kpi.team_lead');
            leadCfgCache.set(key, own || leadDefaults(await thresholdsFor(companyId)));
          }
          return leadCfgCache.get(key);
        };
        // kpi.backoffice_admin resolves the same way — own config, no fallback (queue-health
        // thresholds don't derive from kpi.agent the way lead defaults do).
        const boCfgCache = new Map();
        const boThresholdsFor = async (companyId) => {
          const key = companyId || '';
          if (!boCfgCache.has(key)) boCfgCache.set(key, (await getConfig(db, tenantId, companyId, 'kpi.backoffice_admin')) || {});
          return boCfgCache.get(key);
        };

        // v2 rollout gate: the NEW signal families (trend, peer, gate-pace) only fire for a
        // tenant/company that opted in via config key cron.issue_signals_v2 = true. Default
        // off — on a pipeline with no staging, a config toggle beats a revert-and-redeploy.
        // The existing 6 signal types (and BO-admin queue-health, gated by kpi.backoffice_admin
        // seeding) are never gated by this.
        const v2Cache = new Map();
        const v2For = async (companyId) => {
          const key = companyId || '';
          if (!v2Cache.has(key)) v2Cache.set(key, (await getConfig(db, tenantId, companyId, 'cron.issue_signals_v2')) === true);
          return v2Cache.get(key);
        };
        // Working days elapsed as of the baseline snapshot date, for at_risk_gate's
        // prior-pace denominator. Cached per (company, date) — same for every agent there.
        const baseWdCache = new Map();
        const baselineWdFor = async (companyId, asOf) => {
          const key = `${companyId || ''}|${asOf}`;
          if (!baseWdCache.has(key)) baseWdCache.set(key, await workingDaysElapsed(db, tenantId, companyId, today.slice(0, 7), asOf));
          return baseWdCache.get(key);
        };

        // Registry gate-metric keys (visibility:'all'), same filter kpi.js's /kpi/self applies —
        // keeps an admin-configured tier target on a gm-only metric out of agent-facing signals.
        const gateKeysCache = new Map();
        const gateKeysFor = async (companyId) => {
          const key = companyId || '';
          if (!gateKeysCache.has(key)) {
            const registry = (await getConfig(db, tenantId, companyId, 'metrics')) || [];
            gateKeysCache.set(key, new Set(registry.filter((m) => m.gate && m.visibility === 'all').map((m) => m.key)));
          }
          return gateKeysCache.get(key);
        };

        // Pace context per (company, role). computeIncentive re-derived scale/working-days/base
        // salary per agent (~8 D1 queries each); at 64 agents that alone blew Workers'
        // 1000-subrequest invocation budget — every later D1 call threw, all swallowed by the
        // catch layers below, and this job went silent while earlier jobs in the tick kept working.
        // ponytail: budget was breached again (push delivery added to the earlier jobs in the
        // tick, 7e3300d) — reactToIssues now runs on its own cron trigger ("30 6-15 * * *",
        // routed in index.js's scheduled handler via event.cron) for a fresh per-invocation budget.
        const paceCache = new Map();
        const paceFor = async (companyId, role) => {
          const key = `${companyId || ''}|${role}`;
          if (!paceCache.has(key)) {
            const scale = await getScale(db, tenantId, companyId, role);
            const wd = await workingDaysElapsed(db, tenantId, companyId, today.slice(0, 7), today);
            paceCache.set(key, { tiers: scale?.tiers || [], wd });
          }
          return paceCache.get(key);
        };

        // Backstop owner. Three org-chart gaps make this load-bearing: agents with neither
        // team_lead_id nor manager_id (4 live today), managers with a NULL gm_id, and leaders who
        // sit at the top of their own chain. GMs cover many customers, so prefer
        // the GM assigned to the subject's customer before falling back to any GM in the tenant.
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
        const gmFor = (companyId) => gmByCompany.get(companyId) || tenantGmId;

        // --- Phase 1: compute signals per subject, no writes. Split from the persist loop
        // below because peer signals need every roster member's results before anything
        // persists (and computing signals twice would burn the subrequest budget).
        const computed = [];
        for (const agent of agents) {
          try {
            const isBoAdmin = agent.role === 'backoffice_admin';
            const thresholds = isBoAdmin
              ? await boThresholdsFor(agent.company_id)
              : AGENT_SUBJECT.has(agent.role)
                ? await thresholdsFor(agent.company_id)
                : await leadThresholdsFor(agent.company_id);
            if (!Object.keys(thresholds).length) continue; // this customer hasn't opted in

            let actual, baseline, signals;
            if (isBoAdmin) {
              // No field-activity window for queue-health signals, so there is no thin-window
              // to gate on — actual.days is a sentinel that trivially satisfies the M-1 resolve
              // gate below (evaluateBoSignals already reflects current data, not a rolling average).
              actual = { days: thresholds.min_days ?? 3 };
              signals = await boAdminSignals(db, tenantId, agent.id, thresholds);
            } else {
              const windowDays = thresholds.baseline_window_days || 14;
              const since = new Date(nowMs - windowDays * 86400000).toISOString().slice(0, 10);
              ({ actual, baseline, signals } = await agentSignals(db, tenantId, agent.id, thresholds, since));

              // v2 signal families (trend, peer, gate-pace) are min_days-gated — both
              // polarities — for the identical thin-window-noise reason as the existing
              // rate signals. gone_quiet stays the sole min_days-exempt signal, untouched.
              const v2 = await v2For(agent.company_id);
              const enoughDays = actual.days >= (thresholds.min_days ?? 3);
              // Trend: same actual/baseline pair evaluateSignals already reads; one signal
              // per thresholds-targeted metric moving >= improve_pct in either direction.
              if (v2 && enoughDays) signals.push(...trendSignals(actual, baseline, thresholds));

              // Pace signal: is this agent trailing the per-working-day gate targets for their next tier?
              // actual.days>0 guard mirrors kpi.js's /kpi/self — without it a brand-new agent with zero
              // visits floors workingDaysElapsed at 1 with all-zero averages and opens a below_gate issue
              // on day one.
              if (AGENT_SUBJECT.has(agent.role) && actual.days > 0) {
                // Same math as computeIncentive's provisional nextTier (count/wd vs tier gates),
                // minus the qualified/base-salary/working-days queries the pace signal never reads.
                const { tiers, wd } = await paceFor(agent.company_id, agent.role);
                const { count, deposits } = tiers.length
                  ? await agentCount(db, tenantId, agent.id, today.slice(0, 7))
                  : { count: 0, deposits: 0 };
                const allowedKeys = await gateKeysFor(agent.company_id);
                const metricNow = { signups: count / wd, deposits: deposits / wd };
                const ng = tiers.length ? nextGate(tiers, metricNow) : null;
                const gatedNg = ng
                  ? {
                      ...ng,
                      shortfall: Object.fromEntries(Object.entries(ng.shortfall || {}).filter(([k]) => allowedKeys.has(k))),
                      targets: Object.fromEntries(Object.entries(ng.targets || {}).filter(([k]) => allowedKeys.has(k))),
                    }
                  : null;
                signals.push(...signalBelowGate({ nextGate: gatedNg }));

                // v2 gate-pace pair. hit_gate_early: every tier cleared AND comfortably
                // (110%) over the top tier's gate metrics. at_risk_gate: still clearing a
                // gate metric today but month-pace slid >=10% vs the snapshot from
                // baseline_window_days ago — only comparable once that date falls inside
                // the current month (early-month has no in-month baseline; skip, don't guess).
                if (v2 && enoughDays && tiers.length) {
                  if (!ng) {
                    const top = [...tiers].sort((a, b) => (b.amount || 0) - (a.amount || 0))[0];
                    const topTargets = Object.fromEntries(
                      Object.entries(readTargets(top)).filter(([k]) => allowedKeys.has(k)));
                    signals.push(...signalHitGateEarly(metricNow, topTargets, thresholds));
                  } else if (gatedNg && since >= `${today.slice(0, 7)}-01`) {
                    const bWd = await baselineWdFor(agent.company_id, since);
                    const b = await agentCount(db, tenantId, agent.id, today.slice(0, 7), undefined, since);
                    signals.push(...signalAtRiskGate(
                      metricNow,
                      { signups: b.count / bWd, deposits: b.deposits / bWd },
                      gatedNg.targets, thresholds));
                  }
                }
              }
            }

            computed.push({ agent, thresholds, actual, signals, isBoAdmin });
          } catch (agentErr) {
            console.error(`reactToIssues compute error for ${agent.id}:`, agentErr);
          }
        }

        // --- Phase 1.5 (v2): peer signals. Roster = one team lead's field agents within one
        // company, ranked worst-first by the same rankRoster the cockpit roster uses; bottom
        // quartile flags team_bottom, top quartile team_top (peerSignals skips rosters < 4).
        const teams = new Map();
        for (const e of computed) {
          if (e.isBoAdmin || !AGENT_SUBJECT.has(e.agent.role) || !e.agent.team_lead_id) continue;
          if (!(await v2For(e.agent.company_id))) continue;
          const key = `${e.agent.company_id || ''}|${e.agent.team_lead_id}`;
          if (!teams.has(key)) teams.set(key, []);
          teams.get(key).push(e);
        }
        for (const members of teams.values()) {
          const byId = new Map(members.map((e) => [e.agent.id, e]));
          for (const p of peerSignals(rankRoster(members).map((e) => e.agent.id))) {
            const e = byId.get(p.id);
            // Same min_days gate as every other v2 signal: a thin-window member still
            // counts toward the ranking, but their thin data can't flag or crown them.
            if (e && e.actual.days >= (e.thresholds.min_days ?? 3))
              e.signals.push({ type: p.type, detail: p.detail });
          }
        }

        // --- Phase 2: persist. The deficit breach/escalation spine and recognition
        // highlights below are unchanged — now fed by the phase-1 results.
        for (const { agent, thresholds, actual, signals, isBoAdmin } of computed) {
          try {
            // Split by polarity (SIGNAL_REGISTRY is the one source of truth for this — see
            // kpiSignals.js). An unrecognized type can't be filed under either bucket safely,
            // so warn and drop just that one signal rather than throwing the whole agent out.
            const deficitSignals = [];
            const recognitionSignals = [];
            for (const s of signals) {
              const reg = SIGNAL_REGISTRY[s.type];
              if (!reg) { console.warn(`reactToIssues: unknown signal type "${s.type}", skipping`); continue; }
              (reg.polarity === 'recognition' ? recognitionSignals : deficitSignals).push(s);
            }

            // A leader's/BO-admin's own issue never lands on themselves — it goes up. Lucky is
            // his own team_lead_id, so this must key off the subject's role, not the link. Shared
            // by both the deficit-open and recognition-open paths below.
            const defaultOwner = () => {
              const leadId = AGENT_SUBJECT.has(agent.role) ? agent.team_lead_id : null;
              const ownerId = leadId || agent.manager_id || gmFor(agent.company_id);
              const ownerRole = leadId ? 'team_lead' : agent.manager_id ? 'manager' : 'general_manager';
              return { ownerId, ownerRole };
            };

            const name = `${agent.first_name || ''} ${agent.last_name || ''}`.trim()
              || (AGENT_SUBJECT.has(agent.role) ? 'An agent' : isBoAdmin ? 'A backoffice admin' : 'A team leader');

            // --- Deficit branch: unchanged breach/escalation logic, now scoped to polarity='deficit'. ---
            const live = await db.prepare(
              "SELECT * FROM issues WHERE tenant_id = ? AND subject_id = ? AND COALESCE(company_id,'') = COALESCE(?,'') AND polarity = 'deficit' AND status != 'resolved'"
            ).bind(tenantId, agent.id, agent.company_id || null).first();

            if (!deficitSignals.length) {
              // Empty signals are only a real recovery when we have enough active days
              // to judge on. A dark window (days === 0) or a thin one (days < min_days)
              // returns empty because there is too little to score, not because the agent
              // bounced back — resolving then would clear accountability for the very
              // people who vanished. Resolve only once activity is substantial enough to
              // trust the all-clear; keep the issue live while dark or thin.
              if (live && actual.days >= (thresholds.min_days ?? 3)) {
                await db.prepare("UPDATE issues SET status = 'resolved', updated_at = datetime('now') WHERE id = ?")
                  .bind(live.id).run();
              }
            } else {
              const types = deficitSignals.map((s) => s.type);
              const worst = [...types].sort((a, b) => severityOf([b]) - severityOf([a]))[0];
              const severity = severityOf(types);
              const detail = JSON.stringify(deficitSignals);

              if (!live) {
                const { ownerId, ownerRole } = defaultOwner();
                if (!ownerId || ownerId === agent.id) {
                  // nobody above them to hold accountable — fall through to recognition below
                } else {
                  const id = crypto.randomUUID();
                  await db.prepare(
                    `INSERT INTO issues (id, tenant_id, company_id, kind, subject_id, subject_role, owner_id, owner_role, severity, detail, polarity)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'deficit')`
                  ).bind(id, tenantId, agent.company_id || null, worst, agent.id, agent.role, ownerId, ownerRole, severity, detail).run();
                  await reactToIssue(db, env, tenantId, { id, owner_id: ownerId, subject_id: agent.id }, name, types, today);
                }
              } else {
                // Refresh the live row's picture of the problem before judging the SLA.
                // company_id too: an agent reassigned to another field_company mid-issue must
                // re-home the row, else escalation (gmFor(company_id)) and the GM unmanaged
                // view route it to the old company's manager.
                await db.prepare("UPDATE issues SET kind = ?, severity = ?, detail = ?, company_id = ?, updated_at = datetime('now') WHERE id = ?")
                  .bind(worst, severity, detail, agent.company_id || null, live.id).run();
                live.company_id = agent.company_id || null; // keep in-memory row in step for the escalation routing below

                // Defensive guard called out by the plan: the polarity-scoped query above already
                // ensures `live` is always a deficit row, so this is never expected to skip here.
                if (slaAppliesTo(live)) {
                  const clock = parseSqlUtc(slaClockOf(live));
                  const owner = await db.prepare(
                    'SELECT id, first_name, last_name, manager_id, gm_id FROM users WHERE id = ? AND tenant_id = ?'
                  ).bind(live.owner_id, tenantId).first();
                  let nextRole = nextOwnerRole(live.owner_role);
                  let nextId = null;
                  if (nextRole === 'manager') {
                    nextId = owner?.manager_id || null;
                    if (!nextId) { nextRole = 'general_manager'; nextId = gmFor(live.company_id); } // lead with no manager: straight to the GM
                  } else if (nextRole === 'general_manager') {
                    nextId = owner?.gm_id || gmFor(live.company_id);
                  }
                  if (nextId === live.owner_id) nextId = null; // never escalate an issue to the person already sitting on it

                  // Not breached, top of the chain, or nobody above the owner: keep pressing today's owner.
                  if (!clock || !isBreached(live.owner_role, clock.getTime(), nowMs) || !nextId) {
                    await reactToIssue(db, env, tenantId, live, name, types, today);
                  } else {
                    const escalations = live.escalations + 1;
                    await db.prepare(
                      `UPDATE issues SET owner_id = ?, owner_role = ?, status = 'open', owner_since = datetime('now'),
                       escalations = ?, updated_at = datetime('now') WHERE id = ?`
                    ).bind(nextId, nextRole, escalations, live.id).run();

                    // Name the owner who let it lapse — the escalation is the accountability record.
                    const prev = `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim() || 'the previous owner';
                    await notify(db, env, tenantId, nextId, 'issue_escalated',
                      `Escalated: ${name}`,
                      `${prev} didn't get to ${name}'s ${signalLabel(worst)} in time. It's yours now.`,
                      `issue_${live.id}_esc_${escalations}`);
                  }
                }
              }
            }

            // --- Recognition branch: highlights, not accountability items. No owner_since/SLA
            // meaning, no escalation, and only queried/touched when there is something to show —
            // insert on first occurrence, update detail/severity in place on repeat, notify once
            // on creation only (never re-notify on a tick where the highlight simply persists). ---
            if (recognitionSignals.length) {
              const rTypes = recognitionSignals.map((s) => s.type);
              const rWorst = [...rTypes].sort((a, b) => severityOf([b]) - severityOf([a]))[0];
              const rSeverity = severityOf(rTypes);
              const rDetail = JSON.stringify(recognitionSignals);
              const rLive = await db.prepare(
                "SELECT * FROM issues WHERE tenant_id = ? AND subject_id = ? AND COALESCE(company_id,'') = COALESCE(?,'') AND polarity = 'recognition' AND status != 'resolved'"
              ).bind(tenantId, agent.id, agent.company_id || null).first();

              if (!rLive) {
                const { ownerId, ownerRole } = defaultOwner();
                if (ownerId && ownerId !== agent.id) {
                  const rId = crypto.randomUUID();
                  await db.prepare(
                    `INSERT INTO issues (id, tenant_id, company_id, kind, subject_id, subject_role, owner_id, owner_role, severity, detail, polarity)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recognition')`
                  ).bind(rId, tenantId, agent.company_id || null, rWorst, agent.id, agent.role, ownerId, ownerRole, rSeverity, rDetail).run();
                  await notify(db, env, tenantId, agent.id, 'recognition',
                    `${name} earned a highlight`,
                    `What stood out: ${rTypes.map(signalLabel).join(', ')}. Nice work!`,
                    `issue_${rId}_recognition_${today}`);
                }
              } else {
                await db.prepare("UPDATE issues SET kind = ?, severity = ?, detail = ?, updated_at = datetime('now') WHERE id = ?")
                  .bind(rWorst, rSeverity, rDetail, rLive.id).run();
              }
            }
          } catch (agentErr) {
            console.error(`reactToIssues error for ${agent.id}:`, agentErr);
          }
        }
      } catch (tenantErr) {
        console.error(`reactToIssues error for tenant ${tenantId}:`, tenantErr);
      }
    }
  } catch (e) { console.error('reactToIssues error:', e); }
}

async function checkOverdueInvoices(db) {
  try {
    // TI-03: Scope by tenant to prevent cross-tenant updates
    const tenants = await db.prepare('SELECT DISTINCT tenant_id FROM sales_orders WHERE payment_status = ? AND due_date IS NOT NULL').bind('pending').all();
    for (const t of (tenants.results || [])) {
      await db.prepare("UPDATE sales_orders SET payment_status = 'overdue' WHERE tenant_id = ? AND payment_status = 'pending' AND due_date < datetime('now') AND due_date IS NOT NULL").bind(t.tenant_id).run();
    }
  } catch (e) { console.error('checkOverdueInvoices error:', e); }
}

async function checkLowStock(db) {
  try {
    const lowStock = await db.prepare("SELECT s.product_id, s.warehouse_id, s.quantity, p.name, s.tenant_id FROM stock_levels s JOIN products p ON s.product_id = p.id WHERE s.quantity <= COALESCE(s.reorder_level, 10) AND s.quantity > 0").all();
    for (const item of (lowStock.results || [])) {
      const id = crypto.randomUUID();
      await db.prepare("INSERT OR IGNORE INTO notifications (id, tenant_id, type, title, message, is_read, created_at) VALUES (?, ?, 'low_stock', ?, ?, 0, datetime('now'))").bind(id, item.tenant_id, `Low stock: ${item.name}`, `${item.name} has ${item.quantity} units remaining in warehouse ${item.warehouse_id}`).run();
    }
  } catch (e) { console.error('checkLowStock error:', e); }
}

async function checkStaleVanLoads(db) {
  try {
    // TI-03: Scope by tenant to prevent cross-tenant updates
    const tenants = await db.prepare("SELECT DISTINCT tenant_id FROM van_stock_loads WHERE status = 'active'").all();
    for (const t of (tenants.results || [])) {
      await db.prepare("UPDATE van_stock_loads SET status = 'stale' WHERE tenant_id = ? AND status = 'active' AND created_at < datetime('now', '-3 days')").bind(t.tenant_id).run();
    }
  } catch (e) { console.error('checkStaleVanLoads error:', e); }
}

async function closeCommissionPeriod(db) {
  try {
    // TI-03: Scope by tenant to prevent cross-tenant updates
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const periodName = lastMonth.toISOString().slice(0, 7);
    const tenants = await db.prepare("SELECT DISTINCT tenant_id FROM commission_earnings WHERE status = 'approved' AND period_start <= ?").bind(periodName).all();
    for (const t of (tenants.results || [])) {
      await db.prepare("UPDATE commission_earnings SET status = 'closed' WHERE tenant_id = ? AND status = 'approved' AND period_start <= ?").bind(t.tenant_id, periodName).run();
    }
  } catch (e) { console.error('closeCommissionPeriod error:', e); }
}

async function generateAgingReport(db) {
  try {
    // Use last payment date from payments table to calculate aging
    const customersWithBalance = await db.prepare("SELECT c.id, c.tenant_id, c.outstanding_balance, (SELECT MAX(p.created_at) FROM payments p JOIN sales_orders so ON p.sales_order_id = so.id WHERE so.customer_id = c.id) as last_payment_date FROM customers c WHERE c.outstanding_balance > 0").all();
    for (const cust of (customersWithBalance.results || [])) {
      let bracket = '90+';
      if (cust.last_payment_date) {
        const daysSince = Math.floor((Date.now() - new Date(cust.last_payment_date).getTime()) / 86400000);
        if (daysSince <= 30) bracket = '0-30';
        else if (daysSince <= 60) bracket = '31-60';
        else if (daysSince <= 90) bracket = '61-90';
      }
      await db.prepare("UPDATE customers SET notes = COALESCE(notes, '') || ' [aging:' || ? || ']' WHERE id = ? AND tenant_id = ?").bind(bracket, cust.id, cust.tenant_id).run();
    }
  } catch (e) { console.error('generateAgingReport error:', e); }
}

// Computes the same payload the GET /goldrush-individuals/insights endpoint
// returns, but invokable from cron without HTTP.
async function computeGoldrushIndividualInsights(db, tenantId, startDate, endDate, companyId = null) {
  const goldrushId = await resolveReportCompanyId(db, tenantId, companyId);
  if (!goldrushId) return null;
  let dateFilter = '';
  const binds = [tenantId, goldrushId];
  if (startDate) { dateFilter += ' AND v.visit_date >= ?'; binds.push(startDate); }
  if (endDate)   { dateFilter += ' AND v.visit_date <= ?'; binds.push(endDate); }
  const rows = await db.prepare(
    `SELECT v.id, v.visit_date, v.created_at, vi.custom_field_values,
            (SELECT vr.responses FROM visit_responses vr
               WHERE vr.visit_id = v.id
                 AND (vr.visit_type IS NULL OR vr.visit_type != 'store_custom_questions')
               LIMIT 1) as questionnaire_responses,
            u.first_name || ' ' || u.last_name as agent_name
       FROM visits v
       LEFT JOIN visit_individuals vi ON v.id = vi.visit_id
       LEFT JOIN users u ON v.agent_id = u.id
       WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type) = 'individual'
         AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)${dateFilter}
       ORDER BY v.visit_date ASC LIMIT 20000`
  ).bind(...binds).all();
  const list = rows.results || [];
  const totals = { individuals: list.length, converted: 0, with_id: 0, with_suggestion: 0 };
  const byAgent = new Map();
  const competitorCounts = new Map();
  for (const r of list) {
    let f = {};
    try { if (r.custom_field_values) Object.assign(f, typeof r.custom_field_values === 'string' ? JSON.parse(r.custom_field_values) : r.custom_field_values); } catch {}
    try { if (r.questionnaire_responses) Object.assign(f, typeof r.questionnaire_responses === 'string' ? JSON.parse(r.questionnaire_responses) : r.questionnaire_responses); } catch {}
    if (isConverted(f)) totals.converted += 1;
    if (f.goldrush_id && String(f.goldrush_id).trim()) totals.with_id += 1;
    if (f.platform_suggestions && String(f.platform_suggestions).trim()) totals.with_suggestion += 1;
    if (r.agent_name) {
      const a = byAgent.get(r.agent_name) || { agent: r.agent_name, visits: 0, conversions: 0 };
      a.visits += 1;
      if (isConverted(f)) a.conversions += 1;
      byAgent.set(r.agent_name, a);
    }
    const comp = f.competitor_company || f.who_is_competitor;
    if (comp) {
      if (Array.isArray(comp)) comp.forEach(x => { if (x) competitorCounts.set(x, (competitorCounts.get(x) || 0) + 1); });
      else String(comp).split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(x => competitorCounts.set(x, (competitorCounts.get(x) || 0) + 1));
    }
  }
  return {
    totals: { ...totals, conversion_rate: totals.individuals ? Math.round((totals.converted / totals.individuals) * 1000) / 10 : 0 },
    topAgents: Array.from(byAgent.values()).map(a => ({ ...a, conversion_rate: a.visits ? Math.round((a.conversions / a.visits) * 1000) / 10 : 0 })).sort((a, b) => b.visits - a.visits).slice(0, 10),
    competitors: Array.from(competitorCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
  };
}

async function computeGoldrushStoreInsights(db, tenantId, startDate, endDate, companyId = null) {
  const goldrushId = await resolveReportCompanyId(db, tenantId, companyId);
  if (!goldrushId) return null;
  let dateFilter = '';
  const binds = [tenantId, goldrushId];
  if (startDate) { dateFilter += ' AND v.visit_date >= ?'; binds.push(startDate); }
  if (endDate)   { dateFilter += ' AND v.visit_date <= ?'; binds.push(endDate); }
  const rows = await db.prepare(
    `SELECT v.id, v.customer_id, c.name as store_name,
            (SELECT vr.responses FROM visit_responses vr
               WHERE vr.visit_id = v.id AND vr.tenant_id = v.tenant_id
                 AND vr.visit_type = 'store_custom_questions' LIMIT 1) as store_responses,
            (SELECT MAX(vp.ai_share_of_voice) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.ai_share_of_voice IS NOT NULL) as ai_max_sov,
            (SELECT AVG(vp.ai_compliance_score) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.ai_compliance_score IS NOT NULL) as ai_avg_compliance,
            (SELECT COUNT(*) FROM visit_photos vp WHERE vp.visit_id = v.id) as photo_count,
            (SELECT COUNT(*) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.ai_analysis_status = 'completed') as ai_done
       FROM visits v
       LEFT JOIN customers c ON v.customer_id = c.id
       WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type) = 'store'${dateFilter}
       ORDER BY v.visit_date ASC LIMIT 20000`
  ).bind(...binds).all();
  const list = rows.results || [];
  const totals = { stores_visited: list.length, unique_stores: new Set(list.map(r => r.customer_id).filter(Boolean)).size, with_photos: 0, with_ai_completed: 0, with_stock: 0, with_advertising: 0, board_installed: 0, with_competitors: 0 };
  const sovList = []; const complianceList = [];
  const topStores = new Map();
  for (const r of list) {
    if (r.photo_count > 0) totals.with_photos += 1;
    if (r.ai_done > 0) totals.with_ai_completed += 1;
    if (r.ai_max_sov != null) sovList.push(Number(r.ai_max_sov));
    if (r.ai_avg_compliance != null) complianceList.push(Number(r.ai_avg_compliance));
    let f = {};
    try { if (r.store_responses) Object.assign(f, typeof r.store_responses === 'string' ? JSON.parse(r.store_responses) : r.store_responses); } catch {}
    if (String(f.stocks_product).toLowerCase() === 'yes') totals.with_stock += 1;
    if (String(f.has_advertising).toLowerCase() === 'yes') totals.with_advertising += 1;
    if (String(f.board_installed).toLowerCase() === 'yes') totals.board_installed += 1;
    if (String(f.competitors_in_store).toLowerCase() === 'yes') totals.with_competitors += 1;
    if (r.store_name) {
      const t = topStores.get(r.store_name) || { name: r.store_name, visits: 0 };
      t.visits += 1; topStores.set(r.store_name, t);
    }
  }
  const avgSov = sovList.length ? Math.round((sovList.reduce((a, b) => a + b, 0) / sovList.length) * 10) / 10 : 0;
  const avgCompliance = complianceList.length ? Math.round((complianceList.reduce((a, b) => a + b, 0) / complianceList.length) * 10) / 10 : 0;
  return {
    totals,
    avgSov,
    avgCompliance,
    topStores: Array.from(topStores.values()).sort((a, b) => b.visits - a.visits).slice(0, 10),
  };
}

function buildGoldrushWeeklyHtml({ tenantName, startDate, endDate, individuals, stores, recipientName }) {
  const periodLabel = `${startDate} to ${endDate}`;
  const greeting = recipientName ? `Hi ${htmlEscape(recipientName)},` : 'Hello,';

  let body = `<div style="font-family:Helvetica,Arial,sans-serif;color:#0F172A;max-width:680px;margin:0 auto;padding:0 16px">
    <div style="background:#0A0F1C;color:#fff;padding:18px 16px;border-radius:6px 6px 0 0">
      <div style="font-size:18px;font-weight:bold">FieldVibe — Goldrush weekly report</div>
      <div style="font-size:12px;color:#A0AEC0;margin-top:2px">${htmlEscape(tenantName || 'FieldVibe')} · Period: ${htmlEscape(periodLabel)}</div>
    </div>
    <div style="padding:18px 16px;background:#fff;border:1px solid #E2E8F0;border-top:0;border-radius:0 0 6px 6px">
      <p style="font-size:14px;margin:0 0 14px">${greeting}</p>
      <p style="font-size:14px;margin:0 0 14px">Here is the Goldrush activity summary for the past week.</p>`;

  if (individuals) {
    body += `<h2 style="font-size:16px;color:#0F172A;margin:20px 0 4px">Consumers</h2>` + kpiHtml([
      ['Individuals visited',  individuals.totals.individuals],
      ['Converted',            individuals.totals.converted],
      ['Conversion rate',      `${individuals.totals.conversion_rate}%`],
      ['Customers with Goldrush ID', individuals.totals.with_id],
      ['Customers with feedback',    individuals.totals.with_suggestion],
    ]);
    if (individuals.topAgents.length) {
      body += `<h3 style="font-size:14px;color:#0F172A;margin:14px 0 4px">Top agents</h3>` +
        tableHtml(['Agent', 'Visits', 'Conversions', 'Conv %'],
          individuals.topAgents.map(a => [a.agent, a.visits, a.conversions, a.conversion_rate + '%']));
    }
    if (individuals.competitors.length) {
      body += `<h3 style="font-size:14px;color:#0F172A;margin:14px 0 4px">Top competitors mentioned</h3>` +
        tableHtml(['Competitor', 'Mentions'], individuals.competitors.map(c => [c.name, c.count]));
    }
  }

  if (stores) {
    const t = stores.totals;
    body += `<h2 style="font-size:16px;color:#0F172A;margin:20px 0 4px">Stores</h2>` + kpiHtml([
      ['Store visits',                t.stores_visited],
      ['Unique stores',               t.unique_stores],
      ['Stores stocking product',     t.with_stock],
      ['Stores with advertising',     t.with_advertising],
      ['Stores with board installed', t.board_installed],
      ['Stores with photos',          t.with_photos],
      ['Stores with AI analysis',     t.with_ai_completed],
      ['Avg AI share of voice',       `${stores.avgSov}%`],
      ['Avg AI compliance score',     stores.avgCompliance],
    ]);
    if (stores.topStores.length) {
      body += `<h3 style="font-size:14px;color:#0F172A;margin:14px 0 4px">Top stores by visits</h3>` +
        tableHtml(['Store', 'Visits'], stores.topStores.map(s => [s.name, s.visits]));
    }
  }

  body += `<p style="font-size:12px;color:#64748B;margin:24px 0 0">This is an automated report from FieldVibe.<br>Login to <a href="https://fieldvibe.vantax.co.za" style="color:#0EA5E9">fieldvibe.vantax.co.za</a> for the full interactive dashboard with charts and PDF download.</p>`;
  body += `</div></div>`;
  return body;
}

async function sendWeeklyGoldrushReports(env) {
  const db = env.DB;
  // 7-day window ending today (UTC).
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startStr = start.toISOString().slice(0, 10);
  const endStr   = end.toISOString().slice(0, 10);

  const subs = await db.prepare(
    "SELECT s.id, s.tenant_id, s.recipient_email, s.recipient_name, t.name as tenant_name " +
    "FROM report_email_subscriptions s LEFT JOIN tenants t ON s.tenant_id = t.id " +
    "WHERE s.is_active = 1 AND s.report_key = 'goldrush-weekly'"
  ).all();

  const list = subs.results || [];
  for (const sub of list) {
    try {
      const [individuals, stores] = await Promise.all([
        computeGoldrushIndividualInsights(db, sub.tenant_id, startStr, endStr),
        computeGoldrushStoreInsights(db, sub.tenant_id, startStr, endStr),
      ]);
      // If neither has Goldrush configured for the tenant, skip silently.
      if (!individuals && !stores) {
        await db.prepare("UPDATE report_email_subscriptions SET last_sent_at = datetime('now'), last_sent_status = 'skipped', last_sent_error = 'No Goldrush company configured' WHERE id = ?").bind(sub.id).run();
        continue;
      }
      const html = buildGoldrushWeeklyHtml({
        tenantName: sub.tenant_name,
        startDate: startStr,
        endDate: endStr,
        individuals,
        stores,
        recipientName: sub.recipient_name,
      });
      const subject = `Goldrush weekly — ${startStr} to ${endStr}`;
      await sendEmailViaMailChannels(env, {
        to: sub.recipient_email,
        toName: sub.recipient_name,
        subject,
        html,
      });
      await db.prepare("UPDATE report_email_subscriptions SET last_sent_at = datetime('now'), last_sent_status = 'sent', last_sent_error = NULL WHERE id = ?").bind(sub.id).run();
    } catch (e) {
      const msg = (e && e.message) ? String(e.message).slice(0, 300) : 'send failed';
      await db.prepare("UPDATE report_email_subscriptions SET last_sent_at = datetime('now'), last_sent_status = 'failed', last_sent_error = ? WHERE id = ?").bind(msg, sub.id).run();
    }
  }
}

// Drain AI photo analysis backlog: each cron tick processes up to AI_DRAIN_BATCH_SIZE photos
// from any tenant whose photos are pending. Bounded so a backlog spike can't blow Worker CPU
// or Workers AI quota in a single tick.
const AI_DRAIN_BATCH_SIZE = 25;
async function drainAiBacklog(env) {
  try {
    const photos = await env.DB.prepare(
      "SELECT id, r2_key, tenant_id, visit_id, photo_type FROM visit_photos " +
      "WHERE r2_key IS NOT NULL " +
      "AND (ai_analysis_status IS NULL OR ai_analysis_status = '' OR ai_analysis_status = 'pending' OR ai_analysis_status = 'skipped') " +
      "AND NOT EXISTS (SELECT 1 FROM visit_photos vp2 WHERE vp2.tenant_id = visit_photos.tenant_id AND vp2.photo_hash = visit_photos.photo_hash AND vp2.photo_hash IS NOT NULL AND vp2.photo_hash != '' AND vp2.ai_analysis_status = 'completed' AND vp2.id != visit_photos.id) " +
      "ORDER BY created_at DESC LIMIT ?"
    ).bind(AI_DRAIN_BATCH_SIZE).all();
    const list = photos.results || [];
    if (list.length === 0) return;
    for (const p of list) {
      await env.DB.prepare("UPDATE visit_photos SET ai_analysis_status = 'processing' WHERE id = ?").bind(p.id).run();
    }
    // Fire and let the scheduled handler's ctx.waitUntil run them in the background.
    await Promise.all(list.map(p =>
      analyzePhotoWithAI(env, p.id, p.r2_key, p.tenant_id, p.visit_id, p.photo_type || 'general')
        .catch(err => console.error('drainAiBacklog: analysis failed for', p.id, err && err.message))
    ));
  } catch (err) {
    console.error('drainAiBacklog: top-level error', err && err.message);
  }
}

// Reset stuck 'processing' rows older than 30 minutes back to 'pending' so they get retried.
async function reapStuckAiProcessing(db) {
  try {
    await db.prepare(
      "UPDATE visit_photos SET ai_analysis_status = 'pending' " +
      "WHERE ai_analysis_status = 'processing' " +
      "AND (ai_processed_at IS NULL OR ai_processed_at < datetime('now', '-30 minutes')) " +
      "AND created_at < datetime('now', '-30 minutes')"
    ).run();
  } catch (err) {
    console.error('reapStuckAiProcessing failed', err && err.message);
  }
}

export {
  generateGmDigest,
  generatePerformanceSummaries,
  checkInactiveAgents,
  notify,
  reactToIssue,
  reactToIssues,
  checkOverdueInvoices,
  checkLowStock,
  checkStaleVanLoads,
  closeCommissionPeriod,
  generateAgingReport,
  sendWeeklyGoldrushReports,
  computeGoldrushIndividualInsights,
  computeGoldrushStoreInsights,
  buildGoldrushWeeklyHtml,
  drainAiBacklog,
  reapStuckAiProcessing,
  parseSqlUtc,
};
