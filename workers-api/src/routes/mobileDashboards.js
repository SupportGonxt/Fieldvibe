import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { cachedD1Query } from '../lib/cache.js';
import { DEFAULT_WD_CONFIG, resolveWorkingDaysConfigBatch, countWorkingDaysInMonth, buildFallbackMonthlyTargets, getUserMonthlyTargetFromRules, generateTargetsFromRules, computeTargetTotalsFromRules } from '../lib/calendar.js';
import { getCommissionTotals, getBulkAgentVisitCounts } from '../lib/aggregates.js';
import { authMiddleware, requireSuperAdmin } from '../lib/middleware.js';
import { canSeeMoney } from '../lib/capabilities.js';
import { getScale } from './field-ops/config.js';

const app = new Hono();

// ==================== AGENT MY-COMPANIES (lightweight) ====================
app.get('/api/agent/my-companies', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const role = c.get('role');
    let companies = { results: [] };
    if (role === 'manager') {
      companies = await db.prepare("SELECT fc.id, fc.name, fc.code, fc.revisit_radius_meters FROM manager_company_links mcl JOIN field_companies fc ON mcl.company_id = fc.id WHERE mcl.manager_id = ? AND mcl.tenant_id = ? AND mcl.is_active = 1 AND fc.status = 'active'").bind(userId, tenantId).all();
    } else if (role === 'team_lead') {
      // Team leads: check agent_company_links first, then fall back to companies they manage via team members
      companies = await db.prepare("SELECT fc.id, fc.name, fc.code, fc.revisit_radius_meters FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active'").bind(userId, tenantId).all();
      if (!companies.results || companies.results.length === 0) {
        // Fallback: get companies from team members under this team lead
        companies = await db.prepare("SELECT DISTINCT fc.id, fc.name, fc.code, fc.revisit_radius_meters FROM users u JOIN agent_company_links acl ON acl.agent_id = u.id JOIN field_companies fc ON acl.company_id = fc.id WHERE u.team_lead_id = ? AND u.tenant_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active'").bind(userId, tenantId, tenantId).all();
      }
    } else if (role === 'admin' || role === 'super_admin') {
      // Admins: return all active companies so they can test mobile views
      companies = await db.prepare("SELECT fc.id, fc.name, fc.code, fc.revisit_radius_meters FROM field_companies fc WHERE fc.tenant_id = ? AND fc.status = 'active'").bind(tenantId).all();
    } else {
      companies = await db.prepare("SELECT fc.id, fc.name, fc.code, fc.revisit_radius_meters FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active'").bind(userId, tenantId).all();
    }
    // Enrich companies with process flow types in a single batch query (avoids N+1)
    const companyIds = (companies.results || []).map(c => c.id);
    let cpfMap = {};
    if (companyIds.length > 0) {
      const allCpfs = await db.prepare(
        "SELECT company_id, GROUP_CONCAT(visit_target_type) as types FROM company_process_flows WHERE tenant_id = ? GROUP BY company_id"
      ).bind(tenantId).all();
      cpfMap = Object.fromEntries((allCpfs.results || []).map(r => [r.company_id, r.types ? r.types.split(',') : []]));
    }
    const enriched = (companies.results || []).map(comp => ({ ...comp, process_flow_types: cpfMap[comp.id] || [] }));
    return c.json({ success: true, data: enriched });
  } catch (err) {
    return c.json({ success: false, data: [], error: err.message || 'Failed to fetch companies' }, 500);
  }
});

// ==================== AGENT STORE SEARCH (Mobile) ====================
app.get('/api/agent/store-search', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const { search, company_id, limit = 200 } = c.req.query();
    const parsed = parseInt(limit); const limitNum = Math.min((Number.isFinite(parsed) && parsed > 0) ? parsed : 200, 500);

    // Get stores from customers table + stores this agent has visited before
    let where = 'WHERE c.tenant_id = ?';
    const params = [tenantId];

    if (company_id) {
      // Filter by stores visited for this company. (customers has no company_id
      // column in prod — the old `OR c.company_id = ?` 500'd this route.)
      where += ' AND c.id IN (SELECT DISTINCT customer_id FROM visits WHERE tenant_id = ? AND company_id = ? AND customer_id IS NOT NULL)';
      params.push(tenantId, company_id);
    }

    if (search) {
      where += ' AND (c.name LIKE ? OR c.code LIKE ? OR c.contact_person LIKE ? OR c.address LIKE ?)';
      params.push('%' + search + '%', '%' + search + '%', '%' + search + '%', '%' + search + '%');
    }

    // Derived table over this agent's visits (one index pass) instead of
    // LEFT JOIN + GROUP BY over every customer×visit pair — was 97% of all D1 reads.
    const customers = await db.prepare(
      `SELECT c.id, c.name, c.code, c.contact_person, c.contact_phone, c.address, c.latitude, c.longitude, c.customer_type,
        lv.last_visit_date
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, MAX(visit_date) AS last_visit_date
        FROM visits WHERE tenant_id = ? AND agent_id = ? AND customer_id IS NOT NULL
        GROUP BY customer_id
      ) lv ON lv.customer_id = c.id
      ${where}
      ORDER BY lv.last_visit_date DESC NULLS LAST, c.name LIMIT ?`
    ).bind(tenantId, userId, ...params, limitNum).all();

    return c.json({ success: true, data: customers.results || [] });
  } catch (err) {
    console.error('Store search error:', err);
    return c.json({ success: false, data: [], error: err.message || 'Store search failed' }, 500);
  }
});

