// Working-days calendar + target-rule helpers. Moved verbatim from index.js.
// ==================== WORKING CALENDAR HELPERS ====================
// Resolve the effective working_days_config for a given agent/company (agent override > company config > global default)
async function resolveWorkingDaysConfig(db, tenantId, companyId, agentId) {
  try {
    let config = null;
    if (agentId) {
      if (companyId) {
        config = await db.prepare('SELECT * FROM working_days_config WHERE tenant_id = ? AND agent_id = ? AND company_id = ? ORDER BY created_at DESC LIMIT 1').bind(tenantId, agentId, companyId).first();
      }
      if (!config) {
        config = await db.prepare('SELECT * FROM working_days_config WHERE tenant_id = ? AND agent_id = ? AND company_id IS NULL ORDER BY created_at DESC LIMIT 1').bind(tenantId, agentId).first();
      }
    }
    if (!config && companyId) {
      config = await db.prepare('SELECT * FROM working_days_config WHERE tenant_id = ? AND company_id = ? AND agent_id IS NULL ORDER BY created_at DESC LIMIT 1').bind(tenantId, companyId).first();
    }
    if (!config) {
      config = await db.prepare('SELECT * FROM working_days_config WHERE tenant_id = ? AND company_id IS NULL AND agent_id IS NULL ORDER BY created_at DESC LIMIT 1').bind(tenantId).first();
    }
    if (!config) {
      config = { monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 0, sunday: 0, public_holidays: '[]' };
    }
    return config;
  } catch {
    return { monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 0, sunday: 0, public_holidays: '[]' };
  }
}

// Batch version: resolves working days configs for multiple companies in 1 query instead of 4*N queries
const DEFAULT_WD_CONFIG = { monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 0, sunday: 0, public_holidays: '[]' };

async function resolveWorkingDaysConfigBatch(db, tenantId, companyIds, agentId) {
  if (!companyIds || companyIds.length === 0) return {};
  try {
    // Fetch all potentially relevant configs in a single query
    const ph = companyIds.map(() => '?').join(',');
    const allConfigs = await db.prepare(
      `SELECT * FROM working_days_config WHERE tenant_id = ? AND (
        (agent_id = ? AND company_id IN (${ph})) OR
        (agent_id = ? AND company_id IS NULL) OR
        (agent_id IS NULL AND company_id IN (${ph})) OR
        (agent_id IS NULL AND company_id IS NULL)
      ) ORDER BY created_at DESC`
    ).bind(tenantId, agentId, ...companyIds, agentId, ...companyIds).all().catch(() => ({ results: [] }));
    const rows = allConfigs.results || [];
    // Resolve per company using priority: agent+company > agent+null > null+company > null+null
    const result = {};
    const globalConfig = rows.find(r => !r.agent_id && !r.company_id) || null;
    const agentGlobalConfig = rows.find(r => r.agent_id === agentId && !r.company_id) || null;
    for (const cid of companyIds) {
      const agentCompany = rows.find(r => r.agent_id === agentId && r.company_id === cid);
      const companyOnly = rows.find(r => !r.agent_id && r.company_id === cid);
      result[cid] = agentCompany || agentGlobalConfig || companyOnly || globalConfig || DEFAULT_WD_CONFIG;
    }
    return result;
  } catch {
    const result = {};
    for (const cid of companyIds) result[cid] = DEFAULT_WD_CONFIG;
    return result;
  }
}

// Count working days in a given month (YYYY-MM) based on a working_days_config
// Optimized: pre-compute day-of-week pattern to avoid Date object creation in loop
function countWorkingDaysInMonth(config, month) {
  try {
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const holidays = JSON.parse(config.public_holidays || '[]');
    const holidaySet = new Set(holidays); // O(1) lookup vs O(n) array includes
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Pre-compute which days of week are enabled
    const enabledDays = new Set([
      config.monday ? 'monday' : null,
      config.tuesday ? 'tuesday' : null,
      config.wednesday ? 'wednesday' : null,
      config.thursday ? 'thursday' : null,
      config.friday ? 'friday' : null,
      config.saturday ? 'saturday' : null,
      config.sunday ? 'sunday' : null,
    ].filter(Boolean));

    // Get first day of month and pre-compute day names
    const firstDay = new Date(year, mon - 1, 1).getDay();
    let count = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayIndex = (firstDay + d - 1) % 7;
      const dayName = dayMap[dayIndex];
      const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (enabledDays.has(dayName) && !holidaySet.has(dateStr)) count++;
    }
    return count;
  } catch {
    return 22;
  }
}

