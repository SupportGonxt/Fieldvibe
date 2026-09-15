// workers-api/src/cron/teamCockpitDigest.js
// Daily Goldrush team-cockpit digest: every team lead and their agents, with the
// same underperformance signals the in-app Team Cockpit roster shows (SIGNAL_REGISTRY
// in services/kpiSignals.js — gone_quiet, below_target, late_start, short_field_day,
// etc.). Mailed via Microsoft Graph twice a day (07:00 / 19:00 SAST, wired in index.js).
//
// Recipients are env.EMAIL_RECIPIENTS (comma-separated), a plain config value rather
// than a DB lookup of "the GM" — pointing this at Abigail for real is an env var
// change, not a code change. Goldrush-only: resolveReportCompanyId's legacy
// name-LIKE-goldrush default is used, same as every other goldrush-* report.
import { getConfig } from '../routes/field-ops/config.js';
import { agentSignals } from '../routes/field-ops/kpi.js';
import { resolveReportCompanyId, mapLimit } from '../lib/aggregates.js';
import { SIGNAL_REGISTRY, signalLabel } from '../services/kpiSignals.js';
import { sendEmailViaGraph } from '../lib/msGraphMail.js';
import { htmlEscape } from './email.js';

const LEAD_CONCURRENCY = 4;
const ROW_CONCURRENCY = 6;

function signalsText(signals) {
  return (signals || []).map((s) => SIGNAL_REGISTRY[s.type]?.buildText(s.detail) || signalLabel(s.type));
}

const FONT_STACK = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

function agentRowHtml(name, flags, isLead) {
  const flagged = flags.length > 0;
  const borderColor = flagged ? '#EF4444' : '#2ECC71';
  const rowBg = isLead ? '#E6FBF2' : '#FFFFFF';
  const leadBadge = isLead
    ? `<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:4px;background:#00E87B;color:#04110A;font-size:10px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;vertical-align:middle">Lead</span>`
    : '';
  const flagsHtml = flagged
    ? flags.map((f) => `<span style="display:inline-block;background:#FEE2E2;color:#B91C1C;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;margin:2px 4px 2px 0;white-space:nowrap">${htmlEscape(f)}</span>`).join('')
    : `<span style="display:inline-block;background:#DCFCE7;color:#16A34A;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px">On track</span>`;
  return `<tr style="background:${rowBg}">
    <td style="padding:9px 12px;border-bottom:1px solid #EEF2F6;border-left:3px solid ${borderColor};font-size:13px;font-weight:${isLead ? 700 : 400};color:${isLead ? '#0F172A' : '#1F2937'}">${htmlEscape(name)}${leadBadge}</td>
    <td style="padding:9px 12px;border-bottom:1px solid #EEF2F6;font-size:12px">${flagsHtml}</td>
  </tr>`;
}

function teamCardHtml(title, rows) {
  return `<div style="border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:16px;box-shadow:0 2px 8px rgba(15,23,42,0.06)">
    <div style="background:#F8FAFC;padding:10px 16px;border-bottom:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#0F172A;font-family:${FONT_STACK}">${title}</div>
    <table style="border-collapse:collapse;width:100%;font-family:${FONT_STACK}">${rows}</table>
  </div>`;
}