// ==================== AGENT MOBILE DASHBOARD ====================
app.get('/api/agent/dashboard', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    // Support month query parameter for historical navigation (format: YYYY-MM)
    const requestedMonth = c.req.query('month');
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = requestedMonth || today.substring(0, 7);
    const monthStart = currentMonth + '-01';
    // Compute end of month (first day of next month) for upper-bound filtering
    const [mY, mM] = currentMonth.split('-').map(Number);
    const nextMonth = mM === 12 ? `${mY + 1}-01-01` : `${mY}-${String(mM + 1).padStart(2, '0')}-01`;
    // For "today" counts, only use actual today if viewing current month
    const todayForCounts = (!requestedMonth || requestedMonth === today.substring(0, 7)) ? today : monthStart;

    // Batch 1: Fire all independent queries in parallel
    const userRole = c.get('role');
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    // Prior month date range
    const priorMonthDate = new Date(mY, mM - 2, 1);
    const priorMonthStart = priorMonthDate.getFullYear() + '-' + String(priorMonthDate.getMonth() + 1).padStart(2, '0') + '-01';

    const companySql = userRole === 'manager'
      ? "SELECT fc.id, fc.name, fc.code FROM manager_company_links mcl JOIN field_companies fc ON mcl.company_id = fc.id WHERE mcl.manager_id = ? AND mcl.tenant_id = ? AND mcl.is_active = 1 AND fc.status = 'active'"
      : "SELECT fc.id, fc.name, fc.code FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active'";
    // Use role-specific rules: agents get 'agent' rules, team_leads get 'team_lead' rules, managers get 'manager' rules
    const dashRoleType = userRole === 'manager' ? 'manager' : userRole === 'team_lead' ? 'team_lead' : 'agent';

    // Role-aware: resolve which agent IDs to count visits for
    // Managers see all agents under their team leads; team leads see their team members; agents see only themselves
    let dashAgentIds = [userId];
    if (userRole === 'manager' || userRole === 'admin' || userRole === 'super_admin') {
      const isAdminDash = ['admin', 'super_admin'].includes(userRole);
      const tlQuery = isAdminDash
        ? "SELECT id FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1"
        : "SELECT id FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND manager_id = ?";
      const tlBinds = isAdminDash ? [tenantId] : [tenantId, userId];
      const dashTls = await db.prepare(tlQuery).bind(...tlBinds).all().catch(() => ({ results: [] }));
      const dashTlIds = (dashTls.results || []).map(t => t.id);
      if (dashTlIds.length > 0) {
        const tlPh = dashTlIds.map(() => '?').join(',');
        const dashAgents = await db.prepare(`SELECT id FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent', 'sales_rep') AND is_active = 1 AND team_lead_id IN (${tlPh})`).bind(tenantId, ...dashTlIds).all().catch(() => ({ results: [] }));
        dashAgentIds = (dashAgents.results || []).map(a => a.id);
      }
      if (isAdminDash) {
        const unassigned = await db.prepare("SELECT id FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent', 'sales_rep') AND is_active = 1 AND team_lead_id IS NULL").bind(tenantId).all().catch(() => ({ results: [] }));
        dashAgentIds = [...dashAgentIds, ...(unassigned.results || []).map(a => a.id)];
      }
      if (dashAgentIds.length === 0) dashAgentIds = [userId];
    } else if (userRole === 'team_lead') {
      const dashTeamMembers = await db.prepare("SELECT id FROM users WHERE tenant_id = ? AND team_lead_id = ? AND is_active = 1").bind(tenantId, userId).all().catch(() => ({ results: [] }));
      // Include the team lead's own userId so their personal visits are counted in dashboard stats
      dashAgentIds = [userId, ...(dashTeamMembers.results || []).map(a => a.id)];
    }
    const dashAgentPh = dashAgentIds.map(() => '?').join(',');
    const dashAgentFilter = dashAgentIds.length === 1 ? 'agent_id = ?' : `agent_id IN (${dashAgentPh})`;

    // Optimized: Combine COUNT queries into single query with conditional aggregates (reduces 8 queries to 1)
    const countsQuery = `
      SELECT
        (SELECT COUNT(*) FROM visits WHERE tenant_id = ? AND ${dashAgentFilter} AND visit_date = ?) as today_visits,
        (SELECT COUNT(*) FROM visits WHERE tenant_id = ? AND ${dashAgentFilter} AND visit_date >= ? AND visit_date < ?) as month_visits,
        (SELECT COUNT(*) FROM visits WHERE tenant_id = ? AND ${dashAgentFilter} AND LOWER(visit_type) = 'store' AND visit_date = ?) as today_regs,
        (SELECT COUNT(*) FROM visits WHERE tenant_id = ? AND ${dashAgentFilter} AND LOWER(visit_type) = 'store' AND visit_date >= ? AND visit_date < ?) as month_regs,
        (SELECT COUNT(*) FROM visits WHERE tenant_id = ? AND ${dashAgentFilter} AND visit_date >= ?) as week_visits,
        (SELECT COUNT(*) FROM visits WHERE tenant_id = ? AND ${dashAgentFilter} AND LOWER(visit_type) = 'store' AND visit_date >= ?) as week_regs,
        (SELECT COUNT(*) FROM visits WHERE tenant_id = ? AND ${dashAgentFilter} AND visit_date >= ? AND visit_date < ?) as prior_month_visits,
        (SELECT COUNT(*) FROM visits WHERE tenant_id = ? AND ${dashAgentFilter} AND LOWER(visit_type) != 'store' AND visit_date >= ? AND visit_date < ?) as prior_month_individual,
        (SELECT COUNT(*) FROM visits WHERE tenant_id = ? AND ${dashAgentFilter} AND LOWER(visit_type) = 'store' AND visit_date >= ? AND visit_date < ?) as prior_month_store
    `;
    const countsResult = await db.prepare(countsQuery).bind(
      tenantId, ...dashAgentIds, todayForCounts,
      tenantId, ...dashAgentIds, monthStart, nextMonth,
      tenantId, ...dashAgentIds, todayForCounts,
      tenantId, ...dashAgentIds, monthStart, nextMonth,
      tenantId, ...dashAgentIds, weekStartStr,
      tenantId, ...dashAgentIds, weekStartStr,
      tenantId, ...dashAgentIds, priorMonthStart, monthStart,
      tenantId, ...dashAgentIds, priorMonthStart, monthStart,
      tenantId, ...dashAgentIds, priorMonthStart, monthStart
    ).first().catch(() => ({
      today_visits: 0, month_visits: 0, today_regs: 0, month_regs: 0, week_visits: 0, week_regs: 0, prior_month_visits: 0, prior_month_individual: 0, prior_month_store: 0
    }));

    // Batch: Fire remaining independent queries in parallel (reduced from 11 to 7)
    const [recentVisits, companies, targets, visitBreakdown, weekVisitsByCompany] = await Promise.all([
      db.prepare(`SELECT v.id, v.visit_date, v.visit_type, v.status, v.check_in_time, c.name as customer_name, v.individual_name, (SELECT vp.r2_url FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.r2_url IS NOT NULL LIMIT 1) as thumbnail_url FROM visits v LEFT JOIN customers c ON v.customer_id = c.id WHERE v.tenant_id = ? AND v.${dashAgentFilter} ORDER BY v.created_at DESC LIMIT 10`).bind(tenantId, ...dashAgentIds).all().catch((e) => { console.error('mobileDashboards batch query failed:', e.message); return { results: [] }; }),
      db.prepare(companySql).bind(userId, tenantId).all().catch((e) => { console.error('mobileDashboards batch query failed:', e.message); return { results: [] }; }),
      db.prepare(`SELECT dt.*, fc.name as company_name, (SELECT COUNT(*) FROM visits v2 WHERE v2.agent_id = dt.agent_id AND v2.company_id = dt.company_id AND v2.visit_date = dt.target_date AND v2.tenant_id = dt.tenant_id) as actual_visits, (SELECT COUNT(*) FROM visits v3 WHERE v3.agent_id = dt.agent_id AND v3.company_id = dt.company_id AND v3.visit_date = dt.target_date AND v3.tenant_id = dt.tenant_id AND LOWER(v3.visit_type) = 'store') as actual_registrations FROM daily_targets dt LEFT JOIN field_companies fc ON dt.company_id = fc.id WHERE dt.tenant_id = ? AND dt.${dashAgentFilter} AND dt.target_date = ?`).bind(tenantId, ...dashAgentIds, today).all().catch((e) => { console.error('mobileDashboards batch query failed:', e.message); return { results: [] }; }),
      db.prepare(`SELECT COALESCE(v.company_id, 'unassigned') as company_id, COALESCE(fc.name, 'Unassigned') as company_name, COALESCE(v.visit_type, 'unknown') as visit_type, COUNT(*) as count, SUM(CASE WHEN v.visit_date = ? THEN 1 ELSE 0 END) as today_count, SUM(CASE WHEN v.visit_date >= ? AND v.visit_date < ? THEN 1 ELSE 0 END) as month_count FROM visits v LEFT JOIN field_companies fc ON v.company_id = fc.id WHERE v.tenant_id = ? AND v.${dashAgentFilter} AND v.visit_date >= ? AND v.visit_date < ? GROUP BY v.company_id, v.visit_type ORDER BY fc.name, v.visit_type`).bind(todayForCounts, monthStart, nextMonth, tenantId, ...dashAgentIds, monthStart, nextMonth).all().catch((e) => { console.error('mobileDashboards batch query failed:', e.message); return { results: [] }; }),
      db.prepare(`SELECT company_id, visit_type, COUNT(*) as count FROM visits WHERE tenant_id = ? AND ${dashAgentFilter} AND visit_date >= ? GROUP BY company_id, visit_type`).bind(tenantId, ...dashAgentIds, weekStartStr).all().catch((e) => { console.error('mobileDashboards batch query failed:', e.message); return { results: [] }; }),
    ]);
    
    // Extract counts from optimized query
    const todayVisits = { count: countsResult.today_visits || 0 };
    const monthVisits = { count: countsResult.month_visits || 0 };
    const todayRegs = { count: countsResult.today_regs || 0 };
    const monthRegs = { count: countsResult.month_regs || 0 };
    const weekVisits = { count: countsResult.week_visits || 0 };
    const weekRegs = { count: countsResult.week_regs || 0 };

    // Build per-company visit/reg actuals lookup from visit_breakdown
    const perCompanyActuals = {};
    for (const item of (visitBreakdown.results || [])) {
      const cid = item.company_id || 'unassigned';
      if (!perCompanyActuals[cid]) {
        perCompanyActuals[cid] = { today_visits: 0, month_visits: 0, today_regs: 0, month_regs: 0, today_store_visits: 0, month_store_visits: 0, today_individual_visits: 0, month_individual_visits: 0 };
      }
      const vt = (item.visit_type || '').toLowerCase();
      perCompanyActuals[cid].today_visits += item.today_count || 0;
      perCompanyActuals[cid].month_visits += item.month_count || 0;
      if (vt === 'store') {
        perCompanyActuals[cid].today_store_visits += item.today_count || 0;
        perCompanyActuals[cid].month_store_visits += item.month_count || 0;
      } else {
        // All non-store visits (individual, customer, etc.) count as individual — matches team-lead counting logic
        perCompanyActuals[cid].today_individual_visits += item.today_count || 0;
        perCompanyActuals[cid].month_individual_visits += item.month_count || 0;
      }
    }

    // Batch 2: Fetch company target rules + per-company regs (depends on companies result)
    let companyTargetRules = [];
    const perCompanyRegsLookup = {};
    let ownRoleStoreTargetByCompany = {};
    const agentCompanyIds = (companies.results || []).map(co => co.id);
    if (agentCompanyIds.length > 0) {
      const ph = agentCompanyIds.map(() => '?').join(',');
      // For team leads/managers with multiple agents, fetch 'agent' rules for individual targets (scaled by agent count)
      // Also fetch role-specific rules separately for team lead's own store target
      const fetchRoleType = dashAgentIds.length > 1 ? 'agent' : dashRoleType;
      const [ctrResult, perCompanyRegsTodayAll, ownRoleRulesResult] = await Promise.all([
        cachedD1Query(`ctr:${tenantId}:${agentCompanyIds.join(',')}:${fetchRoleType}`, 300, () =>
          db.prepare(`SELECT ctr.*, fc.name as company_name FROM company_target_rules ctr JOIN field_companies fc ON ctr.company_id = fc.id WHERE ctr.tenant_id = ? AND ctr.company_id IN (${ph}) AND ctr.role_type = ?`).bind(tenantId, ...agentCompanyIds, fetchRoleType).all().catch(() => ({ results: [] }))
        ),
        db.prepare(`SELECT company_id, SUM(CASE WHEN visit_date = ? THEN 1 ELSE 0 END) as today_count, COUNT(*) as month_count FROM visits WHERE tenant_id = ? AND ${dashAgentFilter} AND LOWER(visit_type) = 'store' AND company_id IN (${ph}) AND visit_date >= ? AND visit_date < ? GROUP BY company_id`).bind(today, tenantId, ...dashAgentIds, ...agentCompanyIds, monthStart, nextMonth).all().catch(() => ({ results: [] })),
        // Fetch role-specific rules (team_lead or manager) for own store targets when viewing aggregate
        (fetchRoleType !== dashRoleType)
          ? db.prepare(`SELECT ctr.*, fc.name as company_name FROM company_target_rules ctr JOIN field_companies fc ON ctr.company_id = fc.id WHERE ctr.tenant_id = ? AND ctr.company_id IN (${ph}) AND ctr.role_type = ?`).bind(tenantId, ...agentCompanyIds, dashRoleType).all().catch(() => ({ results: [] }))
          : Promise.resolve({ results: [] }),
      ]);
      companyTargetRules = ctrResult.results || [];
      // Fallback: get any rules if no role-specific ones found
      if (companyTargetRules.length === 0) {
        const fallbackResult = await db.prepare(`SELECT ctr.*, fc.name as company_name FROM company_target_rules ctr JOIN field_companies fc ON ctr.company_id = fc.id WHERE ctr.tenant_id = ? AND ctr.company_id IN (${ph})`).bind(tenantId, ...agentCompanyIds).all().catch(() => ({ results: [] }));
        companyTargetRules = fallbackResult.results || [];
      }
      // Build lookup of role-specific store targets (team_lead's own store target, manager's own target)
      const ownRoleRules = (ownRoleRulesResult.results || []);
      ownRoleStoreTargetByCompany = {};
      for (const rule of ownRoleRules) {
        ownRoleStoreTargetByCompany[rule.company_id] = {
          store_target_per_day: (rule.store_target_per_day != null ? rule.store_target_per_day : rule.target_registrations_per_day) || 0,
          store_target_per_month: rule.store_target_per_month || 0,
        };
      }
      for (const r of (perCompanyRegsTodayAll.results || [])) {
        perCompanyRegsLookup[r.company_id] = { today: r.today_count || 0, month: r.month_count || 0 };
      }
    }

    // For managers/team leads, count how many agents are assigned to each company
    // so we can scale per-agent targets to aggregate targets
    const agentsPerCompany = {};
    if ((userRole === 'manager' || userRole === 'team_lead' || userRole === 'admin' || userRole === 'super_admin') && dashAgentIds.length > 1 && agentCompanyIds.length > 0) {
      const apcPh = agentCompanyIds.map(() => '?').join(',');
      const dashPh = dashAgentIds.map(() => '?').join(',');
      const apcResult = await db.prepare(`SELECT company_id, COUNT(DISTINCT agent_id) as agent_count FROM agent_company_links WHERE tenant_id = ? AND agent_id IN (${dashPh}) AND company_id IN (${apcPh}) AND is_active = 1 GROUP BY company_id`).bind(tenantId, ...dashAgentIds, ...agentCompanyIds).all().catch(() => ({ results: [] }));
      for (const row of (apcResult.results || [])) {
        agentsPerCompany[row.company_id] = row.agent_count || 1;
      }
    }
    const getAgentMultiplier = (companyId) => {
      if (dashAgentIds.length <= 1) return 1; // Single agent, no scaling needed
      return agentsPerCompany[companyId] || 1;
    };

    // Build daily_targets from company_target_rules if no daily_targets exist - now with per-company actuals
    let dailyTargets = targets.results || [];
    if (dailyTargets.length === 0 && companyTargetRules.length > 0) {
      dailyTargets = companyTargetRules.map(ctr => {
        const ca = perCompanyActuals[ctr.company_id] || {};
        const mult = getAgentMultiplier(ctr.company_id);
        // Use new per-role fields first, fall back to legacy fields (use ?? to preserve explicit 0)
        // Scale by agent count for managers/team leads
        const indivPerDay = ((ctr.individual_target_per_day != null ? ctr.individual_target_per_day : ctr.target_visits_per_day) ?? 0) * mult;
        // For team leads/managers: use their own role-specific store target (not scaled by agents)
        const ownStore = ownRoleStoreTargetByCompany[ctr.company_id];
        const storePerDay = ownStore ? ownStore.store_target_per_day : (((ctr.store_target_per_day != null ? ctr.store_target_per_day : ctr.target_registrations_per_day) ?? 0) * mult);
        const indivPerWeek = (ctr.individual_target_per_week_agent ?? 0) * mult;
        const indivPerMonth = (ctr.individual_target_per_month_agent ?? (((ctr.individual_target_per_day != null ? ctr.individual_target_per_day : ctr.target_visits_per_day) ?? 0) * 22)) * mult;
        return {
          company_name: ctr.company_name,
          company_id: ctr.company_id,
          target_visits: indivPerDay,
          target_registrations: storePerDay,
          target_stores: storePerDay,
          target_conversions: (ctr.target_conversions_per_day || 0) * mult,
          actual_visits: ca.today_individual_visits || 0,
          actual_registrations: ca.today_store_visits || 0,
          actual_stores: ca.today_store_visits || 0,
          actual_store_visits: ca.today_store_visits || 0,
          actual_individual_visits: ca.today_individual_visits || 0,
          individual_target_per_day: indivPerDay,
          individual_target_per_week: indivPerWeek,
          individual_target_per_month: indivPerMonth,
          store_target_per_day: storePerDay,
          source: 'company_rule',
          role_type: ctr.role_type || 'agent',
        };
      });
    }

    // Compute aggregate type-filtered counts from per-company actuals
    let totalTodayIndividual = 0, totalTodayStore = 0, totalMonthIndividual = 0, totalMonthStore = 0;
    for (const cid in perCompanyActuals) {
      totalTodayIndividual += perCompanyActuals[cid].today_individual_visits || 0;
      totalTodayStore += perCompanyActuals[cid].today_store_visits || 0;
      totalMonthIndividual += perCompanyActuals[cid].month_individual_visits || 0;
      totalMonthStore += perCompanyActuals[cid].month_store_visits || 0;
    }
    // Compute week type-filtered counts from weekVisitsByCompany
    let totalWeekIndividual = 0, totalWeekStore = 0;
    for (const wv of (weekVisitsByCompany.results || [])) {
      if ((wv.visit_type || '').toLowerCase() === 'store') totalWeekStore += wv.count || 0;
      else totalWeekIndividual += wv.count || 0;
    }

    // Batch 3: Resolve working days configs for all companies in 1 query (was 4*N sequential queries)
    const ctrCompanyIds = companyTargetRules.map(ctr => ctr.company_id);
    const wdConfigMap = await resolveWorkingDaysConfigBatch(db, tenantId, ctrCompanyIds, userId);

    // Cache working days calculation per config to avoid redundant loops
    const workingDaysCache = new Map();
    const getWorkingDays = (config, month) => {
      const cacheKey = `${config.id || 'default'}_${month}`;
      if (!workingDaysCache.has(cacheKey)) {
        workingDaysCache.set(cacheKey, countWorkingDaysInMonth(config, month));
      }
      return workingDaysCache.get(cacheKey);
    };

    // Build per-company weekly/monthly targets with store/individual split using working calendar
    let weekTargetVisits = 0, weekTargetRegs = 0, monthTargetVisits = 0, monthTargetRegs = 0;
    const companyTargets = [];
    for (let i = 0; i < companyTargetRules.length; i++) {
      const ctr = companyTargetRules[i];
      const wdConfig = wdConfigMap[ctr.company_id] || DEFAULT_WD_CONFIG;
      const workingDaysPerMonth = getWorkingDays(wdConfig, currentMonth);
      const workingDaysPerWeek = ctr.working_days_per_week || 5;
      const ca = perCompanyActuals[ctr.company_id] || {};
      const cr = perCompanyRegsLookup[ctr.company_id] || {};
      // Weekly actuals for this company
      let weekStoreVisits = 0, weekIndividualVisits = 0, weekTotalVisits = 0;
      for (const wv of (weekVisitsByCompany.results || [])) {
        if (wv.company_id === ctr.company_id) {
          weekTotalVisits += wv.count || 0;
          if ((wv.visit_type || '').toLowerCase() === 'store') weekStoreVisits += wv.count || 0;
          else weekIndividualVisits += wv.count || 0;
        }
      }
      // Use new per-role fields first, fall back to legacy fields
      const perAgentDayTarget = (ctr.individual_target_per_day != null ? ctr.individual_target_per_day : ctr.target_visits_per_day) ?? 0;
      const perAgentDayRegTarget = (ctr.store_target_per_day != null ? ctr.store_target_per_day : ctr.target_registrations_per_day) ?? 0;
      // Scale per-agent targets by number of agents assigned to this company (for managers/team leads)
      const agentMult = getAgentMultiplier(ctr.company_id);
      const dayTarget = perAgentDayTarget * agentMult;
      // For team leads/managers: use their own role-specific store target (not scaled by agents)
      // Team lead's store target is their own (e.g. 4/day = 20/week), not per-agent
      const ownStoreTarget = ownRoleStoreTargetByCompany[ctr.company_id];
      const dayRegTarget = ownStoreTarget ? ownStoreTarget.store_target_per_day : (perAgentDayRegTarget * agentMult);
      weekTargetVisits += dayTarget * workingDaysPerWeek;
      weekTargetRegs += dayRegTarget * workingDaysPerWeek;
      monthTargetVisits += dayTarget * workingDaysPerMonth;
      monthTargetRegs += dayRegTarget * workingDaysPerMonth;
      companyTargets.push({
        company_id: ctr.company_id,
        company_name: ctr.company_name,
        working_days_in_month: workingDaysPerMonth,
        agent_count: agentMult,
        // Daily targets (scaled by agent count for managers/team leads)
        daily_target_visits: dayTarget,
        daily_target_registrations: dayRegTarget,
        daily_target_stores: dayRegTarget,
        daily_actual_visits: ca.today_individual_visits || 0,
        daily_actual_registrations: ca.today_store_visits || 0,
        daily_actual_stores: ca.today_store_visits || 0,
        // Store-specific targets (scaled by agent count)
        store_target_per_month: ownStoreTarget ? (ownStoreTarget.store_target_per_day * workingDaysPerMonth) : (((ctr.store_target_per_month != null ? ctr.store_target_per_month : ctr.store_target_per_month_agent) ?? 0) * agentMult),
        month_target_stores: ownStoreTarget ? (ownStoreTarget.store_target_per_day * workingDaysPerMonth) : (((ctr.store_target_per_month != null ? ctr.store_target_per_month : ctr.store_target_per_month_agent) ?? 0) * agentMult),
        store_actual_month: ca.month_store_visits || 0,
        store_actual_today: ca.today_store_visits || 0,
        store_actual_week: weekStoreVisits,
        // Individual-specific targets (scaled by agent count)
        individual_target_per_week: (ctr.individual_target_per_week_agent ?? 0) * agentMult,
        individual_target_per_month: ((ctr.individual_target_per_month != null ? ctr.individual_target_per_month : ctr.individual_target_per_month_agent) ?? 0) * agentMult,
        individual_actual_month: ca.month_individual_visits || 0,
        individual_actual_today: ca.today_individual_visits || 0,
        individual_actual_week: weekIndividualVisits,
        // Weekly totals
        week_target_visits: dayTarget * workingDaysPerWeek,
        week_actual_visits: weekTotalVisits,
        week_target_registrations: dayRegTarget * workingDaysPerWeek,
        // Monthly totals
        month_target_visits: dayTarget * workingDaysPerMonth,
        month_actual_visits: ca.month_visits || 0,
        month_target_registrations: dayRegTarget * workingDaysPerMonth,
        month_actual_registrations: cr.month || 0,
      });
    }

    return c.json({
      success: true,
      data: {
        today_visits: todayVisits?.count || 0,
        month_visits: monthVisits?.count || 0,
        week_visits: weekVisits?.count || 0,
        today_stores: todayRegs?.count || 0,
        month_stores: monthRegs?.count || 0,
        week_stores: weekRegs?.count || 0,
        // Type-filtered counts for Individual vs Store split
        today_individual_visits: totalTodayIndividual,
        today_store_visits: totalTodayStore,
        month_individual_visits: totalMonthIndividual,
        month_store_visits: totalMonthStore,
        week_individual_visits: totalWeekIndividual,
        week_store_visits: totalWeekStore,
        prior_month_visits: countsResult.prior_month_visits || 0,
        prior_month_individual_visits: countsResult.prior_month_individual || 0,
        prior_month_store_visits: countsResult.prior_month_store || 0,
        recent_visits: recentVisits.results || [],
        companies: companies.results || [],
        daily_targets: dailyTargets,
        company_target_rules: companyTargetRules,
        company_targets: companyTargets,
        weekly_targets: { target_visits: weekTargetVisits, actual_visits: totalWeekIndividual, actual_visits_all: weekVisits?.count || 0, target_registrations: weekTargetRegs, target_stores: weekTargetRegs, actual_registrations: totalWeekStore, actual_stores: totalWeekStore, actual_registrations_all: weekRegs?.count || 0 },
        monthly_targets: { target_visits: monthTargetVisits, actual_visits: totalMonthIndividual, actual_visits_all: monthVisits?.count || 0, target_registrations: monthTargetRegs, target_stores: monthTargetRegs, actual_registrations: totalMonthStore, actual_stores: totalMonthStore, actual_registrations_all: monthRegs?.count || 0 },
        visit_breakdown: visitBreakdown.results || [],
      }
    });
  } catch (error) {
    console.error('Agent dashboard error:', error);
    return c.json({ success: true, data: { today_visits: 0, month_visits: 0, week_visits: 0, today_stores: 0, month_stores: 0, week_stores: 0, recent_visits: [], companies: [], daily_targets: [], company_target_rules: [], company_targets: [], weekly_targets: { target_visits: 0, actual_visits: 0, target_registrations: 0, actual_registrations: 0 }, monthly_targets: { target_visits: 0, actual_visits: 0, target_registrations: 0, actual_registrations: 0 }, visit_breakdown: [] } });
  }
});

