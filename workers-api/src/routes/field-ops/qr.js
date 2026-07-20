/**
 * QR tracking step. A process-flow QR step shows a single-use code that redirects an
 * anonymous scanner to an admin-configured URL and records the hit.
 *   - one code = one tracked person: the first scan redeems it (people_reached);
 *     the agent issues/rerolls a fresh code for the next person.
 *   - every hit is logged (raw total_scans); only the first hit carries is_redemption=1.
 *   - redeemed codes still redirect (visitor never stranded); revoked codes return 410.
 * Authenticated routes are mounted on /field-ops; the public scan handler (handleScan)
 * is mounted on the unauthenticated app in index.js as GET /s/:token.
 */
import { Hono } from 'hono';
import { requireRole } from '../../middleware/auth.js';
import { periodRange } from './gm.js';
import { generateQrToken, isSafeDestinationUrl, buildScanUrl } from '../../lib/qr.js';

const app = new Hono();

// Managers/team leads see analytics; field roles do not.
const analyticsRoles = requireRole('admin', 'general_manager', 'backoffice_admin', 'manager', 'team_lead');

// Origin the QR image points at. The scan handler lives on the Worker (not the SPA),
// so the redirect is server-side and instant.
function scanBase(c) {
  return c.env.SCAN_BASE_URL || 'https://fieldvibe-api.vantax.co.za';
}

// [start, end) window from the shared period keyword (same contract as gm.js).
function windowFrom(c) {
  return periodRange(
    c.req.query('period') || 'month',
    new Date().toISOString(),
    c.req.query('anchor') || null,
    c.req.query('range_end') || null,
  );
}

async function stepDestination(db, tenantId, processFlowId, stepKey) {
  const row = await db.prepare(
    `SELECT config FROM process_flow_steps
      WHERE tenant_id = ? AND process_flow_id = ? AND step_key = ? LIMIT 1`,
  ).bind(tenantId, processFlowId, stepKey).first();
  if (!row) return null;
  try {
    return JSON.parse(row.config || '{}').destination_url || null;
  } catch {
    return null;
  }
}