// Same roster shape as GET /kpi/roster's admin branch (team leads + their agents,
// scoped to one company via agent_company_links), rebuilt here for cron use (no
// HTTP request/response, and we want every lead regardless of who's asking).
async function buildDigestHtml(db, tenantId, companyId, slotLabel, dateStr) {
  const thresholds = (await getConfig(db, tenantId, companyId, 'kpi.agent')) || {};
  if (!Object.keys(thresholds).length) return null; // tenant/company hasn't opted into KPI thresholds
  const leadThresholds = (await getConfig(db, tenantId, companyId, 'kpi.team_lead'))
    || { ...thresholds, visits_per_day: 0, signups_per_day: 0 };
  const windowDays = thresholds.baseline_window_days || 14;
  const since = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);

  const coExists = ` AND EXISTS (SELECT 1 FROM agent_company_links acl
      WHERE acl.agent_id = users.id AND acl.tenant_id = users.tenant_id
        AND acl.is_active = 1 AND acl.company_id = ?)`;
  const nameSql = `TRIM(COALESCE(first_name,'')||' '||COALESCE(last_name,''))`;

  // LOWER(TRIM(first_name)) != 'test' excludes the known test team-lead account from
  // the Goldrush roster — same UUID-id-test-user heuristic as incentives.js's payroll
  // counts (id NOT LIKE 'agent-test-%' doesn't catch this one; it has a real UUID id).
  const leads = (await db.prepare(
    `SELECT id, ${nameSql} name FROM users WHERE tenant_id=? AND role='team_lead' AND is_active=1
       AND LOWER(TRIM(first_name)) != 'test'${coExists} ORDER BY first_name`
  ).bind(tenantId, companyId).all()).results ?? [];

  let totalAgents = 0, totalFlagged = 0;
  const teamSections = await mapLimit(leads, LEAD_CONCURRENCY, async (tl) => {
    const members = (await db.prepare(
      `SELECT id, ${nameSql} name FROM users WHERE tenant_id=? AND team_lead_id=? AND is_active=1${coExists} ORDER BY first_name`
    ).bind(tenantId, tl.id, companyId).all()).results ?? [];

    const [leadResult, agentRows] = await Promise.all([
      agentSignals(db, tenantId, tl.id, leadThresholds, since),
      mapLimit(members, ROW_CONCURRENCY, async (m) => {
        const { signals } = await agentSignals(db, tenantId, m.id, thresholds, since);
        return { name: m.name || m.id, signals };
      }),
    ]);
    totalAgents += agentRows.length;
    totalFlagged += agentRows.filter((a) => a.signals.length).length;

    const rows = [
      agentRowHtml(tl.name || tl.id, signalsText(leadResult.signals), true),
      ...agentRows.map((a) => agentRowHtml(a.name, signalsText(a.signals), false)),
    ].join('');
    return teamCardHtml(`${htmlEscape(tl.name || tl.id)}'s team`, rows);
  });

  const unassigned = (await db.prepare(
    `SELECT id, ${nameSql} name FROM users WHERE tenant_id=? AND team_lead_id IS NULL AND is_active=1
       AND role IN ('agent','field_agent','sales_rep')${coExists} ORDER BY first_name`
  ).bind(tenantId, companyId).all()).results ?? [];
  let unassignedHtml = '';
  if (unassigned.length) {
    const rows = await mapLimit(unassigned, ROW_CONCURRENCY, async (m) => {
      const { signals } = await agentSignals(db, tenantId, m.id, thresholds, since);
      totalAgents += 1;
      if (signals.length) totalFlagged += 1;
      return agentRowHtml(m.name || m.id, signalsText(signals), false);
    });
    unassignedHtml = teamCardHtml('Unassigned', rows.join(''));
  }

  if (!leads.length && !unassigned.length) return null;

  return `<div style="font-family:${FONT_STACK};max-width:680px;margin:0 auto;padding:24px 16px;background:#F8FAFC;color:#0F172A">
    <div style="margin-bottom:18px">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;margin-bottom:6px">Field<span style="color:#00E87B">Vibe</span></div>
      <h1 style="margin:0;font-size:22px;line-height:1.3;color:#0F172A;font-weight:800">Team Cockpit Report</h1>
      <div style="margin-top:4px;font-size:13px;color:#64748B">${htmlEscape(dateStr)} &middot; ${htmlEscape(slotLabel)}</div>
    </div>
    <p style="color:#334155;font-size:14px;margin:0 0 20px;line-height:1.5">
      <strong style="color:#0F172A">${totalFlagged}</strong> of <strong style="color:#0F172A">${totalAgents}</strong> people have no visit logged in the last 24 hours, across ${leads.length} team${leads.length === 1 ? '' : 's'}.
    </p>
    ${teamSections.join('')}${unassignedHtml}
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #E2E8F0;text-align:center">
      <a href="https://fieldvibe.vantax.co.za" style="color:#00C468;font-size:13px;font-weight:600;text-decoration:none">View live dashboard &rarr;</a>
    </div>
  </div>`;
}

// options.tenantId restricts the run to one tenant (the manual admin trigger, scoped to
// the requesting admin's own tenant) instead of every tenant with team leads (the cron).
// Returns a per-tenant status list — the manual trigger surfaces it directly so "nothing
// arrived" can be diagnosed (no Goldrush company vs. no kpi.agent config vs. a send failure)
// without needing DB access.
export async function sendGoldrushTeamCockpitDigest(env, slotLabel, { tenantId: onlyTenantId } = {}) {
  const db = env.DB;
  const recipients = (env.EMAIL_RECIPIENTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!recipients.length) return [{ tenantId: onlyTenantId || null, status: 'skipped', reason: 'EMAIL_RECIPIENTS not configured' }];
  const dateStr = new Date().toISOString().slice(0, 10);
  const tenants = onlyTenantId
    ? [{ tenant_id: onlyTenantId }]
    : (await db.prepare("SELECT DISTINCT tenant_id FROM users WHERE role = 'team_lead' AND is_active = 1").all()).results ?? [];

  const results = [];
  for (const { tenant_id: tenantId } of tenants) {
    try {
      const companyId = await resolveReportCompanyId(db, tenantId, null);
      if (!companyId) { results.push({ tenantId, status: 'skipped', reason: 'no Goldrush company found for this tenant' }); continue; }
      const html = await buildDigestHtml(db, tenantId, companyId, slotLabel, dateStr);
      if (!html) { results.push({ tenantId, status: 'skipped', reason: 'no kpi.agent config, or no team leads/agents linked to Goldrush' }); continue; }
      await sendEmailViaGraph(env, {
        to: recipients,
        subject: `Goldrush team cockpit — ${slotLabel} — ${dateStr}`,
        html,
      });
      results.push({ tenantId, status: 'sent', to: recipients });
    } catch (e) {
      console.error(`sendGoldrushTeamCockpitDigest error for tenant ${tenantId}:`, e);
      results.push({ tenantId, status: 'failed', error: String(e?.message || e).slice(0, 300) });
    }
  }
  return results;
}
