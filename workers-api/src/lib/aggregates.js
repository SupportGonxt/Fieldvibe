// Shared aggregate query helpers (P4). Moved verbatim from index.js.
// Combine 3 commission status queries into 1 with conditional aggregation
async function getCommissionTotals(db, tenantId, earnerIds) {
  if (!earnerIds || earnerIds.length === 0) return { pending: 0, approved: 0, paid: 0 };
  const ph = earnerIds.map(() => '?').join(',');
  const filter = earnerIds.length === 1 ? 'earner_id = ?' : `earner_id IN (${ph})`;
  const result = await db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid
    FROM commission_earnings WHERE tenant_id = ? AND ${filter}
  `).bind(tenantId, ...earnerIds).first().catch(() => ({ pending: 0, approved: 0, paid: 0 }));
  return result;
}

// Bulk visit counts for multiple agents — replaces per-agent loops with 1 query
// Returns a Map of agentId -> { today_visits, month_visits, today_individual, today_store, month_individual, month_store, week_visits, week_individual, week_store, prior_month_visits, prior_month_individual, prior_month_store }
async function getBulkAgentVisitCounts(db, tenantId, agentIds, today, monthStart, nextMonth, weekStart, priorMonthStart, companyIds = []) {
  if (!agentIds || agentIds.length === 0) return new Map();
  const ph = agentIds.map(() => '?').join(',');
  const cFilter = companyIds.length > 0 ? ` AND company_id IN (${companyIds.map(() => '?').join(',')})` : '';
  const result = await db.prepare(`
    SELECT
      agent_id,
      SUM(CASE WHEN visit_date = ? THEN 1 ELSE 0 END) as today_visits,
      SUM(CASE WHEN visit_date >= ? AND visit_date < ? THEN 1 ELSE 0 END) as month_visits,
      SUM(CASE WHEN visit_date = ? AND LOWER(visit_type) != 'store' THEN 1 ELSE 0 END) as today_individual,
      SUM(CASE WHEN visit_date = ? AND LOWER(visit_type) = 'store' THEN 1 ELSE 0 END) as today_store,
      SUM(CASE WHEN visit_date >= ? AND visit_date < ? AND LOWER(visit_type) != 'store' THEN 1 ELSE 0 END) as month_individual,
      SUM(CASE WHEN visit_date >= ? AND visit_date < ? AND LOWER(visit_type) = 'store' THEN 1 ELSE 0 END) as month_store,
      SUM(CASE WHEN visit_date >= ? THEN 1 ELSE 0 END) as week_visits,
      SUM(CASE WHEN visit_date >= ? AND LOWER(visit_type) != 'store' THEN 1 ELSE 0 END) as week_individual,
      SUM(CASE WHEN visit_date >= ? AND LOWER(visit_type) = 'store' THEN 1 ELSE 0 END) as week_store,
      SUM(CASE WHEN visit_date >= ? AND visit_date < ? THEN 1 ELSE 0 END) as prior_month_visits,
      SUM(CASE WHEN visit_date >= ? AND visit_date < ? AND LOWER(visit_type) != 'store' THEN 1 ELSE 0 END) as prior_month_individual,
      SUM(CASE WHEN visit_date >= ? AND visit_date < ? AND LOWER(visit_type) = 'store' THEN 1 ELSE 0 END) as prior_month_store
    FROM visits
    WHERE tenant_id = ? AND agent_id IN (${ph})${cFilter}
      AND visit_date >= ?
    GROUP BY agent_id
  `).bind(
    today,
    monthStart, nextMonth,
    today, today,
    monthStart, nextMonth,
    monthStart, nextMonth,
    weekStart, weekStart, weekStart,
    priorMonthStart, monthStart,
    priorMonthStart, monthStart,
    priorMonthStart, monthStart,
    tenantId, ...agentIds, ...companyIds,
    priorMonthStart
  ).all().catch(() => ({ results: [] }));

  const map = new Map();
  for (const row of (result.results || [])) {
    map.set(row.agent_id, {
      today_visits: row.today_visits || 0,
      month_visits: row.month_visits || 0,
      today_individual: row.today_individual || 0,
      today_store: row.today_store || 0,
      month_individual: row.month_individual || 0,
      month_store: row.month_store || 0,
      week_visits: row.week_visits || 0,
      week_individual: row.week_individual || 0,
      week_store: row.week_store || 0,
      prior_month_visits: row.prior_month_visits || 0,
      prior_month_individual: row.prior_month_individual || 0,
      prior_month_store: row.prior_month_store || 0,
    });
  }
  // Fill in zeros for agents with no visits
  const empty = { today_visits: 0, month_visits: 0, today_individual: 0, today_store: 0, month_individual: 0, month_store: 0, week_visits: 0, week_individual: 0, week_store: 0, prior_month_visits: 0, prior_month_individual: 0, prior_month_store: 0 };
  for (const id of agentIds) {
    if (!map.has(id)) map.set(id, { ...empty });
  }
  return map;
}

// Resolve which company a goldrush-family report runs against. Explicit
// ?company_id= wins (tenant-checked; invalid id → null, no silent fallback so
// a bad filter returns empty rather than leaking goldrush). No company_id →
// the legacy name-LIKE goldrush default, preserving pre-parameterization behavior.
async function resolveReportCompanyId(db, tenantId, companyId) {
  if (companyId) {
    const row = await db.prepare('SELECT id FROM field_companies WHERE id = ? AND tenant_id = ?').bind(companyId, tenantId).first();
    return row ? row.id : null;
  }
  const gr = await db.prepare("SELECT id FROM field_companies WHERE LOWER(name) LIKE '%goldrush%' AND tenant_id = ?").bind(tenantId).first();
  return gr ? gr.id : null;
}

export { getCommissionTotals, getBulkAgentVisitCounts, resolveReportCompanyId };