// ==================== AGENT PERFORMANCE ====================
app.get('/api/agent/performance', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    // Support month query parameter for historical navigation (format: YYYY-MM)
    const perfRequestedMonth = c.req.query('month');
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = perfRequestedMonth || today.substring(0, 7);

    // Perf optimization: include agentUser + agent companies in main batch to avoid sequential round trips
    const perfUserRole = c.get('role');
    const perfRoleType = perfUserRole === 'manager' ? 'manager' : perfUserRole === 'team_lead' ? 'team_lead' : 'agent';

    // Role-aware: resolve which agent IDs to count visits for (same logic as /agent/dashboard)
    let perfAgentIdsForCounts = [userId];
    if (perfUserRole === 'manager' || perfUserRole === 'admin' || perfUserRole === 'super_admin') {
      const isPerfAdmin = ['admin', 'super_admin'].includes(perfUserRole);
      const perfTlQuery = isPerfAdmin
        ? "SELECT id FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1"
        : "SELECT id FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND manager_id = ?";
      const perfTlBinds = isPerfAdmin ? [tenantId] : [tenantId, userId];
      const perfTls = await db.prepare(perfTlQuery).bind(...perfTlBinds).all().catch(() => ({ results: [] }));
      const perfTlIds = (perfTls.results || []).map(t => t.id);
      if (perfTlIds.length > 0) {
        const perfTlPh = perfTlIds.map(() => '?').join(',');
        const perfAgentsResult = await db.prepare(`SELECT id FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent', 'sales_rep') AND is_active = 1 AND team_lead_id IN (${perfTlPh})`).bind(tenantId, ...perfTlIds).all().catch(() => ({ results: [] }));
        perfAgentIdsForCounts = (perfAgentsResult.results || []).map(a => a.id);
      }
      if (isPerfAdmin) {
        const perfUnassigned = await db.prepare("SELECT id FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent', 'sales_rep') AND is_active = 1 AND team_lead_id IS NULL").bind(tenantId).all().catch(() => ({ results: [] }));
        perfAgentIdsForCounts = [...perfAgentIdsForCounts, ...(perfUnassigned.results || []).map(a => a.id)];
      }
      if (perfAgentIdsForCounts.length === 0) perfAgentIdsForCounts = [userId];
    } else if (perfUserRole === 'team_lead') {
      const perfTeamMembers = await db.prepare("SELECT id FROM users WHERE tenant_id = ? AND team_lead_id = ? AND is_active = 1").bind(tenantId, userId).all().catch(() => ({ results: [] }));
      // Include the team lead's own userId so their personal visits are counted in performance stats
      perfAgentIdsForCounts = [userId, ...(perfTeamMembers.results || []).map(a => a.id)];
    }
    const perfAgentPh = perfAgentIdsForCounts.map(() => '?').join(',');
    const perfAgentFilter = perfAgentIdsForCounts.length === 1 ? 'agent_id = ?' : `agent_id IN (${perfAgentPh})`;

    const [
      agentUser,
      monthlyTargets,
      pendingCommissions,
      approvedCommissions,
      paidCommissions,
      recentEarnings,
      weeklyVisits,
      weeklyIndividualVisits,
      streakData,
      perfAgentCompanies,
    ] = await Promise.all([
      db.prepare("SELECT team_lead_id FROM users WHERE id = ? AND tenant_id = ?").bind(userId, tenantId).first().catch(() => null),
      db.prepare(`SELECT mt.*, fc.name as company_name FROM monthly_targets mt LEFT JOIN field_companies fc ON mt.company_id = fc.id WHERE mt.tenant_id = ? AND mt.${perfAgentFilter} AND mt.target_month = ? ORDER BY fc.name`).bind(tenantId, ...perfAgentIdsForCounts, currentMonth).all(),
      db.prepare("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM commission_earnings WHERE tenant_id = ? AND earner_id = ? AND status = 'pending'").bind(tenantId, userId).first(),
      db.prepare("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM commission_earnings WHERE tenant_id = ? AND earner_id = ? AND status = 'approved'").bind(tenantId, userId).first(),
      db.prepare("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM commission_earnings WHERE tenant_id = ? AND earner_id = ? AND status = 'paid'").bind(tenantId, userId).first(),
      db.prepare("SELECT ce.id, ce.amount, ce.status, ce.source_type, ce.created_at, cr.name as rule_name FROM commission_earnings ce LEFT JOIN commission_rules cr ON ce.rule_id = cr.id WHERE ce.tenant_id = ? AND ce.earner_id = ? ORDER BY ce.created_at DESC LIMIT 10").bind(tenantId, userId).all(),
      db.prepare(`SELECT visit_date, COUNT(*) as count FROM visits WHERE tenant_id = ? AND ${perfAgentFilter} AND visit_date >= date(?, '-6 days') GROUP BY visit_date ORDER BY visit_date`).bind(tenantId, ...perfAgentIdsForCounts, today).all(),
      // Weekly store visits (visits with visit_type='store')
      db.prepare(`SELECT visit_date, COUNT(*) as count FROM visits WHERE tenant_id = ? AND ${perfAgentFilter} AND LOWER(visit_type) = 'store' AND visit_date >= date(?, '-6 days') GROUP BY visit_date ORDER BY visit_date`).bind(tenantId, ...perfAgentIdsForCounts, today).all(),
      db.prepare(`SELECT DISTINCT visit_date FROM visits WHERE tenant_id = ? AND ${perfAgentFilter} AND visit_date <= ? AND strftime('%w', visit_date) NOT IN ('0', '6') ORDER BY visit_date DESC LIMIT 30`).bind(tenantId, ...perfAgentIdsForCounts, today).all(),
      // Pre-fetch agent companies for dailyIndividualTarget (avoid duplicate query later)
      db.prepare("SELECT fc.id FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active'").bind(userId, tenantId).all().catch(() => ({ results: [] })),
    ]);
    const teamLeadId = agentUser?.team_lead_id || null;

    // Fetch team performance if agent belongs to a team
    let teamPerformance = null;
    let managerPerformance = null;
    const perfMonthStart = currentMonth + '-01';
    const [pY, pM] = currentMonth.split('-').map(Number);
    const perfNextMonth = pM === 12 ? `${pY + 1}-01-01` : `${pY}-${String(pM + 1).padStart(2, '0')}-01`;
    if (teamLeadId) {
      const [teamMembers, teamVisits, teamRegs, teamLeadInfo] = await Promise.all([
        db.prepare("SELECT id, first_name, last_name FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1").bind(teamLeadId, tenantId).all(),
        db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id IN (SELECT id FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1) AND visit_date >= ? AND visit_date < ?").bind(tenantId, teamLeadId, tenantId, perfMonthStart, perfNextMonth).all(),
        db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) = 'store' AND agent_id IN (SELECT id FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1) AND visit_date >= ? AND visit_date < ?").bind(tenantId, teamLeadId, tenantId, perfMonthStart, perfNextMonth).all(),
        db.prepare("SELECT id, first_name, last_name, manager_id FROM users WHERE id = ? AND tenant_id = ?").bind(teamLeadId, tenantId).first(),
      ]);
      const memberCount = teamMembers?.results?.length || 0;
      const totalTeamVisits = teamVisits?.results?.[0]?.count || 0;
      const totalTeamRegs = teamRegs?.results?.[0]?.count || 0;
      // Sum team monthly targets (agents + team lead's own targets) - use live counts
      const [agentTargets, tlOwnTargets] = await Promise.all([
        db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id IN (SELECT id FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1) AND target_month = ?").bind(tenantId, teamLeadId, tenantId, currentMonth).first(),
        db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, teamLeadId, currentMonth).first(),
      ]);
      let teamTargetVisits = (agentTargets?.target_visits || 0) + (tlOwnTargets?.target_visits || 0);
      let teamTargetRegs = (agentTargets?.target_registrations || 0) + (tlOwnTargets?.target_registrations || 0);
      // Fall back to company_target_rules if monthly_targets are empty
      if (teamTargetVisits === 0 && teamTargetRegs === 0) {
        const teamMemberIds = (teamMembers?.results || []).map(m => m.id);
        const allTeamUserIds = [teamLeadId, ...teamMemberIds];
        for (const uid of allTeamUserIds) {
          const fb = await getUserMonthlyTargetFromRules(db, tenantId, uid, currentMonth, 'agent');
          teamTargetVisits += fb.target_visits;
          teamTargetRegs += fb.target_registrations;
        }
      }
      const teamActualVisits = totalTeamVisits; // use live COUNT from visits table
      const teamActualRegs = totalTeamRegs; // use live COUNT from visits table (store type)
      const teamAchievement = teamTargetVisits > 0 ? Math.round((teamActualVisits / teamTargetVisits) * 100) : 0;
      teamPerformance = {
        team_lead_name: teamLeadInfo ? (teamLeadInfo.first_name + ' ' + teamLeadInfo.last_name) : 'Team Lead',
        member_count: memberCount,
        total_visits: totalTeamVisits,
        total_individuals: totalTeamRegs,
        target_visits: teamTargetVisits,
        actual_visits: teamActualVisits,
        target_registrations: teamTargetRegs,
        actual_registrations: teamActualRegs,
        achievement: teamAchievement,
      };

      // Fetch manager performance (team lead's manager)
      const managerId = teamLeadInfo?.manager_id || null;
      if (managerId) {
        const managerInfo = await db.prepare("SELECT first_name, last_name FROM users WHERE id = ? AND tenant_id = ?").bind(managerId, tenantId).first();
        // Get all team leads under this manager
        const mgrTeamLeads = await db.prepare("SELECT id FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND manager_id = ?").bind(tenantId, managerId).all();
        const mgrTlIds = (mgrTeamLeads.results || []).map(tl => tl.id);
        let mgrTargetVisits = 0, mgrActualVisits = 0;
        if (mgrTlIds.length > 0) {
          const mgrTlPh = mgrTlIds.map(() => '?').join(',');
          const [perfMgrAgentIds, perfMgrDirectAgents] = await Promise.all([
            db.prepare(`SELECT id FROM users WHERE tenant_id = ? AND team_lead_id IN (${mgrTlPh}) AND is_active = 1`).bind(tenantId, ...mgrTlIds).all(),
            db.prepare(`SELECT id FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent', 'sales_rep') AND is_active = 1 AND manager_id = ? AND team_lead_id IS NULL`).bind(tenantId, managerId).all(),
          ]);
          const perfAllMgrUserIds = [...mgrTlIds, ...(perfMgrAgentIds.results || []).map(a => a.id), ...(perfMgrDirectAgents.results || []).map(a => a.id)];
          if (perfAllMgrUserIds.length > 0) {
            const perfAllPh = perfAllMgrUserIds.map(() => '?').join(',');
            const [perfMgrTargets, perfMgrLiveVisits] = await Promise.all([
              db.prepare(`SELECT COALESCE(SUM(target_visits),0) as tv FROM monthly_targets WHERE tenant_id = ? AND agent_id IN (${perfAllPh}) AND target_month = ?`).bind(tenantId, ...perfAllMgrUserIds, currentMonth).first(),
              db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id IN (${perfAllPh}) AND visit_date >= ? AND visit_date < ?`).bind(tenantId, ...perfAllMgrUserIds, perfMonthStart, perfNextMonth).first(),
            ]);
            mgrTargetVisits = perfMgrTargets?.tv || 0;
            mgrActualVisits = perfMgrLiveVisits?.count || 0;

            // Fallback: if monthly_targets yields 0 targets, use company_target_rules
            if (mgrTargetVisits === 0) {
              const ruleTotals = await computeTargetTotalsFromRules(db, tenantId, perfAllMgrUserIds, perfMonthStart);
              mgrTargetVisits = ruleTotals.totalTargetVisits;
              mgrActualVisits = ruleTotals.totalActualVisits;
            }
          }
          // Fall back to company_target_rules if monthly_targets are empty for manager scope
          if (mgrTargetVisits === 0) {
            for (const uid of perfAllMgrUserIds) {
              const fb = await getUserMonthlyTargetFromRules(db, tenantId, uid, currentMonth, 'agent');
              mgrTargetVisits += fb.target_visits;
            }
          }
        }
        managerPerformance = {
          manager_name: managerInfo ? (managerInfo.first_name + ' ' + managerInfo.last_name) : 'Manager',
          achievement: mgrTargetVisits > 0 ? Math.round((mgrActualVisits / mgrTargetVisits) * 100) : 0,
        };
      }
    }

    // Calculate current streak
    let streak = 0;
    const streakDates = (streakData.results || []).map(r => r.visit_date);
    if (streakDates.length > 0) {
      const d = new Date(today);
      // Skip weekends for initial date to match the weekday-only streak query
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
      // If no visit today yet, start checking from the previous weekday
      if (streakDates[0] !== d.toISOString().split('T')[0]) {
        d.setDate(d.getDate() - 1);
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
      }
      for (let i = 0; i < streakDates.length; i++) {
        const expected = d.toISOString().split('T')[0];
        if (streakDates[i] === expected) {
          streak++;
          d.setDate(d.getDate() - 1);
          // Skip weekends
          while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Fall back to company_target_rules when monthly_targets is empty
    let targets = monthlyTargets.results || [];
    if (targets.length === 0) {
      // Get agent's assigned companies
      // For managers/team leads, aggregate targets across all agents
      let mergedFallbackTargets = [];
      for (const aid of perfAgentIdsForCounts) {
        const aCo = await db.prepare("SELECT fc.id FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active'").bind(aid, tenantId).all().catch(() => ({ results: [] }));
        const aidCoIds = (aCo.results || []).map(co => co.id);
        const aidTargets = await buildFallbackMonthlyTargets(db, tenantId, aid, currentMonth, aidCoIds, 'agent');
        mergedFallbackTargets = [...mergedFallbackTargets, ...aidTargets];
      }
      const agentCompanyIds = [];
      targets = mergedFallbackTargets;
    }
    // Enrich monthly targets with live visit/reg counts (actual_visits in DB may be stale)
    const monthStartDate = currentMonth + '-01';

    // Fallback: if monthly_targets is empty, generate from company_target_rules
    if (targets.length === 0) {
      // For managers/team leads, generate targets from rules for each agent
      let genTargets = [];
      for (const aid of perfAgentIdsForCounts) {
        const aidTargets = await generateTargetsFromRules(db, tenantId, aid, monthStartDate, 'agent');
        genTargets = [...genTargets, ...aidTargets];
      }
      targets = genTargets;
    } else {
      // Enrich all targets in parallel instead of sequentially
      await Promise.all(targets.map(async (t) => {
        const companyFilter = t.company_id ? ' AND company_id = ?' : '';
        const companyBinds = t.company_id ? [t.company_id] : [];
        // Use the specific target's agent_id (not all agents) to avoid double-counting
        const rowAgentId = t.agent_id || userId;
        try {
          const [liveVisits, liveRegs, liveConvs, typeBreakdown] = await Promise.all([
            db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date >= ? AND visit_date < ?" + companyFilter).bind(rowAgentId, tenantId, monthStartDate, perfNextMonth, ...companyBinds).first().catch(() => ({ count: 0 })),
            db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND LOWER(visit_type) = 'store' AND visit_date >= ? AND visit_date < ?" + companyFilter).bind(rowAgentId, tenantId, monthStartDate, perfNextMonth, ...companyBinds).first().catch(() => ({ count: 0 })),
            db.prepare("SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.agent_id = ? AND v.tenant_id = ? AND ((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') AND v.visit_date >= ? AND v.visit_date < ?" + (companyFilter ? " AND v.company_id = ?" : "")).bind(rowAgentId, tenantId, monthStartDate, perfNextMonth, ...companyBinds).first().catch(() => ({ count: 0 })),
            db.prepare("SELECT visit_type, COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date >= ? AND visit_date < ?" + companyFilter + " GROUP BY visit_type").bind(rowAgentId, tenantId, monthStartDate, perfNextMonth, ...companyBinds).all().catch(() => ({ results: [] })),
          ]);
          let storeVisits = 0, individualVisits = 0;
          for (const row of (typeBreakdown.results || [])) {
            if ((row.visit_type || '').toLowerCase() === 'store') storeVisits = row.count || 0;
            if ((row.visit_type || '').toLowerCase() === 'individual') individualVisits = row.count || 0;
          }
          t.actual_visits = liveVisits?.count || 0;
          t.actual_registrations = liveRegs?.count || 0;
          t.actual_conversions = liveConvs?.count || 0;
          t.store_visits = storeVisits;
          t.individual_visits = individualVisits;
        } catch { /* keep stale values if live query fails */ }
      }));
    }

    // Field-role callers (team_lead/manager widened scope) see other agents' target
    // rows as counts only — commission fields survive on own rows (own pay exempt).
    if (!canSeeMoney(perfUserRole)) {
      targets = targets.map(t => {
        if ((t.agent_id || userId) === userId) return t;
        const { commission_amount, commission_rate, ...rest } = t;
        return rest;
      });
    }

    // Aggregate monthly targets
    const totalTargetVisits = targets.reduce((s, t) => s + (t.target_visits || 0), 0);
    const totalActualVisits = targets.reduce((s, t) => s + (t.actual_visits || 0), 0);
    const totalTargetRegs = targets.reduce((s, t) => s + (t.target_registrations || 0), 0);
    const totalActualRegs = targets.reduce((s, t) => s + (t.actual_registrations || 0), 0);
    const totalTargetConvs = targets.reduce((s, t) => s + (t.target_conversions || 0), 0);
    const totalActualConvs = targets.reduce((s, t) => s + (t.actual_conversions || 0), 0);
    const totalCommission = targets.reduce((s, t) => s + (t.commission_amount || 0), 0);
    const overallAchievement = totalTargetVisits > 0 ? Math.round((totalActualVisits / totalTargetVisits) * 100) : 0;

    // Compute daily individual target from company_target_rules for the week graphic
    // Reuses perfAgentCompanies already fetched in main batch above
    let dailyIndividualTarget = 0;
    try {
      const perfCompanyIds = (perfAgentCompanies.results || []).map(co => co.id);
      if (perfCompanyIds.length > 0) {
        const ph = perfCompanyIds.map(() => '?').join(',');
        // For team leads/managers: use agent rules and scale by agent count to get aggregate individual target
        const perfFetchRole = (perfUserRole === 'team_lead' || perfUserRole === 'manager') ? 'agent' : perfRoleType;
        let perfCtrResult = await db.prepare(`SELECT individual_target_per_day, target_visits_per_day, company_id FROM company_target_rules WHERE tenant_id = ? AND company_id IN (${ph}) AND role_type = ?`).bind(tenantId, ...perfCompanyIds, perfFetchRole).all().catch(() => ({ results: [] }));
        if (!perfCtrResult.results || perfCtrResult.results.length === 0) {
          perfCtrResult = await db.prepare(`SELECT individual_target_per_day, target_visits_per_day, company_id FROM company_target_rules WHERE tenant_id = ? AND company_id IN (${ph})`).bind(tenantId, ...perfCompanyIds).all().catch(() => ({ results: [] }));
        }
        // For team leads/managers, compute per-company agent count for accurate scaling
        const perfAgentCompanyCount = {};
        if (perfUserRole === 'team_lead' || perfUserRole === 'manager') {
          try {
            const apcPh2 = perfCompanyIds.map(() => '?').join(',');
            const daPh2 = perfAgentIdsForCounts.map(() => '?').join(',');
            const apcRes = await db.prepare(`SELECT company_id, COUNT(DISTINCT agent_id) as cnt FROM agent_company_links WHERE tenant_id = ? AND agent_id IN (${daPh2}) AND company_id IN (${apcPh2}) AND is_active = 1 GROUP BY company_id`).bind(tenantId, ...perfAgentIdsForCounts, ...perfCompanyIds).all().catch(() => ({ results: [] }));
            for (const row of (apcRes.results || [])) perfAgentCompanyCount[row.company_id] = row.cnt || 1;
          } catch { /* fallback below */ }
        }
        for (const r of (perfCtrResult.results || [])) {
          const perAgentTarget = (r.individual_target_per_day != null ? r.individual_target_per_day : r.target_visits_per_day) || 0;
          // For team leads/managers, scale by per-company agent count (not total agent count)
          const perfMult = (perfUserRole === 'team_lead' || perfUserRole === 'manager') ? (perfAgentCompanyCount[r.company_id] || perfAgentIdsForCounts.length) : 1;
          dailyIndividualTarget += perAgentTarget * perfMult;
        }
      }
    } catch { /* keep 0 */ }

    // Real incentive tiers (incentive_scales via getScale) for the caller's role —
    // replaces the old commission_rules/target_commission_tiers demo tables
    const perfCompanyIdsForScale = (perfAgentCompanies.results || []).map(co => co.id);
    const perfScaleCompanyId = perfCompanyIdsForScale.length === 1 ? perfCompanyIdsForScale[0] : null;
    const perfScale = await cachedD1Query(`inc-scale:${tenantId}:${perfScaleCompanyId}:${perfRoleType}`, 300, () => getScale(db, tenantId, perfScaleCompanyId, perfRoleType));

    return c.json({
      success: true,
      data: {
        month: currentMonth,
        overall_achievement: overallAchievement,
        total_target_visits: totalTargetVisits,
        total_actual_visits: totalActualVisits,
        total_target_registrations: totalTargetRegs,
        total_actual_registrations: totalActualRegs,
        total_target_conversions: totalTargetConvs,
        total_actual_conversions: totalActualConvs,
        monthly_targets: targets,
        commission_summary: {
          pending: pendingCommissions?.total || 0,
          pending_count: pendingCommissions?.count || 0,
          approved: approvedCommissions?.total || 0,
          approved_count: approvedCommissions?.count || 0,
          paid: paidCommissions?.total || 0,
          paid_count: paidCommissions?.count || 0,
          target_commission: totalCommission,
        },
        recent_earnings: recentEarnings.results || [],
        weekly_visits: weeklyVisits.results || [],
        weekly_individual_visits: weeklyIndividualVisits.results || [],
        daily_individual_target: dailyIndividualTarget,
        streak: streak,
        incentive_tiers: perfScale?.tiers || [],
        team_performance: teamPerformance,
        manager_performance: managerPerformance,
      }
    });
  } catch (error) {
    console.error('Agent performance error:', error);
    return c.json({ success: true, data: { month: '', overall_achievement: 0, total_target_visits: 0, total_actual_visits: 0, total_target_registrations: 0, total_actual_registrations: 0, total_target_conversions: 0, total_actual_conversions: 0, monthly_targets: [], commission_summary: { pending: 0, pending_count: 0, approved: 0, approved_count: 0, paid: 0, paid_count: 0, target_commission: 0 }, recent_earnings: [], weekly_visits: [], streak: 0, incentive_tiers: [], team_performance: null, manager_performance: null } });
  }
});

// ==================== TEAM LEAD DASHBOARD (Mobile) ====================
app.get('/api/team-lead/dashboard', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);

    // Verify caller is a team lead
    const caller = await db.prepare("SELECT role, first_name, last_name, manager_id FROM users WHERE id = ? AND tenant_id = ?").bind(userId, tenantId).first();
    if (!caller || caller.role !== 'team_lead') {
      return c.json({ success: false, message: 'Access denied. Team lead role required.' }, 403);
    }

    // Get team lead's company IDs — used to scope visit counts to their company only
    const tlCompaniesRes = await db.prepare("SELECT fc.id FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active'").bind(userId, tenantId).all().catch(() => ({ results: [] }));
    const companyIds = (tlCompaniesRes.results || []).map(c => c.id);
    const cFilter = companyIds.length > 0 ? ` AND company_id IN (${companyIds.map(() => '?').join(',')})` : '';

    // Get team members under this team lead
    const teamMembers = await db.prepare("SELECT id, first_name, last_name, phone, role, status FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1 ORDER BY first_name").bind(userId, tenantId).all();
    const memberIds = (teamMembers.results || []).map(m => m.id);

    if (memberIds.length === 0) {
      // Still fetch team lead's own targets, commissions, and manager performance
      const tlScaleCompanyId0 = companyIds.length === 1 ? companyIds[0] : null;
      const [tlOwnTargets, tlOwnLiveVisits, tlOwnLiveRegs, ownPendingE, ownApprovedE, ownPaidE, earlyAgentScale, earlyTlScale] = await Promise.all([
        db.prepare("SELECT COALESCE(SUM(target_visits),0) as target_visits, COALESCE(SUM(target_registrations),0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, userId, currentMonth).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ?${cFilter} AND visit_date >= ?`).bind(tenantId, userId, ...companyIds, currentMonth + '-01').first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) = 'store'${cFilter} AND visit_date >= ?`).bind(tenantId, userId, ...companyIds, currentMonth + '-01').first(),
        db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM commission_earnings WHERE tenant_id = ? AND earner_id = ? AND status = 'pending'").bind(tenantId, userId).first(),
        db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM commission_earnings WHERE tenant_id = ? AND earner_id = ? AND status = 'approved'").bind(tenantId, userId).first(),
        db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM commission_earnings WHERE tenant_id = ? AND earner_id = ? AND status = 'paid'").bind(tenantId, userId).first(),
        cachedD1Query(`inc-scale:${tenantId}:${tlScaleCompanyId0}:agent`, 300, () => getScale(db, tenantId, tlScaleCompanyId0, 'agent')),
        cachedD1Query(`inc-scale:${tenantId}:${tlScaleCompanyId0}:team_lead`, 300, () => getScale(db, tenantId, tlScaleCompanyId0, 'team_lead')),
      ]);
      let tlTV = tlOwnTargets?.target_visits || 0;
      let tlTR = tlOwnTargets?.target_registrations || 0;
      // Fall back to company_target_rules if monthly_targets are empty
      if (tlTV === 0 && tlTR === 0) {
        const fb = await getUserMonthlyTargetFromRules(db, tenantId, userId, currentMonth, 'team_lead');
        tlTV = fb.target_visits;
        tlTR = fb.target_registrations;
      }
      const tlAV = tlOwnLiveVisits?.count || 0;
      const tlAR = tlOwnLiveRegs?.count || 0;

      // Fallback: if monthly_targets yields 0 targets, use company_target_rules
      if (tlTV === 0) {
        const tlRuleTargets = await generateTargetsFromRules(db, tenantId, userId, currentMonth + '-01', 'team_lead');
        tlTV = tlRuleTargets.reduce((s, t) => s + (t.target_visits || 0), 0);
      }

      const tlAch = tlTV > 0 ? Math.round((tlAV / tlTV) * 100) : 0;
      // Fetch manager performance
      let earlyMgrPerf = null;
      const earlyMgrId = caller.manager_id || null;
      if (earlyMgrId) {
        const mgrInfo = await db.prepare("SELECT first_name, last_name FROM users WHERE id = ? AND tenant_id = ?").bind(earlyMgrId, tenantId).first();
        const mgrTls = await db.prepare("SELECT id FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND manager_id = ?").bind(tenantId, earlyMgrId).all();
        const mgrTlIds = (mgrTls.results || []).map(tl => tl.id);
        let mTV = 0, mAV = 0;
        if (mgrTlIds.length > 0) {
          const mPh = mgrTlIds.map(() => '?').join(',');
          const earlyMgrAgentIds = await db.prepare(`SELECT id FROM users WHERE tenant_id = ? AND team_lead_id IN (${mPh}) AND is_active = 1`).bind(tenantId, ...mgrTlIds).all();
          const earlyAllMgrUserIds = [...mgrTlIds, ...(earlyMgrAgentIds.results || []).map(a => a.id)];
          if (earlyAllMgrUserIds.length > 0) {
            const earlyAllPh = earlyAllMgrUserIds.map(() => '?').join(',');
            const [earlyMgrTargets, earlyMgrLiveVisits] = await Promise.all([
              db.prepare(`SELECT COALESCE(SUM(target_visits),0) as tv FROM monthly_targets WHERE tenant_id = ? AND agent_id IN (${earlyAllPh}) AND target_month = ?`).bind(tenantId, ...earlyAllMgrUserIds, currentMonth).first(),
              db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id IN (${earlyAllPh}) AND visit_date >= ?`).bind(tenantId, ...earlyAllMgrUserIds, currentMonth + '-01').first(),
            ]);
            mTV = earlyMgrTargets?.tv || 0;
            mAV = earlyMgrLiveVisits?.count || 0;

            // Fallback: if monthly_targets yields 0 targets, use company_target_rules
            if (mTV === 0) {
              const ruleTotals = await computeTargetTotalsFromRules(db, tenantId, earlyAllMgrUserIds, currentMonth + '-01');
              mTV = ruleTotals.totalTargetVisits;
              mAV = ruleTotals.totalActualVisits;
            }
          }
          // Fall back to company_target_rules if monthly_targets are empty for manager scope
          if (mTV === 0 && earlyAllMgrUserIds.length > 0) {
            for (const uid of earlyAllMgrUserIds) {
              const fb = await getUserMonthlyTargetFromRules(db, tenantId, uid, currentMonth, 'agent');
              mTV += fb.target_visits;
            }
          }
        }
        earlyMgrPerf = { manager_name: mgrInfo ? (mgrInfo.first_name + ' ' + mgrInfo.last_name) : 'Manager', achievement: mTV > 0 ? Math.round((mAV / mTV) * 100) : 0 };
      }
      return c.json({
        success: true,
        data: {
          team_size: 0, agents: [],
          team_totals: { today_visits: 0, month_visits: 0, today_stores: 0, month_stores: 0 },
          team_targets: { target_visits: tlTV, actual_visits: tlAV, target_stores: tlTR, actual_stores: tlAR, achievement: tlAch },
          team_commission: { pending: ownPendingE?.total || 0, approved: ownApprovedE?.total || 0, paid: ownPaidE?.total || 0 },
          team_lead_own: { target_visits: tlTV, actual_visits: tlAV, target_stores: tlTR, actual_stores: tlAR, achievement: tlAch },
          incentive_scales: { agent: earlyAgentScale?.tiers || [], team_lead: earlyTlScale?.tiers || [] },
          manager_performance: earlyMgrPerf,
        }
      });
    }

    // Build IN clause for team member IDs
    const placeholders = memberIds.map(() => '?').join(',');

    // Compute date boundaries for week and prior month
    const todayDate = new Date(today);
    const dayOfWeek = todayDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStartDate = new Date(todayDate);
    weekStartDate.setDate(todayDate.getDate() - mondayOffset);
    const weekStart = weekStartDate.toISOString().split('T')[0];
    const priorMonthDate = new Date(parseInt(currentMonth.split('-')[0]), parseInt(currentMonth.split('-')[1]) - 2, 1);
    const priorMonth = priorMonthDate.getFullYear() + '-' + String(priorMonthDate.getMonth() + 1).padStart(2, '0');

    // P1a: Bulk visit counts for all agents in 1 query (was 15 queries × N agents)
    const nextMonth = currentMonth.split('-')[1] === '12'
      ? `${parseInt(currentMonth.split('-')[0]) + 1}-01-01`
      : `${currentMonth.split('-')[0]}-${String(parseInt(currentMonth.split('-')[1]) + 1).padStart(2, '0')}-01`;
    const bulkCounts = await getBulkAgentVisitCounts(db, tenantId, memberIds, today, currentMonth + '-01', nextMonth, weekStart, priorMonth + '-01', companyIds);

    // Fetch monthly_targets for all agents in 1 query (was N queries)
    const allTargets = await db.prepare(`SELECT agent_id, COALESCE(SUM(target_visits),0) as target_visits, COALESCE(SUM(target_registrations),0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id IN (${placeholders}) AND target_month = ? GROUP BY agent_id`).bind(tenantId, ...memberIds, currentMonth).all().catch(() => ({ results: [] }));
    const targetsByAgent = new Map();
    for (const t of (allTargets.results || [])) {
      targetsByAgent.set(t.agent_id, { target_visits: t.target_visits || 0, target_registrations: t.target_registrations || 0 });
    }

    // Fetch rejected photo counts for all team members in one query
    // Excludes photos already re-uploaded (newer pending photo of same type exists)
    const rejectedPhotosByAgent = new Map();
    const rejQuery = await db.prepare(`SELECT v.agent_id, COUNT(vp.id) as rejected_count FROM visit_photos vp JOIN visits v ON vp.visit_id = v.id WHERE v.tenant_id = ? AND v.agent_id IN (${placeholders}) AND vp.review_status = 'rejected' AND NOT EXISTS (SELECT 1 FROM visit_photos newer WHERE newer.visit_id = vp.visit_id AND newer.tenant_id = vp.tenant_id AND newer.photo_type = vp.photo_type AND newer.review_status = 'pending' AND datetime(newer.created_at) > datetime(vp.created_at)) GROUP BY v.agent_id`).bind(tenantId, ...memberIds).all().catch(() => ({ results: [] }));
    for (const row of (rejQuery.results || [])) {
      rejectedPhotosByAgent.set(row.agent_id, row.rejected_count || 0);
    }

    // Build agent stats from bulk results (0 additional D1 queries for visit counts)
    const agentStats = await Promise.all((teamMembers.results || []).map(async (member) => {
      const counts = bulkCounts.get(member.id) || { today_visits: 0, month_visits: 0, today_individual: 0, today_store: 0, month_individual: 0, month_store: 0, week_visits: 0, week_individual: 0, week_store: 0, prior_month_visits: 0, prior_month_individual: 0, prior_month_store: 0 };
      let tv = targetsByAgent.get(member.id)?.target_visits || 0;
      let tr = targetsByAgent.get(member.id)?.target_registrations || 0;
      // Fall back to company_target_rules if monthly_targets are empty
      if (tv === 0 && tr === 0) {
        const fb = await getUserMonthlyTargetFromRules(db, tenantId, member.id, currentMonth, 'agent');
        tv = fb.target_visits;
        tr = fb.target_registrations;
      }
      const av = counts.month_visits;
      const ar = counts.month_store;

      // Fallback: if monthly_targets yields 0, use company_target_rules
      if (tv === 0) {
        const agentRuleTargets = await generateTargetsFromRules(db, tenantId, member.id, currentMonth + '-01', 'agent');
        tv = agentRuleTargets.reduce((s, t) => s + (t.target_visits || 0), 0);
      }

      return {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        role: member.role,
        today_visits: counts.today_visits,
        month_visits: counts.month_visits,
        today_stores: counts.today_store,
        month_stores: counts.month_store,
        today_individual_visits: counts.today_individual,
        today_store_visits: counts.today_store,
        month_individual_visits: counts.month_individual,
        month_store_visits: counts.month_store,
        week_visits: counts.week_visits,
        week_individual_visits: counts.week_individual,
        week_store_visits: counts.week_store,
        prior_month_visits: counts.prior_month_visits,
        prior_month_individual_visits: counts.prior_month_individual,
        prior_month_store_visits: counts.prior_month_store,
        target_visits: tv,
        actual_visits: av,
        target_stores: tr,
        actual_stores: ar,
        achievement: tv > 0 ? Math.round((av / tv) * 100) : 0,
        rejected_photos: rejectedPhotosByAgent.get(member.id) || 0,
      };
    }));

    // Aggregate team totals from agents
    const teamTodayVisits = agentStats.reduce((s, a) => s + a.today_visits, 0);
    const teamMonthVisits = agentStats.reduce((s, a) => s + a.month_visits, 0);
    const teamTodayRegs = agentStats.reduce((s, a) => s + (a.today_stores || 0), 0);
    const teamMonthRegs = agentStats.reduce((s, a) => s + (a.month_stores || 0), 0);
    const teamTodayIndividual = agentStats.reduce((s, a) => s + (a.today_individual_visits || 0), 0);
    const teamTodayStore = agentStats.reduce((s, a) => s + (a.today_store_visits || 0), 0);
    const teamMonthIndividual = agentStats.reduce((s, a) => s + (a.month_individual_visits || 0), 0);
    const teamMonthStore = agentStats.reduce((s, a) => s + (a.month_store_visits || 0), 0);
    const teamWeekVisits = agentStats.reduce((s, a) => s + (a.week_visits || 0), 0);
    const teamWeekIndividual = agentStats.reduce((s, a) => s + (a.week_individual_visits || 0), 0);
    const teamWeekStore = agentStats.reduce((s, a) => s + (a.week_store_visits || 0), 0);
    const teamPriorMonthVisits = agentStats.reduce((s, a) => s + (a.prior_month_visits || 0), 0);
    const teamPriorMonthIndividual = agentStats.reduce((s, a) => s + (a.prior_month_individual_visits || 0), 0);
    const teamPriorMonthStore = agentStats.reduce((s, a) => s + (a.prior_month_store_visits || 0), 0);
    const agentTargetVisits = agentStats.reduce((s, a) => s + a.target_visits, 0);
    const agentActualVisits = agentStats.reduce((s, a) => s + a.actual_visits, 0);
    const agentTargetRegs = agentStats.reduce((s, a) => s + (a.target_stores || 0), 0);
    const agentActualRegs = agentStats.reduce((s, a) => s + (a.actual_stores || 0), 0);

    // P3: Include team lead's own targets — use db.batch for 1 round-trip (was 3 queries)
    const [tlOwnTargets, tlOwnVisitCount, tlOwnRegCount] = await db.batch([
      db.prepare("SELECT COALESCE(SUM(target_visits),0) as target_visits, COALESCE(SUM(target_registrations),0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, userId, currentMonth),
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ?${cFilter} AND visit_date >= ?`).bind(tenantId, userId, ...companyIds, currentMonth + '-01'),
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) = 'store'${cFilter} AND visit_date >= ?`).bind(tenantId, userId, ...companyIds, currentMonth + '-01'),
    ]).catch(() => [{ results: [{ target_visits: 0, target_registrations: 0 }] }, { results: [{ count: 0 }] }, { results: [{ count: 0 }] }]);
    // db.batch returns { results: [...] } per statement — extract first row
    const tlOwnTargetsRow = tlOwnTargets?.results?.[0] || tlOwnTargets || {};
    const tlOwnVisitRow = tlOwnVisitCount?.results?.[0] || tlOwnVisitCount || {};
    const tlOwnRegRow = tlOwnRegCount?.results?.[0] || tlOwnRegCount || {};
    let tlOwnTV = tlOwnTargetsRow.target_visits || 0;
    let tlOwnTR = tlOwnTargetsRow.target_registrations || 0;
    // Fall back to company_target_rules if monthly_targets are empty for team lead
    if (tlOwnTV === 0 && tlOwnTR === 0) {
      const fb = await getUserMonthlyTargetFromRules(db, tenantId, userId, currentMonth, 'team_lead');
      tlOwnTV = fb.target_visits;
      tlOwnTR = fb.target_registrations;
    }
    const tlOwnAV = tlOwnVisitRow.count || 0;
    const tlOwnAR = tlOwnRegRow.count || 0;

    // Fallback: if monthly_targets yields 0 for TL, use company_target_rules
    if (tlOwnTV === 0) {
      const tlRuleTargets = await generateTargetsFromRules(db, tenantId, userId, currentMonth + '-01', 'team_lead');
      tlOwnTV = tlRuleTargets.reduce((s, t) => s + (t.target_visits || 0), 0);
    }

    const teamTargetVisits = agentTargetVisits + tlOwnTV;
    const teamActualVisits = agentActualVisits + tlOwnAV;
    const teamTargetRegs = agentTargetRegs + tlOwnTR;
    const teamActualRegs = agentActualRegs + tlOwnAR;

    // Real incentive tiers (incentive_scales via getScale, 5-min cache) — same source
    // as hero/incentive screens, replacing the old commission demo tables
    const tlScaleCompanyId = companyIds.length === 1 ? companyIds[0] : null;
    const [tlAgentScale, tlOwnScale] = await Promise.all([
      cachedD1Query(`inc-scale:${tenantId}:${tlScaleCompanyId}:agent`, 300, () => getScale(db, tenantId, tlScaleCompanyId, 'agent')),
      cachedD1Query(`inc-scale:${tenantId}:${tlScaleCompanyId}:team_lead`, 300, () => getScale(db, tenantId, tlScaleCompanyId, 'team_lead')),
    ]);

    // Own pay only — field roles never see team-wide rand totals (counts-only rule)
    const ownCommTotals = await getCommissionTotals(db, tenantId, [userId]);

    // Fetch manager performance (team lead's manager)
    let tlManagerPerf = null;
    const tlManagerId = caller.manager_id || null;
    if (tlManagerId) {
      const mgrInfo = await db.prepare("SELECT first_name, last_name FROM users WHERE id = ? AND tenant_id = ?").bind(tlManagerId, tenantId).first();
      const mgrTls = await db.prepare("SELECT id FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND manager_id = ?").bind(tenantId, tlManagerId).all();
      const mgrTlIds = (mgrTls.results || []).map(tl => tl.id);
      let mgrTV = 0, mgrAV = 0;
      if (mgrTlIds.length > 0) {
        const mgrPh = mgrTlIds.map(() => '?').join(',');
        // Use live counts instead of stale monthly_targets.actual_visits for manager performance
        const mgrAgentIds2 = await db.prepare(`SELECT id FROM users WHERE tenant_id = ? AND team_lead_id IN (${mgrPh}) AND is_active = 1`).bind(tenantId, ...mgrTlIds).all();
        const allMgrUserIds2 = [...mgrTlIds, ...(mgrAgentIds2.results || []).map(a => a.id)];
        if (allMgrUserIds2.length > 0) {
          const allPh2 = allMgrUserIds2.map(() => '?').join(',');
          const [mgrTargets2, mgrLiveVisits2] = await Promise.all([
            db.prepare(`SELECT COALESCE(SUM(target_visits),0) as tv FROM monthly_targets WHERE tenant_id = ? AND agent_id IN (${allPh2}) AND target_month = ?`).bind(tenantId, ...allMgrUserIds2, currentMonth).first(),
            db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id IN (${allPh2}) AND visit_date >= ?`).bind(tenantId, ...allMgrUserIds2, currentMonth + '-01').first(),
          ]);
          mgrTV = mgrTargets2?.tv || 0;
          mgrAV = mgrLiveVisits2?.count || 0;

          // Fallback: if monthly_targets yields 0 targets, use company_target_rules
          if (mgrTV === 0) {
            const ruleTotals = await computeTargetTotalsFromRules(db, tenantId, allMgrUserIds2, currentMonth + '-01');
            mgrTV = ruleTotals.totalTargetVisits;
            mgrAV = ruleTotals.totalActualVisits;
          }
        }
        // Fall back to company_target_rules if monthly_targets are empty for manager scope
        if (mgrTV === 0 && allMgrUserIds2.length > 0) {
          for (const uid of allMgrUserIds2) {
            const fb = await getUserMonthlyTargetFromRules(db, tenantId, uid, currentMonth, 'agent');
            mgrTV += fb.target_visits;
          }
        }
      }
      tlManagerPerf = { manager_name: mgrInfo ? (mgrInfo.first_name + ' ' + mgrInfo.last_name) : 'Manager', achievement: mgrTV > 0 ? Math.round((mgrAV / mgrTV) * 100) : 0 };
    }

    return c.json({
      success: true,
      data: {
        team_size: memberIds.length,
        agents: agentStats,
        team_totals: {
          today_visits: teamTodayVisits,
          month_visits: teamMonthVisits,
          today_stores: teamTodayRegs,
          month_stores: teamMonthRegs,
          today_individual_visits: teamTodayIndividual,
          today_store_visits: teamTodayStore,
          month_individual_visits: teamMonthIndividual,
          month_store_visits: teamMonthStore,
          week_visits: teamWeekVisits,
          week_individual_visits: teamWeekIndividual,
          week_store_visits: teamWeekStore,
          prior_month_visits: teamPriorMonthVisits,
          prior_month_individual_visits: teamPriorMonthIndividual,
          prior_month_store_visits: teamPriorMonthStore,
        },
        team_targets: {
          target_visits: teamTargetVisits,
          actual_visits: teamActualVisits,
          target_stores: teamTargetRegs,
          actual_stores: teamActualRegs,
          achievement: teamTargetVisits > 0 ? Math.round((teamActualVisits / teamTargetVisits) * 100) : 0,
        },
        // Own earnings only (team-wide rand totals removed — counts-only rule for field roles)
        team_commission: {
          pending: (ownCommTotals?.pending || 0),
          approved: (ownCommTotals?.approved || 0),
          paid: (ownCommTotals?.paid || 0),
        },
        incentive_scales: { agent: tlAgentScale?.tiers || [], team_lead: tlOwnScale?.tiers || [] },
        team_lead_own: { target_visits: tlOwnTV, actual_visits: tlOwnAV, target_stores: tlOwnTR, actual_stores: tlOwnAR, achievement: tlOwnTV > 0 ? Math.round((tlOwnAV / tlOwnTV) * 100) : 0 },
        manager_performance: tlManagerPerf,
      }
    });
  } catch (error) {
    console.error('Team lead dashboard error:', error);
    return c.json({ success: true, data: { team_size: 0, agents: [], team_totals: { today_visits: 0, month_visits: 0, today_stores: 0, month_stores: 0 }, team_targets: { target_visits: 0, actual_visits: 0, target_stores: 0, actual_stores: 0, achievement: 0 }, team_commission: { pending: 0, approved: 0, paid: 0 }, incentive_scales: { agent: [], team_lead: [] }, team_lead_own: null, manager_performance: null } });
  }
});

// ==================== MANAGER DASHBOARD (Mobile) ====================
app.get('/api/manager/dashboard', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);

    // Verify caller is a manager, GM, or admin
    const caller = await db.prepare("SELECT role, first_name, last_name FROM users WHERE id = ? AND tenant_id = ?").bind(userId, tenantId).first();
    if (!caller || !['manager', 'general_manager', 'admin', 'super_admin'].includes(caller.role)) {
      return c.json({ success: false, message: 'Access denied. Manager role required.' }, 403);
    }

    // Get all team leads under this manager (or all if org-wide role).
    // GM sits above managers so sees the whole org, same scope as admin.
    const isAdmin = ['admin', 'super_admin', 'general_manager'].includes(caller.role);

    // Companies visible to the caller (admins/GM: all active; managers: linked only) — powers the company selector chips
    const companiesRes = await (isAdmin
      ? db.prepare("SELECT id, name FROM field_companies WHERE tenant_id = ? AND status = 'active' ORDER BY name").bind(tenantId)
      : db.prepare("SELECT fc.id, fc.name FROM manager_company_links mcl JOIN field_companies fc ON mcl.company_id = fc.id WHERE mcl.manager_id = ? AND mcl.tenant_id = ? AND mcl.is_active = 1 AND fc.status = 'active' ORDER BY fc.name").bind(userId, tenantId)
    ).all().catch(() => ({ results: [] }));
    const companies = companiesRes.results || [];

    // Scope visit counts: managers default to their linked companies; ?company_id narrows to one (must be visible to caller)
    const requestedCompanyId = c.req.query('company_id') || null;
    let mgrCompanyIds = isAdmin ? [] : companies.map(co => co.id);
    if (requestedCompanyId && companies.some(co => co.id === requestedCompanyId)) {
      mgrCompanyIds = [requestedCompanyId];
    }
    const mgrCFilter = mgrCompanyIds.length > 0 ? ` AND company_id IN (${mgrCompanyIds.map(() => '?').join(',')})` : '';
    const teamLeadsQuery = isAdmin
      ? "SELECT id, first_name, last_name, phone, role FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1 ORDER BY first_name"
      : "SELECT id, first_name, last_name, phone, role FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND manager_id = ? ORDER BY first_name";
    const teamLeadsBinds = isAdmin ? [tenantId] : [tenantId, userId];
    const teamLeads = await db.prepare(teamLeadsQuery).bind(...teamLeadsBinds).all();

    // Get agents scoped to this manager's team leads (or all if admin)
    const teamLeadIds = (teamLeads.results || []).map(tl => tl.id);
    let allAgents;
    if (isAdmin) {
      allAgents = await db.prepare("SELECT id, first_name, last_name, role, team_lead_id FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent', 'sales_rep') AND is_active = 1").bind(tenantId).all();
    } else if (teamLeadIds.length > 0) {
      const tlPh = teamLeadIds.map(() => '?').join(',');
      allAgents = await db.prepare(`SELECT id, first_name, last_name, role, team_lead_id FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent', 'sales_rep') AND is_active = 1 AND (team_lead_id IN (${tlPh}) OR team_lead_id IS NULL)`).bind(tenantId, ...teamLeadIds).all();
    } else {
      allAgents = { results: [] };
    }

    // Compute date boundaries for week and prior month (period breakdowns)
    const todayDate = new Date(today);
    const dayOfWeek = todayDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStartDate = new Date(todayDate);
    weekStartDate.setDate(todayDate.getDate() - mondayOffset);
    const weekStart = weekStartDate.toISOString().split('T')[0];
    const priorMonthDate = new Date(parseInt(currentMonth.split('-')[0]), parseInt(currentMonth.split('-')[1]) - 2, 1);
    const priorMonth = priorMonthDate.getFullYear() + '-' + String(priorMonthDate.getMonth() + 1).padStart(2, '0');

    const nextMonth = currentMonth.split('-')[1] === '12'
      ? `${parseInt(currentMonth.split('-')[0]) + 1}-01-01`
      : `${currentMonth.split('-')[0]}-${String(parseInt(currentMonth.split('-')[1]) + 1).padStart(2, '0')}-01`;

    // One bulk query for today/week/prior-month splits across all agents + team leads
    const periodUserIds = [...(allAgents.results || []).map(a => a.id), ...teamLeadIds];
    const bulkPeriodCounts = periodUserIds.length > 0
      ? await getBulkAgentVisitCounts(db, tenantId, periodUserIds, today, currentMonth + '-01', nextMonth, weekStart, priorMonth + '-01', mgrCompanyIds)
      : new Map();
    const sumBulk = (ids, map) => {
      const t = { today_visits: 0, today_individual: 0, today_store: 0, week_visits: 0, week_individual: 0, week_store: 0, prior_month_visits: 0, prior_month_individual: 0, prior_month_store: 0 };
      for (const id of ids) {
        const c = map.get(id);
        if (!c) continue;
        t.today_visits += c.today_visits; t.today_individual += c.today_individual; t.today_store += c.today_store;
        t.week_visits += c.week_visits; t.week_individual += c.week_individual; t.week_store += c.week_store;
        t.prior_month_visits += c.prior_month_visits; t.prior_month_individual += c.prior_month_individual; t.prior_month_store += c.prior_month_store;
      }
      return t;
    };

    // Build team lead breakdown with their agents' performance — all team leads in parallel
    const teamsData = await Promise.all((teamLeads.results || []).map(async (tl) => {
      const members = (allAgents.results || []).filter(a => a.team_lead_id === tl.id);
      const memberIds = members.map(m => m.id);

      let teamVisits = 0;
      let teamRegs = 0;
      let teamTargetVisits = 0;
      let teamActualVisits = 0;
      let teamTargetRegs = 0;
      let teamActualRegs = 0;

      if (memberIds.length > 0) {
        const ph = memberIds.map(() => '?').join(',');
        const [vRes, rRes, tRes, iRes] = await Promise.all([
          db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id IN (${ph})${mgrCFilter} AND visit_date >= ?`).bind(tenantId, ...memberIds, ...mgrCompanyIds, currentMonth + '-01').first(),
          db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) = 'store' AND agent_id IN (${ph})${mgrCFilter} AND visit_date >= ?`).bind(tenantId, ...memberIds, ...mgrCompanyIds, currentMonth + '-01').first(),
          db.prepare(`SELECT COALESCE(SUM(target_visits),0) as tv, COALESCE(SUM(target_registrations),0) as tr FROM monthly_targets WHERE tenant_id = ? AND agent_id IN (${ph}) AND target_month = ?`).bind(tenantId, ...memberIds, currentMonth).first(),
          db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) != 'store' AND agent_id IN (${ph})${mgrCFilter} AND visit_date >= ?`).bind(tenantId, ...memberIds, ...mgrCompanyIds, currentMonth + '-01').first(),
        ]);
        teamVisits = iRes?.count || 0;
        teamRegs = rRes?.count || 0;
        teamTargetVisits = tRes?.tv || 0;
        teamActualVisits = vRes?.count || 0;
        teamTargetRegs = tRes?.tr || 0;
        teamActualRegs = teamRegs;
        if (teamTargetVisits === 0 && teamTargetRegs === 0) {
          const fbs = await Promise.all(memberIds.map(mid => getUserMonthlyTargetFromRules(db, tenantId, mid, currentMonth, 'agent')));
          for (const fb of fbs) { teamTargetVisits += fb.target_visits; teamTargetRegs += fb.target_registrations; }
        }
      }

      if (teamTargetVisits === 0 && memberIds.length > 0) {
        const ruleTotals = await computeTargetTotalsFromRules(db, tenantId, memberIds, currentMonth + '-01');
        teamTargetVisits = ruleTotals.totalTargetVisits;
        teamActualVisits = ruleTotals.totalActualVisits;
      }

      // Include team lead's own targets and real visit counts in team totals
      const [tlOwnTgt, tlOwnVC, tlOwnRC] = await Promise.all([
        db.prepare("SELECT COALESCE(SUM(target_visits),0) as tv, COALESCE(SUM(target_registrations),0) as tr FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, tl.id, currentMonth).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ?${mgrCFilter} AND visit_date >= ?`).bind(tenantId, tl.id, ...mgrCompanyIds, currentMonth + '-01').first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) = 'store'${mgrCFilter} AND visit_date >= ?`).bind(tenantId, tl.id, ...mgrCompanyIds, currentMonth + '-01').first(),
      ]);
      let tlOwnTgtTV = tlOwnTgt?.tv || 0;
      let tlOwnTgtTR = tlOwnTgt?.tr || 0;
      if (tlOwnTgtTV === 0 && tlOwnTgtTR === 0) {
        const fb = await getUserMonthlyTargetFromRules(db, tenantId, tl.id, currentMonth, 'team_lead');
        tlOwnTgtTV = fb.target_visits;
        tlOwnTgtTR = fb.target_registrations;
      }
      teamTargetVisits += tlOwnTgtTV;
      teamActualVisits += (tlOwnVC?.count || 0);
      teamTargetRegs += tlOwnTgtTR;
      teamActualRegs += (tlOwnRC?.count || 0);

      const tp = sumBulk([...memberIds, tl.id], bulkPeriodCounts);

      return {
        team_lead_id: tl.id,
        team_lead_name: tl.first_name + ' ' + tl.last_name,
        agent_count: memberIds.length,
        month_visits: teamVisits,
        month_stores: teamRegs,
        today_visits: tp.today_individual,
        today_stores: tp.today_store,
        week_visits: tp.week_individual,
        week_stores: tp.week_store,
        prior_month_visits: tp.prior_month_individual,
        prior_month_stores: tp.prior_month_store,
        target_visits: teamTargetVisits,
        actual_visits: teamActualVisits,
        target_stores: teamTargetRegs,
        actual_stores: teamActualRegs,
        achievement: teamTargetVisits > 0 ? Math.round((teamActualVisits / teamTargetVisits) * 100) : 0,
        team_lead_own: { target_visits: tlOwnTgtTV, actual_visits: tlOwnVC?.count || 0, target_stores: tlOwnTgtTR, actual_stores: tlOwnRC?.count || 0 },
      };
    }));

    // Build "Unassigned Agents" pseudo-team for agents with no team_lead_id
    const unassignedAgents = (allAgents.results || []).filter(a => !a.team_lead_id);
    const unassignedIds = unassignedAgents.map(a => a.id);
    let unassignedTeam = null;
    if (unassignedIds.length > 0) {
      const uaPh = unassignedIds.map(() => '?').join(',');
      // Unassigned agents span companies; only narrow when an explicit company is selected
      const uaCFilter = requestedCompanyId ? mgrCFilter : '';
      const uaCIds = requestedCompanyId ? mgrCompanyIds : [];
      const [uaVRes, uaRRes, uaTRes, uaIRes] = await Promise.all([
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id IN (${uaPh})${uaCFilter} AND visit_date >= ?`).bind(tenantId, ...unassignedIds, ...uaCIds, currentMonth + '-01').first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) = 'store' AND agent_id IN (${uaPh})${uaCFilter} AND visit_date >= ?`).bind(tenantId, ...unassignedIds, ...uaCIds, currentMonth + '-01').first(),
        db.prepare(`SELECT COALESCE(SUM(target_visits),0) as tv, COALESCE(SUM(target_registrations),0) as tr FROM monthly_targets WHERE tenant_id = ? AND agent_id IN (${uaPh}) AND target_month = ?`).bind(tenantId, ...unassignedIds, currentMonth).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) != 'store' AND agent_id IN (${uaPh})${uaCFilter} AND visit_date >= ?`).bind(tenantId, ...unassignedIds, ...uaCIds, currentMonth + '-01').first(),
      ]);
      let uaTargetVisits = uaTRes?.tv || 0;
      let uaTargetRegs = uaTRes?.tr || 0;
      let uaActualVisits = uaVRes?.count || 0;
      const uaActualRegs = uaRRes?.count || 0;
      if (uaTargetVisits === 0 && uaTargetRegs === 0) {
        const fbs = await Promise.all(unassignedIds.map(mid => getUserMonthlyTargetFromRules(db, tenantId, mid, currentMonth, 'agent')));
        for (const fb of fbs) { uaTargetVisits += fb.target_visits; uaTargetRegs += fb.target_registrations; }
      }
      if (uaTargetVisits === 0 && unassignedIds.length > 0) {
        const ruleTotals = await computeTargetTotalsFromRules(db, tenantId, unassignedIds, currentMonth + '-01');
        uaTargetVisits = ruleTotals.totalTargetVisits;
        uaActualVisits = ruleTotals.totalActualVisits;
      }
      const uaBulk = (mgrCompanyIds.length > 0 && !requestedCompanyId)
        ? await getBulkAgentVisitCounts(db, tenantId, unassignedIds, today, currentMonth + '-01', nextMonth, weekStart, priorMonth + '-01', [])
        : bulkPeriodCounts;
      const up = sumBulk(unassignedIds, uaBulk);
      unassignedTeam = {
        team_lead_id: null,
        team_lead_name: 'Unassigned Agents',
        agent_count: unassignedIds.length,
        month_visits: uaIRes?.count || 0,
        month_stores: uaRRes?.count || 0,
        today_visits: up.today_individual,
        today_stores: up.today_store,
        week_visits: up.week_individual,
        week_stores: up.week_store,
        prior_month_visits: up.prior_month_individual,
        prior_month_stores: up.prior_month_store,
        target_visits: uaTargetVisits,
        actual_visits: uaActualVisits,
        target_stores: uaTargetRegs,
        actual_stores: uaActualRegs,
        achievement: uaTargetVisits > 0 ? Math.round((uaActualVisits / uaTargetVisits) * 100) : 0,
        team_lead_own: { target_visits: 0, actual_visits: 0, target_stores: 0, actual_stores: 0 },
      };
      teamsData.push(unassignedTeam);
    }

    // Org-wide totals (use teamsData which already includes team lead own targets + unassigned)
    const allAgentIds = (allAgents.results || []).map(a => a.id);
    let orgTodayVisits = 0, orgMonthVisits = 0, orgTodayRegs = 0, orgMonthRegs = 0;
    let orgTodayIndividual = 0, orgTodayStoreV = 0, orgMonthIndividual = 0, orgMonthStoreV = 0;
    let orgPending = 0, orgApproved = 0, orgPaid = 0;

    // Org targets = sum from all teams (which now include TL own targets + unassigned agents)
    const orgTargetVisits = teamsData.reduce((s, t) => s + t.target_visits, 0);
    const orgActualVisits = teamsData.reduce((s, t) => s + t.actual_visits, 0);
    const orgTargetRegs = teamsData.reduce((s, t) => s + (t.target_stores || 0), 0);
    const orgActualRegs = teamsData.reduce((s, t) => s + (t.actual_stores || 0), 0);

    if (allAgentIds.length > 0) {
      const ph2 = allAgentIds.map(() => '?').join(',');
      const [tvRes, mvRes, trRes, mrRes, cpRes, caRes, cdRes, tiRes, tsRes, miRes, msRes] = await Promise.all([
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id IN (${ph2})${mgrCFilter} AND visit_date = ?`).bind(tenantId, ...allAgentIds, ...mgrCompanyIds, today).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id IN (${ph2})${mgrCFilter} AND visit_date >= ?`).bind(tenantId, ...allAgentIds, ...mgrCompanyIds, currentMonth + '-01').first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) = 'store' AND agent_id IN (${ph2})${mgrCFilter} AND visit_date = ?`).bind(tenantId, ...allAgentIds, ...mgrCompanyIds, today).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) = 'store' AND agent_id IN (${ph2})${mgrCFilter} AND visit_date >= ?`).bind(tenantId, ...allAgentIds, ...mgrCompanyIds, currentMonth + '-01').first(),
        db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM commission_earnings WHERE tenant_id = ? AND earner_id IN (${ph2}) AND status = 'pending'`).bind(tenantId, ...allAgentIds).first(),
        db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM commission_earnings WHERE tenant_id = ? AND earner_id IN (${ph2}) AND status = 'approved'`).bind(tenantId, ...allAgentIds).first(),
        db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM commission_earnings WHERE tenant_id = ? AND earner_id IN (${ph2}) AND status = 'paid'`).bind(tenantId, ...allAgentIds).first(),
        // Individual = NOT store; Store = visit_type = 'store'
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) != 'store' AND agent_id IN (${ph2})${mgrCFilter} AND visit_date = ?`).bind(tenantId, ...allAgentIds, ...mgrCompanyIds, today).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id IN (${ph2})${mgrCFilter} AND visit_date = ? AND LOWER(visit_type) = 'store'`).bind(tenantId, ...allAgentIds, ...mgrCompanyIds, today).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) != 'store' AND agent_id IN (${ph2})${mgrCFilter} AND visit_date >= ?`).bind(tenantId, ...allAgentIds, ...mgrCompanyIds, currentMonth + '-01').first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id IN (${ph2})${mgrCFilter} AND visit_date >= ? AND LOWER(visit_type) = 'store'`).bind(tenantId, ...allAgentIds, ...mgrCompanyIds, currentMonth + '-01').first(),
      ]);
      orgTodayVisits = tvRes?.count || 0;
      orgMonthVisits = mvRes?.count || 0;
      orgTodayRegs = trRes?.count || 0;
      orgMonthRegs = mrRes?.count || 0;
      orgTodayIndividual = tiRes?.count || 0;
      orgTodayStoreV = tsRes?.count || 0;
      orgMonthIndividual = miRes?.count || 0;
      orgMonthStoreV = msRes?.count || 0;
      orgPending = cpRes?.total || 0;
      orgApproved = caRes?.total || 0;
      orgPaid = cdRes?.total || 0;
    }

    // Include team lead commission earnings in org totals
    if (isAdmin && teamLeadIds.length > 0) {
      const tlPh3 = teamLeadIds.map(() => '?').join(',');
      const [tlPendingC, tlApprovedC, tlPaidC] = await Promise.all([
        db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM commission_earnings WHERE tenant_id = ? AND earner_id IN (${tlPh3}) AND status = 'pending'`).bind(tenantId, ...teamLeadIds).first(),
        db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM commission_earnings WHERE tenant_id = ? AND earner_id IN (${tlPh3}) AND status = 'approved'`).bind(tenantId, ...teamLeadIds).first(),
        db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM commission_earnings WHERE tenant_id = ? AND earner_id IN (${tlPh3}) AND status = 'paid'`).bind(tenantId, ...teamLeadIds).first(),
      ]);
      orgPending += (tlPendingC?.total || 0);
      orgApproved += (tlApprovedC?.total || 0);
      orgPaid += (tlPaidC?.total || 0);
    }

    // Real incentive tiers (incentive_scales via getScale) — same source as hero/incentive screens,
    // replacing the old commission_rules/target_commission_tiers demo tables that never held field-ops data
    const scaleCompanyId = requestedCompanyId || (mgrCompanyIds.length === 1 ? mgrCompanyIds[0] : null);
    const [agentScale, tlScale, mgrScale] = await Promise.all([
      cachedD1Query(`inc-scale:${tenantId}:${scaleCompanyId}:agent`, 300, () => getScale(db, tenantId, scaleCompanyId, 'agent')),
      cachedD1Query(`inc-scale:${tenantId}:${scaleCompanyId}:team_lead`, 300, () => getScale(db, tenantId, scaleCompanyId, 'team_lead')),
      cachedD1Query(`inc-scale:${tenantId}:${scaleCompanyId}:manager`, 300, () => getScale(db, tenantId, scaleCompanyId, 'manager')),
    ]);

    const op = sumBulk(allAgentIds, bulkPeriodCounts);

    // Manager is a field role: own pay only in org_commission (counts-only rule).
    // Admin/GM keep the org-wide totals.
    if (!isAdmin) {
      const mgrOwnComm = await getCommissionTotals(db, tenantId, [userId]);
      orgPending = mgrOwnComm?.pending || 0;
      orgApproved = mgrOwnComm?.approved || 0;
      orgPaid = mgrOwnComm?.paid || 0;
    }

    // Per-agent period counts for the manager Stats tab — straight out of
    // bulkPeriodCounts (already computed above), zero extra queries.
    // Counts only, never money: field managers see per-day counts, not rand.
    const agentBreakdown = (allAgents.results || []).map((a) => {
      const p = bulkPeriodCounts.get(a.id);
      return {
        id: a.id,
        name: `${a.first_name} ${a.last_name}`,
        team_lead_id: a.team_lead_id,
        today_individual: p?.today_individual || 0,
        today_store: p?.today_store || 0,
        week_individual: p?.week_individual || 0,
        week_store: p?.week_store || 0,
        month_individual: p?.month_individual || 0,
        month_store: p?.month_store || 0,
        prior_month_individual: p?.prior_month_individual || 0,
        prior_month_store: p?.prior_month_store || 0,
      };
    });

    return c.json({
      success: true,
      data: {
        total_team_leads: (teamLeads.results || []).length,
        total_agents: allAgentIds.length,
        unassigned_agents: unassignedIds.length,
        teams: teamsData,
        agents: agentBreakdown,
        org_totals: {
          today_visits: orgTodayVisits,
          month_visits: orgMonthVisits,
          today_stores: orgTodayRegs,
          month_stores: orgMonthRegs,
          today_individual_visits: orgTodayIndividual,
          today_store_visits: orgTodayStoreV,
          month_individual_visits: orgMonthIndividual,
          month_store_visits: orgMonthStoreV,
          week_visits: op.week_visits,
          week_stores: op.week_store,
          week_individual_visits: op.week_individual,
          week_store_visits: op.week_store,
          prior_month_visits: op.prior_month_visits,
          prior_month_stores: op.prior_month_store,
          prior_month_individual_visits: op.prior_month_individual,
          prior_month_store_visits: op.prior_month_store,
        },
        org_targets: {
          target_visits: orgTargetVisits,
          actual_visits: orgActualVisits,
          target_stores: orgTargetRegs,
          actual_stores: orgActualRegs,
          achievement: orgTargetVisits > 0 ? Math.round((orgActualVisits / orgTargetVisits) * 100) : 0,
        },
        org_commission: {
          pending: orgPending,
          approved: orgApproved,
          paid: orgPaid,
        },
        companies,
        selected_company_id: requestedCompanyId,
        incentive_scales: {
          agent: agentScale?.tiers || [],
          team_lead: tlScale?.tiers || [],
          manager: mgrScale?.tiers || [],
        },
      }
    });
  } catch (error) {
    console.error('Manager dashboard error:', error);
    return c.json({ success: true, data: { total_team_leads: 0, total_agents: 0, unassigned_agents: 0, teams: [], org_totals: { today_visits: 0, month_visits: 0, today_stores: 0, month_stores: 0 }, org_targets: { target_visits: 0, actual_visits: 0, target_stores: 0, actual_stores: 0, achievement: 0 }, org_commission: { pending: 0, approved: 0, paid: 0 }, companies: [], selected_company_id: null, incentive_scales: { agent: [], team_lead: [], manager: [] } } });
  }
});

