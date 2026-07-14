import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { generateToken } from '../lib/authUtils.js';
import { CONVERTED_SQL } from '../services/funnelService.js';
import { rateLimiter } from '../lib/middleware.js';
import { AuditLogService } from '../services/auditLogService.js';

// ponytail: AuditLogService has no exported singleton anywhere in the codebase
// (grepped — zero other callers), so it's instantiated once per isolate here
// rather than per-request, to avoid stacking a fresh setInterval per export call.
let auditServiceInstance = null;
const getAuditService = (db) => {
  if (!auditServiceInstance) auditServiceInstance = new AuditLogService(db);
  return auditServiceInstance;
};

const app = new Hono();

const companyAuthMiddleware = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }
    const token = authHeader.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      return c.json({ success: false, message: 'Malformed token' }, 401);
    }
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      return c.json({ success: false, message: 'Server configuration error' }, 500);
    }
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const signatureBytes = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      ch => ch.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify(
      'HMAC', key, signatureBytes, encoder.encode(parts[0] + '.' + parts[1])
    );
    if (!valid) {
      return c.json({ success: false, message: 'Invalid token' }, 401);
    }
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return c.json({ success: false, message: 'Token expired' }, 401);
    }
    // Company tokens have companyId in payload
    if (!payload.companyId) {
      return c.json({ success: false, message: 'Not a company token' }, 403);
    }
    const live = await c.env.DB.prepare(
      'SELECT is_active FROM company_logins WHERE id = ?'
    ).bind(payload.userId).first();
    if (!live || !live.is_active) {
      return c.json({ success: false, message: 'Access revoked' }, 401);
    }
    c.set('userId', payload.userId);
    c.set('tenantId', payload.tenantId);
    c.set('companyId', payload.companyId);
    c.set('role', payload.role);
    await next();
  } catch (error) {
    return c.json({ success: false, message: 'Invalid token' }, 401);
  }
};

