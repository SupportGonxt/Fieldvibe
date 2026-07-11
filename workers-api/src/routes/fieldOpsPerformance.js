import { Hono } from 'hono';
import { authMiddleware } from '../lib/middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { generateTargetsFromRules } from '../lib/calendar.js';

const app = new Hono();

// ==================== FIELD OPERATIONS: PERFORMANCE (ROLE-BASED) ====================
app.get('/field-ops/performance', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { date, start_date, end_date, company_id, period, team_lead_id } = c.req.query();
  
  // Calculate date range based on period parameter
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let startD, endD;
  
  if (period === 'day') {
    // Today only
    startD = today.toISOString().split('T')[0];
    endD = startD;
  } else if (period === 'week') {
    // Week to date (Monday to today)
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : (dayOfWeek === 1 ? 0 : 1 - dayOfWeek);
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    startD = monday.toISOString().split('T')[0];
    endD = today.toISOString().split('T')[0];
  } else if (period === 'month') {
    // Month to date (1st of current month to today)
    startD = today.toISOString().slice(0, 7) + '-01';
    endD = today.toISOString().split('T')[0];
  } else {
    // Custom date range or default to month-to-date
    startD = start_date || date || today.toISOString().slice(0, 7) + '-01';
    endD = end_date || date || today.toISOString().split('T')[0];
  }
  
  console.log(`[PERF] Query params: period=${period}, startD=${startD}, endD=${endD}, userId=${userId}, tenantId=${tenantId}, role=${role}`);

  const cWhere = company_id ? ' AND company_id = ?' : '';
  const cWhereV = company_id ? ' AND v.company_id = ?' : '';
  const cBind = company_id ? [company_id] : [];

  try {
    if (role === 'agent' || role === 'field_agent') {
      // Agent sees own performance
      const [visits, conversions, targets, individualVisits, storeVisits] = await Promise.all([
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND status = 'completed'${cWhere}`).bind(userId, tenantId, startD, endD, ...cBind).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.agent_id = ? AND v.tenant_id = ? AND (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') AND v.visit_date >= ? AND v.visit_date <= ? AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)${cWhereV}`).bind(userId, tenantId, startD, endD, ...cBind).first(),
        db.prepare("SELECT * FROM daily_targets WHERE agent_id = ? AND tenant_id = ? AND target_date = ?").bind(userId, tenantId, today.toISOString().split('T')[0]).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits v WHERE v.agent_id = ? AND v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND v.status = 'completed' AND LOWER(v.visit_type) = 'individual' AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)${cWhere.replace(/(\b)(?=company_id|status)/g, 'v.')}`).bind(userId, tenantId, startD, endD, ...cBind).first(),
        db.prepare(`SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND status = 'completed' AND LOWER(visit_type) = 'store'${cWhere}`).bind(userId, tenantId, startD, endD, ...cBind).first(),
      ]);
      
      const visitCount = visits?.count || 0;
      const indivCount = individualVisits?.count || 0;
      const storeCount = storeVisits?.count || 0;
      const convCount = conversions?.count || 0;
      
      console.log(`[PERF] Agent results: visits=${visitCount}, individuals=${indivCount}, stores=${storeCount}, convs=${convCount}`);
      
      return c.json({
        role: 'agent',
        user_id: userId,
        period: { start: startD, end: endD, type: period || 'custom' },
        visits: visitCount,
        individual_visits: indivCount,
        store_visits: storeCount,
        individuals: indivCount,
        conversions: convCount,
        targets: targets ? { visits: targets.target_visits, conversions: targets.target_conversions, individuals: targets.target_visits, stores: targets.target_registrations } : { visits: 20, conversions: 5, individuals: 10, stores: 5 },
        visit_progress: targets ? Math.round(((visitCount) / (targets.target_visits || 1)) * 100) : 0,
        conversion_rate: indivCount > 0 ? Math.round((convCount / indivCount) * 100) : 0
      });
    } else if (role === 'team_lead') {
      // Team lead sees own + team's performance
      const teamAgents = await db.prepare("SELECT id, first_name, last_name FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1").bind(userId, tenantId).all();
      const agentIds = [userId, ...(teamAgents.results || []).map(a => a.id)];
      const placeholders = agentIds.map(() => '?').join(',');
      
      const [totalVisits, totalConvs, totalIndivVisits, totalStoreVisits] = await Promise.all([
        db.prepare(`SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date BETWEEN ? AND ? AND status = 'completed' AND agent_id IN (${placeholders})${cWhere} GROUP BY agent_id`).bind(tenantId, startD, endD, ...agentIds, ...cBind).all(),
        db.prepare(`SELECT v.agent_id, COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.tenant_id = ? AND (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') AND v.visit_date >= ? AND v.visit_date <= ? AND v.agent_id IN (${placeholders}) AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)${cWhereV} GROUP BY agent_id`).bind(tenantId, startD, endD, ...agentIds, ...cBind).all(),
        db.prepare(`SELECT v.agent_id, COUNT(*) as count FROM visits v WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND v.status = 'completed' AND LOWER(v.visit_type) = 'individual' AND v.agent_id IN (${placeholders}) AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)${cWhereV} GROUP BY v.agent_id`).bind(tenantId, startD, endD, ...agentIds, ...cBind).all(),
        db.prepare(`SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date BETWEEN ? AND ? AND status = 'completed' AND LOWER(visit_type) = 'store' AND agent_id IN (${placeholders})${cWhere} GROUP BY agent_id`).bind(tenantId, startD, endD, ...agentIds, ...cBind).all(),
      ]);

      const visitMap = Object.fromEntries((totalVisits.results || []).map(r => [r.agent_id, r.count]));
      const convMap = Object.fromEntries((totalConvs.results || []).map(r => [r.agent_id, r.count]));
      const indivMap = Object.fromEntries((totalIndivVisits.results || []).map(r => [r.agent_id, r.count]));
      const storeMap = Object.fromEntries((totalStoreVisits.results || []).map(r => [r.agent_id, r.count]));
      
      // Get monthly targets for each agent
      const currentMonth = startD.substring(0, 7);
      const monthStartDate = currentMonth + '-01';
      const agentTargetMap = {};
      await Promise.all(agentIds.map(async (aid) => {
        try {
          // Try monthly_targets first
          const mt = company_id
            ? await db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ? AND company_id = ?").bind(tenantId, aid, currentMonth, company_id).first()
            : await db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, aid, currentMonth).first();
          if (mt && (mt.target_visits > 0 || mt.target_registrations > 0)) {
            agentTargetMap[aid] = { target_visits: mt.target_visits || 0, target_stores: mt.target_registrations || 0 };
          } else {
            // Fall back to company_target_rules
            const targets = await generateTargetsFromRules(db, tenantId, aid, monthStartDate, 'agent');
            const tv = targets.reduce((s, t) => s + (t.target_visits || 0), 0);
            const ts = targets.reduce((s, t) => s + (t.target_registrations || 0), 0);
            agentTargetMap[aid] = { target_visits: tv, target_stores: ts };
          }
        } catch { agentTargetMap[aid] = { target_visits: 0, target_stores: 0 }; }
      }));

      const agentPerformance = agentIds.map(aid => {
        const agent = aid === userId ? { first_name: 'You', last_name: '' } : (teamAgents.results || []).find(a => a.id === aid) || {};
        const tgt = agentTargetMap[aid] || { target_visits: 0, target_stores: 0 };
        return { 
          agent_id: aid, 
          agent_name: (agent.first_name + ' ' + agent.last_name).trim(), 
          visits: visitMap[aid] || 0, 
          individual_visits: indivMap[aid] || 0,
          store_visits: storeMap[aid] || 0,
          individuals: indivMap[aid] || 0, 
          conversions: convMap[aid] || 0,
          target_visits: tgt.target_visits,
          target_stores: tgt.target_stores
        };
      });
      
      const filteredAgentPerf = company_id ? agentPerformance.filter(a => a.visits > 0) : agentPerformance;
      const totalV = filteredAgentPerf.reduce((s, a) => s + a.visits, 0);
      const totalIV = filteredAgentPerf.reduce((s, a) => s + a.individual_visits, 0);
      const totalSV = filteredAgentPerf.reduce((s, a) => s + a.store_visits, 0);
      const totalC = filteredAgentPerf.reduce((s, a) => s + a.conversions, 0);
      const totalTV = filteredAgentPerf.reduce((s, a) => s + a.target_visits, 0);
      const totalTS = filteredAgentPerf.reduce((s, a) => s + a.target_stores, 0);

      return c.json({
        role: 'team_lead',
        user_id: userId,
        period: { start: startD, end: endD, type: period || 'custom' },
        team_size: filteredAgentPerf.length,
        total_visits: totalV,
        total_individual_visits: totalIV,
        total_store_visits: totalSV,
        total_individuals: totalIV,
        total_conversions: totalC,
        total_target_visits: totalTV,
        total_target_stores: totalTS,
        conversion_rate: totalIV > 0 ? Math.round((totalC / totalIV) * 100) : 0,
        agents: filteredAgentPerf
      });
    } else if (team_lead_id && (role === 'manager' || role === 'general_manager' || role === 'admin' || role === 'super_admin')) {
      // Manager drilling down into a specific team lead's agents
      const teamAgents = await db.prepare("SELECT id, first_name, last_name FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1").bind(team_lead_id, tenantId).all();
      const agentIds = [team_lead_id, ...(teamAgents.results || []).map(a => a.id)];
      const placeholders = agentIds.map(() => '?').join(',');

      // agentIds already scopes to this team; no company_id filter on visits (handles NULL company_id for Goldrush)
      const [totalVisits, totalConvs, totalIndivVisits, totalStoreVisits] = await Promise.all([
        db.prepare(`SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date BETWEEN ? AND ? AND status = 'completed' AND agent_id IN (${placeholders}) GROUP BY agent_id`).bind(tenantId, startD, endD, ...agentIds).all(),
        db.prepare(`SELECT v.agent_id, COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.tenant_id = ? AND (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') AND v.visit_date >= ? AND v.visit_date <= ? AND v.agent_id IN (${placeholders}) AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) GROUP BY agent_id`).bind(tenantId, startD, endD, ...agentIds).all(),
        db.prepare(`SELECT v.agent_id, COUNT(*) as count FROM visits v WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND v.status = 'completed' AND LOWER(v.visit_type) = 'individual' AND v.agent_id IN (${placeholders}) AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) GROUP BY v.agent_id`).bind(tenantId, startD, endD, ...agentIds).all(),
        db.prepare(`SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date BETWEEN ? AND ? AND status = 'completed' AND LOWER(visit_type) = 'store' AND agent_id IN (${placeholders}) GROUP BY agent_id`).bind(tenantId, startD, endD, ...agentIds).all(),
      ]);

      const visitMap = Object.fromEntries((totalVisits.results || []).map(r => [r.agent_id, r.count]));
      const convMap = Object.fromEntries((totalConvs.results || []).map(r => [r.agent_id, r.count]));
      const indivMap = Object.fromEntries((totalIndivVisits.results || []).map(r => [r.agent_id, r.count]));
      const storeMap = Object.fromEntries((totalStoreVisits.results || []).map(r => [r.agent_id, r.count]));

      const currentMonth = startD.substring(0, 7);
      const monthStartDate = currentMonth + '-01';
      const agentTargetMap = {};
      await Promise.all(agentIds.map(async (aid) => {
        try {
          const mt = company_id
            ? await db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ? AND company_id = ?").bind(tenantId, aid, currentMonth, company_id).first()
            : await db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, aid, currentMonth).first();
          if (mt && (mt.target_visits > 0 || mt.target_registrations > 0)) {
            agentTargetMap[aid] = { target_visits: mt.target_visits || 0, target_stores: mt.target_registrations || 0 };
          } else {
            const targets = await generateTargetsFromRules(db, tenantId, aid, monthStartDate, 'agent');
            const tv = targets.reduce((s, t) => s + (t.target_visits || 0), 0);
            const ts = targets.reduce((s, t) => s + (t.target_registrations || 0), 0);
            agentTargetMap[aid] = { target_visits: tv, target_stores: ts };
          }
        } catch { agentTargetMap[aid] = { target_visits: 0, target_stores: 0 }; }
      }));

      const tlInfo = await db.prepare("SELECT first_name, last_name FROM users WHERE id = ? AND tenant_id = ?").bind(team_lead_id, tenantId).first();
      const agentPerformance = agentIds.map(aid => {
        const agent = aid === team_lead_id ? (tlInfo || { first_name: 'Team Lead', last_name: '' }) : (teamAgents.results || []).find(a => a.id === aid) || {};
        const tgt = agentTargetMap[aid] || { target_visits: 0, target_stores: 0 };
        return { 
          agent_id: aid, 
          agent_name: (agent.first_name + ' ' + agent.last_name).trim(), 
          visits: visitMap[aid] || 0, 
          individual_visits: indivMap[aid] || 0,
          store_visits: storeMap[aid] || 0,
          individuals: indivMap[aid] || 0, 
          conversions: convMap[aid] || 0,
          target_visits: tgt.target_visits,
          target_stores: tgt.target_stores
        };
      });
      
      return c.json({ 
        role: 'manager_drilldown', 
        team_lead_id,
        period: { start: startD, end: endD, type: period || 'custom' },
        team_size: agentIds.length, 
        agents: agentPerformance 
      });
    } else {
      // Manager sees all teams
      const EXCLUDED_TL_IDS = "'5a47959c-9f93-45d2-a03f-783064817165','49554b57-c6e4-422b-91aa-fb6e5d66c9d9','f0669dd7-9fb1-4595-a94c-f108cfe402b5'";
      const allTeamLeads = await db.prepare(`SELECT id, first_name, last_name FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND id NOT IN (${EXCLUDED_TL_IDS}) AND email != 'luke.templeman@gonxt.tech'`).bind(tenantId).all();
      const allAgents = await db.prepare(`SELECT id, first_name, last_name, team_lead_id FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent') AND is_active = 1 AND (team_lead_id IS NULL OR team_lead_id NOT IN (${EXCLUDED_TL_IDS})) AND email != 'luke.templeman@gonxt.tech'`).bind(tenantId).all();

      // When company_id is set, resolve members via agent_company_links (handles companies
      // whose visits were recorded without visits.company_id, e.g. Goldrush).
      let companyUserIds = null;
      if (company_id) {
        const companyLinks = await db.prepare(
          "SELECT agent_id FROM agent_company_links WHERE tenant_id = ? AND company_id = ? AND is_active = 1"
        ).bind(tenantId, company_id).all();
        companyUserIds = new Set((companyLinks.results || []).map(r => r.agent_id));
      }
      const teamLeadsToUse = companyUserIds
        ? (allTeamLeads.results || []).filter(tl => companyUserIds.has(tl.id))
        : (allTeamLeads.results || []);
      const agentsToUse = companyUserIds
        ? (allAgents.results || []).filter(a => companyUserIds.has(a.id))
        : (allAgents.results || []);

      // Fetch visit counts for all agents (no company_id filter on visits — company scoping
      // is handled above via agent_company_links so we don't miss NULL company_id rows).
      const [allVisits, allConvs, allIndivVisits, allStoreVisits] = await Promise.all([
        db.prepare(`SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date BETWEEN ? AND ? AND status = 'completed' GROUP BY agent_id`).bind(tenantId, startD, endD).all(),
        db.prepare(`SELECT v.agent_id, COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.tenant_id = ? AND (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') AND v.visit_date >= ? AND v.visit_date <= ? AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) GROUP BY v.agent_id`).bind(tenantId, startD, endD).all(),
        db.prepare(`SELECT v.agent_id, COUNT(*) as count FROM visits v WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND v.status = 'completed' AND LOWER(v.visit_type) = 'individual' AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) GROUP BY v.agent_id`).bind(tenantId, startD, endD).all(),
        db.prepare(`SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date BETWEEN ? AND ? AND status = 'completed' AND LOWER(visit_type) = 'store' GROUP BY agent_id`).bind(tenantId, startD, endD).all(),
      ]);

      const vMap = Object.fromEntries((allVisits.results || []).map(r => [r.agent_id, r.count]));
      const cMap = Object.fromEntries((allConvs.results || []).map(r => [r.agent_id, r.count]));
      const iMap = Object.fromEntries((allIndivVisits.results || []).map(r => [r.agent_id, r.count]));
      const sMap = Object.fromEntries((allStoreVisits.results || []).map(r => [r.agent_id, r.count]));

      // Get monthly targets for all relevant users
      const currentMonth = startD.substring(0, 7);
      const monthStartDate = currentMonth + '-01';
      const allUserIds = [...teamLeadsToUse.map(tl => tl.id), ...agentsToUse.map(a => a.id)];
      const agentTargetMap = {};
      await Promise.all(allUserIds.map(async (aid) => {
        try {
          const mt = company_id
            ? await db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ? AND company_id = ?").bind(tenantId, aid, currentMonth, company_id).first()
            : await db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, aid, currentMonth).first();
          if (mt && (mt.target_visits > 0 || mt.target_registrations > 0)) {
            agentTargetMap[aid] = { target_visits: mt.target_visits || 0, target_stores: mt.target_registrations || 0 };
          } else {
            const targets = await generateTargetsFromRules(db, tenantId, aid, monthStartDate, 'agent');
            const tv = targets.reduce((s, t) => s + (t.target_visits || 0), 0);
            const ts = targets.reduce((s, t) => s + (t.target_registrations || 0), 0);
            agentTargetMap[aid] = { target_visits: tv, target_stores: ts };
          }
        } catch { agentTargetMap[aid] = { target_visits: 0, target_stores: 0 }; }
      }));

      const teams = teamLeadsToUse.map(tl => {
        const teamAgts = agentsToUse.filter(a => a.team_lead_id === tl.id);
        const allIds = [tl.id, ...teamAgts.map(a => a.id)];
        const tVisits = allIds.reduce((s, id) => s + (vMap[id] || 0), 0);
        const tIndiv = allIds.reduce((s, id) => s + (iMap[id] || 0), 0);
        const tStore = allIds.reduce((s, id) => s + (sMap[id] || 0), 0);
        const tConvs = allIds.reduce((s, id) => s + (cMap[id] || 0), 0);
        const tTargetV = allIds.reduce((s, id) => s + ((agentTargetMap[id] || {}).target_visits || 0), 0);
        const tTargetS = allIds.reduce((s, id) => s + ((agentTargetMap[id] || {}).target_stores || 0), 0);
        return {
          team_lead_id: tl.id,
          team_lead_name: tl.first_name + ' ' + tl.last_name,
          agent_count: teamAgts.length,
          visits: tVisits,
          individual_visits: tIndiv,
          store_visits: tStore,
          individuals: tIndiv,
          conversions: tConvs,
          target_visits: tTargetV,
          target_stores: tTargetS,
          conversion_rate: tIndiv > 0 ? Math.round((tConvs / tIndiv) * 100) : 0
        };
      });

      const filteredTeams = teams;
      const grandVisits = filteredTeams.reduce((s, t) => s + t.visits, 0);
      const grandIndiv = filteredTeams.reduce((s, t) => s + t.individual_visits, 0);
      const grandStore = filteredTeams.reduce((s, t) => s + t.store_visits, 0);
      const grandConvs = filteredTeams.reduce((s, t) => s + t.conversions, 0);
      const grandTargetV = filteredTeams.reduce((s, t) => s + t.target_visits, 0);
      const grandTargetS = filteredTeams.reduce((s, t) => s + t.target_stores, 0);

      return c.json({
        role: 'manager',
        period: { start: startD, end: endD, type: period || 'custom' },
        total_team_leads: filteredTeams.length,
        total_agents: filteredTeams.reduce((s, t) => s + t.agent_count, 0),
        total_visits: grandVisits,
        total_individual_visits: grandIndiv,
        total_store_visits: grandStore,
        total_individuals: grandIndiv,
        total_conversions: grandConvs,
        total_target_visits: grandTargetV,
        total_target_stores: grandTargetS,
        conversion_rate: grandIndiv > 0 ? Math.round((grandConvs / grandIndiv) * 100) : 0,
        teams: filteredTeams
      });
    }
  } catch (e) {
    console.error('Field-ops performance error:', e);
    return c.json({ error: e.message, role, visits: 0, individuals: 0, conversions: 0, targets: {} });
  }
});