// ==================== DRILL-DOWN ENDPOINTS (Mobile) ====================

// Team Lead: Get a specific agent's detail + recent visits
app.get('/api/team-lead/agent/:agentId', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const agentId = c.req.param('agentId');
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);

    // Verify caller is a team lead
    const caller = await db.prepare("SELECT role FROM users WHERE id = ? AND tenant_id = ?").bind(userId, tenantId).first();
    if (!caller || caller.role !== 'team_lead') {
      return c.json({ success: false, message: 'Access denied. Team lead role required.' }, 403);
    }

    // Verify agent belongs to this team lead
    const agent = await db.prepare("SELECT id, first_name, last_name, phone, role, status FROM users WHERE id = ? AND tenant_id = ? AND team_lead_id = ? AND is_active = 1").bind(agentId, tenantId, userId).first();
    if (!agent) {
      return c.json({ success: false, message: 'Agent not found or not in your team.' }, 404);
    }

    // Restrict to TL's own companies
    const tlCompaniesRes = await db.prepare("SELECT fc.id FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active'").bind(userId, tenantId).all().catch(() => ({ results: [] }));
    const tlCompanyIds = (tlCompaniesRes.results || []).map(c => c.id);
    const cFilter = tlCompanyIds.length > 0 ? ` AND company_id IN (${tlCompanyIds.map(() => '?').join(',')})` : '';

    // Get agent stats
    const [todayV, monthV, todayR, monthR, targets, todayIndiv, monthIndiv] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ?${cFilter} AND visit_date = ?`).bind(tenantId, agentId, ...tlCompanyIds, today).first(),
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ?${cFilter} AND visit_date >= ?`).bind(tenantId, agentId, ...tlCompanyIds, currentMonth + '-01').first(),
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) = 'store'${cFilter} AND visit_date = ?`).bind(tenantId, agentId, ...tlCompanyIds, today).first(),
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) = 'store'${cFilter} AND visit_date >= ?`).bind(tenantId, agentId, ...tlCompanyIds, currentMonth + '-01').first(),
      db.prepare("SELECT COALESCE(SUM(target_visits),0) as target_visits, COALESCE(SUM(target_registrations),0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, agentId, currentMonth).first(),
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) != 'store'${cFilter} AND visit_date = ?`).bind(tenantId, agentId, ...tlCompanyIds, today).first(),
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) != 'store'${cFilter} AND visit_date >= ?`).bind(tenantId, agentId, ...tlCompanyIds, currentMonth + '-01').first(),
    ]);
    let tv = targets?.target_visits || 0;
    let tr = targets?.target_registrations || 0;
    if (tv === 0 && tr === 0) {
      const fb = await getUserMonthlyTargetFromRules(db, tenantId, agentId, currentMonth, 'agent');
      tv = fb.target_visits;
      tr = fb.target_registrations;
    }
    const av = monthV?.count || 0;
    const ar = monthR?.count || 0;

    // Get recent visits (last 50)
    const recentVisits = await db.prepare(
      `SELECT v.id, v.visit_date, v.visit_type, v.status, v.check_in_time, v.check_out_time, v.notes, v.latitude, v.longitude, v.individual_name, v.individual_surname, c.name as customer_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id WHERE v.tenant_id = ? AND v.agent_id = ?${cFilter} ORDER BY v.visit_date DESC, v.check_in_time DESC LIMIT 50`
    ).bind(tenantId, agentId, ...tlCompanyIds).all();

    return c.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          first_name: agent.first_name,
          last_name: agent.last_name,
          phone: agent.phone,
          role: agent.role,
        },
        stats: {
          today_visits: todayIndiv?.count || 0,
          month_visits: monthIndiv?.count || 0,
          today_stores: todayR?.count || 0,
          month_stores: monthR?.count || 0,
          target_visits: tv,
          actual_visits: av,
          target_stores: tr,
          actual_stores: ar,
          achievement: tv > 0 ? Math.round((av / tv) * 100) : 0,
        },
        recent_visits: (recentVisits.results || []).map(v => ({
          id: v.id,
          visit_date: v.visit_date,
          visit_type: v.visit_type,
          visit_target_type: v.visit_type,
          status: v.status,
          check_in_time: v.check_in_time,
          check_out_time: v.check_out_time,
          customer_name: v.customer_name || '',
          individual_name: v.individual_name ? (v.individual_name + ' ' + (v.individual_surname || '')).trim() : '',
          notes: v.notes || '',
        })),
      }
    });
  } catch (error) {
    console.error('Team lead agent detail error:', error);
    return c.json({ success: false, message: 'Failed to fetch agent details' }, 500);
  }
});

