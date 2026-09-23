-- Coordinates for the per-company do-not-visit list.
--
-- 0025 imported Diplomat's calling base with name, code and address only, which left
-- the GPS check at check-in able to place a listed store only when that store also
-- happened to exist as a customer record with coordinates — 827 of 16,347, about 5%.
-- The source workbook carries Latitude/Longitude for 94% of its rows, so those go
-- here and the check becomes positional instead of name-shaped.
--
-- Nullable: a row without coordinates is not an error, it just can't be matched by
-- position and still relies on the name check at store selection.
ALTER TABLE company_existing_customers ADD COLUMN latitude REAL;
ALTER TABLE company_existing_customers ADD COLUMN longitude REAL;

-- The check-in lookup is a bounding box around the agent, scoped to one company.
-- Leading company_id because the list is per-company and the tenant is implied by it.
CREATE INDEX IF NOT EXISTS idx_cec_geo ON company_existing_customers (tenant_id, company_id, latitude, longitude);