async function insertCode(db, { tenantId, companyId, processFlowId, stepKey, visitId, agentId, destination, createdBy }) {
  const id = crypto.randomUUID();
  const token = generateQrToken();
  await db.prepare(
    `INSERT INTO qr_codes
       (id, token, tenant_id, company_id, process_flow_id, step_key, visit_id, agent_id, destination_url, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
  ).bind(id, token, tenantId, companyId, processFlowId, stepKey, visitId, agentId, destination, createdBy).run();
  return { id, token };
}

// POST /field-ops/qr/issue — mint a fresh single-use code for the current visit/step.
app.post('/qr/issue', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const processFlowId = body.process_flow_id;
  const stepKey = body.step_key || 'qr';
  const visitId = body.visit_id || null;
  const companyId = body.company_id || null;
  if (!processFlowId) return c.json({ success: false, message: 'process_flow_id required' }, 400);

  const destination = (await stepDestination(db, tenantId, processFlowId, stepKey) || '').trim();
  if (!destination) return c.json({ success: false, message: 'This QR step has no destination link configured' }, 400);
  if (!isSafeDestinationUrl(destination)) {
    return c.json({ success: false, message: 'The configured destination link is not a valid http(s) URL' }, 400);
  }

  const { id, token } = await insertCode(db, {
    tenantId, companyId, processFlowId, stepKey, visitId, agentId: userId, destination, createdBy: userId,
  });
  return c.json({ success: true, data: { id, token, scan_url: buildScanUrl(token, scanBase(c)), destination_url: destination } });
});

// POST /field-ops/qr/:id/reroll — issue a fresh code; revoke the old one if still active
// (redeemed codes stay redeemed so their link keeps working — this is the "next person" flow).
app.post('/qr/:id/reroll', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const oldId = c.req.param('id');

  const old = await db.prepare(`SELECT * FROM qr_codes WHERE tenant_id = ? AND id = ?`).bind(tenantId, oldId).first();
  if (!old) return c.json({ success: false, message: 'Code not found' }, 404);
  if (!isSafeDestinationUrl(old.destination_url)) {
    return c.json({ success: false, message: 'The destination link is no longer valid' }, 400);
  }

  const { id, token } = await insertCode(db, {
    tenantId,
    companyId: old.company_id,
    processFlowId: old.process_flow_id,
    stepKey: old.step_key,
    visitId: old.visit_id,
    agentId: userId,
    destination: old.destination_url,
    createdBy: userId,
  });
  await db.prepare(
    `UPDATE qr_codes SET status = 'revoked', superseded_by = ? WHERE tenant_id = ? AND id = ? AND status = 'active'`,
  ).bind(id, tenantId, oldId).run();

  return c.json({ success: true, data: { id, token, scan_url: buildScanUrl(token, scanBase(c)), destination_url: old.destination_url } });
});

// GET /field-ops/qr/:id/status — scan status for one code, polled by the issuing agent's
// device so the QR step can gate on a real scan. Not analytics-gated: any authenticated
// user may check a code in their own tenant.
app.get('/qr/:id/status', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const code = await db.prepare(`SELECT status FROM qr_codes WHERE tenant_id = ? AND id = ?`).bind(tenantId, id).first();
  if (!code) return c.json({ success: false, message: 'Code not found' }, 404);
  const row = await db.prepare(
    `SELECT COUNT(*) total, COALESCE(SUM(is_redemption), 0) redemptions FROM qr_scan_events WHERE tenant_id = ? AND qr_code_id = ?`,
  ).bind(tenantId, id).first();
  return c.json({ success: true, data: { status: code.status, total_scans: row?.total || 0, redemptions: row?.redemptions || 0 } });
});

// GET /field-ops/qr/step-stats?process_flow_id=&company_id=&period= — totals for a flow's QR step + recent codes.
app.get('/qr/step-stats', analyticsRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const processFlowId = c.req.query('process_flow_id') || null;
  const companyId = c.req.query('company_id') || null;
  const w = windowFrom(c);

  const gen = await db.prepare(
    `SELECT COUNT(*) n FROM qr_codes
      WHERE tenant_id = ? AND created_at >= ? AND created_at < ?
        AND (? IS NULL OR process_flow_id = ?) AND (? IS NULL OR company_id = ?)`,
  ).bind(tenantId, w.start, w.end, processFlowId, processFlowId, companyId, companyId).first();

  const scans = await db.prepare(
    `SELECT COUNT(*) total, COALESCE(SUM(is_redemption), 0) redeemed FROM qr_scan_events
      WHERE tenant_id = ? AND scanned_at >= ? AND scanned_at < ?
        AND (? IS NULL OR process_flow_id = ?) AND (? IS NULL OR company_id = ?)`,
  ).bind(tenantId, w.start, w.end, processFlowId, processFlowId, companyId, companyId).first();

  const { results: recent } = await db.prepare(
    `SELECT id, token, status, visit_id, agent_id, created_at, redeemed_at FROM qr_codes
      WHERE tenant_id = ? AND (? IS NULL OR process_flow_id = ?) AND (? IS NULL OR company_id = ?)
      ORDER BY created_at DESC LIMIT 50`,
  ).bind(tenantId, processFlowId, processFlowId, companyId, companyId).all();

  return c.json({
    success: true,
    data: {
      period: { start: w.start, end: w.end, mode: w.mode },
      codes_generated: gen?.n || 0,
      people_reached: scans?.redeemed || 0,
      total_scans: scans?.total || 0,
      recent: recent || [],
    },
  });
});

// GET /field-ops/qr/by-agent?company_id=&period= — per-agent scan breakdown.
app.get('/qr/by-agent', analyticsRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.req.query('company_id') || null;
  const processFlowId = c.req.query('process_flow_id') || null;
  const w = windowFrom(c);

  const { results } = await db.prepare(
    `SELECT e.agent_id,
            COALESCE(u.first_name || ' ' || u.last_name, e.agent_id) AS agent_name,
            COUNT(*) AS total_scans,
            COALESCE(SUM(e.is_redemption), 0) AS people_reached
       FROM qr_scan_events e
       LEFT JOIN users u ON u.id = e.agent_id AND u.tenant_id = e.tenant_id
      WHERE e.tenant_id = ? AND e.scanned_at >= ? AND e.scanned_at < ?
        AND (? IS NULL OR e.company_id = ?)
        AND (? IS NULL OR e.process_flow_id = ?)
      GROUP BY e.agent_id
      ORDER BY people_reached DESC, total_scans DESC`,
  ).bind(tenantId, w.start, w.end, companyId, companyId, processFlowId, processFlowId).all();

  return c.json({ success: true, data: { period: { start: w.start, end: w.end, mode: w.mode }, agents: results || [] } });
});

// GET /field-ops/qr/summary?company_id=&period= — tenant/company totals + daily series for tiles.
app.get('/qr/summary', analyticsRoles, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.req.query('company_id') || null;
  const w = windowFrom(c);

  const totals = await db.prepare(
    `SELECT COUNT(*) total, COALESCE(SUM(is_redemption), 0) redeemed FROM qr_scan_events
      WHERE tenant_id = ? AND scanned_at >= ? AND scanned_at < ? AND (? IS NULL OR company_id = ?)`,
  ).bind(tenantId, w.start, w.end, companyId, companyId).first();

  const gen = await db.prepare(
    `SELECT COUNT(*) n FROM qr_codes
      WHERE tenant_id = ? AND created_at >= ? AND created_at < ? AND (? IS NULL OR company_id = ?)`,
  ).bind(tenantId, w.start, w.end, companyId, companyId).first();

  const { results: series } = await db.prepare(
    `SELECT substr(scanned_at, 1, 10) d, COUNT(*) total, COALESCE(SUM(is_redemption), 0) redeemed
       FROM qr_scan_events
      WHERE tenant_id = ? AND scanned_at >= ? AND scanned_at < ? AND (? IS NULL OR company_id = ?)
      GROUP BY d ORDER BY d`,
  ).bind(tenantId, w.start, w.end, companyId, companyId).all();

  return c.json({
    success: true,
    data: {
      period: { start: w.start, end: w.end, mode: w.mode },
      codes_generated: gen?.n || 0,
      people_reached: totals?.redeemed || 0,
      total_scans: totals?.total || 0,
      series: series || [],
    },
  });
});

// Public, unauthenticated scan handler — mounted as GET /s/:token in index.js.
export async function handleScan(c) {
  const db = c.env.DB;
  const token = c.req.param('token');

  const code = await db.prepare(`SELECT * FROM qr_codes WHERE token = ?`).bind(token).first();
  if (!code) return c.text('Not found', 404);
  if (code.status === 'revoked') return c.text('This QR code is no longer active.', 410);

  // Flip active -> redeemed atomically; only the write that actually changes the row
  // counts as a redemption, so concurrent first-scans can't double-count a person.
  let isRedemption = 0;
  if (code.status === 'active') {
    const upd = await db.prepare(
      `UPDATE qr_codes SET status = 'redeemed', redeemed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'`,
    ).bind(code.id).run();
    isRedemption = (upd.meta?.changes ?? 0) > 0 ? 1 : 0;
  }

  await db.prepare(
    `INSERT INTO qr_scan_events
       (id, tenant_id, company_id, qr_code_id, agent_id, process_flow_id, is_redemption, ip, user_agent, referer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), code.tenant_id, code.company_id, code.id, code.agent_id, code.process_flow_id, isRedemption,
    c.req.header('CF-Connecting-IP') || null, c.req.header('User-Agent') || null, c.req.header('Referer') || null,
  ).run();

  // Defence-in-depth: destination was validated at issue time, re-check before redirecting.
  if (!isSafeDestinationUrl(code.destination_url)) return c.text('Invalid destination', 400);
  return c.redirect(code.destination_url, 302);
}

export default app;