// Build monthly targets from company_target_rules × working days when monthly_targets table is empty
async function buildFallbackMonthlyTargets(db, tenantId, agentId, currentMonth, agentCompanyIds, roleType) {
  const fallbackTargets = [];
  if (!agentCompanyIds || agentCompanyIds.length === 0) return fallbackTargets;
  try {
    const rt = roleType || 'agent';
    const ph = agentCompanyIds.map(() => '?').join(',');
    // Try role-specific rules first, fall back to any rules for backward compat
    let ctrResult = await db.prepare(`SELECT ctr.*, fc.name as company_name FROM company_target_rules ctr JOIN field_companies fc ON ctr.company_id = fc.id WHERE ctr.tenant_id = ? AND ctr.company_id IN (${ph}) AND ctr.role_type = ?`).bind(tenantId, ...agentCompanyIds, rt).all();
    let rules = ctrResult.results || [];
    if (rules.length === 0) {
      ctrResult = await db.prepare(`SELECT ctr.*, fc.name as company_name FROM company_target_rules ctr JOIN field_companies fc ON ctr.company_id = fc.id WHERE ctr.tenant_id = ? AND ctr.company_id IN (${ph})`).bind(tenantId, ...agentCompanyIds).all();
      rules = ctrResult.results || [];
    }
    // Batch resolve working days configs for all rule companies in 1 query
    const ruleCompanyIds = rules.map(r => r.company_id);
    const wdConfigMap = await resolveWorkingDaysConfigBatch(db, tenantId, ruleCompanyIds, agentId);
    for (const ctr of rules) {
      const wdConfig = wdConfigMap[ctr.company_id] || DEFAULT_WD_CONFIG;
      const workingDays = countWorkingDaysInMonth(wdConfig, currentMonth);
      // Use new per-role fields first, fall back to legacy fields
      const indivPerDay = (ctr.individual_target_per_day != null ? ctr.individual_target_per_day : ctr.target_visits_per_day) ?? 0;
      const indivPerMonth = ctr.individual_target_per_month != null ? ctr.individual_target_per_month : (indivPerDay * workingDays);
      const storePerMonth = (ctr.store_target_per_month != null ? ctr.store_target_per_month : ((ctr.target_registrations_per_day || 0) * workingDays));
      const dailyConvs = ctr.target_conversions_per_day || 0;
      fallbackTargets.push({
        agent_id: agentId,
        company_id: ctr.company_id,
        company_name: ctr.company_name,
        target_visits: indivPerMonth,
        target_registrations: storePerMonth,
        target_conversions: dailyConvs * workingDays,
        actual_visits: 0,
        actual_registrations: 0,
        actual_conversions: 0,
        working_days: workingDays,
        commission_rate: 0,
        commission_amount: 0,
        store_visits: 0,
        individual_visits: 0,
        source: 'company_rule',
      });
    }
  } catch { /* */ }
  return fallbackTargets;
}