// Manager: Get agents in a specific team (by team lead ID)
app.get('/api/manager/team/:teamLeadId/agents', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const teamLeadId = c.req.param('teamLeadId');
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);

    // Verify caller is a manager or admin
    const caller = await db.prepare("SELECT role FROM users WHERE id = ? AND tenant_id = ?").bind(userId, tenantId).first();
    if (!caller || !['manager', 'general_manager', 'admin', 'super_admin'].includes(caller.role)) {
      return c.json({ success: false, message: 'Access denied. Manager role required.' }, 403);
    }

    // Verify team lead exists and is under this manager (GM/admin sees all)
    const isAdmin = ['general_manager', 'admin', 'super_admin'].includes(caller.role);
    const tlQuery = isAdmin
      ? "SELECT id, first_name, last_name, phone, role FROM users WHERE id = ? AND tenant_id = ? AND role = 'team_lead' AND is_active = 1"
      : "SELECT id, first_name, last_name, phone, role FROM users WHERE id = ? AND tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND manager_id = ?";
    const tlBinds = isAdmin ? [teamLeadId, tenantId] : [teamLeadId, tenantId, userId];
    const teamLead = await db.prepare(tlQuery).bind(...tlBinds).first();
    if (!teamLead) {
      return c.json({ success: false, message: 'Team lead not found or not in your organization.' }, 404);
    }

    // Restrict to manager's own companies (admins see all)
    let mgrCompanyIds = [];
    if (!isAdmin) {
      const mgrCompaniesRes = await db.prepare("SELECT fc.id FROM manager_company_links mcl JOIN field_companies fc ON mcl.company_id = fc.id WHERE mcl.manager_id = ? AND mcl.tenant_id = ? AND mcl.is_active = 1 AND fc.status = 'active'").bind(userId, tenantId).all().catch(() => ({ results: [] }));
      mgrCompanyIds = (mgrCompaniesRes.results || []).map(c => c.id);
    }
    const mgrCFilter = mgrCompanyIds.length > 0 ? ` AND company_id IN (${mgrCompanyIds.map(() => '?').join(',')})` : '';

    // Get agents under this team lead
    const teamMembers = await db.prepare("SELECT id, first_name, last_name, phone, role, status FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1 ORDER BY first_name").bind(teamLeadId, tenantId).all();

    // Build per-agent stats
    const agentStats = [];
    for (const member of (teamMembers.results || [])) {
      const [todayV, monthV, todayR, monthR, targets, todayIndiv, monthIndiv] = await Promise.all([
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ?${mgrCFilter} AND visit_date = ?`).bind(tenantId, member.id, ...mgrCompanyIds, today).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ?${mgrCFilter} AND visit_date >= ?`).bind(tenantId, member.id, ...mgrCompanyIds, currentMonth + '-01').first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) = 'store'${mgrCFilter} AND visit_date = ?`).bind(tenantId, member.id, ...mgrCompanyIds, today).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) = 'store'${mgrCFilter} AND visit_date >= ?`).bind(tenantId, member.id, ...mgrCompanyIds, currentMonth + '-01').first(),
        db.prepare("SELECT COALESCE(SUM(target_visits),0) as target_visits, COALESCE(SUM(target_registrations),0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, member.id, currentMonth).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) != 'store'${mgrCFilter} AND visit_date = ?`).bind(tenantId, member.id, ...mgrCompanyIds, today).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) != 'store'${mgrCFilter} AND visit_date >= ?`).bind(tenantId, member.id, ...mgrCompanyIds, currentMonth + '-01').first(),
      ]);
      let tv = targets?.target_visits || 0;
      let tr = targets?.target_registrations || 0;
      if (tv === 0 && tr === 0) {
        const fb = await getUserMonthlyTargetFromRules(db, tenantId, member.id, currentMonth, 'agent');
        tv = fb.target_visits;
        tr = fb.target_registrations;
      }
      const av = monthV?.count || 0;
      const ar = monthR?.count || 0;
      agentStats.push({
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        phone: member.phone,
        role: member.role,
        today_visits: todayIndiv?.count || 0,
        month_visits: monthIndiv?.count || 0,
        today_stores: todayR?.count || 0,
        month_stores: monthR?.count || 0,
        target_visits: tv,
        actual_visits: av,
        target_stores: tr,
        actual_stores: ar,
        achievement: tv > 0 ? Math.round((av / tv) * 100) : 0,
      });
    }

    return c.json({
      success: true,
      data: {
        team_lead: {
          id: teamLead.id,
          first_name: teamLead.first_name,
          last_name: teamLead.last_name,
        },
        agents: agentStats,
      }
    });
  } catch (error) {
    console.error('Manager team agents error:', error);
    return c.json({ success: false, message: 'Failed to fetch team agents' }, 500);
  }
});

