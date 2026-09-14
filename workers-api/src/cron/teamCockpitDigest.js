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

function agentRowHtml(name, flags, isLead) {
  const bg = flags.length ? '#FEF2F2' : '#FFFFFF';
  const nameStyle = isLead ? 'font-weight:700;color:#0F172A' : 'color:#1F2937';
  const flagsHtml = flags.length
    ? flags.map((f) => `<div style="color:#B91C1C">${htmlEscape(f)}</div>`).join('')
    : '<span style="color:#16A34A">On track</span>';
  return `<tr style="background:${bg}">
    <td style="padding:6px 10px;border-bottom:1px solid #E2E8F0;font-size:13px;${nameStyle}">${htmlEscape(name)}${isLead ? ' (Team Lead)' : ''}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #E2E8F0;font-size:12px">${flagsHtml}</td>
  </tr>`;
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

  const leads = (await db.prepare(
    `SELECT id, ${nameSql} name FROM users WHERE tenant_id=? AND role='team_lead' AND is_active=1${coExists} ORDER BY first_name`
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
    return `<h3 style="color:#0F172A;font-size:14px;margin:18px 0 4px">${htmlEscape(tl.name || tl.id)}'s team</h3>
      <table style="border-collapse:collapse;width:100%;font-family:Helvetica,Arial,sans-serif">${rows}</table>`;
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
    unassignedHtml = `<h3 style="color:#0F172A;font-size:14px;margin:18px 0 4px">Unassigned</h3>
      <table style="border-collapse:collapse;width:100%;font-family:Helvetica,Arial,sans-serif">${rows.join('')}</table>`;
  }

  if (!leads.length && !unassigned.length) return null;

  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;padding:16px">
    <h2 style="color:#0F172A">Goldrush team cockpit — ${slotLabel} — ${dateStr}</h2>
    <p style="color:#475569;font-size:13px">${totalFlagged} of ${totalAgents} agents flagged, across ${leads.length} team${leads.length === 1 ? '' : 's'}.</p>
    ${teamSections.join('')}${unassignedHtml}
  </div>`;
}

export async function sendGoldrushTeamCockpitDigest(env, slotLabel) {
  const db = env.DB;
  const recipients = (env.EMAIL_RECIPIENTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!recipients.length) return;
  const dateStr = new Date().toISOString().slice(0, 10);
  const tenants = (await db.prepare(
    "SELECT DISTINCT tenant_id FROM users WHERE role = 'team_lead' AND is_active = 1"
  ).all()).results ?? [];

  for (const { tenant_id: tenantId } of tenants) {
    try {
      const companyId = await resolveReportCompanyId(db, tenantId, null);
      if (!companyId) continue; // no Goldrush company for this tenant
      const html = await buildDigestHtml(db, tenantId, companyId, slotLabel, dateStr);
      if (!html) continue;
      await sendEmailViaGraph(env, {
        to: recipients,
        subject: `Goldrush team cockpit — ${slotLabel} — ${dateStr}`,
        html,
      });
    } catch (e) {
      console.error(`sendGoldrushTeamCockpitDigest error for tenant ${tenantId}:`, e);
    }
  }
}