// Build fallback targets for a single user (used in team lead / manager context)
async function getUserMonthlyTargetFromRules(db, tenantId, userId, currentMonth, roleType) {
  let totalTargetVisits = 0;
  let totalTargetRegs = 0;
  try {
    const rt = roleType || 'agent';
    // Get user's companies
    const companiesResult = await db.prepare("SELECT fc.id FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active'").bind(userId, tenantId).all();
    const companyIds = (companiesResult.results || []).map(c => c.id);
    if (companyIds.length > 0) {
      const ph = companyIds.map(() => '?').join(',');
      // Try role-specific rules first, fall back to any rules for backward compat
      let rules = await db.prepare(`SELECT * FROM company_target_rules WHERE tenant_id = ? AND company_id IN (${ph}) AND role_type = ?`).bind(tenantId, ...companyIds, rt).all();
      let ruleRows = rules.results || [];
      if (ruleRows.length === 0) {
        rules = await db.prepare(`SELECT * FROM company_target_rules WHERE tenant_id = ? AND company_id IN (${ph})`).bind(tenantId, ...companyIds).all();
        ruleRows = rules.results || [];
      }
      // Batch resolve working days configs
      const ruleCompanyIds = ruleRows.map(r => r.company_id);
      const wdConfigMap = await resolveWorkingDaysConfigBatch(db, tenantId, ruleCompanyIds, userId);
      for (const ctr of ruleRows) {
        const wdConfig = wdConfigMap[ctr.company_id] || DEFAULT_WD_CONFIG;
        const workingDays = countWorkingDaysInMonth(wdConfig, currentMonth);
        // Use new per-role fields first, fall back to legacy fields
        const indivPerDay = (ctr.individual_target_per_day != null ? ctr.individual_target_per_day : ctr.target_visits_per_day) ?? 0;
        const indivPerMonth = ctr.individual_target_per_month != null ? ctr.individual_target_per_month : (indivPerDay * workingDays);
        const storePerMonth = (ctr.store_target_per_month != null ? ctr.store_target_per_month : ((ctr.target_registrations_per_day || 0) * workingDays));
        totalTargetVisits += indivPerMonth;
        totalTargetRegs += storePerMonth;
      }
    }
  } catch { /* */ }
  return { target_visits: totalTargetVisits, target_registrations: totalTargetRegs };
}