// Manager: Get a specific agent's detail + recent visits
app.get('/api/manager/agent/:agentId', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const agentId = c.req.param('agentId');
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);

    // Verify caller is a manager or admin
    const caller = await db.prepare("SELECT role FROM users WHERE id = ? AND tenant_id = ?").bind(userId, tenantId).first();
    if (!caller || !['manager', 'general_manager', 'admin', 'super_admin'].includes(caller.role)) {
      return c.json({ success: false, message: 'Access denied. Manager role required.' }, 403);
    }

    // Get agent (verify they belong to this tenant)
    const agent = await db.prepare("SELECT id, first_name, last_name, phone, role, status, team_lead_id FROM users WHERE id = ? AND tenant_id = ? AND is_active = 1").bind(agentId, tenantId).first();
    if (!agent) {
      return c.json({ success: false, message: 'Agent not found.' }, 404);
    }

    // For non-admin managers, verify agent is under one of their team leads (GM sees all)
    const isAdmin = ['general_manager', 'admin', 'super_admin'].includes(caller.role);
    if (!isAdmin) {
      if (!agent.team_lead_id) {
        return c.json({ success: false, message: 'Agent not in your organization.' }, 403);
      }
      const tl = await db.prepare("SELECT id FROM users WHERE id = ? AND tenant_id = ? AND manager_id = ?").bind(agent.team_lead_id, tenantId, userId).first();
      if (!tl) {
        return c.json({ success: false, message: 'Agent not in your organization.' }, 403);
      }
    }

    // Restrict to manager's own companies (admins see all)
    let mgrCompanyIds = [];
    if (!isAdmin) {
      const mgrCompaniesRes = await db.prepare("SELECT fc.id FROM manager_company_links mcl JOIN field_companies fc ON mcl.company_id = fc.id WHERE mcl.manager_id = ? AND mcl.tenant_id = ? AND mcl.is_active = 1 AND fc.status = 'active'").bind(userId, tenantId).all().catch(() => ({ results: [] }));
      mgrCompanyIds = (mgrCompaniesRes.results || []).map(c => c.id);
    }
    const mgrCFilter = mgrCompanyIds.length > 0 ? ` AND company_id IN (${mgrCompanyIds.map(() => '?').join(',')})` : '';

    // Get agent stats
    const [todayV, monthV, todayR, monthR, targets, todayIndiv, monthIndiv] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ?${mgrCFilter} AND visit_date = ?`).bind(tenantId, agentId, ...mgrCompanyIds, today).first(),
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ?${mgrCFilter} AND visit_date >= ?`).bind(tenantId, agentId, ...mgrCompanyIds, currentMonth + '-01').first(),
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) = 'store'${mgrCFilter} AND visit_date = ?`).bind(tenantId, agentId, ...mgrCompanyIds, today).first(),
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) = 'store'${mgrCFilter} AND visit_date >= ?`).bind(tenantId, agentId, ...mgrCompanyIds, currentMonth + '-01').first(),
      db.prepare("SELECT COALESCE(SUM(target_visits),0) as target_visits, COALESCE(SUM(target_registrations),0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, agentId, currentMonth).first(),
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) != 'store'${mgrCFilter} AND visit_date = ?`).bind(tenantId, agentId, ...mgrCompanyIds, today).first(),
      db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND agent_id = ? AND LOWER(visit_type) != 'store'${mgrCFilter} AND visit_date >= ?`).bind(tenantId, agentId, ...mgrCompanyIds, currentMonth + '-01').first(),
    ]);
    let tv = targets?.target_visits || 0;
    let tr = targets?.target_registrations || 0;
    if (tv === 0 && tr === 0) {
      const fb = await getUserMonthlyTargetFromRules(db, tenantId, agentId, currentMonth, 'agent');
      tv = fb.target_visits;
      tr = fb.target_registrations;
    }
    const av = monthV?.count || 0;
    const ar = monthR?.count || 0;

    // Get recent visits (last 50)
    const recentVisits = await db.prepare(
      `SELECT v.id, v.visit_date, v.visit_type, v.status, v.check_in_time, v.check_out_time, v.notes, v.latitude, v.longitude, v.individual_name, v.individual_surname, c.name as customer_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id WHERE v.tenant_id = ? AND v.agent_id = ?${mgrCFilter} ORDER BY v.visit_date DESC, v.check_in_time DESC LIMIT 50`
    ).bind(tenantId, agentId, ...mgrCompanyIds).all();

    // Get team lead name if assigned
    let teamLeadName = null;
    if (agent.team_lead_id) {
      const tl = await db.prepare("SELECT first_name, last_name FROM users WHERE id = ? AND tenant_id = ?").bind(agent.team_lead_id, tenantId).first();
      if (tl) teamLeadName = tl.first_name + ' ' + tl.last_name;
    }

    return c.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          first_name: agent.first_name,
          last_name: agent.last_name,
          phone: agent.phone,
          role: agent.role,
          team_lead_name: teamLeadName,
        },
        stats: {
          today_visits: todayIndiv?.count || 0,
          month_visits: monthIndiv?.count || 0,
          today_stores: todayR?.count || 0,
          month_stores: monthR?.count || 0,
          target_visits: tv,
          actual_visits: av,
          target_stores: tr,
          actual_stores: ar,
          achievement: tv > 0 ? Math.round((av / tv) * 100) : 0,
        },
        recent_visits: (recentVisits.results || []).map(v => ({
          id: v.id,
          visit_date: v.visit_date,
          visit_type: v.visit_type,
          visit_target_type: v.visit_type,
          status: v.status,
          check_in_time: v.check_in_time,
          check_out_time: v.check_out_time,
          customer_name: v.customer_name || '',
          individual_name: v.individual_name ? (v.individual_name + ' ' + (v.individual_surname || '')).trim() : '',
          notes: v.notes || '',
        })),
      }
    });
  } catch (error) {
    console.error('Manager agent detail error:', error);
    return c.json({ success: false, message: 'Failed to fetch agent details' }, 500);
  }
});

