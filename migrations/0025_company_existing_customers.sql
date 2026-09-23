-- Per-company "existing customer" exclusion lists (e.g. Diplomat's calling base).
--
-- Some companies hand over a master list of stores they already service. Agents
-- should not be able to run that company's questionnaire/custom-question flow at
-- one of those stores — /visits/check-existing-customer looks up a normalized
-- store name here and blocks the visit when it matches.
CREATE TABLE IF NOT EXISTS company_existing_customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  customer_code TEXT,
  address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (company_id) REFERENCES field_companies(id)
);

CREATE INDEX IF NOT EXISTS idx_cec_lookup ON company_existing_customers (tenant_id, company_id, normalized_name);
