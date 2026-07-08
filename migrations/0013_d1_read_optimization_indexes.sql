-- Cut D1 rows-read on the hottest per-agent queries (identified via `wrangler d1 insights`).

-- Covers agent month-KPI queries: WHERE tenant_id=? AND agent_id=? AND visit_date>=? AND visit_date<?
-- (company_id, visit_type included so GROUP BY visit_type counts are index-only).
CREATE INDEX IF NOT EXISTS idx_visits_agent_date ON visits(tenant_id, agent_id, visit_date, company_id, visit_type);

-- Covers agent store-search derived table: MAX(visit_date) per customer for one agent, index-only.
CREATE INDEX IF NOT EXISTS idx_visits_agent_customer ON visits(tenant_id, agent_id, customer_id, visit_date);