// ==================== AGENT PIN MANAGEMENT ====================

// Manager/Admin: Set or reset PIN for an agent
app.post('/api/agent/set-pin', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const requesterId = c.get('userId');
    const body = await c.req.json();
    const { agent_id, pin } = body;
    if (!agent_id || !pin) return c.json({ success: false, message: 'agent_id and pin are required' }, 400);
    if (!/^\d{4,6}$/.test(pin)) return c.json({ success: false, message: 'PIN must be 4-6 digits' }, 400);

    // Check requester has permission (admin, manager, or team_lead managing this agent)
    const requester = await db.prepare('SELECT role FROM users WHERE id = ? AND tenant_id = ?').bind(requesterId, tenantId).first();
    if (!requester) return c.json({ success: false, message: 'Unauthorized' }, 403);

    const isAdmin = ['admin', 'super_admin'].includes(requester.role);
    const isManager = requester.role === 'manager';
    const isTeamLead = requester.role === 'team_lead';

    if (!isAdmin && !isManager && !isTeamLead) {
      return c.json({ success: false, message: 'Only admins, managers, and team leads can set agent PINs' }, 403);
    }

    // Verify target user exists and has a mobile-login-capable role
    // Managers can only set PINs for agents/team_leads/field_agents/sales_reps (not other managers)
    // Only admins/super_admins can set PINs for manager-level users
    const targetQuery = isTeamLead
      ? "SELECT id FROM users WHERE id = ? AND tenant_id = ? AND role IN ('agent', 'team_lead', 'field_agent', 'sales_rep', 'manager') AND team_lead_id = ?"
      : isManager
        ? "SELECT id FROM users WHERE id = ? AND tenant_id = ? AND role IN ('agent', 'team_lead', 'field_agent', 'sales_rep')"
        : "SELECT id FROM users WHERE id = ? AND tenant_id = ? AND role IN ('agent', 'team_lead', 'field_agent', 'sales_rep', 'manager')";
    const targetBinds = isTeamLead ? [agent_id, tenantId, requesterId] : [agent_id, tenantId];
    const targetAgent = await db.prepare(targetQuery).bind(...targetBinds).first();
    if (!targetAgent) {
      return c.json({ success: false, message: isTeamLead ? 'Agent not found or not in your team' : 'Agent not found' }, 404);
    }

    const pinHash = await bcrypt.hash(pin, 10);
    await db.prepare('UPDATE users SET pin_hash = ?, updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(pinHash, agent_id, tenantId).run();

    return c.json({ success: true, message: 'PIN set successfully' });
  } catch (error) {
    console.error('Set PIN error:', error);
    return c.json({ success: false, message: 'Failed to set PIN' }, 500);
  }
});