// Helper: generate monthly targets from company_target_rules when monthly_targets table is empty
async function generateTargetsFromRules(db, tenantId, agentId, monthStartDate, roleType) {
  try {
    const currentMonth = monthStartDate.substring(0, 7); // e.g. '2026-03'
    const [gtY, gtM] = currentMonth.split('-').map(Number);
    const genNextMonth = gtM === 12 ? `${gtY + 1}-01-01` : `${gtY}-${String(gtM + 1).padStart(2, '0')}-01`;
    const rt = roleType || 'agent';
    // Get agent's companies
    const agentCompanies = await db.prepare(
      "SELECT fc.id, fc.name FROM agent_company_links acl JOIN field_companies fc ON acl.company_id = fc.id WHERE acl.agent_id = ? AND acl.tenant_id = ? AND acl.is_active = 1 AND fc.status = 'active'"
    ).bind(agentId, tenantId).all();
    const companyIds = (agentCompanies.results || []).map(c => c.id);
    if (companyIds.length === 0) return [];
    const ph = companyIds.map(() => '?').join(',');
    // Try to get per-role rules first, fall back to any rules for backward compat
    let rulesResult = await db.prepare(
      `SELECT ctr.*, fc.name as company_name FROM company_target_rules ctr JOIN field_companies fc ON ctr.company_id = fc.id WHERE ctr.tenant_id = ? AND ctr.company_id IN (${ph}) AND ctr.role_type = ?`
    ).bind(tenantId, ...companyIds, rt).all();
    let rules = rulesResult.results || [];
    if (rules.length === 0) {
      // Fallback: get any rules (legacy rows without role_type or role_type='agent')
      rulesResult = await db.prepare(
        `SELECT ctr.*, fc.name as company_name FROM company_target_rules ctr JOIN field_companies fc ON ctr.company_id = fc.id WHERE ctr.tenant_id = ? AND ctr.company_id IN (${ph})`
      ).bind(tenantId, ...companyIds).all();
      rules = rulesResult.results || [];
    }
    if (rules.length === 0) return [];
    // Batch resolve working days configs for all rule companies in 1 query
    const genRuleCompanyIds = rules.map(r => r.company_id);
    const genWdConfigMap = await resolveWorkingDaysConfigBatch(db, tenantId, genRuleCompanyIds, agentId);
    // Fetch live actuals for all companies in parallel
    const syntheticTargets = await Promise.all(rules.map(async (ctr) => {
      const wdConfig = genWdConfigMap[ctr.company_id] || DEFAULT_WD_CONFIG;
      const wdMonth = countWorkingDaysInMonth(wdConfig, currentMonth);
      // Use new per-role fields first, fall back to legacy fields (use ?? to preserve explicit 0)
      const indivPerDay = (ctr.individual_target_per_day != null ? ctr.individual_target_per_day : ctr.target_visits_per_day) ?? 0;
      const storePerMonth = (ctr.store_target_per_month != null ? ctr.store_target_per_month : (ctr.store_target_per_month_agent ?? ctr.store_target_per_month_tl)) ?? 0;
      const indivPerMonth = ctr.individual_target_per_month != null ? ctr.individual_target_per_month : (indivPerDay * wdMonth);
      const storePerDay = ctr.store_target_per_day ?? 0;
      const targetConvs = (ctr.target_conversions_per_day || 0) * wdMonth;
      // Get live actuals in parallel
      let storeVisits = 0, individualVisits = 0, actualConvs = 0;
      const [tb, lc] = await Promise.all([
        db.prepare("SELECT visit_type, COUNT(*) as count FROM visits WHERE agent_id = ? AND tenant_id = ? AND visit_date >= ? AND visit_date < ? AND company_id = ? GROUP BY visit_type").bind(agentId, tenantId, monthStartDate, genNextMonth, ctr.company_id).all().catch(() => ({ results: [] })),
        db.prepare("SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.agent_id = ? AND v.tenant_id = ? AND (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') AND v.visit_date >= ? AND v.visit_date < ? AND v.company_id = ?").bind(agentId, tenantId, monthStartDate, genNextMonth, ctr.company_id).first().catch(() => ({ count: 0 })),
      ]);
      for (const row of (tb.results || [])) {
        if ((row.visit_type || '').toLowerCase() === 'store') storeVisits = row.count || 0;
        if ((row.visit_type || '').toLowerCase() === 'individual') individualVisits = row.count || 0;
      }
      actualConvs = lc?.count || 0;
      return {
        company_id: ctr.company_id,
        company_name: ctr.company_name,
        target_visits: indivPerMonth,
        actual_visits: individualVisits,
        target_registrations: storePerMonth,
        actual_registrations: storeVisits,
        target_conversions: targetConvs,
        actual_conversions: actualConvs,
        individual_target_per_day: indivPerDay,
        store_target_per_day: storePerDay,
        commission_amount: 0,
        commission_rate: 0,
        working_days: wdMonth,
        store_visits: storeVisits,
        individual_visits: individualVisits,
        source: 'company_rule',
        role_type: ctr.role_type || 'agent',
      };
    }));
    return syntheticTargets;
  } catch { return []; }
}

// Helper: compute target totals for a set of user IDs from company_target_rules
async function computeTargetTotalsFromRules(db, tenantId, userIds, monthStartDate, roleType) {
  let totalTargetVisits = 0, totalActualVisits = 0, totalTargetRegs = 0, totalActualRegs = 0;
  for (const uid of userIds) {
    const targets = await generateTargetsFromRules(db, tenantId, uid, monthStartDate, roleType);
    totalTargetVisits += targets.reduce((s, t) => s + (t.target_visits || 0), 0);
    totalActualVisits += targets.reduce((s, t) => s + (t.actual_visits || 0), 0);
    totalTargetRegs += targets.reduce((s, t) => s + (t.target_registrations || 0), 0);
    totalActualRegs += targets.reduce((s, t) => s + (t.actual_registrations || 0), 0);
  }
  return { totalTargetVisits, totalActualVisits, totalTargetRegs, totalActualRegs };
}

export {
  DEFAULT_WD_CONFIG,
  resolveWorkingDaysConfig,
  resolveWorkingDaysConfigBatch,
  countWorkingDaysInMonth,
  buildFallbackMonthlyTargets,
  getUserMonthlyTargetFromRules,
  generateTargetsFromRules,
  computeTargetTotalsFromRules,
};