// ==================== COMPANY PORTAL ENDPOINTS (company_token auth) ====================
// Company Dashboard — company users only see their own company data
app.get('/api/field-ops/company-portal/dashboard', companyAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.get('companyId');
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.substring(0, 7) + '-01';
  try {
    const [company, agentCount, todayVisits, monthVisits, totalRegs, totalConvs, recentRegs] = await Promise.all([
      db.prepare('SELECT * FROM field_companies WHERE id = ? AND tenant_id = ?').bind(companyId, tenantId).first(),
      db.prepare('SELECT COUNT(*) as count FROM agent_company_links WHERE company_id = ? AND tenant_id = ? AND is_active = 1').bind(companyId, tenantId).first(),
      db.prepare("SELECT COUNT(*) as count FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE acl.company_id = ? AND v.visit_date = ? AND v.tenant_id = ?").bind(companyId, today, tenantId).first(),
      db.prepare("SELECT COUNT(*) as count FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE acl.company_id = ? AND v.visit_date >= ? AND v.tenant_id = ?").bind(companyId, monthStart, tenantId).first(),
      db.prepare("SELECT COUNT(*) as count FROM visits WHERE company_id = ? AND tenant_id = ? AND LOWER(visit_type) = 'store'").bind(companyId, tenantId).first(),
      db.prepare(`SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.company_id = ? AND v.tenant_id = ? AND ${CONVERTED_SQL('vi')} AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)`).bind(companyId, tenantId).first(),
      db.prepare("SELECT v.*, u.first_name || ' ' || u.last_name as agent_name FROM visits v LEFT JOIN users u ON v.agent_id = u.id WHERE v.company_id = ? AND v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) ORDER BY v.created_at DESC LIMIT 10").bind(companyId, tenantId).all()
    ]);
    return c.json({ company, agents: agentCount?.count || 0, today_visits: todayVisits?.count || 0, month_visits: monthVisits?.count || 0, total_individuals: totalRegs?.count || 0, total_conversions: totalConvs?.count || 0, conversion_rate: (totalRegs?.count || 0) > 0 ? Math.round(((totalConvs?.count || 0) / (totalRegs?.count || 1)) * 100) : 0, recent_individuals: recentRegs.results || [] });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// Company Brand Insights (SSReports-style deep analytics) — company isolated
app.get('/api/field-ops/company-portal/brand-insights', companyAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.get('companyId');
  const { start_date, end_date } = c.req.query();
  const today = new Date().toISOString().split('T')[0];
  const startD = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endD = end_date || today;
  try {
    const baseParams = [tenantId, startD, endD, companyId];
    // Visits by day
    const visitsByDay = await db.prepare("SELECT v.visit_date, COUNT(*) as count FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND acl.company_id = ? GROUP BY v.visit_date ORDER BY v.visit_date").bind(...baseParams).all();
    // Visits by hour
    const visitsByHour = await db.prepare("SELECT CAST(substr(v.check_in_time, 12, 2) AS INTEGER) as hour, COUNT(*) as count FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND acl.company_id = ? AND v.check_in_time IS NOT NULL GROUP BY hour ORDER BY hour").bind(...baseParams).all();
    // Agent performance
    const agentPerf = await db.prepare("SELECT v.agent_id, u.first_name || ' ' || u.last_name as agent_name, COUNT(*) as visit_count, SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END) as completed FROM visits v JOIN users u ON v.agent_id = u.id JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND acl.company_id = ? GROUP BY v.agent_id ORDER BY visit_count DESC LIMIT 20").bind(...baseParams).all();
    // Registration stats
    const regParams = [tenantId, startD, endD, companyId];
    const regStats = await db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END) as converted FROM visits v LEFT JOIN visit_individuals vi ON v.id = vi.visit_id WHERE v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND v.visit_date >= ? AND v.visit_date <= ? AND v.company_id = ? AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)`).bind(...regParams).first();
    // Conversions by day
    const convByDay = await db.prepare(`SELECT v.visit_date as day, COUNT(*) as individuals, SUM(CASE WHEN ${CONVERTED_SQL('vi')} THEN 1 ELSE 0 END) as conversions FROM visits v LEFT JOIN visit_individuals vi ON v.id = vi.visit_id WHERE v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND v.visit_date >= ? AND v.visit_date <= ? AND v.company_id = ? AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) GROUP BY day ORDER BY day`).bind(...regParams).all();
    // Visits by day of week
    const visitsByDayOfWeek = await db.prepare("SELECT CASE CAST(strftime('%w', v.visit_date) AS INTEGER) WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue' WHEN 3 THEN 'Wed' WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri' WHEN 6 THEN 'Sat' END as day_name, CAST(strftime('%w', v.visit_date) AS INTEGER) as day_num, COUNT(*) as count FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND acl.company_id = ? GROUP BY day_num ORDER BY day_num").bind(...baseParams).all();
    // Daily targets vs actuals
    const targetVsActual = await db.prepare("SELECT dt.target_visits, dt.target_registrations, dt.target_conversions, u.first_name || ' ' || u.last_name as agent_name, (SELECT COUNT(*) FROM visits v2 WHERE v2.agent_id = dt.agent_id AND v2.visit_date = ? AND v2.tenant_id = ?) as actual_visits, (SELECT COUNT(*) FROM visits v3 WHERE v3.agent_id = dt.agent_id AND v3.company_id = dt.company_id AND v3.visit_date = ? AND v3.tenant_id = ? AND LOWER(v3.visit_type) = 'store') as actual_stores FROM daily_targets dt JOIN users u ON dt.agent_id = u.id WHERE dt.company_id = ? AND dt.tenant_id = ? AND dt.target_date = ?").bind(today, tenantId, today, tenantId, companyId, tenantId, today).all();
    // Recent individual registrations
    const recentRegs = await db.prepare("SELECT v.*, u.first_name || ' ' || u.last_name as agent_name FROM visits v LEFT JOIN users u ON v.agent_id = u.id WHERE v.company_id = ? AND v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND v.visit_date >= ? AND v.visit_date <= ? AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) ORDER BY v.created_at DESC LIMIT 20").bind(companyId, tenantId, startD, endD).all();
    // KPIs
    const totalVisits = (visitsByDay.results || []).reduce((s, d) => s + (d.count || 0), 0);
    const totalAgents = (agentPerf.results || []).length;
    return c.json({
      kpis: { total_visits: totalVisits, active_agents: totalAgents, total_individuals: regStats?.total || 0, total_conversions: regStats?.converted || 0, conversion_rate: (regStats?.total || 0) > 0 ? Math.round(((regStats?.converted || 0) / (regStats?.total || 1)) * 100) : 0 },
      visits_by_day: visitsByDay.results || [],
      visits_by_hour: visitsByHour.results || [],
      visits_by_day_of_week: visitsByDayOfWeek.results || [],
      agent_performance: agentPerf.results || [],
      conversions_by_day: convByDay.results || [],
      target_vs_actual: targetVsActual.results || [],
      recent_individuals: recentRegs.results || [],
      period: { start: startD, end: endD }
    });
  } catch (e) {
    return c.json({ error: e.message, kpis: {}, visits_by_day: [], visits_by_hour: [], visits_by_day_of_week: [], agent_performance: [], conversions_by_day: [], target_vs_actual: [], recent_individuals: [] }, 500);
  }
});

// Company Portal: Store Analytics — company isolated
app.get('/api/field-ops/company-portal/store-analytics', companyAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.get('companyId');
  const { start_date, end_date, page, limit: lim, search } = c.req.query();
  const today = new Date().toISOString().split('T')[0];
  const startD = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endD = end_date || today;
  const pageNum = parseInt(page || '1', 10);
  const pageSize = parseInt(lim || '20', 10);
  const offset = (pageNum - 1) * pageSize;
  try {
    const searchFilter = search ? ` AND (s.name LIKE '%' || ? || '%' OR s.address LIKE '%' || ? || '%')` : '';
    const baseWhere = `FROM customers s LEFT JOIN (SELECT v.customer_id, COUNT(*) as total_visits, SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END) as completed_visits, MAX(v.visit_date) as last_visit FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE acl.company_id = ? AND v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? GROUP BY v.customer_id) vs ON s.id = vs.customer_id WHERE s.tenant_id = ? AND s.id IN (SELECT DISTINCT v2.customer_id FROM visits v2 JOIN agent_company_links acl2 ON v2.agent_id = acl2.agent_id WHERE acl2.company_id = ? AND v2.tenant_id = ? AND v2.customer_id IS NOT NULL)${searchFilter}`;
    const baseParams = search
      ? [companyId, tenantId, startD, endD, tenantId, companyId, tenantId, search, search]
      : [companyId, tenantId, startD, endD, tenantId, companyId, tenantId];
    const countResult = await db.prepare(`SELECT COUNT(*) as total ${baseWhere}`).bind(...baseParams).first();
    const shops = await db.prepare(`SELECT s.id, s.name, s.address, s.latitude, s.longitude, COALESCE(vs.total_visits, 0) as total_visits, COALESCE(vs.completed_visits, 0) as completed_visits, vs.last_visit ${baseWhere} ORDER BY vs.total_visits DESC LIMIT ? OFFSET ?`).bind(...baseParams, pageSize, offset).all();
    const totalShops = countResult?.total || 0;
    // Aggregate KPIs across ALL stores (not just current page)
    const kpiAgg = await db.prepare(`SELECT COALESCE(SUM(vs.total_visits), 0) as total_visits, COALESCE(SUM(vs.completed_visits), 0) as completed_visits ${baseWhere}`).bind(...baseParams).first();
    const allVisits = kpiAgg?.total_visits || 0;
    const allCompleted = kpiAgg?.completed_visits || 0;
    return c.json({
      shops: shops.results || [],
      total: totalShops,
      page: pageNum,
      limit: pageSize,
      kpis: { total_shops: totalShops, total_visits: allVisits, completed_visits: allCompleted, avg_visits_per_shop: totalShops > 0 ? Math.round(allVisits / totalShops) : 0 },
      period: { start: startD, end: endD }
    });
  } catch (e) {
    return c.json({ error: e.message, shops: [], total: 0, kpis: {} }, 500);
  }
});

// Company Portal: Store Detail — company isolated
app.get('/api/field-ops/company-portal/store-analytics/:shopId', companyAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.get('companyId');
  const shopId = c.req.param('shopId');
  try {
    const shop = await db.prepare('SELECT * FROM customers WHERE id = ? AND tenant_id = ?').bind(shopId, tenantId).first();
    if (!shop) return c.json({ error: 'Shop not found' }, 404);
    // Verify the shop is associated with this company (has visits from company agents)
    const companyLink = await db.prepare('SELECT 1 FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE v.customer_id = ? AND acl.company_id = ? AND v.tenant_id = ? LIMIT 1').bind(shopId, companyId, tenantId).first();
    if (!companyLink) return c.json({ error: 'Shop not found' }, 404);
    const visits = await db.prepare("SELECT v.id, v.visit_date, v.status, v.check_in_time, v.check_out_time, v.visit_type, v.notes, v.photo_url, u.first_name || ' ' || u.last_name as agent_name FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id LEFT JOIN users u ON v.agent_id = u.id WHERE v.customer_id = ? AND acl.company_id = ? AND v.tenant_id = ? ORDER BY v.visit_date DESC, v.check_in_time DESC LIMIT 50").bind(shopId, companyId, tenantId).all();
    const stats = await db.prepare("SELECT COUNT(*) as total_visits, SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END) as completed FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE v.customer_id = ? AND acl.company_id = ? AND v.tenant_id = ?").bind(shopId, companyId, tenantId).first();
    return c.json({ shop, visits: visits.results || [], stats: { total_visits: stats?.total_visits || 0, completed: stats?.completed || 0 } });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// Company Portal: Visit Records — company isolated, paginated
app.get('/api/field-ops/company-portal/visit-records', companyAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.get('companyId');
  const { start_date, end_date, page, limit: lim, search, visit_type } = c.req.query();
  const today = new Date().toISOString().split('T')[0];
  const startD = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endD = end_date || today;
  const pageNum = parseInt(page || '1', 10);
  const pageSize = parseInt(lim || '20', 10);
  const offset = (pageNum - 1) * pageSize;
  try {
    let filters = '';
    let filtersNoType = '';
    const baseParams = [companyId, tenantId, startD, endD];
    const paramsNoType = [...baseParams];
    if (search) { filtersNoType += " AND (u.first_name || ' ' || u.last_name LIKE '%' || ? || '%' OR s.name LIKE '%' || ? || '%')"; paramsNoType.push(search, search); }
    filters = filtersNoType;
    const params = [...paramsNoType];
    if (visit_type) { filters += ' AND v.visit_type = ?'; params.push(visit_type); }
    const baseJoin = `FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id LEFT JOIN users u ON v.agent_id = u.id LEFT JOIN customers s ON v.customer_id = s.id WHERE acl.company_id = ? AND v.tenant_id = ? AND v.visit_date BETWEEN ? AND ?`;
    const baseFrom = `${baseJoin}${filters}`;
    const baseFromNoType = `${baseJoin}${filtersNoType}`;
    const countResult = await db.prepare(`SELECT COUNT(*) as total ${baseFrom}`).bind(...params).first();
    const visits = await db.prepare(`SELECT v.id, v.visit_date, v.visit_type, v.status, v.check_in_time, v.check_out_time, v.notes, v.photo_url, v.latitude, v.longitude, u.first_name || ' ' || u.last_name as agent_name, s.name as shop_name ${baseFrom} ORDER BY v.visit_date DESC, v.check_in_time DESC LIMIT ? OFFSET ?`).bind(...params, pageSize, offset).all();
    // Type breakdown must exclude visit_type filter so all types are always visible
    const typeBreakdown = await db.prepare(`SELECT v.visit_type, COUNT(*) as count ${baseFromNoType} GROUP BY v.visit_type`).bind(...paramsNoType).all();
    return c.json({
      visits: visits.results || [],
      total: countResult?.total || 0,
      page: pageNum,
      limit: pageSize,
      type_breakdown: typeBreakdown.results || [],
      period: { start: startD, end: endD }
    });
  } catch (e) {
    return c.json({ error: e.message, visits: [], total: 0 }, 500);
  }
});

// Company Portal: Performance Highlights — company isolated
app.get('/api/field-ops/company-portal/highlights', companyAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.get('companyId');
  const { start_date, end_date } = c.req.query();
  const today = new Date().toISOString().split('T')[0];
  const startD = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endD = end_date || today;
  try {
    const baseParams = [tenantId, startD, endD, companyId];
    const peakHour = await db.prepare("SELECT CAST(substr(v.check_in_time, 12, 2) AS INTEGER) as hour, COUNT(*) as count FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND acl.company_id = ? AND v.check_in_time IS NOT NULL GROUP BY hour ORDER BY count DESC LIMIT 1").bind(...baseParams).first();
    const peakDay = await db.prepare("SELECT CASE CAST(strftime('%w', v.visit_date) AS INTEGER) WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday' END as day_name, COUNT(*) as count FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND acl.company_id = ? GROUP BY day_name ORDER BY count DESC LIMIT 1").bind(...baseParams).first();
    const topAgent = await db.prepare("SELECT u.first_name || ' ' || u.last_name as agent_name, COUNT(*) as visit_count FROM visits v JOIN users u ON v.agent_id = u.id JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND acl.company_id = ? GROUP BY v.agent_id ORDER BY visit_count DESC LIMIT 1").bind(...baseParams).first();
    const avgVisitsPerAgent = await db.prepare("SELECT ROUND(AVG(vc), 1) as avg_visits FROM (SELECT COUNT(*) as vc FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND acl.company_id = ? GROUP BY v.agent_id)").bind(...baseParams).first();
    const totalStores = await db.prepare("SELECT COUNT(DISTINCT v.customer_id) as count FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND acl.company_id = ? AND v.customer_id IS NOT NULL").bind(...baseParams).first();
    return c.json({
      peak_hour: peakHour ? { hour: peakHour.hour, count: peakHour.count } : null,
      peak_day: peakDay ? { day_name: peakDay.day_name, count: peakDay.count } : null,
      top_agent: topAgent ? { name: topAgent.agent_name, visit_count: topAgent.visit_count } : null,
      avg_visits_per_agent: avgVisitsPerAgent?.avg_visits || 0,
      total_stores_visited: totalStores?.count || 0,
      period: { start: startD, end: endD }
    });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// Company Portal: Export data (CSV)
app.get('/api/field-ops/company-portal/export', companyAuthMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.get('companyId');
  const { type, start_date, end_date } = c.req.query();
  const today = new Date().toISOString().split('T')[0];
  const startD = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endD = end_date || today;
  try {
    let rows = [];
    let headers = [];
    if (type === 'registrations') {
      headers = ['Name', 'ID Number', 'Phone', 'Agent', 'Status', 'Date'];
      const result = await db.prepare(`SELECT i.first_name, i.last_name, i.id_number, i.phone, u.first_name || ' ' || u.last_name as agent_name, CASE WHEN ${CONVERTED_SQL('vi')} THEN 'Converted' ELSE 'Pending' END as status, v.created_at FROM visits v LEFT JOIN visit_individuals vi ON v.id = vi.visit_id LEFT JOIN individuals i ON vi.individual_id = i.id LEFT JOIN users u ON v.agent_id = u.id WHERE v.company_id = ? AND v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND v.visit_date >= ? AND v.visit_date <= ? AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) ORDER BY v.created_at DESC`).bind(companyId, tenantId, startD, endD).all();
      rows = (result.results || []).map(r => [r.first_name + ' ' + r.last_name, r.id_number || '', r.phone || '', r.agent_name || '', r.status, r.created_at]);
    } else {
      headers = ['Date', 'Agent', 'Status', 'Check In', 'Check Out', 'Notes'];
      const result = await db.prepare("SELECT v.visit_date, u.first_name || ' ' || u.last_name as agent_name, v.status, v.check_in_time, v.check_out_time, v.notes FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id LEFT JOIN users u ON v.agent_id = u.id WHERE acl.company_id = ? AND v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? ORDER BY v.visit_date DESC").bind(companyId, tenantId, startD, endD).all();
      rows = (result.results || []).map(r => [r.visit_date, r.agent_name || '', r.status || '', r.check_in_time || '', r.check_out_time || '', (r.notes || '').replace(/,/g, ';')]);
    }
    const csvLines = [headers.join(','), ...rows.map(r => r.map(v => String(v).includes(',') ? `"${v}"` : v).join(','))];
    const auditService = getAuditService(db);
    await auditService.log({
      tenantId,
      userId: c.get('userId'),
      action: 'portal_export',
      resource: 'company_portal_csv',
      resourceId: companyId,
      metadata: { type: type || 'visits', start: startD, end: endD, rows: rows.length },
      ipAddress: c.req.header('CF-Connecting-IP') || '',
      status: 'SUCCESS'
    });
    // ponytail: flush immediately rather than trust the 5s periodic timer —
    // a Worker isolate can be torn down right after the response is sent.
    await auditService.flushBuffer();
    return new Response(csvLines.join('\n'), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${type || 'visits'}_export_${startD}_to_${endD}.csv"` }
    });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// ==================== FIELD OPERATIONS: COMPANY AUTH (PUBLIC - no authMiddleware) ====================
app.post('/api/field-ops/company-auth/login', rateLimiter(5, 60000), async (c) => {
  const db = c.env.DB;
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ success: false, message: 'Email and password required' }, 400);
  try {
    const login = await db.prepare("SELECT cl.*, fc.name as company_name, fc.tenant_id FROM company_logins cl JOIN field_companies fc ON cl.company_id = fc.id WHERE cl.email = ? AND cl.is_active = 1").bind(email).first();
    if (!login) return c.json({ success: false, message: 'Invalid credentials' }, 401);
    const passwordValid = await bcrypt.compare(password, login.password_hash);
    if (!passwordValid) return c.json({ success: false, message: 'Invalid credentials' }, 401);
    await db.prepare("UPDATE company_logins SET last_login = CURRENT_TIMESTAMP WHERE id = ?").bind(login.id).run();
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) return c.json({ success: false, message: 'Server configuration error' }, 500);
    const token = await generateToken({ userId: login.id, tenantId: login.tenant_id, role: 'company_' + login.role, companyId: login.company_id }, jwtSecret);
    return c.json({ token, company_id: login.company_id, company_name: login.company_name, role: login.role, name: login.name });
  } catch (e) {
    return c.json({ success: false, message: 'Login failed' }, 500);
  }
});


export default app;