// Agent: Change own PIN (requires current PIN)
app.post('/api/agent/change-pin', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const body = await c.req.json();
    const { current_pin, new_pin } = body;
    if (!current_pin || !new_pin) return c.json({ success: false, message: 'current_pin and new_pin are required' }, 400);
    if (!/^\d{4,6}$/.test(new_pin)) return c.json({ success: false, message: 'New PIN must be 4-6 digits' }, 400);

    const user = await db.prepare('SELECT pin_hash, password_hash FROM users WHERE id = ? AND tenant_id = ?').bind(userId, tenantId).first();
    if (!user) return c.json({ success: false, message: 'User not found' }, 404);

    const currentHash = user.pin_hash || user.password_hash;
    if (!currentHash) return c.json({ success: false, message: 'No PIN set. Contact your manager.' }, 400);

    const valid = await bcrypt.compare(current_pin, currentHash);
    if (!valid) return c.json({ success: false, message: 'Current PIN is incorrect' }, 401);

    const newHash = await bcrypt.hash(new_pin, 10);
    await db.prepare('UPDATE users SET pin_hash = ?, updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(newHash, userId, tenantId).run();

    return c.json({ success: true, message: 'PIN changed successfully' });
  } catch (error) {
    console.error('Change PIN error:', error);
    return c.json({ success: false, message: 'Failed to change PIN' }, 500);
  }
});

// Agent/TeamLead: Get visits with rejected Goldrush IDs
app.get('/api/agent/goldrush-rejected', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const role = c.get('role');

    let agentFilter;
    const binds = [tenantId];

    if (role === 'team_lead') {
      // Team leads see their own visits plus all their team members' visits
      agentFilter = `v.agent_id IN (SELECT id FROM users WHERE (id = ? OR team_lead_id = ?) AND tenant_id = ? AND is_active = 1)`;
      binds.push(userId, userId, tenantId);
    } else {
      agentFilter = `v.agent_id = ?`;
      binds.push(userId);
    }

    const result = await db.prepare(`
      SELECT v.id as visit_id, v.visit_date, v.individual_name, v.agent_id,
        JSON_EXTRACT(vi.custom_field_values, '$.goldrush_id') as goldrush_id,
        JSON_EXTRACT(vi.custom_field_values, '$.goldrush_id_rejection_reason') as rejection_reason
      FROM visits v
      JOIN visit_individuals vi ON vi.visit_id = v.id AND vi.tenant_id = v.tenant_id
      WHERE v.tenant_id = ? AND ${agentFilter}
        AND (JSON_EXTRACT(vi.custom_field_values, '$.goldrush_id_rejected') = 1
          OR JSON_EXTRACT(vi.custom_field_values, '$.goldrush_id_rejected') = 'true')
      ORDER BY v.created_at DESC
    `).bind(...binds).all();
    const data = result.results || [];
    return c.json({ success: true, data, count: data.length });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Manager/Admin: Get list of agents with PIN status
app.get('/api/agent/pin-status', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const requesterId = c.get('userId');

    const requester = await db.prepare('SELECT role FROM users WHERE id = ? AND tenant_id = ?').bind(requesterId, tenantId).first();
    if (!requester) return c.json({ success: false, message: 'Unauthorized' }, 403);

    let agents;
    if (['admin', 'super_admin', 'manager'].includes(requester.role)) {
      agents = await db.prepare("SELECT id, first_name, last_name, phone, role, pin_hash IS NOT NULL as has_pin, team_lead_id FROM users WHERE tenant_id = ? AND role IN ('agent', 'team_lead', 'field_agent', 'sales_rep') AND is_active = 1 ORDER BY first_name").bind(tenantId).all();
    } else if (requester.role === 'team_lead') {
      agents = await db.prepare("SELECT id, first_name, last_name, phone, role, pin_hash IS NOT NULL as has_pin, team_lead_id FROM users WHERE tenant_id = ? AND team_lead_id = ? AND is_active = 1 ORDER BY first_name").bind(tenantId, requesterId).all();
    } else {
      return c.json({ success: false, message: 'Unauthorized' }, 403);
    }

    return c.json({ success: true, data: agents.results || [] });
  } catch (error) {
    console.error('PIN status error:', error);
    return c.json({ success: true, data: [] });
  }
});

// ==================== AGENT SEED ENDPOINT (creates test agents with PIN) ====================
app.post('/api/admin/seed-test-agents', authMiddleware, requireSuperAdmin, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    // Default PIN: 12345
    const hashedPin = await bcrypt.hash('12345', 10);
    const hashedPassword = await bcrypt.hash('Agent@123', 10);

    const agents = [
      { id: 'agent-test-001', phone: '+27820000001', first_name: 'Sipho', last_name: 'Ndlovu', role: 'agent' },
      { id: 'agent-test-002', phone: '+27820000002', first_name: 'Thandiwe', last_name: 'Mokoena', role: 'agent' },
      { id: 'agent-test-003', phone: '+27820000003', first_name: 'Bongani', last_name: 'Dlamini', role: 'team_lead' },
      { id: 'agent-test-004', phone: '+27820000004', first_name: 'Naledi', last_name: 'Mthembu', role: 'agent' },
      { id: 'agent-test-005', phone: '+27820000005', first_name: 'Thabo', last_name: 'Khumalo', role: 'agent' },
    ];

    const results = [];
    for (const agent of agents) {
      try {
        const existing = await db.prepare('SELECT id FROM users WHERE phone = ? AND tenant_id = ?').bind(agent.phone, tenantId).first();
        if (existing) {
          await db.prepare('UPDATE users SET password_hash = ?, pin_hash = ?, is_active = 1, role = ? WHERE id = ?').bind(hashedPassword, hashedPin, agent.role, existing.id).run();
          results.push({ ...agent, status: 'updated' });
        } else {
          await db.prepare('INSERT INTO users (id, tenant_id, email, phone, password_hash, pin_hash, first_name, last_name, role, status, is_active, team_lead_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)').bind(
            agent.id, tenantId, agent.first_name.toLowerCase() + '.' + agent.last_name.toLowerCase() + '@fieldvibe.test',
            agent.phone, hashedPassword, hashedPin, agent.first_name, agent.last_name, agent.role, 'active',
            agent.role === 'agent' ? 'agent-test-003' : null
          ).run();
          results.push({ ...agent, status: 'created' });
        }
      } catch (e) {
        results.push({ ...agent, status: 'error', error: e.message });
      }
    }

    // Link agents to all active companies
    const companies = await db.prepare("SELECT id FROM field_companies WHERE tenant_id = ? AND status = 'active'").bind(tenantId).all();
    for (const agent of agents) {
      for (const company of (companies.results || [])) {
        try {
          await db.prepare('INSERT OR IGNORE INTO agent_company_links (id, agent_id, company_id, tenant_id, is_active) VALUES (?, ?, ?, ?, 1)').bind(
            'acl-' + agent.id + '-' + company.id, agent.id, company.id, tenantId
          ).run();
        } catch {}
      }
    }

    return c.json({ success: true, data: { agents: results, default_pin: '12345', message: 'Test agents created/updated. Login with phone + PIN 12345' } });
  } catch (error) {
    console.error('Seed agents error:', error);
    return c.json({ success: false, message: error.message }, 500);
  }
});

export default app;