// ==================== FIELD OPERATIONS: PERFORMANCE EXPORT ====================
app.get('/field-ops/performance/export', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { period, start_date, end_date } = c.req.query();
  
  // Calculate date range based on period parameter
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let startD, endD;
  
  if (period === 'day') {
    startD = today.toISOString().split('T')[0];
    endD = startD;
  } else if (period === 'week') {
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : (dayOfWeek === 1 ? 0 : 1 - dayOfWeek);
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    startD = monday.toISOString().split('T')[0];
    endD = today.toISOString().split('T')[0];
  } else if (period === 'month') {
    startD = today.toISOString().slice(0, 7) + '-01';
    endD = today.toISOString().split('T')[0];
  } else {
    startD = start_date || today.toISOString().split('T')[0];
    endD = end_date || startD;
  }
  
  try {
    let data = [];
    let headers = [];
    
    if (role === 'agent' || role === 'field_agent') {
      headers = ['Metric', 'Value', 'Target', 'Achievement %'];
      const [visits, conversions, targets, individualVisits, storeVisits] = await Promise.all([
        db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ?").bind(userId, tenantId, startD, endD).first(),
        db.prepare("SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.agent_id = ? AND v.tenant_id = ? AND (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') AND v.visit_date >= ? AND v.visit_date <= ?").bind(userId, tenantId, startD, endD).first(),
        db.prepare("SELECT * FROM daily_targets WHERE agent_id = ? AND tenant_id = ? AND target_date = ?").bind(userId, tenantId, today.toISOString().split('T')[0]).first(),
        db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'individual'").bind(userId, tenantId, startD, endD).first(),
        db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'store'").bind(userId, tenantId, startD, endD).first()
      ]);
      
      const visitCount = visits?.count || 0;
      const indivCount = individualVisits?.count || 0;
      const storeCount = storeVisits?.count || 0;
      const convCount = conversions?.count || 0;
      // target_visits = individual monthly target, target_registrations = store monthly target
      // (column names are legacy; see generateTargetsFromRules/buildFallbackMonthlyTargets)
      const targetIndivs = targets?.target_visits || 20;
      const targetStores = targets?.target_registrations || 10;
      const targetConvs = targets?.target_conversions || 5;
      
      data = [
        ['Visits', visitCount, targetIndivs + targetStores, (targetIndivs + targetStores) > 0 ? Math.round((visitCount / (targetIndivs + targetStores)) * 100) + '%' : 'N/A'],
        ['Individual Visits', indivCount, targetIndivs, targetIndivs > 0 ? Math.round((indivCount / targetIndivs) * 100) + '%' : 'N/A'],
        ['Store Visits', storeCount, targetStores, targetStores > 0 ? Math.round((storeCount / targetStores) * 100) + '%' : 'N/A']
      ];
      
      // Add drilldown details for agent
      data.push([]); // Empty row
      data.push(['--- Visit Details ---']);
      const visitDetails = await db.prepare("SELECT v.visit_date, v.visit_type, v.status, c.name as customer_name, v.individual_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id WHERE v.agent_id = ? AND v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? ORDER BY v.visit_date DESC LIMIT 50").bind(userId, tenantId, startD, endD).all();
      headers = ['Metric', 'Value', 'Target', 'Achievement %', 'Date', 'Type', 'Customer/Individual'];
      for (const v of (visitDetails.results || [])) {
        data.push(['Visit', v.visit_date, '', '', v.visit_date, v.visit_type || 'N/A', v.customer_name || v.individual_name || 'N/A']);
      }
      
      data.push([]); // Empty row
      data.push(['--- Individual Details ---']);
      const regDetails = await db.prepare("SELECT v.created_at, i.first_name, i.last_name, i.phone, (CASE WHEN (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') THEN 1 ELSE 0 END) as converted, fc.name as company_name FROM visits v LEFT JOIN visit_individuals vi ON v.id = vi.visit_id LEFT JOIN individuals i ON vi.individual_id = i.id LEFT JOIN field_companies fc ON v.company_id = fc.id WHERE v.agent_id = ? AND v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND v.visit_date >= ? AND v.visit_date <= ? AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) ORDER BY v.created_at DESC LIMIT 50").bind(userId, tenantId, startD, endD).all();
      for (const r of (regDetails.results || [])) {
        data.push(['Individual', r.created_at, '', '', r.created_at, r.converted ? 'Converted' : 'Pending', `${r.first_name} ${r.last_name} (${r.company_name || 'N/A'})`]);
      }
      
    } else if (role === 'team_lead') {
      headers = ['Agent', 'Visits', 'Individual', 'Store', 'Target (Indiv)', 'Target (Store)'];
      const teamAgents = await db.prepare("SELECT id, first_name, last_name FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1").bind(userId, tenantId).all();
      const agentIds = [userId, ...(teamAgents.results || []).map(a => a.id)];
      const placeholders = agentIds.map(() => '?').join(',');
      
      const [totalVisits, totalIndivVisits, totalStoreVisits] = await Promise.all([
        db.prepare("SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date BETWEEN ? AND ? AND agent_id IN (" + placeholders + ") GROUP BY agent_id").bind(tenantId, startD, endD, ...agentIds).all(),
        db.prepare("SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) = 'individual' AND visit_date >= ? AND visit_date <= ? AND agent_id IN (" + placeholders + ") GROUP BY agent_id").bind(tenantId, startD, endD, ...agentIds).all(),
        db.prepare("SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) = 'store' AND visit_date >= ? AND visit_date <= ? AND agent_id IN (" + placeholders + ") GROUP BY agent_id").bind(tenantId, startD, endD, ...agentIds).all()
      ]);
      
      const visitMap = Object.fromEntries((totalVisits.results || []).map(r => [r.agent_id, r.count]));
      const indivMap = Object.fromEntries((totalIndivVisits.results || []).map(r => [r.agent_id, r.count]));
      const storeMap = Object.fromEntries((totalStoreVisits.results || []).map(r => [r.agent_id, r.count]));
      
      // Get monthly targets for each agent
      const currentMonth = startD.substring(0, 7);
      const monthStartDate = currentMonth + '-01';
      const agentTargetMap = {};
      await Promise.all(agentIds.map(async (aid) => {
        try {
          const mt = company_id
            ? await db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ? AND company_id = ?").bind(tenantId, aid, currentMonth, company_id).first()
            : await db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, aid, currentMonth).first();
          if (mt && (mt.target_visits > 0 || mt.target_registrations > 0)) {
            agentTargetMap[aid] = { target_visits: mt.target_visits || 0, target_stores: mt.target_registrations || 0 };
          } else {
            const targets = await generateTargetsFromRules(db, tenantId, aid, monthStartDate, 'agent');
            const tv = targets.reduce((s, t) => s + (t.target_visits || 0), 0);
            const ts = targets.reduce((s, t) => s + (t.target_registrations || 0), 0);
            agentTargetMap[aid] = { target_visits: tv, target_stores: ts };
          }
        } catch { agentTargetMap[aid] = { target_visits: 0, target_stores: 0 }; }
      }));

      data = agentIds.map(aid => {
        const agent = aid === userId ? { first_name: 'You', last_name: '' } : (teamAgents.results || []).find(a => a.id === aid) || {};
        const v = visitMap[aid] || 0;
        const i = indivMap[aid] || 0;
        const s = storeMap[aid] || 0;
        const tgt = agentTargetMap[aid] || { target_visits: 0, target_stores: 0 };
        return [(agent.first_name + ' ' + agent.last_name).trim(), v, i, s, tgt.target_visits, tgt.target_stores];
      });
      
      // Add drilldown: detailed individual list for all agents
      data.push([]); // Empty row
      data.push(['--- Detailed Individuals (All Agents) ---']);
      const allRegDetails = await db.prepare("SELECT v.created_at, i.first_name, i.last_name, i.phone, (CASE WHEN (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') THEN 1 ELSE 0 END) as converted, u.first_name || ' ' || u.last_name as agent_name, fc.name as company_name FROM visits v LEFT JOIN visit_individuals vi ON v.id = vi.visit_id LEFT JOIN individuals i ON vi.individual_id = i.id LEFT JOIN users u ON v.agent_id = u.id LEFT JOIN field_companies fc ON v.company_id = fc.id WHERE v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND v.agent_id IN (" + placeholders + ") AND v.visit_date >= ? AND v.visit_date <= ? AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) ORDER BY v.created_at DESC LIMIT 100").bind(tenantId, ...agentIds, startD, endD).all();
      data.push(['Date', 'Agent', 'Name', 'Phone', 'Status', 'Company']);
      for (const r of (allRegDetails.results || [])) {
        data.push([r.created_at, r.agent_name, `${r.first_name} ${r.last_name}`, r.phone || '', r.converted ? 'Converted' : 'Pending', r.company_name || 'N/A']);
      }
      
    } else {
      headers = ['Team Lead', 'Agents', 'Visits', 'Individual', 'Store', 'Target (Indiv)', 'Target (Store)'];
      const allTeamLeads = await db.prepare("SELECT id, first_name, last_name FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1").bind(tenantId).all();
      const allAgents = await db.prepare("SELECT id, first_name, last_name, team_lead_id FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent') AND is_active = 1").bind(tenantId).all();
      
      const [allVisits, allIndivVisits, allStoreVisits] = await Promise.all([
        db.prepare("SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date BETWEEN ? AND ? GROUP BY agent_id").bind(tenantId, startD, endD).all(),
        db.prepare("SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) = 'individual' AND visit_date >= ? AND visit_date <= ? GROUP BY agent_id").bind(tenantId, startD, endD).all(),
        db.prepare("SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) = 'store' AND visit_date >= ? AND visit_date <= ? GROUP BY agent_id").bind(tenantId, startD, endD).all()
      ]);
      
      const vMap = Object.fromEntries((allVisits.results || []).map(r => [r.agent_id, r.count]));
      const iMap = Object.fromEntries((allIndivVisits.results || []).map(r => [r.agent_id, r.count]));
      const sMap = Object.fromEntries((allStoreVisits.results || []).map(r => [r.agent_id, r.count]));
      
      // Get monthly targets for all users
      const currentMonth = startD.substring(0, 7);
      const monthStartDate = currentMonth + '-01';
      const allAgentIds = (allAgents.results || []).map(a => a.id);
      const allTlIds = (allTeamLeads.results || []).map(tl => tl.id);
      const allUserIds = [...allTlIds, ...allAgentIds];
      const agentTargetMap = {};
      await Promise.all(allUserIds.map(async (aid) => {
        try {
          const mt = company_id
            ? await db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ? AND company_id = ?").bind(tenantId, aid, currentMonth, company_id).first()
            : await db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, aid, currentMonth).first();
          if (mt && (mt.target_visits > 0 || mt.target_registrations > 0)) {
            agentTargetMap[aid] = { target_visits: mt.target_visits || 0, target_stores: mt.target_registrations || 0 };
          } else {
            const targets = await generateTargetsFromRules(db, tenantId, aid, monthStartDate, 'agent');
            const tv = targets.reduce((s, t) => s + (t.target_visits || 0), 0);
            const ts = targets.reduce((s, t) => s + (t.target_registrations || 0), 0);
            agentTargetMap[aid] = { target_visits: tv, target_stores: ts };
          }
        } catch { agentTargetMap[aid] = { target_visits: 0, target_stores: 0 }; }
      }));

      data = (allTeamLeads.results || []).map(tl => {
        const teamAgts = (allAgents.results || []).filter(a => a.team_lead_id === tl.id);
        const allIds = [tl.id, ...teamAgts.map(a => a.id)];
        const tVisits = allIds.reduce((s, id) => s + (vMap[id] || 0), 0);
        const tIndivs = allIds.reduce((s, id) => s + (iMap[id] || 0), 0);
        const tStores = allIds.reduce((s, id) => s + (sMap[id] || 0), 0);
        const tTargetV = allIds.reduce((s, id) => s + ((agentTargetMap[id] || {}).target_visits || 0), 0);
        const tTargetS = allIds.reduce((s, id) => s + ((agentTargetMap[id] || {}).target_stores || 0), 0);
        return [tl.first_name + ' ' + tl.last_name, teamAgts.length, tVisits, tIndivs, tStores, tTargetV, tTargetS, '', '', '', '', '', ''];
      });
      
      // Add drilldown: team breakdown with agent details
      data.push([]); // Empty row
      data.push(['--- Team Breakdown with Agent Details ---']);
      headers = ['Team Lead', 'Agents', 'Visits', 'Individual', 'Store', 'Target (Indiv)', 'Target (Store)', 'Agent Name', 'Agent Visits', 'Agent Individual', 'Agent Store', 'Agent Target (Indiv)', 'Agent Target (Store)'];
      for (const tl of (allTeamLeads.results || [])) {
        const teamAgts = (allAgents.results || []).filter(a => a.team_lead_id === tl.id);
        const allIds = [tl.id, ...teamAgts.map(a => a.id)];
        const tVisits = allIds.reduce((s, id) => s + (vMap[id] || 0), 0);
        const tIndivs = allIds.reduce((s, id) => s + (iMap[id] || 0), 0);
        const tStores = allIds.reduce((s, id) => s + (sMap[id] || 0), 0);
        const tTargetV = allIds.reduce((s, id) => s + ((agentTargetMap[id] || {}).target_visits || 0), 0);
        const tTargetS = allIds.reduce((s, id) => s + ((agentTargetMap[id] || {}).target_stores || 0), 0);
        for (const agent of teamAgts) {
          const aVisits = vMap[agent.id] || 0;
          const aIndivs = iMap[agent.id] || 0;
          const aStores = sMap[agent.id] || 0;
          const aTgt = agentTargetMap[agent.id] || { target_visits: 0, target_stores: 0 };
          data.push([tl.first_name + ' ' + tl.last_name, teamAgts.length, tVisits, tIndivs, tStores, tTargetV, tTargetS, agent.first_name + ' ' + agent.last_name, aVisits, aIndivs, aStores, aTgt.target_visits, aTgt.target_stores]);
        }
      }
    }
    
    // Build CSV with BOM for Excel compatibility
    const periodLabel = period === 'day' ? 'Day' : period === 'week' ? 'Week to Date' : period === 'month' ? 'Month to Date' : 'Custom Period';
    const escapeCsv = (val) => { const s = String(val ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...data.map(row => {
        if (row.length === 0) return '';
        if (row.length === 1 && String(row[0]).startsWith('---')) return escapeCsv(String(row[0]).replace(/---/g, '').trim());
        return row.map(escapeCsv).join(',');
      })
    ];
    const BOM = '\uFEFF';
    return new Response(BOM + csvLines.join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="field-ops-performance-${periodLabel.replace(/\s/g, '-')}-${startD}-to-${endD}.csv"` }
    });
  } catch (e) {
    console.error('Performance export error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// ==================== TINY ZIP UTILITY FOR XLSX GENERATION ====================
function tinyZip(files) {
  const crc32Table = (() => {
    const tbl = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      tbl[n] = c;
    }
    return tbl;
  })();
  function crc32(arr) {
    let crc = -1;
    for (let i = 0; i < arr.length; i++) crc = (crc >>> 8) ^ crc32Table[(crc ^ arr[i]) & 0xFF];
    return (crc ^ (-1)) >>> 0;
  }
  function putU32(arr, off, ...vals) { const dv = new DataView(arr.buffer); vals.forEach((v, i) => dv.setUint32(off + i * 4, v, true)); }
  function putU16(arr, off, ...vals) { const dv = new DataView(arr.buffer); vals.forEach((v, i) => dv.setUint16(off + i * 2, v, true)); }
  const te = new TextEncoder();
  const records = [];
  let offset = 0, cdSz = 0;
  files.forEach(file => {
    const fname = te.encode(file.name);
    const data = typeof file.data === 'string' ? te.encode(file.data) : file.data;
    const chk = crc32(data);
    const fh = new Uint8Array(30 + fname.length);
    putU32(fh, 0, 0x04034b50); putU16(fh, 4, 20); putU32(fh, 14, chk, data.length, data.length); putU16(fh, 26, fname.length);
    fh.set(fname, 30);
    file._header = fh; file._data = data; file._offset = offset;
    records.push(fh); records.push(data);
    const cdr = new Uint8Array(46 + fname.length);
    putU32(cdr, 0, 0x02014b50); putU16(cdr, 4, 20, 20); putU32(cdr, 16, chk, data.length, data.length); putU16(cdr, 28, fname.length); putU32(cdr, 42, offset);
    cdr.set(fname, 46);
    file._cdr = cdr;
    cdSz += cdr.length;
    offset += fh.length + data.length;
  });
  files.forEach(f => records.push(f._cdr));
  const eocd = new Uint8Array(22);
  putU32(eocd, 0, 0x06054b50); putU16(eocd, 8, files.length, files.length); putU32(eocd, 12, cdSz, offset);
  records.push(eocd);
  let totalLen = 0;
  records.forEach(r => totalLen += r.length);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  records.forEach(r => { out.set(r, pos); pos += r.length; });
  return out;
}

// ==================== FIELD OPERATIONS: MULTI-SHEET EXCEL EXPORT (.xlsx) ====================
app.get('/field-ops/performance/export-excel', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  // Only managers and admins can export the full org-wide multi-sheet report
  if (role !== 'manager' && role !== 'admin' && role !== 'super_admin') {
    return c.json({ error: 'Only managers can export the multi-sheet performance report' }, 403);
  }
  const { period, start_date, end_date, company_id } = c.req.query();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let startD, endD;
  if (period === 'day') { startD = today.toISOString().split('T')[0]; endD = startD; }
  else if (period === 'week') { const dow = today.getDay(); const diff = dow === 0 ? -6 : (dow === 1 ? 0 : 1 - dow); const mon = new Date(today); mon.setDate(today.getDate() + diff); startD = mon.toISOString().split('T')[0]; endD = today.toISOString().split('T')[0]; }
  else if (period === 'month') { startD = today.toISOString().slice(0, 7) + '-01'; endD = today.toISOString().split('T')[0]; }
  else { startD = start_date || today.toISOString().split('T')[0]; endD = end_date || startD; }
  try {
    const escXml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    // Fetch all managers, team leads, agents
    const EXCLUDED_TL_IDS = "'5a47959c-9f93-45d2-a03f-783064817165','49554b57-c6e4-422b-91aa-fb6e5d66c9d9','f0669dd7-9fb1-4595-a94c-f108cfe402b5'";
    const EXCLUDED_MGR_IDS = "'619a2943-861c-4da5-9c13-6ca7c4736e4e','2dced2a8-ed77-4e7c-8d7b-cfa09cf1b14f'";
    const allManagers = await db.prepare(`SELECT id, first_name, last_name FROM users WHERE tenant_id = ? AND role = 'manager' AND is_active = 1 AND id NOT IN (${EXCLUDED_MGR_IDS})`).bind(tenantId).all();
    const allTeamLeads = await db.prepare(`SELECT id, first_name, last_name, manager_id FROM users WHERE tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND id NOT IN (${EXCLUDED_TL_IDS}) AND email != 'luke.templeman@gonxt.tech'`).bind(tenantId).all();
    const allAgents = await db.prepare(`SELECT id, first_name, last_name, team_lead_id, manager_id FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent') AND is_active = 1 AND (team_lead_id IS NULL OR team_lead_id NOT IN (${EXCLUDED_TL_IDS})) AND email != 'luke.templeman@gonxt.tech'`).bind(tenantId).all();
    // Scope to company via agent_company_links (handles companies whose visits lack company_id)
    let exportCompanyUserIds = null;
    if (company_id) {
      const companyLinks = await db.prepare(
        "SELECT agent_id FROM agent_company_links WHERE tenant_id = ? AND company_id = ? AND is_active = 1"
      ).bind(tenantId, company_id).all();
      exportCompanyUserIds = new Set((companyLinks.results || []).map(r => r.agent_id));
    }
    const filteredAgentResults = exportCompanyUserIds
      ? (allAgents.results || []).filter(a => exportCompanyUserIds.has(a.id))
      : (allAgents.results || []);
    const filteredTeamLeadResults = exportCompanyUserIds
      ? (allTeamLeads.results || []).filter(tl => exportCompanyUserIds.has(tl.id))
      : (allTeamLeads.results || []);
    const [allVisits, allIndivV, allStoreV] = await Promise.all([
      db.prepare(`SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date BETWEEN ? AND ? GROUP BY agent_id`).bind(tenantId, startD, endD).all(),
      db.prepare(`SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) = 'individual' AND visit_date BETWEEN ? AND ? GROUP BY agent_id`).bind(tenantId, startD, endD).all(),
      db.prepare(`SELECT agent_id, COUNT(*) as count FROM visits WHERE tenant_id = ? AND LOWER(visit_type) = 'store' AND visit_date BETWEEN ? AND ? GROUP BY agent_id`).bind(tenantId, startD, endD).all()
    ]);
    const vMap = Object.fromEntries((allVisits.results || []).map(r => [r.agent_id, r.count]));
    const iMap = Object.fromEntries((allIndivV.results || []).map(r => [r.agent_id, r.count]));
    const sMap = Object.fromEntries((allStoreV.results || []).map(r => [r.agent_id, r.count]));
    const sumIds = (ids) => {
      let v=0, i=0, s=0;
      for (const id of ids) { v += vMap[id]||0; i += iMap[id]||0; s += sMap[id]||0; }
      return { visits: v, individual: i, store: s };
    };
    // Get monthly targets for all users
    const currentMonth = startD.substring(0, 7);
    const monthStartDate = currentMonth + '-01';
    const allUserIds = [...(allManagers.results||[]).map(m=>m.id), ...(allTeamLeads.results||[]).map(t=>t.id), ...filteredAgentResults.map(a=>a.id)];
    const xlTargetMap = {};
    await Promise.all(allUserIds.map(async (aid) => {
      try {
        const mt = company_id
          ? await db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ? AND company_id = ?").bind(tenantId, aid, currentMonth, company_id).first()
          : await db.prepare("SELECT COALESCE(SUM(target_visits), 0) as target_visits, COALESCE(SUM(target_registrations), 0) as target_registrations FROM monthly_targets WHERE tenant_id = ? AND agent_id = ? AND target_month = ?").bind(tenantId, aid, currentMonth).first();
        if (mt && (mt.target_visits > 0 || mt.target_registrations > 0)) {
          xlTargetMap[aid] = { target_visits: mt.target_visits || 0, target_stores: mt.target_registrations || 0 };
        } else {
          const targets = await generateTargetsFromRules(db, tenantId, aid, monthStartDate, 'agent');
          const tv = targets.reduce((s, t) => s + (t.target_visits || 0), 0);
          const ts = targets.reduce((s, t) => s + (t.target_registrations || 0), 0);
          xlTargetMap[aid] = { target_visits: tv, target_stores: ts };
        }
      } catch { xlTargetMap[aid] = { target_visits: 0, target_stores: 0 }; }
    }));
    const sumTargets = (ids) => {
      let tv=0, ts=0;
      for (const id of ids) { tv += (xlTargetMap[id]||{}).target_visits||0; ts += (xlTargetMap[id]||{}).target_stores||0; }
      return { target_visits: tv, target_stores: ts };
    };
    // Build hierarchy using filtered agents and team leads only
    // A team lead is included if they are in the company filter, or if they manage at least one filtered agent
    const filteredAgentSet = new Set(filteredAgentResults.map(a => a.id));
    const effectiveTLResults = exportCompanyUserIds
      ? (allTeamLeads.results || []).filter(tl =>
          exportCompanyUserIds.has(tl.id) ||
          filteredAgentResults.some(a => a.team_lead_id === tl.id)
        )
      : (allTeamLeads.results || []);
    const effectiveTLSet = new Set(effectiveTLResults.map(tl => tl.id));
    const managers = (allManagers.results || []).map(m => {
      const tls = effectiveTLResults.filter(t => t.manager_id === m.id);
      const directAgents = filteredAgentResults.filter(a => a.manager_id === m.id && (!a.team_lead_id || a.team_lead_id === ''));
      const allMgrIds = [];
      // Only include manager's own visits if they are in the company filter
      if (!exportCompanyUserIds || exportCompanyUserIds.has(m.id)) allMgrIds.push(m.id);
      const teamLeads = tls.map(tl => {
        const agents = filteredAgentResults.filter(a => a.team_lead_id === tl.id);
        // Include TL's own visits only if TL is in the company filter
        const tlIds = [...(exportCompanyUserIds && !exportCompanyUserIds.has(tl.id) ? [] : [tl.id]), ...agents.map(a => a.id)];
        allMgrIds.push(...tlIds);
        return { ...tl, name: tl.first_name + ' ' + tl.last_name, agents: agents.map(a => ({ ...a, name: a.first_name + ' ' + a.last_name, ...sumIds([a.id]), ...sumTargets([a.id]) })), ...sumIds(tlIds), ...sumTargets(tlIds) };
      });
      allMgrIds.push(...directAgents.map(a => a.id));
      const dAgents = directAgents.map(a => ({ ...a, name: a.first_name + ' ' + a.last_name, ...sumIds([a.id]), ...sumTargets([a.id]) }));
      return { ...m, name: m.first_name + ' ' + m.last_name, teamLeads, directAgents: dAgents, ...sumIds(allMgrIds), ...sumTargets(allMgrIds), totalTLs: tls.length, totalAgents: filteredAgentResults.filter(a => tls.some(t => t.id === a.team_lead_id) || (a.manager_id === m.id)).length };
    }).filter(m => m.teamLeads.length > 0 || m.directAgents.length > 0);
    // Grand totals — only sum IDs that belong to the selected company
    const grandAgentIds = filteredAgentResults.map(a => a.id);
    const grandTLIds = effectiveTLResults.filter(tl => !exportCompanyUserIds || exportCompanyUserIds.has(tl.id)).map(tl => tl.id);
    const grandMgrIds = (allManagers.results||[]).filter(m => !exportCompanyUserIds || exportCompanyUserIds.has(m.id)).map(m => m.id);
    const allIds = [...grandMgrIds, ...grandTLIds, ...grandAgentIds];
    const grand = { ...sumIds(allIds), ...sumTargets(allIds) };
    const periodLabel = period === 'day' ? 'Today' : period === 'week' ? 'Week to Date' : period === 'month' ? 'Month to Date' : `${startD} to ${endD}`;

    // ===== Build OOXML .xlsx (ZIP of XML parts) =====
    // Helper: build a sheet XML from rows array. Each row is array of {v, t} where t='s'|'n'|'b' (string/number/bold-string)
    const buildSheetXml = (rows) => {
      // Calculate dimension for Excel compatibility
      let maxCol = 0;
      rows.forEach(row => { if (row.length > maxCol) maxCol = row.length; });
      const lastColLetter = maxCol > 0 ? String.fromCharCode(64 + maxCol) : 'A';
      const dimRef = `A1:${lastColLetter}${rows.length || 1}`;
      let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
      xml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
      xml += `<dimension ref="${dimRef}"/>`;
      xml += '<sheetData>';
      rows.forEach((row, ri) => {
        if (row.length === 0) { xml += `<row r="${ri+1}"/>`; return; }
        xml += `<row r="${ri+1}">`;
        row.forEach((cell, ci) => {
          const colLetter = String.fromCharCode(65 + ci);
          const ref = `${colLetter}${ri+1}`;
          if (cell.t === 'n') {
            const sIdx = cell.bold ? '2' : '0';
            xml += `<c r="${ref}" s="${sIdx}"><v>${cell.v != null ? cell.v : 0}</v></c>`;
          } else {
            const sIdx = cell.bold ? '1' : '0';
            xml += `<c r="${ref}" t="inlineStr" s="${sIdx}"><is><t>${escXml(String(cell.v ?? ''))}</t></is></c>`;
          }
        });
        xml += '</row>';
      });
      xml += '</sheetData></worksheet>';
      return xml;
    };

    const str = (v, bold) => ({ v, t: 's', bold: !!bold });
    const num = (v, bold) => ({ v, t: 'n', bold: !!bold });

    // --- Sheet 1: Manager Summary ---
    const s1Rows = [];
    s1Rows.push([str('Performance Report - ' + periodLabel, true)]);
    s1Rows.push([]);
    s1Rows.push([str('Manager', true), str('Team Leads', true), str('Agents', true), str('Total Visits', true), str('Individual', true), str('Store', true), str('Target (Indiv)', true), str('Target (Store)', true)]);
    for (const m of managers) {
      s1Rows.push([str(m.name), num(m.totalTLs), num(m.totalAgents), num(m.visits), num(m.individual), num(m.store), num(m.target_visits), num(m.target_stores)]);
    }
    s1Rows.push([str('TOTAL', true), num(managers.reduce((s, m) => s + m.totalTLs, 0), true), num(managers.reduce((s, m) => s + m.totalAgents, 0), true), num(grand.visits, true), num(grand.individual, true), num(grand.store, true), num(grand.target_visits, true), num(grand.target_stores, true)]);

    // --- Sheet 2: Manager + Team Leader Breakdown ---
    const s2Rows = [];
    s2Rows.push([str('Manager / Team Leader Breakdown - ' + periodLabel, true)]);
    s2Rows.push([]);
    s2Rows.push([str('Manager', true), str('Team Leader', true), str('Agents', true), str('Visits', true), str('Individual', true), str('Store', true), str('Target (Indiv)', true), str('Target (Store)', true)]);
    for (const m of managers) {
      s2Rows.push([str(m.name, true), str('(Total)', true), num(m.totalAgents, true), num(m.visits, true), num(m.individual, true), num(m.store, true), num(m.target_visits, true), num(m.target_stores, true)]);
      for (const tl of m.teamLeads) {
        s2Rows.push([str(''), str(tl.name), num(tl.agents.length), num(tl.visits), num(tl.individual), num(tl.store), num(tl.target_visits), num(tl.target_stores)]);
      }
      if (m.directAgents.length > 0) {
        const daTotal = sumIds(m.directAgents.map(a => a.id));
        const daTgts = sumTargets(m.directAgents.map(a => a.id));
        s2Rows.push([str(''), str('(Unassigned Agents)'), num(m.directAgents.length), num(daTotal.visits), num(daTotal.individual), num(daTotal.store), num(daTgts.target_visits), num(daTgts.target_stores)]);
      }
    }
    s2Rows.push([]);
    s2Rows.push([str('GRAND TOTAL', true), str('', true), num(managers.reduce((s, m) => s + m.totalAgents, 0), true), num(grand.visits, true), num(grand.individual, true), num(grand.store, true), num(grand.target_visits, true), num(grand.target_stores, true)]);

    // --- Sheet 3: Team Leader + Agent Breakdown ---
    const s3Rows = [];
    s3Rows.push([str('Team Leader / Agent Breakdown - ' + periodLabel, true)]);
    s3Rows.push([]);
    s3Rows.push([str('Team Leader', true), str('Agent', true), str('Visits', true), str('Individual', true), str('Store', true), str('Target (Indiv)', true), str('Target (Store)', true)]);
    for (const m of managers) {
      for (const tl of m.teamLeads) {
        s3Rows.push([str(tl.name, true), str('(Total)', true), num(tl.visits, true), num(tl.individual, true), num(tl.store, true), num(tl.target_visits, true), num(tl.target_stores, true)]);
        for (const agent of tl.agents) {
          s3Rows.push([str(''), str(agent.name), num(agent.visits), num(agent.individual), num(agent.store), num(agent.target_visits), num(agent.target_stores)]);
        }
      }
      if (m.directAgents.length > 0) {
        const daTotal = sumIds(m.directAgents.map(a => a.id));
        const daTgts3 = sumTargets(m.directAgents.map(a => a.id));
        s3Rows.push([str('Unassigned (' + m.name + ')', true), str('(Total)', true), num(daTotal.visits, true), num(daTotal.individual, true), num(daTotal.store, true), num(daTgts3.target_visits, true), num(daTgts3.target_stores, true)]);
        for (const agent of m.directAgents) {
          s3Rows.push([str(''), str(agent.name), num(agent.visits), num(agent.individual), num(agent.store), num(agent.target_visits), num(agent.target_stores)]);
        }
      }
    }
    s3Rows.push([]);
    s3Rows.push([str('GRAND TOTAL', true), str('', true), num(grand.visits, true), num(grand.individual, true), num(grand.store, true), num(grand.target_visits, true), num(grand.target_stores, true)]);

    // Build OOXML parts
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';

    const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';

    const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';

    const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Manager Summary" sheetId="1" r:id="rId1"/><sheet name="Manager - Team Leaders" sheetId="2" r:id="rId2"/><sheet name="Team Leader - Agents" sheetId="3" r:id="rId3"/></sheets></workbook>';

    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>';

    const sheet1Xml = buildSheetXml(s1Rows);
    const sheet2Xml = buildSheetXml(s2Rows);
    const sheet3Xml = buildSheetXml(s3Rows);

    // Create ZIP
    const zipData = tinyZip([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rels },
      { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
      { name: 'xl/workbook.xml', data: workbook },
      { name: 'xl/styles.xml', data: styles },
      { name: 'xl/worksheets/sheet1.xml', data: sheet1Xml },
      { name: 'xl/worksheets/sheet2.xml', data: sheet2Xml },
      { name: 'xl/worksheets/sheet3.xml', data: sheet3Xml }
    ]);

    const filename = `performance-report-${periodLabel.replace(/\s/g, '-')}-${startD}-to-${endD}.xlsx`;
    return new Response(zipData, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipData.byteLength)
      }
    });
  } catch (e) {
    console.error('Multi-sheet export error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// ==================== FIELD OPERATIONS: DRILL-DOWN ====================
app.get('/field-ops/drill-down/:userId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const targetUserId = c.req.param('userId');
  const { start_date, end_date, period } = c.req.query();
  
  // Calculate date range based on period parameter
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let startD, endD;
  
  if (period === 'day') {
    startD = today.toISOString().split('T')[0];
    endD = startD;
  } else if (period === 'week') {
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : (dayOfWeek === 1 ? 0 : 1 - dayOfWeek);
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    startD = monday.toISOString().split('T')[0];
    endD = today.toISOString().split('T')[0];
  } else if (period === 'month') {
    startD = today.toISOString().slice(0, 7) + '-01';
    endD = today.toISOString().split('T')[0];
  } else {
    startD = start_date || today.toISOString().split('T')[0];
    endD = end_date || startD;
  }
  
  try {
    const user = await db.prepare("SELECT id, first_name, last_name, role, manager_id, team_lead_id FROM users WHERE id = ? AND tenant_id = ?").bind(targetUserId, tenantId).first();
    if (!user) return c.json({ success: false, message: 'User not found' }, 404);
    if (user.role === 'manager') {
      // Manager drill-down: show team leads with their stats
      const teamLeads = await db.prepare("SELECT id, first_name, last_name, email, role FROM users WHERE manager_id = ? AND tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND email != 'luke.templeman@gonxt.tech'").bind(targetUserId, tenantId).all();
      const directAgents = await db.prepare("SELECT id, first_name, last_name, email, role FROM users WHERE manager_id = ? AND tenant_id = ? AND role = 'agent' AND (team_lead_id IS NULL OR team_lead_id = '') AND is_active = 1").bind(targetUserId, tenantId).all();
      const subordinates = [];
      for (const tl of (teamLeads.results || [])) {
        const teamAgentIds = await db.prepare("SELECT id FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1").bind(tl.id, tenantId).all();
        const allIds = [tl.id, ...(teamAgentIds.results || []).map(a => a.id)];
        const placeholders = allIds.map(() => '?').join(',');
        const [v, iv, sv, cv] = await Promise.all([
          db.prepare(`SELECT COUNT(*) as count FROM visits WHERE agent_id IN (${placeholders}) AND tenant_id = ? AND visit_date BETWEEN ? AND ?`).bind(...allIds, tenantId, startD, endD).first(),
          db.prepare(`SELECT COUNT(*) as count FROM visits WHERE agent_id IN (${placeholders}) AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'individual'`).bind(...allIds, tenantId, startD, endD).first(),
          db.prepare(`SELECT COUNT(*) as count FROM visits WHERE agent_id IN (${placeholders}) AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'store'`).bind(...allIds, tenantId, startD, endD).first(),
          db.prepare(`SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.agent_id IN (${placeholders}) AND v.tenant_id = ? AND (((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR LOWER(COALESCE(JSON_EXTRACT(vi.custom_field_values, '$.consumer_converted'), '')) = 'yes') AND v.visit_date >= ? AND v.visit_date <= ?`).bind(...allIds, tenantId, startD, endD).first()
        ]);
        subordinates.push({ id: tl.id, agent_id: tl.id, agent_name: tl.first_name + ' ' + tl.last_name, email: tl.email, role: 'team_lead', agents_count: (teamAgentIds.results || []).length, visits: v?.count || 0, individual_visits: iv?.count || 0, individuals: iv?.count || 0, store_visits: sv?.count || 0, conversions: cv?.count || 0 });
      }
      for (const agent of (directAgents.results || [])) {
        const [v, iv, sv, cv] = await Promise.all([
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ?").bind(agent.id, tenantId, startD, endD).first(),
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'individual'").bind(agent.id, tenantId, startD, endD).first(),
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'store'").bind(agent.id, tenantId, startD, endD).first(),
          db.prepare("SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.agent_id = ? AND v.tenant_id = ? AND (((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR LOWER(COALESCE(JSON_EXTRACT(vi.custom_field_values, '$.consumer_converted'), '')) = 'yes') AND v.visit_date >= ? AND v.visit_date <= ?").bind(agent.id, tenantId, startD, endD).first()
        ]);
        subordinates.push({ id: agent.id, agent_id: agent.id, agent_name: agent.first_name + ' ' + agent.last_name, email: agent.email, role: 'agent', visits: v?.count || 0, individual_visits: iv?.count || 0, individuals: iv?.count || 0, store_visits: sv?.count || 0, conversions: cv?.count || 0 });
      }
      return c.json({ user, agents: subordinates, period: { start: startD, end: endD, type: period || 'custom' } });
    } else if (user.role === 'team_lead') {
      const teamAgents = await db.prepare("SELECT id, first_name, last_name, email, role FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1").bind(targetUserId, tenantId).all();
      const agentPerf = [];
      for (const agent of (teamAgents.results || [])) {
        const [v, iv, sv, cv] = await Promise.all([
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ?").bind(agent.id, tenantId, startD, endD).first(),
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'individual'").bind(agent.id, tenantId, startD, endD).first(),
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'store'").bind(agent.id, tenantId, startD, endD).first(),
          db.prepare("SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.agent_id = ? AND v.tenant_id = ? AND (((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR LOWER(COALESCE(JSON_EXTRACT(vi.custom_field_values, '$.consumer_converted'), '')) = 'yes') AND v.visit_date >= ? AND v.visit_date <= ?").bind(agent.id, tenantId, startD, endD).first()
        ]);
        agentPerf.push({ id: agent.id, agent_id: agent.id, agent_name: agent.first_name + ' ' + agent.last_name, email: agent.email, visits: v?.count || 0, individual_visits: iv?.count || 0, individuals: iv?.count || 0, store_visits: sv?.count || 0, conversions: cv?.count || 0 });
      }
      return c.json({ user, agents: agentPerf, period: { start: startD, end: endD, type: period || 'custom' } });
    } else {
      // Drill down into individual agent
      const [visits, individualVisits, dailyVisits] = await Promise.all([
        db.prepare("SELECT v.*, c.name as customer_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id WHERE v.agent_id = ? AND v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? ORDER BY v.visit_date DESC LIMIT 50").bind(targetUserId, tenantId, startD, endD).all(),
        db.prepare("SELECT * FROM visits WHERE agent_id = ? AND tenant_id = ? AND LOWER(visit_type) = 'individual' AND visit_date >= ? AND visit_date <= ? ORDER BY created_at DESC LIMIT 50").bind(targetUserId, tenantId, startD, endD).all(),
        db.prepare("SELECT visit_date, COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? GROUP BY visit_date ORDER BY visit_date").bind(targetUserId, tenantId, startD, endD).all()
      ]);
      return c.json({ user, visits: visits.results || [], individuals: individualVisits.results || [], daily_visits: dailyVisits.results || [], period: { start: startD, end: endD, type: period || 'custom' } });
    }
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// ==================== FIELD OPERATIONS: DRILL-DOWN EXPORT ====================
app.get('/field-ops/drill-down/:userId/export', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const targetUserId = c.req.param('userId');
  const { start_date, end_date, period } = c.req.query();
  
  // Calculate date range based on period parameter
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let startD, endD;
  
  if (period === 'day') {
    startD = today.toISOString().split('T')[0];
    endD = startD;
  } else if (period === 'week') {
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : (dayOfWeek === 1 ? 0 : 1 - dayOfWeek);
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    startD = monday.toISOString().split('T')[0];
    endD = today.toISOString().split('T')[0];
  } else if (period === 'month') {
    startD = today.toISOString().slice(0, 7) + '-01';
    endD = today.toISOString().split('T')[0];
  } else {
    startD = start_date || today.toISOString().split('T')[0];
    endD = end_date || startD;
  }
  
  try {
    const user = await db.prepare("SELECT id, first_name, last_name, role FROM users WHERE id = ? AND tenant_id = ?").bind(targetUserId, tenantId).first();
    if (!user) return c.json({ error: 'User not found' }, 404);
    
    let headers = [];
    let data = [];
    
    if (user.role === 'manager') {
      headers = ['Name', 'Role', 'Visits', 'Individual', 'Store', 'Conversions', 'Conversion Rate'];
      const teamLeads = await db.prepare("SELECT id, first_name, last_name FROM users WHERE manager_id = ? AND tenant_id = ? AND role = 'team_lead' AND is_active = 1 AND email != 'luke.templeman@gonxt.tech'").bind(targetUserId, tenantId).all();
      const directAgents = await db.prepare("SELECT id, first_name, last_name FROM users WHERE manager_id = ? AND tenant_id = ? AND role = 'agent' AND (team_lead_id IS NULL OR team_lead_id = '') AND is_active = 1").bind(targetUserId, tenantId).all();
      for (const tl of (teamLeads.results || [])) {
        const teamAgentIds = await db.prepare("SELECT id FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1").bind(tl.id, tenantId).all();
        const allIds = [tl.id, ...(teamAgentIds.results || []).map(a => a.id)];
        const ph = allIds.map(() => '?').join(',');
        const [v, iv, sv, cv] = await Promise.all([
          db.prepare(`SELECT COUNT(*) as count FROM visits WHERE agent_id IN (${ph}) AND tenant_id = ? AND visit_date BETWEEN ? AND ?`).bind(...allIds, tenantId, startD, endD).first(),
          db.prepare(`SELECT COUNT(*) as count FROM visits WHERE agent_id IN (${ph}) AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'individual'`).bind(...allIds, tenantId, startD, endD).first(),
          db.prepare(`SELECT COUNT(*) as count FROM visits WHERE agent_id IN (${ph}) AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'store'`).bind(...allIds, tenantId, startD, endD).first(),
          db.prepare(`SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.agent_id IN (${ph}) AND v.tenant_id = ? AND (((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR LOWER(COALESCE(JSON_EXTRACT(vi.custom_field_values, '$.consumer_converted'), '')) = 'yes') AND v.visit_date >= ? AND v.visit_date <= ?`).bind(...allIds, tenantId, startD, endD).first()
        ]);
        const ivCount = iv?.count || 0; const cvCount = cv?.count || 0;
        data.push([tl.first_name + ' ' + tl.last_name, 'Team Lead', v?.count || 0, ivCount, sv?.count || 0, cvCount, ivCount > 0 ? Math.round((cvCount / ivCount) * 100) + '%' : '0%']);
      }
      for (const agent of (directAgents.results || [])) {
        const [v, iv, sv, cv] = await Promise.all([
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ?").bind(agent.id, tenantId, startD, endD).first(),
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'individual'").bind(agent.id, tenantId, startD, endD).first(),
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'store'").bind(agent.id, tenantId, startD, endD).first(),
          db.prepare("SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.agent_id = ? AND v.tenant_id = ? AND (((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR LOWER(COALESCE(JSON_EXTRACT(vi.custom_field_values, '$.consumer_converted'), '')) = 'yes') AND v.visit_date >= ? AND v.visit_date <= ?").bind(agent.id, tenantId, startD, endD).first()
        ]);
        const ivCount = iv?.count || 0; const cvCount = cv?.count || 0;
        data.push([agent.first_name + ' ' + agent.last_name, 'Agent', v?.count || 0, ivCount, sv?.count || 0, cvCount, ivCount > 0 ? Math.round((cvCount / ivCount) * 100) + '%' : '0%']);
      }
    } else if (user.role === 'team_lead') {
      headers = ['Agent', 'Visits', 'Individual', 'Store', 'Conversions', 'Conversion Rate'];
      const teamAgents = await db.prepare("SELECT id, first_name, last_name FROM users WHERE team_lead_id = ? AND tenant_id = ? AND is_active = 1").bind(targetUserId, tenantId).all();
      
      for (const agent of (teamAgents.results || [])) {
        const [v, iv, sv, cv] = await Promise.all([
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ?").bind(agent.id, tenantId, startD, endD).first(),
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'individual'").bind(agent.id, tenantId, startD, endD).first(),
          db.prepare("SELECT COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? AND LOWER(visit_type) = 'store'").bind(agent.id, tenantId, startD, endD).first(),
          db.prepare("SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.agent_id = ? AND v.tenant_id = ? AND (((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR LOWER(COALESCE(JSON_EXTRACT(vi.custom_field_values, '$.consumer_converted'), '')) = 'yes') AND v.visit_date >= ? AND v.visit_date <= ?").bind(agent.id, tenantId, startD, endD).first()
        ]);
        const vCount = v?.count || 0;
        const ivCount = iv?.count || 0;
        const svCount = sv?.count || 0;
        const cvCount = cv?.count || 0;
        const convRate = ivCount > 0 ? Math.round((cvCount / ivCount) * 100) + '%' : '0%';
        data.push([agent.first_name + ' ' + agent.last_name, vCount, ivCount, svCount, cvCount, convRate]);
      }
    } else {
      headers = ['Date', 'Visits', 'Individual', 'Store', 'Conversions'];
      const dailyVisits = await db.prepare("SELECT visit_date, COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date BETWEEN ? AND ? GROUP BY visit_date ORDER BY visit_date").bind(targetUserId, tenantId, startD, endD).all();
      const dailyIndivs = await db.prepare("SELECT visit_date as day, COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND LOWER(visit_type) = 'individual' AND visit_date >= ? AND visit_date <= ? GROUP BY visit_date ORDER BY visit_date").bind(targetUserId, tenantId, startD, endD).all();
      const dailyStores = await db.prepare("SELECT visit_date as day, COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND LOWER(visit_type) = 'store' AND visit_date >= ? AND visit_date <= ? GROUP BY visit_date ORDER BY visit_date").bind(targetUserId, tenantId, startD, endD).all();
      const dailyConvs = await db.prepare("SELECT DATE(created_at) as day, COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.agent_id = ? AND v.tenant_id = ? AND (((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR LOWER(COALESCE(JSON_EXTRACT(vi.custom_field_values, '$.consumer_converted'), '')) = 'yes') AND v.visit_date >= ? AND v.visit_date <= ? GROUP BY day ORDER BY day").bind(targetUserId, tenantId, startD, endD).all();
      
      const visitMap = Object.fromEntries((dailyVisits.results || []).map(r => [r.visit_date, r.count]));
      const indivMap = Object.fromEntries((dailyIndivs.results || []).map(r => [r.day, r.count]));
      const storeMap = Object.fromEntries((dailyStores.results || []).map(r => [r.day, r.count]));
      const convMap = Object.fromEntries((dailyConvs.results || []).map(r => [r.day, r.count]));
      
      // Generate all dates in range
      const dates = [];
      const curr = new Date(startD);
      while (curr <= new Date(endD)) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }
      
      data = dates.map(date => [
        date,
        visitMap[date] || 0,
        indivMap[date] || 0,
        storeMap[date] || 0,
        convMap[date] || 0
      ]);
    }
    
    // Build CSV with BOM for Excel compatibility
    const periodLabel = period === 'day' ? 'Day' : period === 'week' ? 'Week to Date' : period === 'month' ? 'Month to Date' : 'Custom Period';
    const escapeCsv = (val) => { const s = String(val ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...data.map(row => row.map(escapeCsv).join(','))
    ];
    const BOM = '\uFEFF';
    return new Response(BOM + csvLines.join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="drill-down-${user.first_name}-${user.last_name}-${periodLabel.replace(/\s/g, '-')}-${startD}-to-${endD}.csv"` }
    });
  } catch (e) {
    console.error('Drill-down export error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// ==================== FIELD OPERATIONS: COMPANY AUTH ====================
// NOTE: Company login is registered on the `app` router (public, no authMiddleware) — see below app.post('/api/field-ops/company-auth/login', ...)

app.get('/field-ops/company-dashboard', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id } = c.req.query();
  if (!company_id) return c.json({ success: false, message: 'company_id required' }, 400);
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.substring(0, 7) + '-01';
  try {
    const [company, agentCount, todayVisits, monthVisits, totalRegs, totalConvs, recentRegs] = await Promise.all([
      db.prepare('SELECT * FROM field_companies WHERE id = ? AND tenant_id = ?').bind(company_id, tenantId).first(),
      db.prepare('SELECT COUNT(*) as count FROM agent_company_links WHERE company_id = ? AND tenant_id = ? AND is_active = 1').bind(company_id, tenantId).first(),
      db.prepare("SELECT COUNT(*) as count FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE acl.company_id = ? AND v.visit_date = ? AND v.tenant_id = ?").bind(company_id, today, tenantId).first(),
      db.prepare("SELECT COUNT(*) as count FROM visits v JOIN agent_company_links acl ON v.agent_id = acl.agent_id WHERE acl.company_id = ? AND v.visit_date >= ? AND v.tenant_id = ?").bind(company_id, monthStart, tenantId).first(),
      db.prepare("SELECT COUNT(*) as count FROM visits WHERE company_id = ? AND tenant_id = ? AND LOWER(visit_type) = 'store'").bind(company_id, tenantId).first(),
      db.prepare("SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.company_id = ? AND v.tenant_id = ? AND (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)").bind(company_id, tenantId).first(),
      db.prepare("SELECT v.*, u.first_name || ' ' || u.last_name as agent_name FROM visits v LEFT JOIN users u ON v.agent_id = u.id WHERE v.company_id = ? AND v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) ORDER BY v.created_at DESC LIMIT 10").bind(company_id, tenantId).all()
    ]);
    return c.json({ company, agents: agentCount?.count || 0, today_visits: todayVisits?.count || 0, month_visits: monthVisits?.count || 0, total_individuals: totalRegs?.count || 0, total_conversions: totalConvs?.count || 0, conversion_rate: (totalRegs?.count || 0) > 0 ? Math.round(((totalConvs?.count || 0) / (totalRegs?.count || 1)) * 100) : 0, recent_individuals: recentRegs.results || [] });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// ==================== FIELD OPERATIONS: BRAND INSIGHTS (SSReports-style) ====================
app.get('/field-ops/brand-insights', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id, start_date, end_date } = c.req.query();
  const today = new Date().toISOString().split('T')[0];
  const startD = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endD = end_date || today;
  try {
    let companyFilter = '';
    const baseParams = [tenantId, startD, endD];
    if (company_id) { companyFilter = ' AND acl.company_id = ?'; baseParams.push(company_id); }
    // Visits by day
    const visitsByDay = await db.prepare("SELECT v.visit_date, COUNT(*) as count FROM visits v" + (company_id ? " JOIN agent_company_links acl ON v.agent_id = acl.agent_id" : "") + " WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ?" + companyFilter + " GROUP BY v.visit_date ORDER BY v.visit_date").bind(...baseParams).all();
    // Visits by hour
    const visitsByHour = await db.prepare("SELECT CAST(substr(v.check_in_time, 12, 2) AS INTEGER) as hour, COUNT(*) as count FROM visits v" + (company_id ? " JOIN agent_company_links acl ON v.agent_id = acl.agent_id" : "") + " WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ? AND v.check_in_time IS NOT NULL" + companyFilter + " GROUP BY hour ORDER BY hour").bind(...baseParams).all();
    // Agent performance
    const agentPerf = await db.prepare("SELECT v.agent_id, u.first_name || ' ' || u.last_name as agent_name, COUNT(*) as visit_count, SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END) as completed FROM visits v JOIN users u ON v.agent_id = u.id" + (company_id ? " JOIN agent_company_links acl ON v.agent_id = acl.agent_id" : "") + " WHERE v.tenant_id = ? AND v.visit_date BETWEEN ? AND ?" + companyFilter + " GROUP BY v.agent_id ORDER BY visit_count DESC LIMIT 20").bind(...baseParams).all();
    // Registration stats
    let regParams = [tenantId, startD, endD];
    let regFilter = '';
    if (company_id) { regFilter = ' AND ir.company_id = ?'; regParams.push(company_id); }
    const regStats = await db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN ((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') THEN 1 ELSE 0 END) as converted FROM visits v LEFT JOIN visit_individuals vi ON v.id = vi.visit_id WHERE v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND v.visit_date >= ? AND v.visit_date <= ? AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)" + regFilter.replace(/ir\./g, "v.")).bind(...regParams).first();
    // Conversion by day
    const convByDay = await db.prepare("SELECT v.visit_date as day, COUNT(*) as individuals, SUM(CASE WHEN ((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') THEN 1 ELSE 0 END) as conversions FROM visits v LEFT JOIN visit_individuals vi ON v.id = vi.visit_id WHERE v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND v.visit_date >= ? AND v.visit_date <= ? AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)" + regFilter.replace(/ir\./g, "v.") + " GROUP BY day ORDER BY day").bind(...regParams).all();
    // KPIs
    const totalVisits = (visitsByDay.results || []).reduce((s, d) => s + d.count, 0);
    const totalAgents = (agentPerf.results || []).length;
    return c.json({
      kpis: { total_visits: totalVisits, active_agents: totalAgents, total_individuals: regStats?.total || 0, total_conversions: regStats?.converted || 0, conversion_rate: (regStats?.total || 0) > 0 ? Math.round(((regStats?.converted || 0) / (regStats?.total || 1)) * 100) : 0 },
      visits_by_day: visitsByDay.results || [],
      visits_by_hour: visitsByHour.results || [],
      agent_performance: agentPerf.results || [],
      conversions_by_day: convByDay.results || [],
      period: { start: startD, end: endD }
    });
  } catch (e) {
    return c.json({ error: e.message, kpis: {}, visits_by_day: [], visits_by_hour: [], agent_performance: [], conversions_by_day: [] }, 500);
  }
});

// ==================== FIELD OPERATIONS: COMPANY LOGINS MANAGEMENT ====================
app.get('/field-ops/company-logins', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id } = c.req.query();
  try {
    let q = "SELECT cl.id, cl.company_id, cl.email, cl.name, cl.role, cl.is_active, cl.last_login, cl.created_at, fc.name as company_name FROM company_logins cl JOIN field_companies fc ON cl.company_id = fc.id WHERE cl.tenant_id = ?";
    const params = [tenantId];
    if (company_id) { q += ' AND cl.company_id = ?'; params.push(company_id); }
    q += ' ORDER BY cl.created_at DESC';
    const logins = await db.prepare(q).bind(...params).all();
    return c.json({ data: logins.results || [] });
  } catch {
    return c.json({ data: [] });
  }
});

app.post('/field-ops/company-logins', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  if (!body.company_id || !body.email || !body.password || !body.name) return c.json({ success: false, message: 'company_id, email, password, and name required' }, 400);
  const id = uuidv4();
  const hashedPassword = await bcrypt.hash(body.password, 10);
  await db.prepare('INSERT INTO company_logins (id, company_id, tenant_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, body.company_id, tenantId, body.email, hashedPassword, body.name, body.role || 'viewer').run();
  return c.json({ id, message: 'Company login created' }, 201);
});

app.delete('/field-ops/company-logins/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('UPDATE company_logins SET is_active = 0 WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Login deactivated' });
});

export default app;
